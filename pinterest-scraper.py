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

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "X-APP-VERSION": "31461e0",
    "X-Pinterest-AppState": "active",
    "Origin": BASE,
    "Referer": BASE + "/",
}

FEED_URL = BASE + "/resource/BoardFeedResource/get/"
BOARD_URL = BASE + "/resource/BoardResource/get/"


def make_session():
    """
    Build a session with Pinterest's double-submit CSRF token: the same random
    value is sent as both the `csrftoken` cookie and the `X-CSRFToken` header,
    which is what lets the public /resource/ endpoints respond instead of 403.
    """
    token = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    s = requests.Session()
    s.headers.update(HEADERS)
    s.headers["X-CSRFToken"] = token
    s.cookies.set("csrftoken", token, domain=".pinterest.com")
    return s


def _call(session, url, options, source_url=""):
    """Make one Pinterest resource API call and return the parsed JSON."""
    params = {"source_url": source_url,
              "data": json.dumps({"options": options, "context": {}})}
    r = session.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


# ── Helpers ───────────────────────────────────────────────────────────────────

def slug_from_url(board_url):
    """Derive '<user>/<board>' and a filesystem-safe slug from a board URL."""
    path = urlparse(board_url).path.strip("/")
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        raise ValueError(f"Not a board URL (need /user/board/): {board_url}")
    username, board = parts[0], parts[1]
    slug = re.sub(r"[^a-z0-9]+", "-", board.lower()).strip("-")
    return f"/{username}/{board}/", slug


def get_board_id(session, board_path):
    """Resolve a board's numeric id via the public BoardResource endpoint."""
    username, slug = board_path.strip("/").split("/")[:2]
    options = {"slug": slug, "username": username, "field_set_key": "detailed"}
    data = _call(session, BOARD_URL, options, source_url=board_path)
    board = data["resource_response"]["data"]
    return board["id"], board.get("name", "")


def iter_pins(session, board_id, board_path, limit=None):
    """Yield pin dicts from a board, paging through BoardFeedResource."""
    options = {"board_id": board_id, "page_size": PAGE_SIZE}
    fetched = 0
    while True:
        payload = _call(session, FEED_URL, options, source_url=board_path)
        pins = payload["resource_response"]["data"]
        for pin in pins:
            yield pin
            fetched += 1
            if limit and fetched >= limit:
                return
        bookmark = payload["resource_response"].get("bookmark")
        if not bookmark or bookmark == "-end-" or not pins:
            return
        options["bookmarks"] = [bookmark]
        time.sleep(REQUEST_DELAY)


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
    r = session.get(url, timeout=TIMEOUT, headers={"User-Agent": HEADERS["User-Agent"]})
    r.raise_for_status()
    dest.write_bytes(r.content)
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def scrape_board(session, board_url, out_dir, limit, dry_run):
    board_path, slug = slug_from_url(board_url)
    username, board = board_path.strip("/").split("/")[:2]
    board_id, board_name = get_board_id(session, board_path)
    print(f"\n▸ Board '{board_name or board}' ({username}) — id {board_id}")

    board_dir = out_dir / slug
    if not dry_run:
        board_dir.mkdir(parents=True, exist_ok=True)

    records, n_dl, n_skip = [], 0, 0
    for pin in iter_pins(session, board_id, board_path, limit):
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
