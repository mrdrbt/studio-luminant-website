# Technical SEO Audit — Studio Luminant

**Site:** https://studioluminant.com.tr (Netlify static, vanilla HTML/CSS/JS · TR at root + EN in `/en/`)
**Repo:** `mrdrbt/studio-luminant-website`
**Audited:** 2026-07-03 · codebase + live spot-checks
**Overall score: 90 / 100** — strong technical foundation; a handful of narrow fixes, all on the two EN case-study pages plus image housekeeping.

---

## Scores by category

| Category | Score | Verdict |
|---|---|---|
| Crawlability | 95 | Excellent — dual sitemaps, exhaustive redirect map, WP ghost URLs 410'd |
| Indexation & tags | 92 | Canonical + reciprocal hreflang on every page; 2 pages miss schema |
| Performance | 82 | Great `<picture>`/WebP architecture; oversized raw fallbacks + case-study heroes drag it |
| Mobile | 95 | Viewport, responsive `srcset` sizes, tap-friendly |
| Security | 90 | HSTS preload + full header set; no CSP |
| Structured data | 90 | JSON-LD on 43/45 pages, reciprocal, typed |

---

## What's already right (don't touch)

The fundamentals are handled better than most production sites:

- **Canonicalization is airtight.** Every page has a self-referencing canonical, and the Netlify config force-301s `studioluminant.com` and both `www` variants to the bare `.com.tr` apex (verified live: `studioluminant.com/urunler.htm` → 301 → `studioluminant.com.tr/urunler.htm`). No duplicate-domain exposure.
- **hreflang is reciprocal and per-page.** Interior pages map to their true counterpart (`/urunler.htm` ⇄ `/en/products.htm`), not lazily to the homepage — the single most common hreflang bug, and it's absent here. `x-default` points to the TR page throughout.
- **Redirect hygiene.** WordPress ghost paths (`/wp-admin/*`, `/feed/*`, `/xmlrpc.php`, …) return `410 Gone` so Google drops them; the old `/tr/` and root-EN URL structures 301 to the current layout; on-hold BIM pages 301 to the Specifier Kit and are excluded from the sitemap.
- **Image delivery.** All 16 homepage images (and 152 `<picture>` blocks site-wide, 162 WebP sources) use responsive `srcset` with 400/800/1600/2400w WebP. Modern browsers get a 518 KB WebP where the raw fallback is a 7.2 MB PNG. Hero is preloaded as WebP; every `<img>` carries `width`/`height` (CLS protection); 160/168 images are `loading="lazy"` (above-fold heroes correctly excluded).
- **Fonts:** `display=swap` + `preconnect` to both Google Fonts origins.
- **Security headers** (netlify.toml): HSTS with `preload`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. Caching: images `immutable` 1yr, CSS/JS 1wk.
- **Sitemaps:** `sitemap.xml` (43 URLs, all with `<lastmod>`) + `sitemap-images.xml`, both referenced in `robots.txt`. Every `<loc>` matches its page's canonical form.
- Single `<h1>` per page. Custom `404.html`. `/downloads/` disallowed in robots.

---

## Priority fixes

### 1. [High] Add JSON-LD schema to the two EN case-study pages
`en/case-study-petal-lounge.htm` and `en/case-study-wave-lounge.htm` are the only two indexable pages with **no structured data** — every other page has it. They're in the sitemap and internally linked from ~20 EN pages, so they're meant to rank. Add an `Article` (or `CreativeWork`) block with `headline`, `image`, `datePublished`, `author`/`publisher` (Studio Luminant), matching the pattern already used on the journal/article pages.

### 2. [High] Fix the case-study `og:image` / `twitter:image` (currently 8 MB)
Both case studies point their social image at `studio-luminant-petal-geometric-relief-panels-luminant-lounge-hospitality.jpg` — an **8.1 MB** file. Social scrapers (LinkedIn, WhatsApp, some Slack/X fetchers) cap OG images around 5 MB and will silently skip it, so shared links render with no preview. Every other page correctly uses the dedicated `studio-luminant-og-image.jpg` (65 KB). Point the case studies at a purpose-built ~1200×630, <300 KB image (a WebP-or-JPG derivative of the hero is fine).

### 3. [Medium] Recompress the oversized raw image fallbacks
The `images/` directory is **110 MB**, and ~34 referenced JP/PNG fallbacks exceed 400 KB — several are absurd for a fallback: 8.1 MB, 7.2 MB, 5.9 MB, 4.7 MB, 3.3 MB. Modern users never receive these (they get the WebP `srcset`), so this is not hurting live LCP for most visitors — **but** they (a) bloat every Netlify deploy, (b) are what non-WebP clients and the CSS-background/OG paths actually pull, and (c) a WebP already exists at ~150–520 KB for each. Re-encode the raw JPG/PNG fallbacks to ≤400 KB (quality ~80). `optimize-images.py` is already in the repo — extend it to cap fallback size. This alone should cut the deploy by ~80 MB.

### 4. [Medium] Case-study hero is a CSS `background-image` → LCP risk on those two pages
The case-study heroes render via `background-image: image-set(webp, jpg)`. The WebP-first `image-set()` means modern browsers do get the WebP (good), **but** CSS backgrounds aren't discovered by the preload scanner, so the LCP element loads late. On the two case-study pages specifically, either add `<link rel="preload" as="image" href="…hospitality.webp" type="image/webp">` to the head, or promote the hero to a real `<picture>`/`<img>` element (as the rest of the site does). Other pages are unaffected — they use `<img>` heroes with preload already.

### 5. [Low] Add a Content-Security-Policy header
netlify.toml sets a strong header set but no `Content-Security-Policy`. Not a ranking factor, but it closes the last gap in the security profile and is a clean add for a static site (script sources are limited to self + Google Fonts/GA4).

### 6. [Verify] Pull real Core Web Vitals field data
This audit assesses CWV *architecture* (which is good) but can't measure live field metrics from here. Check **Search Console → Core Web Vitals** and run **PageSpeed Insights** on the homepage, a product page, and a case-study page for actual LCP/INP/CLS at the 75th percentile.
Note on thresholds: the long-standing "good" bars are LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Several 2026 SEO sources report Google has tightened the "good" LCP bar toward **2.0 s** (2.0–2.5 s now "needs improvement") — treat as advisory and confirm against Google's official CWV docs / your GSC report before acting, but it reinforces fixing #4.

---

## Notes / non-issues (checked, no action)

- **Sitemap uses `.htm` URLs** — correct, not a bug: those are the real served pages and they match their canonicals. Only the homepage uses clean `/` and `/en/` (via Netlify 200-rewrite), and the sitemap reflects that.
- **Case studies are EN-only** — hreflang correctly omits `tr` and self-references `x-default`; not broken.
- **On-hold BIM pages** still exist as files but are force-301'd and kept out of the sitemap — correct handling.
- No `noindex` anywhere; no pages missing canonical or hreflang.

---

*Fastest path: items 1 + 2 are ~30 min of edits on two files and capture most of the SEO upside. Item 3 is the biggest housekeeping win. Then read live CWV before doing anything to #4.*
