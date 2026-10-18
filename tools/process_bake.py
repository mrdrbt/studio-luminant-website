"""Bake the Process page's drawing-to-cast sequence layers from one Library relief folder.

Writes concept / depth / light layers, each registered to the heightmap's panel square, so the
scroll crossfade reads as one surface changing rather than a slideshow. The fourth layer is the
live relief (assets/relief/<asset>/, from relief_bake.py), inset in CSS so its panel fills the
same square.

  python tools/process_bake.py "<VAULT/Library/Relief/012_iznik-cypress>" assets/process/cantus --light-frame 0

Concept: the source image is warped onto the heightmap with an ECC affine fit on gradient maps.
Light: the graze sheet holds three raking-light frames; --light-frame picks the one lit from the poster's side.
"""
import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

SIZES = (1200, 600)
WEBP_Q = 82
WORK = 512  # registration resolution


def imread(path, flags=cv2.IMREAD_COLOR):
    """cv2.imread cannot open non-ASCII Windows paths ("06 — Website"); decode from bytes instead."""
    return cv2.imdecode(np.fromfile(str(path), np.uint8), flags)


def imwrite(path, img, params):
    ok, buf = cv2.imencode(Path(path).suffix, img, params)
    if not ok:
        sys.exit(f"encode failed: {path}")
    buf.tofile(str(path))


def grad(img):
    """Blurred gradient magnitude, normalised: a lighting-independent picture of the motif."""
    g = cv2.GaussianBlur(img.astype(np.float32), (0, 0), 2.0)
    m = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
    m = cv2.GaussianBlur(m, (0, 0), 3.0)
    return m / (m.max() + 1e-6)


def to_gray(img):
    return img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def register(moving, target, init_scale):
    """Affine warp (2x3) taking `moving` (WORK px) onto `target` (WORK px); returns (warp, ecc score)."""
    c = WORK / 2
    warp = np.array([[init_scale, 0, c - init_scale * c], [0, init_scale, c - init_scale * c]], np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 400, 1e-6)
    score, warp = cv2.findTransformECC(grad(target), grad(moving), warp, cv2.MOTION_AFFINE, crit, None, 5)
    return warp, score


def write_layer(img, out, name):
    for s in SIZES:
        r = cv2.resize(img, (s, s), interpolation=cv2.INTER_AREA)
        imwrite(out / f"{name}-{s}.webp", r, [cv2.IMWRITE_WEBP_QUALITY, WEBP_Q])


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("library", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--light-frame", type=int, default=0, choices=(0, 1, 2),
                    help="which of the graze sheet's three frames; pick the one lit from the poster's side")
    ap.add_argument("--concept", type=Path, default=None,
                    help="drawing/concept image for the first layer (default: <library>/source_image.png)")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)

    h = imread(a.library / "heightmap.png", cv2.IMREAD_UNCHANGED)
    if h is None:
        sys.exit("no heightmap.png")
    h = h.astype(np.float32)
    depth = ((h - h.min()) / (h.max() - h.min()) * 255).astype(np.uint8)
    depth_w = cv2.resize(depth, (WORK, WORK), interpolation=cv2.INTER_AREA)

    # light: three frames side by side; centre-crop each to a square
    sheet = imread(a.library / "graze.png", cv2.IMREAD_GRAYSCALE)
    fw = sheet.shape[1] // 3
    side = min(fw, sheet.shape[0])
    frames = []
    for i in range(3):
        x0 = i * fw + (fw - side) // 2
        y0 = (sheet.shape[0] - side) // 2
        frames.append(sheet[y0:y0 + side, x0:x0 + side])

    report = {"frames_ecc_to_depth": []}
    for f in frames:
        fwk = cv2.resize(f, (WORK, WORK), interpolation=cv2.INTER_AREA)
        report["frames_ecc_to_depth"].append(round(register(fwk, depth_w, 1.0)[1], 3))
    light = frames[a.light_frame]
    report["light_frame"] = a.light_frame

    # concept: affine onto the heightmap square, edge pixels replicated
    concept = imread(a.concept or a.library / "source_image.png")
    cw = cv2.resize(to_gray(concept), (WORK, WORK), interpolation=cv2.INTER_AREA)
    best_warp, best_score = None, -1
    for s in (0.85, 0.92, 1.0, 1.1):
        try:
            w, sc = register(cw, depth_w, s)
        except cv2.error:
            continue
        if sc > best_score:
            best_warp, best_score = w, sc
    if best_warp is None:
        sys.exit("concept registration failed")
    report["concept_ecc"] = round(best_score, 3)
    report["concept_warp"] = best_warp.round(4).tolist()
    S = SIZES[0]
    full = best_warp.copy()
    full[:, 2] *= S / WORK
    concept_big = cv2.resize(concept, (S, S), interpolation=cv2.INTER_CUBIC)
    concept_reg = cv2.warpAffine(concept_big, full, (S, S), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP,
                                 borderMode=cv2.BORDER_REPLICATE)

    write_layer(concept_reg, a.out, "concept")
    write_layer(depth, a.out, "depth")
    write_layer(light, a.out, "light")
    (a.out / "bake.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
