"""Bake the sample windows relight-tray.js lights: the same 600 mm window of each design, at one scale.

For each design in TRAY it writes into --out/<slug>/:
  normal-<lod>.<ext> RGB tangent-space normals, from the 16-bit heightmap and the real relief depth. Encoding per
                     design (NORMAL_ENC): a grazing light magnifies a normal's error about fivefold, so the lossy WebP
                     relief_bake.py uses shows as blotches at this size (p50 0.7 deg, p99 7-20 deg: its chroma is subsampled).
  height-<lod>.webp  lossless, half the normal's resolution: R = height. No albedo noise here: the tray compares
                     form, and a mottled ground would count as relief in the comparison.
  poster-<light>-<px>.webp
                     CPU render with relief_bake.py's shading model, one per named light in LIGHTS. The default
                     light's poster is the first paint; the others stand in for WebGL under reduced motion.
and --out/manifest.json: the window of each texture, the lights and the shading constants.

A design that repeats keeps exactly its module in the texture (the shader wraps it), so shadows run across the
joints. A design that does not repeat keeps the window plus up to APRON_MM of its surroundings, so shadows from just
outside the window still land inside it.

Usage:
  python tools/tray_bake.py --library "<umbrella>/VAULT/Library/Relief" [--out assets/relief-tray]
Needs numpy, opencv-python and Pillow, as relief_bake.py does. Not run by the site.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import relief_bake as rb

ROOT = Path(__file__).resolve().parent.parent
WINDOW_MM = 600.0
APRON_MM = 100.0
LODS = {"s": 512 / WINDOW_MM, "l": 768 / WINDOW_MM}  # normal-map pixels per mm. Below 512, one-texel lines stair-step on a phone.
NORMAL_FROM_PX_PER_MM = 2.56  # normals are computed this fine, then averaged down: computed at a small LOD, a thin
                              # edge spreads over three texels and reads about 40 % too dark (shader vs poster, 2026-11-07)
POSTER_PX = (560, 840)
POSTER_Q = 78

# az 0 = from the right, 90 = from above, 180 = from the left. el = degrees above the wall's surface.
LIGHTS = {
    "ceiling": {"az": 90.0, "el": 12.0},
    "window": {"az": 172.0, "el": 16.0},
    "front": {"az": 90.0, "el": 55.0},
}
DEFAULT_LIGHT = "ceiling"

# Window origin in mm within the design's own sheet, for the designs that do not repeat.
ORIGIN = {"fugato": (1500.0, 900.0), "glissando": (0.0, 300.0)}
READ_SET = ("andante", "antiphon", "fioritura", "fugato", "glissando", "hocket", "mezzavoce", "ricercar")  # tray_read.py
TRAY = ("accelerando", "andante", "antiphon", "fioritura", "fugato", "glissando", "gruppetto", "hemiola", "hocket",
        "melisma", "mezzavoce", "ricercar", "rondeau", "sonado")
# A design whose heightmap is not in the Library folder: the staging file its design page was baked from.
HM_STAGING = {"sonado": "heightmaps/2026-11-07_092-sonado-web/092_sonado_hm16.png"}

# A study's look depends on how its moulds are laid, so its window comes from the laid wall, not from one module. Each
# heightmap is the one behind the design's published wall render (designs.json src.wall -> its .args.json), except
# Hemiola's, which tools/tray_hemiola_hm.py rasterises from the STLs and the booth lay. Not in the tile registry.
SEAMLESS_WORK = "Images/2026-10-30_seamless_2040/_work"
WALLS = {
    "accelerando": {"hm": f"{SEAMLESS_WORK}/optic_wall_hm16_2ppmm.png", "sheet_mm": (1600.0, 1200.0), "relief_mm": 19.979, "origin": (500.0, 300.0)},
    "gruppetto": {"hm": f"{SEAMLESS_WORK}/crest_wall_hm16_2ppmm.png", "sheet_mm": (1600.0, 1200.0), "relief_mm": 30.0, "origin": (200.0, 200.0)},
    "hemiola": {"hm": "heightmaps/2026-11-07_hemiola_booth_hm16_2ppmm.png", "sheet_mm": (800.0, 800.0), "relief_mm": 66.89, "origin": (100.0, 100.0)},
    "melisma": {"hm": f"{SEAMLESS_WORK}/rotor_wall_hm16_2ppmm.png", "sheet_mm": (1600.0, 1200.0), "relief_mm": 18.0, "origin": (500.0, 300.0)},
    "rondeau": {"hm": f"{SEAMLESS_WORK}/dish_wall_hm16_2ppmm.png", "sheet_mm": (2400.0, 1200.0), "relief_mm": 18.0, "origin": (900.0, 200.0)},
}

# Smallest encoding that held the error down, measured per design on 2026-11-07: ("webp", bits dropped before
# lossless) suits hard-edged parametric faces, ("avif", quality) at 4:4:4 suits smooth or dense ones.
NORMAL_ENC = {
    "accelerando": ("avif", 85),
    "andante": ("webp", 1),
    "antiphon": ("webp", 0),
    "fioritura": ("webp", 1),
    "fugato": ("avif", 85),
    "glissando": ("avif", 75),   # the heaviest by far; its dense fibre masks the extra error
    "gruppetto": ("avif", 85),
    "hemiola": ("avif", 85),
    "hocket": ("avif", 85),
    "melisma": ("avif", 85),
    "mezzavoce": ("avif", 85),
    "ricercar": ("avif", 85),
    "rondeau": ("avif", 85),
    "sonado": ("avif", 85),
}


def design_sources(library, slugs=TRAY):
    """{slug: {hm, sheet_mm, relief_mm, wrap, origin}} from designs.json and each design's relief manifest."""
    designs = {d["slug"]: d for d in json.loads((ROOT / "tools/designs.json").read_text(encoding="utf-8"))["designs"]}
    staging = library.parents[1] / "10 — AI & Tools" / "FACTORY" / "00 — Staging"
    out = {}
    for slug in slugs:
        if slug in WALLS:
            wall = WALLS[slug]
            out[slug] = {"hm": staging / wall["hm"], "sheet_mm": wall["sheet_mm"], "relief_mm": wall["relief_mm"],
                         "wrap": False, "origin": wall["origin"]}
            continue
        d = designs[slug]
        m = json.loads((ROOT / "assets/relief" / d["asset"] / "manifest.json").read_text(encoding="utf-8"))
        out[slug] = {
            "hm": staging / HM_STAGING[slug] if slug in HM_STAGING else library / d["library"] / "heightmap.png",
            "sheet_mm": (float(m["panelWmm"]), float(m["panelHmm"])),
            "relief_mm": float(m["reliefMm"]),
            "wrap": m.get("layout") == "field",
            "origin": ORIGIN.get(slug, (0.0, 0.0)),
        }
    return out


def texture_span(src):
    """The stretch of the sheet the texture keeps, in mm, and where the window sits inside it."""
    sheet_w, sheet_h = src["sheet_mm"]
    if src["wrap"]:
        return (0.0, 0.0, sheet_w, sheet_h), (0.0, 0.0)
    ox, oy = src["origin"]
    x0, y0 = max(0.0, ox - APRON_MM), max(0.0, oy - APRON_MM)
    x1, y1 = min(sheet_w, ox + WINDOW_MM + APRON_MM), min(sheet_h, oy + WINDOW_MM + APRON_MM)
    return (x0, y0, x1, y1), (ox - x0, oy - y0)


def sample_span(h16, sheet_mm, span, px_per_mm):
    """The span of the 16-bit sheet, resampled to px_per_mm."""
    rows, cols = h16.shape
    sx, sy = cols / sheet_mm[0], rows / sheet_mm[1]
    x0, y0, x1, y1 = span
    crop = h16[round(y0 * sy):round(y1 * sy), round(x0 * sx):round(x1 * sx)]
    return rb.resize(crop, max(1, round((x1 - x0) * px_per_mm)), max(1, round((y1 - y0) * px_per_mm)))


def save_normal(rgb, enc, stem):
    kind, value = enc
    if kind == "avif":
        path = stem.with_suffix(".avif")
        Image.fromarray(rgb, "RGB").save(path, quality=value, subsampling="4:4:4", speed=4, range="full")
        return path.name
    path = stem.with_suffix(".webp")
    kept = rgb if value == 0 else np.clip((rgb.astype(np.int32) >> value << value) + (1 << (value - 1)), 0, 255).astype(np.uint8)
    Image.fromarray(kept, "RGB").save(path, lossless=True, quality=100, method=6)
    return path.name


def bake_textures(h16, src, enc, span, slug_dir):
    files = {}
    fine = sample_span(h16, src["sheet_mm"], span, NORMAL_FROM_PX_PER_MM)
    fine_normal = rb.bake_normals(fine, src["relief_mm"], (span[2] - span[0]) / fine.shape[1], src["wrap"])
    for lod, px_per_mm in LODS.items():
        h01 = sample_span(h16, src["sheet_mm"], span, px_per_mm)
        normal = rb.resize(fine_normal, h01.shape[1], h01.shape[0])
        normal /= np.linalg.norm(normal, axis=2, keepdims=True)
        half = rb.resize(h01, max(1, h01.shape[1] // 2), max(1, h01.shape[0] // 2))
        h8 = np.rint(np.clip(half, 0, 1) * 255).astype(np.uint8)
        normal_name = save_normal(rb.to_rgb8(normal), enc, slug_dir / f"normal-{lod}")
        Image.fromarray(np.dstack([h8, h8, h8]), "RGB").save(slug_dir / f"height-{lod}.webp", lossless=True, quality=100,
                                                            method=6)
        files[lod] = {"normal": normal_name, "height": f"height-{lod}.webp",
                      "heightPxPerMm": h8.shape[1] / (span[2] - span[0])}
    return files


def around_window(a, win_px, side, pad):
    """The window of a repeating array plus pad pixels all round, wrapping across the joints."""
    rows = np.arange(win_px[1] - pad, win_px[1] + side + pad) % a.shape[0]
    cols = np.arange(win_px[0] - pad, win_px[0] + side + pad) % a.shape[1]
    return a[np.ix_(rows, cols)]


def textures_on_disk(enc, span):
    """The manifest entries bake_textures would write, for a run that leaves the textures alone."""
    out = {}
    ext = "avif" if enc[0] == "avif" else "webp"
    for lod, px_per_mm in LODS.items():
        cols = max(1, round((span[2] - span[0]) * px_per_mm))
        out[lod] = {"normal": f"normal-{lod}.{ext}", "height": f"height-{lod}.webp",
                    "heightPxPerMm": max(1, cols // 2) / (span[2] - span[0])}
    return out


def render_window(h16, src, span, win, az, el, px_per_mm):
    """The window under one light, RGB uint8, with the shading model the shader uses and neutral albedo."""
    h01 = sample_span(h16, src["sheet_mm"], span, px_per_mm)
    mm_per_px = (span[2] - span[0]) / h01.shape[1]
    normal = rb.bake_normals(h01, src["relief_mm"], mm_per_px, src["wrap"])
    side = round(WINDOW_MM / mm_per_px)
    win_px = (round(win[0] / mm_per_px), round(win[1] / mm_per_px))
    if src["wrap"]:  # keep only as much of the repeat as the longest shadow can reach
        pad = int(np.ceil(src["relief_mm"] / np.tan(np.radians(el)) / mm_per_px)) + 2
        norm, h01 = around_window(normal, win_px, side, pad), around_window(h01, win_px, side, pad)
        org = (pad, pad)
    else:
        norm, org = normal, win_px
    hmm = h01 * src["relief_mm"]
    box = (-0.5, hmm.shape[1] - 0.5, -0.5, hmm.shape[0] - 0.5)
    rb.SHADE = {**rb.SHADE, "azDefault": az, "elDefault": el}
    img = rb.shade(norm, hmm, np.ones(hmm.shape, bool), np.zeros(hmm.shape, np.float32), mm_per_px, box, src["relief_mm"])
    return img[org[1]:org[1] + side, org[0]:org[0] + side]


def bake_posters(h16, src, span, win, slug_dir):
    for light, L in LIGHTS.items():
        big = render_window(h16, src, span, win, L["az"], L["el"], POSTER_PX[-1] / WINDOW_MM)
        for px in POSTER_PX:
            img = Image.fromarray(big).resize((px, px), Image.LANCZOS)
            img.save(slug_dir / f"poster-{light}-{px}.webp", quality=POSTER_Q, method=6)


def manifest_entry(src, span, win, files):
    return {"texMm": [span[2] - span[0], span[3] - span[1]], "win": list(win), "reliefMm": src["relief_mm"],
            "wrap": src["wrap"], "lods": files}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--library", type=Path, required=True, help="VAULT/Library/Relief in the umbrella checkout")
    ap.add_argument("--out", type=Path, default=ROOT / "assets/relief-tray")
    ap.add_argument("--only", nargs="*", help="slugs to re-bake; the rest keep their files (default: all of TRAY)")
    ap.add_argument("--posters-only", action="store_true", help="keep the textures, re-render the posters")
    a = ap.parse_args()
    sources = design_sources(a.library)
    designs = {}
    for slug, src in sources.items():
        span, win = texture_span(src)
        enc = NORMAL_ENC[slug]
        if a.only and slug not in a.only:
            designs[slug] = manifest_entry(src, span, win, textures_on_disk(enc, span))
            continue
        h16 = rb.read_hm16(src["hm"])
        slug_dir = a.out / slug
        slug_dir.mkdir(parents=True, exist_ok=True)
        files = textures_on_disk(enc, span) if a.posters_only else bake_textures(h16, src, enc, span, slug_dir)
        bake_posters(h16, src, span, win, slug_dir)
        designs[slug] = manifest_entry(src, span, win, files)
        kb = {f.name: round(f.stat().st_size / 1024) for f in sorted(slug_dir.iterdir())}
        print(slug, kb, flush=True)
    manifest = {"windowMm": WINDOW_MM, "lights": LIGHTS, "defaultLight": DEFAULT_LIGHT, "posterPx": list(POSTER_PX),
                "lodPxPerMm": LODS, "designs": designs,
                "shade": {k: v for k, v in rb.SHADE.items() if k not in ("azDefault", "elDefault", "albedoVar")}}
    (a.out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
