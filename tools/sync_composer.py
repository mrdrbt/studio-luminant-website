#!/usr/bin/env python3
"""Copy the Catalog Composer into tasarla/ (served at studioluminant.com.tr/tasarla/), stamped against the year-long JS cache.

The Composer is built and tested in the umbrella repo (VAULT/10 - AI & Tools/catalog_composer/public); the website carries a
copy, because Netlify builds from this repo alone. Re-run after every Composer change, then commit tasarla/.

Netlify caches *.js and *.css for a year (netlify.toml), and the Composer's ES modules import each other by relative URL, which
tools/asset_versions.py cannot see (it stamps src/href in pages only). So this copy stamps every relative module import
("./x.js" -> "./x.js?v=<hash>") bottom-up, using asset_versions.content_hash of the STAMPED target, so a change anywhere in the
import graph changes every URL above it. The pages' own includes are then stamped by asset_versions itself, with the same hash.

Skipped: _comp/ (a design-comp scratch page, not part of the tool).

Usage (website repo root):  python tools/sync_composer.py [--src <composer public dir>]
"""
import argparse
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_versions import content_hash, run as stamp_pages  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "tasarla"
DEFAULT_SRC = ROOT.parent.parent / "10 — AI & Tools" / "catalog_composer" / "public"
SKIP = {"_comp"}
IMPORT = re.compile(r"""(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}/[^"'?]+\.js)(?:\?[^"']*)?\2""")


def copy_tree(src):
    if DST.exists():
        shutil.rmtree(DST)
    for p in sorted(src.rglob("*")):
        rel = p.relative_to(src)
        if p.is_dir() or rel.parts[0] in SKIP:
            continue
        out = DST / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, out)


def stamp_modules():
    """Rewrite relative imports in every .js under tasarla/, leaves first. Raises on an import cycle or a missing target."""
    done, visiting = set(), set()

    def visit(js):
        if js in done:
            return
        if js in visiting:
            raise SystemExit(f"import cycle at {js.relative_to(ROOT)}")
        visiting.add(js)
        text = js.read_text(encoding="utf-8")

        def fix(m):
            target = (js.parent / m[3]).resolve()
            if not target.is_file():
                raise SystemExit(f"{js.relative_to(ROOT)}: imports missing {m[3]}")
            visit(target)
            return f"{m[1]}{m[2]}{m[3]}?v={content_hash(target)}{m[2]}"

        new = IMPORT.sub(fix, text)
        if new != text:
            js.write_text(new, encoding="utf-8", newline="")
        visiting.discard(js)
        done.add(js)

    for js in sorted(DST.rglob("*.js")):
        visit(js.resolve())
    return len(done)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    a = ap.parse_args()
    if not (a.src / "index.html").is_file():
        raise SystemExit(f"no Composer at {a.src}")
    copy_tree(a.src)
    n = stamp_modules()
    stamp_pages(apply=True)
    files = sum(1 for p in DST.rglob("*") if p.is_file())
    print(f"tasarla/: {files} files copied from {a.src}, {n} modules stamped")


if __name__ == "__main__":
    main()
