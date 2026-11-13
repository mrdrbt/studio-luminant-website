// app.js -- Catalog Composer (P2 phone MVP; Phase B: the specification sheet, see ../DESIGN.md). Plain ES module, no framework. The first half is PURE (state,
// reducer, layout presets, message builders) and is unit-tested in node without a DOM; the second half is the
// browser UI and only runs when `document` exists.
//   state = {comp, ui: {preset, step}}   comp is exactly the composition object composer_layout.js encodes.
// Relief seeds (code v4, corners engine): the architect taps points on the wall where the relief starts; the reducer's seed_* actions
// only ever produce walls the kit can make (the validator decides, see seedPoints in composer_layout.js).
import * as L from "./lib/composer_layout.js?v=b748dc4d";
import { quote, pieceCounts, formatTry, cutCount, rateFor, moqFor } from "./price.js?v=59a918cf";
import { loadMoulds, composeWall, encodeTwoChannel, createLightView } from "./light.js?v=aa3008dc";
import { roomsFor } from "./room_math.js?v=12f7cf55";
import { lineNameFor, previewOf } from "./material_rows.js?v=0082c530";
import { isQuoteMode, designFromSearch, checkQuote, cleanQuote, quotePayload, sendQuote } from "./quote.js?v=4385aeff";
export { previewOf };
import { makeBox, initBox, setBoxOpen, wireBoxes } from "./box.js?v=c074f095";

// ---------------------------------------------------------------------------- pure: layout presets
// Ramp value at a wall vertex = (a*col + b*row + o) / d, in code steps of 1/code_den. The presets are
// directions; `o` is derived so the lowest vertex sits at step 0 (a negative start would need corner classes
// no kit has), plus the user's offset step.
export const PRESETS = {
  diag_down: { a: 1, b: 1, d: 2, icon: "i-diag-down" },
  diag_up: { a: 1, b: -1, d: 2, icon: "i-diag-up" },
  horizontal: { a: 1, b: 0, d: 2, icon: "i-right" },
  vertical: { a: 0, b: 1, d: 2, icon: "i-down" },
};
export const OFFSET_STEP_MAX = 16;
export const SIDE_MIN = L.MIN_SIDE, SIDE_MAX = L.MAX_SIDE;
export const WALL_MIN_MM = 100;            // the smallest wall a size field accepts (10 cm); the MOQ decides whether it can be ordered

// An axis of the wall in mm clamped to what the page can lay: WALL_MIN_MM .. SIDE_MAX modules. idx 0 = width, 1 = height.
export const clampWallMm = (kit, idx, mm) => Math.min(SIDE_MAX * kit.module_mm[idx], Math.max(WALL_MIN_MM, Math.round(mm)));
export const wallInRange = (kit, w, h) => [w, h].every((v, i) => Number.isInteger(v) && v >= WALL_MIN_MM && v <= SIDE_MAX * kit.module_mm[i]);

export function rampFor(presetId, cols, rows, step) {
  const { a, b, d } = PRESETS[presetId];
  const base = -(Math.min(0, a * cols) + Math.min(0, b * rows));
  return { a, b, d, o: base + step };
}

function presetOf(comp) {
  if (comp.seeds) return { preset: "custom", step: 0 };
  for (const [id, p] of Object.entries(PRESETS)) {
    if (p.a === comp.ramp.a && p.b === comp.ramp.b && p.d === comp.ramp.d) {
      const step = comp.ramp.o - rampFor(id, comp.cols, comp.rows, 0).o;
      if (step >= 0 && step <= OFFSET_STEP_MAX) return { preset: id, step };
    }
  }
  return { preset: "custom", step: 0 };
}

// The surface choices (Canvas / Veil / Grit, Burak 2026-10-26). They ride in the composition code's tag slot (comp.colour); pigment colours are on hold.
// A kit may narrow them with kit.colours (no shipped kit does).
export const finishesFor = (kit, config) => {
  const own = kit.colours ? config.finishes.filter((c) => kit.colours.includes(c.id)) : config.finishes;
  return own.length ? own : (kit.colours ?? []).map((id) => ({ id, swatch: "#cfcac1" }));
};

// The public letter of a mould (descriptor `labels`, lettered like the website's mould list); the plain piece reads as the "plain" word, never an id.
export const mouldIsPlain = (kit, id) => kit.moulds.some((m) => m.id === id && m.role === "plain");
export const mouldLabel = (kit, id, plainWord) => (mouldIsPlain(kit, id) ? plainWord : kit.labels?.[id] ?? id);
// piece counts as [[label, n]], letters first (A, B, ...), the plain piece last
export function mouldCountList(kit, counts, plainWord) {
  return Object.entries(counts).map(([id, n]) => [mouldLabel(kit, id, plainWord), n, mouldIsPlain(kit, id)])
    .sort((a, b) => (a[2] - b[2]) || a[0].localeCompare(b[0])).map(([label, n]) => [label, n]);
}

// a composition is UI-reachable only if it validates against its kit AND lays without a missing mould
export function verify(comp, kit) {
  const clean = L.validate(comp, { [kit.design]: kit });
  const rows = L.expand(clean, kit, true);
  return { comp: clean, rows };
}

// The wall a design opens on (config.default_size, modules): {cols, rows} or null (then the kit's own gallery plan / 8 x 4 stands).
// A fixed plan has no size to choose; an old share code carries its own cols/rows and never reads this.
export const defaultSize = (kit, config) => (L.fixedPlan(kit) ? null : config?.default_size?.[kit.design] ?? null);

// The wall (mm) a design takes on its first pick in the picker, or null to carry the architect's wall: its default size, else (a resizable plan)
// its gallery plan, so the picker and the share-code default show the same wall. Never once the architect typed a size or the design was already laid.
export function firstPickWall(kit, config, { touched = false, remembered = false } = {}) {
  if (touched || remembered || L.fixedPlan(kit)) return null;
  const d = defaultSize(kit, config) ?? (kit.engine === "plan" && L.isResizable(kit) ? kit.plan : null);
  return d && [d.cols * kit.module_mm[0], d.rows * kit.module_mm[1]];
}

export function initialState(kit, config, size = {}) {
  if (size.cols === undefined && size.rows === undefined) size = { ...size, ...defaultSize(kit, config) };
  const offered = finishesFor(kit, config);
  const colour = offered.some((c) => c.id === size.finish) ? size.finish : offered[0].id;      // a design switch keeps the finish when it can (the code's tag slot is `colour`)
  const base = { v: L.minVersion(kit), line: kit.line, design: kit.design, colour, engine: kit.engine,
                 cols: size.cols ?? 8, rows: size.rows ?? 4 };
  if (kit.engine === "plan") {                // a plan has nothing to lay out: a fixed one is its own size, a resizable one starts as the gallery wall
    const sized = L.isResizable(kit) && size.cols !== undefined && size.rows !== undefined;
    return { comp: { ...base, cols: sized ? size.cols : kit.plan.cols, rows: sized ? size.rows : kit.plan.rows }, ui: { preset: "custom", step: 0 } };
  }
  if (kit.engine === "corners") {
    return { comp: { ...base, ramp: rampFor("diag_down", base.cols, base.rows, 0) }, ui: { preset: "diag_down", step: 0 } };
  }
  return { comp: { ...base, bond: "stack", rotate: "none", seed: 0 }, ui: { preset: "custom", step: 0 } };
}

export function stateFromComp(comp) {
  return { comp, ui: comp.engine === "corners" ? presetOf(comp) : { preset: "custom", step: 0 } };
}

const rejected = (state, reason) => ({ ...state, rejected: reason });

// reduce(state, action, ctx): returns the next state, or the SAME state + `rejected` when the change would
// leave the reachable set. ctx = {kits: {design: kit}, config}. The UI disables a control whose action rejects.
export function reduce(state, action, ctx) {
  const kit = ctx.kits[state.comp.design];
  let comp = { ...state.comp };
  let ui = { ...state.ui };
  delete ui.seedsDropped;                         // one-shot notes (a resize that dropped seeds, a ramp turned into seeds): never carried to the next action
  delete ui.seedsFrom;
  switch (action.type) {
    case "design": {
      const next = ctx.kits[action.id];
      if (!next) return rejected(state, `unknown design ${action.id}`);
      // action.wall = [w, h] mm: the architect's real wall carried to the new design (cols/rows = the modules it needs there)
      const wall = action.wall && !L.fixedPlan(next) ? [clampWallMm(next, 0, action.wall[0]), clampWallMm(next, 1, action.wall[1])] : null;
      const cols = wall ? Math.ceil(wall[0] / next.module_mm[0]) : action.cols ?? comp.cols;
      const rows = wall ? Math.ceil(wall[1] / next.module_mm[1]) : action.rows ?? comp.rows;
      const back = action.back;                       // the last layout of that design in this session (relief seeds / ramp, start corner, offset): restored, under today's finish and wall
      if (back?.comp?.design === action.id) {
        let bc = { ...back.comp }, bu = { ...back.ui };
        if (finishesFor(next, ctx.config).some((c) => c.id === comp.colour)) bc.colour = comp.colour;
        if (wall && (wall[0] !== L.wallMm(bc, next)[0] || wall[1] !== L.wallMm(bc, next)[1])) {
          bc = L.fitWall(bc, next, wall[0], wall[1]);
          [bc, bu] = keepSeeds(bc, next, bu);
        }
        return reduceOk({ comp: bc, ui: bu }, next, state);
      }
      const start = initialState(next, ctx.config, { cols, rows, finish: comp.colour });
      if (wall) start.comp = L.fitWall(start.comp, next, wall[0], wall[1]);
      return reduceOk(start, next, state);
    }
    case "finish":
      if (!finishesFor(kit, ctx.config).some((c) => c.id === action.id)) return rejected(state, "finish not offered");
      comp.colour = action.id;
      break;
    case "size": {                                  // whole modules: the wall is then exactly cols x rows modules
      if (L.fixedPlan(kit)) return rejected(state, "a fixed plan has no size");
      const cols = action.cols ?? comp.cols, rows = action.rows ?? comp.rows;
      if (![cols, rows].every((n) => Number.isInteger(n) && n >= SIDE_MIN && n <= SIDE_MAX)) return rejected(state, "size outside the limits");
      comp = L.fitWall(comp, kit, cols * kit.module_mm[0], rows * kit.module_mm[1]);
      [comp, ui] = keepSeeds(comp, kit, ui);
      break;
    }
    case "wall": {                                  // the architect's real wall in mm; modules = what it needs (ceil), the rest is cut
      if (L.fixedPlan(kit)) return rejected(state, "a fixed plan has no size");
      const [cw, ch] = L.wallMm(comp, kit), w = action.w ?? cw, h = action.h ?? ch;
      if (!wallInRange(kit, w, h)) return rejected(state, "wall outside the limits");
      comp = L.fitWall(comp, kit, w, h);
      [comp, ui] = keepSeeds(comp, kit, ui);
      break;
    }
    case "preset":
      if (comp.engine !== "corners" || !PRESETS[action.id]) return rejected(state, "no such preset");
      if (comp.seeds && SEED_PRESETS[action.id]) {      // a seeded wall: a corner preset is one seed in that corner
        comp = L.withSeeds(comp, [SEED_PRESETS[action.id](comp)]);
        ui = { preset: "custom", step: 0 };
        break;
      }
      if (comp.seeds) comp = backToRamp(comp, kit);     // an edge preset is a ramp: the seeds give way to it
      ui = { preset: action.id, step: 0 };
      break;
    case "seeds_on": {                                  // start editing seeds: a diagonal corner ramp becomes its one equal seed, anything else the default seed
      if (comp.engine !== "corners") return rejected(state, "no seeds here");
      if (comp.seeds) return state;
      const eq = L.rampAsSeeds(comp, kit);
      comp = L.withSeeds(comp, eq ?? [DEFAULT_SEED(comp)]);
      ui = { preset: "custom", step: 0, seedsFrom: eq ? "ramp" : "default" };
      break;
    }
    case "seed_add": case "seed_move": case "seed_remove": {
      if (comp.engine !== "corners" || !comp.seeds) return rejected(state, "no seeds here");
      const same = (a, b) => a[0] === b[0] && a[1] === b[1];
      const at = action.type === "seed_add" ? null : comp.seeds.findIndex((q) => same(q, action.from ?? action.at));
      if (at === -1) return rejected(state, "no such seed");
      if (action.type === "seed_remove" && comp.seeds.length < 2) return rejected(state, "at least one seed");
      if (action.type === "seed_add" && comp.seeds.length >= L.SEEDS_MAX) return rejected(state, "seed limit");
      const rest = comp.seeds.filter((_, k) => k !== at);
      comp = L.withSeeds(comp, action.type === "seed_remove" ? rest : [...rest, action.to ?? action.at]);
      ui = { preset: "custom", step: 0 };
      break;
    }
    case "offset":
      if (comp.engine !== "corners" || ui.preset === "custom") return rejected(state, "no offset here");
      ui.step += action.delta;
      if (ui.step < 0 || ui.step > OFFSET_STEP_MAX) return rejected(state, "offset out of range");
      break;
    case "bond":
      if (comp.engine !== "bond") return rejected(state, "not a bond kit");
      comp.bond = action.id;
      if (comp.bond !== "stack" && comp.rotate === "shuffle") { comp.rotate = "none"; comp.seed = 0; }
      break;
    case "rotate":
      if (comp.engine !== "bond") return rejected(state, "not a bond kit");
      comp.rotate = action.id;
      if (action.id === "shuffle") { comp.bond = "stack"; comp.seed = action.seed ?? 1; } else comp.seed = 0;
      break;
    case "reshuffle":
      if (comp.engine !== "bond" || comp.rotate !== "shuffle") return rejected(state, "not shuffling");
      comp.seed = action.seed;
      break;
    default:
      return rejected(state, `unknown action ${action.type}`);
  }
  if (comp.engine === "corners" && ui.preset !== "custom") comp.ramp = rampFor(ui.preset, comp.cols, comp.rows, ui.step);
  return reduceOk({ comp, ui }, kit, state);
}

// The corner presets of a seeded wall: one seed in that corner (vertex coordinates; y runs down)
export const SEED_PRESETS = { diag_down: () => [0, 0], diag_up: (comp) => [0, comp.rows] };
// Where a seed starts when the wall had none that fits one point (an edge ramp): the top-left corner = the diag_down preset
export const DEFAULT_SEED = () => [0, 0];

// A seeded wall after a size change: the seeds that still lay (L.fitSeeds); ui.seedsDropped says how many gave way
function keepSeeds(comp, kit, ui) {
  if (!comp.seeds) return [comp, ui];
  const [fit, dropped] = L.fitSeeds(comp, kit);
  return [fit, dropped ? { ...ui, seedsDropped: dropped } : ui];
}

// A seeded wall back to a ramp-coded one (an edge preset): the lowest code version that carries it
function backToRamp(comp, kit) {
  const { seeds, ...rest } = comp;
  return { ...rest, v: comp.wall_mm ? 3 : L.minVersion(kit), ramp: rampFor("diag_down", comp.cols, comp.rows, 0) };
}

function reduceOk(next, kit, prev) {
  try {
    const { comp } = verify(next.comp, kit);
    return { comp, ui: next.ui };
  } catch (e) {
    return rejected(prev, e.message);
  }
}

// ?c=<code> -> {state, error}. No code = default; a bad code = default + the reason.
export function resolveOpenState(search, ctx) {
  const params = new URLSearchParams(search);
  const fallback = () => stateFromComp(L.decode(ctx.config.default_code, ctx.kits));
  const code = params.get("c");
  if (!code) {                                                    // no code: the default wall, or the design a link asked for (?d=) on its own default wall
    const asked = designFromSearch(search, ctx.config, ctx.kits), start = fallback();
    if (!asked || asked === start.comp.design) return { state: start, error: null, code: null, kind: null };
    const next = reduce(start, { type: "design", id: asked, wall: firstPickWall(ctx.kits[asked], ctx.config) }, ctx);
    return { state: next.rejected ? start : next, error: null, code: null, kind: null };
  }
  try {
    const comp = L.decode(code, ctx.kits);
    verify(comp, ctx.kits[comp.design]);
    // an old code carries a pigment colour in the tag slot: the wall opens in the first finish, with a soft notice
    const card = finishesFor(ctx.kits[comp.design], ctx.config);
    if (!card.some((c) => c.id === comp.colour)) {
      return { state: stateFromComp({ ...comp, colour: card[0].id }), error: `colour ${comp.colour} is not a finish`, code, kind: "finish" };
    }
    return { state: stateFromComp(comp), error: null, code, kind: null };
  } catch (e) {
    return { state: fallback(), error: e.message, code, kind: "code" };
  }
}

// The layout sentence of a plan kit: a fixed plan says so; a resizable one says what the wall does at another size (its resize method)
// A kit with resize.flow (Rotor, Plates) says it is laid again for the typed size, at every size it has baked (comp given); else its resize method
export const planTextKey = (kit, comp) => (L.fixedPlan(kit) ? "layout_plan" : L.coursesKit(kit) ? "layout_courses"
  : kit.resize.flow && (!comp || L.flowBaked(kit, comp.cols, comp.rows)) ? "layout_plan_flow" : `layout_plan_${kit.resize.method}`);
export const wallMetres = (comp, kit) => L.wallMm(comp, kit).map((v) => v / 1000);
// What is bought, as price.js reads it. A staggered-course kit supplies the plates its pieces are cut from (its cuts count at every size) and always reports the wall beside the supply.
export function wallOrder(comp, kit, rows) {
  const courses = L.coursesKit(kit);
  return { cols: comp.cols, rows: comp.rows, module_mm: kit.module_mm, pieces: pieceCounts(rows), wall_mm: courses ? L.wallMm(comp, kit) : comp.wall_mm,
           cut_pieces: courses || comp.wall_mm ? cutCount(wallCuts(comp, kit)) : 0, ...(courses ? { supplied_modules: L.suppliedModules(comp, kit) } : {}) };
}
// The size line's key and vars: a staggered-course wall has no cols x rows grid to name.
export const sizeKey = (comp, kit) => (L.coursesKit(kit) ? ["size_courses", { rows: comp.rows, n: L.suppliedModules(comp, kit) }] : ["size_modules", { cols: comp.cols, rows: comp.rows }]);
// A plan carries its own cut widths (composeHeight crops them); a staggered bond is not lit yet.
// The kits the picker offers: config.designs in its order; a design with no baked kit is skipped, a baked kit not listed is hidden.
export const publicKits = (index, config) => ({ ...index, kits: config.designs.map((d) => index.kits.find((k) => k.design === d)).filter(Boolean) });
export const lightSupported = (rows, comp) => comp?.engine === "plan" || rows.every((r) => r.length === rows[0].length);
// Every piece's [left, right, top, bottom] cut: the real wall is cropped from the whole modules in the light view, the rooms and the sheets.
export const wallCuts = (comp, kit) => L.cuts(comp, kit);
// Piece (r, c) of a cuts() output as fractions of the real wall: {x0, w, y0, h}, y0 from the top (cuts rows are top first).
export function pieceBox(cutRows, r, c, moduleMm, wallMmSize) {
  const [mw, mh] = moduleMm, [W, H] = wallMmSize, piece = cutRows[r][c];
  const x0 = cutRows[r].slice(0, c).reduce((a, p) => a + mw - p[0] - p[1], 0);
  const y0 = cutRows.slice(0, r).reduce((a, row) => a + mh - row[0][2] - row[0][3], 0);
  return { x0: x0 / W, w: (mw - piece[0] - piece[1]) / W, y0: y0 / H, h: (mh - piece[2] - piece[3]) / H };
}

// What a cut-to-fit wall cuts, for the fit line and the quiet thin-cut note: {fit: [{axis, side, n, mm}], thin: [{edge, mm}]}.
// fit: per axis that is cut, the side it is cut on, the modules the axis needs and the laid size (mm) of its cut column / row.
export function cutNotes(comp, kit) {
  if (!comp.wall_mm) return { fit: [], thin: [] };      // a fixed plan never carries wall_mm
  const [mw, mh] = kit.module_mm, [W, H] = comp.wall_mm, [sideH, sideV] = L.cutSides(comp, kit);
  const fit = [];
  if (W !== comp.cols * mw && !L.coursesKit(kit)) fit.push({ axis: "w", side: sideH, n: comp.cols, mm: W - (comp.cols - 1) * mw });
  if (H !== comp.rows * mh) fit.push({ axis: "h", side: sideV, n: comp.rows, mm: H - (comp.rows - 1) * mh });
  return { fit, thin: L.thinCuts(comp, kit) };
}

// A design (module set) is priced only when config.pricing.sets has a number for it (#106); without one there is no money anywhere.
export const priced = (config, comp) => rateFor(config.pricing, comp.design) !== null;

// ---------------------------------------------------------------------------- pure: copy + share
export function t(strings, locale, key, vars = {}, config = {}) {
  const table = strings.locales[locale] ?? strings.locales[strings.default_locale];
  const raw = table[key] ?? strings.locales[strings.default_locale][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, name) => {
    if (name === "line") return lineNameFor(config, locale) ?? m;
    return name in vars ? String(vars[name]) : m;
  });
}

export function shareUrl(base, code, locale, light = null) {
  const u = new URL(base);
  u.search = "";
  u.hash = "";
  u.searchParams.set("c", code);
  u.searchParams.set("l", locale);
  if (light) { u.searchParams.set("city", light.city); u.searchParams.set("f", String(light.facing)); }
  return u.toString();
}

// ?city=&f= -> the wall's light; anything not on the city list or the compass falls back to the defaults
export function lightFromSearch(search, config) {
  const p = new URLSearchParams(search), f = Number(p.get("f"));
  return {
    city: config.light.cities[p.get("city")] ? p.get("city") : config.light.default_city,
    facing: p.get("f") !== null && Number.isInteger(f) && f >= 0 && f < 360 && f % 45 === 0 ? f : config.light.default_facing,
  };
}

export function buildMessage(strings, locale, config, info) {
  const size = info.size ?? t(strings, locale, "size_modules", { cols: info.cols, rows: info.rows }, config);
  const msg = t(strings, locale, info.cut ? "msg_template_cut" : "msg_template", { ...info, size }, config)      // info.cut: the wall is cut from whole modules
    .split("\n").filter((ln) => ln !== "").join("\n");                                              // an unpriced set leaves its {price} line empty: drop it
  const extra = [info.preview ? info.preview : "", info.by ? t(strings, locale, "msg_by", { by: info.by }, config) : "", info.place ? t(strings, locale, "msg_place", { place: info.place }, config) : ""].filter(Boolean);
  if (!extra.length) return msg;
  const lines = msg.split("\n");                                      // both templates end "Kod: ..." / "Bağlantı: ...": the name and the wall's place go in just above them
  lines.splice(lines.length - 2, 0, ...extra);
  return lines.join("\n");
}


export function fmtDec(n, digits, locale) {
  return n.toFixed(digits).replace(".", locale === "tr" ? "," : ".");
}

export function fmtMetres(n, locale) {
  return n.toFixed(2).replace(/\.?0+$/, "").replace(".", locale === "tr" ? "," : ".");
}

// a laid size in mm for a sentence: 200 -> "200", 133.33 -> "133,3" (locale decimal mark, one decimal at most)
export function fmtMm(n, locale) {
  return String(+n.toFixed(1)).replace(".", locale === "tr" ? "," : ".");
}

export function pickLocale(search, config, strings) {
  const l = new URLSearchParams(search).get("l");
  return l && strings.locales[l] ? l : config.default_locale;
}

export const hexToRgb01 = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
export const fmtDateDMY = (d = new Date()) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

// The price sentence of the DM: total incl. KDV + price date (+ validity only when config sets it); a size under the MOQ asks.
// An unpriced set has no price sentence at all (empty string; buildMessage drops the line).
export function priceLine(strings, locale, config, { unpriced, orderable, totalText, date, exLogistics = false, moq = null }) {
  const T = (k, v) => t(strings, locale, k, v, config);
  if (unpriced) return "";
  if (!orderable) return T("msg_price_short", { moq });
  const days = config.pricing.validity_days;
  return [T(exLogistics ? "msg_price_ex_logistics" : "msg_price", { total: totalText, date }), days ? T("msg_valid", { days }) : ""].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------- pure: client view, lead, instagram
export const isClientView = (search) => new URLSearchParams(search).get("view") === "client";

export const BY_MAX = 60;
// "Prepared by": free text from the architect, carried in the client link. Control characters out, whitespace collapsed, capped.
export const cleanBy = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, BY_MAX);

export function clientUrl(base, code, locale, by = "", light = null) {
  const u = new URL(shareUrl(base, code, locale, light));
  u.searchParams.set("view", "client");
  const name = cleanBy(by);
  if (name) u.searchParams.set("by", name);
  return u.toString();
}

// What the page shows. The client view is read-only: wall, light, design, finish, size, story; nothing that prices,
// quantifies or edits, and it never writes the address bar (so changing the light cannot rewrite the code).
export function viewModel(state, kit, view) {
  const client = view === "client";
  const [widthM, heightM] = wallMetres(state.comp, kit);
  return {
    client, design: state.comp.design, colour: state.comp.colour, widthM, heightM, writesUrl: !client,
    sections: { wall: true, light: true, summary: client, story: client,
                design: !client, layout: !client, size: !client, price: !client, send: !client, share: !client },
  };
}

// Lead record: {code, ts, locale, channel} only, fire-and-forget. endpoint null/empty => no network call at all.
// fetchFn is injected; a throwing or rejecting fetch never reaches the caller.
export function sendLead(fetchFn, config, { code, locale, channel }, now = () => new Date()) {
  const endpoint = config?.lead?.endpoint;
  if (typeof endpoint !== "string" || !/^https?:\/\//.test(endpoint)) return Promise.resolve(false);
  const body = JSON.stringify({ code, ts: now().toISOString(), locale, channel });
  return Promise.resolve()
    .then(() => fetchFn(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }))
    .then(() => true, () => false);
}

export function instagramUrl(config, message) {
  const base = config.dm.instagram_url;
  if (config.dm.instagram_prefill !== true) return base;
  return `${base}${base.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;
}

// ---------------------------------------------------------------------------- pure: sheet helpers
// Opening hour: the hour of today's direct-sun band with the most raking light on THIS wall that still lights the face, i.e. the
// LOWEST light elevation above the wall plane that is at or above OPEN_WALL_EL_MIN (longest real relief shadow). Below ~30 deg the face
// renders near-black, so when no hour clears it (band edges, a wall that is lit only at a graze) the band's HIGHEST wall-plane elevation
// is used; a wall that never gets direct sun opens at solar noon (highest sun). Never `fallback` unless the sun never clears the horizon.
// solar = the SunStudioSolar object; date = [y, m, d].
export const OPEN_WALL_EL_MIN = 30;   // deg of light above the wall plane; below it the face goes murky
export const OPEN_SUN_EL_MIN = 3;     // deg of sun above the horizon
export function openingHour(solar, date, city, facing, fallback, step = 0.25) {
  const [y, m, d] = date;
  let raking = null, highest = null, noon = null;
  for (let h = 0; h <= 24; h += step) {
    const sun = solar.solarPosition(y, m, d, h, city.lat, city.lon, city.utc_offset);
    if (sun.elDeg < OPEN_SUN_EL_MIN) continue;
    if (noon === null || sun.elDeg > noon.el) noon = { h, el: sun.elDeg };
    const w = solar.wallLocalAngle(sun.azDeg, sun.elDeg, facing);
    if (!w.directLit) continue;
    if (highest === null || w.elPrime > highest.el) highest = { h, el: w.elPrime };
    if (w.elPrime >= OPEN_WALL_EL_MIN && (raking === null || w.elPrime < raking.el)) raking = { h, el: w.elPrime };
  }
  return (raking ?? highest ?? noon)?.h ?? fallback;
}

export function parseMetres(text) {                                // null = not a usable size: empty, no digits, a minus sign, or zero (the field keeps its value)
  const raw = String(text);
  const m = parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(m) && m > 0 && !/^\s*[-−–—]/.test(raw) ? m : null;
}

// ?t=4.5x1.6 : the architect's wall in metres, kept in the address bar only while a fixed plan is picked (the code carries the wall
// otherwise), so switching back from the plan restores it. null if absent or unreadable.
export function parseTarget(search) {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(new URLSearchParams(search).get("t") ?? "");
  if (!m) return null;
  const [w, h] = [parseFloat(m[1]), parseFloat(m[2])];
  return w > 0 && h > 0 && w <= 100 && h <= 100 ? [w, h] : null;
}
export const targetParam = ([w, h]) => `${+w.toFixed(3)}x${+h.toFixed(3)}`;
export const targetDiffers = (target, actual) => target.some((v, i) => Math.abs(v - actual[i]) >= 0.005);

// "Complete to the minimum order": the smallest whole-module size at or above the current one that meets the MOQ; ties go to the
// size whose aspect stays closest to the current wall (so the shorter side grows). null if no size within the limits meets it.
// modulesOf(c, r) = what that size supplies, never fewer than c x r (a staggered-course kit lays more than its grid).
export function completeToMoq(cols, rows, moduleMm, moqM2, hi = SIDE_MAX, modulesOf = (c, r) => c * r) {
  const [mw, mh] = moduleMm, moqMm2 = Math.round(moqM2 * 1_000_000), aspect = Math.log((cols * mw) / (rows * mh));
  let best = null;
  for (let c = cols; c <= hi; c++) {
    for (let r = rows; r <= hi; r++) {
      if (best && c * r * mw * mh > best.area) continue;
      const area = modulesOf(c, r) * mw * mh;
      if (area < moqMm2) continue;
      const skew = Math.abs(Math.log((c * mw) / (r * mh)) - aspect);
      if (best === null || area < best.area || (area === best.area && skew < best.skew)) best = { cols: c, rows: r, area, skew };
    }
  }
  return best && { cols: best.cols, rows: best.rows };
}

// Detail A: the busiest module: the piece whose baked heightmap has the highest relief range (max - min, mm), at its cell nearest the wall centre.
// relief = {mouldId: range_mm} MEASURED from the baked heightmaps (measuredRelief), never the manifest's nominal relief_mm (a plain mould can carry
// the kit's nominal figure: Rondeau's blank "0" says 18 mm and is flat). A piece is its whole mould, turned: a turn never changes the range.
// Ranges within RELIEF_TIE_MM of each other are tied (Accelerando's S0..S3 read 19.87-19.95 mm: one relief, not four); ties: first id, then nearest the centre.
// rows = expand() output; cutRows = cuts() (a cut piece, in width or height, is never Detail A: the detail draws the whole mould).
// Returns {r, c, id, k} or null for a flat wall.
export const RELIEF_TIE_MM = 0.5;
const reliefBand = (mm) => Math.round(mm / RELIEF_TIE_MM);
export function measuredRelief(moulds) {
  return Object.fromEntries(Object.entries(moulds).map(([id, m]) => {
    let lo = Infinity, hi = -Infinity;
    for (const v of m.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return [id, hi - lo];
  }));
}
export function detailCell(rows, relief, cutRows = null) {
  let id = null;
  for (const mid of [...new Set(rows.flat().map(([m]) => m))].sort()) {
    if ((relief[mid] ?? 0) > 0 && (id === null || reliefBand(relief[mid]) > reliefBand(relief[id]))) id = mid;
  }
  if (id === null) return null;
  const cr = (rows.length - 1) / 2, cc = (rows[0].length - 1) / 2;
  let best = null;
  rows.forEach((row, r) => row.forEach(([m, k], c) => {
    if (m !== id || (cutRows && cutRows[r][c].some((v) => v))) return;
    const dist = (r - cr) ** 2 + (c - cc) ** 2;
    if (best === null || dist < best.dist) best = { r, c, id, k, dist };
  }));
  return best && { r: best.r, c: best.c, id: best.id, k: best.k };
}

// The sun band as runs of one state: [{state: "sun"|"shade"|"night", from, to}] over 0..24 h.
export function sunRuns(solar, date, city, facing, steps = 96) {
  const [y, m, d] = date;
  const runs = [];
  for (let i = 0; i < steps; i++) {
    const h = (i + 0.5) * 24 / steps;
    const sun = solar.solarPosition(y, m, d, h, city.lat, city.lon, city.utc_offset);
    const state = sun.elDeg <= 0 ? "night" : solar.wallLocalAngle(sun.azDeg, sun.elDeg, facing).directLit ? "sun" : "shade";
    const last = runs[runs.length - 1];
    if (last && last.state === state) last.to = (i + 1) * 24 / steps;
    else runs.push({ state, from: i * 24 / steps, to: (i + 1) * 24 / steps });
  }
  return runs;
}

// view = "client" is carried on every link of the issued set, so the client never reaches a priced page (A-03 is not linked at all).
// light = {city, facing}: the wall's city and facing travel on every sheet link (the same ?city=&f= that lightFromSearch reads), so A-02 / A-03 / A-00 show the light the architect set.
const lightQ = (light) => (light ? `&city=${encodeURIComponent(light.city)}&f=${light.facing}` : "");
export const roomUrl = (code, room, locale, view = "architect", by = "", light = null) =>
  `room.html?c=${encodeURIComponent(code)}&room=${encodeURIComponent(room)}&l=${locale}${view === "client" ? `&view=client${cleanBy(by) ? `&by=${encodeURIComponent(cleanBy(by))}` : ""}` : ""}${lightQ(light)}`;
export const layingUrl = (code, locale, light = null) => `laying.html?c=${encodeURIComponent(code)}&l=${locale}${lightQ(light)}`;
export const materialUrl = (code, locale, view = "architect", by = "", light = null) =>
  `material.html?c=${encodeURIComponent(code)}&l=${locale}${view === "client" ? `&view=client${cleanBy(by) ? `&by=${encodeURIComponent(cleanBy(by))}` : ""}` : ""}${lightQ(light)}`;

// Frame the ramp (corners engine only): where the relief of THIS composition ends and the flat starts, in laid metres, read off the
// expanded modules and the cut sizes (never a preset's nominal length). axis "w" when the ramp runs along the width, else "h".
// from = the edge or corner the relief starts at: tl tr bl br (both axes ramp) or l r t b. null for any other engine.
// A module is flat when its corner classes are all equal (the kit's plain mould). none: no relief anywhere; all: no flat anywhere.
//
// Seeded walls (several points; a single axis means nothing): {seeds: n, reach, reachMm, reliefM2, flatM2, none, all}: how many points,
// how far the relief runs from each (range_steps modules, a step per module) and the laid relief / flat AREAS in m2, read off the same cells.
export function rampFrame(comp, kit, rows = null, cutRows = null) {
  if (comp.engine !== "corners") return null;
  rows ??= L.expand(comp, kit);
  cutRows ??= L.cuts(comp, kit);
  const flatIds = new Set(kit.moulds.filter((m) => m.corners.every((c) => c === m.corners[0])).map((m) => m.id));
  if (comp.seeds) {
    const [mw, mh] = kit.module_mm;
    let relief = 0, flat = 0;
    rows.forEach((row, r) => row.forEach(([id], c) => {
      const cut = cutRows[r][c], area = (mw - cut[0] - cut[1]) * (mh - cut[2] - cut[3]);
      if (flatIds.has(id)) flat += area; else relief += area;
    }));
    return { seeds: comp.seeds.length, reach: kit.range_steps, reachMm: kit.range_steps * mw, reliefM2: relief / 1e6, flatM2: flat / 1e6, none: relief === 0, all: flat === 0 };
  }
  const { a, b } = comp.ramp, axis = a !== 0 ? "w" : "h", [mw, mh] = kit.module_mm;
  const n = axis === "w" ? comp.cols : comp.rows;
  const flat = Array.from({ length: n }, (_, k) => (axis === "w" ? rows.map((r) => r[k]) : rows[k]).every(([id]) => flatIds.has(id)));
  const size = (k) => (axis === "w" ? mw - cutRows[0][k][0] - cutRows[0][k][1] : mh - cutRows[k][0][2] - cutRows[k][0][3]);
  let reliefMm = 0, flatMm = 0, reliefN = 0;
  flat.forEach((f, k) => { if (f) flatMm += size(k); else { reliefMm += size(k); reliefN++; } });
  const h = a === 0 ? "" : a > 0 ? "l" : "r", v = b === 0 ? "" : b > 0 ? "t" : "b";
  return { axis, reliefMm, flatMm, reliefN, flatN: n - reliefN, from: a !== 0 && b !== 0 ? v + h : h || v,
           none: reliefN === 0, all: reliefN === n, reliefFirst: axis === "h" || a > 0 };
}

// The stretches of the day in which direct sun reaches the wall, to the minute: [{from, to}] in hours. The same sunRuns() the sun band draws
// (state "sun" = sun above the horizon and the wall directly lit), only at 1440 steps instead of 96.
export function sunWindows(solar, date, city, facing) {
  return sunRuns(solar, date, city, facing, 1440).filter((r) => r.state === "sun").map(({ from, to }) => ({ from, to }));
}

// ---------------------------------------------------------------------------- pure: relief seeds (the points UI)
// Where vertex (x, y) lies on the laid wall, in mm from its top-left corner. The cut column / row (when the wall is cut to fit) is
// the one at the side L.cutSides picks, so a vertex sits at x * module - (what the first column loses when the cut is on the left).
export function vertexMm(comp, kit, x, y) {
  const [mw, mh] = kit.module_mm, [W, H] = L.wallMm(comp, kit), [sideH, sideV] = L.cutSides(comp);
  const ew = comp.cols * mw - W, eh = comp.rows * mh - H;
  return [x * mw - (sideH === "left" ? ew : 0), y * mh - (sideV === "top" ? eh : 0)];
}

// A vertex is on the drawn wall when its position lies inside it (the vertex line of a cut edge column falls outside)
export function vertexVisible(comp, kit, x, y) {
  const [px, py] = vertexMm(comp, kit, x, y), [W, H] = L.wallMm(comp, kit);
  return px >= 0 && px <= W && py >= 0 && py <= H;
}

// The points a tap can use right now: seedPoints (the validator's) limited to what is drawn. `without` = the seed being moved.
export function offeredPoints(comp, kit, without = null) {
  return L.seedPoints(comp, kit, without).filter(([x, y]) => vertexVisible(comp, kit, x, y));
}

// A seed's distance from the wall's whole edges, for a sentence: {x, xFrom: "left"|"right", y, yFrom: "top"|"bottom", out}.
// Measured from the edges that are NOT cut, so the numbers count whole modules; an axis that is not cut counts from the left / top.
export function seedPlace(comp, kit, [sx, sy]) {
  const [sideH, sideV] = L.cutSides(comp), [W, H] = L.wallMm(comp, kit);
  const fromLeft = sideH === "right" || W === comp.cols * kit.module_mm[0], fromTop = sideV === "bottom" || H === comp.rows * kit.module_mm[1];
  return { x: fromLeft ? sx : comp.cols - sx, xFrom: fromLeft ? "left" : "right", y: fromTop ? sy : comp.rows - sy, yFrom: fromTop ? "top" : "bottom",
           out: sx < 0 || sx > comp.cols || sy < 0 || sy > comp.rows };
}

// The next offered point from `from` in a direction (left | right | up | down): in that half-plane, the smallest along + 2 * across,
// ties to the shorter way along then reading order. null when nothing lies that way.
export function nextPoint(points, from, dir) {
  const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
  let best = null;
  for (const p of points) {
    const along = (p[0] - from[0]) * dx + (p[1] - from[1]) * dy, across = Math.abs((p[0] - from[0]) * dy) + Math.abs((p[1] - from[1]) * dx);
    if (along <= 0) continue;
    const score = along + 2 * across;
    if (best === null || score < best.score || (score === best.score && along < best.along)) best = { p, score, along };
  }
  return best && best.p;
}

// The point "Nokta ekle" uses: of the offered points, the one farthest from the existing seeds (the guaranteed-safe pairs are far
// apart), ties to the one nearest the wall's centre, then reading order. null when nothing is offered.
export function defaultSeedPoint(comp, points) {
  const dist = (p) => Math.min(...comp.seeds.map((q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1])));
  let best = null;
  for (const p of points) {
    const far = dist(p), mid = (p[0] - comp.cols / 2) ** 2 + (p[1] - comp.rows / 2) ** 2;
    if (best === null || far > best.far || (far === best.far && mid < best.mid)) best = { p, far, mid };
  }
  return best && best.p;
}

// Snap a tap (mm from the wall's top-left) to the nearest target: a seed or an offered point. `maxMm` is how far a tap may land from it.
// Seeds win ties. Returns {kind: "seed", index} | {kind: "point", point} | null.
export function snapTap(comp, kit, points, xMm, yMm, maxMm) {
  let best = null;
  const consider = (kind, x, y, extra) => {
    const [px, py] = vertexMm(comp, kit, x, y), d = Math.hypot(px - xMm, py - yMm);
    if (d <= maxMm && (best === null || d < best.d - 1e-9)) best = { d, kind, ...extra };
  };
  comp.seeds.forEach((q, index) => consider("seed", q[0], q[1], { index }));
  for (const point of points) consider("point", point[0], point[1], { point });
  return best && (best.kind === "seed" ? { kind: "seed", index: best.index } : { kind: "point", point: best.point });
}

// Can seed `index` be taken away: at least one must stay, and the rest must still lay
export const removable = (comp, kit, index) => comp.seeds.length > 1 && L.lays(L.withSeeds(comp, comp.seeds.filter((_, k) => k !== index)), kit);

// ---------------------------------------------------------------------------- browser UI
const COMPASS = [["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SW", 225], ["W", 270], ["NW", 315]];
const DIMCOL = 64;                 // px: the vertical dimension string's column on desktop (style.css --dimcol; 0 on a phone, where both strings sit under the wall)
const DETAIL_SCALE = 4;            // Detail A is drawn at this multiple of the module's size in the elevation
const $ = (s) => document.querySelector(s);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;     // an absent child, never the text "null"
    node.append(kid instanceof Node ? kid : document.createTextNode(kid));
  }
  return node;
}

const SVGNS = "http://www.w3.org/2000/svg";
function icon(id) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "ic");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVGNS, "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

const isDesktop = () => window.matchMedia("(min-width: 960px)").matches;
const scrollBehavior = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");   // no animated scrolling when the user asked for none
// A re-render replaces whole control groups; keyboard focus must land on the same control in the new DOM (not on <body>).
const FOCUS_HOSTS = ["#designs", "#finishes", "#q-designs", "#q-finishes", "#presets", "#bonds", "#rotates", "#price", "#q-sum", "#dock", "#a-set", "#c-set", "#rooms-idx"];
const FOCUSABLE = "summary, button, a[href], input, select";      // summary: a box's heading line is a stop of its own
function focusMark() {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  for (const h of FOCUS_HOSTS) {
    const host = document.querySelector(h);
    if (host && host.contains(a)) return { host: h, i: [...host.querySelectorAll(FOCUSABLE)].indexOf(a) };
  }
  return { el: a };
}
function focusRestore(m) {
  if (!m) return;
  const focus = (n) => n?.focus({ preventScroll: true });
  if (m.el) {                                              // a static control that may have become disabled (the offset stepper at its limit)
    if (m.el.disabled) focus([...m.el.parentElement.querySelectorAll("button:not(:disabled)")].find((b) => b !== m.el));
    return;
  }
  const host = document.querySelector(m.host);
  if (!host || host.contains(document.activeElement) || m.i < 0) return;
  const items = [...host.querySelectorAll(FOCUSABLE)];
  const at = items[Math.min(m.i, items.length - 1)];
  focus(at && !at.disabled ? at : items.find((n) => !n.disabled));
}

async function main() {
  const roomsP = fetchJson("rooms/index.json").catch(() => null);          // read only; A-02 lists them. Asked for at once, not after the kits: the first text waits on the kits alone
  const [config, strings, allKits] = await Promise.all([fetchJson("config.json"), fetchJson("strings.json"), fetchJson("kits/index.json")]);
  const index = publicKits(allKits, config);                              // the Studio Designs only; Plates, THROAT and 093 stay on disk, off the page
  const manifests = {}, kits = {};
  await Promise.all(index.kits.map(async (k) => {
    const man = await fetchJson(`kits/${k.manifest}`);
    const dir = `kits/${k.manifest.split("/")[0]}`;
    manifests[man.design] = { man, dir };
    kits[man.design] = man.descriptor;
    if (man.descriptor.resize?.flow) man.descriptor.resize.flow_data = await fetchJson(`${dir}/${man.descriptor.resize.flow.file}`);      // the lays baked per wall size (read before any code opens)
  }));
  const rooms = await roomsP;
  const ctx = { kits, config };
  const open = resolveOpenState(location.search, ctx);
  const ui = {
    state: open.state, locale: pickLocale(location.search, config, strings), speed: "pickup",
    light: { ...lightFromSearch(location.search, config), hour: config.light.default_hour },
    error: open.error, errorKind: open.kind, originalCode: open.code, shownFinish: open.state.comp.colour,
    view: null, detailView: null, detail: null, seq: 0, wall: null, by: "", changeNote: null, target: null, designMemory: {}, sweep: { state: "pending" },
    pts: { on: false, sel: null, focus: null, msg: null, points: [], cache: null, refocus: null },      // relief points: edit mode, the selected seed, the last touched place
  };
  {                                                      // the architect's wall in metres. The code carries it (wall_mm); ?t= only keeps it while a fixed plan is picked, so a switch back restores it
    const k0 = kits[open.state.comp.design], actual = wallMetres(open.state.comp, k0);
    ui.target = L.fixedPlan(k0) ? parseTarget(location.search) ?? actual : actual;
  }
  const vm = viewModel(open.state, kits[open.state.comp.design], isClientView(location.search) ? "client" : "architect");
  ui.quote = !vm.client && isQuoteMode(location.search);
  ui.qTyped = open.code ? [true, true] : [false, false];   // the quote screen asks for the real wall: a default wall is never quoted by accident; a saved code already is a wall
  document.documentElement.dataset.mode = ui.quote ? "quote" : "full";
  const tx = (key, vars) => t(strings, ui.locale, key, vars, config);
  const mouldCache = new Map();
  const canvas = $("#gl");
  try { ui.view = createLightView(canvas, window.SunStudioGrazeShader); } catch (e) { ui.viewError = e.message; }
  try { ui.detailView = ui.view ? createLightView($("#gl-detail"), window.SunStudioGrazeShader) : null; } catch (e) { ui.detailView = null; }

  // Native tint: when the light view can tint (light.js supportsTint), the swatch goes in through setTint and the CSS multiply overlay is dropped.
  ui.tintNative = ui.view?.supportsTint === true;
  document.body.classList.toggle("native-tint", ui.tintNative);
  const applyTint = () => {
    if (!ui.tintNative) return;
    const rgb = hexToRgb01(curFinish().swatch);
    ui.view.setTint(rgb);
    if (ui.detailView?.supportsTint) ui.detailView.setTint(rgb);
  };

  const act = (action) => {
    const next = reduce(ui.state, action, ctx);
    if (next.rejected) return false;
    if (action.type !== "design") ui.changeNote = null;
    if (action.type === "wall" || action.type === "size") ui.wallTouched = true;      // a typed wall travels to the next design; an untouched one gets that design's default size
    if (action.type === "finish") ui.error = null;       // "Canvas gösteriliyor" stops being true once a finish is picked
    ui.state = next;
    if (next.ui.seedsDropped) {                          // a resize the seeds could not follow whole: say so where the fit is said, and aloud
      ui.changeNote = { key: "seeds_dropped", vars: { k: next.ui.seedsDropped } };
      announce(tx("seeds_dropped", { k: next.ui.seedsDropped }));
    }
    render({ recompose: true });
    return true;
  };
  const trial = (action) => !reduce(ui.state, action, ctx).rejected;
  const curKit = () => kits[ui.state.comp.design];
  const setDesignCell = (node, text, kit) => node.replaceChildren(text, ...(kit.preview ? [el("small", { class: "preview-copy" }, tx("preview_label"))] : []));
  const moqText = (m) => (m === null ? "" : fmtDec(m, m % 1 ? 1 : 0, ui.locale));   // 7,5 in Turkish, 7.5 in English
  const leadWeeks = (q) => q.lead_time_weeks !== null;                  // no lead time is stated until Burak sets one (DEC-14): the quote carries it
  const leadShort = (q) => (leadWeeks(q) ? tx("lead_short", { weeks: q.lead_time_weeks }) : tx("lead_quote"));
  const finishLabel = (id) => tx("finish_label", { name: tx(`finish_${id}`), kind: tx(`finish_kind_${id}`) });       // "Canvas · boyaya hazır"
  const curFinish = () => { const cols = finishesFor(curKit(), config); return cols.find((c) => c.id === ui.state.comp.colour) ?? cols[0]; };

  // -- view: nodes that belong to the other view are removed, not hidden (no price in a client DOM)
  for (const n of document.querySelectorAll("[data-view]")) {
    if ((n.dataset.view === "client") !== vm.client) n.remove();
  }
  document.body.dataset.view = vm.client ? "client" : "architect";

  // -- light date and the opening hour (once, on first load)
  const today = () => { const d = new Date(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };
  const lightDate = () => (config.light.date ? config.light.date.split("-").map(Number) : today());
  const cityOf = () => config.light.cities[ui.light.city];
  ui.light.hour = openingHour(window.SunStudioSolar, lightDate(), cityOf(), ui.light.facing, config.light.default_hour);

  // -- static text
  function applyStrings() {
    document.documentElement.lang = ui.locale;
    document.title = tx("page_title");
    for (const n of document.querySelectorAll("[data-s]")) n.textContent = tx(n.dataset.s);
    for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === ui.locale));
    for (const n of document.querySelectorAll("[data-aria]")) n.setAttribute("aria-label", tx(n.dataset.aria));
  }

  // -- the set: A-01 elevation, A-02 room, A-03 laying map; one swipeable strip + its index
  const strip = $("#strip");
  const panes = [...strip.querySelectorAll(".pane")];
  let activePane = panes[0], navTo = null, navTimer = 0;
  const fitStrip = () => { strip.style.height = `${activePane.offsetHeight}px`; };
  // Only the sheet in view is interactive (inert on the others): Tab never runs off sideways into a sheet that is out of sight, and the
  // sheet index (which moves the strip) is the keyboard route to A-02 / A-03.
  function setActive(pane) {
    activePane = pane;
    for (const p of panes) p.toggleAttribute("inert", p !== pane);
    for (const b of document.querySelectorAll("#sheets-nav [data-pane]")) b.setAttribute("aria-current", String(b.dataset.pane === pane.id));
    fitStrip();
  }
  function showPane(id, focus = false) {
    const pane = document.getElementById(id);
    if (!pane) return;
    setActive(pane);
    navTo = pane;                                                  // a smooth scroll sweeps the panes in between past the observer: it must not hand the sheet back to one of them
    clearTimeout(navTimer);
    navTimer = setTimeout(settle, 1500);
    strip.scrollTo({ left: pane.offsetLeft - strip.offsetLeft, behavior: scrollBehavior() });
    if (focus) pane.focus?.({ preventScroll: true });
  }
  function settle() {
    clearTimeout(navTimer);
    navTo = null;
    const at = strip.scrollLeft + strip.offsetLeft;
    setActive(panes.reduce((a, p) => (Math.abs(p.offsetLeft - at) < Math.abs(a.offsetLeft - at) ? p : a)));
  }
  strip.addEventListener("scrollend", () => { if (navTo) settle(); });
  for (const b of document.querySelectorAll("#sheets-nav [data-pane]")) b.addEventListener("click", () => showPane(b.dataset.pane));
  // four sheets no longer fit a 375 px index: a focused item that is only partly in view is brought fully in (the browser leaves it half-cut, ring and all)
  $("#sheets-nav").addEventListener("focusin", (e) => e.target.scrollIntoView?.({ inline: "nearest", block: "nearest" }));
  const paneIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || e.intersectionRatio < 0.6 || (navTo && e.target !== navTo)) continue;
      setActive(e.target);
    }
  }, { root: strip, threshold: [0.6] });
  panes.forEach((p) => paneIO.observe(p));
  setActive(panes[0]);
  new ResizeObserver(() => fitStrip()).observe(panes[0]);
  for (const p of panes.slice(1)) new ResizeObserver(() => { if (p === activePane) fitStrip(); }).observe(p);

  function setLinks(container, code, withLaying) {
    const roomId = roomsFor(rooms, ui.state.comp.design)[0]?.id;
    const view = vm.client ? "client" : "architect";
    const items = [el("a", { href: materialUrl(code, ui.locale, view, ui.by, ui.light) }, el("b", {}, "A-00"), tx("sheet_a00")),
      el("button", { type: "button", onclick: () => { showPane("a01"); $("#a01").scrollIntoView({ block: "start" }); } },
      el("b", {}, "A-01"), tx("sheet_a01"))];
    if (roomId) items.push(el("a", { href: roomUrl(code, roomId, ui.locale, vm.client ? "client" : "architect", ui.by, ui.light) }, el("b", {}, "A-02"), tx("sheet_a02")));
    if (withLaying) items.push(el("a", { href: layingUrl(code, ui.locale, ui.light) }, el("b", {}, "A-03"), tx("sheet_a03")));
    container.replaceChildren(...items);
  }

  function renderRooms(code) {
    $("#nav-a00").href = materialUrl(code, ui.locale, vm.client ? "client" : "architect", ui.by, ui.light);
    $("#a02-cap").textContent = rooms ? (rooms.caption?.[ui.locale] ?? "") : tx("a02_none");
    $("#rooms-idx").replaceChildren(...roomsFor(rooms, ui.state.comp.design).map((r, i) => el("li", {},
      el("a", { href: roomUrl(code, r.id, ui.locale, vm.client ? "client" : "architect", ui.by, ui.light) },
        el("img", { class: "idx-thumb", src: `rooms/${r.id}/thumb.jpg`, alt: "", width: 80, height: 45, loading: "lazy" }),
        el("b", {}, `A-02.${i + 1}`), el("span", {}, r.label?.[ui.locale] ?? r.id), icon("i-next")))));
  }

  function renderLayingMini(code) {
    const box = $("#lay-mini-box");
    if (!box) return;
    $("#lay-open").href = layingUrl(code, ui.locale, ui.light);
    const kit = curKit(), rows = verify(ui.state.comp, kit).rows, cutRows = wallCuts(ui.state.comp, kit);
    const [mw, mh] = kit.module_mm, wall = L.wallMm(ui.state.comp, kit);
    const cell = 40, W = wall[0] / mw * cell, H = wall[1] / mh * (cell * mh / mw);        // every piece is drawn at its true laid size
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", `-1 -1 ${W + 2} ${H + 2}`);
    svg.setAttribute("class", "lay-mini grid");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", tx("sheet_a03"));
    const parts = [];
    rows.forEach((row, rt) => row.forEach(([, k], c) => {
      const b = pieceBox(cutRows, rt, c, kit.module_mm, wall);
      const x = b.x0 * W, cw = b.w * W, y = b.y0 * H, ch = b.h * H, sc = Math.min(1, cw / cell, ch / cell);
      parts.push(`<g transform="translate(${x} ${y})"><rect class="cellr" width="${cw}" height="${ch}"/>`
        + (sc > 0.45 ? `<g transform="translate(${cw / 2} ${ch * 0.55}) rotate(${-90 * k}) scale(${sc})"><path class="arrow" style="stroke-width:1.5" d="M0 -9 L0 8 M0 -9 L-5 -3 M0 -9 L5 -3"/></g>` : "")
        + "</g>");
    }));
    svg.innerHTML = parts.join("");
    box.replaceChildren(svg);
    $("#lay-pieces").textContent = `${tx("price_pieces_by_mould")}: ${mouldCountList(kit, pieceCounts(rows), tx("mould_flat")).map(([label, n]) => `${label}×${n}`).join("  ")}`;
  }

  // -- controls (architect)
  function seg(container, items, current, onPick, disabledFn = () => false) {
    container.replaceChildren(...items.map((it) => el("button", {
      type: "button", class: "seg", "aria-pressed": String(it.id === current), disabled: disabledFn(it.id),
      title: it.title ?? false, onclick: () => onPick(it.id),
    }, it.label)));
  }

  function renderControls() {
    const { comp, ui: lay } = ui.state;
    const kit = curKit();
    $("#q-designs")?.replaceChildren(...index.kits.map((k) => el("button", {
      type: "button", class: "seg", "aria-pressed": String(k.design === comp.design), onclick: () => switchDesign(k.design),
    }, tx(`design_${k.design}`))));
    $("#designs").replaceChildren(...index.kits.map((k) => {
      const d = kits[k.design];
      return el("button", { type: "button", class: "pick", "aria-pressed": String(k.design === comp.design), onclick: () => switchDesign(k.design) },
        icon("i-check"), el("span", { class: "pick-n" }, tx(`design_${k.design}`)),
        el("span", { class: "pick-m" }, d.preview ? tx("format", { w: d.module_mm[0] / 10, h: d.module_mm[1] / 10 }) : mouldMeta(d)),
        ...(d.preview ? [el("span", { class: "pick-p" }, tx("preview_label"))] : []));
    }));
    const cols = finishesFor(kit, config);
    $("#finishes").replaceChildren(...cols.map((c) => el("button", {
      type: "button", class: "pick", "aria-pressed": String(c.id === comp.colour), onclick: () => act({ type: "finish", id: c.id }),
    }, icon("i-check"), el("span", { class: "pick-n" }, tx(`finish_${c.id}`)), el("span", { class: "pick-m" }, tx(`finish_kind_${c.id}`)))));
    $("#finish-val").textContent = finishLabel(curFinish().id);
    $("#q-finishes")?.replaceChildren(...cols.map((c) => el("button", {
      type: "button", class: "seg", "aria-pressed": String(c.id === comp.colour), title: finishLabel(c.id), onclick: () => act({ type: "finish", id: c.id }),
    }, tx(`finish_${c.id}`))));
    if ($("#q-finish-name")) $("#q-finish-name").textContent = tx(`finish_kind_${curFinish().id}`);
    $("#finishes").hidden = cols.length < 2;                // one finish offered (Canvas, Burak 2026-11-13): its name shows, no choice to make
    if ($("#q-finishes")) $("#q-finishes").hidden = cols.length < 2;

    const corners = comp.engine === "corners", plan = comp.engine === "plan";
    $("#layout-corners").hidden = !corners;
    $("#layout-bond").hidden = corners || plan;
    if ($("#layout-plan")) {
      $("#layout-plan").hidden = !plan;
      if (plan) { const key = planTextKey(kit, ui.state.comp); $("#layout-plan").dataset.s = key; $("#layout-plan").textContent = tx(key); }      // applyStrings re-reads data-s: the key follows the kit
    }
    if (plan) return;
    if (corners) {
      // a preset the kit can never lay (it lacks the corner classes) is not offered, rather than shown greyed out
      const cornerOf = (id) => (comp.seeds && comp.seeds.length === 1 && SEED_PRESETS[id] ? SEED_PRESETS[id](comp).join() === comp.seeds[0].join() : false);
      $("#offset-row").hidden = !!comp.seeds;           // a seeded wall has no offset step: its points are the offset
      $("#presets").replaceChildren(...Object.entries(PRESETS).filter(([id]) => id === lay.preset || trial({ type: "preset", id })).map(([id, p]) => el("button", {
        type: "button", class: "ib", "aria-pressed": String(id === lay.preset || cornerOf(id)),
        "aria-label": tx(`preset_${id}`), title: tx(`preset_${id}`), onclick: () => act({ type: "preset", id }),
      }, icon(p.icon))));
      const fr = rampFrame(comp, kit);                  // the control reads as the relief area: + = more relief (one step back toward the corner), − = less
      $("#offset-val").textContent = fr ? `${fmtRun(fr.reliefMm)} m` : String(lay.step);
      $("#offset-minus").disabled = !trial({ type: "offset", delta: 1 });
      $("#offset-plus").disabled = !trial({ type: "offset", delta: -1 });
    } else {
      seg($("#bonds"), L.BONDS.map((id) => ({ id, label: tx(`bond_${id}`) })), comp.bond, (id) => act({ type: "bond", id }));
      seg($("#rotates"), L.ROTATES.map((id) => ({ id, label: tx(`rotate_${id}`) })), comp.rotate,
          (id) => act({ type: "rotate", id, seed: newSeed() }));
      $("#reshuffle").hidden = comp.rotate !== "shuffle";
    }
  }

  const newSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;

  // -- the elevation's dimension strings ARE the size fields (architect); plain values for the client
  const dims = {};
  // A size error (unreadable / outside the range) and the MOQ shortfall are tied to the two size strings: aria-describedby + aria-invalid.
  function setDimErr(key, vars) { ui.dimErr = key ? { key, vars } : null; renderDimErr(); }
  function renderDimErr() {
    const n = $("#dim-err");
    n.textContent = ui.dimErr ? tx(ui.dimErr.key, ui.dimErr.vars) : "";
    n.hidden = !ui.dimErr;
    const q = $("#q-dim-err");
    if (q) { q.textContent = n.textContent; q.hidden = n.hidden || isPerBlock(curKit()); }
    syncDimAria();
  }
  function syncDimAria() {
    const err = !!ui.dimErr, short = ui.moqShort === true;
    for (const input of [dims.cols, dims.rows]) {
      if (!input || input.tagName !== "INPUT") continue;
      const fit = $("#dim-fit") && !$("#dim-fit").hidden;
      input.setAttribute("aria-describedby", ["dim-mod", fit ? "dim-fit" : null, err ? "dim-err" : null, short ? "moq-msg" : null].filter(Boolean).join(" "));
      input.setAttribute("aria-invalid", String(err || short));
    }
    for (const id of ["#q-w", "#q-h"]) $(id)?.setAttribute("aria-invalid", String(err));      // below the minimum is still a request: only an error flags these two
  }
  // One size edit: the wall in mm (one axis, or both) goes in as it was typed; the code carries it, the modules are what it needs.
  function setWall(idx, mm) {
    ui.changeNote = null;
    ui.qTyped[idx] = true;
    return act({ type: "wall", [idx ? "h" : "w"]: mm });
  }

  function switchDesign(id) {
    const { comp } = ui.state, next = kits[id];
    if (!next || id === comp.design) return;
    let [tw, th] = ui.target.map((m) => Math.round(m * 1000));
    const first = firstPickWall(next, config, { touched: ui.wallTouched, remembered: !!ui.designMemory[id] });
    if (first) [tw, th] = first;                       // first pick of a design: its own default wall, unless the architect typed a wall
    else if (ui.designMemory[id] && !ui.wallTouched) [tw, th] = L.wallMm(ui.designMemory[id].comp, next);       // a revisit gets its own layout and wall back, not the default wall of the design in between
    if (!L.fixedPlan(kits[comp.design])) ui.designMemory[comp.design] = ui.state;       // leaving a laid design remembers its layout for the way back
    if (!act({ type: "design", id, wall: [tw, th], back: ui.designMemory[id] })) return;
    const now = ui.state.comp, nk = curKit(), [fw, fh] = wallMetres(now, nk);
    const vars = { design: tx(`design_${id}`), w: fmtMetres(ui.target[0], ui.locale), h: fmtMetres(ui.target[1], ui.locale),
                   cols: now.cols, rows: now.rows, fw: fmtMetres(fw, ui.locale), fh: fmtMetres(fh, ui.locale) };
    const differs = Math.abs(ui.target[0] - fw) >= 0.0005 || Math.abs(ui.target[1] - fh) >= 0.0005;     // a plan has its own size; a wall past 64 modules is cut back
    ui.changeNote = differs ? { key: L.fixedPlan(nk) ? "fit_switch_plan" : "fit_switch", vars } : null;
    renderFit();
    if (ui.changeNote) announce(tx(ui.changeNote.key, vars));
  }

  // "4,2 m → 11 modül; son sütun 200 mm'ye kesilir": what the typed wall cuts, one line per cut axis, then the quiet thin-cut notes.
  function renderFit() {
    const n = $("#dim-fit");
    if (!n) return;
    const { comp } = ui.state, kit = curKit();
    const lines = [];
    if (ui.changeNote) lines.push(tx(ui.changeNote.key, ui.changeNote.vars));
    else {
      const { fit, thin } = cutNotes(comp, kit);
      for (const f of fit) {
        const body = tx(L.coursesKit(kit) && f.axis === "h" ? "fit_cut_courses" : "fit_cut", { t: fmtMetres(L.wallMm(comp, kit)[f.axis === "w" ? 0 : 1] / 1000, ui.locale), n: f.n, where: tx(`fit_where_${f.side}`), mm: fmtMm(f.mm, ui.locale) });
        lines.push(fit.length > 1 ? `${tx(f.axis === "w" ? "fit_w" : "fit_h")}: ${body}` : body);
      }
      for (const th of thin) lines.push(tx("fit_thin", { where: tx(`thin_where_${th.edge}`), mm: fmtMm(th.mm, ui.locale) }));
    }
    n.replaceChildren(...lines.map((l) => el("span", {}, l)));
    n.hidden = !lines.length;
    syncDimAria();
  }

  // A typed size, from the elevation's string or the quote form's field. Unusable text changes nothing and one plain sentence says why; the wall is exactly what was typed (to the mm).
  function typedWall(idx, text) {
    const kit = curKit(), m = parseMetres(text);
    const range = { lo: fmtMetres(WALL_MIN_MM / 1000, ui.locale), hi: fmtMetres(SIDE_MAX * kit.module_mm[idx] / 1000, ui.locale) };
    if (m === null) { setDimErr("err_dim_invalid", range); return; }
    const asked = Math.round(m * 1000), mm = clampWallMm(kit, idx, asked);
    if (mm !== asked) setDimErr("err_dim_range", { ...range, val: fmtMetres(mm / 1000, ui.locale) });
    else setDimErr(null);
    setWall(idx, mm);
  }

  function buildDims() {
    for (const [axis, box, key] of [["cols", "#dim-h", "dim_w_drawing"], ["rows", "#dim-v", "dim_h_drawing"]]) {      // its own name: the price form has a "wall width" field too
      const host = $(box);
      if (vm.client) { dims[axis] = el("output", {}); host.append(dims[axis]); continue; }
      const id = `dim-${axis}`;
      const label = el("label", { class: "vh", for: id, "data-s": key });
      const input = el("input", { id, type: "text", inputmode: "decimal", autocomplete: "off", enterkeyhint: "done",
                                  "aria-describedby": "dim-mod", spellcheck: "false" });
      const idx = axis === "cols" ? 0 : 1;
      label.id = `${id}-l`;
      const plain = el("output", { class: "plain", "aria-labelledby": label.id, hidden: true });
      const restore = () => { input.value = `${fmtMetres(wallMetres(ui.state.comp, curKit())[idx], ui.locale)} m`; };
      input.addEventListener("change", () => { typedWall(idx, input.value); restore(); });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { input.blur(); return; }
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        setDimErr(null);
        const mod = curKit().module_mm[idx], now = L.wallMm(ui.state.comp, curKit())[idx];      // a step lands on the next whole module
        const mm = e.key === "ArrowUp" ? (Math.floor(now / mod) + 1) * mod : (Math.ceil(now / mod) - 1) * mod;
        if (mm >= WALL_MIN_MM && mm <= SIDE_MAX * mod && setWall(idx, mm)) restore();
      });
      input.addEventListener("focus", () => input.select());
      host.append(label, input, plain);
      dims[axis] = input;
      dims[`${axis}Plain`] = plain;
    }
  }

  function renderElevation() {
    const { comp } = ui.state;
    const kit = curKit();
    const [wm, hm] = wallMetres(comp, kit);
    for (const [axis, v] of [["cols", wm], ["rows", hm]]) {
      const text = `${fmtMetres(v, ui.locale)} m`;
      if (dims[axis].tagName === "OUTPUT") dims[axis].textContent = text;
      else if (document.activeElement !== dims[axis] || dims[axis].value !== text) dims[axis].value = text;
      if (dims[axis].tagName === "INPUT") {                    // a fixed plan's size is plain text with a label, not an editable field
        const plan = L.fixedPlan(kit);
        dims[axis].hidden = plan;
        dims[`${axis}Plain`].hidden = !plan;
        dims[`${axis}Plain`].textContent = text;
      }
    }
    $("#dim-mod").textContent = L.fixedPlan(kit) ? tx("size_fixed", { cols: comp.cols, rows: comp.rows }) : tx(...sizeKey(comp, kit));
    $("#elev").style.setProperty("--aspect", String(wm / hm));
    $(".elev-wrap").style.setProperty("--aspect", String(wm / hm));      // the print sheet sizes the wall from it
    const deg = ui.light.facing;
    const dir = COMPASS.find(([, d]) => d === deg);
    $("#elev-title").textContent = tx("elev_caption", { dir: dir ? tx(`dir_${dir[0]}`) : "", deg });
    document.documentElement.style.setProperty("--tint", curFinish().swatch);
  }

  // wall width: as wide as the column allows, as tall as the screen lets the light instrument stay in view
  function sizeStage() {
    const { comp } = ui.state;
    const [wm, hm] = wallMetres(comp, curKit());
    const aspect = wm / hm;
    const desk = isDesktop();
    const detailW = desk ? 200 : 112;
    const detailBox = $("#detail");
    const pane = $("#a01"), cs = getComputedStyle(pane);
    const wrapW = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);    // Detail A sits beside the sun instrument, not beside the wall
    // the wall is the product: it keeps its height budget; the lines under it push the sun instrument down, and fitStageTop lets the sticky stage scroll to it
    const maxH = desk ? Math.max(220, window.innerHeight - 450) : Math.max(180, window.innerHeight * 0.5);
    const ww = Math.max(120, Math.floor(Math.min(wrapW - (desk ? DIMCOL : 0), maxH * aspect)));
    $(".elev-wrap").style.setProperty("--wall-w", `${ww}px`);          // on the wrap: the grid and the caption share the wall's width
    const modulePx = ww * curKit().module_mm[0] / (wm * 1000);               // one module's width on screen (the wall is cropped from whole modules)
    const dw = Math.round(Math.min(detailW, Math.max(110, modulePx * DETAIL_SCALE)));
    detailBox.style.setProperty("--detail-w", `${dw}px`);
    ui.detailScale = dw / modulePx;
    fitStageTop();
  }
  // A sticky stage taller than the screen would hide its foot (the city and facing selects): it may scroll up by the overshoot, then sticks.
  function fitStageTop() {
    const stage = $(".stage");
    stage.style.setProperty("--stage-top", `${Math.min(0, Math.floor(window.innerHeight - stage.offsetHeight - 16))}px`);
  }

  // -- price, antet, dock (architect)
  function completeMoq() {
    const { comp } = ui.state, kit = curKit();
    const r = completeToMoq(comp.cols, comp.rows, kit.module_mm, moqFor(config.pricing, comp.design), SIDE_MAX, (c, n) => L.suppliedModules({ cols: c, rows: n }, kit));
    if (!r) return;
    if (act({ type: "size", cols: r.cols, rows: r.rows })) setDimErr(null);
  }

  function renderPrice(rows) {
    const { comp } = ui.state;
    const kit = curKit();
    const q = quote(wallOrder(comp, kit, rows), config.pricing, ui.speed, comp.design);
    const f = (n) => `${formatTry(n, ui.locale)} ${tx("currency")}`;
    const tr = (k, v, cls) => el("tr", { class: cls ?? false }, el("th", { scope: "row" }, k), el("td", {}, v));
    const box = $("#price");
    // the wall and what is supplied: you buy whole modules, so a cut wall shows both (the price and the MOQ count the supply)
    const areaRows = () => (q.wall_cut ? [
      tr(tx("price_wall"), tx("price_area_val", { m2: fmtDec(q.wall_area_m2, 2, ui.locale) })),
      tr(tx("price_supplied"), tx("price_supplied_val", { m2: fmtDec(q.area_m2, 2, ui.locale), n: q.modules, cut: q.cut_pieces }))]
      : [tr(tx("price_area"), tx("price_area_val", { m2: fmtDec(q.area_m2, 2, ui.locale) }))]);
    const notice = q.moq_m2 === null                       // no minimum is set for this design (DEC-14): say so quietly, enforce nothing
      ? el("p", { class: "note", id: "moq-msg" }, el("span", {}, tx("moq_quote")))
      : q.meets_moq
      ? el("p", { class: "moq ok", id: "moq-msg" }, icon("i-check"), el("span", {}, tx("moq_ok", { moq: moqText(q.moq_m2) })))
      : el("div", { class: "moq short", id: "moq-msg" }, icon("i-rev"),
          el("span", {}, tx("moq_short", { moq: moqText(q.moq_m2), m2: fmtDec(q.shortfall_m2, 2, ui.locale), n: q.shortfall_modules })),
          el("button", { type: "button", class: "btn go", onclick: completeMoq }, tx("moq_complete", { moq: moqText(q.moq_m2) })));
    // Supporting detail sits in boxes (box.js); the minimum-order line, the notice and button, and the Toplam row stay on the sheet.
    const body = [
      ...areaRows(),
      tr(tx("price_pieces"), tx("price_pieces_total", { n: q.pieces_total })),
      ...(q.priced ? [
        tr(tx("price_rate"), tx("price_rate_val", { rate: formatTry(q.rate_try_m2, ui.locale) })),
        tr(tx("price_subtotal"), f(q.subtotal_try)),
        tr(tx("price_kdv", { pct: Math.round(config.pricing.kdv_rate * 100) }), f(q.kdv_try))] : []),
    ];
    const days = config.pricing.validity_days;
    const terms = [leadWeeks(q) ? tx("terms_pickup", { weeks: q.lead_time_weeks }) : tx("terms_pickup_open"), tx("terms_install"),
      q.moq_m2 === null || !config.pricing.pay_terms_set ? tx("terms_pay_open") : tx("terms_pay", { moq: moqText(q.moq_m2) }),      // the Studio Designs split is Burak's to set; until then the quote carries it
      tx("terms_contract"), tx("terms_date", { date: fmtDateDMY() }),
                   days ? tx("terms_valid", { days }) : null].filter(Boolean);
    const speeds = Object.entries(config.pricing.logistics);
    // an unpriced set shows no shipping price either; a priced set with no shipping price yet says the quote carries it
    const speedPrice = (o) => (!q.priced ? "" : o.price_try === null ? tx("speed_price_quote") : f(o.price_try));
    // an unpriced set names quantities only: no heading promises a price the page never shows (#121); applyStrings re-reads data-s
    for (const [node, key] of [[$(".pr-price .field-head h2"), "sec_price"], [$("#a01-h [data-view=architect]"), "print_title"]]) {
      node.dataset.s = q.priced ? key : `${key}_open`;
      node.textContent = tx(node.dataset.s);
    }
    box.replaceChildren(notice);
    if (!q.priced) box.append(el("p", { class: "note", id: "price-quote" }, tx("price_quote")));
    if (q.orderable && q.priced) {
      box.append(el("table", { class: "sched sched-total" }, el("tbody", {}, tr(q.logistics_pending ? tx("price_total_ex_logistics") : tx("price_total"), f(q.total_try), "total"))));
    }
    box.append(
      makeBox("price-detail", { title: tx(q.priced ? "sec_price_detail" : "sec_price_detail_open"), value: q.priced ? tx("price_detail_sum", { m2: fmtDec(q.area_m2, 2, ui.locale), rate: formatTry(q.rate_try_m2, ui.locale) }) : tx("price_detail_area", { m2: fmtDec(q.area_m2, 2, ui.locale) }) },
        el("table", { class: q.orderable ? "sched" : "sched dim" }, el("tbody", {}, ...body))),
      makeBox("terms", { title: tx("sec_terms"), value: leadShort(q) },
        el("ul", { class: "terms" }, terms.map((s) => el("li", {}, s)))),
      makeBox("logistics", { title: tx("sec_logistics"), value: [tx(`speed_${ui.speed}`), speedPrice(config.pricing.logistics[ui.speed])].filter(Boolean).join(" · "), cls: "noprint" },
        el("fieldset", { class: "speeds" }, el("legend", { class: "vh" }, tx("speed_label")),
          speeds.map(([id, o]) => el("label", { class: "speed" }, el("input", {
            type: "radio", name: "speed", value: id, checked: id === ui.speed, onchange: () => { ui.speed = id; render({}); },
          }), el("span", {}, tx(`speed_${id}`)), speedPrice(o) ? el("em", {}, speedPrice(o)) : null)))));
    ui.moqShort = !q.meets_moq;
    return q;
  }

  function renderSend(code, q) {
    const { comp } = ui.state;
    const kit = curKit();
    const f = (n) => `${formatTry(n, ui.locale)} ${tx("currency")}`;
    $("#code").textContent = code;
    const [wm, hm] = wallMetres(comp, kit);
    const names = { design: tx(`design_${comp.design}`), finish: finishLabel(comp.colour) };
    setDesignCell($("#a-design"), `${names.design} · ${tx("format", { w: kit.module_mm[0] / 10, h: kit.module_mm[1] / 10 })}`, kit);
    $("#a-colour").textContent = names.finish;
    $("#a-size").textContent = tx("size_metres", { w: fmtMetres(wm, ui.locale), h: fmtMetres(hm, ui.locale) });
    $("#a-area").textContent = q.wall_cut ? tx("price_area_cut", { wall: fmtDec(q.wall_area_m2, 2, ui.locale), m2: fmtDec(q.area_m2, 2, ui.locale) })
      : tx("price_area_val", { m2: fmtDec(q.area_m2, 2, ui.locale) });
    $("#a-lead").textContent = leadShort(q);
    $("#a-total-cell").hidden = !q.priced;                 // an unpriced set has no total cell at all
    $("#a-lead").parentElement.classList.toggle("span", !q.priced);
    $("#a-total-cell").className = q.orderable ? "cell r total" : "cell r total void";
    $("#a-total-l").textContent = q.logistics_pending ? tx("price_total_ex_logistics") : tx("price_total");
    $("#a-total").textContent = q.priced ? (q.orderable ? f(q.total_try) : "—") : "";
    setLinks($("#a-set"), code, true);
    const url = shareUrl(location.href, code, ui.locale, ui.light);
    const price = priceLine(strings, ui.locale, config, { unpriced: !q.priced, orderable: q.orderable, moq: moqText(q.moq_m2), totalText: f(q.total_try), date: fmtDateDMY(), exLogistics: !!q.logistics_pending });
    const message = buildMessage(strings, ui.locale, config, {
      cols: comp.cols, rows: comp.rows, size: tx(...sizeKey(comp, kit)), w: fmtMetres(wm, ui.locale), h: fmtMetres(hm, ui.locale),
      m2: fmtDec(q.area_m2, 2, ui.locale), wall_m2: fmtDec(q.wall_area_m2, 2, ui.locale), cutn: q.cut_pieces, cut: q.wall_cut, code, url, speed: tx(`speed_${ui.speed}`), ...names, price, preview: previewOf(strings.locales[ui.locale], kit), by: ui.by, place: placeSum().replace(" · ", ", "),
    });
    ui.message = message;
    ui.code = code;
    $("#ig").href = instagramUrl(config, message);
    renderDock(q, f);
    renderQuote(q);
    const sig = [q.total_try, q.area_m2, q.meets_moq, q.orderable, q.logistics_pending, ui.speed].join("|");     // announce the change, not the first paint
    if (ui.priceSig !== undefined && ui.priceSig !== sig) announce(`${$("#moq-msg > span").textContent.trim()} ${q.priced ? `${$("#a-total-l").textContent}: ${$("#a-total").textContent}` : `${tx("price_area")}: ${tx("price_area_val", { m2: fmtDec(q.area_m2, 2, ui.locale) })}`}`);
    ui.priceSig = sig;
  }

  function renderDock(q, f) {
    const dock = $("#dock");
    const { comp } = ui.state;
    const sizeLine = `${tx("size_metres", { w: fmtMetres(wallMetres(comp, curKit())[0], ui.locale), h: fmtMetres(wallMetres(comp, curKit())[1], ui.locale) })} · ${tx(...sizeKey(comp, curKit()))}`;
    const m2 = fmtDec(q.area_m2, 2, ui.locale);
    if (q.meets_moq) {
      dock.replaceChildren(el("div", { class: "dock-sum" }, el("b", {}, q.priced ? f(q.total_try) : tx("dock_area", { m2 })),
          el("span", {}, q.priced ? tx(q.wall_cut ? "dock_vat_cut" : "dock_vat", { m2 }) : leadWeeks(q) ? tx("dock_open", { weeks: q.lead_time_weeks }) : tx("speed_price_quote"))),   // a cut wall: the m² is the supply, say so
        el("a", { class: "act", href: "#quote", onclick: (e) => { e.preventDefault(); const s = $("#quote"); s.scrollIntoView({ behavior: scrollBehavior(), block: "start" }); s.focus({ preventScroll: true }); } }, tx("quote_cta")));
    } else {
      dock.replaceChildren(el("div", { class: "dock-sum short" }, el("b", {}, tx("dock_short", { moq: moqText(q.moq_m2), m2: fmtDec(q.shortfall_m2, 2, ui.locale) })), el("span", {}, sizeLine)),
        el("button", { type: "button", class: "act ghost", onclick: completeMoq }, tx("moq_complete", { moq: moqText(q.moq_m2) })));
    }
  }

  async function copy(text, doneKey = "send_copied") {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (_) { /* fall through to the legacy path */ }
    if (!ok) {
      const ta = el("textarea", { readonly: true, style: "position:fixed;opacity:0" });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      ta.remove();
    }
    toast(ok ? tx(doneKey) : tx("copy_failed"));
    return ok;
  }

  let toastTimer = 0, liveTimer = 0;
  function announce(text) {                                // the one polite live region: toasts, price and MOQ changes
    const n = $("#live");
    if (!n) return;
    clearTimeout(liveTimer);
    n.textContent = "";                                    // clear first so an identical message is announced again
    liveTimer = setTimeout(() => { n.textContent = text; }, 250);
  }
  function toast(text) {
    announce(text);
    const n = $("#toast");
    n.textContent = text;
    n.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { n.hidden = true; }, 2500);
  }

  // -- the quote form. It carries a wall's size and a contact to the CRM; the price goes back by email, never onto this page (#121).
  const linked = (key, labelKey, href) => {                // a sentence holding one link, in whichever place its language puts it
    const [before, after = ""] = tx(key, { link: "\u0000" }).split("\u0000");
    return [before, el("a", { href, target: "_blank", rel: "noopener" }, tx(labelKey)), after];
  };
  const quoteUrl = (key) => config.quote?.[key]?.[ui.locale] ?? "#";

  function mouldMeta(d) {
    const n = d.moulds.filter((m) => m.role !== "plain").length;
    return tx(n === 1 ? "design_meta_one" : "design_meta", { w: d.module_mm[0] / 10, h: d.module_mm[1] / 10, n });
  }
  const qFieldText = (i, metres) => (ui.quote && !ui.qTyped[i] ? "" : fmtMetres(metres, ui.locale));
  function isPerBlock(kit) { return !!config.pricing?.per_block_designs?.includes(kit.design); }      // Hemiola: a free-standing screen, so its size goes in the note

  function renderQuote(q) {
    const { comp } = ui.state, kit = curKit(), perBlock = isPerBlock(kit);
    const [wm, hm] = wallMetres(comp, kit);
    const waiting = ui.quote && !perBlock && !ui.qTyped.every(Boolean);      // no figures until both sides of the real wall are written
    $("#q-head").textContent = tx("quote_head", { design: tx(`design_${comp.design}`) });
    const pick = $("#q-designs"), picked = pick?.querySelector('[aria-pressed="true"]');      // the phone's one-line picker keeps the chosen design in view
    if (ui.quote && picked && pick.scrollWidth > pick.clientWidth) pick.scrollLeft = Math.max(0, picked.offsetLeft - pick.offsetLeft - 16);
    $("#q-wall").hidden = perBlock;
    for (const [i, id, v] of [[0, "#q-w", wm], [1, "#q-h", hm]]) if (document.activeElement !== $(id)) $(id).value = qFieldText(i, v);
    $("#q-block").hidden = !perBlock;
    $("#q-block").textContent = perBlock ? tx("quote_block_note") : "";
    const row = (k, v) => el("tr", {}, el("th", { scope: "row" }, k), el("td", {}, v));
    const short = !perBlock && !q.meets_moq;
    $("#q-sum").replaceChildren(...(perBlock || waiting ? [] : [
      el("table", { class: "sched" }, el("tbody", {},
        row(tx("price_wall"), tx("price_area_val", { m2: fmtDec(q.wall_area_m2, 2, ui.locale) })),
        row(tx("price_supplied"), tx("quote_supply_val", { m2: fmtDec(q.area_m2, 2, ui.locale), n: q.modules, format: tx("format", { w: kit.module_mm[0] / 10, h: kit.module_mm[1] / 10 }) })))),
      el("p", { class: "note" }, tx("quote_supply_note")),
      ...(short ? [el("div", { class: "moq short" }, icon("i-rev"), el("span", {}, tx("quote_below_min", { moq: moqText(q.moq_m2) })),
        el("button", { type: "button", class: "btn go", onclick: completeMoq }, tx("moq_complete", { moq: moqText(q.moq_m2) })))] : []),
    ]));
    const orderM2 = q.area_m2, known = !perBlock && !waiting;
    $("#q-lead").textContent = !leadWeeks(q) || (known && orderM2 > config.pricing.lead_time_max_m2) ? tx("lead_quote")
      : known && short ? tx("quote_lead_bespoke")
      : tx("quote_lead", { weeks: q.lead_time_weeks, max: config.pricing.lead_time_max_m2 });
    $("#q-consent-text").replaceChildren(...linked("quote_consent", "quote_consent_link", quoteUrl("consent_url")));
    $("#q-privacy").replaceChildren(...linked("quote_privacy", "quote_privacy_link", quoteUrl("privacy_url")));
    $("#q-submit").textContent = tx(ui.quoteBusy ? "quote_sending" : "quote_submit");
    for (const k of ["name", "email", "buyer", "company", "phone"]) {
      const key = ui.quoteErrors?.[k], n = $(`#q-err-${k}`), field = k === "buyer" ? $("#q-buyer") : $(`#q-${k}`);
      n.textContent = key ? tx(key) : "";
      n.hidden = !key;
      field.setAttribute("aria-invalid", String(!!key));
    }
    $("#q-status").textContent = ui.quoteFailed ? tx("quote_err_send") : "";
    $("#q-status").hidden = !ui.quoteFailed;
    $("#quote-form").hidden = !!ui.quoteSentTo;
    $("#q-done").hidden = !ui.quoteSentTo;
    if (ui.quoteSentTo) {
      $("#q-done-body").textContent = tx("quote_done_body", { email: ui.quoteSentTo });
      $("#q-done-sample").replaceChildren(...linked("quote_done_sample", "quote_done_sample_link", quoteUrl("sample_url")));
    }
    ui.quoteQ = q;
  }

  // The wall as the CRM message reports it, read from what the page shows now.
  function quoteWall() {
    const { comp } = ui.state, kit = curKit(), q = ui.quoteQ, [wm, hm] = wallMetres(comp, kit);
    const link = shareUrl(location.href, ui.code, ui.locale);
    return { design: t(strings, "en", `design_${comp.design}`), design_code: comp.design, code: ui.code, link, locale: ui.locale, per_block: isPerBlock(kit),
             finish: `${t(strings, "en", `finish_${curFinish().id}`)} (${t(strings, "en", `finish_kind_${curFinish().id}`)})`,
             wall_text: `${fmtMetres(wm, "en")} x ${fmtMetres(hm, "en")} m`, wall_m2: fmtDec(q.wall_area_m2, 2, "en"), supply_m2: fmtDec(q.area_m2, 2, "en"),
             modules: q.modules, cut: q.cut_pieces, moq: q.moq_m2, below_min: !q.meets_moq };
  }

  function readQuote() {
    const form = $("#quote-form"), data = new FormData(form);
    return { name: data.get("name"), email: data.get("email"), company: data.get("company"), phone: data.get("phone"), note: data.get("note"),
             buyer: data.get("buyer") ?? "", consent: $("#q-consent").checked, honeypot: data.get("_gotcha") };
  }

  async function submitQuote(e) {
    e.preventDefault();
    if (ui.quoteBusy) return;                              // a double tap sends one request
    const fields = readQuote(), errors = checkQuote(fields);
    const wallOpen = ui.quote && !isPerBlock(curKit()) ? ui.qTyped.indexOf(false) : -1;
    ui.quoteErrors = errors;
    ui.quoteFailed = false;
    setDimErr(wallOpen >= 0 ? "quote_err_wall" : null);
    if (wallOpen >= 0 || Object.keys(errors).length) {
      renderQuote(ui.quoteQ);
      (wallOpen >= 0 ? $(wallOpen ? "#q-h" : "#q-w") : errors.name ? $("#q-name") : errors.email ? $("#q-email") : errors.buyer ? $("#q-buyer input") : errors.company ? $("#q-company") : $("#q-phone")).focus();
      return;
    }
    ui.quoteBusy = true;
    $("#q-submit").setAttribute("aria-disabled", "true");
    renderQuote(ui.quoteQ);
    const payload = quotePayload(fields, quoteWall(), { consentVersion: config.quote?.consent_version ?? "", search: location.search });
    const res = await sendQuote((u, o) => fetch(u, o), config.quote, payload);
    ui.quoteBusy = false;
    $("#q-submit").removeAttribute("aria-disabled");
    if (res.ok) {
      ui.quoteSentTo = cleanQuote(fields).email;
      renderQuote(ui.quoteQ);
      $("#q-done").focus({ preventScroll: true });
      announce(tx("quote_done_head"));
    } else {
      console.warn("quote request failed:", res.reason);
      ui.quoteFailed = true;
      renderQuote(ui.quoteQ);
      $("#q-status").focus({ preventScroll: true });
    }
  }

  function setMode(mode) {
    ui.quote = mode === "quote";
    document.documentElement.dataset.mode = mode;
    render({});
    fitStrip();
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function wireQuote() {
    $("#quote-form").addEventListener("submit", submitQuote);
    $("#q-designs").addEventListener("focusin", (e) => e.target.scrollIntoView({ block: "nearest", inline: "nearest" }));      // the browser leaves a half-hidden button half hidden when it takes the focus
    for (const [id, idx] of [["#q-w", 0], ["#q-h", 1]]) {
      const input = $(id);
      input.addEventListener("change", () => { typedWall(idx, input.value); input.value = qFieldText(idx, wallMetres(ui.state.comp, curKit())[idx]); });
      input.addEventListener("focus", () => input.select());
    }
    $("#q-again").addEventListener("click", () => { ui.quoteSentTo = null; renderQuote(ui.quoteQ); $("#q-w").focus({ preventScroll: true }); });
    $("#q-explore").addEventListener("click", () => setMode("full"));
  }

  function renderClient(code) {
    const { comp } = ui.state;
    const kit = curKit();
    const [wm, hm] = wallMetres(comp, kit);
    if ($("#c-by")) $("#c-by").textContent = ui.by;
    setDesignCell($("#c-design"), `${tx(`design_${comp.design}`)} · ${tx("format", { w: kit.module_mm[0] / 10, h: kit.module_mm[1] / 10 })}`, kit);
    $("#c-colour").textContent = finishLabel(comp.colour);
    $("#c-size").textContent = tx("size_metres", { w: fmtMetres(wm, ui.locale), h: fmtMetres(hm, ui.locale) });
    setLinks($("#c-set"), code, false);
    $("#c-next").textContent = ui.by ? tx("client_next_by", { by: ui.by }) : tx("client_next");
  }

  async function shareClient() {
    const url = clientUrl(location.href, ui.code, ui.locale, ui.by, ui.light);
    if (navigator.share) {
      try { await navigator.share({ title: tx("page_title"), text: tx("share_client_msg"), url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    await copy(url, "share_client_copied");
  }

  // lead record: fire-and-forget, never blocks or fails a send
  const lead = (channel) => sendLead((u, o) => fetch(u, o), config, { code: ui.code, locale: ui.locale, channel });

  // -- light
  function lightAngles() {
    const city = cityOf();
    const [y, m, d] = lightDate();
    const sun = window.SunStudioSolar.solarPosition(y, m, d, ui.light.hour, city.lat, city.lon, city.utc_offset);
    const wall = window.SunStudioSolar.wallLocalAngle(sun.azDeg, sun.elDeg, ui.light.facing);
    return { sun, wall, date: [y, m, d] };
  }

  // Two neighbouring runs can be closer than their words are wide (a west wall at 375 px: "Duvar gölgede" over "Duvarda güneş"): in the order sun, shade, night a label
  // that collides with one already placed (or runs off the strip) takes its short word, and is dropped if even that does not fit. The hatch and colour still tell the states apart.
  function fitRunLabels() {
    const host = $("#runs"), spans = [...host.children];
    if (!spans.length) return;
    const order = { sun: 0, shade: 1, night: 2 }, taken = [], box = host.getBoundingClientRect();
    for (const s of spans) { s.hidden = false; s.textContent = tx(`band_${s.dataset.state}`); }
    for (const s of [...spans].sort((a, b) => order[a.dataset.state] - order[b.dataset.state])) {
      const clear = () => { const r = s.getBoundingClientRect(); return r.left >= box.left - 11 && r.right <= box.right + 11 && taken.every((t) => r.right + 6 <= t.left || r.left - 6 >= t.right); };
      if (!clear()) s.textContent = tx(`band_${s.dataset.state}_short`);
      if (!clear()) { s.hidden = true; continue; }
      taken.push(s.getBoundingClientRect());
    }
  }

  function renderBand() {
    const S = window.SunStudioSolar;
    const date = lightDate(), city = cityOf();
    const runs = sunRuns(S, date, city, ui.light.facing);
    const pct = (h) => `${(h / 24 * 100).toFixed(2)}%`;
    $("#band").replaceChildren(...runs.map((r) => el("i", { class: `b-${r.state}`, style: `flex:${r.to - r.from} 1 0` })));
    $("#runs").replaceChildren(...runs.filter((r) => r.to - r.from >= 4).map((r) =>
      el("span", { style: `left:${pct((r.from + r.to) / 2)}`, "data-state": r.state }, tx(`band_${r.state}`))));
    fitRunLabels();
    const rs = S.sunriseSunset(...date, city.lat, city.lon, city.utc_offset);
    const ticks = [rs.sunrise, 12, rs.sunset].filter((h) => h !== null && h !== undefined);
    const keep = ticks.filter((h, i) => h !== 12 || ticks.every((o, j) => j === i || Math.abs(o - h) > 2.5));
    $("#ticks").replaceChildren(...keep.map((h) => el("span", { style: `left:${pct(h)}` }, S.fmtHour(h))));
    renderReliefHours();
  }

  const layoutText = () => {
    const { comp, ui: lay } = ui.state;
    if (comp.engine === "corners") return comp.seeds ? tx("layout_seeds", { n: comp.seeds.length }) : lay.preset === "custom" ? "" : tx(`preset_${lay.preset}`);
    if (comp.engine === "plan") return tx(planTextKey(curKit(), comp));
    return `${tx(`bond_${comp.bond}`)}, ${tx(`rotate_${comp.rotate}`)}`;
  };
  // The summary lines of the closed boxes: the current value, so nothing is hidden behind a click
  const layoutSum = () => {
    const { comp, ui: lay } = ui.state;
    if (comp.engine === "plan") return tx(L.fixedPlan(curKit()) ? "layout_sum_plan" : L.coursesKit(curKit()) ? "layout_sum_courses" : "layout_sum_gallery");
    if (comp.engine !== "corners" || comp.seeds) return layoutText();
    if (lay.preset === "custom") return tx("layout_sum_custom");
    const p = tx(`preset_${lay.preset}`);
    return lay.step ? tx("layout_sum_step", { p, n: lay.step }) : p;
  };
  const placeSum = () => {                                // "Sapanca · Güney 180°"; a facing that is not a compass point reads as its degrees
    const deg = ui.light.facing, hit = COMPASS.find(([, d]) => d === deg);
    return [tx(`city_${ui.light.city}`), hit ? `${tx(`dir_${hit[0]}`)} ${deg}°` : `${deg}°`].join(" · ");
  };
  const renderBoxSums = () => {
    if ($("#layout-sum")) $("#layout-sum").textContent = layoutSum();
    $("#place-sum").textContent = placeSum();
  };
  // Text alternatives for the two canvases and the hour slider's value text; refreshed on every change of composition, light or locale.
  function updateAlt() {
    const { comp } = ui.state, kit = curKit();
    const [wm, hm] = wallMetres(comp, kit);
    const { sun, wall } = lightAngles();
    const time = window.SunStudioSolar.fmtHour(ui.light.hour);
    const state = tx(sun.elDeg <= 0 ? "state_night" : wall.directLit ? "state_sun" : "state_shade");
    const tidy = (s) => s.replace(/,(\s*,)+/g, ",").replace(/\s+,/g, ",");
    $("#gl").setAttribute("aria-label", tidy(tx("alt_wall", { design: tx(`design_${comp.design}`), w: fmtMetres(wm, ui.locale), h: fmtMetres(hm, ui.locale),
      size: tx(...sizeKey(comp, curKit())), finish: finishLabel(curFinish().id), layout: layoutText(), time, sun: state }) + (curKit().preview ? ` ${tx("preview_label")}.` : "")));
    const d = ui.detailInfo;
    if (d) $("#gl-detail").setAttribute("aria-label", tx("alt_detail", { id: mouldLabel(curKit(), d.id, tx("mould_flat")), w: d.module[0], h: d.module[1], x: fmtDec(ui.detailScale ?? DETAIL_SCALE, 1, ui.locale), time, sun: state }));
    $("#hour").setAttribute("aria-valuetext", `${time}, ${state}`);
  }

  // Every change draws at once, one texel per pixel; once things are still, the finished draw averages the light of a relief finer than a pixel (light.js fineScale).
  const FINE_DRAW_MS = 90;
  let fineDraw = 0;
  function drawLight(stage) {
    const fine = stage === "fine";
    clearTimeout(fineDraw);
    updateAlt();
    if (!ui.view || !ui.wall) return;
    const { sun, wall, date } = lightAngles();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const light = { azDeg: wall.azPrime, elDeg: wall.elPrime, directLit: wall.directLit, sunElDeg: sun.elDeg };
    ui.view.draw({ ...light, fine, canvasW: Math.min(ui.wall.w, canvas.parentElement.clientWidth * dpr) });
    if (ui.detail && ui.detailView) {
      const dc = $("#gl-detail");
      ui.detailView.draw({ ...light, fine, canvasW: Math.min(ui.detail.w, dc.parentElement.clientWidth * dpr) });
    }
    const fh = window.SunStudioSolar.fmtHour(ui.light.hour);
    $("#hour-out").textContent = fh;
    $("#sun-out").textContent = sun.elDeg > 0
      ? tx("light_sun", { az: Math.round(sun.azDeg), el: Math.round(sun.elDeg) }) : tx("light_night");
    $("#light-note").textContent = wall.directLit ? "" : tx("light_no_sun");
    $("#date-out").textContent = tx("light_date", { d: date.map((n) => String(n).padStart(2, "0")).join("-") });
    if (!fine) fineDraw = setTimeout(() => { if (ui.sweep.state !== "running") drawLight("fine"); }, FINE_DRAW_MS);
  }
  let raf = 0;
  const scheduleDraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(drawLight); };

  // -- frame the ramp (corners engine only): the relief zone as a dimension string under the elevation, and one computed sentence
  const fmtRun = (mm) => (mm / 1000).toFixed(2).replace(/0$/, "").replace(".", ui.locale === "tr" ? "," : ".");      // 2000 -> "2,0", 2400 -> "2,4", 2250 -> "2,25"
  function renderRamp() {
    const box = $("#relief-dim"), cap = $("#ramp-cap");
    const fr = rampFrame(ui.state.comp, curKit());
    box.hidden = !fr;
    if (!fr) { cap.hidden = true; return; }
    if (fr.seeds) {                                         // several points: no single axis, so no bar; the areas and the reach say it
      const f2 = (m2) => fmtDec(m2, 2, ui.locale);
      $("#relief-dim-text").textContent = fr.none ? tx("seed_dim_flat", { b: f2(fr.flatM2) }) : fr.all ? tx("seed_dim_relief", { a: f2(fr.reliefM2) }) : tx("seed_dim_both", { a: f2(fr.reliefM2), b: f2(fr.flatM2) });
      $("#relief-bar").hidden = true;
      cap.textContent = fr.none ? tx("seed_cap_none") : fr.all ? tx("seed_cap_all", { n: fr.seeds })
        : tx(fr.seeds === 1 ? "seed_cap_one" : "seed_cap", { n: fr.seeds, k: fr.reach, m: fmtRun(fr.reachMm) });
      cap.hidden = !cap.textContent;
      return;
    }
    const a = fmtRun(fr.reliefMm), b = fmtRun(fr.flatMm);
    $("#relief-dim-text").textContent = fr.none ? tx("ramp_dim_flat", { b }) : fr.all ? tx("ramp_dim_relief", { a }) : tx("ramp_dim_both", { a, b });
    const bar = $("#relief-bar");
    bar.hidden = fr.axis !== "w";                           // along the height there is no width to draw it on: the sentence below carries it
    const seg = (cls, mm) => (mm > 0 ? el("i", { class: cls, style: `flex:${mm} 1 0` }) : null);
    bar.replaceChildren(...(fr.reliefFirst ? [seg("rd-relief", fr.reliefMm), seg("rd-flat", fr.flatMm)] : [seg("rd-flat", fr.flatMm), seg("rd-relief", fr.reliefMm)]).filter(Boolean));
    cap.textContent = fr.none ? "" : tx(fr.all ? "ramp_cap_all" : "ramp_cap", { from: tx(`ramp_from_${fr.from}`), n: fr.reliefN });
    cap.hidden = !cap.textContent;
  }

  // -- relief points (corners designs, architect): the tap layer over the wall + the list under Layout. Every point offered is one the
  // validator accepts (offeredPoints), so no wall the kit cannot make is ever reachable; a tap snaps to the nearest offered point or seed.
  const SNAP_PX = 48;                                   // how far from a mark a tap may land and still snap to it
  const PT = 9, SEED = 18, RING = 32;                   // mark sizes in px: an offered point, a seed, the ring around the selected / last touched one
  const samePt = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const seedsLive = () => !vm.client && ui.pts.on && ui.state.comp.engine === "corners" && !!ui.state.comp.seeds;
  let seedLayer = null;
  const seedPos = (comp, q) => {
    const pl = seedPlace(comp, curKit(), q);
    const pos = tx("seed_pos", { x: pl.x, y: pl.y, xs: tx(`seed_from_${pl.xFrom}`), ys: tx(`seed_from_${pl.yFrom}`) });
    return pl.out ? tx("seed_pos_out", { pos }) : pos;
  };

  // where the offered points are, computed on demand and kept until the composition changes: index -1 = where a seed can be added,
  // k = where seed k can be moved to
  function seedPointsNow(selIdx) {
    if (!ui.pts.cache || ui.pts.cache.code !== ui.code) ui.pts.cache = { code: ui.code, byIdx: new Map() };
    const m = ui.pts.cache.byIdx;
    if (!m.has(selIdx)) m.set(selIdx, offeredPoints(ui.state.comp, curKit(), selIdx >= 0 ? selIdx : null));
    return m.get(selIdx);
  }

  function renderSeeds() {
    if (vm.client) return;
    const { comp } = ui.state, corners = comp.engine === "corners";
    if (!corners || !comp.seeds) ui.pts.on = false;
    const on = seedsLive();
    $("#seeds-toggle").setAttribute("aria-pressed", String(on));
    $("#seeds-panel").hidden = !on;
    $("#seeds-bar").hidden = !on;                         // phone: the editor sits far below the wall; this bar keeps the status and "Bitti" at the wall
    if (seedLayer) seedLayer.hidden = !on;
    if (!on) { ui.pts.sel = null; return; }
    const kit = curKit(), selIdx = ui.pts.sel ? comp.seeds.findIndex((q) => samePt(q, ui.pts.sel)) : -1;
    if (selIdx < 0) ui.pts.sel = null;
    ui.pts.points = seedPointsNow(selIdx);
    const canAdd = comp.seeds.length < L.SEEDS_MAX;
    const list = $("#seeds-list");
    list.replaceChildren(...comp.seeds.map((q, k) => el("li", {},
      el("button", { type: "button", class: "seed-btn", "data-at": q.join(","), "aria-pressed": String(k === selIdx) },
        el("b", {}, tx("seed_n", { n: k + 1 })), el("small", {}, seedPos(comp, q))),
      el("button", { type: "button", class: "seed-rm", "data-at": q.join(","), "aria-label": tx("seed_remove_aria", { n: k + 1 }),
                     "aria-disabled": String(!removable(comp, kit, k)) }, tx("seed_remove")))));
    const free = canAdd && seedPointsNow(-1).length > 0;
    $("#seed-add").setAttribute("aria-disabled", String(!free));
    const msg = ui.pts.msg ? tx(ui.pts.msg.key, ui.pts.msg.vars) : selIdx >= 0 ? tx("seeds_hint_move", { n: selIdx + 1 })
      : !canAdd ? tx("seeds_full", { max: L.SEEDS_MAX }) : !free ? tx("seeds_none_free") : tx("seeds_hint_add");
    $("#seeds-status").textContent = msg;
    $("#seeds-bar-hint").textContent = msg;               // the same line, shown at the wall (the panel's copy is the one announced)
    if (ui.pts.refocus) {                                 // a keyboard action re-made the list: the focus follows the same seed
      list.querySelector(`.seed-btn[data-at="${ui.pts.refocus}"]`)?.focus({ preventScroll: true });
      ui.pts.refocus = null;
    }
    drawSeedLayer();
  }

  // the marks, in px of the wall box: offered points = small squares (sheet fill, ink edge), seeds = ink squares with a sheet centre,
  // the selected / last touched one gets a two-tone ring. A seed outside the wall sits on the nearest edge with a dashed ring.
  function drawSeedLayer() {
    if (!seedLayer || seedLayer.hidden) return;
    const { comp } = ui.state, kit = curKit(), box = $("#wallbox");
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const [W, H] = L.wallMm(comp, kit), at = (q) => { const [mx, my] = vertexMm(comp, kit, q[0], q[1]); return [Math.min(w, Math.max(0, mx / W * w)), Math.min(h, Math.max(0, my / H * h))]; };
    const sq = (c, size) => `M${(c[0] - size / 2).toFixed(1)} ${(c[1] - size / 2).toFixed(1)}h${size}v${size}h${-size}z`;
    const outside = (q) => !vertexVisible(comp, kit, q[0], q[1]);
    const dots = ui.pts.points.filter((q) => !comp.seeds.some((s) => samePt(s, q))).map((q) => sq(at(q), PT)).join("");
    const parts = [`<path d="${dots}" fill="#f6f6f3" stroke="#1c1d1b" stroke-width="1.5"/>`];
    const ringAt = (q, dash) => {
      const c = at(q);
      return `<rect x="${(c[0] - RING / 2).toFixed(1)}" y="${(c[1] - RING / 2).toFixed(1)}" width="${RING}" height="${RING}" fill="none" stroke="#f6f6f3" stroke-width="5"/>`
        + `<rect x="${(c[0] - RING / 2).toFixed(1)}" y="${(c[1] - RING / 2).toFixed(1)}" width="${RING}" height="${RING}" fill="none" stroke="#1c1d1b" stroke-width="2"${dash ? ' stroke-dasharray="4 3"' : ""}/>`;
    };
    if (ui.pts.focus && !ui.pts.sel) parts.push(ringAt(ui.pts.focus, false));
    if (ui.pts.sel) parts.push(ringAt(ui.pts.sel, false));
    comp.seeds.forEach((q) => {
      const c = at(q), x = (c[0] - SEED / 2).toFixed(1), y = (c[1] - SEED / 2).toFixed(1);
      parts.push(`<rect x="${x}" y="${y}" width="${SEED}" height="${SEED}" fill="#1c1d1b" stroke="#f6f6f3" stroke-width="2"${outside(q) ? ' stroke-dasharray="3 2"' : ""}/>`
        + `<rect x="${(c[0] - 3).toFixed(1)}" y="${(c[1] - 3).toFixed(1)}" width="6" height="6" fill="#f6f6f3"/>`);
    });
    const svg = seedLayer.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = parts.join("");
  }

  // One change of the seeds through the reducer; `done` is the announcement key. Returns whether the wall took it.
  function seedAct(action, done, vars, keep = null) {
    const keyboard = $("#seeds-list").contains(document.activeElement);
    if (!act(action)) return false;
    const now = ui.state.comp.seeds, to = action.to ?? null;
    ui.pts.focus = to;
    ui.pts.sel = action.type === "seed_move" ? to : null;
    ui.pts.msg = null;
    if (keyboard) ui.pts.refocus = (to ?? now[Math.min(keep ?? 0, now.length - 1)]).join(",");       // the focus stays in the list: on the seed, or on its neighbour after a removal
    renderSeeds();
    announce(tx(done, { ...vars, n: done === "seed_moved" ? now.findIndex((q) => samePt(q, to)) + 1 : now.length, pos: to ? seedPos(ui.state.comp, to) : "" }));
    return true;
  }

  function seedSay(key, vars = {}) {                      // a reason shown in the status line and spoken, never an error box
    setBoxOpen("layout", true);                           // the reason lives inside the Layout box: it opens itself
    ui.pts.msg = { key, vars };
    renderSeeds();
    announce(tx(key, vars));
  }

  function seedAddAt(point) { return seedAct({ type: "seed_add", to: point }, "seed_added"); }
  function seedAddDefault() {
    const { comp } = ui.state;
    if (comp.seeds.length >= L.SEEDS_MAX) return seedSay("seeds_full", { max: L.SEEDS_MAX });
    const p = defaultSeedPoint(comp, offeredPoints(comp, curKit(), null));
    return p ? seedAddAt(p) : seedSay("seeds_none_free");
  }
  function seedRemoveAt(point) {
    const { comp } = ui.state;
    if (comp.seeds.length < 2) return seedSay("seeds_last");
    const k = comp.seeds.findIndex((q) => samePt(q, point));
    if (!removable(comp, curKit(), k)) return seedSay("seeds_cant_remove");
    ui.pts.sel = null;
    return seedAct({ type: "seed_remove", at: point }, "seed_removed", {}, k);
  }
  function seedMoveDir(point, dir) {
    const { comp } = ui.state, k = comp.seeds.findIndex((q) => samePt(q, point));
    const to = nextPoint(offeredPoints(comp, curKit(), k), point, dir);
    return to ? seedAct({ type: "seed_move", from: point, to }, "seed_moved") : seedSay("seed_no_way");
  }
  function seedToggleSel(point) {
    ui.pts.sel = samePt(ui.pts.sel, point) ? null : point;
    ui.pts.focus = null;
    ui.pts.msg = null;
    renderSeeds();
    announce(ui.pts.sel ? tx("seed_selected", { n: ui.state.comp.seeds.findIndex((q) => samePt(q, point)) + 1, pos: seedPos(ui.state.comp, point) }) : tx("seed_deselected"));
  }

  function seedsToggle(on, byUser = false) {
    const { comp } = ui.state;
    setBoxOpen("layout", true);                           // the editor lives in the Layout box (and "Bitti" hands the focus back to its button): open it first
    ui.pts.on = on;
    ui.pts.sel = null;
    ui.pts.focus = null;
    ui.pts.msg = null;
    if (on && !comp.seeds) {
      if (!act({ type: "seeds_on" })) { ui.pts.on = false; return; }
      ui.pts.msg = { key: ui.state.ui.seedsFrom === "ramp" ? "seeds_from_ramp" : "seeds_from_default", vars: {} };
    }
    renderSeeds();
    if (on) announce(`${tx("seeds_mode_on", { n: ui.state.comp.seeds.length })} ${ui.pts.msg ? tx(ui.pts.msg.key) : ""}`.trim());
    if (byUser && !isDesktop()) {                         // a press (not the ?pts=1 hook): bring the wall into view; "Bitti" brings the user back
      const to = on ? $("#wallbox") : $("#seeds-toggle");
      to.scrollIntoView({ block: on ? "start" : "center", behavior: scrollBehavior() });
      (on ? $("#seeds-done") : $("#seeds-toggle")).focus({ preventScroll: true });
    }
  }

  function wireSeeds() {
    const box = $("#wallbox");
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("focusable", "false");
    seedLayer = el("div", { class: "seed-layer", hidden: true, "aria-hidden": "true" }, svg);
    box.append(seedLayer);
    new ResizeObserver(() => drawSeedLayer()).observe(box);
    seedLayer.addEventListener("click", (e) => {
      const { comp } = ui.state, kit = curKit(), r = svg.getBoundingClientRect();
      if (!comp.seeds || !r.width) return;
      const [W, H] = L.wallMm(comp, kit), k = W / r.width;
      const hit = snapTap(comp, kit, ui.pts.points, (e.clientX - r.left) * k, (e.clientY - r.top) * (H / r.height), SNAP_PX * k);
      if (!hit) return;
      if (hit.kind === "seed") { seedToggleSel(comp.seeds[hit.index]); return; }
      if (ui.pts.sel) seedAct({ type: "seed_move", from: ui.pts.sel, to: hit.point }, "seed_moved");
      else seedAddAt(hit.point);
    });
    $("#seeds-toggle").addEventListener("click", () => seedsToggle(!ui.pts.on, true));
    $("#seeds-done").addEventListener("click", () => seedsToggle(false, true));
    $("#seed-add").addEventListener("click", seedAddDefault);
    const list = $("#seeds-list");
    const pointOf = (n) => n.dataset.at.split(",").map(Number);
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("seed-rm")) seedRemoveAt(pointOf(b)); else seedToggleSel(pointOf(b));
    });
    list.addEventListener("keydown", (e) => {
      const b = e.target.closest(".seed-btn");
      if (!b) return;
      const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key];
      if (dir) { e.preventDefault(); seedMoveDir(pointOf(b), dir); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); seedRemoveAt(pointOf(b)); }
      else if (e.key === "Escape" && ui.pts.sel) { e.preventDefault(); seedToggleSel(ui.pts.sel); }
    });
  }

  // -- the relief-hours sentence: when today direct sun reaches this wall, from the same solar runs the sun band draws
  function renderReliefHours() {
    const S = window.SunStudioSolar;
    const wins = sunWindows(S, lightDate(), cityOf(), ui.light.facing);
    $("#relief-hours").textContent = wins.length
      ? tx("relief_hours", { win: wins.map((w) => tx("relief_win", { a: S.fmtHour(w.from), b: S.fmtHour(w.to) })).join(", ") }) : tx("relief_hours_none");
  }

  // -- the sun sweep on load (Burak 2026-10-17; DESIGN.md Motion): the computed sun crosses today's direct-sun band on this wall's real
  // geometry for ~SWEEP_MS, then settles at the opening hour. It draws through drawLight(): the same light engine, no fake light.
  // Off under prefers-reduced-motion and with ?sweep=0. Any input on a control stops it at once (scrolling does not): a control other
  // than the hour slider settles the hour at the opening hour, the slider keeps what the user sets.
  // Test hooks: window.composerTest.ready() is false while the sweep is pending/running, document.body.dataset.sweep reads
  // pending | running | done | off, composerTest.sweepState() / skipSweep() / sweepDone() (a promise) exist for runners.
  const SWEEP_MS = 2000, SWEEP_CROSS = 0.7;      // the last 30 % glides from the band's end to the opening hour
  let sweepResolve = () => {};
  const sweepDone = new Promise((r) => { sweepResolve = r; });
  const setSweep = (state) => { ui.sweep = { ...ui.sweep, state }; document.body.dataset.sweep = state; if (state === "done" || state === "off") sweepResolve(state); };
  const setHour = (h) => { ui.light.hour = Math.round(h * 4) / 4; $("#hour").value = String(ui.light.hour); drawLight(); };
  function endSweep(settle = true) {
    if (ui.sweep.state !== "running") return;
    cancelAnimationFrame(ui.sweep.raf);
    setSweep("done");
    if (settle) setHour(ui.sweep.target);
  }
  function startSweep() {
    if (ui.sweep.state !== "pending") return;
    const runs = sunRuns(window.SunStudioSolar, lightDate(), cityOf(), ui.light.facing).filter((r) => r.state === "sun");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || new URLSearchParams(location.search).get("sweep") === "0" || !runs.length) { setSweep("off"); return; }
    const from = runs[0].from, to = runs[runs.length - 1].to, target = ui.light.hour, t0 = performance.now();
    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
    ui.sweep.target = target;
    setSweep("running");
    const frame = (now) => {
      if (ui.sweep.state !== "running") return;
      const p = Math.min(1, (now - t0) / SWEEP_MS);
      try {
        setHour(p < SWEEP_CROSS ? from + (to - from) * ease(p / SWEEP_CROSS) : to + (target - to) * ease((p - SWEEP_CROSS) / (1 - SWEEP_CROSS)));
      } catch (e) { console.error(e); endSweep(false); return; }          // never leave the page "running": runners and the hour slider wait on it
      if (p >= 1) { setSweep("done"); return; }
      ui.sweep.raf = requestAnimationFrame(frame);
    };
    setTimeout(() => endSweep(true), 3 * SWEEP_MS);                       // failsafe: a starved or hidden tab still ends on the opening hour
    try { setHour(from); } catch (e) { console.error(e); endSweep(false); return; }
    ui.sweep.raf = requestAnimationFrame(frame);
  }
  const CONTROL = "input, select, textarea, button, a[href]";
  for (const type of ["pointerdown", "keydown", "focusin"]) {
    document.addEventListener(type, (e) => {
      if (ui.sweep.state === "running" && e.target.closest?.(CONTROL)) endSweep(!e.target.closest("#hour"));
    }, true);
  }

  // -- print: A-01 is one A4 sheet (style.css @media print); the browser's own title / header reads as the sheet, never as an offer
  const printTitle = () => `A-01 ${vm.client ? tx("sheet_a01") : tx($("#a01-h [data-view=architect]").dataset.s)}`;
  let screenTitle = null;
  window.addEventListener("beforeprint", () => { screenTitle = document.title; document.title = printTitle(); });
  window.addEventListener("afterprint", () => { if (screenTitle !== null) document.title = screenTitle; screenTitle = null; });

  function placeDetail(cellAt, kit) {
    const fig = $("#detail"), box = $("#callout");
    if (!cellAt) { fig.hidden = true; box.hidden = true; ui.detail = null; ui.detailInfo = null; return; }
    const { comp } = ui.state;
    const b = pieceBox(wallCuts(comp, kit), cellAt.r, cellAt.c, kit.module_mm, L.wallMm(comp, kit));
    Object.assign(box.style, { left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
    box.hidden = false;
    box.classList.toggle("top", cellAt.r === 0);          // top row: the tag drops inside the frame, clear of the sheet index
    const m = mouldCache.get(`${comp.design}/${cellAt.id}`);
    fig.querySelector(".detail-box").style.aspectRatio = `${kit.module_mm[0]} / ${kit.module_mm[1]}`;     // never stretch a 600 x 400 plate square
    const { wall, pxPerMm } = composeWall([[[cellAt.id, cellAt.k]]], kit, { [cellAt.id]: m }, 1, 1);
    const enc = encodeTwoChannel(wall);
    ui.detailView.setWall(enc, pxPerMm);
    ui.detail = { w: enc.w, h: enc.h };
    fig.hidden = false;
    ui.detailInfo = { id: cellAt.id, module: kit.module_mm };
    renderDetailCap();
  }

  function renderDetailCap() {
    const d = ui.detailInfo;
    if (!d) return;
    $("#detail-cap").replaceChildren(el("b", {}, tx("detail_title")), vm.client ? tx("detail_meta_client", { w: d.module[0], h: d.module[1] }) : tx("detail_meta", {
      id: mouldLabel(curKit(), d.id, tx("mould_flat")), w: d.module[0], h: d.module[1], x: fmtDec(ui.detailScale ?? DETAIL_SCALE, 1, ui.locale) }),
      el("small", { class: "depth-copy" }, $("#depth-out").textContent), ...(curKit().preview ? [el("small", { class: "preview-copy" }, tx("preview_label"))] : []));       // phone: the depth caption rides with Detail A (the elevation's copy is hidden there)
  }

  async function recompose() {
    const seq = ++ui.seq;
    const { comp } = ui.state;
    const kit = curKit();
    const { rows } = verify(comp, kit);
    const box = $("#wallbox");
    $("#light-status").textContent = "";
    sizeStage();
    if (!ui.view) { box.classList.add("off"); $("#light-status").textContent = tx("light_unavailable"); placeDetail(null); setSweep("off"); return; }
    if (!lightSupported(rows, comp)) { box.classList.add("off"); $("#light-status").textContent = tx("light_stagger"); placeDetail(null); setSweep("off"); return; }
    box.classList.remove("off");
    box.classList.add("loading");
    try {
      const { man, dir } = manifests[comp.design];
      const ids = [...new Set(rows.flat().map(([id]) => id))];
      const need = ids.filter((id) => !mouldCache.has(`${comp.design}/${id}`));
      if (need.length) {
        const got = await loadMoulds(dir, man, need);
        for (const id of need) mouldCache.set(`${comp.design}/${id}`, got[id]);
      }
      if (seq !== ui.seq) return;
      const moulds = Object.fromEntries(ids.map((id) => [id, mouldCache.get(`${comp.design}/${id}`)]));
      const cutRows = wallCuts(comp, kit);
      const { wall, pxPerMm } = composeWall(rows, kit, moulds, comp.cols, comp.rows, cutRows);
      const enc = encodeTwoChannel(wall);
      ui.view.setWall(enc, pxPerMm);
      ui.wall = { w: enc.w, h: enc.h };
      const depth = Math.max(...ids.map((id) => man.moulds[id].relief_mm));
      ui.depthMm = depth;
      $("#depth-out").textContent = curKit().preview ? "" : tx("light_depth", { mm: fmtDec(depth, 1, ui.locale) });      // a face preview has no honest depth to state
      if (ui.detailView) {
        placeDetail(detailCell(rows, measuredRelief(moulds), cutRows), kit);
      }
      box.classList.remove("loading");
      drawLight();
      startSweep();
    } catch (e) {
      box.classList.remove("loading");
      if (ui.sweep.state === "pending") setSweep("off");
      else endSweep(false);
      $("#light-status").textContent = `${tx("light_error")}: ${e.message}`;
    }
  }

  // -- orchestrate
  function render({ recompose: rc = false } = {}) {
    const mark = focusMark();
    const { comp } = ui.state;
    const code = L.encode(comp, kits);
    ui.code = code;
    if (!L.fixedPlan(curKit())) ui.target = wallMetres(comp, curKit());          // the code carries the wall; the target only outlives it while a fixed plan is picked
    if (vm.writesUrl) {
      const next = new URL(location.href);
      next.searchParams.set("c", code);
      next.searchParams.set("l", ui.locale);
      if (L.fixedPlan(curKit()) && targetDiffers(ui.target, wallMetres(comp, curKit()))) next.searchParams.set("t", targetParam(ui.target));
      else next.searchParams.delete("t");
      next.searchParams.set("city", ui.light.city);
      next.searchParams.set("f", String(ui.light.facing));
      if (ui.quote) next.searchParams.set("mode", "quote");   // a reload stays on the quote screen, though the address now carries a code
      else next.searchParams.delete("mode");
      history.replaceState(null, "", next);
    }
    applyStrings();
    if (ui.depthMm != null) $("#depth-out").textContent = curKit().preview ? "" : tx("light_depth", { mm: fmtDec(ui.depthMm, 1, ui.locale) });
    $("#preview-note").hidden = !curKit().preview;
    $("#preview-note").textContent = curKit().preview ? tx("preview_label") : "";
    const err = $("#notice"), colourNote = ui.errorKind === "finish";
    const brokenLink = vm.client && ui.error && !colourNote;
    document.body.classList.toggle("broken-link", brokenLink);
    err.hidden = !ui.error;
    err.className = colourNote || brokenLink ? "notice soft" : "notice";
    $("#notice-text").textContent = !ui.error ? "" : brokenLink ? tx("err_link_client") : colourNote ? tx("err_finish", { finish: finishLabel(ui.shownFinish) }) : tx("err_code");
    $("#copy-orig").hidden = !(ui.error && ui.originalCode && !vm.client);      // the architect can always take the code they arrived with
    for (const n of [$("#gl"), $("#code")]) if (n) { if (ui.error) n.setAttribute("aria-describedby", "notice"); else n.removeAttribute("aria-describedby"); }
    if (ui.error) console.warn("composition code rejected:", ui.error);
    renderElevation();
    renderRamp();
    renderSeeds();
    applyTint();
    renderRooms(code);
    if (vm.client) renderClient(code);
    else {
      renderControls();
      const { rows } = verify(comp, curKit());
      renderSend(code, renderPrice(rows));
      renderLayingMini(code);
    }
    renderLightControls();
    renderBand();
    renderBoxSums();
    if (!vm.client) { renderFit(); renderDimErr(); }
    updateAlt();
    if (rc) recompose();
    else {
      sizeStage();
      renderDetailCap();
      drawLight();
    }
    focusRestore(mark);
  }

  function renderLightControls() {
    const cities = Object.entries(config.light.cities);
    const sel = $("#city");
    sel.replaceChildren(...cities.map(([id]) => el("option", { value: id, selected: id === ui.light.city }, tx(`city_${id}`))));
    const face = $("#facing");
    face.replaceChildren(...COMPASS.map(([k, deg]) => el("option", { value: deg, selected: deg === ui.light.facing }, `${tx(`dir_${k}`)} ${deg}°`)));
  }

  // -- wire
  if (vm.client) {
    ui.by = cleanBy(new URLSearchParams(location.search).get("by"));
    if (!ui.by) $("#c-by-top")?.remove();             // no name given: the page opens on the wall
    $(".sun-read").hidden = true;                      // clients get the picture, not the azimuth and date
  }
  buildDims();
  wireBoxes();
  if (vm.client) $("#box-place").dataset.box = "place-client";     // the client sheet keeps the city and facing on the page (its own key: an architect's choice never closes it)
  initBox($("#box-place"), vm.client);
  if ($("#box-layout")) initBox($("#box-layout"), false);
  $("#print").addEventListener("click", () => window.print());
  const lightToUrl = () => {                       // a reload, Back or a copied address keeps the wall's city and facing
    if (!vm.writesUrl) return;
    const next = new URL(location.href);
    next.searchParams.set("city", ui.light.city);
    next.searchParams.set("f", String(ui.light.facing));
    history.replaceState(null, "", next);
    if (!vm.client) renderSend(ui.code, renderPrice(verify(ui.state.comp, curKit()).rows));    // the DM link carries the light too
  };
  $("#city").addEventListener("change", (e) => { ui.light.city = e.target.value; renderBand(); renderBoxSums(); scheduleDraw(); lightToUrl(); });
  $("#facing").addEventListener("change", (e) => { ui.light.facing = parseFloat(e.target.value); renderElevation(); renderBand(); renderBoxSums(); scheduleDraw(); lightToUrl(); });
  $("#hour").addEventListener("input", (e) => { ui.light.hour = parseFloat(e.target.value); scheduleDraw(); });
  $("#hour").value = String(ui.light.hour);
  for (const b of document.querySelectorAll("[data-lang]")) {
    b.addEventListener("click", () => { ui.locale = b.dataset.lang; render({}); });
  }
  if (!vm.client) {
    $("#offset-minus").addEventListener("click", () => act({ type: "offset", delta: 1 }));       // less relief = the ramp advances one step off the wall
    $("#offset-plus").addEventListener("click", () => act({ type: "offset", delta: -1 }));       // more relief = one step back toward the corner
    $("#reshuffle").addEventListener("click", () => act({ type: "reshuffle", seed: newSeed() }));
    $("#copy-code").addEventListener("click", () => copy(ui.code));
    $("#copy-msg").addEventListener("click", () => { copy(ui.message); lead("copy"); });
    $("#ig").addEventListener("click", () => { copy(ui.message); toast(tx("send_ig_hint")); lead("instagram"); });
    $("#share-client").addEventListener("click", shareClient);
    $("#by").addEventListener("input", (e) => { ui.by = cleanBy(e.target.value); renderSend(ui.code, renderPrice(verify(ui.state.comp, curKit()).rows)); });      // the DM text carries the name as it is typed
    $("#copy-orig").addEventListener("click", () => copy(ui.originalCode));
    // one total on the page: the dock steps aside while the antet itself is on screen
    const inView = new Set();
    const watchDock = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) inView.add(e.target); else inView.delete(e.target); }
      $("#dock").classList.toggle("away", inView.size > 0);
    }, { threshold: 0.15 });
    watchDock.observe($("#antet"));
    watchDock.observe($("#quote"));
    wireQuote();
  }
  if (!vm.client) wireSeeds();
  window.addEventListener("resize", () => { sizeStage(); fitStrip(); scheduleDraw(); });
  new ResizeObserver(() => fitStageTop()).observe($(".stage"));
  new ResizeObserver(() => fitRunLabels()).observe($("#runs"));            // a rotated phone or a resized window re-fits the band words

  render({ recompose: true });
  if (!vm.client && new URLSearchParams(location.search).get("pts") === "1") seedsToggle(true);      // test / shot hook: open with the points editor on (never written back)
  // Test hook (parity harness): draw the composed wall at texture resolution at a manual light.
  window.composerTest = {
    ready: () => ui.wall !== null && !$("#wallbox").classList.contains("loading") && !["pending", "running"].includes(ui.sweep.state),
    sweepState: () => ui.sweep.state,
    skipSweep: () => endSweep(true),
    sweepDone: () => sweepDone,
    drawNative: (o) => {
      if (ui.tintNative) ui.view.setTint(null);              // the parity harness compares the untinted shader
      ui.view.draw({ ...o, directLit: true });
      const url = canvas.toDataURL("image/png");
      applyTint();
      return url;
    },
    meta: () => ui.view.meta,
    drawAt: ({ canvasW, fine }) => {                         // the wall as the page lights it now, at a chosen size: for test_fine_render.py
      const { sun, wall } = lightAngles();
      ui.view.draw({ azDeg: wall.azPrime, elDeg: wall.elPrime, directLit: wall.directLit, sunElDeg: sun.elDeg, canvasW, fine });
      return canvas.toDataURL("image/png");
    },
    state: () => ui.state,
    message: () => ui.message,                               // the DM text the copy and Instagram buttons hand over
    view: () => vm,
    light: () => ({ ...ui.light }),
    detail: () => ui.detail,
  };
  document.body.dataset.ready = "1";
}

if (typeof document !== "undefined") {
  main().catch((e) => {
    const n = document.querySelector("#notice");
    if (n) { n.hidden = false; n.textContent = `Error: ${e.message}`; }
    console.error(e);
  });
}
