// sheetbar.js -- the one header of the drawing set on the room (A-02) and laying (A-03) pages: the bar (wordmark + TR/EN) and
// the sheet index A-00 / A-01 / A-02 / A-03 with aria-current. index.html carries the same markup statically (its index switches panes).
// One locale parameter everywhere: l=.  The client view (view=client) is A-00 + A-01 + A-02 only.
// Page use:  <div id="sheetbar" data-sheet="a03"></div> + <script type="module" src="sheetbar.js">  (auto-mounts);
// room.js calls mountSheetBar() itself with its own onLang so a language switch does not reload the shaded wall.
import { roomsFor } from "./room_math.js?v=12f7cf55";
import { quote, formatTry } from "./price.js?v=59a918cf";
import { lineNameFor } from "./material_rows.js?v=0082c530";

const FALLBACK = {
  tr: { a00: "Malzeme ve uygulama", a01: "Görünüş", a02: "Oda", a03: "Döşeme haritası", index: "Paftalar", lang: "Dil" },
  en: { a00: "Material and fixing", a01: "Elevation", a02: "Room", a03: "Laying map", index: "Sheets", lang: "Language" },
};

function mk(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v); }
  n.append(...kids);
  return n;
}

// The wall's light (?city= & ?f=, the pair lightFromSearch reads on A-01) rides on every sheet link when the page was opened with it,
// so going A-02 -> A-01 keeps the city and facing the architect chose. Returns "" when neither is present.
export function lightSuffix(search) {
  const p = new URLSearchParams(search ?? "");
  const city = p.get("city"), f = p.get("f");
  return `${city ? `&city=${encodeURIComponent(city)}` : ""}${f !== null && f !== "" ? `&f=${encodeURIComponent(f)}` : ""}`;
}

export function sheetHrefs({ code, loc, view, roomId, by, light = "" }) {
  const c = code ? `c=${encodeURIComponent(code)}&` : "";
  const v = view === "client" ? `&view=client${by ? `&by=${encodeURIComponent(by)}` : ""}` : "";
  return {
    a00: `material.html?${c}l=${loc}${v}${light}`,
    a01: `index.html?${c}l=${loc}${v}${light}`,
    a02: `room.html?${c}${roomId ? `room=${encodeURIComponent(roomId)}&` : ""}l=${loc}${v}${light}`,
    a03: `laying.html?${c}l=${loc}${light}`,
  };
}

export function mountSheetBar(host, { current, config, strings, code, loc, view, roomId, onLang, by, light = "" }) {
  const s = strings?.locales?.[loc] ?? {};
  const t = (k) => s[`sheet_${k}`] ?? FALLBACK[loc][k];
  const hrefs = sheetHrefs({ code, loc, view, roomId, by, light });
  const lang = mk("div", { class: "lang", role: "group", "aria-label": s.lang_group ?? FALLBACK[loc].lang }, ...["tr", "en"].map((l) => {
    const b = mk("button", { type: "button", lang: l, "aria-pressed": String(l === loc) }, l.toUpperCase());
    b.addEventListener("click", () => {
      if (l === loc) return;
      if (onLang) { onLang(l); return; }
      const u = new URL(location.href);
      u.searchParams.set("l", l);
      u.searchParams.delete("lang");
      location.assign(u);
    });
    return b;
  }));
  const bar = mk("header", { class: "bar" }, mk("span", { class: "mark" }, lineNameFor(config, loc) ?? "[LINE]"), lang);
  const ids = view === "client" ? ["a00", "a01", "a02"] : ["a00", "a01", "a02", "a03"];
  const nav = mk("div", { class: "sheetbar-nav" }, mk("nav", { class: "sheets-nav", "aria-label": s.sheet_index ?? FALLBACK[loc].index },
    ...ids.map((id) => mk("a", { href: hrefs[id], "aria-current": String(id === current) },
      mk("b", {}, id.replace("a", "A-")), mk("span", {}, t(id)))), mk("span", { class: "fill" })));
  nav.addEventListener("focusin", (e) => e.target.scrollIntoView?.({ inline: "nearest", block: "nearest" }));     // four sheets can overflow a phone: bring a half-cut focus fully in
  host.replaceChildren(bar, nav);
}

// ---- the dock on A-02 / A-03: total + "Gönder" (links to A-01's send block), or the MOQ shortfall + "Ölçüyü büyüt". Same classes as A-01's dock.
// comp = {code, cols, rows, module_mm, wall_mm?, supplied_modules?, line}: wall_mm is the real wall (the size line shows it); the price counts the supply (supplied_modules, else cols x rows). The client view gets none.
// ---- the maker's mark under every sheet (Burak 2026-10-17): the line keeps its own brand in the header; the maker is named here.
export function mountMaker({ strings, loc }) {
  const s = strings?.locales?.[loc] ?? {};
  document.querySelector("footer.maker-foot")?.remove();
  const f = mk("footer", { class: "maker-foot" }, mk("span", {}, `${s.maker_label ?? ""}: `), mk("b", {}, s.maker_value ?? ""));
  document.body.append(f);
  return f;
}

export function mountDock({ comp, config, strings, loc, view, light = "" }) {
  document.getElementById("dock")?.remove();
  if (view === "client") return;
  const s = strings?.locales?.[loc] ?? {};
  const T = (k, v = {}) => (s[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m));
  const q = quote({ cols: comp.cols, rows: comp.rows, module_mm: comp.module_mm, wall_mm: comp.wall_mm, supplied_modules: comp.supplied_modules }, config.pricing, "pickup", comp.design);
  const fmt = (n) => String(+n.toFixed(2)).replace(".", loc === "tr" ? "," : ".");
  const href = `index.html?c=${encodeURIComponent(comp.code)}&l=${loc}${light}`;
  const m2 = fmt(q.area_m2);
  const dock = mk("div", { class: "dock dock-page", id: "dock" });
  if (q.meets_moq) {
    dock.append(mk("div", { class: "dock-sum" }, mk("b", {}, q.priced ? `${formatTry(q.total_try, loc)} ${T("currency")}` : T("dock_area", { m2 })),
      mk("span", {}, q.priced ? T(q.wall_cut ? "dock_vat_cut" : "dock_vat", { m2 }) : q.lead_time_weeks === null ? T("speed_price_quote") : T("dock_open", { weeks: q.lead_time_weeks }))),
      mk("a", { class: "act", href: `${href}#quote` }, T("quote_cta")));
  } else {
    dock.append(mk("div", { class: "dock-sum short" }, mk("b", {}, T("dock_short", { moq: fmt(q.moq_m2), m2: fmt(q.shortfall_m2) })),
      mk("span", {}, `${fmt((comp.wall_mm?.[0] ?? comp.cols * comp.module_mm[0]) / 1000)} × ${fmt((comp.wall_mm?.[1] ?? comp.rows * comp.module_mm[1]) / 1000)} m`)),
      mk("a", { class: "act ghost", href }, T("dock_size_page")));
  }
  document.body.append(dock);
}

async function autoMount() {
  const host = document.getElementById("sheetbar");
  const q = new URLSearchParams(location.search);
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [config, strings, rooms] = await Promise.all([get("config.json"), get("strings.json"), get("rooms/index.json")]);
  const l = q.get("l") ?? q.get("lang");                          // lang= is read only until laying.js moves to l=
  const loc = l === "en" || l === "tr" ? l : (config?.default_locale ?? "tr");
  mountSheetBar(host, { current: host.dataset.sheet, config, strings, code: q.get("c"), loc, view: q.get("view") === "client" ? "client" : "architect",
    roomId: roomsFor(rooms, (q.get("c") ?? "").split("-")[0].trim().toUpperCase())[0]?.id, by: q.get("by") ?? "", light: lightSuffix(location.search) });
}

if (typeof document !== "undefined" && document.getElementById("sheetbar")?.dataset.sheet) autoMount();
