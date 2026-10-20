#!/usr/bin/env python3
"""Stamp every local stylesheet/script include with a content-hash version query.

Netlify serves *.css / *.js with a one-week max-age (netlify.toml), so a
returning visitor can pair a freshly deployed page with last week's shared.css.
Every include like  <link href="../shared.css">  becomes  ...shared.css?v=1a2b3c4d
where the hash is taken from the file's content, so the URL changes exactly when
the file does and never otherwise (re-running changes nothing).

Scope: every .htm / .html page in the tree (TR root and en/), every local
.css / .js reference in a src= or href= attribute. External URLs (cdnjs, GTM)
are left alone. A reference whose file is missing is reported and exits 2.

Run from the website repo root:
    python tools/asset_versions.py --check     # report unversioned/stale, exit 1 if any
    python tools/asset_versions.py --apply     # rewrite the pages

The pre-push hook runs --apply and blocks the push when it changed anything,
so the stamped pages are committed before they go live.
"""

import argparse
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {"docs", "node_modules", ".git", ".claude", "tools"}

# (href|src)="<path>.css|.js[?query][#frag]" — quoted, double or single.
REF = re.compile(
    r"""(?P<attr>\b(?:href|src)=)(?P<q>["'])(?P<path>[^"'?#<>\s]+\.(?:css|js))"""
    r"""(?:\?(?P<query>[^"'#]*))?(?P<frag>#[^"']*)?(?P=q)"""
)


def content_hash(path):
    # Normalise line endings so a CRLF checkout hashes like an LF one.
    data = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()[:8]


def is_local(ref):
    return not re.match(r"^(?:[a-z][a-z0-9+.-]*:|//)", ref, re.I)


def resolve(page, ref):
    base = ROOT if ref.startswith("/") else page.parent
    return (base / ref.lstrip("/")).resolve()


def pages():
    for p in sorted(ROOT.rglob("*")):
        if p.suffix.lower() in (".htm", ".html") and p.is_file():
            if not SKIP_DIRS & set(p.relative_to(ROOT).parts[:-1]):
                yield p


def restamp(page, text, cache, missing):
    """Return (new_text, changed) — changed is [(ref, old_query, new_query)]."""
    changed = []

    def fix(match):
        ref = match["path"]
        if not is_local(ref):
            return match.group(0)
        target = resolve(page, ref)
        if not target.is_file():
            missing.append((page, ref))
            return match.group(0)
        if target not in cache:
            cache[target] = content_hash(target)
        new_q = "v=" + cache[target]
        if match["query"] == new_q:
            return match.group(0)
        changed.append((ref, match["query"], new_q))
        q = match["q"]
        return f"{match['attr']}{q}{ref}?{new_q}{match['frag'] or ''}{q}"

    return REF.sub(fix, text), changed


def run(apply):
    cache, missing, total = {}, [], 0
    for page in pages():
        text = page.read_text(encoding="utf-8")
        new_text, changed = restamp(page, text, cache, missing)
        if not changed:
            continue
        total += len(changed)
        rel = page.relative_to(ROOT).as_posix()
        print(f"{'stamped' if apply else 'stale'}: {rel} ({len(changed)})")
        if apply:
            # newline="" keeps each page's existing line endings untouched.
            with open(page, "w", encoding="utf-8", newline="") as fh:
                fh.write(new_text)
    for page, ref in missing:
        print(f"MISSING: {page.relative_to(ROOT).as_posix()} -> {ref}", file=sys.stderr)
    print(f"{total} include(s) {'rewritten' if apply else 'need a version'}; {len(cache)} distinct asset(s).")
    if missing:
        return 2
    return 1 if total else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    sys.exit(run(apply=args.apply))


if __name__ == "__main__":
    main()
