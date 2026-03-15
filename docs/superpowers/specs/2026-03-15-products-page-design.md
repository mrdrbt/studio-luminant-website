# Studio Luminant — Products Page Design Spec
**Date:** 2026-03-15
**Scope:** Dedicated `products.htm` page — deep-dive on Lumina PMAG™ and Lumina PUCOMP™

---

## Overview

A single static HTML page (`products.htm`) following the same boilerplate pattern as `contact.htm`, `process.htm`, and `gallery.htm`. Two core material systems each get a full section with image, specs, and use cases. No build tools — surgical additions to the multi-page static site.

---

## Page Structure

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

- **Use Cases row** (below 2-col, full-width): horizontal flex row of `.use-case-tag` elements:
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

- **Use Cases row:**
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

Update `products.htm` nav link in main page from `#materials` to `products.htm`:

| Element | From | To |
|---------|------|----|
| "Products" nav link (main page) | `#materials` | `products.htm` |
| "Products" nav link (contact, process, gallery pages) | `Studio Luminant — Architectural Relief Manufacturing.htm#materials` | `products.htm` |

---

## Shared Boilerplate

Same as all other new pages:
- Head: charset, viewport, fonts link
- CSS: `:root`, reset, cursor, noise texture, nav, section base, footer, reveal, coord-tag, responsive
- Nav HTML: logo → `Studio Luminant — Architectural Relief Manufacturing.htm`, links to all 4 pages, CTA → `contact.htm`
- Footer: verbatim from other pages
- JS: cursor + nav scroll + reveal observer

---

## CSS — New Components

```css
/* Product section */
.product-section { padding: 0 0 100px; }
.product-full-img { width: 100%; max-height: 560px; object-fit: cover; display: block; }

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
```

---

## Responsive
- Below 1024px: 2-col product grid stacks to 1-col, nav-links hidden
- `product-full-img` max-height reduced to 320px on mobile

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
- Responsive: stacks to single column at 900px viewport width
