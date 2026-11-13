// room.js -- the room view: the composed wall (composer_layout.js heights -> light.js graze shading at the room's
// KEY light, in the wall's own frame) perspective-mapped into the plate's wall quad, at TRUE mm size (room_math.placeWall), centre-bottom. Plate = a Blender render of an
// empty room whose wall is a flat matte placeholder; the placeholder's own pixels carry the room's light falloff and
// bounce, so   out = plate * tint * (ambient_frac + (1 - ambient_frac) * lam / lam_ref).
// ?c=<code>&room=<id>   Self-contained: no CDN. Falls back to a 2D canvas (same homography, CPU) without WebGL2.
import * as L from "./lib/composer_layout.js?v=b748dc4d";
import { loadMoulds, composeWall, encodeTwoChannel, createLightView } from "./light.js?v=aa3008dc";
import { homography, invert3, applyH, placeWall, cropToFraction, roomProblems, jitterPattern, roomsFor } from "./room_math.js?v=12f7cf55";
import { mountSheetBar, mountDock, mountMaker, lightSuffix } from "./sheetbar.js?v=2ea9d3a8";
import { finishLabelOf } from "./material_rows.js?v=0082c530";

const $ = (s) => document.querySelector(s);
const fetchJson = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
const srgbToLin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

const VERT = `#version 300 es
const vec2 v[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
out vec2 vUV;
void main(){ vec2 p = v[gl_VertexID]; gl_Position = vec4(p, 0., 1.); vUV = (p + 1.) * .5; }`;
const FRAG = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uPlate, uLit;
uniform mat3 uInvH;            // plate px (top-left origin) -> wall unit square (u right, v down)
uniform vec2 uSize;            // plate px
uniform vec3 uTint;            // swatch_lin / panel albedo (room.json panel_albedo.linear)
uniform vec4 uRect;            // the composition inside the wall quad: x0, y0, w, h (fractions of the quad, top-left origin)
uniform float uLamRef, uAmb, uGain;
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toSrgb(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main(){
  vec2 p = vec2(vUV.x, 1. - vUV.y) * uSize;
  vec3 w = uInvH * vec3(p, 1.);
  vec2 uv = (w.xy / w.z - uRect.xy) / uRect.zw;     // composition unit square; outside it the plate shows through
  vec2 fw = max(fwidth(uv), vec2(1e-6));
  float a = clamp(min(min(uv.x, 1. - uv.x) / fw.x, min(uv.y, 1. - uv.y) / fw.y) + .5, 0., 1.);
  if (a <= 0.) { o = vec4(0.); return; }
  vec2 q = clamp(uv, 0., 1.);
  vec3 plate = toLin(texture(uPlate, vec2(vUV.x, 1. - vUV.y)).rgb);
  float lam = texture(uLit, q).r;
  vec3 c = plate * uTint * uGain * (uAmb + (1. - uAmb) * lam / uLamRef);
  o = vec4(toSrgb(c) * a, a);
}`;

function glProgram(gl) {
  const sh = (src, t) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(VERT, gl.VERTEX_SHADER)); gl.attachShader(p, sh(FRAG, gl.FRAGMENT_SHADER));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function tex(gl, unit, src, mip) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// WebGL2 composite. Returns true when drawn.
function drawGL(canvas, plateImg, litCanvas, P) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return false;
  const prog = glProgram(gl);
  gl.useProgram(prog);
  tex(gl, 0, plateImg, false);
  tex(gl, 1, litCanvas, true);
  gl.uniform1i(gl.getUniformLocation(prog, "uPlate"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uLit"), 1);
  const m = P.invH;     // row-major -> GLSL column-major
  gl.uniformMatrix3fv(gl.getUniformLocation(prog, "uInvH"), false, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  gl.uniform2f(gl.getUniformLocation(prog, "uSize"), canvas.width, canvas.height);
  gl.uniform3f(gl.getUniformLocation(prog, "uTint"), ...P.tint);
  gl.uniform4f(gl.getUniformLocation(prog, "uRect"), P.rect.x0, P.rect.y0, P.rect.w, P.rect.h);
  gl.uniform1f(gl.getUniformLocation(prog, "uLamRef"), P.lamRef);
  gl.uniform1f(gl.getUniformLocation(prog, "uAmb"), P.amb);
  gl.uniform1f(gl.getUniformLocation(prog, "uGain"), P.gain);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return true;
}

// 2D fallback: same homography on the CPU, nearest lit sample, no mipmaps (slower, harsher edges).
function drawCanvas2D(canvas, plateImg, litCanvas, P) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
  const pc = document.createElement("canvas"); pc.width = W; pc.height = H;
  const pctx = pc.getContext("2d"); pctx.drawImage(plateImg, 0, 0, W, H);
  const plate = pctx.getImageData(0, 0, W, H).data;
  const lw = litCanvas.width, lh = litCanvas.height;
  const lc = document.createElement("canvas"); lc.width = lw; lc.height = lh;
  const lctx = lc.getContext("2d"); lctx.drawImage(litCanvas, 0, 0);
  const lit = lctx.getImageData(0, 0, lw, lh).data;
  const out = ctx.createImageData(W, H);
  const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const toS = (v) => { v = Math.min(1, Math.max(0, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [qu, qv] = applyH(P.invH, x + 0.5, y + 0.5);
    const u = (qu - P.rect.x0) / P.rect.w, v = (qv - P.rect.y0) / P.rect.h;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const lx = Math.min(lw - 1, Math.floor(u * lw)), ly = Math.min(lh - 1, Math.floor(v * lh));
    const k = (y * W + x) * 4, f = P.gain * (P.amb + (1 - P.amb) * lit[(ly * lw + lx) * 4] / 255 / P.lamRef);
    for (let c = 0; c < 3; c++) out.data[k + c] = toS(toLin(plate[k + c]) * P.tint[c] * f);
    out.data[k + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return true;
}

// Extended key light: N graze passes over the stratified az/el box (room.key_extent_deg) around the key direction, averaged in float
// (soft penumbra from geometry, not blur). Passes run at canvasW (a downsample of the native wall texture); the mean is stored at
// S x (so the flat wall sits at 1/4 of the 8-bit range instead of ~1/10 at a graze angle) and the shader's lamRef carries the same S.
const PASSES = 12;
async function softLit(view, litCanvas, room, canvasW, n = PASSES) {
  const { az_deg: az0, el_deg: el0 } = room.key_light, ext = room.key_extent_deg;
  const dirs = jitterPattern(n).map(([u, v]) => [az0 + u * ext.az_half, Math.min(89, Math.max(0.5, el0 + v * ext.el_half))]);
  const lamRef = dirs.reduce((s, [, el]) => s + Math.sin(el * Math.PI / 180), 0) / n;          // mean flat-wall lam over the samples
  const scale = 0.25 / lamRef;
  let acc = null, w = 0, h = 0, ctx = null;
  for (const [azDeg, elDeg] of dirs) {
    view.draw({ azDeg, elDeg, directLit: true, ambient: 0, canvasW });
    if (!acc) { w = litCanvas.width; h = litCanvas.height; acc = new Float32Array(w * h); ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true }); ctx.canvas.width = w; ctx.canvas.height = h; }
    ctx.drawImage(litCanvas, 0, 0);
    const px = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < acc.length; i++) acc[i] += px[i * 4];
    await new Promise((res) => requestAnimationFrame(res));            // one pass per frame: the page stays responsive, no long GPU stall on a phone
  }
  const out = ctx.createImageData(w, h);
  for (let i = 0; i < acc.length; i++) {
    const v = Math.min(255, Math.round(acc[i] / n * scale));
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return { canvas: ctx.canvas, lamRef: lamRef * scale, passes: n, dirs, w, h };
}

// Where the composition carries relief, for the crop: the cell edges of the real wall (cut edge pieces are narrower) and the realised depth of the mould in each
// cell. A wall larger than the room's panel shows the window with the most relief in it (room_math.placeWall).
function reliefGrid(rows, cutRows, [mw, mh], depthOf) {
  const edges = (sizes) => sizes.reduce((e, s) => [...e, e[e.length - 1] + s], [0]);
  return { xe: edges(cutRows[0].map((p) => mw - p[0] - p[1])), ye: edges(cutRows.map((row) => mh - row[0][2] - row[0][3])), grid: rows.map((row) => row.map(([id]) => depthOf(id))) };
}

// ---------------------------------------------------------------------------- presentation: sheet A-02
// Titles and labels for the antet; the sheet index and the room caption come from strings.json / rooms/index.json (reviewed copy).
const SHEET = {
  tr: { title: "Oda", pick: "Örnek odalar", code: "Duvar kodu", design: "Tasarım", colour: "Finish", size: "Duvar ölçüsü",
        set: "Paftalar", a01: "Görünüş", a02: "Oda", a03: "Döşeme haritası", by: "Hazırlayan",
        alt: "{room} odasında duvar: {design}, {w} × {h} m, {cols} × {rows} modül, {finish}; odanın anahtar ışığıyla aydınlatılmış.",
        crop: "Duvar odadan büyük: duvarın {part} kısmı, {sw} × {sh} m gösteriliyor (toplam {cw} × {ch} m).",
        parts: { left: "sol", centre: "orta", right: "sağ", top: "üst", middle: "orta", bottom: "alt" },
        cue_w: "Ölçü çizgileri: duvar genişliği {w} m", cue_c: "tezgâh yüksekliği {c} m", cue_f: "ölçek için {f} m boyunda ayakta duran figür" },
  en: { title: "Room", pick: "Example rooms", code: "Wall code", design: "Design", colour: "Finish", size: "Wall size",
        set: "Sheets", a01: "Elevation", a02: "Room", a03: "Laying map", by: "Prepared by",
        alt: "Wall in the {room} room: {design}, {w} × {h} m, {cols} × {rows} modules, {finish}; lit by the room's key light.",
        crop: "The wall is larger than this room's: showing the {part} {sw} × {sh} m of {cw} × {ch} m.",
        parts: { left: "left", centre: "centre", right: "right", top: "top", middle: "middle", bottom: "bottom" },
        cue_w: "Dimension strings: wall width {w} m", cue_c: "counter height {c} m", cue_f: "a standing figure {f} m tall for scale" },
};


// ---------------------------------------------------------------------------- A-02 as a drawing: scale cues over the plate
// room.json scale_cues are plate-pixel points (camera-projected). The overlay is drawn in CSS px from them, so the line stays at weight 1 and the
// tags stay at 12 px while the plate scales; each stroke gets a sheet-colour keyline under the ink so it reads on a dark plate.
const fmtM = (mm, loc) => String(+(mm / 1000).toFixed(2)).replace(".", loc === "tr" ? "," : ".");
const TICK = 5;                                    // half-length of the 45 degree terminator, px
const tick = (x, y) => `M${x - TICK} ${y + TICK}L${x + TICK} ${y - TICK}`;

// Convex polygons overlap (separating axis). Used to see whether the 1.8 m figure stands over the composition.
function polysOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], nx = y1 - y2, ny = x2 - x1;
      const pr = (q) => q.map(([x, y]) => x * nx + y * ny);
      const pa = pr(a), pb = pr(b);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
  }
  return true;
}

export function cueShapes(room, place, sc, loc) {
  const cues = room.scale_cues, paths = [], tags = [];
  let figStart = -1, figOverlap = false;
  if (!cues) return { paths, tags, figStart, figOverlap };
  const P = ([x, y]) => [x * sc, y * sc], lerp = (a, b, t) => a + (b - a) * t;
  const ww = cues.wall_width;
  if (ww) {                                        // the COMPOSED wall's width, at true scale inside wall_mm
    const [ax, ay] = P(ww.a_px), [bx, by] = P(ww.b_px), t0 = place.rect.x0, t1 = place.rect.x0 + place.rect.w;
    const x0 = lerp(ax, bx, t0), x1 = lerp(ax, bx, t1), y0 = lerp(ay, by, t0), y1 = lerp(ay, by, t1);
    const q = room.quad_px, qy = (t) => lerp(q[3][1], q[2][1], t) * sc;
    paths.push(`M${x0} ${y0}L${x1} ${y1}`, tick(x0, y0), tick(x1, y1), `M${x0} ${qy(t0)}L${x0} ${y0 + 6}`, `M${x1} ${qy(t1)}L${x1} ${y1 + 6}`);
    tags.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, text: `${fmtM(place.shownMm[0], loc)} m`, at: "c" });
  }
  const ch = cues.counter_height;
  if (ch) {
    const [fx, fy] = P(ch.floor_px), [tx, ty] = P(ch.top_px);
    paths.push(`M${fx} ${fy}L${tx} ${ty}`, tick(fx, fy), tick(tx, ty));
    tags.push({ x: (fx + tx) / 2, y: (fy + ty) / 2, text: `${fmtM(ch.mm, loc)} m`, at: "c" });
  }
  const fg = cues.figure;
  if (fg) {                                        // 1.8 m figure: outline only, from the floor point to the head point
    const [cx, fy] = P(fg.floor_px), [, hy] = P(fg.head_px), H = fy - hy, r = 0.07 * H, u = (k) => k * H;
    figStart = paths.length;
    const Hm = homography(room.quad_px), rc = place.rect;      // the composition's corners in the plate, scaled like the figure
    const comp = [[rc.x0, rc.y0], [rc.x0 + rc.w, rc.y0], [rc.x0 + rc.w, rc.y0 + rc.h], [rc.x0, rc.y0 + rc.h]].map(([a, b]) => applyH(Hm, a, b).map((v) => v * sc));
    figOverlap = polysOverlap(comp, [[cx - u(0.13), hy - r], [cx + u(0.13), hy - r], [cx + u(0.13), fy], [cx - u(0.13), fy]]);
    const y = (k) => fy - u(k);
    paths.push(`M${cx - r} ${y(0.93)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`,
      `M${cx - u(0.11)} ${y(0.82)}L${cx + u(0.11)} ${y(0.82)}L${cx + u(0.08)} ${y(0.5)}L${cx + u(0.07)} ${y(0)}L${cx + u(0.01)} ${y(0)}L${cx} ${y(0.42)}L${cx - u(0.01)} ${y(0)}L${cx - u(0.07)} ${y(0)}L${cx - u(0.08)} ${y(0.5)}Z`,
      `M${cx - u(0.11)} ${y(0.8)}L${cx - u(0.125)} ${y(0.46)}`, `M${cx + u(0.11)} ${y(0.8)}L${cx + u(0.125)} ${y(0.46)}`);
    tags.push({ x: cx - u(0.12), y: y(0.93), text: `${fmtM(fg.mm, loc)} m`, at: "r" });
  }
  return { paths, tags, figStart, figOverlap };
}

function renderCues({ stage, room, place, loc }) {
  const svg = $("#cues"), box = $("#cue-tags");
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!svg || !W || !H) return;
  const { paths, tags, figStart, figOverlap } = cueShapes(room, place, W / room.plate_px[0], loc);
  const NS = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.replaceChildren(...["case", "ink"].map((cls) => {
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", `cue-${cls}`);
    paths.forEach((d, i) => { const e = document.createElementNS(NS, "path"); e.setAttribute("d", d); if (figOverlap && i >= figStart) e.setAttribute("class", "fade"); g.append(e); });
    return g;
  }));
  box.replaceChildren(...tags.map((tg) => {
    const n = document.createElement("span");
    n.className = `cue-tag ${tg.at}`; n.textContent = tg.text;
    n.style.left = `${tg.x}px`; n.style.top = `${tg.y}px`;
    return n;
  }));
}

function cueLabel(room, place, loc, t) {
  const c = room.scale_cues;
  if (!c) return "";
  const parts = [t.cue_w.replace("{w}", fmtM(place.shownMm[0], loc))];
  if (c.counter_height) parts.push(t.cue_c.replace("{c}", fmtM(c.counter_height.mm, loc)));
  if (c.figure) parts.push(t.cue_f.replace("{f}", fmtM(c.figure.mm, loc)));
  return `${parts.join("; ")}.`;
}

// "sol üst" / "top left": which part of the wall the room shows. Only the cropped axes speak (a whole width says nothing about left or right).
function cropPart({ h, v }, w, loc) {
  const H = h && w[h], V = v && w[v];
  if (H && V) {
    if (h === "centre" && v === "middle") return w.centre;
    if (h === "centre") return `${V} ${w.centre}`;
    if (v === "middle") return loc === "tr" ? `${H} ${w.middle}` : `${w.middle} ${H}`;
    return loc === "tr" ? `${H} ${V}` : `${V} ${H}`;
  }
  return H || V || "";
}

function dressSheet({ room, config, strings, comp, kit, code, loc, ridx, roomId, view, place, onLang, by }) {
  const t = SHEET[loc];
  const s = strings?.locales?.[loc] ?? {};
  const client = view === "client";
  const mk = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); Object.assign(n, attrs); n.append(...kids); return n; };
  const lq = lightSuffix(location.search);                                        // the wall's city and facing ride on every sheet link
  const v = `${client ? `&view=client${by ? `&by=${encodeURIComponent(by)}` : ""}` : ""}${lq}`;
  document.documentElement.lang = loc;
  document.title = `A-02 ${t.title}`;
  mountSheetBar($("#sheetbar"), { current: "a02", config, strings, code, loc, view, roomId, onLang, by, light: lq });
  mountDock({ comp: { code, cols: comp.cols, rows: comp.rows, module_mm: kit.module_mm, wall_mm: L.wallMm(comp, kit), supplied_modules: L.suppliedModules(comp, kit), line: comp.line, design: comp.design }, config, strings, loc, view, light: lq });
  mountMaker({ strings, loc });
  $("#r-maker-l").textContent = s.maker_label ?? "";
  $("#r-maker").textContent = s.maker_value ?? "";
  $("#r-title").textContent = t.title;
  $("#r-pick-h").textContent = t.pick;
  $("#rooms").setAttribute("aria-label", t.pick);
  $("#r-cap").textContent = ridx.caption?.[loc] ?? "";
  for (const k of ["design", "colour", "size", "set"]) $(`#r-${k}-l`).textContent = t[k];
  const codeCell = $("#r-code-cell");              // the client sees no code (it stays in the URL); a "Prepared by" name takes its place
  if (client) {
    if (by) { $("#r-code-l").textContent = t.by; $("#r-code").textContent = by; $("#r-code").classList.remove("code-v"); codeCell.classList.remove("code"); }
    else codeCell?.remove();
  } else { $("#r-code-l").textContent = t.code; $("#r-code").textContent = code; }
  $("#r-design").textContent = `${s[`design_${comp.design}`] ?? comp.design} · ${kit.module_mm[0] / 10} × ${kit.module_mm[1] / 10} cm${kit.preview && s.preview_label ? ` — ${s.preview_label}` : ""}`;
  $("#r-colour").textContent = finishLabelOf(s, comp.colour);
  const m = (n) => String(+(n / 1000).toFixed(2)).replace(".", loc === "tr" ? "," : ".");
  const [wallW, wallH] = L.wallMm(comp, kit);                                  // the architect's real wall, not the whole modules it is cut from
  $("#r-size").textContent = `${m(wallW)} × ${m(wallH)} m`;
  const roomLabel = ridx.rooms.find((r) => r.id === roomId)?.label?.[loc] ?? roomId;     // the canvas text alternative: the composition, in words
  const vars = { room: roomLabel, design: s[`design_${comp.design}`] ?? comp.design, w: m(wallW), h: m(wallH),
    cols: comp.cols, rows: comp.rows, finish: finishLabelOf(s, comp.colour),
    size: (L.coursesKit(kit) ? s.size_courses.replace("{rows}", comp.rows).replace("{n}", L.suppliedModules(comp, kit)) : s.size_modules.replace("{cols}", comp.cols).replace("{rows}", comp.rows)) };
  $("#wall").setAttribute("aria-label", `${(s.alt_room ?? t.alt).replace(/\{(\w+)\}/g, (x, k) => (k in vars ? vars[k] : x))} ${cueLabel(room, place, loc, t)}`.trim());
  const dn = $("#r-note");                                                      // the sheet's drawing note (room.json note, reviewed wording)
  dn.textContent = room.note?.[loc] ?? "";
  dn.hidden = !dn.textContent;
  renderCues({ stage: $("#stage"), room, place, loc });
  const note = $("#r-crop");
  note.hidden = !place.cropped;
  note.textContent = place.cropped ? (s.room_crop_note ?? t.crop).replace("{part}", cropPart(place.part, t.parts, loc)).replace("{sw}", m(place.shownMm[0])).replace("{sh}", m(place.shownMm[1]))
    .replace("{cw}", m(place.compMm[0])).replace("{ch}", m(place.compMm[1])) : "";
  const c = encodeURIComponent(code);
  const lbl = (k, d) => s[`sheet_${k}`] ?? d;
  const set = [mk("a", { href: `material.html?c=${c}&l=${loc}${v}` }, mk("b", {}, "A-00"), ` ${lbl("a00", loc === "tr" ? "Malzeme ve uygulama" : "Material and fixing")}`),
    mk("a", { href: `index.html?c=${c}&l=${loc}${v}` }, mk("b", {}, "A-01"), ` ${lbl("a01", t.a01)}`),
    mk("a", { href: `?c=${c}&room=${roomId}&l=${loc}${v}`, ariaCurrent: "page" }, mk("b", {}, "A-02"), ` ${lbl("a02", t.a02)}`)];
  if (!client) set.push(mk("a", { href: `laying.html?c=${c}&l=${loc}${lq}` }, mk("b", {}, "A-03"), ` ${lbl("a03", t.a03)}`));
  $("#r-set").replaceChildren(...set);
  $("#rooms").replaceChildren(...ridx.rooms.map((r, i) => {
    const a = mk("a", { href: `?c=${c}&room=${r.id}&l=${loc}${v}` }, mk("b", {}, `A-02.${i + 1}`), mk("span", {}, r.label[loc]));
    if (r.id === roomId) a.setAttribute("aria-current", "true");
    return a;
  }));
}

async function main() {
  const q = new URLSearchParams(location.search);
  const err = (m) => { const e = $("#err"); e.textContent = m; e.hidden = false; };
  try {
    const [config, kidx, ridxAll] = await Promise.all([fetchJson("config.json"), fetchJson("kits/index.json"), fetchJson("rooms/index.json")]);
    const kits = {}, mans = {};
    await Promise.all(kidx.kits.map(async (k) => {
      const m = await fetchJson(`kits/${k.manifest}`);
      kits[m.design] = m.descriptor;
      mans[m.design] = { m, dir: `kits/${k.manifest.split("/")[0]}` };
    }));
    const view = q.get("view") === "client" ? "client" : "architect";
    const code = q.get("c") || config.default_code;
    let comp;
    try { comp = L.decode(code, kits); } catch (e) { err(e.message); comp = L.decode(config.default_code, kits); }
    const ridx = { ...ridxAll, rooms: roomsFor(ridxAll, comp.design) };            // a design's own rooms (093: its 3.6 x 2.4 m wall)
    const roomId = ridx.rooms.some((r) => r.id === q.get("room")) ? q.get("room") : ridx.rooms[0].id;
    const room = await fetchJson(`rooms/${roomId}/room.json`);
    const bad = roomProblems(room);
    if (bad.length) throw new Error(`room.json: ${bad.join(", ")}`);
    const kit = kits[comp.design], { m: man, dir } = mans[comp.design];
    const rows = L.expand(comp, kit, true);
    const need = [...new Set(rows.flat().map(([id]) => id))];
    const moulds = await loadMoulds(dir, man, need);
    const cutRows = L.cuts(comp, kit);                                           // the real wall is cropped from the whole modules
    const { wall, pxPerMm } = composeWall(rows, kit, moulds, comp.cols, comp.rows, cutRows);
    // true scale: the composition keeps its real mm inside room.wall_mm, centre-bottom; larger than the wall -> cropped (and said so)
    // staggered courses share no column edges, and every plate carries relief: an oversized wall keeps the default window
    const place = placeWall(L.wallMm(comp, kit), room.wall_mm, L.coursesKit(kit) ? null : reliefGrid(rows, cutRows, kit.module_mm, (id) => man.moulds[id]?.relief_mm ?? 0));
    const cropped = cropToFraction(wall, place.crop);
    const lit = document.createElement("canvas");
    const view3d = createLightView(lit, window.SunStudioGrazeShader);
    if (!view3d) throw new Error("WebGL2 is needed to shade the wall");
    view3d.setWall(encodeTwoChannel(cropped), pxPerMm);
    const phone = window.innerWidth <= 480;                                       // phones: passes at <= 800 px (a 375 css px wall quad is ~280 css px)
    const quadW = (room.quad_px[1][0] - room.quad_px[0][0]) * place.rect.w;
    const canvasW = Math.min(cropped.w, phone ? 800 : Infinity, Math.max(256, Math.round(+(q.get("lw") || quadW))));   // one lit px per plate px of the shown wall, never above native
    const t0 = performance.now();
    const soft = await softLit(view3d, lit, room, canvasW, Math.max(1, Math.round(+(q.get("n") || PASSES))));
    const shadeMs = performance.now() - t0;
    const plate = new Image();                                                    // created here (no empty <img> in the markup)
    plate.id = "plate"; plate.alt = "";
    plate.src = `rooms/${roomId}/${room.plate}`;
    $("#stage").prepend(plate);
    await plate.decode();
    const canvas = $("#wall");
    [canvas.width, canvas.height] = room.plate_px;
    const swatch = (config.finishes.find((c) => c.id === comp.colour) ?? config.finishes[0]).swatch;
    const tint = srgbToLin(swatch).map((v) => v / room.panel_albedo.linear);      // swatch_linear / the panel's Blender albedo
    const P = {
      invH: invert3(homography(room.quad_px)), tint, lamRef: soft.lamRef, rect: place.rect,
      amb: room.ambient.ambient_frac, gain: room.ambient.exposure_gain,
    };
    const ok = drawGL(canvas, plate, soft.canvas, P) || drawCanvas2D(canvas, plate, soft.canvas, P);
    let loc = (q.get("l") || config.default_locale) === "en" ? "en" : "tr";
    const strings = await fetchJson("strings.json").catch(() => null);
    const by = view === "client" ? (q.get("by") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
    const dress = () => dressSheet({ room, config, strings, comp, kit, code: L.encode(comp, kits), loc, ridx, roomId, view, place, by,
      onLang: (l) => { loc = l; const u = new URL(location.href); u.searchParams.set("l", l); history.replaceState(null, "", u); dress(); } });
    dress();
    new ResizeObserver(() => renderCues({ stage: $("#stage"), room, place, loc })).observe($("#stage"));
    const frame = () => { const g = canvas.getContext("webgl2"); const t1 = performance.now(); if (g) { drawGL(canvas, plate, soft.canvas, P); g.finish(); } return performance.now() - t1; };
    window.roomTest = { frame, ready: () => ok, room: () => room, comp: () => comp, cropped: () => ({ w: cropped.w, h: cropped.h }), place: () => place,
      tint: () => tint, path: ok ? "webgl2" : "canvas2d", shade: () => ({ ms: shadeMs, passes: soft.passes, litPx: [soft.w, soft.h], nativePx: [cropped.w, cropped.h], dirs: soft.dirs }) };
    document.body.dataset.ready = "1";
  } catch (e) {
    err(e.message);
    document.body.dataset.ready = "error";
  }
}
main();
