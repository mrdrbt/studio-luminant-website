"""Draw a relief with no hand drawing as a pen drawing of its crests, for the Process page's first layer.

The crest lines are traced from the heightmap itself (ridges of the smoothed surface), so the drawing,
the depth map and the relief are the same surface by construction. A non-square panel gives its centre
square, the window tools/process_bake.py registers the other layers to. Ink and paper are the site's
--ink-2 on --bg.

  python tools/process_drawing.py "<Library>/heightmap.png" "<Library>/source_image.png"
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

PAPER = (213, 232, 239)  # #EFE8D5, BGR
INK = (47, 55, 61)       # #3D372F, BGR
OUT = 2400


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("heightmap", type=Path)
    ap.add_argument("out", type=Path)
    a = ap.parse_args()
    h = cv2.imdecode(np.fromfile(str(a.heightmap), np.uint8), cv2.IMREAD_UNCHANGED)
    if h is None:
        sys.exit("no heightmap")
    h = h.astype(np.float32)
    side = min(h.shape[:2])
    y0, x0 = (h.shape[0] - side) // 2, (h.shape[1] - side) // 2
    h = cv2.resize(h[y0:y0 + side, x0:x0 + side], (OUT, OUT), interpolation=cv2.INTER_AREA)
    h = (h - h.min()) / (h.max() - h.min())
    lap = cv2.Laplacian(cv2.GaussianBlur(h, (0, 0), 6), cv2.CV_32F, ksize=5)
    crest = np.clip(-lap / np.quantile(-lap, 0.995), 0, 1)
    line = np.where(crest > 0.35, crest, 0)[..., None] * 0.85
    img = np.array(PAPER, np.float32) * (1 - line) + np.array(INK, np.float32) * line
    ok, buf = cv2.imencode(a.out.suffix, img.astype(np.uint8))
    if not ok:
        sys.exit("encode failed")
    buf.tofile(str(a.out))
    print(a.out)


if __name__ == "__main__":
    main()
