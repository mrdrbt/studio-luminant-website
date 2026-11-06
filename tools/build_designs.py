"""Build the Studio Designs pages from tools/designs.json: the index (TR tasarimlar.htm, EN en/designs.htm) and one
page per design (TR tasarim-<slug>.htm, EN en/design-<slug>.htm).

One range, no tiers (Burak 2026-10-25): every design is listed as an equal, alphabetically.
- kind "relief": live relief hero (relief-light.js over the baked poster in assets/relief/<asset>/), then the wall large
  (the lead room, the wall strip), the Library render beside the spec (both WebP, made here from
  VAULT/Library/Relief/<library>/), a reading with the drawing (depth map) small beside it.
- kind "study": the wall study as the hero, a close view, the lay drawing (moulds and how they are laid), made as WebP
  in assets/designs/<slug>/ from the portfolio prestage PNGs named in the JSON. Size and depth where the JSON gives them; no price or availability.
- an optional "room" entry is the lead room: one wide in-situ figure right under the hero ({file, tr, en}; swap the render
  by changing "file"); "rooms" are the further rooms lower on the page (only renders Burak voted UP).
- a design with "use" + "faq" (per language) closes with a "where it works" paragraph and three questions: its two
  (size/format, depth) and the template's lead time + fixing, which states the spec table's facts. They render as a closed
  accordion (native details/summary; the text stays in the DOM, so page and JSON-LD match). The page carries them
  as FAQPage JSON-LD beside a VisualArtwork entry (never an offer or a price). That text may carry in-text links written
  [[key|anchor]] (LINKS).
- every design carries its Library code (`library`: the VAULT/Library/Relief/<code>_<design> folder); the build WARNS on a
  listed design with none, or with no manifest there (Portfolio Line Phase 0: the site reads the Library, never bypasses it).
No price, stock or castability claim on any page (DEC-04 default); the only lead time is the spec table's (Burak 2026-11-01).
Static output; re-run after editing the JSON.

Which designs are listed is decided on the Verdict board's Portfolio tab (push_selection below; designs taken off the site go to
"parked" with their content, their pages are removed and redirected). This script also keeps sitemap.xml, llms.txt,
site-haritasi.htm, en/site-map.htm and the netlify.toml parked-design redirects in sync with designs.json (idempotent).

Usage:  python tools/build_designs.py [--library <VAULT/Library/Relief>]
"""
import argparse
import html
import json
import re
from datetime import date
from pathlib import Path

from PIL import Image

import asset_versions

SITE = Path(__file__).resolve().parents[1]
# the SL COWORK umbrella; study sources are given relative to it. Found by its VAULT folder, not a fixed depth: this repo and
# the site-v3 worktree sit at different depths under it
ROOT = next((p for p in SITE.parents if (p / "VAULT").is_dir()), SITE.parents[2])
LIBRARY = ROOT / "VAULT" / "Library" / "Relief"   # the tile registry (tile_lookup.py); every design names its folder
DOMAIN = "https://studioluminant.com.tr/"
UI = {
    "tr": {"lib": "Atölye Tasarımları", "index": "tasarimlar.htm", "page": "tasarim-{slug}.htm", "home": "Ana Sayfa",
           "cta": "Duvar yerleşimi isteyin", "contact": "iletisim.htm", "bespoke": "Özel Üretim", "bespoke_href": "surec.htm",
           "spec": {"minimum": "Minimum sipariş", "size": "Ölçü", "depth": "Rölyef", "layout": "Kurgu", "material": "Malzeme", "finish": "Yüzey",
                    "fixing": "Montaj", "lead": "Teslim", "joint": "Derz"},
           "material": "Lumina PMAG™ (polimer modifiye kompozit alçı)", "finish": "Boyaya hazır ya da artizan finish ile", "joint": "1,5 mm",
           "finish_term": "artizan finish", "finish_href": "kaynaklar-yuzey-kaplamalari.htm",
           "fixing": "Polimer yapıştırıcıyla", "fixing_ledger": "Polimer yapıştırıcı ve alt taşıyıcıyla", "fixing_project": "Her proje için montaj çiziminde belirlenir",
    "fix_clause": "ve duvara polimer yapıştırıcıyla, metal dikme ve alçıpan duvarlarda ise ray sistemiyle sabitlenir.", "fix_project": "ve sabitlenmesi her proje için montaj çiziminde belirlenir.",
    "min_val": "{min} m²", "min_faq": " Minimum sipariş {min} m²'dir. Kalıp siparişinizle hazırlanır; dökümden önce ana modeli siz onaylarsınız; ikisi de 4 haftaya dahildir.", "ledger_faq": " En alt sıra sabit bir alt taşıyıcıya oturur, üst sıralar birbirinin üzerinde durur; montajdan önce duvar yüzeyi kontrol edilir.",
           "lead": "Sözleşme ve peşinattan sonra 4 hafta (50 m²'ye kadar), Sapanca'da fabrika teslimi (EXW)",
           "corners": "Kolon yüzleri ve dış köşeler yerleşim çiziminde çözülür. Bir kolonu saran, köşeyi dönen ya da kavisli bir duvarı izleyen parçalar, aynı motifle Özel Üretim olarak dökülür.",
           "use_h": "Nerede kullanılır", "use_id": "nerede-kullanilir", "faq_h": "Sık sorulan sorular", "faq_id": "sorular",
           "use_finish": "Parçalar boyaya hazır ya da artizan finish ile teslim edilir; boyaya hazır yüzey, yerinde mekânın rengine boyanabilir.",
           "faq_lead_q": "{name} ne kadar sürede teslim edilir, duvara nasıl sabitlenir?",
           "faq_lead_a": "Teslim süresi, 50 m²'ye kadar olan siparişlerde sözleşme ve peşinattan sonra 4 haftadır; daha büyük siparişlerde tarih teklifte belirtilir. Teslim şekli Sapanca'da fabrika teslimidir (EXW). Parçalar Lumina PMAG™ — Polimer Modifiye Kompozit Alçı ile elde dökülür ve duvara polimer yapıştırıcıyla, metal dikme ve alçıpan duvarlarda ise ray sistemiyle sabitlenir. Bir kolonu saran, köşeyi dönen ya da kavisli bir duvarı izleyen parçalar ise aynı motifle Özel Üretim olarak dökülür; böyle bir duvar Özel Üretim takvimini izler.",
           "obj_cap": "Tek panel, yalama ışık", "strip_cap": "Duvar şeridi",
           "close_h": "Yakından", "drawing_h": "Çizim", "room_h": "Bir mekânda", "more": "İncele →", "moulds_h": "Kalıplar",
           "moulds_p": "Duvar, bu kalıplardan dökülen parçalarla kurulur; harfler çizimdeki dizilişle eşleşir, düz parça rölyefsizdir.",
           "mould_alt": "{name}, kalıp {letter}", "plain": "Düz", "plain_alt": "{name}, düz parça",
           "close_p": "Aynı duvar, yakından: rölyefin derinliği.",
           "drawing_p": "Tasarımın kalıpları ve duvardaki dizilişi. Kalıp siparişinizle hazırlanır; dökümden önce ana modeli siz onaylarsınız.",
           "door": "Bu tasarımın duvarınızda nasıl yerleşeceğini görmek için duvar ölçülerinizi iletin.",
           "own": "Kendi çiziminizle başlıyorsanız:", "prev": "Önceki tasarım", "next": "Sonraki tasarım",
           "idx_title": "Atölye Tasarımları: Rölyef Duvar Panelleri | Studio Luminant",
           "idx_meta": "Studio Luminant'ın çizdiği rölyef duvar tasarımları. Her tasarımı kendi sayfasında duvarda ve çizimiyle inceleyin; Lumina PMAG™ ile Sapanca'da dökülür.",
           "idx_h1": "Bizim çizdiğimiz <em>rölyefler.</em>",
           "idx_lede": "Her tasarımı kendi sayfasında duvarda ve çizimiyle inceleyin. Kalıp siparişinizle hazırlanır; dökümden önce ana modeli siz onaylarsınız.",
           "idx_door": "Duvar sizin çiziminizle başlıyorsa bu Özel Üretim’dir: nasıl çizdiyseniz, öyle dökeriz.",
           "idx_door_link": "Çiziminizi gönderin", "idx_samples": "Duvar yerleşimi isteyin", "idx_rooms": "Kafe, restoran ya da otel duvarı için tasarımları mekânda <a href=\"galeri.htm\" class=\"sys-link\">Galeri</a>’de görebilirsiniz.",
           "share": "Paylaş", "share_page": "tasarim-{slug}-paylas.htm", "share_h": "Bu tasarımı paylaşın",
           "share_p": "Bağlantı, bu tasarımın sade bir sunum sayfasını açar. İsterseniz proje adını ve hazırlayanı ekleyin.",
           "share_proj": "Proje adı (isteğe bağlı)", "share_by": "Hazırlayan (isteğe bağlı)", "share_copy": "Bağlantıyı kopyala",
           "share_copied": "Bağlantı kopyalandı", "share_pdf": "PDF olarak kaydet", "share_close": "Kapat",
           "shr_proj": "Proje", "shr_by": "Hazırlayan", "shr_credit": "Tasarım ve döküm: Studio Luminant, Sapanca"},
    "en": {"lib": "Studio Designs", "index": "designs.htm", "page": "design-{slug}.htm", "home": "Home",
           "cta": "Request a wall layout", "contact": "contact.htm", "bespoke": "Bespoke", "bespoke_href": "process.htm",
           "spec": {"minimum": "Minimum order", "size": "Size", "depth": "Relief", "layout": "Layout", "material": "Material", "finish": "Surface",
                    "fixing": "Fixing", "lead": "Lead time", "joint": "Joint"},
           "material": "Lumina PMAG™ (polymer-modified composite gypsum)", "finish": "Paint-ready, or with an artisan finish", "joint": "1.5 mm",
           "finish_term": "artisan finish", "finish_href": "resources-finishes.htm",
           "fixing": "Polymer adhesive", "fixing_ledger": "Polymer adhesive + bottom ledger", "fixing_project": "Set in the installation drawing for each project",
    "fix_clause": "and fixed to the wall with a polymer adhesive, or with a rail system on metal stud and plasterboard walls.", "fix_project": "and their fixing is set in the installation drawing for each project.",
    "min_val": "{min} m²", "min_faq": " The minimum order is {min} m². The mould is made for your order and you approve the master before casting; both are included in the 4 weeks.", "ledger_faq": " The bottom course sits on a fixed ledger and each course stands on the one below; the wall surface is checked before fixing.",
           "lead": "4 weeks after contract and advance (up to 50 m²), ex-works Sapanca (EXW)",
           "corners": "Column faces and outside corners are worked out on the layout drawing. Pieces that wrap a column, turn a corner or follow a curved wall are cast as Bespoke, in the same motif, and such a wall follows the Bespoke programme.",
           "use_h": "Where it works", "use_id": "where-it-works", "faq_h": "Frequently asked questions", "faq_id": "questions",
           "use_finish": "Pieces come paint-ready or with an artisan finish; a paint-ready surface can be painted on site to match the room.",
           "faq_lead_q": "What is the lead time for {name}, and how is it fixed?",
           "faq_lead_a": "Lead time is 4 weeks after contract and advance for orders up to 50 m²; for larger orders the quote sets the date. Delivery is ex-works Sapanca (EXW). Pieces are hand-cast in Lumina PMAG™ — Polymer Modified Composite Gypsum and fixed to the wall with a polymer adhesive, or with a rail system on metal stud and plasterboard walls. Pieces that wrap a column, turn a corner or follow a curved wall are cast as Bespoke, in the same motif.",
           "obj_cap": "Single panel, raking light", "strip_cap": "Wall strip",
           "close_h": "Close up", "drawing_h": "The drawing", "room_h": "In a room", "more": "View →", "moulds_h": "The moulds",
           "moulds_p": "The wall is laid from pieces cast in these moulds; the letters match the lay in the drawing, and the plain piece carries no relief.",
           "mould_alt": "{name}, mould {letter}", "plain": "Plain", "plain_alt": "{name}, plain piece",
           "close_p": "The same wall, close up: the depth of the relief.",
           "drawing_p": "The design’s moulds and how they are laid on the wall. The mould is made for your order, and you approve the master before anything is cast.",
           "door": "To see how this design would sit on your wall, send the wall dimensions.",
           "own": "Starting from your own drawing:", "prev": "Previous design", "next": "Next design",
           "idx_title": "Studio Designs: Relief Wall Panels | Studio Luminant",
           "idx_meta": "Relief wall designs drawn by Studio Luminant. See each one on its own page, on the wall and in its drawing; cast in Lumina PMAG™ in Sapanca, Turkey.",
           "idx_h1": "Relief we have <em>drawn.</em>",
           "idx_lede": "See each design on its own page: on the wall and in its drawing. The mould is made for your order, and you approve the master before anything is cast.",
           "idx_door": "If the wall starts from your drawing, that is Bespoke: we cast it the way you drew it.",
           "idx_door_link": "Send your drawing", "idx_samples": "Request a wall layout", "idx_rooms": "For a café, restaurant or hotel wall, see the designs in rooms in the <a href=\"gallery.htm\" class=\"sys-link\">Gallery</a>.",
           "share": "Share", "share_page": "design-{slug}-share.htm", "share_h": "Share this design",
           "share_p": "The link opens a plain presentation page for this design. Add a project name and who prepared it, if you wish.",
           "share_proj": "Project name (optional)", "share_by": "Prepared by (optional)", "share_copy": "Copy link",
           "share_copied": "Link copied", "share_pdf": "Save as PDF", "share_close": "Close",
           "shr_proj": "Project", "shr_by": "Prepared by", "shr_credit": "Design and casting: Studio Luminant, Sapanca, Turkey"},
}
# an in-text link inside a design's "use" or FAQ text is written [[key|anchor words]] (SEO B3); the key names the page.
# The page shows it as a link, the JSON-LD as its plain words; an unknown key fails the build
LINKS = {"tr": {"home": "/", "lobby": "otel-lobisi-karsilama-duvari.htm", "guestroom": "otel-odasi-duvar-tasarimi.htm",
                "villa": "villa-duvar-tasarimi.htm", "restaurant": "restoran-duvar-tasarimi.htm"},
         "en": {"home": "/en/", "lobby": "hotel-lobby-feature-wall.htm"}}
LINK = re.compile(r"\[\[(\w+)\|([^\]|]+)\]\]")
SIZES = {"panel": "(orientation: portrait) 90vw, 55vw", "field": "(orientation: portrait) 100vw, 100vw"}
STUDY_WIDTH = {"wall": 1800, "card": 1400}
STUDY_FILE = {"wall": "wall.webp", "card": "detail.webp"}
# the lay drawing, one per language: drawing[lang] = {"d": 1600-wide desktop, "m": 900-wide portrait for phones}
DRAWING_WIDTH = {"d": 1600, "m": 900}
PHONE = "(max-width: 640px)"
# one square tile per mould (moulds[]: {letter, source, src} or {plain, src}), lettered as the drawing; a design with one
# mould shows none
MOULD_WIDTH = 900
# Share (Paylaş): a design page's panel links to a plain share view of the design (no nav, CTA or price; noindex) that prints to
# PDF. Piloted on Hemiola, then rolled out to every study design (Burak 2026-10-27) and the relief designs (2026-10-29);
# name slugs here to limit it again.
SHARE_PILOT = set()
OG_SIZE = (1200, 630)
# self-hosted fonts (fonts/, @font-face in shared.css): preload the two latin faces, never the Google Fonts stylesheet
FONT_FILES = ("cormorant-garamond-normal-latin.woff2", "jost-normal-latin.woff2")


def fonts(pre):
    return "".join(f'<link rel="preload" href="{pre}fonts/{f}" as="font" type="font/woff2" crossorigin>\n' for f in FONT_FILES)


def esc(s):
    return html.escape(s, quote=True)


def txt(s):
    """Escaped text for a text node: typographic apostrophe, as the committed pages carry."""
    return esc(s).replace("&#x27;", "’")


def nb(s):
    """Non-breaking spaces inside a measure ("600 x 600 mm")."""
    return re.sub(r"(?<=\d) (?=mm)", "&nbsp;", s).replace(" × ", "&nbsp;×&nbsp;")


def linked(s, lang):
    """txt() with each [[key|anchor]] made a link to LINKS[lang][key]."""
    return LINK.sub(lambda m: f'<a href="{LINKS[lang][m.group(1)]}">{m.group(2)}</a>', txt(s))


def plain(s):
    """The text with each [[key|anchor]] reduced to its anchor words (for JSON-LD)."""
    return LINK.sub(r"\2", s)


def first_sentence(s):
    return re.split(r"(?<=\.)\s", s, maxsplit=1)[0]


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
        # a footer carried from a retired Systems page still names its index
        block = re.sub(r"(?<![\w-])sistemler\.htm", "tasarimlar.htm", foot.group(0))
        new = new.replace('<div id="site-footer"></div>', re.sub(r"(?<![\w/-])systems\.htm", "designs.htm", block), 1)
    cons = re.search(r'<script src="[./]*consent\.js[^"]*"></script>\n', old)
    if cons and "consent.js" not in new:
        new = new.replace("</body>", re.sub(r"\?v=[0-9a-f]+", "", cons.group(0)) + "\n</body>", 1)
    return new


def tracking_block():
    # GA4 + Meta Pixel are loaded by consent.js now (consent commit); pages carry no inline tracking markup.
    return ""


def webp(src, dst, width, rebuild=False):
    if dst.exists() and not (rebuild and src.exists()):
        return Image.open(dst).size
    im = Image.open(src).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, quality=82, method=6)
    return im.size


def drawing_webp(folder):
    """The depth map as a reader sees it: height-1024.webp packs height in red and relief-light.js data in green,
    so the visible drawing is the red channel alone, in grey (black = ground, white = highest point)."""
    dst = folder / "drawing.webp"
    if not dst.exists():
        Image.open(folder / "height-1024.webp").convert("RGB").getchannel("R").save(dst, quality=88, method=6)
    return Image.open(dst).size


# Minimum order (#127) and fixing (#130) per design. Prices never live here: the website repo is public.
MIN_75 = {"andante", "mezzavoce", "glissando", "accelerando", "fugato"}
LEDGER = {"antiphon", "melisma", "hocket", "accelerando", "gruppetto", "fugato"}
FIXING_PER_PROJECT = {"hemiola"}  # an open screen block (#136)


def min_m2(d, u):
    decimal = "," if u["fixing"].startswith("Polimer") else "."
    return f"7{decimal}5" if d["slug"] in MIN_75 else "5"


def min_of(d, u):
    return u["min_val"].format(min=min_m2(d, u))


def fixing_of(d, u):
    if d["slug"] in FIXING_PER_PROJECT:
        return u["fixing_project"]
    return u["fixing_ledger"] if d["slug"] in LEDGER else u["fixing"]


def lead_answer(d, u):
    extra = u["ledger_faq"] if d["slug"] in LEDGER else ""
    base = u["faq_lead_a"]
    if d["slug"] in FIXING_PER_PROJECT:
        assert u["fix_clause"] in base
        base = base.replace(u["fix_clause"], u["fix_project"])
    return base + u["min_faq"].format(min=min_m2(d, u)) + extra


def study_spec(d, c, u):
    """Material, surface, fixing and lead time; the joint row only for a design that declares one ("joint": true, Hemiola's gapped blocks) --
    walls render seamless by default (Burak 2026-10-30)."""
    rows = [(k, c[k]) for k in ("size", "depth") if c.get(k)]
    rows += [("material", u["material"]), ("finish", u["finish"]), ("fixing", fixing_of(d, u)), ("lead", u["lead"]), ("minimum", min_of(d, u))]
    return rows + [("joint", u["joint"])] if d.get("joint") else rows


def urls(slug):
    return f"tasarim-{slug}.htm", f"en/design-{slug}.htm"


def shared(d):
    return not SHARE_PILOT or d["slug"] in SHARE_PILOT


def og_jpg(folder, src="wall.webp"):
    """The link preview (1200 x 630 JPG) from the wall study (a relief: its poster), centre-cropped, never stretched."""
    dst = folder / "og.jpg"
    if not dst.exists():
        im = Image.open(folder / src).convert("RGB")
        w, h = OG_SIZE
        scale = max(w / im.width, h / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        left, top = (im.width - w) // 2, (im.height - h) // 2
        im.crop((left, top, left + w, top + h)).save(dst, quality=85, optimize=True, progressive=True)
    return dst


def head(lang, title, meta, url, tr_url, en_url, og_image, extra, crumbs, ld=()):
    pre = "" if lang == "tr" else "../"
    more = "".join(f'<script type="application/ld+json">\n{json.dumps(o, ensure_ascii=False)}\n</script>\n' for o in ld)
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#EFE8D5">
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
<meta property="og:image" content="{DOMAIN}{og_image}">
<meta name="twitter:card" content="summary_large_image">
{extra}{fonts(pre)}<link rel="stylesheet" href="{pre}shared.css">
<link rel="stylesheet" href="{pre}library.css">
<script type="application/ld+json">
{json.dumps(crumbs, ensure_ascii=False)}
</script>
{more}</head>
<body>
"""


def crumbs_for(lang, name, url):
    u = UI[lang]
    base = DOMAIN + ("" if lang == "tr" else "en/")
    items = [{"@type": "ListItem", "position": 1, "name": u["home"], "item": base},
             {"@type": "ListItem", "position": 2, "name": u["lib"], "item": base + u["index"]}]
    if name:
        items.append({"@type": "ListItem", "position": 3, "name": name, "item": DOMAIN + url})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}


def spec_dd(k, v, u):
    """A spec value as HTML: the material stays untranslated, the finish links its term to the finishes page."""
    if k == "material":
        return f'<span translate="no">{esc(v)}</span>'
    html_v = nb(txt(v))
    if k == "finish" and u["finish_term"] in html_v:
        return html_v.replace(u["finish_term"], f'<a href="{u["finish_href"]}">{u["finish_term"]}</a>', 1)
    return html_v


def spec_html(rows, u):
    return "\n".join(f'      <div><dt>{u["spec"][k]}</dt><dd>{spec_dd(k, v, u)}</dd></div>' for k, v in rows)


ROOM_WIDTHS = (400, 800, 1200)  # the gallery's WebP set beside an image: <stem>-400w.webp ... and <stem>.webp at full width
ROOM_SIZES = {"wide": "(max-width: 820px) 100vw, 92vw", "tall": "(max-width: 820px) 100vw, 50vw"}


def room_picture(file, alt, pre, sizes):
    """A room render as responsive markup. A gallery image (images/<stem>.jpg) reuses the gallery's own WebP set; a WebP
    under assets/designs/ gets one 800-wide sibling made here (never upscaled)."""
    p = SITE / file
    w, h = Image.open(p).size
    small = p.with_name(f"{p.stem}-800w.webp")
    if p.suffix == ".webp" and w > 800 and not small.exists():
        Image.open(p).convert("RGB").resize((800, round(h * 800 / w)), Image.LANCZOS).save(small, quality=82, method=6)
    rel = lambda q: pre + q.relative_to(SITE).as_posix()
    srcs = [f"{rel(q)} {n}w" for n in ROOM_WIDTHS for q in [p.with_name(f"{p.stem}-{n}w.webp")] if n < w and q.exists()]
    if p.with_suffix(".webp").exists():
        srcs.append(f"{rel(p.with_suffix('.webp'))} {w}w")
    img = f'<img src="{pre}{file}" width="{w}" height="{h}" loading="lazy" decoding="async" alt="{esc(alt)}"'
    if len(srcs) < 2:
        return img + ">"
    srcset = f'srcset="{", ".join(srcs)}" sizes="{sizes}"'
    if p.suffix == ".webp":
        return f"{img} {srcset}>"
    return f'<picture><source type="image/webp" {srcset}>{img}></picture>'


def room_tall(d):
    """True when the lead room render is portrait: it then stands beside the views instead of running wide above them."""
    room = d.get("room")
    if not room:
        return False
    w, h = Image.open(SITE / room["file"]).size
    return h > w


def wall_html(d, lang, pre, views=()):
    """Right under the hero: the wall, large. The lead room (d["room"], optional), then the view figures (a relief's wall
    strip; with a portrait room, strip and single panel stacked beside it). Nothing when there is neither."""
    room, u = d.get("room"), UI[lang]
    tall = room_tall(d)
    figs = []
    if room:
        r = room[lang]
        figs.append(f'  <figure class="dsg-wall__room reveal">{room_picture(room["file"], r["alt"], pre, ROOM_SIZES["tall" if tall else "wide"])}'
                    f'<figcaption>{txt(r["cap"])}</figcaption></figure>')
    if views and tall:
        figs.append('  <div class="dsg-wall__views">\n' + "\n".join("  " + v for v in views) + "\n  </div>")
    else:
        figs += list(views)
    if not figs:
        return ""
    label = f' aria-label="{u["room_h"]}"' if room else ""
    return f"""
<section class="dsg-wall{' dsg-wall--tall' if tall else ''}"{label}>
{chr(10).join(figs)}
</section>
"""


def room_html(d, lang, pre):
    """The design in further rooms: rooms[] = {file, source, tr: {alt, cap}, en: {alt, cap}}, the images Burak up-voted."""
    rooms = d.get("rooms") or []
    if not rooms:
        return ""
    u, figs = UI[lang], []
    for room in rooms:
        r = room[lang]
        w, h = Image.open(SITE / room["file"]).size
        figs.append(f'    <figure><img src="{pre}{room["file"]}" width="{w}" height="{h}" loading="lazy" alt="{esc(r["alt"])}">'
                    f'<figcaption>{txt(r["cap"])}</figcaption></figure>')
    return f"""
<section class="dsg-room{' dsg-room--one' if len(figs) == 1 else ''} reveal">
  <h2 class="dsg-h">{u['room_h']}</h2>
  <div class="dsg-room__grid" data-n="{len(figs)}">
{chr(10).join(figs)}
  </div>
</section>
"""


def questions(d, lang):
    """The design's three questions as (q, a): its own two from designs.json, then lead time + fixing from the template."""
    c, u = d[lang], UI[lang]
    return [(f["q"], f["a"]) for f in c["faq"]] + [(u["faq_lead_q"].format(name=c["name"]), lead_answer(d, u))]


def use_faq_html(d, lang):
    """Where it works (the design's paragraph + the surface line, its finish term linked) and the three questions."""
    c, u = d[lang], UI[lang]
    if not c.get("use"):
        return ""
    items = "\n".join(f'    <details class="dsg-faq__item"><summary><h3>{nb(txt(q))}</h3></summary><p>{nb(linked(a, lang))}</p></details>'
                      for q, a in questions(d, lang))
    return f"""
<section class="dsg-use reveal" id="{u['use_id']}">
  <h2 class="dsg-h">{u['use_h']}</h2>
  <p>{nb(linked(c['use'], lang))} {spec_dd('finish', u['use_finish'], u)}</p>
</section>

<section class="dsg-faq reveal" id="{u['faq_id']}">
  <h2 class="dsg-h">{u['faq_h']}</h2>
  <div class="dsg-faq__list">
{items}
  </div>
</section>
"""


def page_ld(d, lang, url, og):
    """JSON-LD beside the breadcrumb: the design as a VisualArtwork and, with its questions, an FAQPage. No offer, no price."""
    c, u = d[lang], UI[lang]
    art = {"@context": "https://schema.org", "@type": "VisualArtwork", "name": c["name"], "description": c["meta"],
           "image": DOMAIN + og, "url": DOMAIN + url, "inLanguage": lang, "material": u["material"],
           "creator": {"@type": "Organization", "name": "Studio Luminant", "url": DOMAIN}}
    if not c.get("use"):
        return [art]
    typo = lambda s: plain(s).replace("'", "’")  # the visible text's words and apostrophe (txt), no link
    faq = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang, "mainEntity": [
        {"@type": "Question", "name": typo(q), "acceptedAnswer": {"@type": "Answer", "text": typo(a)}} for q, a in questions(d, lang)]}
    return [art, faq]


def pager_html(data, d, lang):
    u = UI[lang]
    ds = data["designs"]
    i = ds.index(d)
    prev, nxt = ds[i - 1], ds[(i + 1) % len(ds)]
    return f"""
<div class="dsg-pager" role="navigation" aria-label="{u['lib']}">
  <a class="dsg-pager__prev" href="{u['page'].format(slug=prev['slug'])}"><span>{u['prev']}</span>{esc(prev[lang]['name'])}</a>
  <a class="dsg-pager__index" href="{u['index']}">{u['lib']}</a>
  <a class="dsg-pager__next" href="{u['page'].format(slug=nxt['slug'])}"><span>{u['next']}</span>{esc(nxt[lang]['name'])}</a>
</div>
"""


def contact_href(lang, d):
    """The contact page link of a design page, carrying the design so the enquiry names it (?design=<slug>)."""
    return f"{UI[lang]['contact']}?design={d['slug']}"


def door_html(lang, d):
    u = UI[lang]
    return f"""
<section class="sys-door" id="sys-door">
  <div class="sys-door__inner">
    <p>{u['door']}</p>
    <p>{u['corners']}</p>
    <div class="sys-door__links">
      <a href="{contact_href(lang, d)}" class="sys-link">{u['cta']}</a>
      <span class="sys-door__own">{u['own']} <a href="{u['bespoke_href']}" class="sys-link">{u['bespoke']}</a></span>
    </div>
  </div>
</section>"""


def tail(lang, scripts=""):
    pre = "" if lang == "tr" else "../"
    return f"""</main>

<div id="site-footer"></div>

{scripts}<script src="{pre}shared.js"></script>
<script src="{pre}components.js"></script>
<script src="{pre}consent.js"></script>

</body>
</html>
"""


def nav(lang, twin):
    base = ' data-base="../"' if lang == "en" else ""
    return f'<div id="site-nav" data-lang="{lang}" data-lang-url="{twin}"{base}></div>\n\n<main id="main">\n'


# phones keep the baked poster: dropping the attribute before relief-light.js mounts leaves the static image (no canvas moire)
PHONE_POSTER = ('<script>if (window.matchMedia("(max-width: 820px), (orientation: portrait)").matches) '
                'document.querySelectorAll("[data-relief-light]").forEach(function (e) { e.removeAttribute("data-relief-light"); });</script>' + chr(10))


def relief_page(data, d, lang, figs):
    c, u = d[lang], UI[lang]
    pre = "" if lang == "tr" else "../"
    rel = f"{pre}assets/relief/{d['asset']}/"
    tr_url, en_url = urls(d["slug"])
    url = tr_url if lang == "tr" else en_url
    twin = f"{pre}{en_url}" if lang == "tr" else f"../{tr_url}"
    man = json.loads((SITE / "assets" / "relief" / d["asset"] / "manifest.json").read_text(encoding="utf-8"))
    pw, ph = man["poster"]
    field = d["layout"] == "field"
    extra = (f'<link rel="preload" as="image" href="{rel}poster-1680.jpg" imagesrcset="{rel}poster-840.jpg {pw // 2}w, '
             f'{rel}poster-1680.jpg {pw}w" imagesizes="{SIZES[d["layout"]]}" fetchpriority="high">\n')
    spec = spec_html([("size", c["size"]), ("depth", c["depth"]), ("layout", c["layout"]),
                      ("material", u["material"]), ("finish", u["finish"]), ("fixing", fixing_of(d, u)), ("lead", u["lead"]), ("minimum", min_of(d, u))], u)
    fig = {}
    for key, cap, alt in (("object", c.get("object_cap", u["obj_cap"]), c["object_alt"]), ("strip", u["strip_cap"], c["strip_alt"])):
        if key in figs and alt:
            w, h = figs[key]
            fig[key] = (f'<figure class="dsg-view dsg-view--{key} reveal"><img src="{rel}{key}.webp" width="{w}" height="{h}" loading="lazy" '
                        f'decoding="async" alt="{esc(alt)}"><figcaption>{cap}</figcaption></figure>')
    draw_w, draw_h = drawing_webp(SITE / "assets" / "relief" / d["asset"])
    drawing = (f'    <figure class="sys-read__drawing"><img src="{rel}drawing.webp" width="{draw_w}" height="{draw_h}" loading="lazy" '
               f'decoding="async" alt="{esc(c["drawing_alt"])}"><figcaption>{c["drawing_cap"]}. {txt(c["drawing_note"])}</figcaption></figure>')
    # a portrait room takes strip and single panel beside it; otherwise the strip runs wide and the panel sits by the spec
    tall = room_tall(d)
    views = [f"  {fig[k]}" for k in (("strip", "object") if tall else ("strip",)) if k in fig]
    beside = "" if tall or "object" not in fig else f"  {fig['object']}\n"
    sections = "\n".join(
        f'    <div class="sys-read__block"><h2>{txt(sec["h"])}</h2>\n' + "\n".join(f'      <p>{txt(p)}</p>' for p in sec["p"]) + '\n    </div>'
        for sec in c["sections"])
    share = shared(d)
    og = f"assets/relief/{d['asset']}/{'og.jpg' if share else 'poster-1680.jpg'}"
    share_btn = (f'\n      <button type="button" class="sys-link" data-shr-href="{u["share_page"].format(slug=d["slug"])}">'
                 f'{u["share"]}</button>') if share else ""
    scripts = ((PHONE_POSTER if d.get("poster_on_phone") else "") + f'<script src="{pre}relief-light.js" defer></script>\n'
               + (f'<script src="{pre}share.js"></script>\n' if share else ""))
    return (head(lang, c["title"], c.get("meta", c["lede"]), url, tr_url, en_url, og, extra, crumbs_for(lang, c["name"], url),
                 page_ld(d, lang, url, og))
            + nav(lang, twin) + f"""<section class="sys-hero{' sys-hero--field' if field else ''} relief-light" data-relief-light="{rel}" data-input="auto">
  <div class="sys-hero__copy">
    <a class="sys-back" href="{u['index']}"><span aria-hidden="true">←</span> {u['lib']}</a>
    <h1 class="sys-name">{esc(c['name'])}</h1>
    <p class="sys-lede">{nb(txt(c['lede']))}</p>
    <div class="sys-ctas">
      <a href="{contact_href(lang, d)}" class="btn-primary">{u['cta']}</a>{share_btn}
    </div>
  </div>
  <div class="sys-hero__stage">
    <img class="relief-light__poster" src="{rel}poster-1680.jpg" srcset="{rel}poster-840.jpg {pw // 2}w, {rel}poster-1680.jpg {pw}w"
         sizes="{SIZES[d['layout']]}" width="{pw}" height="{ph}" fetchpriority="high" alt="{esc(c['alt'])}">
  </div>
</section>
{wall_html(d, lang, pre, views)}
<section class="sys-body{'' if beside else ' sys-body--plain'}">
{beside}  <dl class="sys-spec reveal">
{spec}
  </dl>
</section>

<section class="sys-read reveal">
  <div class="sys-read__inner">
{sections}
{drawing}
  </div>
</section>
{room_html(d, lang, pre)}{use_faq_html(d, lang)}{pager_html(data, d, lang)}{door_html(lang, d)}
{share_dialog_html(lang) if share else ""}""" + tail(lang, scripts))


def mould_file(m):
    return "mould-plain.webp" if m.get("plain") else f"mould-{m['letter'].lower()}.webp"


def drawing_file(lang, v):
    return f"drawing-{lang}{'-m' if v == 'm' else ''}.webp"


def moulds_html(d, lang, base):
    """Each mould on its own, lettered as in the lay drawing; only when the design has more than one."""
    ms = d.get("moulds") or []
    if len(ms) < 2:
        return ""
    u, name = UI[lang], d[lang]["name"]
    figs = []
    for m in ms:
        w, h = Image.open(SITE / "assets" / "designs" / d["asset"] / mould_file(m)).size
        alt = u["plain_alt"].format(name=name) if m.get("plain") else u["mould_alt"].format(name=name, letter=m["letter"])
        cap = u["plain"] if m.get("plain") else m["letter"]
        figs.append(f'      <figure><img src="{base}{mould_file(m)}" width="{w}" height="{h}" loading="lazy" '
                    f'alt="{esc(alt)}"><figcaption>{esc(cap)}</figcaption></figure>')
    return f"""
<section class="dsg-moulds reveal">
  <div class="dsg-moulds__head">
    <h2 class="dsg-h">{u['moulds_h']}</h2>
    <p>{u['moulds_p']}</p>
  </div>
  <div class="dsg-moulds__grid">
{chr(10).join(figs)}
  </div>
</section>
"""


def study_page(data, d, lang, sizes):
    c, u = d[lang], UI[lang]
    pre = "" if lang == "tr" else "../"
    base = f"{pre}assets/designs/{d['asset']}/"
    tr_url, en_url = urls(d["slug"])
    url = tr_url if lang == "tr" else en_url
    twin = f"{pre}{en_url}" if lang == "tr" else f"../{tr_url}"
    (ww, wh), (cw, ch) = sizes["wall"], sizes["card"]
    (sw, sh), (mw, mh) = sizes["drawing"][lang]["d"], sizes["drawing"][lang]["m"]
    extra = f'<link rel="preload" as="image" href="{base}wall.webp" fetchpriority="high">\n'
    spec = spec_html(study_spec(d, c, u), u)
    share = shared(d)
    og = f"assets/designs/{d['asset']}/{'og.jpg' if share else 'wall.webp'}"
    share_btn = (f'\n      <button type="button" class="sys-link" data-shr-href="{u["share_page"].format(slug=d["slug"])}">'
                 f'{u["share"]}</button>') if share else ""
    return (head(lang, c["title"], c["meta"], url, tr_url, en_url, og, extra, crumbs_for(lang, c["name"], url),
                 page_ld(d, lang, url, og))
            + nav(lang, twin) + f"""<section class="dsg-hero">
  <div class="dsg-hero__copy">
    <a class="sys-back" href="{u['index']}"><span aria-hidden="true">←</span> {u['lib']}</a>
    <h1 class="sys-name">{esc(c['name'])}</h1>
    <p class="sys-lede">{txt(c['story'])}</p>
    <div class="sys-ctas">
      <a href="{contact_href(lang, d)}" class="btn-primary">{u['cta']}</a>{share_btn}
    </div>
  </div>
  <figure class="dsg-hero__img">
    <img src="{base}wall.webp" width="{ww}" height="{wh}" fetchpriority="high" alt="{esc(c['wall_alt'])}">
    <figcaption>{txt(c['wall_cap'])}</figcaption>
  </figure>
</section>
{wall_html(d, lang, pre)}
<section class="dsg-close">
  <figure class="dsg-close__img reveal">
    <img src="{base}detail.webp" width="{cw}" height="{ch}" loading="lazy" alt="{esc(c['card_alt'])}">
    <figcaption>{txt(c['card_cap'])}</figcaption>
  </figure>
  <div class="dsg-close__copy reveal">
    <h2 class="dsg-h">{u['close_h']}</h2>
    <p>{u['close_p']}</p>
    <dl class="sys-spec">
{spec}
    </dl>
  </div>
</section>
{moulds_html(d, lang, base)}
<section class="dsg-drawing reveal">
  <div class="dsg-drawing__inner">
    <div class="dsg-drawing__copy">
      <h2 class="dsg-h">{u['drawing_h']}</h2>
      <p>{u['drawing_p']}</p>
    </div>
    <figure>
      <picture>
        <source media="{PHONE}" srcset="{base}{drawing_file(lang, 'm')}" width="{mw}" height="{mh}">
        <img src="{base}{drawing_file(lang, 'd')}" width="{sw}" height="{sh}" loading="lazy" alt="{esc(c['sketch_alt'])}">
      </picture>
      <figcaption>{txt(c['sketch_cap'])}</figcaption>
    </figure>
  </div>
</section>
{room_html(d, lang, pre)}{use_faq_html(d, lang)}{pager_html(data, d, lang)}{door_html(lang, d)}
{share_dialog_html(lang) if share else ""}""" + tail(lang, f'<script src="{pre}share.js"></script>\n' if share else ""))


def share_dialog_html(lang):
    """The Paylaş panel: optional project name and preparer, then share (where the phone offers it), copy the link or save a PDF."""
    u = UI[lang]
    return f"""
<dialog class="shr-dialog" id="shr-dialog" aria-labelledby="shr-dialog-h">
  <form method="dialog" class="shr-dialog__form">
    <h2 class="shr-dialog__h" id="shr-dialog-h">{u['share_h']}</h2>
    <p>{u['share_p']}</p>
    <label>{u['share_proj']}<input name="p" maxlength="80" autocomplete="off"></label>
    <label>{u['share_by']}<input name="by" maxlength="80" autocomplete="organization"></label>
    <div class="shr-dialog__actions">
      <button type="button" class="btn-primary" data-shr-send hidden>{u['share']}</button>
      <button type="button" class="sys-link" data-shr-copy>{u['share_copy']}</button>
      <button type="button" class="sys-link" data-shr-pdf>{u['share_pdf']}</button>
    </div>
    <p class="shr-dialog__status" role="status" aria-live="polite" data-copied="{u['share_copied']}"></p>
    <button class="shr-dialog__close" value="close" aria-label="{u['share_close']}">×</button>
  </form>
</dialog>
"""


def share_shell(d, lang, og_image, body, scripts=""):
    """The plain share view's frame: noindex head, logo + PDF button, the optional project / preparer line, the SL credit.
    Project name and preparer come from the URL hash (share.js), so they never reach a server log."""
    c, u = d[lang], UI[lang]
    pre = "" if lang == "tr" else "../"
    page = u["share_page"].format(slug=d["slug"])
    url = page if lang == "tr" else f"en/{page}"
    title = f"{c['name']} — {u['lib']} | Studio Luminant"
    lede = c["story"] if d["kind"] == "study" else c["lede"]
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#EFE8D5">
<title>{esc(title)}</title>
<meta name="description" content="{esc(c['meta'])}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Studio Luminant">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(c['meta'])}">
<meta property="og:url" content="{DOMAIN}{url}">
<meta property="og:image" content="{DOMAIN}{og_image}">
<meta property="og:image:width" content="{OG_SIZE[0]}">
<meta property="og:image:height" content="{OG_SIZE[1]}">
<meta name="twitter:card" content="summary_large_image">
{fonts(pre)}<link rel="stylesheet" href="{pre}shared.css">
<link rel="stylesheet" href="{pre}library.css">
</head>
<body class="shr">
<header class="shr-bar">
  <a class="shr-logo" href="./"><img src="{pre}images/studio-luminant-logo-ink.svg" alt="Studio Luminant"></a>
  <button type="button" class="sys-link shr-pdf" data-shr-print>{u['share_pdf']}</button>
</header>
<main class="shr-main">
<section class="shr-head">
  <dl class="shr-meta" hidden>
    <div data-shr="p" hidden><dt>{u['shr_proj']}</dt><dd></dd></div>
    <div data-shr="by" hidden><dt>{u['shr_by']}</dt><dd></dd></div>
  </dl>
  <div class="eyebrow">{u['lib']}</div>
  <h1 class="sys-name">{esc(c['name'])}</h1>
  <p class="sys-lede">{txt(lede)}</p>
</section>
{body}<footer class="shr-foot"><span>{u['shr_credit']}</span><a href="{DOMAIN}{urls(d['slug'])[0 if lang == 'tr' else 1]}">studioluminant.com.tr</a></footer>
</main>
{scripts}<script src="{pre}share.js"></script>
</body>
</html>
"""


def share_rooms(d, lang, pre):
    return "".join(
        f'  <figure class="shr-fig"><img src="{pre}{r["file"]}" width="{w}" height="{h}" alt="{esc(r[lang]["alt"])}">'
        f'<figcaption>{txt(r[lang]["cap"])}</figcaption></figure>\n'
        for r in ([d["room"]] if d.get("room") else []) + (d.get("rooms") or []) for w, h in [Image.open(SITE / r["file"]).size])


def share_page(d, lang, sizes):
    """A study design's share view: the design on the wall, in a room, close up and in its drawing."""
    c, u = d[lang], UI[lang]
    pre = "" if lang == "tr" else "../"
    base = f"{pre}assets/designs/{d['asset']}/"
    (ww, wh), (cw, ch) = sizes["wall"], sizes["card"]
    (sw, sh), (mw, mh) = sizes["drawing"][lang]["d"], sizes["drawing"][lang]["m"]
    spec = spec_html(study_spec(d, c, u), u)
    body = f"""<figure class="shr-fig"><img src="{base}wall.webp" width="{ww}" height="{wh}" alt="{esc(c['wall_alt'])}"><figcaption>{txt(c['wall_cap'])}</figcaption></figure>
{share_rooms(d, lang, pre)}<section class="shr-pair">
  <figure class="shr-fig"><img src="{base}detail.webp" width="{cw}" height="{ch}" alt="{esc(c['card_alt'])}"><figcaption>{txt(c['card_cap'])}</figcaption></figure>
  <div>
    <h2 class="dsg-h">{u['close_h']}</h2>
    <dl class="sys-spec">
{spec}
    </dl>
  </div>
</section>
<section class="shr-drawing">
  <h2 class="dsg-h">{u['drawing_h']}</h2>
  <p>{u['drawing_p']}</p>
  <figure class="shr-fig">
    <picture>
      <source media="{PHONE}" srcset="{base}{drawing_file(lang, 'm')}" width="{mw}" height="{mh}">
      <img src="{base}{drawing_file(lang, 'd')}" width="{sw}" height="{sh}" alt="{esc(c['sketch_alt'])}">
    </picture>
    <figcaption>{txt(c['sketch_cap'])}</figcaption>
  </figure>
</section>
"""
    return share_shell(d, lang, f"assets/designs/{d['asset']}/og.jpg", body)


def relief_share_page(d, lang, figs):
    """A relief design's share view: the relief under its live raking light (relief-light.js; the poster prints), in a
    room, the Library render with the spec, the wall strip and the drawing (depth map)."""
    c, u = d[lang], UI[lang]
    pre = "" if lang == "tr" else "../"
    rel = f"{pre}assets/relief/{d['asset']}/"
    man = json.loads((SITE / "assets" / "relief" / d["asset"] / "manifest.json").read_text(encoding="utf-8"))
    pw, ph = man["poster"]
    field = " shr-relief--field" if d["layout"] == "field" else ""
    spec = spec_html([("size", c["size"]), ("depth", c["depth"]), ("layout", c["layout"]),
                      ("material", u["material"]), ("finish", u["finish"]), ("fixing", fixing_of(d, u)), ("lead", u["lead"]), ("minimum", min_of(d, u))], u)
    ow, oh = figs["object"]
    strip = ""
    if "strip" in figs and c["strip_alt"]:
        tw, th = figs["strip"]
        strip = (f'<figure class="shr-fig"><img src="{rel}strip.webp" width="{tw}" height="{th}" alt="{esc(c["strip_alt"])}">'
                 f'<figcaption>{u["strip_cap"]}</figcaption></figure>\n')
    dw, dh = drawing_webp(SITE / "assets" / "relief" / d["asset"])
    body = f"""<figure class="shr-fig shr-relief{field}"><div class="relief-light" data-relief-light="{rel}" data-input="auto">
  <img class="relief-light__poster" src="{rel}poster-1680.jpg" srcset="{rel}poster-840.jpg {pw // 2}w, {rel}poster-1680.jpg {pw}w" sizes="{SIZES[d['layout']]}" width="{pw}" height="{ph}" alt="{esc(c['alt'])}">
</div></figure>
{share_rooms(d, lang, pre)}<section class="shr-pair shr-pair--relief">
  <figure class="shr-fig"><img src="{rel}object.webp" width="{ow}" height="{oh}" alt="{esc(c['object_alt'])}"><figcaption>{c.get('object_cap', u['obj_cap'])}</figcaption></figure>
  <div>
    <dl class="sys-spec">
{spec}
    </dl>
  </div>
</section>
{strip}<section class="shr-drawing">
  <h2 class="dsg-h">{u['drawing_h']}</h2>
  <figure class="shr-fig shr-depth"><img src="{rel}drawing.webp" width="{dw}" height="{dh}" alt="{esc(c['drawing_alt'])}"><figcaption>{c['drawing_cap']}. {txt(c['drawing_note'])}</figcaption></figure>
</section>
"""
    scripts = (PHONE_POSTER if d.get("poster_on_phone") else "") + f'<script src="{pre}relief-light.js" defer></script>\n'
    return share_shell(d, lang, f"assets/relief/{d['asset']}/og.jpg", body, scripts)


EAGER_CARDS = 3  # the index's first row at desktop width: not lazy, the first one is the LCP image


def card_image(d, lang, pos):
    pre = "" if lang == "tr" else "../"
    if d["kind"] == "relief":
        f = f"assets/relief/{d['asset']}/object.webp"
        alt = d[lang]["object_alt"]
    else:
        f = f"assets/designs/{d['asset']}/wall.webp"
        alt = d[lang]["wall_alt"]
    w, h = Image.open(SITE / f).size
    z = d.get("card_zoom")  # optional per-card crop-in that trims dark corners of a rotated source photo
    style = f' style="--z:{z[0]};transform-origin:{z[1]}"' if z else ""
    load = 'loading="lazy"' if pos >= EAGER_CARDS else ('fetchpriority="high"' if pos == 0 else 'loading="eager"')
    return f'<img src="{pre}{f}" width="{w}" height="{h}" {load}{style} alt="{esc(alt)}">'


def wide_cards(n):
    """Positions of the index cards that sit two to a row. The grid lays rows of three and rows of two, alternating from a
    row of three, so no count above one leaves a lone card (13 = 3 + 2 + 3 + 2 + 3)."""
    fits = [(a, b) for b in range(n // 2 + 1) for a in [(n - 2 * b) // 3] if 3 * a + 2 * b == n]
    if not fits:
        return set()
    a, b = min(fits, key=lambda ab: abs(ab[0] - ab[1] - 0.5))
    rows = []
    while a or b:
        if a:
            rows.append(3)
            a -= 1
        if b:
            rows.append(2)
            b -= 1
    wide, pos = set(), 0
    for size in rows:
        if size == 2:
            wide |= {pos, pos + 1}
        pos += size
    return wide


def index_page(data, lang):
    u = UI[lang]
    pre = "" if lang == "tr" else "../"
    tr_url, en_url = "tasarimlar.htm", "en/designs.htm"
    url = tr_url if lang == "tr" else en_url
    twin = f"{pre}{en_url}" if lang == "tr" else f"../{tr_url}"
    cards, wide = [], wide_cards(len(data["designs"]))
    for pos, d in enumerate(data["designs"]):
        c = d[lang]
        line = c["story"] if d["kind"] == "study" else first_sentence(c["lede"])
        cards.append(f'''    <a class="dsg-card{' dsg-card--wide' if pos in wide else ''} reveal" href="{u['page'].format(slug=d['slug'])}">
      <span class="dsg-card__img">{card_image(d, lang, pos)}</span>
      <span class="dsg-card__name">{esc(c['name'])}</span>
      <span class="dsg-card__line">{nb(txt(line))}</span>
      <span class="dsg-card__more">{u['more']}</span>
    </a>''')
    first = data["designs"][0]
    og = (f"assets/designs/{first['asset']}/wall.webp" if first["kind"] == "study"
          else f"assets/relief/{first['asset']}/poster-1680.jpg")
    return (head(lang, u["idx_title"], u["idx_meta"], url, tr_url, en_url, og, "", crumbs_for(lang, None, url))
            + nav(lang, twin) + f"""<section class="dsg-index-head">
  <div class="eyebrow">{u['lib']}</div>
  <h1 class="dsg-index__title">{u['idx_h1']}</h1>
  <p class="dsg-index__lede">{u['idx_lede']}</p>
  <p class="dsg-index__lede">{u['idx_rooms']}</p>
</section>

<section class="dsg-grid" aria-label="{u['lib']}">
{chr(10).join(cards)}
</section>

<section class="sys-door" id="sys-door">
  <div class="sys-door__inner">
    <p>{u['idx_door']}</p>
    <div class="sys-door__links">
      <a href="{u['contact']}" class="sys-link">{u['idx_door_link']}</a>
      <a href="{u['contact']}?ask=layout" class="sys-link">{u['idx_samples']}</a>
    </div>
  </div>
</section>
""" + tail(lang))


def old_page(*paths):
    for p in paths:
        if p.exists():
            return p.read_text(encoding="utf-8")
    return ""


def write(path, text, *olds):
    text, _ = asset_versions.restamp(path, carry_over(text, old_page(path, *olds)), {}, [])
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(SITE).as_posix())


# ---------------------------------------------------------------------------------------------- what is on the site
# The board's Portfolio tab (VAULT/10 — AI & Tools/portfolio_board.py) decides which designs are listed and calls
# plan_push / push_selection below. A design leaving the site moves into "parked" (content kept, "redirect": true) and its
# pages are deleted and redirected; sitemap.xml, llms.txt, site-haritasi.htm, en/site-map.htm and the netlify.toml
# redirect block are regenerated from designs.json on every build, so a plain run of this script keeps them in sync.
DESIGN_FIELDS = {
    "relief": ("name", "lede", "size", "depth", "layout", "alt", "object_alt", "title", "meta", "sections", "drawing_cap",
               "drawing_note", "drawing_alt"),
    "study": ("name", "story", "title", "meta", "wall_alt", "wall_cap", "card_alt", "card_cap", "sketch_alt", "sketch_cap"),
}
NETLIFY_BEGIN = "# >>> designs-parked (generated by tools/build_designs.py, do not edit) >>>"
NETLIFY_END = "# <<< designs-parked <<<"
SITE_HOST = DOMAIN.rstrip("/")


def _rd(path):
    return Path(path).read_bytes().decode("utf-8")


def _wr(path, text):
    Path(path).write_bytes(text.encode("utf-8"))


def _eol(text):
    return "\r\n" if "\r\n" in text else "\n"


def designs_path():
    return SITE / "tools" / "designs.json"


def dump_designs(data):
    """The file's own format: indent 1, ensure_ascii off, CRLF, trailing CRLF (a re-dump of unchanged data is byte-identical)."""
    return (json.dumps(data, ensure_ascii=False, indent=1) + "\n").replace("\n", "\r\n")


def design_missing(d, library=None):
    """What a design entry still lacks before its page can go live: copy fields (TR + EN) and every image on disk. [] = ready."""
    kind = d.get("kind")
    if kind not in DESIGN_FIELDS:
        return ["kind must be relief or study"]
    missing = []
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", str(d.get("slug") or "")):
        missing.append("slug")
    if not d.get("asset"):
        missing.append("asset")
    for lang in ("tr", "en"):
        block = d.get(lang) if isinstance(d.get(lang), dict) else {}
        missing += [f"{lang}.{f}" for f in DESIGN_FIELDS[kind] if not block.get(f)]
        if kind == "relief" and "strip_alt" not in block:
            missing.append(f"{lang}.strip_alt")
    if kind == "relief" and d.get("asset"):
        rel = SITE / "assets" / "relief" / d["asset"]
        missing += [f"image assets/relief/{d['asset']}/{n}" for n in ("manifest.json", "poster-840.jpg", "poster-1680.jpg")
                    if not (rel / n).exists()]
        if not ((rel / "height-1024.webp").exists() or (rel / "drawing.webp").exists()):
            missing.append(f"image assets/relief/{d['asset']}/height-1024.webp")
        lib = (library or LIBRARY) / str(d.get("library") or "-")
        if not (rel / "object.webp").exists() and d.get("object_fixed"):
            missing.append(f"image assets/relief/{d['asset']}/object.webp (hand-placed close view; restore it from git, the Library render is not its source)")
        elif not (rel / "object.webp").exists() and not (lib / "render.png").exists():
            missing.append(f"image Library render for {d.get('library')}")
    elif kind == "study" and d.get("asset"):
        src = d.get("src") if isinstance(d.get("src"), dict) else {}
        out = SITE / "assets" / "designs" / d["asset"]
        for k, name in STUDY_FILE.items():
            if not (out / name).exists() and not (src.get(k) and (ROOT / src[k]).exists()):
                missing.append(f"image assets/designs/{d['asset']}/{name}")
        drw = d.get("drawing") if isinstance(d.get("drawing"), dict) else {}
        for lang in ("tr", "en"):
            for v in DRAWING_WIDTH:
                if not (out / drawing_file(lang, v)).exists() and not ((drw.get(lang) or {}).get(v) and (ROOT / drw[lang][v]).exists()):
                    missing.append(f"image assets/designs/{d['asset']}/{drawing_file(lang, v)}")
    for m in (d.get("moulds") or []) if kind == "study" and d.get("asset") else []:
        if not (SITE / "assets" / "designs" / d["asset"] / mould_file(m)).exists() and not (ROOT / m["src"]).exists():
            missing.append(f"image assets/designs/{d['asset']}/{mould_file(m)}")
    room = d.get("room")
    if room and not (SITE / room["file"]).exists():
        missing.append(f"image {room['file']}")
    return missing


def _by_slug(data):
    return {e["slug"]: e for e in [*data.get("parked", []), *data["designs"]]}


def plan_push(data, selected, library=None):
    """Dry run: what making `selected` (slugs) the listed designs would do. Never writes.
    {added, removed, restored, blocked: [{slug, missing}], pages_added, pages_removed, data (the new designs.json content;
    None when blocked)}"""
    have = _by_slug(data)
    listed = [d["slug"] for d in data["designs"]]
    selected = sorted(set(selected))
    blocked = []
    for slug in selected:
        miss = design_missing(have[slug], library) if slug in have else ["designs.json entry (copy + images)"]
        if miss:
            blocked.append({"slug": slug, "missing": miss})
    added = [s for s in selected if s not in listed]
    removed = [s for s in listed if s not in selected]
    new = None
    if not blocked:
        keep = {d["slug"]: d for d in data["designs"]}
        parked = [p for p in data.get("parked", []) if p["slug"] not in selected and p["slug"] not in removed]
        new = {**data, "designs": [(have[s] if s in added else keep[s]) for s in selected],
               "parked": parked + [{**keep[s], "redirect": True} for s in removed]}
    pages = lambda slugs: [f for s in slugs for f in urls(s)]
    return {"added": added, "removed": removed, "restored": [s for s in added if any(p["slug"] == s for p in data.get("parked", []))],
            "blocked": blocked, "pages_added": pages(added), "pages_removed": pages(removed), "data": new}


# ---- list sync: pure text -> text, each file's line endings kept
def _url_block(slug, lang, today):
    tr, en = f"{SITE_HOST}/tasarim-{slug}.htm", f"{SITE_HOST}/en/design-{slug}.htm"
    return (f'  <url>\n    <loc>{tr if lang == "tr" else en}</loc>\n    <xhtml:link rel="alternate" hreflang="tr" href="{tr}"/>\n'
            f'    <xhtml:link rel="alternate" hreflang="en" href="{en}"/>\n'
            f'    <xhtml:link rel="alternate" hreflang="x-default" href="{tr}"/>\n    <changefreq>monthly</changefreq>\n'
            f'    <priority>0.7</priority>\n    <lastmod>{today}</lastmod>\n  </url>\n')


def sync_sitemap(text, listed, managed, today):
    eol = _eol(text)
    pat = re.compile(r"  <url>\r?\n    <loc>" + re.escape(SITE_HOST) + r"/(?:en/design|tasarim)-([a-z0-9-]+)\.htm</loc>.*?</url>\r?\n", re.S)
    text = pat.sub(lambda m: m.group(0) if m.group(1) not in managed or m.group(1) in listed else "", text)
    add = ""
    for slug in sorted(listed):
        for lang in ("tr", "en"):
            loc = f"{SITE_HOST}/tasarim-{slug}.htm" if lang == "tr" else f"{SITE_HOST}/en/design-{slug}.htm"
            if f"<loc>{loc}</loc>" not in text:
                add += _url_block(slug, lang, today)
    if add:
        i = text.rindex("</urlset>")
        text = text[:i] + add.replace("\n", eol) + text[i:]
    return text


def sync_llms(text, designs, managed):
    eol = _eol(text)
    line = re.compile(r"^- \[[^\]]*\]\(" + re.escape(SITE_HOST) + r"/en/design-([a-z0-9-]+)\.htm\):[^\r\n]*\r?\n", re.M)
    listed = {d["slug"] for d in designs}
    text = line.sub(lambda m: m.group(0) if m.group(1) not in managed or m.group(1) in listed else "", text)
    for d in designs:
        if f"/en/design-{d['slug']}.htm)" in text:
            continue
        c = d["en"]
        desc = first_sentence(c["story"] if d["kind"] == "study" else c["lede"])
        new = f"- [{c['name']}]({SITE_HOST}/en/design-{d['slug']}.htm): {desc}{eol}"
        last = list(line.finditer(text))
        if last:
            at = last[-1].end()
        else:
            at = text.index("- [Studio Designs]")
            at = text.index("\n", at) + 1
        text = text[:at] + new + text[at:]
    names = ", ".join(d["en"]["name"] for d in designs)
    return re.sub(r"(\]\(" + re.escape(SITE_HOST) + r"/en/designs\.htm\):[^\r\n]*?each on its own page: )[^\r\n]*?(\.\r?\n)",
                  lambda m: m.group(1) + names + m.group(2), text, count=1)


def sync_site_map(text, designs, lang):
    """The run of design <li> lines in the site map (TR href tasarim-<slug>.htm, EN design-<slug>.htm), regenerated in order."""
    eol = _eol(text)
    stem = "tasarim" if lang == "tr" else "design"
    li = r'[ \t]*<li><a href="' + stem + r'-[a-z0-9-]+\.htm">[^<]*</a></li>\r?\n'
    m = re.search("(?:" + li + ")+", text)
    if not m:
        return text
    indent = re.match(r"[ \t]*", m.group(0)).group(0)
    rows = "".join(f'{indent}<li><a href="{stem}-{d["slug"]}.htm">{esc(d[lang]["name"])}</a></li>{eol}' for d in designs)
    return text[:m.start()] + rows + text[m.end():]


def sync_netlify(text, parked, today):
    """One marker-delimited block of 302s (index) for the parked designs that were taken off the site (redirect flag)."""
    eol = _eol(text)
    old = re.search(re.escape(NETLIFY_BEGIN) + r".*?" + re.escape(NETLIFY_END) + r"\r?\n?", text, re.S)
    dated = dict(re.findall(r"# ([a-z0-9-]+): taken off the site (\d{4}-\d\d-\d\d)", old.group(0))) if old else {}
    lines = []
    for p in parked:
        if not p.get("redirect"):
            continue
        s = p["slug"]
        lines.append(f"# {s}: taken off the site {dated.get(s, today)}; temporary redirect to the index, content kept in tools/designs.json")
        for src, to in ((f"/tasarim-{s}.htm", "/tasarimlar.htm"), (f"/tasarim-{s}", "/tasarimlar.htm"),
                        (f"/en/design-{s}.htm", "/en/designs.htm"), (f"/en/design-{s}", "/en/designs.htm")):
            lines += ["[[redirects]]", f'  from = "{src}"', f'  to = "{to}"', "  status = 302", "  force = true", ""]
    block = (NETLIFY_BEGIN + eol + eol.join(lines) + eol + NETLIFY_END + eol) if lines else ""
    if old:
        return text[:old.start()] + block + text[old.end():]
    if not block:
        return text
    return text + ("" if text.endswith("\n") else eol) + eol + block


OPTIONS_RE = re.compile(r"([ 	]*)<!-- design-options:begin -->.*?<!-- design-options:end -->", re.S)


def sync_design_options(text, designs, lang):
    """The <option> run of every design select on the contact page (between the design-options markers): every listed design,
    alphabetical by display name, value = slug. The empty first option stays hand-written in the page."""
    eol = _eol(text)
    ordered = sorted(designs, key=lambda d: d[lang]["name"].casefold())

    def block(m):
        ind = m.group(1)
        rows = "".join(f'{ind}<option value="{d["slug"]}">{esc(d[lang]["name"])}</option>{eol}' for d in ordered)
        return f"{ind}<!-- design-options:begin -->{eol}{rows}{ind}<!-- design-options:end -->"
    return OPTIONS_RE.sub(block, text)


def site_sync(data, today=None):
    """{relative path: new text} for the site-wide design lists that differ from designs.json (pure: reads, never writes)."""
    today = today or date.today().isoformat()
    designs = data["designs"]
    listed = {d["slug"] for d in designs}
    managed = listed | {p["slug"] for p in data.get("parked", [])}
    wanted = {
        "sitemap.xml": lambda t: sync_sitemap(t, listed, managed, today),
        "llms.txt": lambda t: sync_llms(t, designs, managed),
        "site-haritasi.htm": lambda t: sync_site_map(t, designs, "tr"),
        "en/site-map.htm": lambda t: sync_site_map(t, designs, "en"),
        "iletisim.htm": lambda t: sync_design_options(t, designs, "tr"),
        "en/contact.htm": lambda t: sync_design_options(t, designs, "en"),
        "netlify.toml": lambda t: sync_netlify(t, data.get("parked", []), today),
    }
    changed = {}
    for rel, fn in wanted.items():
        if (SITE / rel).exists():
            old = _rd(SITE / rel)
            new = fn(old)
            if new != old:
                changed[rel] = new
    return changed


def stale_pages(data):
    """Page files of designs taken off the site (parked with the redirect flag) that still sit on disk."""
    return [f for p in data.get("parked", []) if p.get("redirect") for f in urls(p["slug"]) if (SITE / f).exists()]


def sync_site(data, today=None):
    """Write the list/redirect changes and delete the pages of designs taken off the site. Returns what was touched."""
    changed = site_sync(data, today)
    for rel, text in changed.items():
        _wr(SITE / rel, text)
        print("synced", rel)
    gone = stale_pages(data)
    for rel in gone:
        (SITE / rel).unlink()
        print("removed", rel)
    return {"files": sorted(changed), "pages_removed": gone}


def library_warnings(data, library):
    """One line per listed design with no Library entry: no `library` code, or no manifest at VAULT/Library/Relief/<code>/."""
    out = []
    for d in data["designs"]:
        code = d.get("library")
        if not code:
            out.append(f"WARN {d['slug']}: no Library code (register it: tile_lookup.py promote)")
        elif not (library / code / "manifest.json").exists():
            out.append(f"WARN {d['slug']}: Library entry {code} has no manifest.json under {library}")
    return out


def build(library, rebuild_images=False):
    data = json.loads(designs_path().read_text(encoding="utf-8"))
    for line in library_warnings(data, library):
        print(line)
    for d in data["designs"]:
        tr_path, en_path = SITE / urls(d["slug"])[0], SITE / urls(d["slug"])[1]
        tr_old, en_old = SITE / f"sistem-{d['slug']}.htm", SITE / "en" / f"system-{d['slug']}.htm"
        if d["kind"] == "relief":
            out = SITE / "assets" / "relief" / d["asset"]
            lib = library / str(d.get("library") or "-")
            figs = {"object": webp(lib / "render.png", out / "object.webp", 1200)}
            if (out / "strip.webp").exists() or ((lib / "wall_strip.png").exists() and d["tr"]["strip_alt"]):
                figs["strip"] = webp(lib / "wall_strip.png", out / "strip.webp", 1600)
            for lang, path, old in (("tr", tr_path, tr_old), ("en", en_path, en_old)):
                write(path, relief_page(data, d, lang, figs), old)
            if shared(d):
                og_jpg(out, "poster-1680.jpg")
                write(SITE / UI["tr"]["share_page"].format(slug=d["slug"]), relief_share_page(d, "tr", figs))
                write(SITE / "en" / UI["en"]["share_page"].format(slug=d["slug"]), relief_share_page(d, "en", figs))
        else:
            out = SITE / "assets" / "designs" / d["asset"]
            sizes = {k: webp(ROOT / d["src"][k], out / STUDY_FILE[k], STUDY_WIDTH[k], rebuild_images) for k in STUDY_FILE}
            sizes["drawing"] = {lang: {v: webp(ROOT / d["drawing"][lang][v], out / drawing_file(lang, v), w, rebuild_images)
                                       for v, w in DRAWING_WIDTH.items()} for lang in ("tr", "en")}
            for m in d.get("moulds") or []:
                webp(ROOT / m["src"], out / mould_file(m), MOULD_WIDTH, rebuild_images)
            write(tr_path, study_page(data, d, "tr", sizes), SITE / "sistemler.htm")
            write(en_path, study_page(data, d, "en", sizes), SITE / "en" / "systems.htm")
            if shared(d):
                og_jpg(out)
                write(SITE / UI["tr"]["share_page"].format(slug=d["slug"]), share_page(d, "tr", sizes))
                write(SITE / "en" / UI["en"]["share_page"].format(slug=d["slug"]), share_page(d, "en", sizes))
    write(SITE / "tasarimlar.htm", index_page(data, "tr"), SITE / "sistemler.htm")
    write(SITE / "en" / "designs.htm", index_page(data, "en"), SITE / "en" / "systems.htm")
    return sync_site(data)


def push_selection(selected, dry_run=True, library=None, today=None):
    """Make `selected` (slugs) the designs on the site. dry_run (the default) only reports. A blocked plan, or one with nothing
    to change, writes nothing. Never touches git or a deploy.
    -> {added, removed, restored, blocked, pages_added, pages_removed, files (lists that would change), changed, applied}"""
    library = library or LIBRARY
    data = json.loads(designs_path().read_text(encoding="utf-8"))
    plan = plan_push(data, selected, library)
    new = plan.pop("data")
    files = sorted(site_sync(new, today)) if new else []
    pages_removed = stale_pages(new) if new else []
    out = {**plan, "files": files, "pages_removed": pages_removed or plan["pages_removed"] if new else [],
           "changed": bool(new and (plan["added"] or plan["removed"] or files or pages_removed)), "applied": False}
    if dry_run or not out["changed"]:
        return out
    if plan["added"] or plan["removed"]:
        _wr(designs_path(), dump_designs(new))
    build(library)
    out["applied"] = True
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--library", type=Path, default=LIBRARY)
    ap.add_argument("--rebuild-images", action="store_true", help="re-make the study WebPs from their prestage PNGs")
    a = ap.parse_args()
    build(a.library, a.rebuild_images)


if __name__ == "__main__":
    main()
