# Studio Luminant Website — local constraints

*Loaded when working in the website repo. Cross-cutting SL rules (fire hold, terminology, pricing) still apply via the umbrella rule registry.*

- **Path:** this repo (`VAULT/06 — Website/Studio Luminant Website/`).
- **Stack:** Vanilla HTML/CSS/JS — no frameworks, no npm, no build. Real pages are `.htm`; `index.html` are redirect stubs.
- **Languages:** TR pages at root (default), EN pages in `/en/`. EN pages use `data-base="../"` and need a `../` prefix for images/assets.
- **Generated — do NOT edit:** `material-specs.js`, `collection-data.js` — source of truth is Supabase. Regenerate via the `publish-product-data` Edge Function.
- **Shared architecture:** `shared.css` + `shared.js` + `components.js` (nav/footer injection). Each page has `<div id="site-nav">` and `<div id="site-footer">` placeholders.
- **Design system:** CSS custom properties — gold/obsidian palette, Jost + Cormorant Garamond.
- **Supabase:** Project `mjmeqgljpyenuqorarte` (EU Central) — bilingual `_en`/`_tr` columns. Do NOT push fire-certification values into the `fire` columns — blank those fields per the fire hold, then run `publish-product-data`.
- **GA4:** `G-PZ0SGLKLH0`
