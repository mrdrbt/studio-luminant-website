"""Does a moving light tell you something a fixed one does not? Measures it on the tray's own renders.

Renders the same 600 mm window of each design under a grid of lights and reads, for each, the spread of perceptual
lightness across the window (L* standard deviation). That number is how much shading the light draws on the surface;
it is a proxy for how strongly a design reads, not a verdict on the design.

Two pre-stated tests, each of which can come back "no":
  RANK   If moving the light only scales every design together, one fixed image already ranks them. Counts the design
         pairs whose order flips against the reference light. Passes at >= 20 % of pairs flipped for at least one
         named light.
  SWING  If a design reads the same from every direction, its azimuth carries no information. Takes max/min of the
         read across azimuth at one elevation. Passes when at least 2 designs swing >= 1.5x.

Usage: python tools/tray_read.py --library "<umbrella>/VAULT/Library/Relief" --out <dir>
"""
import argparse
import csv
import itertools
from pathlib import Path

import cv2
import numpy as np

import tray_bake as tb

AZS = (0, 30, 60, 90, 120, 150, 180)
ELS = (8, 16, 30, 45, 60)
SWING_EL = 16
READ_PX_PER_MM = 0.7
REFERENCE = ("hero light", 125.0, 16.0)  # the site's default raking light (relief_bake.SHADE)
RANK_PASS, SWING_PASS, SWING_DESIGNS = 0.20, 1.5, 2


def lstar_std(rgb):
    lab = cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)
    return float(lab[..., 0].std())


def picture_change(h16, src, span, win):
    """1 - correlation of L* between the ceiling and window lights: how far the picture itself changes."""
    a, b = [cv2.cvtColor(tb.render_window(h16, src, span, win, tb.LIGHTS[n]["az"], tb.LIGHTS[n]["el"], READ_PX_PER_MM)
                         .astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)[..., 0].ravel() for n in ("ceiling", "window")]
    return 1.0 - float(np.corrcoef(a, b)[0, 1])


def flipped_pairs(a, b):
    """Share of design pairs whose order differs between read dicts a and b, with the pairs that flipped."""
    pairs = list(itertools.combinations(sorted(a), 2))
    flips = [(x, y) for x, y in pairs if (a[x] - a[y]) * (b[x] - b[y]) < 0]
    return len(flips) / len(pairs), flips


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--library", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    sources = tb.design_sources(a.library, tb.READ_SET)

    lights = [(float(az), float(el)) for el in ELS for az in AZS] + [(REFERENCE[1], REFERENCE[2])]
    lights += [(L["az"], L["el"]) for L in tb.LIGHTS.values()]
    lights = sorted(set(lights))
    reads = {}
    for slug, src in sources.items():
        done = a.out / f"{slug}.csv"     # one file per design, so a run that dies keeps what it finished
        if not done.exists():
            span, win = tb.texture_span(src)
            h16 = tb.rb.read_hm16(src["hm"])
            rows = [(az, el, lstar_std(tb.render_window(h16, src, span, win, az, el, READ_PX_PER_MM))) for az, el in lights]
            with open(done, "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerows(rows)
        with open(done, encoding="utf-8") as f:
            reads[slug] = {(float(az), float(el)): float(v) for az, el, v in csv.reader(f)}
        print(slug, "read", flush=True)

    def at(light):
        return {s: reads[s][light] for s in reads}

    ref = at((REFERENCE[1], REFERENCE[2]))
    print(f"\nreference: {REFERENCE[0]} az {REFERENCE[1]} el {REFERENCE[2]}")
    print("design      " + "".join(f"{n:>10s}" for n in tb.LIGHTS) + f"{'ref':>10s}{'swing@' + str(SWING_EL):>10s}")
    swings = {}
    for s in reads:
        az_reads = [reads[s][(float(az), float(SWING_EL))] for az in AZS]
        swings[s] = max(az_reads) / max(min(az_reads), 1e-6)
        named = "".join(f"{reads[s][(L['az'], L['el'])]:10.2f}" for L in tb.LIGHTS.values())
        print(f"{s:12s}{named}{ref[s]:10.2f}{swings[s]:10.2f}")

    print("\nRANK: order against the reference light")
    best = 0.0
    for name, L in tb.LIGHTS.items():
        share, flips = flipped_pairs(ref, at((L["az"], L["el"])))
        best = max(best, share)
        order = " > ".join(sorted(reads, key=lambda s: -reads[s][(L["az"], L["el"])]))
        print(f"  {name:8s} {share * 100:4.0f} % of pairs flipped | {order}")
    print(f"  ref      order | {' > '.join(sorted(reads, key=lambda s: -ref[s]))}")
    swung = [s for s, v in swings.items() if v >= SWING_PASS]
    print("\nPICTURE (reported after the fact, not one of the two tests): 1 - corr(ceiling, window)")
    for slug, src in sources.items():
        span, win = tb.texture_span(src)
        print(f"  {slug:12s}{picture_change(tb.rb.read_hm16(src['hm']), src, span, win):6.2f}", flush=True)
    print(f"\nRANK  {'PASS' if best >= RANK_PASS else 'FAIL'}: best {best * 100:.0f} % (needs {RANK_PASS * 100:.0f} %)")
    print(f"SWING {'PASS' if len(swung) >= SWING_DESIGNS else 'FAIL'}: {len(swung)} designs at >= {SWING_PASS}x: {swung}")


if __name__ == "__main__":
    main()
