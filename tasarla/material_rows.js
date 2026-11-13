// material_rows.js -- the A-00 "Material and fixing" facts as rows, and the sample line. Pure, no DOM: used by material.js (the sheet),
// laying.js (the fixing digest under the A-03 antet) and app.js (the Numune row). Every fact that is not supplied yet is null in
// config.json (`material`, `sample`) and renders as the dash and nothing else: never a guess, never "coming soon". Both blocks are per
// design (Burak 2026-10-18), keyed by the design code: factsFor(config.material, "OPT"). A design with no entry has every fact open.
// Config shape: text facts null | "text" | {tr, en}; thickness_mm, weight_kg_m2, spares_pct numbers; sample.price_try whole TL, days a number.

export const ROW_ORDER = ["material", "format", "depth", "production", "surface", "thickness", "weight", "adhesive", "joint", "substrate", "cut", "cleaning", "spares", "sample"];

// A kit flagged `preview` (Hemiola: the face of a freestanding open screen, baked as a height field) says so wherever it is named.
export const previewOf = (s, kit) => (kit?.preview ? s.preview_label ?? null : null);

export const factsFor = (block, design) => (design && block?.[design] && typeof block[design] === "object" ? block[design] : {});

// The range's name for the header and the DM: config.line_name is a string or {tr, en}.
export const lineNameFor = (config, loc) => (config?.line_name && typeof config.line_name === "object" ? config.line_name[loc] ?? config.line_name.tr : config?.line_name);

// "Canvas · boyaya hazır": the finish as one phrase, from one locale's strings (the code's tag slot carries the finish id). An unknown id shows as it is.
export const finishLabelOf = (s, id) => (s[`finish_${id}`] ? (s.finish_label ?? "{name} · {kind}").replace("{name}", s[`finish_${id}`]).replace("{kind}", s[`finish_kind_${id}`] ?? "") : id);

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const num = (v, loc) => String(+Number(v).toFixed(2)).replace(".", loc === "tr" ? "," : ".");

// a text fact: null -> null (the dash); a plain string is taken as is; {tr, en} picks the locale (missing -> null, never the other language)
export function textFact(v, loc) {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : v[loc];
  return typeof s === "string" && s.trim() ? s.trim() : null;
}
const numFact = (v, loc, tpl) => (typeof v === "number" && Number.isFinite(v) ? fill(tpl, { v: num(v, loc) }) : null);

// strings = one locale's table. fmtTry(n) formats whole TL. client: the priced part of the sample line is left out.
export function sampleText(sample, s, loc, { fmtTry, client = false } = {}) {
  const parts = [];
  const contents = textFact(sample?.contents, loc);
  if (contents) parts.push(contents);
  if (!client && Number.isFinite(sample?.price_try)) parts.push(`${fmtTry(sample.price_try)} ${s.currency}`);
  if (Number.isFinite(sample?.days)) parts.push(fill(s.mat_days_value, { n: sample.days }));
  return parts.length ? parts.join(" · ") : null;
}

// the three fixing facts shown as a one-line digest (A-03): [{label, value|null}]
export function fixingDigest(config, s, loc, design) {
  const m = factsFor(config.material, design);
  return [
    { key: "thickness", label: s.mat_row_thickness, value: numFact(m.thickness_mm, loc, s.mat_mm_value) },
    { key: "adhesive", label: s.mat_row_adhesive, value: textFact(m.adhesive, loc) },
    { key: "joint", label: s.mat_row_joint, value: textFact(m.joint, loc) },
  ];
}

// kit = the kit descriptor (module_mm); depthMm = the realised depth of the moulds this composition uses (as A-01 shows it).
// Returns [{key, label, value|null}] in ROW_ORDER; a null value is shown as the dash.
export function materialRows({ config, design, s, loc, kit, depthMm, fmtTry, client = false }) {
  const m = factsFor(config.material, design);
  const values = {
    material: s.mat_material_value,
    format: fill(s.format, { w: kit.module_mm[0] / 10, h: kit.module_mm[1] / 10 }),
    depth: Number.isFinite(depthMm) ? fill(s.mat_depth_value, { mm: depthMm.toFixed(1).replace(".", loc === "tr" ? "," : ".") }) : null,
    production: s.mat_production_value,
    surface: textFact(m.surface, loc),
    thickness: numFact(m.thickness_mm, loc, s.mat_mm_value),
    weight: numFact(m.weight_kg_m2, loc, "{v}"),
    adhesive: textFact(m.adhesive, loc),
    joint: textFact(m.joint, loc),
    substrate: textFact(m.substrate, loc),
    cut: s.mat_cut_value,
    cleaning: textFact(m.cleaning, loc),
    spares: numFact(m.spares_pct, loc, s.mat_pct_value),
    sample: sampleText(factsFor(config.sample, design), s, loc, { fmtTry, client }),
  };
  return ROW_ORDER.map((key) => ({ key, label: s[`mat_row_${key}`], value: values[key] }));
}
