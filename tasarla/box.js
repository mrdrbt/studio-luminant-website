// box.js -- the sheet's collapsible sections (Burak 2026-10-17: "make what we can as collapsed boxes").
// A box is a native <details class="box"> whose <summary> is the section heading line plus the CURRENT VALUE, so a closed box hides detail, never a number.
//   * open/closed is remembered per box per viewer in localStorage (a user's click is the only thing that writes it; works without storage);
//   * the app can open a box for the user (an error or notice inside, the points editor) without remembering it: setBoxOpen(key, true);
//   * a re-render that rebuilds a box's parts calls makeBox again and the box comes back in the state the viewer left it;
//   * print opens every box (beforeprint / afterprint, and the print media query for engines that fire neither), then restores them.
// Pure presentation: no composition, price or light logic lives here. Safe to import in node (nothing touches the DOM at load).
const PREFIX = "composer.box.";
const mem = new Map();                 // key -> open (the live state of this page; a click or setBoxOpen writes it)

function stored(key) {
  try { const v = localStorage.getItem(PREFIX + key); return v === "1" ? true : v === "0" ? false : null; } catch (_) { return null; }
}
function remember(key, open) {
  try { localStorage.setItem(PREFIX + key, open ? "1" : "0"); } catch (_) { /* private mode / blocked storage: the box still works */ }
}

// is box `key` open now: this page's live state, else what the viewer left last time, else the default
export function boxIsOpen(key, dflt = false) {
  if (mem.has(key)) return mem.get(key);
  const s = stored(key);
  return s === null ? dflt : s;
}

// open or close a box from code; `keep` also writes it to storage (a user's choice), otherwise it lasts only for this page
export function setBoxOpen(key, open, keep = false) {
  mem.set(key, open);
  if (keep) remember(key, open);
  if (typeof document === "undefined") return;
  for (const d of document.querySelectorAll("details.box")) if (d.dataset.box === key && d.open !== open) d.open = open;
}

// Give a <details> its remembered state. Static boxes in the HTML call this once; makeBox calls it for built ones.
export function initBox(d, dflt = false) {
  d.open = boxIsOpen(d.dataset.box, dflt);
  return d;
}

// Build a box: summary = heading (level h2 / h3) + the current value; the body is `kids`. `force` opens it for this page (an error inside).
export function makeBox(key, { title, value = "", level = "h3", dflt = false, force = false, cls = "" }, ...kids) {
  const d = document.createElement("details");
  d.className = `box${cls ? ` ${cls}` : ""}`;
  d.dataset.box = key;
  const sum = document.createElement("summary");
  const h = document.createElement(level);
  h.className = "h";
  h.textContent = title;
  const v = document.createElement("span");
  v.className = "box-sum";
  v.textContent = value;
  sum.append(h, v);
  const body = document.createElement("div");
  body.className = "box-body";
  body.append(...kids.flat().filter(Boolean));
  d.append(sum, body);
  if (force) mem.set(key, true);
  return initBox(d, dflt);
}

let wired = false;
let printing = null;                   // the boxes' open states before print, while printing

function openForPrint() {
  if (printing) return;
  const all = [...document.querySelectorAll("details.box")];
  printing = all.map((d) => [d, d.open]);
  for (const d of all) d.open = true;
}
function restoreAfterPrint() {
  if (!printing) return;
  for (const [d, was] of printing) if (d.isConnected) d.open = was;
  printing = null;
}

// Once per page: remember the viewer's clicks, and print every box open.
export function wireBoxes() {
  if (wired || typeof document === "undefined") return;
  wired = true;
  // a summary click (mouse, touch, Enter or Space) is the viewer's choice: the old state is still on the element when this runs
  document.addEventListener("click", (e) => {
    const sum = e.target.closest?.("details.box > summary");
    if (!sum) return;
    const d = sum.parentElement;
    mem.set(d.dataset.box, !d.open);
    remember(d.dataset.box, !d.open);
  });
  window.addEventListener("beforeprint", openForPrint);
  window.addEventListener("afterprint", restoreAfterPrint);
  const mq = window.matchMedia?.("print");
  mq?.addEventListener?.("change", (e) => (e.matches ? openForPrint() : restoreAfterPrint()));
}
