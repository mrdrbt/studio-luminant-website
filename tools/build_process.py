"""Build the Process page (TR surec.htm, EN en/process.htm) from tools/process.json.

The page opens on a sticky stage: four registered layers of one Library design (concept image, depth map,
raking-light test from tools/process_bake.py, then the live relief from relief-light.js) crossfaded by
process-seq.js as the steps scroll past. The real workshop photos follow, then the night CTA band.
Analytics is loaded by consent.js (no inline tracking markup); each page keeps its own static footer links.
The output matches the committed pages byte for byte (re-synced 2026-11-23); ?v= stamps come from asset_versions. Static output; re-run after editing the JSON.

Usage:  python tools/build_process.py
"""
import html
import json
import re
from pathlib import Path

import asset_versions
from build_designs import DOMAIN, SITE, fonts, nb, txt
from poster_variants import picture as poster_picture

FRAMES = [  # real workshop photographs: file, width, height, object-position
    ("workshop-01-mould-prep.jpg", 1800, 2400, "center 30%"),
    ("workshop-02-casting.jpg", 1152, 928, None),
    ("workshop-03-demoulding-clean.jpg", 1152, 928, None),
    ("workshop-04-negative-positive-clean.jpg", 1152, 928, None),
    ("workshop-05-finishing.jpg", 1152, 928, None),
]
LAYERS = ("concept", "depth", "light")
STAGE_SIZES = "(orientation: portrait) 46svh, 50vw"
RELIEF_SIZES = "(orientation: portrait) 64svh, 70vw"  # the live layer is 1.4x the stage (panel + wall margin)


def esc(s):
    return html.escape(s, quote=True)


def pmag(s):
    """The product name kept out of machine translation, as the committed captions carry it."""
    return s.replace("Lumina PMAG™", '<span translate="no">Lumina PMAG™</span>')


def webpage_ld(c, lang, url, concept_url, alt):
    page_url = DOMAIN + url
    return {"@context": "https://schema.org", "@type": "WebPage", "@id": f"{page_url}#webpage", "url": page_url,
            "name": c["title"].split(" | ")[0], "description": c["desc"], "inLanguage": lang,
            "publisher": {"@id": f"{DOMAIN}#organization"},
            "primaryImageOfPage": {"@type": "ImageObject", "@id": f"{page_url}#primaryimage", "url": concept_url,
                                   "contentUrl": concept_url, "width": 1200, "height": 1200, "caption": alt, "inLanguage": lang},
            "image": {"@id": f"{page_url}#primaryimage"}}


def path_html(c):
    """The Bespoke route under the filmstrip: drawing to installation, seven steps."""
    p = c["path"]
    steps = "\n".join(f'      <li class="p-path__step"><span class="p-path__num">{i:02d}</span><h3 class="p-path__h">{txt(s["h"])}</h3>'
                      f'<p class="p-path__p">{txt(s["p"])}</p></li>' for i, s in enumerate(p["steps"], 1))
    return (f'<section class="p-path" id="yol">\n  <div class="p-path__inner">\n'
            f'    <div class="eyebrow reveal">{txt(p["eyebrow"])}</div>\n'
            f'    <h2 class="p-path__title reveal">{txt(p["title"])}</h2>\n'
            f'    <ol class="p-path__steps reveal">\n{steps}\n    </ol>\n  </div>\n</section>\n\n')


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


def page(d, lang, footer):
    c = d[lang]
    pre = "" if lang == "tr" else "../"
    tr_url, en_url = d["tr"]["file"], d["en"]["file"]
    url = c["file"]
    twin = en_url if lang == "tr" else f"../{tr_url}"
    rel = f"{pre}assets/relief/{d['asset']}/"
    poster = d.get("poster_asset", d["asset"])  # see process.json _note_poster
    prel = f"{pre}assets/relief/{poster}/"
    man = json.loads((SITE / "assets" / "relief" / poster / "manifest.json").read_text(encoding="utf-8"))
    pw, ph = man["poster"]
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": c["home"], "item": DOMAIN + ("" if lang == "tr" else "en/")},
        {"@type": "ListItem", "position": 2, "name": c["crumb"], "item": DOMAIN + url}]}
    steps = c["steps"]
    layers = "\n".join(layer_html(pre, d, i, steps[i]) for i in range(3))
    live = steps[3]
    live_attrs = f'width="{pw}" height="{ph}" loading="lazy" decoding="async" alt="{esc(live["alt"])}"'
    layers += (f'\n      <figure class="pseq__layer pseq__layer--live" data-layer="3">\n'
               f'        <div class="pseq__relief relief-light" data-relief-light="{rel}" data-input="auto" data-scroll-for="#pseq">\n'
               f'          {poster_picture(prel, pw, RELIEF_SIZES, live_attrs)}\n        </div>\n      </figure>')
    caps = "\n".join(f'      <span class="pseq__cap" data-layer="{i}">{esc(s["cap"])}</span>' for i, s in enumerate(steps))
    step_html = "\n".join(
        f'    <li class="pseq__step" data-layer="{i}">\n'
        f'      <span class="pseq__num">{i + 1:02d}</span>\n'
        f'      <h2 class="pseq__h">{txt(s["h"])}</h2>\n'
        f'      <p class="pseq__p">{nb(txt(s["p"]))}'
        + (f'<span class="pseq__hover">{txt(s["hover"])}</span>{txt(s.get("p_end", ""))}' if s.get("hover") else "") + '</p>\n'
        f'    </li>' for i, s in enumerate(steps))
    frames = []
    for n, ((f, w, h, pos), fr) in enumerate(zip(FRAMES, c["frames"]), 1):
        style = f' style="object-position:{pos}"' if pos else ""
        frames.append(f'  <div class="filmstrip-frame reveal">\n'
                      f'    <img src="{pre}img/workshop/{f}" width="{w}" height="{h}"{style} alt="{esc(fr["alt"])}" loading="lazy">\n'
                      f'    <div class="filmstrip-caption"><span class="filmstrip-num">{n:02d}</span>'
                      f'<span class="filmstrip-caption-text">{pmag(txt(fr["cap"]))}</span></div>\n  </div>')
    frames = "\n".join(frames)
    concept = f"{pre}{d['layers']}concept"
    ld = webpage_ld(c, lang, url, f"{DOMAIN}{d['layers']}concept-1200.webp", steps[0]["alt"])
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#EFE8D5">
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
<meta property="og:image" content="{DOMAIN}{prel.replace('../', '')}poster-1680.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="{concept}-1200.webp" imagesrcset="{concept}-600.webp 600w, {concept}-1200.webp 1200w" imagesizes="{STAGE_SIZES}" fetchpriority="high">
{fonts(pre)}<link rel="stylesheet" href="{pre}shared.css">
<link rel="stylesheet" href="{pre}process.css">
<script type="application/ld+json">
{json.dumps(crumbs, ensure_ascii=False)}
</script>
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False)}
</script>
</head>
<body>

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
      <p class="pseq__lede">{txt(c['lede'])}</p>
    </header>
    <ol class="pseq__steps">
{step_html}
    </ol>
  </div>
</section>

<section id="workshop-filmstrip">
  <div class="filmstrip-intro reveal">
    <p class="filmstrip-eyebrow" role="heading" aria-level="2">{txt(c['shop_eyebrow'])}</p>
    <p class="filmstrip-tagline">{txt(c['shop_tagline'])}</p>
  </div>
{frames}
</section>

{path_html(c)}<section class="p-door night">
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

<script src="{pre}consent.js"></script>
</body>
</html>
"""


def main():
    d = json.loads((SITE / "tools" / "process.json").read_text(encoding="utf-8"))
    for lang in ("tr", "en"):
        out = SITE / d[lang]["file"]
        footer = footer_block(out)
        text, _ = asset_versions.restamp(out, page(d, lang, footer), {}, [])  # ?v= cache stamps, as on every page
        out.write_text(text, encoding="utf-8", newline="\n")
        print("wrote", out.relative_to(SITE))


if __name__ == "__main__":
    main()
