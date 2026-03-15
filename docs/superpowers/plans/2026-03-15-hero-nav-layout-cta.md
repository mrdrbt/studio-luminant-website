# Studio Luminant — Hero, Nav, Split Layout & CTA Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four targeted improvements to the Studio Luminant website: full-bleed hero background image, process section split layout, updated navigation links, and consolidated CTA.

**Architecture:** All changes are surgical edits to a single static HTML file. No build tools, no new files. Changes are verified visually in the running preview server on port 3000 after each task.

**Tech Stack:** Static HTML/CSS — edit `Studio Luminant — Architectural Relief Manufacturing.htm` directly.

---

## File Map

| File | Change |
|------|--------|
| `Studio Luminant — Architectural Relief Manufacturing.htm` | All four tasks — CSS and HTML edits |

---

## Chunk 1: Hero Background Image + Process Split Layout

### Task 1: Hero Background Image

**File:** `Studio Luminant — Architectural Relief Manufacturing.htm`

The `#hero` section has `min-height: 100vh` and a 2-column grid but no background image. The image `images/studio-luminant-lumina-pmag-gypsum-relief-panel-hero-hd.jpg` exists and should fill the hero behind both columns.

- [ ] **Step 1: Add background-image CSS to `#hero`**

Find the existing `#hero` rule (around line 126):
```css
#hero {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    position: relative;
    overflow: hidden;
}
```
Replace with:
```css
#hero {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 1fr;
    position: relative;
    overflow: hidden;
    background-image: url('images/studio-luminant-lumina-pmag-gypsum-relief-panel-hero-hd.jpg');
    background-size: cover;
    background-position: center;
}
```

- [ ] **Step 2: Add dark overlay via `#hero::before`**

The existing `#hero::after` is a decorative 1px vertical divider — leave it alone. Add a new `#hero::before` rule for the dark gradient tint. Insert it immediately after the `#hero` rule:

```css
#hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        105deg,
        rgba(12,12,14,0.82) 0%,
        rgba(12,12,14,0.55) 50%,
        rgba(12,12,14,0.35) 100%
    );
    z-index: 1;
    pointer-events: none;
}
```

Then update the existing `.hero-right` rule to add `z-index: 2` so its content sits above the overlay:

Find:
```css
.hero-right {
    position: relative; overflow: hidden;
}
```
Replace with:
```css
.hero-right {
    position: relative; overflow: hidden;
    z-index: 2;
}
```

Note: `.hero-left` already has `z-index: 2` (line 137) — no change needed there.

- [ ] **Step 3: Verify in preview**

Reload `http://localhost:3000/Studio%20Luminant%20%E2%80%94%20Architectural%20Relief%20Manufacturing.htm`

Expected:
- Hero section shows product photo as full-bleed background
- "Customization at Scale" headline is legible over the image
- Dark gradient tint is visible (darker on left, lighter toward right)
- No broken layout

---

### Task 2: Process Section Split Layout

**File:** `Studio Luminant — Architectural Relief Manufacturing.htm`

The `.process-header` already has a 2-column CSS grid (headline left, description right). Currently the right column only has a text description. Add the AIAPM infographic image to the right column alongside the description to make the split visually impactful.

- [ ] **Step 1: Replace the `<p class="process-header-desc">` element** (around line 991)

Match on the opening tag only to avoid line-break mismatch. Find this exact string:
```
<p class="process-header-desc reveal">
```
Replace the entire `<p>...</p>` block (ends a few lines later with `</p>`) with:
```html
<div class="process-header-right reveal">
    <p class="process-header-desc">
      A fully integrated pipeline — from algorithm to installation — engineered to compress timelines and eliminate specification risk for large-scale architectural projects.
    </p>
    <img src="images/studio-luminant-aiapm-production-process-design-modelling-casting-infographic.png"
         alt="Studio Luminant AIAPM production process — design, modelling, molding, casting, finishing"
         class="process-header-img">
</div>
```

- [ ] **Step 2: Add CSS for `.process-header-right` and `.process-header-img`**

Add after the existing `.process-header-desc` rule. The `.process-header-desc` currently has `align-self: end` which targeted the grid context — that property is now irrelevant inside the flex column of `.process-header-right`, so it's harmless but can be left as-is.

```css
.process-header-right {
    display: flex;
    flex-direction: column;
    gap: 40px;
    align-self: end;
}

.process-header-img {
    width: 100%;
    max-height: 280px;
    object-fit: cover;
    display: block;
    border: 1px solid var(--border);
}
```

The `max-height` on the image prevents it from growing too tall at wide viewports. On mobile (below 1024px), the existing rule `grid-template-columns: 1fr` on `.process-header` already stacks everything — no additional responsive CSS needed.

- [ ] **Step 3: Verify in preview**

Expected:
- "AI-Assisted Architecture" section shows headline left, description + infographic image right
- Image is visible and contained within the right column
- No overflow or broken layout
- On narrow viewports (below 1024px) it stacks vertically (existing responsive rule handles this)

---

## Chunk 2: Navigation + CTA Consolidation

### Task 3: Navigation Links Update

**File:** `Studio Luminant — Architectural Relief Manufacturing.htm`

The nav currently has 3 links (Strategy, Technology, Materials). Update to 4 links matching the spec: Products, Process, Gallery, Contact.

- [ ] **Step 1: Update nav HTML** (around line 880)

Find:
```html
<ul class="nav-links">
    <li><a href="#strategy">Strategy</a></li>
    <li><a href="#process">Technology</a></li>
    <li><a href="#materials">Materials</a></li>
</ul>
```

Replace with:
```html
<ul class="nav-links">
    <li><a href="#materials">Products</a></li>
    <li><a href="#process">Process</a></li>
    <li><a href="#portfolio">Gallery</a></li>
    <li><a href="mailto:strategy@studioluminant.com">Contact</a></li>
</ul>
```

Note: `#portfolio` already exists as a section ID. `#materials` and `#process` already exist.

- [ ] **Step 2: Verify in preview**

Expected:
- Nav shows: Products · Process · Gallery · Contact · [Initiate Project button]
- Clicking Products scrolls to the materials section
- Clicking Process scrolls to the process/methodology section
- Clicking Gallery scrolls to the portfolio grid
- Clicking Contact opens email client

---

### Task 4: CTA Consolidation

**File:** `Studio Luminant — Architectural Relief Manufacturing.htm`

Three CTA changes:
1. Hero "Explore Capabilities" primary button → "Initiate Project"
2. Hero "View BIM Specifications" ghost link → remove entirely
3. Footer "Request Consultation" → "Initiate Project"

- [ ] **Step 1: Update hero primary CTA** (around line 904)

Find:
```html
<a href="#process" class="btn-primary">
    Explore Capabilities
    <svg ...>...</svg>
</a>
```

Replace `href="#process"` with `href="mailto:strategy@studioluminant.com"` and change the text to `Initiate Project`:
```html
<a href="mailto:strategy@studioluminant.com" class="btn-primary">
    Initiate Project
    <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
    </svg>
</a>
```

- [ ] **Step 2: Remove hero ghost CTA** (around line 910)

Find and delete this entire element:
```html
<a href="#materials" class="btn-ghost">View BIM Specifications</a>
```

- [ ] **Step 3: Update footer CTA** (around line 1178)

Find:
```html
<a href="mailto:strategy@studioluminant.com">
    Request Consultation
    <svg ...>...</svg>
</a>
```

Replace inner text only:
```html
<a href="mailto:strategy@studioluminant.com">
    Initiate Project
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
    </svg>
</a>
```

- [ ] **Step 4: Verify in preview — full page check**

Expected:
- Hero has single gold "Initiate Project" button, no second ghost link
- Nav has "Initiate Project" gold button (unchanged)
- Footer CTA reads "Initiate Project"
- No instance of "Explore Capabilities", "View BIM Specifications", or "Request Consultation" anywhere on the page
- All "Initiate Project" links open the email client

---

## Verification Checklist (final)

After all tasks:
- [ ] Hero shows `studio-luminant-lumina-pmag-gypsum-relief-panel-hero-hd.jpg` as full-bleed background
- [ ] Headline "Customization at Scale" is legible over the hero image
- [ ] Process section header has infographic image visible in the right column
- [ ] Nav shows: Products · Process · Gallery · Contact · Initiate Project
- [ ] All four nav links scroll/navigate to the correct targets
- [ ] Zero instances of "Explore Capabilities", "View BIM Specifications", "Request Consultation" remain
- [ ] All "Initiate Project" CTAs open `mailto:strategy@studioluminant.com`
- [ ] No broken layouts or missing images in the preview
