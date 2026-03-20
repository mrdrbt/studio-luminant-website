# Products Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `products.htm` — a dedicated page with deep-dive sections for Lumina PMAG™ and Lumina PUCOMP™ — and update nav links across all existing pages.

**Architecture:** Single static HTML file following the exact boilerplate pattern of `contact.htm`, `process.htm`, and `gallery.htm`. No build tools, no new dependencies. Verification is done via the running preview server on port 3000 using DOM inspection.

**Tech Stack:** Static HTML/CSS — write `products.htm` directly, edit 4 existing `.htm` files for nav links.

---

## File Map

| File | Action |
|------|--------|
| `products.htm` | Create — full page |
| `Studio Luminant — Architectural Relief Manufacturing.htm` | Modify — 1 nav href change |
| `contact.htm` | Modify — 1 nav href change |
| `process.htm` | Modify — 1 nav href change |
| `gallery.htm` | Modify — 1 nav href change |

---

## Chunk 1: Create `products.htm`

### Task 1: Write `products.htm`

**File:** Create `products.htm` in the project root (`C:\Users\burak\Desktop\SL COWORK\06 — Website\Studio Luminant Website\products.htm`)

- [ ] **Step 1: Create `products.htm` with the full page content**

Write the complete file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Products — Studio Luminant</title>
<link rel="preconnect" href="https://fonts.googleapis.com/">
<link rel="preconnect" href="https://fonts.gstatic.com/" crossorigin="">
<link href="Studio%20Luminant%20%E2%80%94%20Architectural%20Relief%20Manufacturing_files/css2.css" rel="stylesheet">

<style>
  :root {
    --gold: #C9A84C;
    --gold-light: #E8C96A;
    --gold-dim: #8A6E2F;
    --obsidian: #0C0C0E;
    --deep: #111114;
    --surface: #18181D;
    --surface-2: #1F1F26;
    --border: rgba(201,168,76,0.18);
    --text-primary: #F0EAD6;
    --text-secondary: #9A9088;
    --text-muted: #5A5450;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: var(--obsidian);
    color: var(--text-primary);
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    overflow-x: hidden;
    cursor: none;
  }

  /* ─── CUSTOM CURSOR ─────────────────── */
  .cursor-dot {
    width: 6px; height: 6px;
    background: var(--gold); border-radius: 50%;
    position: fixed; top: 0; left: 0;
    pointer-events: none; z-index: 9999;
    transform: translate(-50%,-50%);
    transition: transform 0.08s ease;
  }
  .cursor-ring {
    width: 32px; height: 32px;
    border: 1px solid rgba(201,168,76,0.5);
    border-radius: 50%;
    position: fixed; top: 0; left: 0;
    pointer-events: none; z-index: 9998;
    transform: translate(-50%,-50%);
    transition: transform 0.18s ease, width 0.25s ease, height 0.25s ease, opacity 0.25s ease;
  }
  .cursor-ring.hover { width: 56px; height: 56px; opacity: 0.6; }

  /* ─── NOISE TEXTURE ─────────────────── */
  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 1; opacity: 0.4;
  }

  /* ─── NAV ───────────────────────────── */
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: space-between;
    padding: 28px 60px;
    border-bottom: 1px solid transparent;
    transition: all 0.4s ease;
  }
  nav.scrolled {
    background: rgba(12,12,14,0.9);
    backdrop-filter: blur(12px);
    border-color: var(--border);
    padding: 18px 60px;
  }
  .nav-logo { display: flex; align-items: center; text-decoration: none; flex-shrink: 0; }
  .nav-logo-img { height: 44px; width: auto; display: block; transition: opacity 0.3s ease, height 0.4s ease; }
  .nav-logo:hover .nav-logo-img { opacity: 0.8; }
  nav.scrolled .nav-logo-img { height: 34px; }
  .nav-links { display: flex; align-items: center; gap: 48px; list-style: none; }
  .nav-links a {
    font-family: 'Jost', sans-serif;
    font-size: 11px; font-weight: 400; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--text-secondary);
    text-decoration: none; transition: color 0.3s;
  }
  .nav-links a:hover { color: var(--gold); }
  .nav-cta {
    font-family: 'Jost', sans-serif;
    font-size: 11px; font-weight: 400; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--obsidian);
    background: var(--gold); padding: 10px 24px;
    text-decoration: none; transition: background 0.3s;
  }
  .nav-cta:hover { background: var(--gold-light); }

  /* ─── SECTION BASE ──────────────────── */
  section { position: relative; z-index: 2; }
  .section-inner { max-width: 1280px; margin: 0 auto; padding: 0 60px; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 14px;
    font-size: 10px; letter-spacing: 0.3em;
    text-transform: uppercase; color: var(--gold);
    font-weight: 400; margin-bottom: 32px;
  }
  .eyebrow::before { content: ''; width: 24px; height: 1px; background: var(--gold); }
  .btn-primary {
    display: inline-flex; align-items: center; gap: 12px;
    font-family: 'Jost', sans-serif;
    font-size: 11px; font-weight: 400;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--obsidian); background: var(--gold);
    padding: 14px 32px; text-decoration: none;
    transition: background 0.3s, gap 0.3s;
  }
  .btn-primary:hover { background: var(--gold-light); gap: 20px; }
  .btn-primary svg { width: 14px; height: 14px; }

  /* ─── PAGE HERO ─────────────────────── */
  #page-hero {
    min-height: 100vh;
    background-image: url('images/studio-luminant-lumina-pmag-gypsum-relief-panel-hero-hd.jpg');
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    align-items: flex-end;
  }
  #page-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(
      160deg,
      rgba(12,12,14,0.88) 0%,
      rgba(12,12,14,0.60) 50%,
      rgba(12,12,14,0.30) 100%
    );
    z-index: 1; pointer-events: none;
  }
  .page-hero-content {
    position: relative; z-index: 2;
    padding: 160px 60px 100px;
    max-width: 800px;
  }
  .page-hero-eyebrow {
    display: inline-flex; align-items: center; gap: 16px;
    margin-bottom: 40px;
    opacity: 0; animation: fadeUp 0.8s ease 0.3s forwards;
  }
  .page-hero-eyebrow::before {
    content: ''; display: block; width: 32px; height: 1px; background: var(--gold);
  }
  .page-hero-eyebrow span {
    font-size: 10px; letter-spacing: 0.3em;
    text-transform: uppercase; color: var(--gold); font-weight: 400;
  }
  .page-hero-headline {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(68px, 7vw, 110px);
    font-weight: 300; line-height: 0.92;
    letter-spacing: -0.02em; color: var(--text-primary);
    margin-bottom: 36px;
    opacity: 0; animation: fadeUp 0.9s ease 0.5s forwards;
  }
  .page-hero-headline em { font-style: italic; color: var(--gold); }
  .page-hero-sub {
    font-size: 14px; font-weight: 300;
    line-height: 1.75; color: var(--text-secondary);
    max-width: 520px;
    opacity: 0; animation: fadeUp 0.9s ease 0.7s forwards;
  }

  /* ─── PRODUCT SECTIONS ──────────────── */
  .product-section { padding: 0 0 100px; }
  .product-full-img { width: 100%; max-height: 560px; object-fit: cover; display: block; }

  .product-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 100px;
    padding: 80px 0 0;
    align-items: start;
  }

  .product-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(32px, 3vw, 42px);
    font-weight: 300; line-height: 1.05;
    color: var(--text-primary); margin-bottom: 32px;
  }
  .product-name em { font-style: italic; color: var(--gold); }

  .product-desc {
    font-size: 14px; line-height: 1.85;
    color: var(--text-secondary); font-weight: 300;
    margin-bottom: 20px;
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

  /* ─── CTA STRIP ─────────────────────── */
  #products-cta {
    padding: 120px 0;
    background: var(--deep);
    border-top: 1px solid var(--border);
    text-align: center;
  }
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

  /* ─── FOOTER ────────────────────────── */
  footer {
    background: var(--deep);
    border-top: 1px solid var(--border);
    padding: 100px 0 48px;
  }
  .footer-inner { max-width: 1280px; margin: 0 auto; padding: 0 60px; }
  .footer-top {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 80px; margin-bottom: 80px;
  }
  .footer-brand .logo {
    font-size: 16px; letter-spacing: 0.24em;
    color: var(--text-primary); text-transform: uppercase;
    text-decoration: none; display: block; margin-bottom: 20px;
  }
  .footer-tagline { font-size: 12px; line-height: 1.75; color: var(--text-muted); font-weight: 300; max-width: 280px; }
  .footer-col-title { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--gold); margin-bottom: 24px; }
  .footer-location-eyebrow { font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 8px; }
  .footer-location-name { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 300; color: var(--text-primary); margin-bottom: 8px; }
  .footer-location-note { font-size: 11px; color: var(--text-muted); font-weight: 300; }
  .footer-cta-block a {
    display: inline-flex; align-items: center; gap: 12px;
    font-family: 'Jost', sans-serif; font-size: 11px; font-weight: 400;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--obsidian); background: var(--gold);
    padding: 14px 28px; text-decoration: none; transition: background 0.3s;
  }
  .footer-cta-block a:hover { background: var(--gold-light); }
  .footer-cta-block p { font-size: 11px; color: var(--text-muted); margin-top: 14px; font-weight: 300; }
  .footer-bottom {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 32px; border-top: 1px solid var(--border);
  }
  .footer-copy { font-size: 11px; color: var(--text-muted); font-weight: 300; }
  .footer-links { display: flex; gap: 32px; list-style: none; }
  .footer-links a { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); text-decoration: none; transition: color 0.3s; }
  .footer-links a:hover { color: var(--gold); }
  .footer-logo-img { height: 52px; width: auto; display: block; margin-bottom: 16px; opacity: 0.9; }

  /* ─── SCROLL REVEAL ─────────────────── */
  .reveal { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease, transform 0.8s ease; }
  .reveal.visible { opacity: 1; transform: translateY(0); }

  /* ─── ANIMATIONS ────────────────────── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ─── FLOATING COORD ────────────────── */
  .coord-tag {
    position: fixed; bottom: 32px; left: 60px;
    font-size: 9px; letter-spacing: 0.2em;
    color: var(--text-muted); text-transform: uppercase; z-index: 100;
  }

  /* ─── RESPONSIVE ────────────────────── */
  @media (max-width: 1024px) {
    nav { padding: 20px 32px; }
    nav.scrolled { padding: 16px 32px; }
    .nav-links { display: none; }
    .coord-tag { display: none; }
    .section-inner { padding: 0 32px; }
    .page-hero-content { padding: 140px 32px 80px; }
    .product-content { grid-template-columns: 1fr; gap: 60px; }
    .product-full-img { max-height: 320px; }
    .footer-top { grid-template-columns: 1fr; gap: 48px; }
    .footer-bottom { flex-direction: column; gap: 20px; text-align: center; }
  }
</style>
</head>
<body>

<div class="cursor-dot" id="cursorDot"></div>
<div class="cursor-ring" id="cursorRing"></div>

<!-- NAV -->
<nav id="mainNav">
  <a href="Studio Luminant — Architectural Relief Manufacturing.htm" class="nav-logo">
    <img src="images/studio-luminant-logo-white-transparent.png" alt="Studio Luminant" class="nav-logo-img">
  </a>
  <ul class="nav-links">
    <li><a href="products.htm">Products</a></li>
    <li><a href="process.htm">Process</a></li>
    <li><a href="gallery.htm">Gallery</a></li>
    <li><a href="contact.htm">Contact</a></li>
  </ul>
  <a href="contact.htm" class="nav-cta">Initiate Project</a>
</nav>

<!-- PAGE HERO -->
<section id="page-hero">
  <div class="page-hero-content">
    <div class="page-hero-eyebrow">
      <span>Material Engineering</span>
    </div>
    <h1 class="page-hero-headline">
      Engineered for<br><em>Permanence.</em>
    </h1>
    <p class="page-hero-sub">
      Two proprietary material systems — formulated for certified performance, bespoke geometry, and permanent installation.
    </p>
  </div>
</section>

<!-- LUMINA PMAG -->
<section id="pmag" class="product-section" style="background: var(--deep); border-top: 1px solid var(--border);">
  <img src="images/studio-luminant-lumina-pmag-gypsum-relief-panel-hd-01.jpg"
       alt="Lumina PMAG polymer modified alpha gypsum relief panel — ceramic-like surface finish"
       class="product-full-img">
  <div class="section-inner">
    <div class="product-content">
      <!-- Left: name + description -->
      <div>
        <div class="eyebrow reveal">Lumina PMAG™</div>
        <h2 class="product-name reveal">
          Polymer Modified<br><em>Alpha Gypsum</em>
        </h2>
        <p class="product-desc reveal">
          Lumina PMAG™ is Studio Luminant's primary interior cladding material — a polymer modified alpha gypsum formulated for high-specification architectural installations. Alpha gypsum delivers a compressive strength significantly above beta-grade alternatives, producing a denser, harder panel with a ceramic-like surface finish.
        </p>
        <p class="product-desc reveal">
          Certified A1 non-combustible, moisture resistant, and available in any RAL or custom colour via automotive-grade 2K coating. Ideal for large-scale interior wall and ceiling installations where fire compliance, surface quality, and dimensional accuracy are non-negotiable.
        </p>
      </div>
      <!-- Right: specs grid -->
      <div class="specs-grid reveal">
        <div class="spec-cell">
          <div class="spec-label">Fire Rating</div>
          <div class="spec-value">A1 Non-Combustible</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Surface</div>
          <div class="spec-value">Ceramic-Like Smooth</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Application</div>
          <div class="spec-value">Interior Walls &amp; Ceilings</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Moisture</div>
          <div class="spec-value">Resistant</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Scale</div>
          <div class="spec-value">Large-Format Panels</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Finish</div>
          <div class="spec-value">Automotive 2K Coating</div>
        </div>
      </div>
    </div>
    <!-- Use cases — sibling of product-content, full-width -->
    <div class="use-cases reveal">
      <span class="use-case-tag">Luxury Hospitality</span>
      <span class="use-case-tag">High-End Residential</span>
      <span class="use-case-tag">Cultural Institutions</span>
    </div>
  </div>
</section>

<!-- LUMINA PUCOMP -->
<section id="pucomp" class="product-section" style="background: var(--obsidian); border-top: 1px solid var(--border);">
  <img src="images/studio-luminant-geometric-pinwheel-relief-wall-cladding-lounge.jpg"
       alt="Lumina PUCOMP polyurethane composite relief panel — complex geometry, exterior rated"
       class="product-full-img">
  <div class="section-inner">
    <div class="product-content">
      <!-- Left: name + description -->
      <div>
        <div class="eyebrow reveal">Lumina PUCOMP™</div>
        <h2 class="product-name reveal">
          Polyurethane<br><em>Composite</em>
        </h2>
        <p class="product-desc reveal">
          Lumina PUCOMP™ is a high-performance polyurethane composite engineered for applications where gypsum is unsuitable — exterior cladding, wet areas, high-impact surfaces, and complex three-dimensional geometries. The formulation delivers exceptional strength-to-weight ratio, enabling intricate panel forms that would be prohibitively heavy in mineral-based materials.
        </p>
        <p class="product-desc reveal">
          UV-stable, weather resistant, and impact rated, PUCOMP panels are finished to the same automotive 2K standard as PMAG — maintaining a consistent aesthetic across both material families regardless of installation context.
        </p>
      </div>
      <!-- Right: specs grid -->
      <div class="specs-grid reveal">
        <div class="spec-cell">
          <div class="spec-label">Weight</div>
          <div class="spec-value">Lightweight</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Application</div>
          <div class="spec-value">Exterior &amp; Wet Areas</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Geometry</div>
          <div class="spec-value">Complex Spatial Forms</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Durability</div>
          <div class="spec-value">Impact Resistant</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Rating</div>
          <div class="spec-value">UV &amp; Weather Resistant</div>
        </div>
        <div class="spec-cell">
          <div class="spec-label">Finish</div>
          <div class="spec-value">Automotive 2K Coating</div>
        </div>
      </div>
    </div>
    <!-- Use cases -->
    <div class="use-cases reveal">
      <span class="use-case-tag">High-Impact Areas</span>
      <span class="use-case-tag">Handles &amp; Fixtures</span>
      <span class="use-case-tag">HVAC Covers</span>
      <span class="use-case-tag">Exterior Facades</span>
      <span class="use-case-tag">Wet Areas</span>
    </div>
  </div>
</section>

<!-- CTA STRIP -->
<section id="products-cta">
  <div class="section-inner">
    <h2 class="cta-headline reveal">
      Ready to Specify<br><em>Your Project?</em>
    </h2>
    <p class="cta-sub reveal">
      Request a material data sheet and BIM file package for your specification.
    </p>
    <a href="contact.htm" class="btn-primary reveal">
      Initiate Project
      <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
      </svg>
    </a>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="Studio Luminant — Architectural Relief Manufacturing.htm" class="logo">
          <img src="images/studio-luminant-logo-white-transparent.png" alt="Studio Luminant" class="footer-logo-img">
        </a>
        <p class="footer-tagline">The premier manufacturing partner for high-level architectural and hospitality spatial design.</p>
      </div>
      <div>
        <div class="footer-col-title">Manufacturing HQ</div>
        <span class="footer-location-eyebrow">Location</span>
        <div class="footer-location-name">Sakarya / Sapanca<br>Türkiye</div>
        <p class="footer-location-note">Global Distribution &amp; Installation Ready</p>
      </div>
      <div class="footer-cta-block">
        <div class="footer-col-title">Start a Project</div>
        <a href="mailto:strategy@studioluminant.com">
          Initiate Project
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
        </a>
        <p>strategy@studioluminant.com</p>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">© 2026 Studio Luminant. All Rights Reserved.</p>
      <ul class="footer-links">
        <li><a href="#">BIM Assets</a></li>
        <li><a href="#">Privacy</a></li>
        <li><a href="#">Compliance</a></li>
      </ul>
    </div>
  </div>
</footer>

<div class="coord-tag">40.7°N — 30.4°E — Sakarya, TR</div>

<script>
  // Cursor
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';
  });

  function animateRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });

  // Nav scroll
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });

  // Scroll reveal
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => { entry.target.classList.add('visible'); }, 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
</script>

</body>
</html>
```

- [ ] **Step 2: Verify `products.htm` in browser**

Navigate to `http://localhost:3000/products.htm` and run:
```javascript
({
  title: document.title,
  heroH1: document.querySelector('h1')?.textContent?.trim().replace(/\n/g,' '),
  sections: Array.from(document.querySelectorAll('section')).map(s => s.id),
  pmag: {
    specCells: document.querySelectorAll('#pmag .spec-cell').length,
    useCaseTags: document.querySelectorAll('#pmag .use-case-tag').length
  },
  pucomp: {
    specCells: document.querySelectorAll('#pucomp .spec-cell').length,
    useCaseTags: document.querySelectorAll('#pucomp .use-case-tag').length
  },
  ctaHref: document.querySelector('#products-cta .btn-primary')?.getAttribute('href'),
  navLinks: Array.from(document.querySelectorAll('.nav-links a')).map(a => ({text: a.textContent.trim(), href: a.getAttribute('href')}))
})
```

Expected output:
```json
{
  "title": "Products — Studio Luminant",
  "heroH1": "Engineered for Permanence.",
  "sections": ["page-hero", "pmag", "pucomp", "products-cta"],
  "pmag": { "specCells": 6, "useCaseTags": 3 },
  "pucomp": { "specCells": 6, "useCaseTags": 5 },
  "ctaHref": "contact.htm",
  "navLinks": [
    { "text": "Products", "href": "products.htm" },
    { "text": "Process", "href": "process.htm" },
    { "text": "Gallery", "href": "gallery.htm" },
    { "text": "Contact", "href": "contact.htm" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\burak\Desktop\SL COWORK\06 — Website\Studio Luminant Website"
git add products.htm
git commit -m "Add products.htm — Lumina PMAG and PUCOMP deep-dive page"
```

---

## Chunk 2: Update Nav Links Across All Pages

### Task 2: Update "Products" nav href in all 4 existing pages

**Files:** Modify 4 existing pages — 1 edit each.

- [ ] **Step 1: Update main page nav**

In `Studio Luminant — Architectural Relief Manufacturing.htm`, find:
```html
<li><a href="#materials">Products</a></li>
```
Replace with:
```html
<li><a href="products.htm">Products</a></li>
```

- [ ] **Step 2: Update contact.htm nav**

In `contact.htm`, find:
```html
<li><a href="Studio Luminant — Architectural Relief Manufacturing.htm#materials">Products</a></li>
```
Replace with:
```html
<li><a href="products.htm">Products</a></li>
```

- [ ] **Step 3: Update process.htm nav**

In `process.htm`, find:
```html
<li><a href="Studio Luminant — Architectural Relief Manufacturing.htm#materials">Products</a></li>
```
Replace with:
```html
<li><a href="products.htm">Products</a></li>
```

- [ ] **Step 4: Update gallery.htm nav**

In `gallery.htm`, find:
```html
<li><a href="Studio Luminant — Architectural Relief Manufacturing.htm#materials">Products</a></li>
```
Replace with:
```html
<li><a href="products.htm">Products</a></li>
```

- [ ] **Step 5: Verify nav links across all pages**

For each page, navigate to it and run:
```javascript
document.querySelector('.nav-links a')?.getAttribute('href')
```
Expected: `"products.htm"` on all four pages.

- [ ] **Step 6: Commit and push**

```bash
cd "C:\Users\burak\Desktop\SL COWORK\06 — Website\Studio Luminant Website"
git add "Studio Luminant — Architectural Relief Manufacturing.htm" contact.htm process.htm gallery.htm
git commit -m "Update Products nav links to products.htm across all pages"
git push
```

---

## Verification Checklist (final)

After all tasks:
- [ ] `http://localhost:3000/products.htm` loads with title "Products — Studio Luminant"
- [ ] Page hero shows background image with "Engineered for Permanence." headline
- [ ] PMAG section shows 6 spec cells and 3 use case tags
- [ ] PUCOMP section shows 6 spec cells and 5 use case tags
- [ ] CTA "Initiate Project" links to `contact.htm`
- [ ] "Products" nav link on all 5 pages points to `products.htm`
- [ ] No broken images, no layout breakage
