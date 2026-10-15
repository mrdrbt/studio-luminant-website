"""Build the Library System profile pages (TR sistem-<code>.htm, EN en/system-<code>.htm) from tools/systems.json.

Each page: a live relief hero (relief-light.js over the baked poster in assets/relief/<asset>/), a spec block, the
Library render and wall strip as WebP (made here from VAULT/Library/Relief/<library>/), and the bespoke door.
The analytics block is copied from kaynaklar.htm so it never drifts. Static output; re-run after editing the JSON.

Usage:  python tools/build_systems.py [--library <VAULT/Library/Relief>]
"""
import argparse
import html
import json
import re
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parents[1]
DOMAIN = "https://studioluminant.com.tr/"
UI = {
    "tr": {"back": "← Kütüphane", "index": "koleksiyon.htm", "eyebrow": "Sistem {code}",
           "sample": "Numune kutusu isteyin", "adapt": "Projenize uyarlayalım", "contact": "iletisim.htm",
           "spec": {"size": "Ölçü", "depth": "Rölyef", "layout": "Kurgu", "material": "Malzeme", "finish": "Yüzey"},
           "material": "Projeye göre Lumina PMAG™ ya da Lumina PUCOMP™",
           "finish": "Artizan finish: Canvas, Veil, Grit, Tide",
           "obj_cap": "Render: tek panel, yalama ışık", "strip_cap": "Render: duvar şeridi",
           "door": "Bu sistemi projenize uyarlayabiliriz: ölçüyü, derinliği ve desen yoğunluğunu çiziminize göre yeniden kurarız.",
           "door_cta": "Çiziminizi gönderin", "title": "{name}: Kütüphane | Studio Luminant", "home": "Ana Sayfa",
           "lib": "Kütüphane", "idx_file": "koleksiyon.htm", "page": "sistem-{code}.htm",
           "idx_title": "Kütüphane sistemleri",
           "idx_lede": "Ölçüsü, derinliği ve dizilişi tanımlanmış rölyef sistemleri. Her birini sayfasında canlı ışıkta inceleyin.",
           "studies": "Tasarım etütleri"},
    "en": {"back": "← Library", "index": "collection.htm", "eyebrow": "System {code}",
           "sample": "Request the Sample Box", "adapt": "Adapt it to your project", "contact": "contact.htm",
           "spec": {"size": "Size", "depth": "Relief", "layout": "Layout", "material": "Material", "finish": "Surface"},
           "material": "Lumina PMAG™ or Lumina PUCOMP™, chosen for the project",
           "finish": "Artisan finishes: Canvas, Veil, Grit, Tide",
           "obj_cap": "Render: single panel, raking light", "strip_cap": "Render: wall strip",
           "door": "We can adapt this system to your project, rebuilding its size, depth and pattern density from your drawing.",
           "door_cta": "Send Your Drawing", "title": "{name}: Library | Studio Luminant", "home": "Home",
           "lib": "Library", "idx_file": "en/collection.htm", "page": "system-{code}.htm",
           "idx_title": "Library systems",
           "idx_lede": "Relief systems with a defined size, depth and layout. See each one in live light on its own page.",
           "studies": "Design studies"},
}
SIZES = {"panel": "(orientation: portrait) 90vw, 55vw", "field": "(orientation: portrait) 100vw, 100vw"}


def esc(s):
    return html.escape(s, quote=True)


def tracking_block():
    t = (SITE / "kaynaklar.htm").read_text(encoding="utf-8")
    a, b = t.index("<!-- Google Analytics -->"), t.index("<!-- End Meta Pixel -->")
    return t[a:b + len("<!-- End Meta Pixel -->")]


def webp(src, dst, width):
    if dst.exists():
        return Image.open(dst).size
    im = Image.open(src).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, quality=82, method=6)
    return im.size


def page(sysd, lang, track, figs):
    c, u = sysd[lang], UI[lang]
    pre = "" if lang == "tr" else "../"
    rel = f"{pre}assets/relief/{sysd['asset']}/"
    tr_url, en_url = f"sistem-{sysd['code']}.htm", f"en/system-{sysd['code']}.htm"
    url = tr_url if lang == "tr" else en_url
    twin = f"{pre}{en_url}" if lang == "tr" else f"../{tr_url}"
    man = json.loads((SITE / "assets" / "relief" / sysd["asset"] / "manifest.json").read_text(encoding="utf-8"))
    pw, ph = man["poster"]
    title = u["title"].format(name=c["name"])
    field = sysd["layout"] == "field"
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": u["home"], "item": DOMAIN + ("" if lang == "tr" else "en/")},
        {"@type": "ListItem", "position": 2, "name": u["lib"], "item": DOMAIN + ("" if lang == "tr" else "en/") + u["index"]},
        {"@type": "ListItem", "position": 3, "name": c["name"], "item": DOMAIN + url}]}
    spec_rows = [("size", c["size"]), ("depth", c["depth"]), ("layout", c["layout"]),
                 ("material", u["material"]), ("finish", u["finish"])]
    spec = "\n".join(f'      <div><dt>{u["spec"][k]}</dt><dd>{esc(v)}</dd></div>' for k, v in spec_rows)
    fig_html = []
    for key, cap, alt in (("object", u["obj_cap"], c["object_alt"]), ("strip", u["strip_cap"], c["strip_alt"])):
        if key in figs and alt:
            w, h = figs[key]
            fig_html.append(f'      <figure><img src="{rel}{key}.webp" width="{w}" height="{h}" loading="lazy" '
                            f'alt="{esc(alt)}"><figcaption>{cap}</figcaption></figure>')
    figures = "\n".join(fig_html)
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(c['lede'])}">
<link rel="canonical" href="{DOMAIN}{url}">
  <link rel="alternate" hreflang="tr" href="{DOMAIN}{tr_url}">
  <link rel="alternate" hreflang="en" href="{DOMAIN}{en_url}">
  <link rel="alternate" hreflang="x-default" href="{DOMAIN}{tr_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Studio Luminant">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(c['lede'])}">
<meta property="og:url" content="{DOMAIN}{url}">
<meta property="og:image" content="{DOMAIN}assets/relief/{sysd['asset']}/poster-1680.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="{rel}poster-1680.jpg" imagesrcset="{rel}poster-840.jpg {pw // 2}w, {rel}poster-1680.jpg {pw}w" imagesizes="{SIZES[sysd['layout']]}" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com/">
<link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{pre}shared.css">
<link rel="stylesheet" href="{pre}library.css">
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
<section class="sys-hero{' sys-hero--field' if field else ''} relief-light" data-relief-light="{rel}" data-input="auto">
  <div class="sys-hero__copy">
    <a class="sys-back" href="{u['index']}">{u['back']}</a>
    <div class="eyebrow">{u['eyebrow'].format(code=sysd['code'])}</div>
    <h1 class="sys-name">{esc(c['name'])}</h1>
    <p class="sys-lede">{esc(c['lede'])}</p>
    <div class="sys-ctas">
      <a href="{u['contact']}" class="btn-primary">{u['sample']}</a>
      <a href="#sys-door" class="sys-link">{u['adapt']}</a>
    </div>
  </div>
  <div class="sys-hero__stage">
    <img class="relief-light__poster" src="{rel}poster-1680.jpg" srcset="{rel}poster-840.jpg {pw // 2}w, {rel}poster-1680.jpg {pw}w"
         sizes="{SIZES[sysd['layout']]}" width="{pw}" height="{ph}" fetchpriority="high" alt="{esc(c['alt'])}">
  </div>
</section>

<section class="sys-body">
  <dl class="sys-spec reveal">
{spec}
  </dl>
  <div class="sys-figures reveal">
{figures}
  </div>
</section>

<section class="sys-door night" id="sys-door">
  <div class="sys-door__inner">
    <p>{u['door']}</p>
    <a href="{u['contact']}" class="btn-primary">{u['door_cta']}</a>
  </div>
</section>
</main>

<div id="site-footer"></div>

<script src="{pre}relief-light.js" defer></script>
<script src="{pre}shared.js"></script>
<script src="{pre}components.js"></script>

</body>
</html>
"""


START, END = "<!-- SYSTEMS:START (tools/build_systems.py) -->", "<!-- SYSTEMS:END -->"


def systems_block(data, lang):
    """The Library index's systems strip: one card per System profile, linking to its page."""
    u = UI[lang]
    cards = []
    for s in data["systems"]:
        c = s[lang]
        w, h = Image.open(SITE / "assets" / "relief" / s["asset"] / "object.webp").size
        pre = "" if lang == "tr" else "../"
        cards.append(f'''    <a class="sys-card" href="{u['page'].format(code=s['code'])}">
      <img src="{pre}assets/relief/{s['asset']}/object.webp" width="{w}" height="{h}" loading="lazy" alt="{esc(c['object_alt'])}">
      <span class="sys-card__code">{u['eyebrow'].format(code=s['code'])}</span>
      <span class="sys-card__name">{esc(c['name'])}</span>
      <span class="sys-card__layout">{esc(c['layout'])}</span>
    </a>''')
    cards_html = "\n".join(cards)
    return (f'''{START}
<section class="sys-index reveal">
  <div class="eyebrow">{u['lib']}</div>
  <h2 class="sys-index__title">{u['idx_title']}</h2>
  <p class="sys-index__lede">{u['idx_lede']}</p>
  <div class="sys-index__grid">
{cards_html}
  </div>
  <div class="eyebrow sys-index__studies">{u['studies']}</div>
</section>
{END}''')


def patch_index(data, lang):
    """Insert/refresh the systems strip after the collection hero; link library.css once."""
    f = SITE / UI[lang]["idx_file"]
    t = f.read_text(encoding="utf-8")
    block = systems_block(data, lang)
    if START in t:
        a, b = t.index(START), t.index(END) + len(END)
        t = t[:a] + block + t[b:]
    else:
        anchor = t.index("</section>", t.index('<section id="collection-hero">')) + len("</section>")
        t = t[:anchor] + "\n\n" + block + t[anchor:]
    css = '<link rel="stylesheet" href="' + ("" if lang == "tr" else "../") + 'library.css">'
    if css not in t:
        shared = '<link rel="stylesheet" href="' + ("" if lang == "tr" else "../") + 'shared.css">'
        t = t.replace(shared, shared + "\n" + css, 1)
    f.write_text(t, encoding="utf-8")
    print("patched", UI[lang]["idx_file"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--library", type=Path, default=SITE.parents[2] / "Library" / "Relief")
    a = ap.parse_args()
    data = json.loads((SITE / "tools" / "systems.json").read_text(encoding="utf-8"))
    track = tracking_block()
    for s in data["systems"]:
        out = SITE / "assets" / "relief" / s["asset"]
        lib = a.library / s["library"]
        figs = {"object": webp(lib / "render.png", out / "object.webp", 1200)}
        if (lib / "wall_strip.png").exists() and s["tr"]["strip_alt"]:
            figs["strip"] = webp(lib / "wall_strip.png", out / "strip.webp", 1600)
        for lang, path in (("tr", SITE / f"sistem-{s['code']}.htm"), ("en", SITE / "en" / f"system-{s['code']}.htm")):
            path.write_text(page(s, lang, track, figs), encoding="utf-8")
            print("wrote", path.relative_to(SITE))
    for lang in ("tr", "en"):
        patch_index(data, lang)


if __name__ == "__main__":
    main()
