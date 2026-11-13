// material.js -- A-00 "Malzeme ve uygulama" / "Material and fixing": material.html?c=<code>&l=tr|en[&view=client]. The material facts of the line as
// ruled rows under the same title block (antet) as A-02 / A-03. Facts not supplied yet come from config.json `material` as null and show
// the dash and nothing else. Nothing on this sheet is priced; in the client view the sample line leaves its price out. No fire row, in any language.
import { decode, expand, wallMm } from "./lib/composer_layout.js?v=b748dc4d";
import { mountMaker, sheetHrefs, lightSuffix } from "./sheetbar.js?v=2ea9d3a8";
import { materialRows, finishLabelOf } from "./material_rows.js?v=0082c530";
import { formatTry } from "./price.js?v=59a918cf";

const fetchJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
const mk = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v); }
  n.append(...kids);
  return n;
};

async function main() {
  const root = document.getElementById("mat-sheet");
  const q = new URLSearchParams(location.search);
  const [config, strings, index] = await Promise.all([fetchJson("config.json"), fetchJson("strings.json"), fetchJson("kits/index.json")]);
  const l = q.get("l") ?? q.get("lang");
  const loc = l === "en" || l === "tr" ? l : config.default_locale;
  const s = strings.locales[loc];
  const client = q.get("view") === "client";
  const by = (q.get("by") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const kits = {}, mans = {};
  for (const k of index.kits) { const man = await fetchJson(`kits/${k.manifest}`); kits[man.design] = man.descriptor; mans[man.design] = man; }
  let err = null, comp;
  try { comp = decode(q.get("c") ?? config.default_code, kits); expand(comp, kits[comp.design]); }
  catch (e) { err = e.message; comp = decode(config.default_code, kits); }
  const kit = kits[comp.design], man = mans[comp.design];
  const code = q.get("c") && !err ? q.get("c").trim() : config.default_code;
  const depth = Math.max(...[...new Set(expand(comp, kit).flat().map(([id]) => id))].map((id) => man.moulds[id].relief_mm));      // the realised depth, as A-01 shows it
  const fmtM = (mm) => String(+(mm / 1000).toFixed(2)).replace(".", loc === "tr" ? "," : ".");
  const [W, H] = wallMm(comp, kit);

  document.documentElement.lang = loc;
  document.title = `A-00 ${s.sheet_a00}`;
  const h1 = mk("h1", {}, mk("b", {}, "A-00"), ` ${s.sheet_a00}`);
  const pb = mk("button", { type: "button" }, s.print_button);
  pb.addEventListener("click", () => window.print());
  const head = mk("header", { class: "lay-head" }, h1, mk("div", { class: "tools noprint" }, pb));

  const hrefs = sheetHrefs({ code, loc, view: client ? "client" : "architect", by, light: lightSuffix(location.search) });
  const setIds = client ? ["a00", "a01", "a02"] : ["a00", "a01", "a02", "a03"];
  const set = setIds.map((id) => mk("a", { href: hrefs[id], ...(id === "a00" ? { "aria-current": "page" } : {}) }, mk("b", {}, id.replace("a", "A-")), ` ${s[`sheet_${id}`]}`));
  const cell = (cls, label, dd) => mk("div", { class: `cell ${cls}`.trim() }, mk("dt", {}, label), dd);
  const cells = [];
  if (!client) cells.push(cell("span code", s.send_code_label, mk("dd", {}, mk("span", { class: "code-v" }, code))));
  else if (by) cells.push(cell("span", s.by_prefix, mk("dd", {}, by)));
  cells.push(
    cell("span", s.sec_design, mk("dd", {}, `${s[`design_${comp.design}`] ?? comp.design} · ${s.format.replace("{w}", kit.module_mm[0] / 10).replace("{h}", kit.module_mm[1] / 10)}`, ...(kit.preview ? [mk("small", { class: "preview-copy" }, s.preview_label)] : []))),
    cell("", s.sec_finish, mk("dd", {}, finishLabelOf(s, comp.colour))),
    cell("r", s.sec_size, mk("dd", {}, s.size_metres.replace("{w}", fmtM(W)).replace("{h}", fmtM(H)))),
    cell("span", client ? s.sheet_index_client : s.sheet_index, mk("dd", { class: "set" }, ...set)),
    cell("span maker", s.maker_label, mk("dd", {}, s.maker_value)));
  const antet = mk("div", { class: "antet" }, mk("dl", {}, ...cells));

  const rows = materialRows({ config, design: comp.design, s, loc, kit, depthMm: depth, fmtTry: (n) => formatTry(n, loc), client });
  const table = mk("table", { class: "spec", "aria-label": s.mat_aria_table }, mk("tbody", {}, ...rows.map((r) =>
    mk("tr", { "data-row": r.key }, mk("th", { scope: "row" }, r.label), mk("td", { class: r.value === null ? "open" : false }, r.value ?? s.mat_open)))));

  root.replaceChildren(head);
  if (err) root.append(mk("p", { class: "err", role: "alert" }, s.err_code));
  root.append(antet, table);
  mountMaker({ strings, loc });
  document.body.dataset.ready = "1";
}

if (typeof document !== "undefined" && document.getElementById("mat-sheet")) {
  main().catch((e) => { document.getElementById("mat-sheet").textContent = `Error: ${e.message}`; document.body.dataset.ready = "error"; console.error(e); });
}
