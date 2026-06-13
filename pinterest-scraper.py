#!/usr/bin/env python3
"""
Studio Luminant — Pinterest Board Scraper (design reference / LLM ref)

Downloads the full-resolution images from one or more PUBLIC Pinterest boards
and writes a metadata manifest (titles, descriptions, alt text, source links)
so the images can be fed to an LLM with usable context.

Only works on PUBLIC boards — it uses Pinterest's public BoardFeedResource
endpoint, no login or password. Make the board public, then pass its URL.

Usage:
    python pinterest-scraper.py https://www.pinterest.com/<user>/<board>/
    python pinterest-scraper.py URL1 URL2 ...        # multiple boards
    python pinterest-scraper.py --boards boards.txt   # one URL per line
    python pinterest-scraper.py URL --out ref/pinterest --limit 50
    python pinterest-scraper.py URL --dry-run         # list pins, download nothing

Output (default --out: ref/pinterest/):
    ref/pinterest/<board-slug>/<pin-id>.jpg     # original images
    ref/pinterest/manifest.json                 # metadata for every pin

NOTE: This must run from an environment with internet access to
www.pinterest.com and i.pinimg.com. Claude Code's hosted/web sandbox uses an
egress allowlist that blocks those hosts by default — add them in the
environment's network egress settings, or just run this script locally.
"""

import argparse
import json
import random
import re
import string
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

# ── Config ──────────────────────────────────────────────────────────────────

BASE = "https://www.pinterest.com"
DEFAULT_OUT = Path(__file__).parent / "ref" / "pinterest"
PAGE_SIZE = 250                 # pins per BoardFeedResource request (max)
REQUEST_DELAY = 0.7             # polite delay between requests (seconds)
TIMEOUT = 20

# Headers for fetching the board's HTML page (browser-like, primes cookies)
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}

FEED_URL = BASE + "/resource/BoardFeedResource/get/"


def make_session():
    """Session seeded with a random CSRF token (double-submit cookie pattern)."""
    token = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    s = requests.Session()
    s.headers.update(BROWSER_HEADERS)
    s.cookies.set("csrftoken", token, domain=".pinterest.com")
    return s


# ── Embedded-data parsing ─────────────────────────────────────────────────────

def _iter_json_scripts(html):
    """Yield the parsed contents of every <script type=application/json> block."""
    pattern = re.compile(
        r'<script[^>]*type="application/json"[^>]*>(.*?)</script>',
        re.DOTALL)
    for raw in pattern.findall(html):
        try:
            yield json.loads(raw.strip())
        except (ValueError, json.JSONDecodeError):
            continue


def _looks_like_pin(obj):
    """A pin object has an id and an images map with url-bearing variants."""
    if not isinstance(obj, dict) or "id" not in obj:
        return False
    imgs = obj.get("images")
    return isinstance(imgs, dict) and any(
        isinstance(v, dict) and "url" in v for v in imgs.values())


def _walk(obj, on_dict):
    """Depth-first walk over nested dicts/lists, calling on_dict for each dict."""
    if isinstance(obj, dict):
        on_dict(obj)
        for v in obj.values():
            _walk(v, on_dict)
    elif isinstance(obj, list):
        for v in obj:
            _walk(v, on_dict)


def parse_board_page(html, slug):
    """
    Extract (board_id, board_name, pins) from a board page's embedded JSON.
    Walks all JSON blobs collecting pin-like objects (deduped by id) and the
    board object whose slug matches, so it survives Pinterest's layout changes.
    """
    pins, board_id, board_name = {}, None, ""

    def visit(d):
        nonlocal board_id, board_name
        if _looks_like_pin(d):
            pins.setdefault(d["id"], d)
        # Board object: has a slug + a numeric id + a pin_count
        if (d.get("slug") == slug and "pin_count" in d
                and str(d.get("id", "")).isdigit()):
            board_id = d["id"]
            board_name = d.get("name", "")

    for blob in _iter_json_scripts(html):
        _walk(blob, visit)

    return board_id, board_name, list(pins.values())


# ── Helpers ───────────────────────────────────────────────────────────────────

def slug_from_url(board_url):
    """Derive '<user>/<board>' and a filesystem-safe slug from a board URL."""
    path = urlparse(board_url).path.strip("/")
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        raise ValueError(f"Not a board URL (need /user/board/): {board_url}")
    username, board = parts[0], parts[1]
    slug = re.sub(r"[^a-z0-9]+", "-", board.lower()).strip("-")
    return f"/{username}/{board}/", slug, board


def fetch_board_page(session, board_path):
    """Load the board's HTML page (primes cookies) and return the HTML."""
    r = session.get(BASE + board_path, timeout=TIMEOUT)
    r.raise_for_status()
    # Echo Pinterest's own csrftoken cookie back in the API header
    token = session.cookies.get("csrftoken")
    if token:
        session.headers["X-CSRFToken"] = token
    return r.text


def api_pins(session, board_id, board_path, slug, after_id):
    """
    Page through BoardFeedResource for pins beyond what the HTML page held.
    Best-effort: yields nothing (rather than raising) if the API rejects us.
    """
    options = {"board_id": board_id, "page_size": PAGE_SIZE}
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "X-Pinterest-AppState": "active",
        "X-Pinterest-PWS-Handler": "www/[username]/[slug].js",
        "Referer": BASE + board_path,
        "Origin": BASE,
    }
    while True:
        params = {"source_url": board_path,
                  "data": json.dumps({"options": options, "context": {}})}
        try:
            r = session.get(FEED_URL, params=params, headers=headers, timeout=TIMEOUT)
            r.raise_for_status()
            payload = r.json()
        except (requests.RequestException, ValueError) as e:
            print(f"   (api pagination stopped: {e})", file=sys.stderr)
            return
        pins = payload["resource_response"]["data"]
        for pin in pins:
            yield pin
        bookmark = payload["resource_response"].get("bookmark")
        if not bookmark or bookmark == "-end-" or not pins:
            return
        options["bookmarks"] = [bookmark]
        time.sleep(REQUEST_DELAY)


def iter_pins(session, board_path, slug, limit=None):
    """Yield unique pins: those embedded in the HTML page, then API pages."""
    html = fetch_board_page(session, board_path)
    board_id, board_name, html_pins = parse_board_page(html, slug)
    print(f"   board id: {board_id or '?'} | {len(html_pins)} pins on first page")

    seen, fetched = set(), 0
    for pin in html_pins:
        if pin["id"] in seen:
            continue
        seen.add(pin["id"])
        yield pin
        fetched += 1
        if limit and fetched >= limit:
            return

    if not board_id:
        return  # no id -> can't paginate; HTML pins are all we get
    for pin in api_pins(session, board_id, board_path, slug, None):
        if pin.get("id") in seen:
            continue
        seen.add(pin["id"])
        yield pin
        fetched += 1
        if limit and fetched >= limit:
            return


def best_image_url(pin):
    """Pick the highest-resolution image URL available for a pin."""
    images = pin.get("images") or {}
    if "orig" in images:
        return images["orig"]["url"]
    # Fall back to the largest sized variant Pinterest returned
    sized = [v for v in images.values() if isinstance(v, dict) and v.get("url")]
    sized.sort(key=lambda v: v.get("width", 0), reverse=True)
    return sized[0]["url"] if sized else None


def pin_metadata(pin, board_slug, image_url, local_file):
    """Flatten the fields useful for an LLM into a compact record."""
    pinner = (pin.get("pinner") or {})
    return {
        "id": pin.get("id"),
        "board": board_slug,
        "title": (pin.get("title") or pin.get("grid_title") or "").strip(),
        "description": (pin.get("description") or "").strip(),
        "alt_text": (pin.get("auto_alt_text") or pin.get("alt_text") or "").strip(),
        "dominant_color": pin.get("dominant_color"),
        "source_link": pin.get("link"),
        "pin_url": f"https://www.pinterest.com/pin/{pin.get('id')}/",
        "created_by": pinner.get("username"),
        "image_url": image_url,
        "local_file": local_file,
    }


def download(session, url, dest):
    """Download an image to dest. Returns True if written, False if skipped."""
    if dest.exists() and dest.stat().st_size > 0:
        return False
    r = session.get(url, timeout=TIMEOUT,
                    headers={"User-Agent": BROWSER_HEADERS["User-Agent"]})
    r.raise_for_status()
    dest.write_bytes(r.content)
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def scrape_board(session, board_url, out_dir, limit, dry_run):
    board_path, slug, board = slug_from_url(board_url)
    username = board_path.strip("/").split("/")[0]
    print(f"\n▸ Board '{board}' ({username})")

    board_dir = out_dir / slug
    if not dry_run:
        board_dir.mkdir(parents=True, exist_ok=True)

    records, n_dl, n_skip = [], 0, 0
    for pin in iter_pins(session, board_path, slug, limit):
        img_url = best_image_url(pin)
        if not img_url:
            continue
        ext = Path(urlparse(img_url).path).suffix or ".jpg"
        fname = f"{pin.get('id')}{ext}"
        local_rel = str(Path(slug) / fname)
        records.append(pin_metadata(pin, slug, img_url, local_rel))

        if dry_run:
            print(f"   • {pin.get('id')}  {img_url}")
            continue
        try:
            if download(session, img_url, board_dir / fname):
                n_dl += 1
                print(f"   ✓ {fname}")
            else:
                n_skip += 1
        except requests.RequestException as e:
            print(f"   ✗ {fname}: {e}", file=sys.stderr)
        time.sleep(REQUEST_DELAY)

    print(f"   {len(records)} pins | {n_dl} downloaded, {n_skip} already present")
    return records


def main():
    ap = argparse.ArgumentParser(description="Scrape public Pinterest boards for design/LLM reference.")
    ap.add_argument("urls", nargs="*", help="Public board URL(s)")
    ap.add_argument("--boards", help="File with one board URL per line")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output directory")
    ap.add_argument("--limit", type=int, help="Max pins per board (for testing)")
    ap.add_argument("--dry-run", action="store_true", help="List pins, download nothing")
    args = ap.parse_args()

    urls = list(args.urls)
    if args.boards:
        urls += [l.strip() for l in Path(args.boards).read_text().splitlines()
                 if l.strip() and not l.startswith("#")]
    if not urls:
        ap.error("Provide at least one board URL, or --boards <file>.")

    session = make_session()

    all_records = []
    for url in urls:
        try:
            all_records += scrape_board(session, url, args.out, args.limit, args.dry_run)
        except (requests.RequestException, ValueError, KeyError) as e:
            print(f"ERROR scraping {url}: {e}", file=sys.stderr)

    if not args.dry_run and all_records:
        args.out.mkdir(parents=True, exist_ok=True)
        manifest = args.out / "manifest.json"
        manifest.write_text(json.dumps(
            {"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "count": len(all_records), "pins": all_records},
            indent=2, ensure_ascii=False))
        print(f"\n✅ Wrote {len(all_records)} pins to {manifest}")
    elif args.dry_run:
        print(f"\n(dry run) {len(all_records)} pins found across {len(urls)} board(s)")


if __name__ == "__main__":
    main()
