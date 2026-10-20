// ─── SHARED JS — Studio Luminant ───
// Custom cursor, scroll reveal
// Note: Nav, mobile menu, and cursor elements are injected by components.js
// Cursor init is deferred until components.js has run.

// ─── JS-PRESENT FLAG ───
// Mark the document as JS-enabled so the CSS reveal rule only hides content
// when JS is confirmed running (fail-open if JS is blocked/errors/races paint).
document.documentElement.classList.add('js');

// ─── GA4 CUSTOM EVENTS ───
// Event + param names are documented in docs/ga4-events.md — keep them in sync.
// No-op when gtag is absent (no consent, internal traffic, blocked script).
function slTrack(name, params) {
  if (typeof gtag === 'function') gtag('event', name, params);
}

// ─── LEAD ATTRIBUTION (WB-08) ───
// The session's first touch (utm_*, landing_path, external referrer) and the service line,
// kept in sessionStorage so a form on a later page can carry them. Read by slAttribution();
// sent only when a visitor submits a form. service_line: a ?service_line= key wins
// (QR / DM links), else the last door page seen, else «Diğer».
var SL_SERVICE_LINES = { 'ozel-uretim': 'Özel Üretim', 'atolye': 'Atölye Tasarımları', 'dosya': 'Dosya talebi', 'diger': 'Diğer' };
var SL_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
(function () {
  var KEY = 'sl_attr';
  function slPath(p) { try { return decodeURIComponent(p); } catch (e) { return p; } }
  var store;
  try { store = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
  var params = new URLSearchParams(location.search);
  if (!store) {
    store = { landing_path: slPath(location.pathname) };
    // only an external referrer says where the visitor came from; origin + path, no query
    try {
      var ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.host !== location.host) store.referrer = ref.origin + slPath(ref.pathname);
    } catch (e) { /* malformed referrer: leave it out */ }
  }
  // a later campaign landing in the same session replaces the whole utm set, never mixes it
  if (SL_UTM_KEYS.some(function (k) { return params.get(k); })) {
    SL_UTM_KEYS.forEach(function (k) { var v = params.get(k); if (v) store[k] = v.slice(0, 160); else delete store[k]; });
  }
  var file = location.pathname.split('/').pop();
  var asked = SL_SERVICE_LINES[params.get('service_line')];
  if (asked) store.service_line = asked;
  else if (/^(sistemler|systems|sistem-|system-)/.test(file)) store.service_line = SL_SERVICE_LINES.atolye;
  else if (/^(surec|process|vaka-tufetto|case-study-tufetto)/.test(file)) store.service_line = SL_SERVICE_LINES['ozel-uretim'];
  try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage blocked: this page still works */ }
  window.slAttribution = function () {
    var out = { service_line: store.service_line || SL_SERVICE_LINES.diger, landing_path: store.landing_path || slPath(location.pathname), referrer: store.referrer || '' };
    SL_UTM_KEYS.forEach(function (k) { if (store[k]) out[k] = store[k]; });
    return out;
  };
})();

// ─── CONTACT CLICKS (WB-08) ───
// tel: / mailto: / WhatsApp links anywhere on the page (nav, footer, contact rows).
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  var method = /^tel:/i.test(href) ? 'tel' : /^mailto:/i.test(href) ? 'mail' : /^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href) ? 'whatsapp' : '';
  if (!method) return;
  slTrack('contact_click', { contact_method: method, link_location: a.closest('#site-footer') ? 'footer' : a.closest('#site-nav') ? 'nav' : 'body' });
});

// ─── CURSOR ───
// Called by components.js after cursor elements are injected
function initCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) translate(-50%,-50%)';
    if (!running) { running = true; requestAnimationFrame(animateRing); }
  }, { passive: true });

  // transform-only; the loop sleeps once the ring has caught up with the pointer
  let running = false;
  function animateRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
    if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) requestAnimationFrame(animateRing);
    else running = false;
  }

  // Hover effect on all interactive elements
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
}

// ─── SCROLL REVEAL ───
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      setTimeout(() => { entry.target.classList.add('visible'); }, 100);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── OVERLAY SHELLS ─────────────────────────────────────────────────────────
// Inject <dialog> and <aside> shells once into <body>.
// Pages never include this markup — SLModal / SLDrawer manage it.
document.addEventListener('DOMContentLoaded', () => {
  const closeLabel = document.documentElement.lang === 'en' ? 'Close' : 'Kapat';
  if (!document.querySelector('.sl-modal')) {
    const dlg = document.createElement('dialog');
    dlg.className = 'sl-modal';
    dlg.setAttribute('aria-label', '');
    dlg.innerHTML =
      '<button class="sl-overlay-close" aria-label="' + closeLabel + '">✕</button>' +
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
    aside.setAttribute('role', 'dialog');
    aside.setAttribute('aria-modal', 'true');
    aside.innerHTML =
      '<button class="sl-overlay-close" aria-label="' + closeLabel + '">✕</button>' +
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
    if (!dialog) return;
    body   = dialog.querySelector('.sl-modal-body');
    // Backdrop click (click on dialog itself, not its children)
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    dialog.querySelector('.sl-overlay-close').addEventListener('click', close);
    // 'close' event fires for native ESC too — ensures scroll lock and focus always clean up
    dialog.addEventListener('close', () => {
      document.body.style.overflow    = '';
      document.body.style.touchAction = '';
      _trigger?.focus();
    });
  }

  function open({ mode = 'content', src, alt, title, el, html } = {}) {
    if (!dialog) _init();
    if (!dialog) return;
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
    if (!dialog || !dialog.open) return;
    dialog.close();
    // Synchronous cleanup — also in 'close' event listener for native ESC path
    document.body.style.overflow    = '';
    document.body.style.touchAction = '';
    _trigger?.focus();
  }

  return { open, close };
})();

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
    if (!aside) return;
    backdrop = document.querySelector('.sl-drawer-backdrop');
    if (!backdrop) { aside = null; return; }
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
    if (!aside) return;
    if (!aside.classList.contains('is-open')) _trigger = document.activeElement;
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
    aside.querySelector('.sl-overlay-close')?.focus();
    _trap = _makeTrap(aside);
    document.addEventListener('keydown', _trap);
  }

  function close() {
    if (!aside || !aside.classList.contains('is-open')) return;
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
