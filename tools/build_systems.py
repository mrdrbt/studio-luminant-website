"""Build the Library System profile pages (TR sistem-<slug>.htm, EN en/system-<slug>.htm) from tools/systems.json.

Each page: a live relief hero (relief-light.js over the baked poster in assets/relief/<asset>/), a spec block, the
Library render and wall strip as WebP (made here from VAULT/Library/Relief/<library>/), the drawing (depth map), a reading of the surface and a cross-link to the Bespoke (Özel Üretim) page.
No price, stock, lead-time or castability claim on any page (DEC-04 default).
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
    "tr": {"back": "← Sistemler", "index": "sistemler.htm", "eyebrow": "Atölye Tasarımları",
           "cta": "Sistemleri inceleyin", "cta_href": "sistemler.htm", "bespoke": "Özel Üretim", "bespoke_href": "surec.htm",
           "contact": "iletisim.htm",
           "spec": {"size": "Ölçü", "depth": "Rölyef", "layout": "Kurgu", "material": "Malzeme", "finish": "Yüzey"},
           "material": "Lumina PMAG™",
           "finish": "Artizan finish",
           "obj_cap": "Render: tek panel, yalama ışık", "strip_cap": "Render: duvar şeridi",
           "door": "Bu sistemin duvarınızda nasıl yerleşeceğini görmek için duvar ölçülerinizi iletin.",
           "layout_link": "Yerleşim isteği için yazın", "own": "Kendi çiziminizle başlıyorsanız:", "home": "Ana Sayfa",
           "lib": "Sistemler", "idx_file": "sistemler.htm", "page": "sistem-{slug}.htm",
           "idx_title": "Adlandırılmış rölyef sistemleri",
           "idx_lede": "Ölçüsü, derinliği ve dizilişi tanımlanmış rölyef sistemleri. Her birini sayfasında canlı ışıkta inceleyin.",
           "studies": "Tasarım etütleri"},
    "en": {"back": "← Systems", "index": "systems.htm", "eyebrow": "Studio Designs",
           "cta": "See the systems", "cta_href": "systems.htm", "bespoke": "Bespoke", "bespoke_href": "process.htm",
           "contact": "contact.htm",
           "spec": {"size": "Size", "depth": "Relief", "layout": "Layout", "material": "Material", "finish": "Surface"},
           "material": "Lumina PMAG™",
           "finish": "Artisan finishes",
           "obj_cap": "Render: single panel, raking light", "strip_cap": "Render: wall strip",
           "door": "To see how this system would sit on your wall, send the wall dimensions.",
           "layout_link": "Request a wall layout", "own": "Starting from your own drawing:", "home": "Home",
           "lib": "Systems", "idx_file": "en/systems.htm", "page": "system-{slug}.htm",
           "idx_title": "Named relief systems",
           "idx_lede": "Relief systems with a defined size, depth and layout. See each one in live light on its own page.",
           "studies": "Design studies"},
}
SIZES = {"panel": "(orientation: portrait) 90vw, 55vw", "field": "(orientation: portrait) 100vw, 100vw"}


def esc(s):
    return html.escape(s, quote=True)


def txt(s):
    """Escaped text for a text node: typographic apostrophe, as the committed pages carry."""
    return esc(s).replace("&#x27;", "\u2019")


def nb(s):
    """Non-breaking spaces inside a measure ("600 x 600 mm")."""
    return re.sub(r"(?<=\d) (?=mm)", "&nbsp;", s).replace(" \u00d7 ", "&nbsp;\u00d7&nbsp;")


def carry_over(new, old):
    """Keep what later passes put on the committed page and this builder does not make: theme-colour, the
    static footer link block and the consent.js include. Cache stamps are re-applied by tools/asset_versions.py."""
    if not old:
        return new
    theme = re.search(r'<meta name="theme-color"[^>]*>\n', old)
    if theme and "theme-color" not in new:
        new = new.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">\n',
                          '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' + theme.group(0), 1)
    foot = re.search(r'<div id="site-footer">\n.*?</nav>\n</div>', old, flags=re.S)
    if foot:
        new = new.replace('<div id="site-footer"></div>', foot.group(0), 1)
    cons = re.search(r'<script src="[./]*consent\.js[^"]*"></script>\n', old)
    if cons and "consent.js" not in new:
        new = new.replace("</body>", cons.group(0) + "\n</body>", 1)
    return new


def tracking_block():
    # GA4 + Meta Pixel are loaded by consent.js now (consent commit); pages carry no inline tracking markup.
    return ""


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
    tr_url, en_url = f"sistem-{sysd['slug']}.htm", f"en/system-{sysd['slug']}.htm"
    url = tr_url if lang == "tr" else en_url
    twin = f"{pre}{en_url}" if lang == "tr" else f"../{tr_url}"
    man = json.loads((SITE / "assets" / "relief" / sysd["asset"] / "manifest.json").read_text(encoding="utf-8"))
    pw, ph = man["poster"]
    title = c["title"]
    meta = c.get("meta", c["lede"])
    field = sysd["layout"] == "field"
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": u["home"], "item": DOMAIN + ("" if lang == "tr" else "en/")},
        {"@type": "ListItem", "position": 2, "name": u["lib"], "item": DOMAIN + ("" if lang == "tr" else "en/") + u["index"]},
        {"@type": "ListItem", "position": 3, "name": c["name"], "item": DOMAIN + url}]}
    spec_rows = [("size", c["size"]), ("depth", c["depth"]), ("layout", c["layout"]),
                 ("material", u["material"]), ("finish", u["finish"])]
    spec = "\n".join(
        f'      <div><dt>{u["spec"][k]}</dt><dd>' + (f'<span translate="no">{esc(v)}</span>' if k == "material" else nb(txt(v))) + '</dd></div>'
        for k, v in spec_rows)
    fig_html = []
    for key, cap, alt in (("object", u["obj_cap"], c["object_alt"]), ("strip", u["strip_cap"], c["strip_alt"])):
        if key in figs and alt:
            w, h = figs[key]
            fig_html.append(f'      <figure><img src="{rel}{key}.webp" width="{w}" height="{h}" loading="lazy" '
                            f'alt="{esc(alt)}"><figcaption>{cap}</figcaption></figure>')
    draw_w, draw_h = Image.open(SITE / "assets" / "relief" / sysd["asset"] / "height-1024.webp").size
    fig_html.append(f'      <figure><img src="{rel}height-1024.webp" width="{draw_w}" height="{draw_h}" loading="lazy" '
                    f'alt="{esc(c["drawing_alt"])}"><figcaption>{c["drawing_cap"]}. {txt(c["drawing_note"])}</figcaption></figure>')
    figures = "\n".join(fig_html)
    sections = "\n".join(
        f'    <div class="sys-read__block"><h2>{txt(sec["h"])}</h2>\n' + "\n".join(f'      <p>{txt(p)}</p>' for p in sec["p"]) + '\n    </div>'
        for sec in c["sections"])
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(meta)}">
<link rel="canonical" href="{DOMAIN}{url}">
  <link rel="alternate" hreflang="tr" href="{DOMAIN}{tr_url}">
  <link rel="alternate" hreflang="en" href="{DOMAIN}{en_url}">
  <link rel="alternate" hreflang="x-default" href="{DOMAIN}{tr_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Studio Luminant">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(meta)}">
<meta property="og:url" content="{DOMAIN}{url}">
<meta property="og:image" content="{DOMAIN}assets/relief/{sysd['asset']}/poster-1680.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="{rel}poster-1680.jpg" imagesrcset="{rel}poster-840.jpg {pw // 2}w, {rel}poster-1680.jpg {pw}w" imagesizes="{SIZES[sysd['layout']]}" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com/">
<link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{pre}shared.css">
<link rel="stylesheet" href="{pre}library.css">
<script type="application/ld+json">
{json.dumps(crumbs, ensure_ascii=False)}
</script>
</head>
<body>
<div id="site-nav" data-lang="{lang}" data-lang-url="{twin}"{' data-base="../"' if lang == 'en' else ''}></div>

<main id="main">
<section class="sys-hero{' sys-hero--field' if field else ''} relief-light" data-relief-light="{rel}" data-input="auto">
  <div class="sys-hero__copy">
    <a class="sys-back" href="{u['index']}"><span aria-hidden="true">←</span> {u['back'].replace('← ', '')}</a>
    <div class="eyebrow">{u['eyebrow']}</div>
    <h1 class="sys-name">{esc(c['name'])}</h1>
    <p class="sys-lede">{nb(txt(c['lede']))}</p>
    <div class="sys-ctas">
      <a href="{u['cta_href']}" class="btn-primary">{u['cta']}</a>
      <a href="{u['contact']}" class="sys-link">{u['layout_link']}</a>
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

<section class="sys-read reveal">
  <div class="sys-read__inner">
{sections}
  </div>
</section>

<section class="sys-door night" id="sys-door">
  <div class="sys-door__inner">
    <p>{u['door']}</p>
    <div class="sys-door__links">
      <a href="{u['contact']}" class="sys-link">{u['layout_link']}</a>
      <span class="sys-door__own">{u['own']} <a href="{u['bespoke_href']}" class="sys-link">{u['bespoke']}</a></span>
    </div>
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
        cards.append(f'''    <a class="sys-card" href="{u['page'].format(slug=s['slug'])}">
      <img src="{pre}assets/relief/{s['asset']}/object.webp" width="{w}" height="{h}" loading="lazy" alt="{esc(c['object_alt'])}">
      <span class="sys-card__name">{esc(c['name'])}</span>
      <span class="sys-card__layout">{nb(txt(c['layout']))}</span>
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
        for lang, path in (("tr", SITE / f"sistem-{s['slug']}.htm"), ("en", SITE / "en" / f"system-{s['slug']}.htm")):
            old = path.read_text(encoding="utf-8") if path.exists() else ""
            path.write_text(carry_over(page(s, lang, track, figs), old), encoding="utf-8")
            print("wrote", path.relative_to(SITE))
    for lang in ("tr", "en"):
        patch_index(data, lang)


if __name__ == "__main__":
    main()
