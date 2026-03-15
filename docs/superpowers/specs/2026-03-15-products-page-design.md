# Studio Luminant — Products Page Design Spec
**Date:** 2026-03-15
**Scope:** Dedicated `products.htm` page — deep-dive on Lumina PMAG™ and Lumina PUCOMP™

---

## Overview

A single static HTML page (`products.htm`) following the same boilerplate pattern as `contact.htm`, `process.htm`, and `gallery.htm`. Two core material systems each get a full section with image, specs, and use cases. No build tools — surgical additions to the multi-page static site.

---

## Page Structure

**Page `<title>`:** `Products — Studio Luminant`

### 1. Page Hero
- Background image: `images/studio-luminant-lumina-pmag-gypsum-relief-panel-hero-hd.jpg`
- Same `::before` dark gradient overlay as main page hero and `process.htm`
- Content bottom-anchored (same `.page-hero-content` pattern)
- Eyebrow: "Material Engineering"
- Headline (Cormorant, `clamp(68px, 7vw, 110px)`, weight 300): `Engineered for<br><em>Permanence.</em>`
- Sub (14px, max-width 520px): "Two proprietary material systems — formulated for certified performance, bespoke geometry, and permanent installation."

---

### 2. Lumina PMAG™ Section (`#pmag`)
- `background: var(--deep)`, `border-top: 1px solid var(--border)`
- Full-width edge-to-edge image at top: `studio-luminant-lumina-pmag-gypsum-relief-panel-hd-01.jpg`
  - `width: 100%`, `max-height: 560px`, `object-fit: cover`, `display: block`
- Below image: `.section-inner` with 2-column grid (`1fr 1fr`, gap 100px):
  - **Left column:** eyebrow "Lumina PMAG™", headline (Cormorant, ~42px): `Polymer Modified<br><em>Alpha Gypsum</em>`, 2-paragraph description
  - **Right column:** `.specs-grid` — 6 cells in a `2×3` CSS grid, each showing label + value

**Specs grid content (PMAG):**
| Label | Value |
|-------|-------|
| Fire Rating | A1 Non-Combustible |
| Surface | Ceramic-Like Smooth |
| Application | Interior Walls & Ceilings |
| Moisture | Resistant |
| Scale | Large-Format Panels |
| Finish | Automotive 2K Coating |

- **Use Cases row** — sits as a sibling of `.product-content` (outside the 2-col grid), inside `.section-inner`. This makes it full-width. HTML structure:
  ```html
  <div class="section-inner">
    <div class="product-content"><!-- left + right columns --></div>
    <div class="use-cases"><!-- use-case-tag elements --></div>
  </div>
  ```
  Tags:
  - Luxury Hospitality
  - High-End Residential
  - Cultural Institutions

**PMAG description copy:**
> Lumina PMAG™ is Studio Luminant's primary interior cladding material — a polymer modified alpha gypsum formulated for high-specification architectural installations. Alpha gypsum delivers a compressive strength significantly above beta-grade alternatives, producing a denser, harder panel with a ceramic-like surface finish.
>
> Certified A1 non-combustible, moisture resistant, and available in any RAL or custom colour via automotive-grade 2K coating. Ideal for large-scale interior wall and ceiling installations where fire compliance, surface quality, and dimensional accuracy are non-negotiable.

---

### 3. Lumina PUCOMP™ Section (`#pucomp`)
- `background: var(--obsidian)`, `border-top: 1px solid var(--border)`
- Full-width edge-to-edge image at top: `studio-luminant-geometric-pinwheel-relief-wall-cladding-lounge.jpg`
- Same 2-column layout as PMAG section

**Specs grid content (PUCOMP):**
| Label | Value |
|-------|-------|
| Weight | Lightweight |
| Application | Exterior & Wet Areas |
| Geometry | Complex Spatial Forms |
| Durability | Impact Resistant |
| Rating | UV & Weather Resistant |
| Finish | Automotive 2K Coating |

- **Use Cases row** — same sibling structure as PMAG (outside `.product-content`, inside `.section-inner`):
  - High-Impact Areas
  - Handles & Fixtures
  - HVAC Covers
  - Exterior Facades
  - Wet Areas

**PUCOMP description copy:**
> Lumina PUCOMP™ is a high-performance polyurethane composite engineered for applications where gypsum is unsuitable — exterior cladding, wet areas, high-impact surfaces, and complex three-dimensional geometries. The formulation delivers exceptional strength-to-weight ratio, enabling intricate panel forms that would be prohibitively heavy in mineral-based materials.
>
> UV-stable, weather resistant, and impact rated, PUCOMP panels are finished to the same automotive 2K standard as PMAG — maintaining a consistent aesthetic across both material families regardless of installation context.

---

### 4. CTA Strip (`#products-cta`)
- `background: var(--deep)`, `padding: 120px 0`, `text-align: center`
- `border-top: 1px solid var(--border)`
- Headline (Cormorant, `clamp(44px, 4vw, 72px)`): `Ready to Specify<br><em>Your Project?</em>`
- Sub (14px, max-width 520px): "Request a material data sheet and BIM file package for your specification."
- `.btn-primary` linking to `contact.htm`: "Initiate Project" + arrow SVG

---

## Nav Update

Update "Products" nav links across all pages to point to `products.htm`:

| Page | Element | From | To |
|------|---------|------|----|
| Main `.htm` | "Products" nav link | `#materials` | `products.htm` |
| `contact.htm` | "Products" nav link | `Studio Luminant — Architectural Relief Manufacturing.htm#materials` | `products.htm` |
| `process.htm` | "Products" nav link | `Studio Luminant — Architectural Relief Manufacturing.htm#materials` | `products.htm` |
| `gallery.htm` | "Products" nav link | `Studio Luminant — Architectural Relief Manufacturing.htm#materials` | `products.htm` |
| `products.htm` | "Products" nav link (self) | — | `products.htm` (self-link, no change needed) |

---

## Shared Boilerplate

Same as all other new pages. All design tokens including `--border: rgba(201,168,76,0.18)` are defined in the shared `:root` block and do NOT need to be redefined. `.section-inner` (max-width 1280px, margin auto, padding 0 60px) is also shared boilerplate — copy verbatim from other pages.

- Head: charset, viewport, fonts link (`Studio Luminant — Architectural Relief Manufacturing_files/css2.css`)
- CSS: `:root` (includes `--border: rgba(201,168,76,0.18)` and all other tokens), reset, cursor, noise texture, nav, `section`/`.section-inner`/`.eyebrow`/`.btn-primary`, footer, `.reveal`, `.coord-tag`, responsive
- Nav HTML: logo → `Studio Luminant — Architectural Relief Manufacturing.htm`, Products → `products.htm`, Process → `process.htm`, Gallery → `gallery.htm`, Contact → `contact.htm`, CTA → `contact.htm`
- Footer: verbatim from other pages
- JS: cursor + nav scroll + reveal observer

---

## CSS — New Components

```css
/* Product section */
.product-section { padding: 0 0 100px; }
.product-full-img { width: 100%; max-height: 560px; object-fit: cover; display: block; }

/* Product content grid (image + 2-col below) */
.product-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 100px;
  padding: 80px 0 0;
  align-items: start;
}

/* Specs grid */
.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}
.spec-cell {
  background: var(--surface);
  padding: 28px 32px;
  border: 1px solid var(--border);
}
.spec-label {
  font-size: 9px; letter-spacing: 0.28em;
  text-transform: uppercase; color: var(--gold);
  margin-bottom: 8px; font-weight: 400;
}
.spec-value {
  font-family: 'Cormorant Garamond', serif;
  font-size: 20px; font-weight: 300;
  color: var(--text-primary);
}

/* Use cases */
.use-cases {
  display: flex; flex-wrap: wrap; gap: 2px;
  margin-top: 60px; padding-top: 60px;
  border-top: 1px solid var(--border);
}
.use-case-tag {
  font-size: 10px; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: 12px 24px;
}

/* CTA strip — page-scoped, include in products.htm <style> block */
.cta-headline {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(44px, 4vw, 72px);
  font-weight: 300; line-height: 1.0;
  color: var(--text-primary); margin-bottom: 28px;
}
.cta-headline em { font-style: italic; color: var(--gold); }
.cta-sub {
  font-size: 14px; line-height: 1.85;
  color: var(--text-secondary); font-weight: 300;
  max-width: 520px; margin: 0 auto 48px;
}

/* Responsive — add these two rules INSIDE the single @media (max-width: 1024px)
   block. Do NOT create a second @media block. */
@media (max-width: 1024px) {
  .product-content { grid-template-columns: 1fr; gap: 60px; }
  .product-full-img { max-height: 320px; }
}
```

---

## Out of Scope
- Acoustic Profiles section (excluded by user)
- Downloadable data sheets / PDFs
- Price lists or lead times
- Any backend or form processing

---

## Verification
- Open `http://localhost:3000/products.htm`
- PMAG section visible with specs grid and use case tags
- PUCOMP section visible with correct specs and 5 use case tags
- All nav links navigate to correct pages from products page
- CTA links to `contact.htm`
- Responsive: stacks to single column at 1024px viewport width (consistent with all other pages)
