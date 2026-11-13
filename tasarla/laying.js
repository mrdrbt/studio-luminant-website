// laying.js -- The tiler's hand-over sheet in the browser: laying.html?c=<code>. Same data as
// laying_map.py (test_laying.py compares them cell for cell). No CDN; loaded only from laying.html.
// Numbering: rows from the BOTTOM-LEFT (1 = bottom-left), left to right, bottom course first.
// Turn k = k counter-clockwise quarter turns (np.rot90 sense), no mirror; arrow = the mould's "up" edge.
// Every piece is drawn at its TRUE laid size in both directions (cuts(): x_mm, w_mm, y_mm [up from the wall's bottom], h_mm,
// cut_left/right/top/bottom_mm per cell). The wall is the architect's real wall (wall_mm); the sheet closes with a cut list.
import { decode, expand, cuts, thinCuts, wallMm, coursesKit, cutPlates, suppliedModules } from "./lib/composer_layout.js?v=b748dc4d";
import { mountDock, mountMaker, lightSuffix } from "./sheetbar.js?v=2ea9d3a8";
import { fixingDigest, finishLabelOf } from "./material_rows.js?v=0082c530";
import { makeBox, wireBoxes } from "./box.js?v=c074f095";

const LABELS = {
  tr: {
    title: "Döşeme haritası", wall: "Duvar", modules: "Modül ızgarası", pieces: "Parça", cutPieces: "Kesilecek parça",
    numbering: "Numaralar: 1, sol alt köşedeki modüldür; numaralar soldan sağa ilerler, en alt sıradan başlar.",
    turn: "Dönüş: ok, kalıbın üst kenarının baktığı yönü gösterir. 90°, 180° ve 270° saat yönünün tersine dönüşlerdir. Hiçbir modül ters çevrilmez.",
    list: "Parça listesi", mould: "Kalıp", count: "Adet", turns: "Dönüş 0° / 90° / 180° / 270°", total: "Toplam",
    bad: "Kod okunamadı", nocode: "Adres satırına ?c=KOD ekleyin.", print: "Yazdır", flat: "Düz", cut: "KESİM", dec: ",",
    cutList: "Kesim listesi", cutSize: "Ölçü (genişlik × yükseklik, mm)", cutNos: "Modül no", nos: "no",
    edges: { left: "sol", right: "sağ", top: "üst", bottom: "alt" },
    thin: "Not: {edge} kenarda {mm} mm'lik ince kesim var; çizildiği gibi kesilir.",
    shared: "Aynı modülden kesilir: {list}",
    code: "Duvar kodu", design: "Tasarım / finish / format (cm)", scroll: "kaydır", scrollHint: "yatay kaydırılır",
    nPieces: "{n} parça",
    gridAlt: "Döşeme haritası: {cols} × {rows} modül; 1 numara sol alt köşedeki modüldür, oklar dönüş yönünü gösterir.",
    courses: "Sıra / modül", gridAltCourses: "Döşeme haritası: {rows} sıra, {n} modül; 1 numara sol alt köşedeki modüldür, oklar dönüş yönünü gösterir.",
  },
  en: {
    title: "Laying map", wall: "Wall", modules: "Module grid", pieces: "Pieces", cutPieces: "Cut pieces",
    numbering: "Numbering: 1 is the bottom-left module; numbers run left to right, bottom course first.",
    turn: "Turn: the arrow shows where the mould's top edge points. 90°, 180° and 270° are counter-clockwise turns. No module is mirrored.",
    list: "Piece list", mould: "Mould", count: "Count", turns: "Turns 0° / 90° / 180° / 270°", total: "Total",
    bad: "Could not read the code", nocode: "Add ?c=CODE to the address.", print: "Print", flat: "Plain", cut: "CUT", dec: ".",
    cutList: "Cut list", cutSize: "Size (width × height, mm)", cutNos: "Module nos.", nos: "no.",
    edges: { left: "left", right: "right", top: "top", bottom: "bottom" },
    thin: "Note: thin cut on the {edge} edge, {mm} mm; cut as drawn.",
    shared: "Cut from one module: {list}",
    code: "Wall code", design: "Design / finish / format (cm)", scroll: "scroll", scrollHint: "scrolls sideways",
    nPieces: "{n} pieces",
    gridAlt: "Laying map: {cols} × {rows} modules; number 1 is the bottom-left module, arrows show each module's turn.",
    courses: "Courses / modules", gridAltCourses: "Laying map: {rows} courses, {n} modules; number 1 is the bottom-left module, arrows show each module's turn.",
  },
};

// same cells as laying_map.laying_data, pure: usable in node
export function layingData(code, kits) {
  const comp = decode(code, kits);
  const kit = kits[comp.design];
  const rowsTop = expand(comp, kit);
  const cutRows = cuts(comp, kit);
  const [w, h] = kit.module_mm;
  const cells = [];
  const counts = {};
  const number = {};                                             // "course from the top:place in it" -> module number
  let n = 0, y = 0;                                              // y counts up from the wall's bottom
  for (let rb = 1, rt = rowsTop.length - 1; rt >= 0; rb++, rt--) {
    const row = rowsTop[rt];
    let x = 0;
    const courseH = h - cutRows[rt][0][2] - cutRows[rt][0][3];
    row.forEach(([mould, turn], i) => {
      n++;
      number[`${rt}:${i}`] = n;
      const [cl, cr, ct, cb] = cutRows[rt][i], shown = w - cl - cr;
      cells.push({ n, row: rb, col: i + 1, mould, turn, deg: 90 * turn, cut: Boolean(cl || cr || ct || cb),
                   x_mm: x, w_mm: shown, cut_left_mm: cl, cut_right_mm: cr,
                   y_mm: y, h_mm: h - ct - cb, cut_top_mm: ct, cut_bottom_mm: cb });
      x += shown;
      const s = (counts[mould] ??= { count: 0, turns: { 0: 0, 1: 0, 2: 0, 3: 0 } });
      s.count++;
      s.turns[turn]++;
    });
    y += courseH;
  }
  const piece_list = {};
  const plain = kit.moulds.filter((m) => m.role === "plain").map((m) => m.id), labels = kit.labels ?? {};
  const shown = (m) => (plain.includes(m) ? "￿" : labels[m] ?? m);          // the public letters in order (A, B, ...), the plain piece last
  for (const m of Object.keys(counts).sort((a, b) => shown(a).localeCompare(shown(b)))) piece_list[m] = counts[m];
  return {
    code: code.trim(), design: comp.design, colour: comp.colour, line: comp.line, engine: comp.engine,
    cols: comp.cols, rows: comp.rows, module_mm: [w, h], wall_mm: wallMm(comp, kit), supplied_mm: coursesKit(kit) ? null : [comp.cols * w, comp.rows * h],
    courses: coursesKit(kit), modules: suppliedModules(comp, kit), pieces_total: n, cut_pieces: cells.filter((c) => c.cut).length,
    cut_list: cutList(cells), thin: thinCuts(comp, kit), shared_plates: coursesKit(kit) ? sharedPlates(comp, kit, number) : [],
    cells, piece_list, mould_labels: labels, plain_moulds: plain, preview: kit.preview === true,
  };
}

// the plates that give more than one piece, by lowest number (= laying_map.shared_plates): the supply counts on them, so the sheet has to name them
function sharedPlates(comp, kit, number) {
  return cutPlates(comp, kit).filter((p) => p.pieces.length > 1)
    .map((p) => ({ mould: p.mould, numbers: p.pieces.map(([r, i]) => number[`${r}:${i}`]).sort((a, b) => a - b) }))
    .sort((a, b) => a.numbers[0] - b.numbers[0]);
}

// the cut pieces grouped by laid size, widest then tallest first (= laying_map.cut_list)
function cutList(cells) {
  const groups = new Map();
  for (const c of cells) {
    if (!c.cut) continue;
    const key = `${c.w_mm}x${c.h_mm}`;
    if (!groups.has(key)) groups.set(key, { w_mm: c.w_mm, h_mm: c.h_mm, count: 0, numbers: [] });
    const g = groups.get(key);
    g.count++;
    g.numbers.push(c.n);
  }
  return [...groups.values()].sort((a, b) => b.w_mm - a.w_mm || b.h_mm - a.h_mm);
}

const NS = "http://www.w3.org/2000/svg";
const el = (name, attrs = {}, text) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
};

// the mould as the public sees it: the descriptor's letter (labels), the plain piece as the word; set from the data before anything is drawn
let NAMES = { labels: {}, plain: [] };
const mouldLabel = (m, t) => (NAMES.plain.includes(m) ? t.flat : NAMES.labels[m] ?? m);

const mm = (v) => String(+v.toFixed(1));                      // 143.5 -> "143.5", 90 -> "90" (laying_map._mm)

const cutLabel = (c, t) => {
  const dec = (v) => mm(v).replace(".", t.dec);
  return c.cut_top_mm || c.cut_bottom_mm ? `${t.cut} ${dec(c.w_mm)} × ${dec(c.h_mm)} mm` : `${t.cut} ${dec(c.w_mm)} mm`;
};

function gridSvg(data, t) {
  const cell = data.engine === "plan" ? 180 : 80, pad = 2;     // user units per module width; a plan (3.6 m) fits the frame, its 90 mm cut is 27 units
  const k = cell / data.module_mm[0];
  const W = data.wall_mm[0] * k, H = data.wall_mm[1] * k;
  const svg = el("svg", { viewBox: `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`, class: "grid", role: "img",
    "aria-label": data.courses ? t.gridAltCourses.replace("{rows}", data.rows).replace("{n}", data.modules) : t.gridAlt.replace("{cols}", data.cols).replace("{rows}", data.rows) });
  svg.style.setProperty("--cols", W / 80);                      // style.css keeps 80 user units >= 80 CSS px
  const shades = Object.keys(data.piece_list);
  for (const c of data.cells) {
    const x = c.x_mm * k, cw = c.w_mm * k, ch = c.h_mm * k, y = H - (c.y_mm + c.h_mm) * k;
    const g = el("g", { transform: `translate(${x} ${y})` });
    const tone = 97 - 4 * (shades.indexOf(c.mould) % 6);       // one quiet grey step per mould, for the tiler's eye
    const tiny = c.cut && (cw < 24 || ch < 14);                  // too small to label: red outline, the cut list names it
    g.append(el("rect", { width: cw, height: ch, fill: `hsl(60 4% ${tone}%)`, stroke: tiny ? "#aa2828" : "#1c1d1b", "stroke-width": tiny ? 2 : 1 }));
    const cutText = cutLabel(c, t);
    const wide = cw >= Math.max(64, c.cut ? 7 * cutText.length + 8 : 0);
    const narrowShort = ch >= 44 && !wide && ch < 130 && cw >= 24;          // a narrow cut in a short cell: stacked lines + a small arrow
    if (Math.min(cw, ch) >= 24) {
      const beside = wide && c.cut && ch < 90;                  // a wide cut in a short course: the arrow keeps clear of the red label
      const arrow = el("g", { transform: `translate(${beside ? cw - 18 : cw / 2} ${beside ? ch / 2 : ch * (narrowShort ? 0.64 : 0.46)}) rotate(${-90 * c.turn}) scale(${Math.min(1, cw / 80, ch / 80) * (narrowShort ? 0.7 : 1)})` });
      arrow.append(el("path", { d: "M0 -17 L0 15 M0 -17 L-9 -6 M0 -17 L9 -6", class: "arrow" }));
      g.append(arrow);
    }
    if (tiny) { svg.append(g); continue; }
    const size = `${mm(c.w_mm).replace(".", t.dec)}${c.cut_top_mm || c.cut_bottom_mm ? ` × ${mm(c.h_mm).replace(".", t.dec)}` : ""}`;
    if (ch < 44) {                                              // a short course: one line, the cut list carries the rest
      if (ch >= 14) {
        const full = c.cut ? `${c.n}  ${mm(c.w_mm).replace(".", t.dec)} × ${mm(c.h_mm).replace(".", t.dec)}` : String(c.n);
        g.append(el("text", { x: 3, y: 11, class: c.cut ? "cut" : "n" }, cw >= 7 * full.length + 6 ? full : String(c.n)));
      }
    } else if (wide) {                                          // a whole piece or a wide cut
      g.append(el("text", { x: 4, y: 14, class: "n" }, c.n));
      g.append(el("text", { x: 4, y: ch - 6, class: "m" }, `${mouldLabel(c.mould, t)} ${c.deg}°`));
      if (c.cut) g.append(el("text", { x: 4, y: 28, class: "cut" }, cutText));
    } else {                                                    // a narrow cut: one centred column
      const mid = { x: cw / 2, "text-anchor": "middle" };
      if (narrowShort) {
        g.append(el("text", { ...mid, y: 12, class: "n" }, c.n));
        g.append(el("text", { ...mid, y: 24, class: "cut" }, t.cut));
        if (7 * size.length <= cw) g.append(el("text", { ...mid, y: 36, class: "cut" }, size));   // else the cut list carries it
        g.append(el("text", { ...mid, y: ch - 4, class: "m" }, mouldLabel(c.mould, t)));    // the arrow carries the turn here
      } else {
        g.append(el("text", { ...mid, y: 14, class: "n" }, c.n));
        g.append(el("text", { ...mid, y: 28, class: "cut" }, t.cut));
        g.append(el("text", { ...mid, y: 40, class: "cut" }, `${size}${cw >= 52 ? " mm" : ""}`));
        g.append(el("text", { ...mid, y: ch - 20, class: "m" }, mouldLabel(c.mould, t)));
        g.append(el("text", { ...mid, y: ch - 6, class: "n" }, `${c.deg}°`));
      }
    }
    svg.append(g);
  }
  return svg;
}

function listTable(data, t) {
  const tb = document.createElement("table");
  tb.className = "pieces";
  tb.innerHTML = `<thead><tr><th>${t.mould}</th><th>${t.count}</th><th>${t.turns}</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (const [m, s] of Object.entries(data.piece_list)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${mouldLabel(m, t)}</td><td>${s.count}</td><td>${[0, 1, 2, 3].map((k) => s.turns[k]).join(" / ")}</td>`;
    body.append(tr);
  }
  const foot = document.createElement("tr");
  foot.innerHTML = `<td>${t.total}</td><td>${data.pieces_total}</td><td></td>`;
  body.append(foot);
  tb.append(body);
  return tb;
}

// the cut list: one row per laid size (width × height), how many, and which module numbers
function cutTable(data, t) {
  const tb = document.createElement("table");
  tb.className = "pieces cutlist";
  tb.innerHTML = `<thead><tr><th>${t.cutSize}</th><th>${t.count}</th><th>${t.cutNos}</th></tr></thead>`;
  const body = document.createElement("tbody");
  for (const g of data.cut_list) {
    const tr = document.createElement("tr");
    const size = `${mm(g.w_mm).replace(".", t.dec)} × ${mm(g.h_mm).replace(".", t.dec)}`;
    tr.innerHTML = `<td>${size}</td><td>${g.count}</td><td>${g.numbers.join(", ")}</td>`;
    body.append(tr);
  }
  tb.append(body);
  return tb;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function paragraph(text, className) {
  const p = document.createElement("p");
  p.textContent = text;
  if (className) p.className = className;
  if (className === "err") p.setAttribute("role", "alert");
  return p;
}

async function main() {
  const root = document.getElementById("lay-sheet");
  const strings = await fetchJson("strings.json").catch(() => null);
  const config = await fetchJson("config.json").catch(() => null);
  const names = strings?.locales?.[(new URLSearchParams(location.search).get("l") || new URLSearchParams(location.search).get("lang")) === "en" ? "en" : "tr"] ?? {};
  const params = new URLSearchParams(location.search);
  const lang = (params.get("l") || params.get("lang")) === "en" ? "en" : "tr";
  const code = params.get("c");
  const draw = (data, err) => {
    const t = LABELS[lang];
    NAMES = { labels: data?.mould_labels ?? {}, plain: data?.plain_moulds ?? [] };
    wireBoxes();
    document.documentElement.lang = lang;
    document.title = `A-03 ${t.title}`;
    root.replaceChildren();
    const head = document.createElement("header");
    head.className = "lay-head";
    const h1 = document.createElement("h1");
    h1.append(Object.assign(document.createElement("b"), { textContent: "A-03" }), ` ${t.title}`);
    const tools = document.createElement("div");
    tools.className = "tools noprint";
    const pb = Object.assign(document.createElement("button"), { type: "button", textContent: t.print });
    pb.onclick = () => window.print();
    tools.append(pb);
    head.append(h1, tools);
    root.append(head);
    if (!code) { root.append(paragraph(t.nocode)); return; }
    if (err) { root.append(paragraph(`${t.bad}: ${err}`, "err")); return; }
    const [wm, hm] = data.wall_mm, [mw, mh] = data.module_mm;
    const num = (v) => mm(v).replace(".", t.dec);
    const antet = document.createElement("div");
    antet.className = "antet";
    const dl = document.createElement("dl");
    for (const [k, v] of [[t.code, data.code], [t.design, `${names[`design_${data.design}`] ?? data.design} / ${finishLabelOf(names, data.colour)} / ${mw / 10} × ${mh / 10}${data.preview && names.preview_label ? ` — ${names.preview_label}` : ""}`],
      [t.wall, `${num(wm)} × ${num(hm)} mm`], data.courses ? [t.courses, `${data.rows} / ${data.modules} (${mw} × ${mh} mm)`] : [t.modules, `${data.cols} × ${data.rows} (${mw} × ${mh} mm)`],
      [t.pieces, String(data.pieces_total)], [t.cutPieces, String(data.cut_pieces)], [names.maker_label ?? "", names.maker_value ?? ""]]) {
      const cell = document.createElement("div");
      const dd = document.createElement("dd");
      if (k === t.code) {
        cell.className = "cell span code";
        dd.append(Object.assign(document.createElement("span"), { className: "code-v", textContent: v }));
      } else {
        cell.className = k === t.design ? "cell span" : k === names.maker_label ? "cell span maker" : "cell";
        dd.textContent = v;
      }
      cell.append(Object.assign(document.createElement("dt"), { textContent: k }), dd);
      dl.append(cell);
    }
    antet.append(dl);
    const wrap = document.createElement("div");
    wrap.className = "grid-wrap";
    const cue = document.createElement("p");                // "kaydır →" while the grid runs off the frame
    cue.className = "scroll-cue noprint";
    cue.hidden = true;
    cue.setAttribute("aria-hidden", "true");
    cue.innerHTML = `<span></span><svg viewBox="0 0 24 24" focusable="false"><path d="M4 12h16M14 6l6 6-6 6"/></svg>`;
    cue.firstChild.textContent = t.scroll;
    wrap.append(gridSvg(data, t));
    // a frame that scrolls (narrow screens) must be reachable by keyboard
    const fitScroll = () => {
      const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
      if (scrolls) { wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", `${t.title}, ${t.scrollHint}`); }
      else { wrap.removeAttribute("tabindex"); wrap.removeAttribute("role"); wrap.removeAttribute("aria-label"); }
      cue.hidden = !scrolls || wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2;
    };
    new ResizeObserver(fitScroll).observe(wrap);
    wrap.addEventListener("scroll", fitScroll, { passive: true });
    // the fixing facts under the antet in one line (Kalınlık · Yapıştırıcı · Derz), each "—" until config.json `material` supplies it for this design; A-00 holds the full sheet
    const digest = document.createElement("p");
    digest.className = "fix-digest";
    const facts = config ? fixingDigest(config, names, lang, data.design) : [];
    digest.append(facts.map((f) => `${f.label}: ${f.value ?? names.mat_open ?? "—"}`).join(" · "));
    if (facts.length) digest.append(" · ", Object.assign(document.createElement("a"), { href: `material.html?c=${encodeURIComponent(data.code)}&l=${lang}${lightSuffix(location.search)}`, textContent: `A-00 ${names.sheet_a00 ?? ""}`.trim() }));
    root.append(antet, ...(facts.length ? [digest] : []), cue, wrap, paragraph(`${t.numbering} ${t.turn}`, "notes"));
    const lists = document.createElement("div");           // one A4 landscape sheet: the piece list and the cut list sit side by side in print
    lists.className = "lay-tables";
    const left = document.createElement("div"), right = document.createElement("div");
    // the piece list and the cut list are boxes (box.js): closed they show their count, open (and always in print) they show the table
    left.append(makeBox("lay-pieces", { title: t.list, value: t.nPieces.replace("{n}", data.pieces_total), level: "h2" }, listTable(data, t)));
    if (data.cut_list.length) {
      const thin = data.thin.map((th) => paragraph(t.thin.replace("{edge}", t.edges[th.edge]).replace("{mm}", num(th.mm)), "notes"));
      const shared = data.shared_plates.length ? [paragraph(t.shared.replace("{list}", data.shared_plates.map((p) => `${p.numbers.join(" + ")} (${mouldLabel(p.mould, t)})`).join(", ")), "notes")] : [];
      right.append(makeBox("lay-cuts", { title: t.cutList, value: t.nPieces.replace("{n}", data.cut_pieces), level: "h2", force: thin.length > 0 || shared.length > 0 }, cutTable(data, t), ...thin, ...shared));   // a thin-cut note opens it
    }
    lists.append(left, ...(data.cut_list.length ? [right] : []));
    root.append(lists);
    mountMaker({ strings, loc: lang });
    if (config) mountDock({ comp: { code: data.code, cols: data.cols, rows: data.rows, module_mm: data.module_mm, wall_mm: data.wall_mm, supplied_modules: data.modules, line: data.line, design: data.design }, config, strings, loc: lang, view: "architect", light: lightSuffix(location.search) });
  };
  if (!code) { draw(null, null); return; }
  try {
    const index = await fetchJson("kits/index.json");
    const kits = {};
    for (const k of index.kits) {
      const man = await fetchJson(`kits/${k.manifest}`);
      kits[man.design] = man.descriptor;
    }
    draw(layingData(code, kits), null);
  } catch (e) {
    draw(null, e.message);
  }
}

// runs only on laying.html (the composer imports nothing from here at runtime, but stay safe if it ever does)
if (typeof document !== "undefined" && document.getElementById("lay-sheet")) main();
