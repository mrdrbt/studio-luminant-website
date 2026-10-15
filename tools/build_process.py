"""Build the Process page (TR surec.htm, EN en/process.htm) from tools/process.json.

The page opens on a sticky stage: four registered layers of one Library design (concept image, depth map,
raking-light test from tools/process_bake.py, then the live relief from relief-light.js) crossfaded by
process-seq.js as the steps scroll past. The real workshop photos follow, then the night CTA band.
The analytics block comes from kaynaklar.htm (build_systems.tracking_block); each page keeps its own
static footer links. Static output; re-run after editing the JSON.

Usage:  python tools/build_process.py
"""
import html
import json
import re
from pathlib import Path

from build_systems import DOMAIN, SITE, tracking_block

FRAMES = [  # real workshop photographs: file, width, height, object-position
    ("workshop-01-mould-prep.jpg", 1800, 2400, "center 30%"),
    ("workshop-02-casting.jpg", 1152, 928, None),
    ("workshop-03-demoulding.jpg", 1800, 2400, "center 15%"),
    ("workshop-04-negative-positive.jpg", 1800, 2400, None),
    ("workshop-05-finishing.jpg", 1152, 928, None),
]
LAYERS = ("concept", "depth", "light")
STAGE_SIZES = "(orientation: portrait) 46svh, 50vw"
RELIEF_SIZES = "(orientation: portrait) 64svh, 70vw"  # the live layer is 1.4x the stage (panel + wall margin)


def esc(s):
    return html.escape(s, quote=True)


def footer_block(path):
    m = re.search(r'<div id="site-footer">.*?</div>', path.read_text(encoding="utf-8"), re.S)
    return m.group(0) if m else '<div id="site-footer"></div>'


def layer_html(pre, d, i, step):
    name = LAYERS[i]
    base = f"{pre}{d['layers']}{name}"
    eager = ' fetchpriority="high"' if i == 0 else ' loading="lazy"'
    return (f'      <figure class="pseq__layer" data-layer="{i}">'
            f'<img src="{base}-1200.webp" srcset="{base}-600.webp 600w, {base}-1200.webp 1200w" sizes="{STAGE_SIZES}" '
            f'width="1200" height="1200" decoding="async"{eager} alt="{esc(step["alt"])}"></figure>')


def page(d, lang, track, footer):
    c = d[lang]
    pre = "" if lang == "tr" else "../"
    tr_url, en_url = d["tr"]["file"], d["en"]["file"]
    url = c["file"]
    twin = en_url if lang == "tr" else f"../{tr_url}"
    rel = f"{pre}assets/relief/{d['asset']}/"
    man = json.loads((SITE / "assets" / "relief" / d["asset"] / "manifest.json").read_text(encoding="utf-8"))
    pw, ph = man["poster"]
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": c["home"], "item": DOMAIN + ("" if lang == "tr" else "en/")},
        {"@type": "ListItem", "position": 2, "name": c["crumb"], "item": DOMAIN + url}]}
    steps = c["steps"]
    layers = "\n".join(layer_html(pre, d, i, steps[i]) for i in range(3))
    live = steps[3]
    layers += (f'\n      <figure class="pseq__layer pseq__layer--live" data-layer="3">\n'
               f'        <div class="pseq__relief relief-light" data-relief-light="{rel}" data-input="auto" data-scroll-for="#pseq">\n'
               f'          <img class="relief-light__poster" src="{rel}poster-1680.jpg" srcset="{rel}poster-840.jpg {pw // 2}w, '
               f'{rel}poster-1680.jpg {pw}w" sizes="{RELIEF_SIZES}" width="{pw}" height="{ph}" loading="lazy" decoding="async" '
               f'alt="{esc(live["alt"])}">\n        </div>\n      </figure>')
    caps = "\n".join(f'      <span class="pseq__cap" data-layer="{i}">{esc(s["cap"])}</span>' for i, s in enumerate(steps))
    step_html = "\n".join(
        f'    <li class="pseq__step" data-layer="{i}">\n'
        f'      <span class="pseq__num">{i + 1:02d}</span>\n'
        f'      <h2 class="pseq__h">{esc(s["h"])}</h2>\n'
        f'      <p class="pseq__p">{esc(s["p"])}</p>\n'
        f'    </li>' for i, s in enumerate(steps))
    frames = []
    for n, ((f, w, h, pos), fr) in enumerate(zip(FRAMES, c["frames"]), 1):
        style = f' style="object-position:{pos}"' if pos else ""
        frames.append(f'  <div class="filmstrip-frame reveal">\n'
                      f'    <img src="{pre}img/workshop/{f}" width="{w}" height="{h}"{style} alt="{esc(fr["alt"])}" loading="lazy">\n'
                      f'    <div class="filmstrip-caption"><span class="filmstrip-num">{n:02d}</span>'
                      f'<span class="filmstrip-caption-text">{esc(fr["cap"])}</span></div>\n  </div>')
    frames = "\n".join(frames)
    concept = f"{pre}{d['layers']}concept"
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(c['title'])}</title>
<meta name="description" content="{esc(c['desc'])}">
<link rel="canonical" href="{DOMAIN}{url}">
  <link rel="alternate" hreflang="tr" href="{DOMAIN}{tr_url}">
  <link rel="alternate" hreflang="en" href="{DOMAIN}{en_url}">
  <link rel="alternate" hreflang="x-default" href="{DOMAIN}{tr_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Studio Luminant">
<meta property="og:title" content="{esc(c['title'])}">
<meta property="og:description" content="{esc(c['desc'])}">
<meta property="og:url" content="{DOMAIN}{url}">
<meta property="og:image" content="{DOMAIN}{rel.replace('../', '')}poster-1680.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="{concept}-1200.webp" imagesrcset="{concept}-600.webp 600w, {concept}-1200.webp 1200w" imagesizes="{STAGE_SIZES}" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com/">
<link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{pre}shared.css">
<link rel="stylesheet" href="{pre}process.css">
{track}
<script type="application/ld+json">
{json.dumps(crumbs, ensure_ascii=False)}
</script>
</head>
<body>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=1437127258139677&ev=PageView&noscript=1"
/></noscript>

<div id="site-nav" data-lang="{lang}" data-lang-url="{twin}"{' data-base="../"' if lang == 'en' else ''}></div>

<main id="main">
<section class="pseq" id="pseq" data-pseq>
  <div class="pseq__stage">
    <div class="pseq__frame">
{layers}
    </div>
    <div class="pseq__caps" aria-hidden="true">
{caps}
    </div>
  </div>
  <div class="pseq__text">
    <header class="pseq__intro">
      <div class="eyebrow">{esc(c['eyebrow'])}</div>
      <h1 class="pseq__title">{c['h1']}</h1>
      <p class="pseq__lede">{esc(c['lede'])}</p>
    </header>
    <ol class="pseq__steps">
{step_html}
    </ol>
  </div>
</section>

<section id="workshop-filmstrip">
  <div class="filmstrip-intro reveal">
    <p class="filmstrip-eyebrow">{esc(c['shop_eyebrow'])}</p>
    <p class="filmstrip-tagline">{esc(c['shop_tagline'])}</p>
  </div>
{frames}
</section>

<section class="p-door night">
  <div class="p-door__inner">
    <h2 class="p-door__h reveal">{esc(c['door_h'])}</h2>
    <p class="p-door__p reveal">{esc(c['door_p'])}</p>
    <div class="p-door__ctas reveal">
      <a href="{c['contact']}" class="btn-primary">{esc(c['door_cta'])}</a>
      <a href="{c['library']}" class="p-door__link">{esc(c['door_link'])}</a>
    </div>
  </div>
</section>
</main>

{footer}

<script src="{pre}relief-light.js" defer></script>
<script src="{pre}process-seq.js" defer></script>
<script src="{pre}shared.js"></script>
<script src="{pre}components.js"></script>

</body>
</html>
"""


def main():
    d = json.loads((SITE / "tools" / "process.json").read_text(encoding="utf-8"))
    track = tracking_block()
    for lang in ("tr", "en"):
        out = SITE / d[lang]["file"]
        footer = footer_block(out)
        out.write_text(page(d, lang, track, footer), encoding="utf-8", newline="\n")
        print("wrote", out.relative_to(SITE))


if __name__ == "__main__":
    main()
