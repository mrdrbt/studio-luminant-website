#!/usr/bin/env python3
"""Keep every sitemap.xml <lastmod> equal to its page's last commit date.

A <lastmod> that lags the page tells Google nothing changed, so edits wait
longer to be recrawled. The date comes from git (committer date of the last
commit touching the page file), never from the clock, so it only moves when
the page really changed.

Run from the website repo root:
    python tools/sitemap_lastmod.py --check     # report stale dates, exit 1 if any
    python tools/sitemap_lastmod.py --apply     # rewrite sitemap.xml

The pre-push hook runs --apply and blocks the push when it changed anything,
so the updated sitemap.xml is committed before the pages go live.
"""

import argparse
import pathlib
import re
import subprocess
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITEMAP = ROOT / "sitemap.xml"
ORIGIN = "https://studioluminant.com.tr/"

# Netlify serves both homepages from rewrites, so their URLs name no file.
HOME_FILES = {
    "": "Studio Luminant — Özel Mimari Elemanlar.htm",
    "en/": "en/Studio Luminant — Bespoke Architectural Elements.htm",
}

URL_BLOCK = re.compile(r"<url>.*?</url>", re.DOTALL)
LOC = re.compile(r"<loc>([^<]*)</loc>")
LASTMOD = re.compile(r"<lastmod>([^<]*)</lastmod>")


def page_file(loc):
    path = loc[len(ORIGIN):] if loc.startswith(ORIGIN) else loc
    return HOME_FILES.get(path, urllib.parse.unquote(path))


def last_commit_date(rel_path):
    result = subprocess.run(
        ["git", "-C", str(ROOT), "log", "-1", "--format=%cs", "--", rel_path],
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    return result.stdout.strip()


def refresh(text):
    """Return (new_text, stale, untracked) — stale is [(loc, old, new)]."""
    stale, untracked = [], []

    def fix(match):
        block = match.group(0)
        loc, lastmod = LOC.search(block), LASTMOD.search(block)
        if not loc or not lastmod:
            return block
        date = last_commit_date(page_file(loc.group(1)))
        if not date:
            untracked.append(loc.group(1))
            return block
        if lastmod.group(1) == date:
            return block
        stale.append((loc.group(1), lastmod.group(1), date))
        return block.replace(lastmod.group(0), f"<lastmod>{date}</lastmod>")

    return URL_BLOCK.sub(fix, text), stale, untracked


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    with SITEMAP.open(encoding="utf-8", newline="") as f:
        raw = f.read()
    new, stale, untracked = refresh(raw)

    for loc in untracked:
        print(f"[sitemap] no commit yet for {loc} — left as is", file=sys.stderr)
    for loc, old, date in stale:
        print(f"[sitemap] {loc}: {old} -> {date}", file=sys.stderr)

    if args.apply and stale:
        with SITEMAP.open("w", encoding="utf-8", newline="") as f:
            f.write(new)
    return 1 if stale else 0


if __name__ == "__main__":
    # Exit 1 means "dates were stale"; any failure of the tool itself exits 2 so the
    # pre-push hook can tell the two apart and fail open on the latter.
    try:
        sys.exit(main())
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"[sitemap] could not check dates: {exc}", file=sys.stderr)
        sys.exit(2)
