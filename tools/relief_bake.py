"""Bake the textures, poster and manifest that relief-light.js renders, from one 16-bit relief heightmap.

Brightness = height (never inverted). For one relief it writes into --out:
  normal-<N>.webp  RGB tangent-space normals (lossy WebP, --normal-q) (+X right, +Y up, +Z to viewer), from the
                   full 16-bit data, scaled by the real relief depth and panel size. N = the long side, one per
                   --sizes entry.
  height-<N/2>.webp lossless RGB at HALF the normal size: R = height (8-bit: 0.06 mm steps on 16 mm, ample for
                   shadow marching; the fine detail lives in the normals), G = albedo variation (128 = neutral),
                   B = 0. Shadows read soft structure, so half resolution is enough.
  poster-1680.jpg, poster-840.jpg
                   CPU render with the same shading model at the manifest's default light (long side 1680 / 840).
                   --layout panel: the panel standing base_mm proud of a flat plaster wall, margin_mm of wall
                   on every side. --layout field: --field-tiles of the relief edge to edge (it must tile
                   seamlessly), shadows wrapping across the joints. This is the LCP image; the WebGL canvas
                   fades in over it.
  manifest.json    physical size, layout, shading constants, default light, wall colour and file list. The
                   engine reads its constants from here, so the poster and the first frame match.

Usage:
  python tools/relief_bake.py <heightmap.png> --out assets/relief/<slug> --panel-mm 600 [600] --relief-mm 16
         [--base-mm 10] [--layout panel|field --field-tiles 2 2]
Needs numpy, opencv-python and Pillow (WebP). Not run by the site; run it by hand when a relief changes.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SHADE = {  # shading model shared with relief-light.js through manifest.json
    "albedo": [233, 226, 211], "albedoVar": 0.035, "ambient": 0.08, "bounce": 0.10,
    "flatLevel": 1.0, "shoulder": 0.85, "spec": 0.05, "specPow": 6.0, "shadowStrength": 0.7,
    "penumbraDeg": 4.0, "stepPow": 1.6, "azDefault": 125.0, "elDefault": 16.0,
}
POSTER_STEPS = 40
POSTER_PX = 1680
POSTER_Q = 82


def read_hm16(path):
    img = cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if img is None or img.dtype != np.uint16 or img.ndim != 2:
        raise SystemExit(f"expected a single-channel 16-bit PNG: {path}")
    return img.astype(np.float32) / 65535.0


def resize(a, w, h):
    return cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA)


def fit(shape, long_side):
    rows, cols = shape[:2]
    s = long_side / max(rows, cols)
    return max(1, round(cols * s)), max(1, round(rows * s))


def bake_normals(h01, relief_mm, mm_per_px, wrap=False):
    z = h01 * relief_mm
    if wrap:  # Sobel has no wrap border: pad periodically, filter, crop back
        z = np.pad(z, 1, mode="wrap")
    dzdx = cv2.Sobel(z, cv2.CV_32F, 1, 0, ksize=3) / (8.0 * mm_per_px)
    dzdrow = cv2.Sobel(z, cv2.CV_32F, 0, 1, ksize=3) / (8.0 * mm_per_px)
    if wrap:
        dzdx, dzdrow, z = dzdx[1:-1, 1:-1], dzdrow[1:-1, 1:-1], z[1:-1, 1:-1]
    n = np.dstack([-dzdx, dzdrow, np.ones_like(z)])
    return n / np.linalg.norm(n, axis=2, keepdims=True)


def to_rgb8(n):
    return np.clip(np.rint((n * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8)


def albedo_noise(shape, seed=7):
    rows, cols = shape
    rng = np.random.default_rng(seed)
    out = np.zeros(shape, np.float32)
    for g, w in ((7, 0.7), (25, 0.3)):
        out += w * cv2.resize(rng.standard_normal((g, g)).astype(np.float32), (cols, rows),
                              interpolation=cv2.INTER_CUBIC)
    out -= out.mean()
    return out / np.abs(out).max()


def shoulder(x, k):
    return np.where(x < k, x, k + (1 - k) * (1 - np.exp(-(x - k) / (1 - k))))


def ray_shadow(hmm, inside, az, el, mm_per_px, box, top_mm):
    """Soft self + cast shadow, marched only over the stretch of the ray that crosses box=(x0,x1,y0,y1)."""
    rows, cols = hmm.shape
    tan_el, tan_pen = np.tan(el), np.tan(np.radians(SHADE["penumbraDeg"]))
    t_max = np.maximum((top_mm - hmm) / tan_el, 1e-3)
    yy, xx = np.mgrid[0:rows, 0:cols].astype(np.float32)
    dcol, drow = np.cos(az) / mm_per_px, -np.sin(az) / mm_per_px
    t0 = np.full(xx.shape, -np.inf, np.float32)
    t1 = np.full(xx.shape, np.inf, np.float32)
    for p, d, lo, hi in ((xx, dcol, box[0], box[1]), (yy, drow, box[2], box[3])):
        if abs(d) < 1e-9:
            t0 = np.where((p < lo) | (p > hi), np.inf, t0)
            continue
        a, b = (lo - p) / d, (hi - p) / d
        t0, t1 = np.maximum(t0, np.minimum(a, b)), np.minimum(t1, np.maximum(a, b))
    t_in, t_end = np.maximum(t0, 0), np.minimum(t1, t_max)
    hit = t_in < t_end
    t_in, t_end = np.where(hit, t_in, 0), np.where(hit, t_end, 1e-3)
    inside_f = inside.astype(np.float32)
    s = np.ones_like(hmm)
    for i in range(POSTER_STEPS):
        t = t_in + (t_end - t_in) * ((i + 1) / POSTER_STEPS) ** SHADE["stepPow"]
        mx, my = (xx + dcol * t).astype(np.float32), (yy + drow * t).astype(np.float32)
        hs = cv2.remap(hmm, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        on = cv2.remap(inside_f, mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0) > 0.5
        s = np.where(hit & on, np.minimum(s, (hmm + t * tan_el - hs) / (t * tan_pen)), s)
    s = np.clip(s, 0, 1)
    return s * s * (3 - 2 * s)


def shade(N, hmm, inside, V, mm_per_px, box, top_mm):
    az, el = np.radians(SHADE["azDefault"]), np.radians(SHADE["elDefault"])
    L = np.array([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)], np.float32)
    Hv = (L + [0, 0, 1]) / np.linalg.norm(L + [0, 0, 1])
    ndl = np.maximum(N @ L, 0)
    spec = SHADE["spec"] * np.maximum(N @ Hv, 0) ** SHADE["specPow"]
    s = ray_shadow(hmm, inside, az, el, mm_per_px, box, top_mm)
    sh = 1 - SHADE["shadowStrength"] * (1 - s)
    bounce = SHADE["bounce"] * (1 - N[..., 2])
    exposure = SHADE["flatLevel"] / (SHADE["ambient"] + np.sin(el))
    y = shoulder(exposure * (SHADE["ambient"] + bounce + sh * (ndl + spec)), SHADE["shoulder"])
    alb = np.array(SHADE["albedo"], np.float32) / 255.0
    col = np.clip(alb[None, None] * (1 + SHADE["albedoVar"] * V)[..., None] * y[..., None], 0, 1)
    return (col * 255 + 0.5).astype(np.uint8)


def poster_panel(n, h01, var, a):
    """Panel plus margin_mm of wall each side; long side POSTER_PX."""
    pw_mm, ph_mm = a.panel_mm[0] + 2 * a.margin_mm, a.panel_mm[1] + 2 * a.margin_mm
    px_mm = POSTER_PX / max(pw_mm, ph_mm)
    W, H = round(pw_mm * px_mm), round(ph_mm * px_mm)
    pw, ph, pad = round(a.panel_mm[0] * px_mm), round(a.panel_mm[1] * px_mm), round(a.margin_mm * px_mm)
    N = np.zeros((H, W, 3), np.float32)
    N[..., 2] = 1
    hmm = np.zeros((H, W), np.float32)
    inside = np.zeros((H, W), bool)
    V = np.zeros((H, W), np.float32)
    sl = np.s_[pad:pad + ph, pad:pad + pw]
    nn = resize(n, pw, ph)
    N[sl] = nn / np.linalg.norm(nn, axis=2, keepdims=True)
    hmm[sl] = a.base_mm + resize(h01, pw, ph) * a.relief_mm
    inside[sl] = True
    V[sl] = resize(var, pw, ph)
    out = shade(N, hmm, inside, V, 1.0 / px_mm, (pad - 0.5, pad + pw - 0.5, pad - 0.5, pad + ph - 0.5),
                a.base_mm + a.relief_mm)
    return out, "#{:02X}{:02X}{:02X}".format(*out[2, 2])


def poster_field(n, h01, var, a):
    """fieldTiles of the relief edge to edge; rendered with a half-tile apron so shadows wrap the joints."""
    tx, ty = a.field_tiles
    px_mm = POSTER_PX / max(tx * a.panel_mm[0], ty * a.panel_mm[1])
    tw, th = round(a.panel_mm[0] * px_mm), round(a.panel_mm[1] * px_mm)
    nn, hh, vv = resize(n, tw, th), resize(h01, tw, th), resize(var, tw, th)
    nn /= np.linalg.norm(nn, axis=2, keepdims=True)
    reps = (ty + 2, tx + 2)
    N = np.tile(nn, reps + (1,))
    hmm = a.base_mm + np.tile(hh, reps) * a.relief_mm
    V = np.tile(vv, reps)
    inside = np.ones(hmm.shape, bool)
    rows, cols = hmm.shape
    out = shade(N, hmm, inside, V, 1.0 / px_mm, (-0.5, cols - 0.5, -0.5, rows - 0.5), a.base_mm + a.relief_mm)
    return out[th:th + ty * th, tw:tw + tx * tw], None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("heightmap", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--panel-mm", type=float, nargs="+", required=True, help="W [H] in mm (H defaults to W)")
    ap.add_argument("--relief-mm", type=float, required=True)
    ap.add_argument("--base-mm", type=float, default=10.0, help="panel ground proud of the wall (default 10)")
    ap.add_argument("--margin-mm", type=float, default=120.0, help="wall shown around the panel in the poster")
    ap.add_argument("--layout", choices=["panel", "field"], default="panel")
    ap.add_argument("--field-tiles", type=int, nargs=2, default=[2, 2], help="tiles across, down in the field poster")
    ap.add_argument("--sizes", default="2048,1024", help="texture long sides, largest first")
    ap.add_argument("--normal-q", type=int, default=90, help="WebP quality of the normal maps (101 = lossless)")
    a = ap.parse_args()
    if len(a.panel_mm) == 1:
        a.panel_mm = [a.panel_mm[0], a.panel_mm[0]]
    a.out.mkdir(parents=True, exist_ok=True)
    wrap = a.layout == "field"

    src = read_hm16(a.heightmap)
    sizes = [int(s) for s in a.sizes.split(",")]
    fw, fh = fit(src.shape, sizes[0])
    var_full = albedo_noise((fh, fw))
    files = {}
    for side in sizes:
        w, h = fit(src.shape, side)
        h01 = resize(src, w, h)
        n = bake_normals(h01, a.relief_mm, a.panel_mm[0] / w, wrap)
        hw, hh = max(1, w // 2), max(1, h // 2)
        h8 = np.rint(np.clip(resize(src, hw, hh), 0, 1) * 255).astype(np.uint8)
        alb8 = np.clip(np.rint(128 + 127 * resize(var_full, hw, hh)), 0, 255).astype(np.uint8)
        packed = np.dstack([h8, alb8, np.zeros_like(h8)])
        nopts = {"lossless": True, "quality": 100} if a.normal_q > 100 else {"quality": a.normal_q}
        Image.fromarray(to_rgb8(n), "RGB").save(a.out / f"normal-{side}.webp", method=6, **nopts)
        Image.fromarray(packed, "RGB").save(a.out / f"height-{side // 2}.webp", lossless=True, quality=100, method=6)
        files[str(side)] = {"normal": f"normal-{side}.webp", "height": f"height-{side // 2}.webp"}
        if side == sizes[0]:
            poster_inputs = (n, h01, var_full)

    render = poster_field if wrap else poster_panel
    poster, wall = render(*poster_inputs, a)
    img = Image.fromarray(poster)
    img.save(a.out / "poster-1680.jpg", quality=POSTER_Q, optimize=True, progressive=True)
    img.resize((round(img.width / 2), round(img.height / 2)), Image.LANCZOS).save(
        a.out / "poster-840.jpg", quality=POSTER_Q, optimize=True, progressive=True)
    manifest = {"source": a.heightmap.name, "panelWmm": a.panel_mm[0], "panelHmm": a.panel_mm[1],
                "reliefMm": a.relief_mm, "baseMm": a.base_mm, "marginMm": a.margin_mm, "layout": a.layout,
                "fieldTiles": a.field_tiles if wrap else [1, 1], "wall": wall,
                "poster": [img.width, img.height], "textures": files,
                "posters": ["poster-840.jpg", "poster-1680.jpg"], "heightBits": 8, "shade": SHADE}
    (a.out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    for f in sorted(a.out.iterdir()):
        print(f"{f.name:22s} {f.stat().st_size / 1024:7.0f} KB")
    print(f"layout {a.layout}; poster {img.width}x{img.height}; wall {wall}")


if __name__ == "__main__":
    main()
