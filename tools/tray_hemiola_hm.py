"""Hemiola has no heightmap: it is authored as four STL blocks and a lay. This rasterises a stretch of the lay, seen from the
front, into the 16-bit heightmap tools/tray_bake.py needs. Openings have no surface, so they read as the deepest level.

Usage: python tools/tray_hemiola_hm.py --library "<umbrella>/VAULT/Library/Relief" --layouts "<...>/skew8_layouts.json"
       --lay dial --out "<staging>/2026-11-07_hemiola_dial_hm16_2ppmm.png"
Needs numpy, opencv-python. Not run by the site.
"""
import argparse
import struct
from pathlib import Path

import cv2
import json
import numpy as np

CELLS = 4            # cells across and down: 800 mm holds a 600 mm window and its apron
CELL_MM = 200.0
PX_PER_MM = 2.0
STL_FOR_MOULD = {"A1": "stl_a.stl", "A2": "stl_b.stl", "A3": "stl_c.stl", "A4": "stl_d.stl"}


def read_stl(path):
    """Triangles of a binary STL, shape (n, 3, 3)."""
    raw = Path(path).read_bytes()
    count = struct.unpack("<I", raw[80:84])[0]
    rec = np.dtype([("normal", "<3f4"), ("v", "<9f4"), ("attr", "<u2")])
    return np.frombuffer(raw, dtype=rec, count=count, offset=84)["v"].reshape(-1, 3, 3).astype(np.float64)


def placed(tris, world):
    """Triangles moved by a 4x4 world matrix."""
    w = np.asarray(world, np.float64)
    return tris @ w[:3, :3].T + w[:3, 3]


def rasterise(tris, cols, rows):
    """Z-buffer from +z: the highest surface at each pixel centre. NaN where no surface is hit."""
    out = np.full((rows, cols), np.nan)
    for t in tris:
        x, y, z = t[:, 0] * PX_PER_MM, rows - t[:, 1] * PX_PER_MM, t[:, 2]
        c0, c1 = max(int(np.floor(x.min())), 0), min(int(np.ceil(x.max())), cols - 1)
        r0, r1 = max(int(np.floor(y.min())), 0), min(int(np.ceil(y.max())), rows - 1)
        if c0 > c1 or r0 > r1:
            continue
        area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0])
        if abs(area) < 1e-9:
            continue
        py, px = np.mgrid[r0:r1 + 1, c0:c1 + 1].astype(np.float64)
        px, py = px + 0.5, py + 0.5
        l1 = ((x[1] - px) * (y[2] - py) - (x[2] - px) * (y[1] - py)) / area
        l2 = ((x[2] - px) * (y[0] - py) - (x[0] - px) * (y[2] - py)) / area
        l3 = 1.0 - l1 - l2
        inside = (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
        if not inside.any():
            continue
        depth = l1 * z[0] + l2 * z[1] + l3 * z[2]
        region = out[r0:r1 + 1, c0:c1 + 1]
        take = inside & (np.isnan(region) | (depth > region))
        region[take] = depth[take]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--library", type=Path, required=True)
    ap.add_argument("--layouts", type=Path, required=True)
    ap.add_argument("--lay", default="dial")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    lay = json.loads(a.layouts.read_text(encoding="utf-8"))["lays"][a.lay]
    moulds = {m: read_stl(a.library / "099_skew" / f) for m, f in STL_FOR_MOULD.items()}
    picked = [c for c in lay["cells"] if c["col"] < CELLS and c["row"] < CELLS]
    y0 = min(c["y0"] for c in picked)
    tris = []
    for c in picked:
        p = placed(moulds[c["mould"]], c["W"])
        p[..., 1] -= y0
        tris.append(p)
    tris = np.concatenate(tris)
    side = round(CELLS * CELL_MM * PX_PER_MM)
    z = rasterise(tris, side, side)
    lo, hi = np.nanmin(z), np.nanmax(z)
    h16 = np.rint(np.nan_to_num((z - lo) / (hi - lo), nan=0.0) * 65535).astype(np.uint16)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(".png", h16)
    if not ok:
        raise SystemExit("could not encode the heightmap")
    buf.tofile(str(a.out))
    print(f"{a.lay}: {len(picked)} cells, {len(tris)} triangles, {side}x{side}, relief {hi - lo:.2f} mm, "
          f"no surface on {np.isnan(z).mean() * 100:.1f} % of the pixels -> {a.out.name}")


if __name__ == "__main__":
    main()
