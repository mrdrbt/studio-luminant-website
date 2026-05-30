# Overlay Primitive — Design Spec
*2026-05-21 · Studio Luminant Design System v2*

## Summary

Add a reusable overlay primitive to the SL design system covering two presentation patterns: a centered **modal** (image and content modes) and a right-sliding **drawer** (spec sheet). Replaces the existing collection-page lightbox. Built on the native `<dialog>` element for free focus trap, ESC key, and ARIA role on the modal side; the drawer uses an `<aside>` with a manual focus trap.

---

## Scope

| Pattern | Included | Excluded |
|---------|----------|----------|
| Modal — image mode | ✓ | — |
| Modal — content mode | ✓ | — |
| Drawer (right panel) | ✓ | — |
| Bottom sheet | ✗ | Add when a real mobile use case arrives |
| Stacked overlays | ✗ | Not needed; one overlay open at a time |

---

## Use Cases

**Modal**
- Collection lightbox (replacing existing) — image mode
- Product spec detail popup — content mode
- Contact confirmation message — content mode

**Drawer**
- Spec sheet sliding in from collection product card

---

## Files Changed

| File | Change |
|------|--------|
| `shared.css` | Add `.sl-modal`, `.sl-drawer`, `::backdrop`, animation keyframes |
| `shared.js` | Add `SLModal` and `SLDrawer` IIFE utility objects (~80 lines total) |
| Collection page JS | Refactor existing lightbox to call `SLModal.open()` |
| Collection page CSS | Remove old lightbox styles |

No new files. All z-index tokens (`--z-overlay: 100`, `--z-overlay-surface: 101`) already present in `shared.css`.

---

## Architecture

### Approach: Native `<dialog>` + CSS-animated `<aside>`

The `<dialog>` element is used for the modal. The browser provides:
- Focus trap (keyboard stays inside dialog while open)
- ESC key to close
- `role="dialog"` and `aria-modal` for screen readers
- `::backdrop` pseudo-element for the backdrop layer

The drawer uses `<aside>` with a manual focus trap (~15 lines) since `<dialog>` does not naturally suit side panels.

One shared HTML shell for each primitive lives in the DOM at all times (injected by `components.js` or directly in the page `<body>`). Content is swapped in at open time.

### HTML shell injection

Both shells are appended to `<body>` by `shared.js` on `DOMContentLoaded` — one `<dialog>` and one `<aside>` + backdrop div. Pages do not include this markup manually.

### HTML — Modal

```html
<dialog class="sl-modal" aria-label="">
  <button class="sl-overlay-close" aria-label="Kapat">✕</button>
  <div class="sl-modal-body">
    <!-- injected by SLModal.open() -->
  </div>
</dialog>
```

`aria-label` is set dynamically by `SLModal.open()`: the `title` param for content mode, the `alt` text for image mode. `dialog[data-mode="image"]` and `dialog[data-mode="content"]` drive the two layout variants via CSS.

### HTML — Drawer

```html
<div class="sl-drawer-backdrop" aria-hidden="true"></div>
<aside class="sl-drawer" aria-label="" aria-hidden="true">
  <button class="sl-overlay-close" aria-label="Kapat">✕</button>
  <div class="sl-drawer-body">
    <!-- injected by SLDrawer.open() -->
  </div>
</aside>
```

---

## CSS Design

### Surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--surface` | `#18181D` | Modal and drawer panel background |
| `--surface-2` | `#1F1F26` | Modal/drawer header strip |
| `--shadow-2` | `0 24px 60px -20px rgba(0,0,0,0.6)` | Panel drop shadow |
| `--border` | `rgba(201,168,76,0.18)` | Panel border |
| `--z-overlay` | `100` | Backdrop (drawer) |
| `--z-overlay-surface` | `101` | Panels and `<dialog>` |

### Backdrop

```css
/* Modal — uses native ::backdrop */
.sl-modal::backdrop {
  background: rgba(12,12,14,0.88);
  backdrop-filter: blur(4px);
}

/* Drawer — sibling div */
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
```

### Motion

| Surface | Enter | Exit | Easing |
|---------|-------|------|--------|
| Modal backdrop | `opacity 0→1` at `--dur-2` (240ms) | reverse at `--dur-1` (120ms) | `--ease-out` |
| Modal panel | `opacity + translateY(16px→0)` at `--dur-2` | reverse at `--dur-1` | `--ease-out` |
| Drawer panel | `translateX(100%→0)` at `--dur-3` (480ms) | reverse at `--dur-1` | `--ease-out` |
| Drawer backdrop | `opacity 0→1` at `--dur-2` | reverse at `--dur-1` | `--ease-out` |

Exit is always `--dur-1` (120ms) — feels snappy regardless of entry speed.

Reduced-motion: the existing `@media (prefers-reduced-motion)` rule zeros all `--dur-*` tokens, so overlays open/close instantly with no extra code.

### Modal layout modes

```css
/* Image mode — full-bleed, max 90vw × 90vh */
.sl-modal[data-mode="image"] .sl-modal-body {
  width: min(90vw, 1200px);
  height: min(90vh, 800px);
  display: flex; flex-direction: column;
}
.sl-modal[data-mode="image"] img {
  flex: 1; width: 100%; height: 100%;
  object-fit: contain;
}

/* Content mode — centered panel, scrollable */
.sl-modal[data-mode="content"] {
  width: min(680px, 90vw);
  max-height: 85vh;
  overflow-y: auto;
  display: flex; flex-direction: column;
}
```

### Drawer layout

```css
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
```

### Shared close button

```css
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
}
.sl-overlay-close:hover {
  border-color: var(--gold);
  color: var(--gold);
}
```

---

## JS Design

Both utilities are IIFE modules added to `shared.js`, matching the existing code style. Each returns `{ open, close }`.

### `SLModal`

```js
const SLModal = (() => {
  let dialog, body, _trigger;

  function _init() {
    dialog = document.querySelector('.sl-modal');
    body   = dialog.querySelector('.sl-modal-body');
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    dialog.querySelector('.sl-overlay-close').addEventListener('click', close);
  }

  function open({ mode = 'content', src, alt, title, el } = {}) {
    if (!dialog) _init();
    _trigger = document.activeElement;
    dialog.dataset.mode = mode;
    dialog.setAttribute('aria-label', mode === 'image' ? (alt || '') : (title || ''));
    body.innerHTML = '';
    if (mode === 'image') {
      const img = Object.assign(document.createElement('img'), { src, alt: alt || '' });
      body.appendChild(img);
    } else {
      body.appendChild(el.cloneNode(true));
    }
    document.body.style.overflow    = 'hidden';
    document.body.style.touchAction = 'none';   // iOS scroll-lock
    dialog.showModal();
  }

  function close() {
    dialog.close();
    document.body.style.overflow    = '';
    document.body.style.touchAction = '';
    _trigger?.focus();
  }

  return { open, close };
})();
```

**Notes:**
- Backdrop click: a click that lands on the `<dialog>` element itself (not the panel inside) triggers `close()`. This is the standard pattern for native dialog.
- ESC key: handled by the browser automatically — no code needed.
- Scroll lock: `overflow: hidden` + `touch-action: none` on `body` prevents background scroll on iOS.
- Focus restoration: `_trigger` captures `document.activeElement` before `showModal()`. `close()` returns focus to it.

### `SLDrawer`

```js
const SLDrawer = (() => {
  let aside, backdrop, body, _trap, _trigger;

  function _init() {
    aside    = document.querySelector('.sl-drawer');
    backdrop = document.querySelector('.sl-drawer-backdrop');
    body     = aside.querySelector('.sl-drawer-body');
    backdrop.addEventListener('click', close);
    aside.querySelector('.sl-overlay-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && aside.classList.contains('is-open')) close(); });
  }

  function _makeTrap(el) {
    const sel = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"]),input,select,textarea';
    return e => {
      if (e.key !== 'Tab') return;
      const nodes = [...el.querySelectorAll(sel)];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
  }

  function open({ el, label = 'Panel' } = {}) {
    if (!aside) _init();
    _trigger = document.activeElement;
    body.innerHTML = '';
    body.appendChild(el.cloneNode(true));
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

---

## Collection Lightbox Refactor

```js
// collection.js — replace existing lightbox handler with:
imgEl.addEventListener('click', () => {
  SLModal.open({ mode: 'image', src: imgEl.src, alt: imgEl.alt });
});
```

Delete: old lightbox `<div>` markup in collection HTML, old lightbox CSS rules.

---

## Accessibility Checklist

- [x] Modal: `role="dialog"` + `aria-modal="true"` — provided by `<dialog>` element
- [x] Modal: `aria-labelledby` pointing to visible title (or `aria-label` for image mode)
- [x] Modal: focus trap — provided by browser
- [x] Modal: ESC to close — provided by browser
- [x] Drawer: `role="complementary"` — provided by `<aside>` element
- [x] Drawer: `aria-label` set dynamically at open time
- [x] Drawer: `aria-hidden="true"` when closed, `"false"` when open
- [x] Drawer: manual focus trap on Tab/Shift+Tab
- [x] Drawer: ESC to close — manual keydown listener
- [x] Both: `.sl-overlay-close` button has `aria-label="Kapat"`
- [x] Both: scroll lock includes `touch-action: none` for iOS
- [x] Both: focus returns to trigger element on close (`_trigger` captures `document.activeElement` in `open()`; `close()` calls `_trigger?.focus()`)
- [x] Reduced-motion: `--dur-*` tokens zeroed by existing media query — no extra code

---

## Out of Scope

- **Bottom sheet** — no current mobile use case. Add when needed; shares backdrop/focus-trap code with drawer.
- **Toast/notification** — separate primitive (`--z-toast: 200` slot already reserved).
- **Stacked overlays** — not needed. If a modal opens over a drawer, the modal's backdrop covers the drawer naturally.
- **Animation on `<dialog>` close** — the native `dialog.close()` removes `display` immediately. Closing animation requires the `@starting-style` rule (Chrome 117+) or a CSS class toggle before calling `close()`. Defer until browser support is wider; for now, close is instant at 120ms.
