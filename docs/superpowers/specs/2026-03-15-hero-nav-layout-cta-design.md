# Studio Luminant Website — Design Fixes Spec
**Date:** 2026-03-15
**Scope:** Four targeted improvements to the existing single-file HTML website

---

## Changes in Scope

### 1. Hero Background Image
- Add a full-viewport (`100vh`) hero section with `studio-luminant-lumina-pmag-gypsum-relief-panel-hero-hd.jpg` as a CSS `background-image`
- Apply a dark gradient overlay (`rgba(12,12,14,0.55)`) over the image to maintain headline legibility
- Existing hero text content ("Customization at Scale", body copy, CTAs) remains in place
- Image covers the full hero area with `background-size: cover; background-position: center`

### 2. Split Layout — Methodology Section
- The "AI-Assisted Architecture / Methodology" section is restructured from single-column to a two-column split
- Left column (55%): section label, heading, body text
- Right column (45%): the existing AIAPM process infographic image, vertically centered
- Layout collapses to single column on mobile (below 768px)

### 3. Navigation Links
- Four anchor links added to the nav bar between the logo and the CTA button:
  - Products → `#products`
  - Process → `#process`
  - Gallery → `#gallery`
  - Contact → `#contact`
- Section IDs added to the corresponding HTML sections where missing
- Nav links styled to match existing nav aesthetic: spaced caps, gold hover state, letter-spacing
- Links hidden on mobile (hamburger menu is out of scope)

### 4. CTA Consolidation
- All secondary CTAs replaced with a single "Initiate Project" action:
  - "Explore Capabilities" button → replaced with ghost-style "Initiate Project" link
  - "View BIM Specifications" text link → removed
  - "Request Consultation" in footer → replaced with "Initiate Project"
- The nav "Initiate Project" button remains unchanged (gold filled style)
- All CTA links point to `mailto:strategy@studioluminant.com` (existing contact mechanism)

---

## Out of Scope
- Mobile hamburger navigation
- Social proof / credential section (separate task)
- Gallery grid restructure
- Product spec section redesign
- Any new pages or routing

---

## Implementation Approach
Surgical edits to the single existing HTML file (`Studio Luminant — Architectural Relief Manufacturing.htm`). No new files required. No build tooling. Changes are directly verifiable in the running preview server on port 3000.

---

## Verification
After implementation, confirm in the preview server:
- Hero image is visible and headline text is legible over it
- Nav shows 4 links + CTA button, links scroll to correct sections
- Methodology section renders as two columns on desktop, single column on mobile
- No instance of "Explore Capabilities", "View BIM Specifications", or "Request Consultation" remains
