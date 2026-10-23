# PATCH_NOTES — apply after merging `prestage-pages` into `rebuild-v3`

New files: `vaka-tufetto.htm` (updated, now a making-of), `en/case-study-tufetto.htm` (updated), `hakkimizda.htm`, `en/about.htm`. No existing shared file was touched.

## Before merge: go-live gate
- `grep -c data-placeholder vaka-tufetto.htm en/case-study-tufetto.htm hakkimizda.htm en/about.htm` must reach 0 (10 frame slots per Tufetto page, 4 photo slots per About page). Neither Tufetto page carries `noindex` any more (WB-07: indexable from launch), so do not publish with slots open.
- Run `python tools/asset_versions.py --apply` and `python tools/sitemap_lastmod.py --apply` after the lines below.

## 1. components.js (footer link, line ~105)
Replace
`const ABOUT_HREF = { tr: '', en: '' };`
with
`const ABOUT_HREF = { tr: 'hakkimizda.htm', en: 'about.htm' };`
(the footer already renders the «Hakkımızda» / About item when this is set; labels exist at lines 87 and 99).

## 2. Home «Atölye» link (DEC-23)
TR `Studio Luminant — Özel Mimari Elemanlar.htm`, in `<section id="studio">` after the second `<p class="body-text reveal">` (~line 1074):
`<p class="body-text reveal"><a href="hakkimizda.htm" class="sys-link">Hakkımızda</a></p>`
EN `en/Studio Luminant — Bespoke Architectural Elements.htm`, same place (~line 1117):
`<p class="body-text reveal"><a href="about.htm" class="sys-link">About the studio</a></p>`
(`.sys-link` lives in library.css; if the home does not load it, use the home's own text-link class.)

## 3. sitemap.xml (add inside `<urlset>`)
```
  <url>
    <loc>https://studioluminant.com.tr/hakkimizda.htm</loc>
    <xhtml:link rel="alternate" hreflang="tr" href="https://studioluminant.com.tr/hakkimizda.htm"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://studioluminant.com.tr/en/about.htm"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://studioluminant.com.tr/hakkimizda.htm"/>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
    <lastmod>2026-10-25</lastmod>
  </url>
```
and the mirror `<url>` for `https://studioluminant.com.tr/en/about.htm` (same three alternates). Tufetto: confirm `vaka-tufetto.htm` and `en/case-study-tufetto.htm` entries exist (they were noindex before; add them if absent, same pattern, priority 0.7).

## 4. sitemap-images.xml
Add `https://studioluminant.com.tr/assets/case/tufetto/model.jpg` (caption: «Tasarım aşaması: Tufetto duvarının ilk modelinin render görüntüsü, mimarın revizyonundan önce» / "Design stage: render of the first model of the Tufetto wall, before the architect's revision") under the Tufetto page. Add the frame images when the slots are filled.

## 5. llms.txt (after the Galeri line, ~56)
`- [Hakkımızda](https://studioluminant.com.tr/hakkimizda.htm): Studio Luminant'ın hikâyesi: kurucu, Sapanca'daki atölye, çizimden kalıba teknik bilgi.`
`- [Tufetto duvarının yapım süreci](https://studioluminant.com.tr/vaka-tufetto.htm): Referans görselinden elde dökülen rölyef duvara, İstanbul'da bir konut.`
EN list, if present: About (`en/about.htm`), Making of the Tufetto wall (`en/case-study-tufetto.htm`).

## 6. Links into the Tufetto page (optional, owner's call)
`galeri.htm` / `en/gallery.htm` card or text link; Instagram/LinkedIn link targets already point at `vaka-tufetto.htm` (PO-01..03 stories).

## 7. Open items
- OG image: both Tufetto pages use `assets/case/tufetto/model.jpg` (1200x1651, not 1200x630) until L-W09 delivers the card; the About page uses the 512 px logo for the same reason.
- Founder LinkedIn `sameAs` left out of the Person node (the pack's handle is a REPLACE placeholder).
- Old pages' stale lines removed from the Tufetto pair: the room-composite (`scene.jpg`, carries Tufetto's logo), the reference photo, the Ezgi quote, the photographer row, the light-series slider, and the `?v=` hash on new includes was stamped by `asset_versions.py`.
