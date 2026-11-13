// price.js -- the Catalog Composer's price maths. Pure, no DOM, no I/O; every number arrives in `pricing`
// (config.json). Area is counted in integer mm^2 and money in whole TL, so exact edges (5.000 m^2) are exact.
//   rate = pricing.sets[design] (per module set; no flat rate)
//   subtotal = round(m2 * rate)          whole TL, half rounds up
//   kdv      = round(subtotal * kdv_rate) whole TL, half rounds up
//   total    = subtotal + kdv (+ logistics when its price is set)
// MOQ is per design (pricing.moq_m2_per_design[design], DEC-14): a number only once Burak sets it; null = no minimum is stated and none is
// enforced on the page (the quote carries it). Lead time is per design too (pricing.lead_time_weeks[design]); null = not stated.
// Cut-to-fit: you buy whole modules, so the supply (cols x rows modules) is what is priced and counted against the MOQ; the
// wall the architect asked for (wall.wall_mm) is only reported beside it (wall_area_m2, cut_pieces). A staggered-course kit passes
// wall.supplied_modules (the plates its pieces are cut from), since its supply is not a cols x rows grid.
// Installation is not part of this price and is not modelled here.

const MM2_PER_M2 = 1_000_000;
const RATE_SCALE = 10_000;      // kdv_rate is read as basis points of a percent (0.20 -> 2000) to stay integer

// round(num / den) for non-negative integers, half up
const divRound = (num, den) => Math.floor((2 * num + den) / (2 * den));

export function pieceCounts(rows) {
  const counts = {};
  for (const row of rows) for (const [id] of row) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

export function wallAreaMm2(cols, rows, moduleMm) {
  return cols * rows * moduleMm[0] * moduleMm[1];
}

// pieces with any cut in a cuts() output ([left, right, top, bottom] per piece)
export const cutCount = (cutRows) => cutRows.flat().filter((c) => c.some((v) => v > 0)).length;

// The rate of one design (module set), TL per m2: pricing.sets[design], a number only when Burak has set it (#106).
// null / missing / non-numeric = unpriced: no money is computed and none is shown. There is no flat fallback rate.
export function rateFor(pricing, design) {
  const r = pricing.sets?.[design];
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : null;
}

// The minimum order of one design, m2: a positive number only when Burak has set it; null = not set (no MOQ shown, none enforced).
export function moqFor(pricing, design) {
  const m = pricing.moq_m2_per_design?.[design];
  return typeof m === "number" && Number.isFinite(m) && m > 0 ? m : null;
}

// The lead time of one design in weeks: a positive number only when Burak has set it; null = not stated (the quote carries it).
export function leadWeeksFor(pricing, design) {
  const w = pricing.lead_time_weeks?.[design];
  return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : null;
}

// wall = {cols, rows, module_mm: [w, h], pieces: {mouldId: n}, wall_mm?: [w, h], cut_pieces?: n, supplied_modules?: n}; speed = key of pricing.logistics; design = the set code (pricing.sets key)
export function quote(wall, pricing, speed = "pickup", design = null) {
  const modules = wall.supplied_modules ?? wall.cols * wall.rows;
  const moduleMm2 = wall.module_mm[0] * wall.module_mm[1];
  const areaMm2 = modules * moduleMm2;
  const moqM2 = moqFor(pricing, design);
  const moqMm2 = moqM2 === null ? 0 : Math.round(moqM2 * MM2_PER_M2);       // no MOQ set = nothing to fall short of
  const meetsMoq = areaMm2 >= moqMm2;
  const shortfallMm2 = meetsMoq ? 0 : moqMm2 - areaMm2;
  const rate = rateFor(pricing, design);
  const priced = rate !== null;
  const subtotalExLogistics = priced ? divRound(areaMm2 * rate, MM2_PER_M2) : null;
  const opt = pricing.logistics[speed];
  if (opt === undefined) throw new Error(`unknown logistics option ${speed}`);
  const logisticsTry = opt.price_try;                   // null = not set yet: given in the quote
  const subtotal = priced ? subtotalExLogistics + (logisticsTry ?? 0) : null;
  const kdv = priced ? divRound(subtotal * Math.round(pricing.kdv_rate * RATE_SCALE), RATE_SCALE) : null;
  const pieces = wall.pieces ?? {};
  const wallArea = wall.wall_mm ? wall.wall_mm[0] * wall.wall_mm[1] : areaMm2;
  return {
    area_mm2: areaMm2,
    area_m2: areaMm2 / MM2_PER_M2,                      // the supplied area: what is priced
    wall_area_m2: wallArea / MM2_PER_M2,                // the architect's wall (= area_m2 when no wall_mm)
    wall_cut: Boolean(wall.wall_mm),
    modules,
    cut_pieces: wall.cut_pieces ?? 0,
    moq_m2: moqM2,
    meets_moq: meetsMoq,
    orderable: meetsMoq,
    shortfall_m2: shortfallMm2 / MM2_PER_M2,
    shortfall_modules: meetsMoq ? 0 : Math.ceil(shortfallMm2 / moduleMm2),
    pieces,
    pieces_total: Object.values(pieces).reduce((a, b) => a + b, 0),
    priced,
    rate_try_m2: rate,
    material_try: subtotalExLogistics,
    logistics_try: logisticsTry,
    logistics_pending: logisticsTry === null,
    subtotal_try: subtotal,
    kdv_try: kdv,
    total_try: priced ? subtotal + kdv : null,
    lead_time_weeks: leadWeeksFor(pricing, design),
    lead_time_basis: pricing.lead_time_basis,
  };
}

// 12345 -> "12.345" (Turkish grouping) or "12,345" (en); whole TL only.
export function formatTry(n, locale) {
  const sep = locale === "tr" ? "." : ",";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}
