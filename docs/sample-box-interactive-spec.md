# Interactive Sample Box — Home Page Section

*Spec date: 2026-05-30 · Status: approved design, pending build*

## Goal
Turn the static finish-sample-box render into an interactive, cinematic section on the
home page where a visitor watches the box "open" on scroll, then explores the four
finishes (FORGE / LOOM / QUARRY / PEWTER) and their properties in an elegant detail panel.

## Placement
- TR home: `Studio Luminant — Özel Mimari Elemanlar.htm` — new `<section id="sample-box">`
  inserted **between `#materials` (ends ~L1216) and `#design-system-teaser` (~L1218)**.
- EN home: `Studio Luminant — Bespoke Architectural Elements.htm` — mirrored at the
  equivalent position with EN copy.
- Products page static `#sample-box-band` (`urunler.htm`) is **left untouched** (possible
  future upgrade, out of scope).

## Approach (chosen: A — lid-lift crossfade + hotspots, with subtle cursor-follow 3D tilt)

The open box tilts gently toward the cursor (CSS `perspective` + `rotateX/Y`, small
amplitude). Disabled on touch devices and under `prefers-reduced-motion`.

1. **Closed state** — gold eyebrow + headline + "scroll to open" cue; closed render shown.
2. **Reveal** — IntersectionObserver (once): closed render translates up ~30px and fades out
   over ~900ms while the open render crossfades in. `prefers-reduced-motion` → jump to open,
   no animation.
3. **Explore** — four numbered gold hotspot dots (gentle pulse) positioned over the wells of
   the open render (percentage coords, calibrated against the live image in preview).
   The open box carries a subtle cursor-follow 3D tilt (off on touch / reduced-motion).
   Selecting a hotspot opens a **side drawer** (desktop, slides from right over dimmed box) /
   **bottom sheet** (mobile) with that finish's detail. One open at a time.
4. **Mobile aid** — below the image, the four finishes also render as a tappable name row;
   tapping a chip or its dot opens the same drawer.
5. **CTA** — section ends with existing "Numune Kutusunu İsteyin / Request the Sample Box"
   → contact page.

## Detail panel content (per finish)
Index, name, eyebrow (relief type), material, finish, description, spec bullets, and
PEWTER's "shown unsealed / sealed option" note. Source of truth = the sample-box cards
(`05 — Sales & Prospects/Sample Box Cards/SL_Sample_Box_Cards.html`). TR copy in the TR
file, EN copy in the EN file.

Finish order & well mapping (2×2 open box):
1. FORGE — Lumina PMAG™ — metallic artisan finish, antique gold (hammered relief)
2. LOOM — Lumina PUCOMP™ — through-body colour (basketweave relief)
3. QUARRY — Lumina PMAG™ natural — clear matte artisan finish (pebble relief)
4. PEWTER — cold-cast tin — unsealed living patina (reed relief) + note

## Assets
Already on site, no new pipeline:
- `images/studio-luminant-finish-sample-box-closed.{jpg,webp}` (+ 800w/1600w)
- `images/studio-luminant-finish-sample-box-open.{jpg,webp}` (+ 800w/1600w)

## Constraints
- Vanilla HTML/CSS/JS, no framework/build. Reuse `.section-inner`, `.eyebrow`, `.reveal`,
  `.btn-primary` and gold/obsidian CSS custom properties from `shared.css`.
- Scoped `<style>` + scoped IIFE `<script>` inside the section; no globals leaked.
- Accessibility: hotspots are real `<button>`s with aria-labels; drawer has role="dialog",
  Esc to close, focus trap, focus returns to the triggering dot on close; arrow keys move
  between finishes.
- Terminology gate: artisan finish (not 2K/PU/polyurethane), PMAG/PUCOMP by name,
  cold-cast tin; **no fire-cert language**. (Card copy already compliant.)

## Verification
- Serve locally, load home page, confirm reveal fires on scroll, hotspots land on the four
  wells (calibrate coords), drawer opens/closes per finish, keyboard + reduced-motion paths,
  mobile layout. Screenshot proof before done.

## Out of scope
- Products-page band upgrade, new nav entry, new image renders, Supabase wiring.
