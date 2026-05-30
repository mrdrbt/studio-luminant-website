# Overlay Primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `SLModal` (image + content modes) and `SLDrawer` (right-sliding spec panel) to the SL design system, and replace the existing collection-page lightbox with `SLModal`.

**Architecture:** Native `<dialog>` for the modal (browser provides focus trap, ESC, ARIA role, `::backdrop`). CSS-animated `<aside>` for the drawer with a ~15-line manual focus trap. Both HTML shells are injected into `<body>` by `shared.js` on `DOMContentLoaded`; content is swapped in at open time. Collection lightbox refactored to call `SLModal.open()`.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step. Dev server: `python -m http.server 3000` from `06 — Website/Studio Luminant Website/`.

---

## File Map

| File | What changes |
|------|-------------|
| `shared.css` | Add `.sl-modal`, `::backdrop`, drawer, shared close button CSS |
| `shared.js` | Append HTML shells on DOMContentLoaded; add `SLModal` and `SLDrawer` IIFEs |
| `koleksiyon.htm` | Remove old lightbox markup + CSS; rewrite `openLightbox()` to call `SLModal.open()` |
| `en/collection.htm` | Same as koleksiyon.htm |

---

## Task 1: Modal CSS — base, backdrop, layout modes

**Files:**
- Modify: `shared.css` (append after the `.sl-field` block at line 651)

- [ ] **Step 1: Append the modal CSS block to shared.css**

Add this entire block at the end of `shared.css`:

```css
/* ══════════════════════════════════════
   OVERLAY — sl-modal (native <dialog>)
   ══════════════════════════════════════ */

.sl-modal {
  /* Reset browser dialog defaults */
  border: 1px solid var(--border);
  padding: 0;
  background: var(--surface);
  box-shadow: var(--shadow-2);
  color: var(--fg);
  /* Centred via auto margins (modern browsers honour this for dialog) */
  margin: auto;
  max-width: 100vw;
  max-height: 100vh;
  overflow: visible;
  /* Positioning context for .sl-overlay-close */
  position: relative;
  /* Enter animation */
  animation: sl-modal-enter var(--dur-2) var(--ease-out) both;
}

.sl-modal-body {
  /* Positioning context for .lb-nav buttons in lightbox mode */
  position: relative;
}

@keyframes sl-modal-enter {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.sl-modal::backdrop {
  background: rgba(12,12,14,0.88);
  backdrop-filter: blur(4px);
  /* ::backdrop cannot inherit --dur vars, so hardcode matches --dur-2 */
  animation: sl-backdrop-enter 240ms var(--ease-out) both;
}

@keyframes sl-backdrop-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Image mode ──────────────────────── */
.sl-modal[data-mode="image"] {
  background: transparent;
  border: 0;
  box-shadow: none;
  /* Size driven by content */
}
.sl-modal[data-mode="image"] .sl-modal-body {
  width: min(90vw, 1200px);
  height: min(90vh, 800px);
  display: flex;
  flex-direction: column;
  position: relative;
}
.sl-modal[data-mode="image"] img {
  flex: 1;
  width: 100%; height: 100%;
  object-fit: contain;
  display: block;
}
.sl-modal[data-mode="image"] .sl-overlay-close {
  position: absolute;
  top: var(--s-2); right: var(--s-2);
  background: rgba(12,12,14,0.7);
}

/* ── Content mode ────────────────────── */
.sl-modal[data-mode="content"] {
  width: min(680px, 90vw);
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── Lightbox mode (collection — image + detail panel) ── */
.sl-modal[data-mode="lightbox"] {
  width: min(1100px, 96vw);
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sl-modal[data-mode="lightbox"] .sl-modal-body {
  flex: 1;
  overflow: hidden;
  min-height: 0; /* required for flex children to scroll correctly */
}
```

- [ ] **Step 2: Start the dev server and verify the CSS parses without errors**

```bash
cd "06 — Website/Studio Luminant Website" && python -m http.server 3000
```

Open http://localhost:3000 in browser. Open DevTools → Console. Confirm no CSS errors. DevTools → Elements: confirm `.sl-modal` rule exists in the stylesheet.

- [ ] **Step 3: Commit**

```bash
git add "06 — Website/Studio Luminant Website/shared.css"
git commit -m "feat(ds): add sl-modal CSS — base, backdrop, image/content/lightbox modes"
```

---

## Task 2: Drawer + Shared Close Button CSS

**Files:**
- Modify: `shared.css` (append after Task 1 block)

- [ ] **Step 1: Append drawer CSS and shared close button to shared.css**

```css
/* ══════════════════════════════════════
   OVERLAY — sl-drawer (<aside>)
   ══════════════════════════════════════ */

.sl-drawer-backdrop {
  position: fixed; inset: 0;
  background: rgba(12,12,14,0.60);
  z-index: var(--z-overlay);
  opacity: 0; pointer-events: none;
  transition: opacity var(--dur-2) var(--ease-out);
}
.sl-drawer-backdrop.is-open {
  opacity: 1; pointer-events: auto;
}

.sl-drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(480px, 90vw);
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: -24px 0 60px -20px rgba(0,0,0,0.7);
  z-index: var(--z-overlay-surface);
  display: flex; flex-direction: column;
  transform: translateX(100%);
  transition: transform var(--dur-3) var(--ease-out);
  overflow-y: auto;
}
.sl-drawer.is-open {
  transform: translateX(0);
}

.sl-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--s-6) var(--s-5);
}

/* ══════════════════════════════════════
   OVERLAY — shared close button
   ══════════════════════════════════════ */

.sl-overlay-close {
  position: absolute; top: var(--s-4); right: var(--s-4);
  width: 32px; height: 32px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg-2);
  font-size: var(--t-label);
  letter-spacing: var(--tr-wider);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color var(--dur-1) var(--ease),
              color       var(--dur-1) var(--ease);
  flex-shrink: 0;
}
.sl-overlay-close:hover {
  border-color: var(--gold);
  color: var(--gold);
}
```

- [ ] **Step 2: Verify in DevTools**

DevTools → Elements. Confirm `.sl-drawer`, `.sl-drawer-backdrop`, `.sl-overlay-close` rules exist. No console errors.

- [ ] **Step 3: Commit**

```bash
git add "06 — Website/Studio Luminant Website/shared.css"
git commit -m "feat(ds): add sl-drawer and sl-overlay-close CSS"
```

---

## Task 3: HTML Shell Injection + SLModal JS

**Files:**
- Modify: `shared.js` (append at end of file)

- [ ] **Step 1: Append the overlay shell injector and SLModal to shared.js**

Add this entire block at the end of `shared.js`:

```js
// ─── OVERLAY SHELLS ─────────────────────────────────────────────────────────
// Inject <dialog> and <aside> shells once into <body>.
// Pages never include this markup — SLModal / SLDrawer manage it.
document.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('.sl-modal')) {
    const dlg = document.createElement('dialog');
    dlg.className = 'sl-modal';
    dlg.setAttribute('aria-label', '');
    dlg.innerHTML =
      '<button class="sl-overlay-close" aria-label="Kapat">✕</button>' +
      '<div class="sl-modal-body"></div>';
    document.body.appendChild(dlg);
  }

  if (!document.querySelector('.sl-drawer')) {
    const bd = document.createElement('div');
    bd.className = 'sl-drawer-backdrop';
    bd.setAttribute('aria-hidden', 'true');

    const aside = document.createElement('aside');
    aside.className = 'sl-drawer';
    aside.setAttribute('aria-label', '');
    aside.setAttribute('aria-hidden', 'true');
    aside.innerHTML =
      '<button class="sl-overlay-close" aria-label="Kapat">✕</button>' +
      '<div class="sl-drawer-body"></div>';

    document.body.appendChild(bd);
    document.body.appendChild(aside);
  }
});

// ─── SLModal ─────────────────────────────────────────────────────────────────
// SLModal.open({ mode, src, alt, title, el, html })
//   mode   : 'image' | 'content' | 'lightbox'  (default: 'content')
//   image  : src + alt
//   content: el (DOM node) OR html (string)
//   lightbox: html (string) — collection two-panel layout
//   title  : aria-label for content/lightbox modes
// SLModal.close()
const SLModal = (() => {
  let dialog, body, _trigger;

  function _init() {
    dialog = document.querySelector('.sl-modal');
    body   = dialog.querySelector('.sl-modal-body');
    // Backdrop click (click on dialog itself, not its children)
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    dialog.querySelector('.sl-overlay-close').addEventListener('click', close);
  }

  function open({ mode = 'content', src, alt, title, el, html } = {}) {
    if (!dialog) _init();
    // Only capture trigger on first open — not on navigation re-opens
    if (!dialog.open) _trigger = document.activeElement;
    dialog.dataset.mode = mode;
    dialog.setAttribute('aria-label',
      mode === 'image' ? (alt || '') : (title || ''));
    body.innerHTML = '';
    if (mode === 'image') {
      const img = document.createElement('img');
      img.src = src; img.alt = alt || '';
      body.appendChild(img);
    } else if (typeof html === 'string') {
      body.innerHTML = html;
    } else if (el) {
      body.appendChild(el.cloneNode(true));
    }
    document.body.style.overflow    = 'hidden';
    document.body.style.touchAction = 'none';
    // Guard: showModal() throws InvalidStateError if dialog is already open
    if (!dialog.open) dialog.showModal();
  }

  function close() {
    if (!dialog) return;
    dialog.close();
    document.body.style.overflow    = '';
    document.body.style.touchAction = '';
    _trigger?.focus();
  }

  return { open, close };
})();
```

- [ ] **Step 2: Open the browser console and verify the shells and SLModal**

Open http://localhost:3000. Open DevTools → Console and run:

```js
// Shells exist
document.querySelector('.sl-modal')   // should return <dialog class="sl-modal">
document.querySelector('.sl-drawer')  // should return <aside class="sl-drawer">

// Open modal in content mode
const div = document.createElement('div');
div.innerHTML = '<p style="padding:32px;color:#F0EAD6">Hello overlay</p>';
SLModal.open({ mode: 'content', title: 'Test', el: div });
// Modal should appear centred with obsidian backdrop. ESC should close it.

// Open modal in image mode
SLModal.open({ mode: 'image', src: 'images/og-image.jpg', alt: 'Test image' });
// Full-bleed image with blurred backdrop.
```

Expected: modal appears, ESC closes it, focus returns to previously focused element (e.g. `<body>`).

- [ ] **Step 3: Commit**

```bash
git add "06 — Website/Studio Luminant Website/shared.js"
git commit -m "feat(ds): inject overlay shells and add SLModal IIFE"
```

---

## Task 4: SLDrawer JS

**Files:**
- Modify: `shared.js` (append after SLModal block)

- [ ] **Step 1: Append SLDrawer to shared.js**

```js
// ─── SLDrawer ────────────────────────────────────────────────────────────────
// SLDrawer.open({ el, html, label })
//   el    : DOM node to inject (cloned)
//   html  : HTML string alternative to el
//   label : aria-label for the <aside> (default: 'Panel')
// SLDrawer.close()
const SLDrawer = (() => {
  let aside, backdrop, body, _trap, _trigger;

  function _init() {
    aside    = document.querySelector('.sl-drawer');
    backdrop = document.querySelector('.sl-drawer-backdrop');
    body     = aside.querySelector('.sl-drawer-body');
    backdrop.addEventListener('click', close);
    aside.querySelector('.sl-overlay-close').addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && aside.classList.contains('is-open')) close();
    });
  }

  function _makeTrap(el) {
    const sel = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"]),input,select,textarea';
    return e => {
      if (e.key !== 'Tab') return;
      const nodes = [...el.querySelectorAll(sel)];
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
  }

  function open({ el, html, label = 'Panel' } = {}) {
    if (!aside) _init();
    _trigger = document.activeElement;
    body.innerHTML = '';
    if (typeof html === 'string') {
      body.innerHTML = html;
    } else if (el) {
      body.appendChild(el.cloneNode(true));
    }
    aside.setAttribute('aria-label', label);
    aside.setAttribute('aria-hidden', 'false');
    document.body.style.overflow    = 'hidden';
    document.body.style.touchAction = 'none';
    aside.classList.add('is-open');
    backdrop.classList.add('is-open');
    aside.querySelector('.sl-overlay-close').focus();
    _trap = _makeTrap(aside);
    document.addEventListener('keydown', _trap);
  }

  function close() {
    if (!aside) return;
    aside.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    aside.setAttribute('aria-hidden', 'true');
    document.body.style.overflow    = '';
    document.body.style.touchAction = '';
    document.removeEventListener('keydown', _trap);
    _trigger?.focus();
  }

  return { open, close };
})();
```

- [ ] **Step 2: Verify SLDrawer in the console**

```js
// Open drawer with HTML string
SLDrawer.open({
  html: '<h2 style="font-family:var(--font-display);font-size:28px;font-weight:300;color:#F0EAD6;margin-bottom:16px">Compass Star</h2>' +
        '<p style="font-size:14px;color:#B0A89E;font-weight:300">Malzeme: Lumina PMAG™</p>',
  label: 'Teknik Özellikler'
});
// Drawer should slide in from the right. Backdrop fades in.
// ESC should close. Tab should stay trapped inside the drawer.
// Click backdrop should close.
```

- [ ] **Step 3: Commit**

```bash
git add "06 — Website/Studio Luminant Website/shared.js"
git commit -m "feat(ds): add SLDrawer IIFE with manual focus trap"
```

---

## Task 5: Refactor koleksiyon.htm Lightbox

The existing lightbox is a two-panel layout (image left, details right) with prev/next navigation. We replace the `<div class="lightbox-overlay">` with `SLModal` in `lightbox` mode, keeping the collection's navigation logic.

**Files:**
- Modify: `koleksiyon.htm`

- [ ] **Step 1: Remove the old lightbox markup from koleksiyon.htm**

Find and delete this entire block (lines 463–482):

```html
<!-- LIGHTBOX -->
<div class="lightbox-overlay" id="lightbox" role="dialog" aria-modal="true" aria-label="Desen detayı">
  <button class="lb-nav lb-prev" id="lb-prev" aria-label="Önceki desen">‹</button>
  <div class="lightbox-inner">
    <button class="lb-close" id="lb-close" aria-label="Kapat">×</button>
    <div class="lb-image">
      <div id="lb-img-container"><img id="lb-img" alt=""></div>
    </div>
    <div class="lb-details">
      <div class="lb-cat" id="lb-cat"></div>
      <h2 class="lb-name" id="lb-name"></h2>
      <div class="lb-apps" id="lb-apps"></div>
      <p class="lb-desc" id="lb-desc"></p>
      <div class="lb-materials-label">Mevcut Malzemeler</div>
      <div class="lb-materials" id="lb-materials"></div>
      <a class="lb-cta" id="lb-cta" href="iletisim.htm">Bu Desen Hakkında Bilgi Alın →</a>
    </div>
  </div>
  <button class="lb-nav lb-next" id="lb-next" aria-label="Sonraki desen">›</button>
</div>
```

- [ ] **Step 2: Remove the old lightbox CSS from the inline `<style>` block in koleksiyon.htm**

Find and delete everything from `/* ─── LIGHTBOX ─────────────────────── */` through the end of the lightbox responsive rules (`.lightbox-overlay { padding: 20px; }` and `.lightbox-inner { flex-direction: column; ... }` inside the media query). Also remove any `.lb-*` rules.

The lightbox CSS starts around line 217. Delete all rules with selectors: `.lightbox-overlay`, `.lightbox-inner`, `.lb-close`, `.lb-nav`, `.lb-prev`, `.lb-next`, `.lb-image`, `.lb-details`, `.lb-cat`, `.lb-name`, `.lb-apps`, `.lb-desc`, `.lb-materials-label`, `.lb-materials`, `.lb-mat-badge`, `.lb-cta`, and their media-query overrides.

Keep all non-lightbox CSS in the `<style>` block.

- [ ] **Step 3: Replace the lightbox JS in koleksiyon.htm**

Find the `// ─── Lightbox ───` section (starting around line 639) and replace everything from `const overlay = ...` through the end of the `document.addEventListener('keydown', ...)` block with:

```js
// ─── Lightbox (via SLModal) ───────────────────────────────────────────
let currentIndex = -1;

const matMap = { pmag: 'Lumina PMAG™', pucomp: 'Lumina PUCOMP™' };

function buildLightboxHtml(p) {
  const mats = p.materials.length
    ? p.materials.map(m => '<span class="lb-mat-badge">' + (matMap[m] || m) + '</span>').join('')
    : '';
  return (
    '<div class="lb-layout">' +
      '<div class="lb-image">' +
        pictureTag(p.image, p.name + ' — ' + p.style + ' pattern', '60vw', { cls: 'lb-img-el' }) +
      '</div>' +
      '<div class="lb-details">' +
        '<div class="lb-cat">' + (styleLabels[p.style] || p.style) + '</div>' +
        '<h2 class="lb-name">' + p.name + '</h2>' +
        '<div class="lb-apps">' + p.applications.map(a => appLabels[a] || a).join(' · ') + '</div>' +
        '<p class="lb-desc">' + p.description + '</p>' +
        (mats ? '<div class="lb-materials-label">Mevcut Malzemeler</div><div class="lb-materials">' + mats + '</div>' : '') +
        '<a class="lb-cta" href="iletisim.htm?pattern=' + encodeURIComponent(p.name) + '">Bu Desen Hakkında Bilgi Alın →</a>' +
      '</div>' +
    '</div>' +
    '<button class="lb-nav lb-prev" aria-label="Önceki desen">‹</button>' +
    '<button class="lb-nav lb-next" aria-label="Sonraki desen">›</button>'
  );
}

function getVisibleIndices() {
  return Array.from(document.querySelectorAll('.pattern-card')).map(c => parseInt(c.dataset.index));
}

function openLightbox(patternIndex) {
  currentIndex = patternIndex;
  const p = patterns[patternIndex];
  SLModal.open({ mode: 'lightbox', html: buildLightboxHtml(p), title: p.name });
  // Wire nav buttons after injection
  const mb = document.querySelector('.sl-modal-body');
  mb.querySelector('.lb-prev').addEventListener('click', () => navigateLightbox(-1));
  mb.querySelector('.lb-next').addEventListener('click', () => navigateLightbox(1));
}

function navigateLightbox(dir) {
  const visible = getVisibleIndices();
  if (!visible.length) return;
  const pos = visible.indexOf(currentIndex);
  const next = (pos + dir + visible.length) % visible.length;
  openLightbox(visible[next]);
}

document.addEventListener('keydown', e => {
  if (!document.querySelector('.sl-modal')?.open) return;
  if (e.key === 'ArrowLeft')  navigateLightbox(-1);
  if (e.key === 'ArrowRight') navigateLightbox(1);
});
```

- [ ] **Step 4: Add lightbox layout CSS to koleksiyon.htm's inline `<style>`**

The `.lb-layout` two-column layout and retained `.lb-*` classes are page-specific — add them back in the inline `<style>` (they were deleted in Step 2 but the layout CSS is needed):

```css
/* ─── LIGHTBOX LAYOUT (sl-modal lightbox mode) ──────────── */
.lb-layout {
  display: flex;
  gap: 0;
  height: 100%;
  overflow: hidden;
}
.lb-image {
  flex: 1 1 60%;
  background: var(--obsidian);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.lb-img-el {
  width: 100%; height: 100%;
  object-fit: contain; display: block;
}
.lb-details {
  flex: 0 0 320px;
  padding: 48px 32px;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 16px;
  background: var(--surface);
}
.lb-cat {
  font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase;
  color: var(--gold); font-weight: 400;
}
.lb-name {
  font-family: var(--font-display); font-size: 32px;
  font-weight: 300; color: var(--fg); line-height: 1.2;
}
.lb-apps {
  font-size: 11px; color: var(--fg-muted); letter-spacing: 0.08em;
}
.lb-desc {
  font-size: 14px; color: var(--fg-2); font-weight: 300;
  line-height: 1.7; flex: 1;
}
.lb-materials-label {
  font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--fg-muted);
}
.lb-materials { display: flex; flex-wrap: wrap; gap: 8px; }
.lb-mat-badge {
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--fg-2); border: 1px solid var(--border-mute);
  padding: 4px 10px;
}
.lb-cta {
  display: inline-flex; align-items: center;
  font-family: var(--font-body); font-size: 11px; font-weight: 400;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--obsidian); background: var(--gold);
  padding: 12px 24px; text-decoration: none;
  transition: background var(--dur-1) var(--ease);
  margin-top: auto;
}
.lb-cta:hover { background: var(--gold-light); }
.lb-nav {
  position: absolute;
  top: 50%; transform: translateY(-50%);
  background: transparent; border: 1px solid var(--border);
  color: var(--fg-2); font-size: 24px;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 1;
  transition: border-color var(--dur-1) var(--ease),
              color       var(--dur-1) var(--ease);
}
.lb-nav:hover { border-color: var(--gold); color: var(--gold); }
.lb-prev { left: var(--s-4); }
.lb-next { right: var(--s-4); }
@media (max-width: 720px) {
  .lb-layout { flex-direction: column; }
  .lb-details { flex: 0 0 auto; padding: 24px 20px; border-left: 0; border-top: 1px solid var(--border); }
  .lb-image { flex: 0 0 50vh; }
  .lb-nav { top: 25%; }
}
```

- [ ] **Step 5: Verify the collection lightbox in the browser**

1. Open http://localhost:3000/koleksiyon.htm
2. Click any pattern card — the lightbox should open as a two-panel dialog (image + details)
3. Press ESC — modal closes, focus returns to the clicked card
4. Click a card, then press ← / → arrow keys — navigates between patterns
5. Tab through the dialog — focus stays trapped inside (close button, nav buttons, CTA link)
6. Click the backdrop (outside the dialog) — modal closes
7. Open DevTools → Accessibility tree — confirm `<dialog>` has `role=dialog`, `aria-modal=true`, and an `aria-label` matching the pattern name

- [ ] **Step 6: Commit**

```bash
git add "06 — Website/Studio Luminant Website/koleksiyon.htm"
git commit -m "refactor(collection): replace lightbox div with SLModal lightbox mode"
```

---

## Task 6: Refactor en/collection.htm Lightbox

Identical changes to Task 5 but for the English page. The JS uses `name_en` / `description_en` fields.

**Files:**
- Modify: `en/collection.htm`

- [ ] **Step 1: Read the existing lightbox section in en/collection.htm**

Open `en/collection.htm` and identify the equivalent sections: the `<!-- LIGHTBOX -->` markup, the lightbox CSS in the inline `<style>`, and the `// ─── Lightbox ───` JS block. Confirm the pattern data fields used (likely `p.name` is already EN, since the EN page maps `name_en`).

- [ ] **Step 2: Apply the same three changes as Task 5 Steps 1–4**

- Remove `<div class="lightbox-overlay">` markup
- Remove old lightbox CSS from inline `<style>`, add `.lb-layout` CSS block (same as Task 5 Step 4, but update link href from `iletisim.htm` to `../contact.htm`)
- Replace lightbox JS with the same block as Task 5 Step 3, updating:
  - CTA link: `href="../contact.htm?pattern=` instead of `href="iletisim.htm?pattern=`
  - Labels: use EN strings — `styleLabels` and `appLabels` will already be EN equivalents on this page

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000/en/collection.htm. Repeat the same smoke test as Task 5 Step 5. Confirm EN pattern names appear in the `aria-label`.

- [ ] **Step 4: Commit**

```bash
git add "06 — Website/Studio Luminant Website/en/collection.htm"
git commit -m "refactor(collection-en): replace lightbox div with SLModal lightbox mode"
```

---

## Task 7: Final Smoke Test — All Primitives

- [ ] **Step 1: Test SLModal image mode**

In the browser console on any page:
```js
SLModal.open({ mode: 'image', src: 'images/og-image.jpg', alt: 'Studio Luminant panel' });
```
Verify: full-bleed image, blurred obsidian backdrop, close button top-right, ESC closes.

- [ ] **Step 2: Test SLModal content mode**

```js
const el = document.createElement('div');
el.innerHTML = `
  <div style="padding:var(--s-7) var(--s-6)">
    <div style="font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);margin-bottom:var(--s-4)">Spesifikasyon</div>
    <h2 style="font-family:var(--font-display);font-size:36px;font-weight:300;color:var(--fg);margin-bottom:var(--s-4)">Compass Star</h2>
    <p style="font-size:14px;color:var(--fg-2);font-weight:300;line-height:1.7">Lumina PMAG™ · 600×600mm · A2-s1,d0 · EXW Sapanca</p>
  </div>`;
SLModal.open({ mode: 'content', title: 'Compass Star — Spesifikasyon', el });
```
Verify: centered panel at 680px max-width, scrollable, gold focus ring on close button, ESC closes.

- [ ] **Step 3: Test SLDrawer**

```js
SLDrawer.open({
  html: `
    <div style="border-bottom:1px solid var(--border);padding-bottom:var(--s-5);margin-bottom:var(--s-5)">
      <div style="font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:var(--s-3)">Teknik Özellikler</div>
      <h2 style="font-family:var(--font-display);font-size:28px;font-weight:300;color:var(--fg)">Compass Star</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:var(--fg-2);font-weight:300">
      <tr style="border-bottom:1px solid var(--rule-1)"><td style="padding:8px 0;color:var(--fg-muted);font-size:10px;letter-spacing:.2em;text-transform:uppercase">Malzeme</td><td style="padding:8px 0;text-align:right">Lumina PMAG™</td></tr>
      <tr style="border-bottom:1px solid var(--rule-1)"><td style="padding:8px 0;color:var(--fg-muted);font-size:10px;letter-spacing:.2em;text-transform:uppercase">Boyut</td><td style="padding:8px 0;text-align:right">600 × 600mm</td></tr>
      <tr><td style="padding:8px 0;color:var(--fg-muted);font-size:10px;letter-spacing:.2em;text-transform:uppercase">Yangın</td><td style="padding:8px 0;text-align:right;color:var(--gold)">A2-s1,d0</td></tr>
    </table>`,
  label: 'Teknik Özellikler'
});
```
Verify: slides in from right at 480ms, backdrop fades, Tab trapped, ESC closes, focus returns.

- [ ] **Step 4: Test reduced-motion**

In DevTools → Rendering → Emulate CSS media feature → `prefers-reduced-motion: reduce`. Open and close both primitives. They should appear/disappear instantly with no animation.

- [ ] **Step 5: Test keyboard-only navigation**

- Focus any card in koleksiyon.htm using Tab
- Press Enter/Space — modal opens
- Tab through all focusable elements — confirm loop stays inside dialog
- Shift+Tab — confirm reverse loop
- ESC — closes, focus returns to card

- [ ] **Step 6: Commit (if any fixes were made during testing)**

```bash
git add -p
git commit -m "fix(overlay): smoke test corrections"
```

---

## Self-Review Checklist (for implementer)

Before marking complete, verify each spec requirement is covered:

| Requirement | Task |
|-------------|------|
| Modal — image mode | Tasks 1, 3, 7 |
| Modal — content mode | Tasks 1, 3, 7 |
| Modal — lightbox mode (collection) | Tasks 1, 3, 5, 6 |
| Drawer | Tasks 2, 4, 7 |
| `::backdrop` obsidian tint | Task 1 |
| Drawer backdrop div | Task 2 |
| HTML shells injected by shared.js | Task 3 |
| `SLModal.open()` / `.close()` | Task 3 |
| `SLDrawer.open()` / `.close()` | Task 4 |
| Focus trap — modal (browser) | Task 3 (native) |
| Focus trap — drawer (manual) | Task 4 |
| ESC to close — modal | Task 3 (native) |
| ESC to close — drawer | Task 4 |
| Scroll lock + iOS touch-action | Tasks 3, 4 |
| Focus restoration to trigger | Tasks 3, 4 |
| Reduced-motion support | Task 7 |
| Collection TR lightbox refactored | Task 5 |
| Collection EN lightbox refactored | Task 6 |
| Old lightbox markup + CSS deleted | Tasks 5, 6 |
