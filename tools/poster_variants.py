"""Write the phone-sized and WebP renditions of every relief poster from its poster-1680.jpg.

relief_bake.py writes poster-1680.jpg and poster-840.jpg. A DPR-3 phone shows the hero at ~340 CSS px, so it
picked the 1680 JPG (up to 830 KB on fine-grained reliefs) and the design pages' LCP sat at 7.6 s on a throttled
phone (mobile QA 2026-11-23). This adds, next to each poster-1680.jpg under assets/relief/<asset>/:
  poster-1080.jpg                      the missing middle step for browsers without WebP (numbers = long side)
  poster-840.webp, poster-1080.webp, poster-1680.webp   WebP q80 (andante 1080: 276 KB vs the 814 KB JPG it replaces)
Resized with LANCZOS from the 1680 render, never stretched (the aspect ratio is kept). build_designs.py and
build_process.py serve them through <picture>. relief_bake.py calls write_variants() after a bake.

Usage:
  python tools/poster_variants.py            # write missing or stale renditions for every relief
  python tools/poster_variants.py --check    # exit 1 if any rendition is missing or older than its poster-1680.jpg
Needs Pillow (WebP).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RELIEF = ROOT / "assets" / "relief"
WIDTHS = (840, 1080, 1680)
JPG_Q = 82  # = relief_bake.POSTER_Q
WEBP_Q = 80


def srcset(rel: str, pw: int, ext: str) -> str:
    """The srcset of a relief poster in `ext` (jpg / webp); pw = the manifest's poster width (the 1680 file's)."""
    return ", ".join(f"{rel}poster-{w}.{ext} {round(pw * w / 1680)}w" for w in WIDTHS)


def picture(rel: str, pw: int, sizes: str, img_attrs: str) -> str:
    """The poster as <picture>: WebP first, JPG fallback. The wrapper is display: contents (shared.css), so the
    <img class="relief-light__poster"> keeps its CSS box and relief-light.js still finds it."""
    return (f'<picture class="relief-light__pic"><source type="image/webp" srcset="{srcset(rel, pw, "webp")}" sizes="{sizes}">'
            f'<img class="relief-light__poster" src="{rel}poster-1680.jpg" srcset="{srcset(rel, pw, "jpg")}" sizes="{sizes}" '
            f'{img_attrs}></picture>')


def preload(rel: str, pw: int, sizes: str) -> str:
    """The LCP preload: WebP only (type= makes a browser without WebP skip it and fetch the <img> fallback)."""
    return (f'<link rel="preload" as="image" href="{rel}poster-1680.webp" imagesrcset="{srcset(rel, pw, "webp")}" '
            f'imagesizes="{sizes}" type="image/webp" fetchpriority="high">\n')


def targets(folder: Path) -> list[Path]:
    return [folder / "poster-1080.jpg"] + [folder / f"poster-{w}.webp" for w in WIDTHS]


def stale(folder: Path) -> list[Path]:
    src = folder / "poster-1680.jpg"
    return [t for t in targets(folder) if not t.exists() or t.stat().st_mtime < src.stat().st_mtime]


def write_variants(folder: Path) -> list[Path]:
    """Write every rendition of folder/poster-1680.jpg; returns the files written."""
    src = Image.open(folder / "poster-1680.jpg").convert("RGB")
    written = []
    for w in WIDTHS:  # w names the LONG side, as relief_bake's 840 / 1680 do (glissando is a 980 x 1680 portrait)
        k = w / max(src.size)
        img = src if k == 1 else src.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS)
        if w == 1080:
            img.save(folder / "poster-1080.jpg", quality=JPG_Q, optimize=True, progressive=True)
            written.append(folder / "poster-1080.jpg")
        img.save(folder / f"poster-{w}.webp", quality=WEBP_Q, method=6)
        written.append(folder / f"poster-{w}.webp")
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report missing/stale renditions, write nothing")
    a = ap.parse_args()
    # A folder with poster-640.jpg is a homepage hero: its own hand-tuned 640-1680 JPG set, written into the
    # homepage by hand and already light (~130 KB) -- not ours to touch.
    folders = sorted(p.parent for p in RELIEF.glob("*/poster-1680.jpg") if not (p.parent / "poster-640.jpg").exists())
    todo = [f for f in folders if stale(f)]
    if a.check:
        for f in todo:
            print(f"stale: {f.relative_to(ROOT)}")
        return 1 if todo else 0
    for f in todo:
        for p in write_variants(f):
            print(f"wrote {p.relative_to(ROOT)} ({p.stat().st_size // 1024} KB)")
    print(f"{len(todo)} of {len(folders)} relief folder(s) updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
