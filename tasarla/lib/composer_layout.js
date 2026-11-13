// composer_layout.js -- JS port of composition.py (validate / encode / decode / expand). ES module,
// no dependencies, runs in a browser and in node. PYTHON IS THE AUTHORITY: test_parity.py demands
// that every encode() string and every expand() cell equal composition.py's. Never port numpy's RNG:
// rotate "shuffle" is the 32-bit integer hash shuffleTurn(seed, col, row) below (Math.imul, >>> 0).
// Kits are the same JSON descriptors Python reads (kits/*.json), passed in as objects: {design: kit}.
// Code versions 1 to 4 (see composition._pack). v3 carries wall_mm [w, h] (cut-to-fit); cuts() gives each piece's
// [cutLeft, cutRight, cutTop, cutBottom] in mm (wall frame, after the turn); thinCuts() flags pieces under 1/4 module.
// v4 (corners engine) carries relief `seeds` [[x, y], ...] instead of a ramp: vertex step = min(range, smallest Manhattan distance
// in modules to a seed). seedPoints() offers exactly the vertices the validator (expand, strict) accepts; rampAsSeeds() and
// fitSeeds() mirror composition.py. See composition.py's docstring for the whole story.
// A resize.flow kit (Rotor, Plates) takes the lay at a wall size from the file baked with its own generator (flowCells), so the S band / the fold
// chain is laid again for the typed size; a size not baked falls back to the method below.
// A plan kit with a `resize` block (Rotor, Crest, Plates, THROAT) is a gallery wall that takes any size: planLayout() keeps the plan
// top-left and crops it, continues it by its period (resize.period, else the plan itself; resize.edges re-lays a continued cell whose
// edges would not mate) or re-applies its rule (throat_cell); cut-to-fit cuts its last column (right) and last row (bottom). A plan
// kit without `resize` (Hemiola) stays fixed. Same code, same cells as composition.plan_layout (test_parity.py).
// resize.method "courses" (Fugato, Library 093) lays staggered 600 x 400 courses by the generator's law: rows hold a varying number of plates (courseSpans),
// the plan stays top-left, and past it a plate is picked by cellHash. The cut course is the top one (cutSides(comp, kit)); suppliedModules counts the plates they are cut from, offcuts reused (cutPlates).

export const VERSION = 4;
export const SEEDS_MAX = 4;
export const SEED_PAD = 8;
export const SEED_BITS = 7;
export const WALL_BITS = 16;
export const THIN_CUT = 4;
export const LINES = [20, 40, 60, 66, 12];      // append only: the code stores the index (3 bits); 66 = 600 x 600 module, 12 = 1200 x 600 module
export const V1_LINES = LINES.slice(0, 2);
export const MIN_SIDE = 1, MAX_SIDE = 64;
export const BONDS = ["stack", "half", "third"];
export const ROTATES = ["none", "pinwheel", "halfturn", "shuffle"];
export const ENGINES = ["bond", "corners", "plan"];
export const V1_ENGINES = ENGINES.slice(0, 2);
const BOND_OFFSET = { stack: [0, 1], half: [1, 2], third: [1, 3] };
const PINWHEEL = [[0, 1], [3, 2]];
const TAG_RE = /^[A-Z0-9]{1,15}$/;
const TAG_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const FOLD = { O: "0", I: "1", L: "1" };
const M32 = 0xFFFFFFFF;

export class CompositionError extends Error {}

const fail = (msg) => { throw new CompositionError(msg); };

function int(v, lo, hi, what) {
  if (!Number.isInteger(v)) fail(`${what} must be an integer, got ${v}`);
  if (v < lo || v > hi) fail(`${what} must be ${lo}..${hi}, got ${v}`);
  return v;
}

export function validate(comp, kits = null) {
  if (comp === null || typeof comp !== "object" || Array.isArray(comp)) fail("composition must be an object");
  const engine = comp.engine;
  if (!ENGINES.includes(engine)) fail(`engine must be one of ${ENGINES}, got ${engine}`);
  const seeded = comp.v === 4;
  const extra = { bond: ["bond", "rotate", "seed"], corners: seeded ? ["seeds"] : ["ramp"], plan: [] }[engine];
  const base = ["v", "line", "design", "colour", "engine", "cols", "rows"];
  const walled = "wall_mm" in comp;
  const allowed = base.concat(extra, walled ? ["wall_mm"] : []);
  const missing = allowed.filter((k) => !(k in comp));
  const unknown = Object.keys(comp).filter((k) => !allowed.includes(k));
  if (missing.length || unknown.length) fail(`keys missing ${missing} / unknown ${unknown}`);
  const v = int(comp.v, 1, VERSION, "v");
  int(comp.line, 0, 99, "line");
  if (!LINES.includes(comp.line)) fail(`line must be one of ${LINES}, got ${comp.line}`);
  if (v === 1 && (!V1_LINES.includes(comp.line) || !V1_ENGINES.includes(engine))) fail(`a v1 code holds lines ${V1_LINES} and engines ${V1_ENGINES}; line ${comp.line} engine ${engine} needs v 2`);
  for (const key of ["design", "colour"]) {
    if (typeof comp[key] !== "string" || !TAG_RE.test(comp[key])) fail(`${key} must be 1..15 chars of A-Z0-9, got ${comp[key]}`);
  }
  int(comp.cols, MIN_SIDE, MAX_SIDE, "cols");
  int(comp.rows, MIN_SIDE, MAX_SIDE, "rows");
  const out = {};
  for (const k of base) out[k] = comp[k];
  if (v === 4 && engine !== "corners") fail("code version 4 carries relief seeds: engine 'corners' only");
  if ((v === 3 && !walled) || (v < 3 && walled)) fail("wall_mm is carried by code versions 3 and 4 (v 3 needs wall_mm, v 4 may carry it)");
  if (walled) {
    const wm = comp.wall_mm;
    if (!Array.isArray(wm) || wm.length !== 2) fail("wall_mm must be [width_mm, height_mm]");
    out.wall_mm = [int(wm[0], 1, 2 ** WALL_BITS - 1, "wall_mm.w"), int(wm[1], 1, 2 ** WALL_BITS - 1, "wall_mm.h")];
  }
  if (engine === "bond") {
    if (!BONDS.includes(comp.bond)) fail(`bond must be one of ${BONDS}, got ${comp.bond}`);
    if (!ROTATES.includes(comp.rotate)) fail(`rotate must be one of ${ROTATES}, got ${comp.rotate}`);
    const seed = int(comp.seed, 0, M32, "seed");
    if (comp.rotate === "shuffle") {
      if (comp.bond !== "stack") fail("rotate 'shuffle' needs bond 'stack'");
    } else if (seed !== 0) fail("seed must be 0 unless rotate is 'shuffle'");
    Object.assign(out, { bond: comp.bond, rotate: comp.rotate, seed });
  } else if (engine === "corners" && seeded) {
    out.seeds = checkSeeds(comp.seeds, comp.cols, comp.rows);
  } else if (engine === "corners") {
    const r = comp.ramp;
    const keys = r && typeof r === "object" ? Object.keys(r).sort().join() : "";
    if (keys !== "a,b,d,o") fail("ramp must be an object with keys a,b,d,o");
    out.ramp = { a: int(r.a, -16, 15, "ramp.a"), b: int(r.b, -16, 15, "ramp.b"),
                 d: int(r.d, 1, 31, "ramp.d"), o: int(r.o, -128, 127, "ramp.o") };
  }
  if (kits !== null) validateAgainstKit(out, kits);
  return out;
}

// seeds -> [[x, y], ...]: 1..SEEDS_MAX integer points within SEED_PAD of the wall, strictly increasing by (y, x) (= composition._check_seeds)
function checkSeeds(seeds, cols, rows) {
  if (!Array.isArray(seeds) || seeds.length < 1 || seeds.length > SEEDS_MAX) fail(`seeds must be a list of 1..${SEEDS_MAX} points`);
  const out = seeds.map((s) => {
    if (!Array.isArray(s) || s.length !== 2) fail("a seed is [x, y]");
    return [int(s[0], -SEED_PAD, cols + SEED_PAD, "seed.x"), int(s[1], -SEED_PAD, rows + SEED_PAD, "seed.y")];
  });
  for (let k = 1; k < out.length; k++) {
    if (out[k - 1][1] > out[k][1] || (out[k - 1][1] === out[k][1] && out[k - 1][0] >= out[k][0])) fail("seeds must be sorted by (y, x) with no duplicates");
  }
  return out;
}

function validateAgainstKit(comp, kits) {
  const kit = kits[comp.design];
  if (!kit) fail(`unknown design ${comp.design}; known: ${Object.keys(kits).sort()}`);
  checkKit(kit);
  if (kit.engine !== comp.engine) fail(`design ${comp.design} is a ${kit.engine} kit, not ${comp.engine}`);
  if (kit.line !== comp.line) fail(`design ${comp.design} is line ${kit.line}, not ${comp.line}`);
  if ("colours" in kit && !kit.colours.includes(comp.colour)) fail(`colour ${comp.colour} not offered for ${comp.design}`);
  const [w, h] = kit.module_mm;
  if (comp.wall_mm) {
    [[comp.cols, w, comp.wall_mm[0], "w"], [comp.rows, h, comp.wall_mm[1], "h"]].forEach(([n, mod, v, ax]) => {
      if (!((n - 1) * mod < v && v <= n * mod)) fail(`wall_mm ${ax} ${v} mm does not fit ${n} modules of ${mod} mm (${(n - 1) * mod} < ${ax} <= ${n * mod})`);
    });
  }
  if (w !== h && (comp.rotate === "pinwheel" || comp.rotate === "shuffle")) fail(`rotate ${comp.rotate} lays quarter-turns; module ${w}x${h} mm is not square`);
  if (w !== h && comp.engine === "corners") fail(`corners engine turns tiles by quarter-turns; module ${w}x${h} mm is not square`);
  if (comp.engine === "plan" && !isResizable(kit)) {
    if (comp.cols !== kit.plan.cols || comp.rows !== kit.plan.rows) fail(`design ${comp.design} is a fixed plan of ${kit.plan.cols} x ${kit.plan.rows} modules, not ${comp.cols} x ${comp.rows}`);
    if (comp.wall_mm) fail("a fixed plan takes no wall_mm");
  }
}

export function checkKit(kit) {
  for (const key of ["kit", "design", "line", "module_mm", "engine", "moulds"]) if (!(key in kit)) fail(`kit missing ${key}`);
  if (!ENGINES.includes(kit.engine) || !kit.moulds.length) fail(`kit ${kit.kit}: bad engine or no moulds`);
  if (kit.engine === "corners") {
    int(kit.code_den, 1, 1000, "kit.code_den");
    int(kit.range_steps, 1, 1000, "kit.range_steps");
    for (const m of kit.moulds) {
      const c = m.corners;
      if (!Array.isArray(c) || c.length !== 4 || c.some((x) => !Number.isInteger(x) || x < 0 || x > kit.range_steps)) fail(`mould ${m.id}: corners must be 4 ints in 0..range_steps`);
    }
  }
  for (const m of kit.moulds) {
    if (!m.turns || !m.turns.length || m.turns.some((t) => ![0, 1, 2, 3].includes(t))) fail(`mould ${m.id}: turns must be a non-empty subset of 0..3`);
  }
  if (kit.engine === "plan") {
    checkPlan(kit);
    if (kit.resize) checkResize(kit);
  }
  return kit;
}

function checkPlan(kit) {
  const plan = kit.plan;
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.courses)) fail(`kit ${kit.kit}: a plan kit needs plan.courses`);
  const cols = int(plan.cols, MIN_SIDE, MAX_SIDE, "plan.cols"), rows = int(plan.rows, MIN_SIDE, MAX_SIDE, "plan.rows");
  const [w, h] = kit.module_mm;
  const moulds = Object.fromEntries(kit.moulds.map((m) => [m.id, m]));
  if (plan.courses.length !== rows) fail(`kit ${kit.kit}: plan has ${plan.courses.length} courses, not ${rows}`);
  plan.courses.forEach((course, r) => {
    let total = 0;
    for (const p of course.pieces) {
      const m = moulds[p.mould];
      if (!m || !m.turns.includes(p.turn) || (w !== h && p.turn % 2)) fail(`kit ${kit.kit}: course ${r} piece ${p.mould} is not a legal mould/turn`);
      const shown = w - p.cut_left - p.cut_right;
      if (p.cut_left < 0 || p.cut_right < 0 || shown <= 0) fail(`kit ${kit.kit}: course ${r} piece ${p.mould} has no visible width`);
      total += shown;
    }
    if (Math.abs(total - cols * w) > 1e-6) fail(`kit ${kit.kit}: course ${r} is ${total} mm wide, not ${cols * w}`);
  });
}

// ---------------------------------------------------------------------------- resizable plans (= composition.py "resizable plans")
export const RESIZE_METHODS = ["tile", "rule", "courses"];
const THROAT_LEVELS = 6, THROAT_GAIN = 7.2, THROAT_BIAS = 1.2, THROAT_SQUASH = 0.5;
const THROAT_NORM = Math.sqrt(1.25);           // hypot(1, 0.5); sqrt is correctly rounded in both languages, hypot is not
const EDGE_TOP = 0, EDGE_BOTTOM = 1, EDGE_LEFT = 2, EDGE_RIGHT = 3;
const COURSE_GLIDE = 0.37, COURSE_PHASE = 0.13, COURSE_STEPS_PER_MM = 2;       // courses: the Library generator's glide stagger, quantised to 0.5 mm

// A plan kit with a resize block takes any wall size; one without (Hemiola) is fixed.
export const isResizable = (kit) => kit.engine === "plan" && !!kit.resize;
export const fixedPlan = (kit) => kit.engine === "plan" && !kit.resize;
export const coursesKit = (kit) => isResizable(kit) && kit.resize.method === "courses";

const planCells = (kit) => kit.plan.courses.map((c) => c.pieces.map((p) => [p.mould, p.turn]));
const sameCell = (a, b) => a[0] === b[0] && a[1] === b[1];

function checkResize(kit) {
  const rz = kit.resize, plan = kit.plan;
  if (!rz || typeof rz !== "object" || !RESIZE_METHODS.includes(rz.method)) fail(`kit ${kit.kit}: resize.method must be one of ${RESIZE_METHODS}`);
  const ids = new Set(kit.moulds.map((m) => m.id)), base = planCells(kit);
  if (rz.flow !== undefined) checkFlow(kit);
  if (rz.method === "courses") return checkCourses(kit);
  if (rz.method === "rule") {
    if (rz.rule !== "throat_cell" || !Array.isArray(rz.levels) || rz.levels.length !== THROAT_LEVELS || rz.levels.some((x) => !ids.has(x))) fail(`kit ${kit.kit}: resize rule 'throat_cell' needs ${THROAT_LEVELS} levels, all moulds of the kit`);
    const laid = ruleLayout(rz, plan.cols, plan.rows);
    if (laid.some((row, r) => row.some((cell, c) => !sameCell(cell, base[r][c])))) fail(`kit ${kit.kit}: the plan is not what resize.rule lays at ${plan.cols} x ${plan.rows}`);
    return;
  }
  const [pc, pr] = rz.period ?? [plan.cols, plan.rows];
  int(pc, 1, plan.cols, "resize.period cols");
  int(pr, 1, plan.rows, "resize.period rows");
  int(rz.seed ?? 0, 0, M32, "resize.seed");
  base.forEach((row, r) => row.forEach((cell, c) => {
    if (!sameCell(cell, base[r % pr][c % pc])) fail(`kit ${kit.kit}: the plan does not repeat with period ${pc} x ${pr} (cell ${c},${r})`);
  }));
  if (!rz.edges) return;
  for (const m of kit.moulds) {
    const per = rz.edges[m.id];
    if (!Array.isArray(per) || per.length !== 4 || per.some((e, k) => (e !== null) !== m.turns.includes(k) || (e !== null && (!Array.isArray(e) || e.length !== 4)))) fail(`kit ${kit.kit}: resize.edges[${m.id}] must hold [top, bottom, left, right] for each legal turn, null for the rest`);
  }
}

// resize.flow (= composition._check_flow): the lays baked per wall size with the kit's own generator, read from flow.json beside the manifest by the
// page (app.js) and attached as kit.resize.flow_data. A size in the file is the wall at that size; any other size falls back to resize.method.
export const FLOW_FORMAT = "flow-1";

// Rows of [mouldId, turn] for one baked size, or null when that size was not baked (= composition._flow_cells)
function flowCells(flow, key) {
  const s = flow.sizes[key];
  if (s === undefined) return null;
  const cols = Number(key.split("x")[0]), cells = [];
  for (const ch of s) cells.push(flow.alphabet[flow.chars.indexOf(ch)]);
  const rows = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols).map((x) => [x[0], x[1]]));
  return rows;
}

function checkFlow(kit) {
  const rz = kit.resize, plan = kit.plan, decl = rz.flow;
  if (!decl || typeof decl !== "object") fail(`kit ${kit.kit}: resize.flow must be an object {cols, rows}`);
  const fc = int(decl.cols, 1, MAX_SIDE, "resize.flow.cols"), fr = int(decl.rows, 1, MAX_SIDE, "resize.flow.rows"), flow = rz.flow_data;
  if (flow === undefined) return;
  const legal = new Set(kit.moulds.flatMap((m) => m.turns.map((k) => `${m.id}/${k}`)));
  if (flow.format !== FLOW_FORMAT || flow.kit !== kit.kit || flow.cols !== fc || flow.rows !== fr) fail(`kit ${kit.kit}: flow file is not ${FLOW_FORMAT} of this kit at ${fc} x ${fr}`);
  if (flow.alphabet.some((a) => !legal.has(`${a[0]}/${a[1]}`)) || flow.chars.length !== flow.alphabet.length) fail(`kit ${kit.kit}: flow alphabet holds a mould or turn the kit does not have`);
  const chars = new Set(flow.chars);
  for (const [key, s] of Object.entries(flow.sizes)) {
    const [c, r] = key.split("x").map(Number);
    if (!(c >= 1 && c <= fc && r >= 1 && r <= fr) || s.length !== c * r || [...s].some((ch) => !chars.has(ch))) fail(`kit ${kit.kit}: flow size ${key} is out of range or malformed`);
  }
  const gallery = flowCells(flow, `${plan.cols}x${plan.rows}`), base = planCells(kit);
  if (!gallery || gallery.some((row, r) => row.some((cell, c) => !sameCell(cell, base[r][c])))) fail(`kit ${kit.kit}: the flow lay at ${plan.cols} x ${plan.rows} is not the gallery plan`);
}

// throat_cell (scr2_layouts.THROAT_LEVELS as kit_screens.make lays it): see composition._rule_layout
function ruleLayout(rz, cols, rows) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const v = (rows - 1 - r + 0.5) / rows * THROAT_SQUASH, row = [];
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols, f = Math.sqrt(u * u + v * v) / THROAT_NORM;
      row.push([rz.levels[Math.max(0, Math.min(THROAT_LEVELS - 1, Math.floor(f * THROAT_GAIN - THROAT_BIAS)))], 0]);
    }
    out.push(row);
  }
  return out;
}

// = composition._check_courses
function checkCourses(kit) {
  const rz = kit.resize, plan = kit.plan, mw = kit.module_mm[0];
  int(rz.seed, 0, M32, "resize.seed");
  const edge = rz.min_edge_mm;
  if (typeof edge !== "number" || !(edge > 0 && edge <= mw / 2)) fail(`kit ${kit.kit}: resize.min_edge_mm must be above 0 and at most half a module, got ${edge}`);
  const saw = rz.saw_mm;
  if (typeof saw !== "number" || !(saw >= 0)) fail(`kit ${kit.kit}: resize.saw_mm must be 0 or more, got ${saw}`);
  if (kit.moulds.reduce((n, m) => n + m.turns.length, 0) < 3) fail(`kit ${kit.kit}: resize courses needs at least 3 units (mould, turn)`);
  plan.courses.forEach((course, r) => {
    const spans = courseSpans(kit, plan.cols * mw, r);
    if (spans.length !== course.pieces.length || course.pieces.some((p, i) => p.cut_left !== spans[i][0] || p.cut_right !== spans[i][1])) fail(`kit ${kit.kit}: plan course ${r} is not what resize courses lays at ${plan.cols * mw} mm`);
  });
}

// = composition._nudge_offset, the Library generator's nudge_offset (a tie goes to the smaller offset)
function nudgeOffset(offset, width, tile, minEdge) {
  const ok = (o) => {
    const left = (tile - o) % tile, right = (width + o) % tile;
    return (left === 0 || left >= minEdge) && (right === 0 || right >= minEdge);
  };
  if (ok(offset)) return offset;
  let best = null;
  for (let o = 0; o <= tile; o++) if (ok(o) && (best === null || Math.abs(o - offset) < Math.abs(best - offset))) best = o;
  return best;
}

// = composition._course_spans: [cutLeft, cutRight] of each plate course r (0 = top of the wall) shows on a wall `width` mm wide
function courseSpans(kit, width, r) {
  const mw = kit.module_mm[0];
  const raw = Math.trunc(COURSE_STEPS_PER_MM * mw * ((r * COURSE_GLIDE + COURSE_PHASE) % 1)) / COURSE_STEPS_PER_MM;
  const spans = [];
  for (let x = -nudgeOffset(raw, width, mw, kit.resize.min_edge_mm); x < width; x += mw) {
    const x0 = Math.max(0, x), x1 = Math.min(width, x + mw);
    if (x1 > x0) spans.push([x0 - x, x + mw - x1]);
  }
  return spans;
}

// = composition._courses_layout
function coursesLayout(kit, width, rows) {
  const base = planCells(kit), seed = kit.resize.seed, out = [];
  const units = kit.moulds.flatMap((m) => m.turns.map((k) => [m.id, k]));
  for (let r = 0; r < rows; r++) {
    const row = [], above = r ? out[r - 1] : [], n = courseSpans(kit, width, r).length;
    for (let i = 0; i < n; i++) {
      if (r < base.length && i < base[r].length) { row.push(base[r][i]); continue; }
      const pool = units.filter((u) => !(row.length && u[0] === row[row.length - 1][0] && u[1] === row[row.length - 1][1]) && !(i < above.length && u[0] === above[i][0] && u[1] === above[i][1]));
      row.push(pool[cellHash(seed, i, r) % pool.length].slice());
    }
    out.push(row);
  }
  return out;
}

// = composition.cut_plates: a courses kit's cut pieces grouped by the plate each is cut from, [{mould, pieces: [[r, i], ...]}], r = course (0 = top). Two pieces share a
// plate when they share a mould and the parts they keep, in the mould's own frame (a half turn swaps the cut sides), sit resize.saw_mm apart. First fit, largest first,
// ties in laying-map number order (bottom course first): a good count, not a proven least. Not validated.
export function cutPlates(comp, kit) {
  const [mw, mh] = kit.module_mm, [width, height] = wallMm(comp, kit), saw = kit.resize.saw_mm;
  const rows = coursesLayout(kit, width, comp.rows), topCut = comp.rows * mh - height;
  const area = (q) => (q[2] - q[0]) * (q[3] - q[1]);
  const apart = (a, b) => a[2] + saw <= b[0] || b[2] + saw <= a[0] || a[3] + saw <= b[1] || b[3] + saw <= a[1];
  const pieces = [];
  for (let r = comp.rows - 1; r >= 0; r--) {
    courseSpans(kit, width, r).forEach(([cl, cr], i) => {
      const ct = r === 0 ? topCut : 0;
      if (!(cl || cr || ct)) return;
      const [mould, turn] = rows[r][i];
      pieces.push({ mould, rect: turn === 2 ? [cr, 0, mw - cl, mh - ct] : [cl, ct, mw - cr, mh], where: [r, i] });
    });
  }
  pieces.sort((a, b) => area(b.rect) - area(a.rect));
  const plates = [];
  for (const { mould, rect, where } of pieces) {
    const plate = plates.find((p) => p.mould === mould && p.kept.every((o) => apart(rect, o)));
    if (plate) { plate.kept.push(rect); plate.pieces.push(where); } else plates.push({ mould, kept: [rect], pieces: [where] });
  }
  return plates.map(({ mould, pieces: placed }) => ({ mould, pieces: placed }));
}

// Modules are sold whole: a courses kit supplies a plate per whole piece plus the plates its cut pieces share, any other kit its cols x rows grid. Not validated (= composition.supplied_modules).
export function suppliedModules(comp, kit) {
  if (!coursesKit(kit)) return comp.cols * comp.rows;
  const width = wallMm(comp, kit)[0];
  let laid = 0;
  for (let r = 0; r < comp.rows; r++) laid += courseSpans(kit, width, r).length;
  return laid - cutPlates(comp, kit).reduce((saved, p) => saved + p.pieces.length - 1, 0);
}

// The 32-bit hash behind shuffleTurn (before its top two bits are taken)
function cellHash(seed, col, row) {
  const h = fmix32((seed ^ Math.imul(col, 0x9E3779B1)) >>> 0);
  return fmix32((h ^ Math.imul(row, 0x85EBCA77)) >>> 0);
}

// = composition._tile_layout
function tileLayout(kit, base, cols, rows) {
  const rz = kit.resize, plan = kit.plan, [pc, pr] = rz.period ?? [plan.cols, plan.rows], edges = rz.edges, seed = rz.seed ?? 0;
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      if (r < plan.rows && c < plan.cols) { row.push(base[r][c].slice()); continue; }
      let cell = base[r % pr][c % pc].slice();
      if (edges) {
        const top = r ? edges[out[r - 1][c][0]][out[r - 1][c][1]][EDGE_BOTTOM] : null;
        const left = c ? edges[row[c - 1][0]][row[c - 1][1]][EDGE_RIGHT] : null;
        const mates = (m, k) => { const e = edges[m][k]; return (top === null || e[EDGE_TOP] === top) && (left === null || e[EDGE_LEFT] === left); };
        if (!mates(cell[0], cell[1])) {
          const cands = [];
          for (const m of kit.moulds) for (const k of m.turns) if (mates(m.id, k)) cands.push([m.id, k]);
          const same = cands.filter((x) => x[0] === cell[0]), pool = same.length ? same : cands;
          if (pool.length) cell = pool[cellHash(seed, c, r) % pool.length];
        }
      }
      row.push(cell);
    }
    out.push(row);
  }
  return out;
}

// Was this size baked in the kit's resize.flow file (is the wall laid again for it)? (= composition.flow_baked)
export const flowBaked = (kit, cols, rows) => !!kit.resize?.flow_data && kit.resize.flow_data.sizes[`${cols}x${rows}`] !== undefined;

// Rows of [mouldId, turn] for a resizable plan kit at cols x rows modules, top course first. At the plan's own size it IS the plan.
// A courses kit depends on the real wall width (widthMm, default cols whole modules), not on cols.
export function planLayout(kit, cols, rows, widthMm = null) {
  if (coursesKit(kit)) return coursesLayout(kit, widthMm ?? cols * kit.module_mm[0], rows);
  const base = planCells(kit);
  if (cols === kit.plan.cols && rows === kit.plan.rows) return base;
  const baked = kit.resize.flow_data ? flowCells(kit.resize.flow_data, `${cols}x${rows}`) : null;
  if (baked) return baked;
  return kit.resize.method === "rule" ? ruleLayout(kit.resize, cols, rows) : tileLayout(kit, base, cols, rows);
}

// [[r, c, "h" | "v"]] for every joint of a laid wall whose edge classes (resize.edges) differ (= composition.edge_mismatches)
export function edgeMismatches(kit, rows) {
  const edges = kit.resize?.edges, bad = [];
  if (!edges) return bad;
  rows.forEach((row, r) => row.forEach(([m, k], c) => {
    if (c && edges[row[c - 1][0]][row[c - 1][1]][EDGE_RIGHT] !== edges[m][k][EDGE_LEFT]) bad.push([r, c, "h"]);
    if (r && edges[rows[r - 1][c][0]][rows[r - 1][c][1]][EDGE_BOTTOM] !== edges[m][k][EDGE_TOP]) bad.push([r, c, "v"]);
  }));
  return bad;
}

// the lowest code version that can carry a composition of this kit (1 keeps today's codes unchanged)
export const minVersion = (kit) => (V1_LINES.includes(kit.line) && V1_ENGINES.includes(kit.engine) ? 1 : 2);

// The wall as the architect reads it: wall_mm when the composition carries it, else the whole-module extent (= composition.wall_mm).
export const wallMm = (comp, kit) => (comp.wall_mm ? [...comp.wall_mm] : [comp.cols * kit.module_mm[0], comp.rows * kit.module_mm[1]]);

// comp with the wall set to wMm x hMm exactly (= composition.fit_wall): cols/rows = the modules needed (ceil), clamped to
// the side limits; a wall of whole modules carries no wall_mm (one code per wall); a fixed plan keeps its own size, a resizable one is cut to fit.
export function fitWall(comp, kit, wMm, hMm) {
  if (fixedPlan(kit)) return { ...comp };
  const [mw, mh] = kit.module_mm;
  wMm = int(Math.round(wMm), 1, MAX_SIDE * mw, "wall width mm");
  hMm = int(Math.round(hMm), 1, MAX_SIDE * mh, "wall height mm");
  const cols = Math.ceil(wMm / mw), rows = Math.ceil(hMm / mh);
  const out = { ...comp, cols, rows };
  delete out.wall_mm;
  const whole = wMm === cols * mw && hMm === rows * mh;
  if (comp.seeds) {                                  // a seeded wall stays v4, with or without wall_mm
    out.v = 4;
    if (!whole) out.wall_mm = [wMm, hMm];
  } else if (whole) out.v = minVersion(kit);
  else Object.assign(out, { v: 3, wall_mm: [wMm, hMm] });
  return out;
}

// ---------------------------------------------------------------------------- code
function gf32Mul2(x) {
  x <<= 1;
  return x & 32 ? (x ^ 0b100101) & 31 : x;
}

export function checkSymbol(symbols) {
  let s = 0;
  for (const d of symbols) s = gf32Mul2(s ^ d);
  return s;
}

function put(bits, value, n) {
  for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(value / 2 ** i) % 2);
}

function pack(comp) {
  const bits = [];
  const wide = comp.v >= 2;
  put(bits, comp.v, 5);
  put(bits, LINES.indexOf(comp.line), wide ? 3 : 1);
  put(bits, ENGINES.indexOf(comp.engine), wide ? 2 : 1);
  put(bits, comp.cols - 1, 6);
  put(bits, comp.rows - 1, 6);
  for (const key of ["design", "colour"]) {
    put(bits, comp[key].length, 4);
    for (const ch of comp[key]) put(bits, TAG_ALPHABET.indexOf(ch), 6);
  }
  if (comp.engine === "bond") {
    put(bits, BONDS.indexOf(comp.bond), 2);
    put(bits, ROTATES.indexOf(comp.rotate), 2);
    if (comp.rotate === "shuffle") put(bits, comp.seed, 32);
  } else if (comp.engine === "corners" && comp.v >= 4) {
    put(bits, comp.seeds.length - 1, 2);
    for (const [x, y] of comp.seeds) { put(bits, x + SEED_PAD, SEED_BITS); put(bits, y + SEED_PAD, SEED_BITS); }
  } else if (comp.engine === "corners") {
    put(bits, comp.ramp.a + 16, 5);
    put(bits, comp.ramp.b + 16, 5);
    put(bits, comp.ramp.d, 5);
    put(bits, comp.ramp.o + 128, 8);
  }
  if (comp.v >= 4) put(bits, comp.wall_mm ? 1 : 0, 1);
  if (comp.wall_mm) {
    put(bits, comp.wall_mm[0], WALL_BITS);
    put(bits, comp.wall_mm[1], WALL_BITS);
  }
  while (bits.length % 5) bits.push(0);
  const syms = [];
  for (let i = 0; i < bits.length; i += 5) syms.push(bits.slice(i, i + 5).reduce((a, b) => a * 2 + b, 0));
  return syms;
}

function unpack(symbols) {
  const bits = [];
  for (const s of symbols) for (let i = 4; i >= 0; i--) bits.push((s >> i) & 1);
  let pos = 0;
  const take = (n) => {
    if (pos + n > bits.length) fail("code is too short");
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 2 + bits[pos + i];
    pos += n;
    return v;
  };
  const pick = (seq, i, what) => (i < seq.length ? seq[i] : fail(`${what} index ${i} out of range`));
  const v = take(5);
  if (v < 1 || v > VERSION) fail(`unsupported composition code version ${v}`);
  const wide = v >= 2;
  const comp = { v, line: pick(LINES, take(wide ? 3 : 1), "line") };
  const engine = pick(ENGINES, take(wide ? 2 : 1), "engine");
  const cols = take(6) + 1, rows = take(6) + 1;
  const tags = [];
  for (let t = 0; t < 2; t++) {
    const n = take(4);
    let s = "";
    for (let i = 0; i < n; i++) {
      const idx = take(6);
      if (idx >= TAG_ALPHABET.length) fail("tag character out of range");
      s += TAG_ALPHABET[idx];
    }
    tags.push(s);
  }
  Object.assign(comp, { design: tags[0], colour: tags[1], engine, cols, rows });
  if (engine === "bond") {
    comp.bond = pick(BONDS, take(2), "bond");
    comp.rotate = pick(ROTATES, take(2), "rotate");
    comp.seed = comp.rotate === "shuffle" ? take(32) : 0;
  } else if (engine === "corners" && v >= 4) {
    const n = take(2) + 1;
    comp.seeds = [];
    for (let k = 0; k < n; k++) { const x = take(SEED_BITS) - SEED_PAD; comp.seeds.push([x, take(SEED_BITS) - SEED_PAD]); }
  } else if (engine === "corners") {
    comp.ramp = { a: take(5) - 16, b: take(5) - 16, d: take(5), o: take(8) - 128 };
  }
  if (v === 3 || (v >= 4 && take(1))) comp.wall_mm = [take(WALL_BITS), take(WALL_BITS)];
  return comp;
}

export function normaliseSymbols(text) {
  const out = [];
  for (let ch of text.toUpperCase()) {
    if ("- _\t".includes(ch)) continue;
    ch = FOLD[ch] ?? ch;
    const i = CROCKFORD.indexOf(ch);
    if (i < 0) fail(`character ${ch} is not valid in a composition code`);
    out.push(i);
  }
  return out;
}

const foldTag = (tag) => [...tag.trim().toUpperCase()].map((c) => FOLD[c] ?? c).join("");

export function encode(comp, kits = null) {
  comp = validate(comp, kits);
  const syms = pack(comp);
  syms.push(checkSymbol(syms));
  const text = syms.map((s) => CROCKFORD[s]).join("");
  const groups = text.match(/.{1,4}/g);
  return `${comp.design}-${groups.join("-")}`;
}

export function decode(code, kits = null) {
  if (typeof code !== "string" || !code.includes("-")) fail("a composition code is DESIGN-PAYLOAD");
  const trimmed = code.trim();
  const cut = trimmed.indexOf("-");
  const prefix = trimmed.slice(0, cut);
  const syms = normaliseSymbols(trimmed.slice(cut + 1));
  if (syms.length < 2) fail("code is too short");
  if (checkSymbol(syms) !== 0) fail("check character does not match (mistyped code?)");
  const body = syms.slice(0, -1);
  let comp = unpack(body);
  if (foldTag(prefix) !== foldTag(comp.design)) fail(`code prefix ${prefix} does not match its design ${comp.design}`);
  comp = validate(comp, kits);
  if (pack(comp).join() !== body.join()) fail("non-canonical code (padding or length)");
  return comp;
}

// ---------------------------------------------------------------------------- layout
function fmix32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85EBCA6B);
  h ^= h >>> 13;
  h = Math.imul(h, 0xC2B2AE35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function shuffleTurn(seed, col, row) {
  let h = fmix32((seed ^ Math.imul(col, 0x9E3779B1)) >>> 0);
  h = fmix32((h ^ Math.imul(row, 0x85EBCA77)) >>> 0);
  return h >>> 30;
}

export function rowOffset(bond, r) {
  const [num, den] = BOND_OFFSET[bond];
  return [(r * num) % den, den];
}

function bondTurn(rotate, seed, r, k) {
  if (rotate === "none") return 0;
  if (rotate === "pinwheel") return PINWHEEL[r % 2][k % 2];
  if (rotate === "halfturn") return (r + k) % 2 ? 2 : 0;
  return shuffleTurn(seed, k, r);
}

const fieldMoulds = (kit) => kit.moulds.filter((m) => (m.role ?? "field") === "field");

const div = (n, d) => n / d;       // exact for the integers it sees; Python keeps ints when they divide (same values)

// Row r of a bond wall as [[k, cutLeft, cutRight]] in mm, exact (= composition._bond_spans): piece k starts at k*w - s and the
// wall runs 0..W; the first piece loses s on the left, the piece that crosses W loses what lies past it.
function bondSpans(comp, kit, r) {
  const w = kit.module_mm[0];
  const [num, den] = rowOffset(comp.bond, r);
  const W = wallMm(comp, kit)[0];
  const out = [];
  for (let k = 0; k * w * den - w * num < W * den; k++) {
    const end = W * den - (k * w * den - w * num);
    out.push([k, k === 0 && num ? div(w * num, den) : 0, end < w * den ? w - div(end, den) : 0]);
  }
  return out;
}

function expandBond(comp, kit) {
  const srcs = fieldMoulds(kit);
  if (!srcs.length) fail(`kit ${kit.kit} has no field moulds`);
  const rows = [];
  for (let r = 0; r < comp.rows; r++) {
    const row = [];
    for (const [k] of bondSpans(comp, kit, r)) {
      const mould = srcs[(r + k) % srcs.length];
      const turn = bondTurn(comp.rotate, comp.seed, r, k);
      if (!mould.turns.includes(turn)) fail(`turn ${turn} at row ${r} piece ${k} is not legal for mould ${mould.id}`);
      row.push([mould.id, turn]);
    }
    rows.push(row);
  }
  return rows;
}

export function rampSteps(ramp, den, rangeSteps, colV, rowV) {
  const num = ramp.a * colV + ramp.b * rowV + ramp.o;
  const steps = Math.floor((2 * num * den + ramp.d) / (2 * ramp.d));
  return Math.max(0, Math.min(rangeSteps, steps));
}

// Code step at a vertex of a seeded wall: min(range, the smallest Manhattan distance to a seed, in modules) (= composition.seed_steps)
export const seedSteps = (seeds, rangeSteps, colV, rowV) => Math.min(rangeSteps, Math.min(...seeds.map(([x, y]) => Math.abs(colV - x) + Math.abs(rowV - y))));

// (rows+1) x (cols+1) vertex code grid in integer steps: relief seeds when the composition has them, else the ramp (= composition.cmap_steps)
export function cmapSteps(comp, kit) {
  const cm = [];
  for (let i = 0; i <= comp.rows; i++) {
    const line = [];
    for (let j = 0; j <= comp.cols; j++) {
      line.push(comp.seeds ? seedSteps(comp.seeds, kit.range_steps, j, i) : rampSteps(comp.ramp, kit.code_den, kit.range_steps, j, i));
    }
    cm.push(line);
  }
  return cm;
}

// {key(TL, TR, BR, BL): [mould_id, turn]}: every corner class the kit can lay, first mould (kit order) then first turn winning (= composition.corner_table).
// A Map keyed by a number (range_steps <= 1000 < 1024 per corner), cached per kit object.
const classKey = (a, b, c, d) => a + 1024 * (b + 1024 * (c + 1024 * d));
const tableCache = new WeakMap();
export function cornerTable(kit) {
  let table = tableCache.get(kit);
  if (!table) {
    table = new Map();
    for (const m of kit.moulds) {
      for (let k = 0; k < 4; k++) {
        if (!m.turns.includes(k)) continue;
        const key = classKey(...[0, 1, 2, 3].map((q) => m.corners[(q + k) % 4]));
        if (!table.has(key)) table.set(key, [m.id, k]);
      }
    }
    tableCache.set(kit, table);
  }
  return table;
}

function expandCorners(comp, kit, strict) {
  const cm = cmapSteps(comp, kit), table = cornerTable(kit);
  const rows = [];
  let missing = 0, first = null;
  for (let i = 0; i < comp.rows; i++) {
    const row = [];
    for (let j = 0; j < comp.cols; j++) {
      const want = [cm[i][j], cm[i][j + 1], cm[i + 1][j + 1], cm[i + 1][j]];
      let hit = table.get(classKey(...want));
      if (!hit) { missing++; first = first ?? want; hit = ["?", 0]; }
      row.push(hit.slice());
    }
    rows.push(row);
  }
  if (missing && strict) fail(`kit ${kit.kit} lacks ${missing} corner class(es), first ${first}`);
  return rows;
}

export function expand(comp, kit, strict = true) {
  comp = validate(comp, { [kit.design]: kit });
  if (comp.engine === "plan") return isResizable(kit) ? planLayout(kit, comp.cols, comp.rows, wallMm(comp, kit)[0]) : planCells(kit);
  return comp.engine === "bond" ? expandBond(comp, kit) : expandCorners(comp, kit, strict);
}

// Which side the corners engine cuts (= composition._corner_cut_sides): the corner where the ramp starts stays whole.
const cornerCutSides = (ramp) => [ramp.a < 0 ? "left" : "right", ramp.b > 0 ? "bottom" : "top"];

// A seeded wall cuts the edge column / row in the FLATTER stretch (= composition._seed_cut_sides): per axis the larger sum of the
// unsaturated seed distance over the edge cell's two vertex lines is cut; a tie cuts right / top.
function seedCutSides(comp) {
  const { seeds, cols, rows } = comp;
  const d = (j, i) => Math.min(...seeds.map(([x, y]) => Math.abs(j - x) + Math.abs(i - y)));
  let left = 0, right = 0, top = 0, bottom = 0;
  for (let i = 0; i <= rows; i++) { left += d(0, i) + d(1, i); right += d(cols - 1, i) + d(cols, i); }
  for (let j = 0; j <= cols; j++) { top += d(j, 0) + d(j, 1); bottom += d(j, rows - 1) + d(j, rows); }
  return [left > right ? "left" : "right", bottom > top ? "bottom" : "top"];
}

// [horizontal, vertical] wall edge a cut-to-fit wall is cut on (= composition.cut_sides): bond right/top; corners opposite the ramp's start,
// or the flatter edges of a seeded wall
// a resizable plan is anchored top-left: right column, bottom row; a courses kit (kit given) cuts its top course, against the ceiling
export const cutSides = (comp, kit = null) => (kit && coursesKit(kit) ? ["right", "top"] : comp.engine === "plan" ? ["right", "bottom"] : comp.engine !== "corners" ? ["right", "top"] : comp.seeds ? seedCutSides(comp) : cornerCutSides(comp.ramp));

// rows aligned with expand(): [cutLeft, cutRight, cutTop, cutBottom] mm per piece, wall frame, after the turn (= composition.cuts)
export function cuts(comp, kit) {
  comp = validate(comp, { [kit.design]: kit });
  if (fixedPlan(kit)) return kit.plan.courses.map((c) => c.pieces.map((p) => [p.cut_left, p.cut_right, 0, 0]));
  const [mw, mh] = kit.module_mm;
  const [W, H] = wallMm(comp, kit);
  const ew = comp.cols * mw - W, eh = comp.rows * mh - H;
  const [sideH, sideV] = cutSides(comp, kit);
  let out;
  if (coursesKit(kit)) {
    out = Array.from({ length: comp.rows }, (_, r) => courseSpans(kit, W, r).map(([cl, cr]) => [cl, cr, 0, 0]));
  } else if (comp.engine === "bond") {
    out = Array.from({ length: comp.rows }, (_, r) => bondSpans(comp, kit, r).map(([, cl, cr]) => [cl, cr, 0, 0]));
  } else {
    out = Array.from({ length: comp.rows }, () => Array.from({ length: comp.cols }, () => [0, 0, 0, 0]));
    if (ew) for (const row of out) { if (sideH === "right") row[row.length - 1][1] = ew; else row[0][0] = ew; }
  }
  if (eh) for (const piece of out[sideV === "top" ? 0 : out.length - 1]) piece[sideV === "top" ? 2 : 3] = eh;
  return out;
}

// [{edge, mm}] for every wall edge (left, right, top, bottom) whose laid pieces are thinner than 1/4 module (= composition.thin_cuts); a courses kit counts height only
export function thinCuts(comp, kit) {
  comp = validate(comp, { [kit.design]: kit });
  if (fixedPlan(kit)) return [];
  const [mw, mh] = kit.module_mm;
  const found = {}, courses = coursesKit(kit);
  for (const row of cuts(comp, kit)) {
    for (const [cl, cr, ct, cb] of row) {
      const lw = mw - cl - cr, lh = mh - ct - cb;
      if (lw * THIN_CUT < mw && !courses) { const e = cl ? "left" : "right"; found[e] = Math.min(lw, found[e] ?? lw); }
      if (lh * THIN_CUT < mh) { const e = ct ? "top" : "bottom"; found[e] = Math.min(lh, found[e] ?? lh); }
    }
  }
  return ["left", "right", "top", "bottom"].filter((e) => e in found).map((e) => ({ edge: e, mm: found[e] }));
}

// ---------------------------------------------------------------------------- relief seeds
// comp as a v4 seeded wall (any ramp dropped, wall_mm kept), seeds sorted by (y, x). Not validated (= composition.with_seeds).
export function withSeeds(comp, seeds) {
  const out = { ...comp, v: 4, seeds: seeds.map((s) => [s[0], s[1]]).sort((a, b) => a[1] - b[1] || a[0] - b[0]) };
  delete out.ramp;
  return out;
}

// the first (TL, TR, BR, BL) class of a vertex grid the kit lacks, or null: the strict check expandCorners applies, with an early exit
function firstMissing(cm, kit, cols, rows) {
  const table = cornerTable(kit);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (!table.has(classKey(cm[i][j], cm[i][j + 1], cm[i + 1][j + 1], cm[i + 1][j]))) return [i, j];
  return null;
}

// true when the corners composition lays with no missing corner class (= composition.lays; expandCorners strict is the authority)
export const lays = (comp, kit) => firstMissing(cmapSteps(comp, kit), kit, comp.cols, comp.rows) === null;

// The one seed a diagonal corner ramp (a, b = +-1, d = 2) with its offset is exactly equivalent to, or null (= composition.ramp_as_seeds)
export function rampAsSeeds(comp, kit) {
  if (comp.engine !== "corners" || !comp.ramp) return null;
  const r = comp.ramp, { cols, rows } = comp;
  if (r.d !== 2 || Math.abs(r.a) !== 1 || Math.abs(r.b) !== 1) return null;
  const right = r.a < 0, bottom = r.b < 0;
  const step = r.o - ((right ? cols : 0) + (bottom ? rows : 0));
  if (step < 0) return null;
  const pad = Math.min(step, SEED_PAD);
  const seeds = [[right ? cols + pad : 0 - pad, bottom ? rows : 0]];
  return JSON.stringify(cmapSteps(withSeeds(comp, seeds), kit)) === JSON.stringify(cmapSteps(comp, kit)) ? seeds : null;
}

// Every wall vertex [x, y] (reading order) a seed can be put on so that the wall still lays (= composition.seed_points): the other seeds
// (minus the one at index `without`) plus that point. The field is min(base field, distance to the point), which is the definition
// again, and a point only changes the vertices closer than range_steps to it: so the base grid is built once, its cells with no mould
// are listed, and each point re-checks only the cells it touches (and fails at once if a bad base cell lies outside them).
export function seedPoints(comp, kit, without = null) {
  const base = comp.seeds.filter((_, k) => k !== without);
  if (base.length >= SEEDS_MAX) return [];
  const { cols, rows } = comp, R = kit.range_steps, table = cornerTable(kit);
  const base0 = [];
  for (let i = 0; i <= rows; i++) {
    const line = new Array(cols + 1);
    for (let j = 0; j <= cols; j++) line[j] = base.length ? seedSteps(base, R, j, i) : R;
    base0.push(line);
  }
  const bad = [];                                             // cells of the base wall with no mould
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (!table.has(classKey(base0[i][j], base0[i][j + 1], base0[i + 1][j + 1], base0[i + 1][j]))) bad.push([i, j]);
  const reach = R - 1;                                        // vertices within this many modules of the point may change
  const v = (i, j, x, y) => Math.min(base0[i][j], Math.abs(j - x) + Math.abs(i - y));
  const out = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      if (base.some((s) => s[0] === x && s[1] === y)) continue;
      const i0 = Math.max(0, y - reach - 1), i1 = Math.min(rows - 1, y + reach), j0 = Math.max(0, x - reach - 1), j1 = Math.min(cols - 1, x + reach);
      const badIn = bad.filter(([i, j]) => i >= i0 && i <= i1 && j >= j0 && j <= j1).length;
      if (badIn !== bad.length) continue;                     // a base cell outside the point's reach has no mould and stays that way
      let ok = true;
      for (let i = i0; ok && i <= i1; i++) for (let j = j0; j <= j1; j++) {
        if (!table.has(classKey(v(i, j, x, y), v(i, j + 1, x, y), v(i + 1, j + 1, x, y), v(i + 1, j, x, y)))) { ok = false; break; }
      }
      if (ok) out.push([x, y]);
    }
  }
  return out;
}

// all size-n subsets of arr, in lexicographic index order (= itertools.combinations)
function* combinations(arr, n, from = 0, head = []) {
  if (head.length === n) { yield head; return; }
  for (let k = from; k <= arr.length - (n - head.length); k++) yield* combinations(arr, n, k + 1, [...head, arr[k]]);
}

// [comp, dropped]: after the wall was resized, the seeds that still lay (= composition.fit_seeds). `comp` holds the new cols / rows and the old seeds.
export function fitSeeds(comp, kit) {
  const { cols, rows } = comp;
  let seeds = comp.seeds.filter(([x, y]) => x >= -SEED_PAD && x <= cols + SEED_PAD && y >= -SEED_PAD && y <= rows + SEED_PAD);
  if (!seeds.length) {
    const [x, y] = comp.seeds[0];
    seeds = [[Math.min(Math.max(x, -SEED_PAD), cols + SEED_PAD), Math.min(Math.max(y, -SEED_PAD), rows + SEED_PAD)]];
  }
  for (let n = seeds.length; n >= 1; n--) {
    for (const subset of combinations(seeds, n)) {
      const cand = withSeeds(comp, subset);
      if (lays(cand, kit)) return [cand, comp.seeds.length - n];
    }
  }
  fail("no seed lays on this wall");
}

// ---------------------------------------------------------------------------- height composition
// Mould arrays are {px, w, h, data}: row-major Float32Array of mm (face 0, cuts negative), w x h px (px = w; a square
// mould may omit w/h). levelsToMm turns pixels of a baked two-channel PNG (RGBA from canvas getImageData, or RGB/RGBA
// bytes from any decoder; `channels` 3 or 4) into mm: level = R*256 + G, mm = (level - base_level) * mm_per_level.
export function levelsToMm(bytes, px, manifest, channels = 4, pxH = px) {
  const out = new Float32Array(px * pxH);
  for (let i = 0; i < out.length; i++) {
    const level = bytes[i * channels] * 256 + bytes[i * channels + 1];
    out[i] = (level - manifest.base_level) * manifest.mm_per_level;
  }
  return { px, w: px, h: pxH, data: out };
}

// np.rot90(m, k) (k counter-clockwise quarter turns) read per output cell: no copy of the mould is made.
function rot90Index(k, n, i, j) {
  switch (((k % 4) + 4) % 4) {
    case 0: return i * n + j;
    case 1: return j * n + (n - 1 - i);
    case 2: return (n - 1 - i) * n + (n - 1 - j);
    default: return (n - 1 - j) * n + i;
  }
}

// A half turn of a rectangular mould: both axes reversed.
const rot180Index = (mw, mh, i, j) => (mh - 1 - i) * mw + (mw - 1 - j);

// rows = expand() output [[mouldId, turn_k]...]; assembles the wall height (mm) like mkcommon.assemble (np.block of
// np.rot90 pieces). `cutRows` = cuts() output: each piece is turned first, then cropped in the wall frame (cut_left /
// cut_right mm -> px, rounded on the running edge so every row is exactly the wall width; cut_top / cut_bottom crop the
// piece's height the same way, a top cut keeping the piece's lower part). Without cuts, every row must hold the same
// number of whole pieces. Quarter turns need a square mould; a rectangular one takes 0 or 2.
export function composeHeight(rows, kit, moulds, cutRows = null) {
  if (!rows.length || !rows[0].length) fail("composeHeight: empty layout");
  if (!cutRows && rows.some((r) => r.length !== rows[0].length)) fail("composeHeight: staggered rows need their cuts");
  const known = new Set(kit.moulds.map((m) => m.id));
  const first = moulds[rows[0][0][0]] ?? fail(`composeHeight: mould ${rows[0][0][0]} not decoded`);
  const mw = first.w ?? first.px, mh = first.h ?? first.px;
  const pxPerMm = mw / kit.module_mm[0];
  const shownMm = (cut) => kit.module_mm[0] - cut[0] - cut[1];
  const rowMm = (r) => (cutRows ? cutRows[r].reduce((s, c) => s + shownMm(c), 0) : rows[r].length * kit.module_mm[0]);
  // a row's height in px: whole mould px unless a piece of the row is cut in height (then the cut piece's laid height, rounded)
  const cutH = (cut) => (cut[2] ?? 0) + (cut[3] ?? 0);
  const rowPx = (r) => {
    const c = cutRows ? cutRows[r].find((p) => cutH(p) > 0) : null;
    return c ? Math.round((kit.module_mm[1] - cutH(c)) * pxPerMm) : mh;
  };
  const w = Math.round(rowMm(0) * pxPerMm);
  const rowH = rows.map((_, r) => rowPx(r));
  const rowY = rowH.map((_, r) => rowH.slice(0, r).reduce((a, b) => a + b, 0));
  const h = rowH.reduce((a, b) => a + b, 0);
  const data = new Float32Array(w * h);
  rows.forEach((row, r) => {
    if (Math.abs(rowMm(r) - rowMm(0)) > 1e-6) fail(`composeHeight: row ${r} is ${rowMm(r)} mm, row 0 ${rowMm(0)} mm`);
    let xMm = 0;
    row.forEach(([id, k], c) => {
      if (!known.has(id)) fail(`composeHeight: mould ${id} is not in kit ${kit.kit} (missing corner class?)`);
      const m = moulds[id] ?? fail(`composeHeight: mould ${id} not decoded`);
      if ((m.w ?? m.px) !== mw || (m.h ?? m.px) !== mh) fail(`composeHeight: mould ${id} is ${m.w ?? m.px}x${m.h ?? m.px} px, expected ${mw}x${mh}`);
      if (k % 2 && mw !== mh) fail(`composeHeight: quarter turn of a ${mw}x${mh} px mould`);
      const cut = cutRows ? cutRows[r][c] : [0, 0, 0, 0];
      const x0 = Math.round(xMm * pxPerMm);
      xMm += shownMm(cut);
      const width = Math.round(xMm * pxPerMm) - x0;
      const s = cut[0] > 0 ? Math.min(Math.round(cut[0] * pxPerMm), mw - width) : 0;      // first visible source column
      const sy = (cut[2] ?? 0) > 0 ? Math.min(Math.round(cut[2] * pxPerMm), mh - rowH[r]) : 0;   // first visible source row
      for (let i = 0; i < rowH[r]; i++) {
        const dst = (rowY[r] + i) * w + x0;
        for (let j = 0; j < width; j++) {
          data[dst + j] = m.data[mw === mh ? rot90Index(k, mw, sy + i, s + j) : (k ? rot180Index(mw, mh, sy + i, s + j) : (sy + i) * mw + s + j)];
        }
      }
    });
  });
  return { w, h, data };
}
