#!/usr/bin/env python3
"""Move the inline GA4 + Meta Pixel blocks behind consent.js.

The KVKK cookie guidance treats neither tracker as strictly necessary, so
neither may run before the visitor consents. consent.js injects them after
consent; this script removes the unconditional inline copies that would
otherwise fire on page load and defeat it.

Run from the website repo root:
    python tools/gate_trackers.py --check     # report only
    python tools/gate_trackers.py --apply     # rewrite the pages

Idempotent: pages already gated are skipped.
"""

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# The inline blocks are wrapped in an internal-traffic guard IIFE whose shape
# varies, so match on what the block *loads* rather than on its exact source.
# That guard is preserved — consent.js reimplements it in isInternal().
SCRIPT = re.compile(r"[ \t]*<script(?:\s[^>]*)?>.*?</script>[ \t]*\n?", re.DOTALL)
TRACKER_MARKERS = (
    "googletagmanager.com/gtag",
    "connect.facebook.net",
    "fbq('init'",
    'fbq("init"',
)
COMMENT = re.compile(
    r"[ \t]*<!--\s*(?:End\s+)?(?:Meta Pixel|GA4|Google Analytics)[^>]*-->[ \t]*\n?",
    re.IGNORECASE,
)
NOSCRIPT_PIXEL = re.compile(
    r"\n*[ \t]*<noscript><img[^>]*facebook\.com/tr\?id=.*?</noscript>", re.DOTALL
)


def strip_trackers(text: str):
    """Remove every <script> that loads GA4 or the Meta Pixel, plus their
    comment markers and the <noscript> pixel. Returns (text, blocks_removed)."""
    removed = 0

    def drop(match):
        nonlocal removed
        if any(marker in match.group(0) for marker in TRACKER_MARKERS):
            removed += 1
            return ""
        return match.group(0)

    text = SCRIPT.sub(drop, text)
    text, n = NOSCRIPT_PIXEL.subn("", text)
    removed += n
    text = COMMENT.sub("", text)
    return text, removed

CONSENT_TAG = re.compile(r'<script src="(?:\.\./)?consent\.js"></script>')
BODY_CLOSE = re.compile(r"\n?</body>")


def process(path: pathlib.Path, apply: bool):
    text = path.read_text(encoding="utf-8")
    text, removed = strip_trackers(text)

    if removed == 0 and CONSENT_TAG.search(text):
        return "already-gated", 0
    if removed == 0:
        return "no-trackers", 0

    if not CONSENT_TAG.search(text):
        prefix = "../" if path.parent.name == "en" else ""
        tag = f'\n<script src="{prefix}consent.js"></script>\n'
        if not BODY_CLOSE.search(text):
            return "no-body-close", removed
        text = BODY_CLOSE.sub(tag + "</body>", text, count=1)

    if apply:
        path.write_text(text, encoding="utf-8")
    return "gated", removed


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    pages = sorted(ROOT.glob("*.htm")) + sorted((ROOT / "en").glob("*.htm"))
    if not pages:
        print("No .htm pages found — run from the website repo root.", file=sys.stderr)
        return 1

    tally = {}
    for page in pages:
        status, removed = process(page, args.apply)
        tally[status] = tally.get(status, 0) + 1
        if status not in ("already-gated", "no-trackers"):
            rel = page.relative_to(ROOT)
            print(f"  {'gated ' if args.apply else 'would gate'} {rel} ({removed} blocks)")

    print()
    for status, count in sorted(tally.items()):
        print(f"{status}: {count}")

    leftover = [
        p.relative_to(ROOT)
        for p in pages
        if "googletagmanager" in p.read_text(encoding="utf-8")
        or "connect.facebook.net" in p.read_text(encoding="utf-8")
        or "facebook.com/tr?id=" in p.read_text(encoding="utf-8")
    ]
    if args.apply:
        if leftover:
            print(f"\n⚠ STILL UNGATED ({len(leftover)}):")
            for rel in leftover:
                print(f"  {rel}")
            return 1
        print("\n✓ No unconditional tracker remains in any page.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
