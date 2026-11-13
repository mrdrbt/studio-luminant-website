// room_math.js -- pure maths of the room view (node-testable): the unit-square -> plate-quad homography, the
// centred aspect crop (never a stretch) and the room.json shape check. No DOM here.

// 3x3 row-major H mapping the unit square (0,0) (1,0) (1,1) (0,1) onto quad [[x,y] x4] = TL, TR, BR, BL.
export function homography(quad) {
  const src = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function solve(A, b) {                         // Gauss-Jordan with partial pivoting, 8x8
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error("degenerate quad");
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-18) throw new Error("singular homography");
  const s = 1 / det;
  return [A * s, -(b * i - c * h) * s, (b * f - c * e) * s, B * s, (a * i - c * g) * s, -(a * f - c * d) * s,
          C * s, -(a * h - b * g) * s, (a * e - b * d) * s];
}

export function applyH(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

// Centred crop of a w x h grid to the aspect (w/h) of the quad: the long side is trimmed, nothing is scaled.
export function cropRect(w, h, aspect) {
  if (w / h > aspect) { const cw = Math.max(1, Math.round(h * aspect)); return { x0: Math.floor((w - cw) / 2), y0: 0, w: cw, h }; }
  const ch = Math.max(1, Math.round(w / aspect));
  return { x0: 0, y0: Math.floor((h - ch) / 2), w, h: ch };
}

export function cropWall(wall, aspect) {
  const r = cropRect(wall.w, wall.h, aspect);
  if (r.w === wall.w && r.h === wall.h) return wall;
  const data = new Float32Array(r.w * r.h);
  for (let i = 0; i < r.h; i++) data.set(wall.data.subarray((r.y0 + i) * wall.w + r.x0, (r.y0 + i) * wall.w + r.x0 + r.w), i * r.w);
  return { w: r.w, h: r.h, data };
}

// True-scale placement. The composition (compMm) sits INSIDE the wall plane (wallMm) at its real size, anchored centre-bottom;
// the plate shows around it. rect = the shown part as a fraction of the wall quad (x0, y0 from the top-left, w, h);
// crop = the same part in composition fractions (what to cut from the wall texture); cropped = the composition overflows.
// relief = {xe, ye, grid} (optional): the cell edges of the composition in mm (columns left to right, rows top to bottom, length n + 1) and grid[row][col] = how much
// relief that cell carries (0 = flat). When the composition overflows the wall, the shown window is slid to hold the most relief (the relief start: a corner or the
// seeds), ties going to the centre-bottom default. `part` says which part is shown: h = left | centre | right (null: the width is whole), v = top | middle | bottom.
export function placeWall(compMm, wallMm, relief = null) {
  const [cw, ch] = compMm, [ww, wh] = wallMm;
  const sw = Math.min(cw, ww), sh = Math.min(ch, wh);               // shown size, mm
  const rect = { x0: (ww - sw) / 2 / ww, y0: (wh - sh) / wh, w: sw / ww, h: sh / wh };
  let [ox, oy] = [(cw - sw) / 2, ch - sh];                          // centre-x, bottom-y
  if (relief && (cw > ww || ch > wh)) [ox, oy] = reliefWindow(relief, [cw, ch], [sw, sh]);
  const crop = { x0: ox / cw, y0: oy / ch, w: sw / cw, h: sh / ch };
  const third = (room, at) => (room < 1e-6 ? null : at < room / 3 ? 0 : at > room * 2 / 3 ? 2 : 1);
  const hh = third(cw - sw, ox), vv = third(ch - sh, oy);
  const part = { h: hh === null ? null : ["left", "centre", "right"][hh], v: vv === null ? null : ["top", "middle", "bottom"][vv] };
  return { rect, crop, cropped: cw > ww || ch > wh, shownMm: [sw, sh], compMm: [cw, ch], wallMm: [ww, wh], origin: [ox, oy], part };
}

// The window (ox, oy from the top-left, mm) of the given size that holds the most relief, by overlap area. Candidate offsets put a cell edge on a window edge, plus the
// two ends and the centre-bottom default, which wins every tie.
function reliefWindow({ xe, ye, grid }, [cw, ch], [sw, sh]) {
  const overlap = (e, o, win) => Array.from({ length: e.length - 1 }, (_, i) => Math.max(0, Math.min(e[i + 1], o + win) - Math.max(e[i], o)));
  const offsets = (e, room, win) => {
    const out = new Set([0, room - win, (room - win) / 2]);
    if (room - win > 1e-6) for (const v of e) for (const o of [v, v - win]) out.add(Math.min(room - win, Math.max(0, o)));
    return [...out];
  };
  const def = [(cw - sw) / 2, ch - sh];
  const oxs = offsets(xe, cw, sw), oys = offsets(ye, ch, sh);
  const ovy = oys.map((oy) => overlap(ye, oy, sh));
  let best = def, bestSum = -1, bestDist = Infinity;
  const consider = (ox, oy, s) => {
    const dist = Math.abs(ox - def[0]) + Math.abs(oy - def[1]);
    if (s > bestSum + 1e-6 || (s > bestSum - 1e-6 && dist < bestDist)) { best = [ox, oy]; bestSum = s; bestDist = dist; }
  };
  consider(def[0], def[1], oysSum(grid, overlap(xe, def[0], sw), overlap(ye, def[1], sh)));
  for (const ox of oxs) {
    const rowSum = grid.map((row, r) => { const ov = overlap(xe, ox, sw); let t = 0; for (let c = 0; c < row.length; c++) t += row[c] * ov[c]; return t; });
    oys.forEach((oy, j) => { let t = 0; for (let r = 0; r < rowSum.length; r++) t += rowSum[r] * ovy[j][r]; consider(ox, oy, t); });
  }
  return best;
}
const oysSum = (grid, ovx, ovy) => grid.reduce((t, row, r) => t + ovy[r] * row.reduce((a, w, c) => a + w * ovx[c], 0), 0);

// Cut the crop (composition fractions) out of the wall height grid. Whole-grid crop returns the same object.
export function cropToFraction(wall, crop) {
  if (crop.w === 1 && crop.h === 1) return wall;
  const x0 = Math.round(crop.x0 * wall.w), y0 = Math.round(crop.y0 * wall.h);
  const w = Math.max(1, Math.round(crop.w * wall.w)), h = Math.max(1, Math.round(crop.h * wall.h));
  const data = new Float32Array(w * h);
  for (let i = 0; i < h; i++) data.set(wall.data.subarray((y0 + i) * wall.w + x0, (y0 + i) * wall.w + x0 + w), i * w);
  return { w, h, data };
}

// Fixed stratified jitter over the unit square -> (-1, 1)^2: a Latin hypercube from the base-2 van der Corput sequence.
// x = (i + 0.5) / n; y = the rank of vdC(i) among the n values, so each axis has exactly one sample per stratum for ANY n.
// Deterministic, no RNG: the same n always gives the same light samples.
export function jitterPattern(n) {
  const vdc = (i) => { let r = 0, f = 0.5; for (let b = i; b > 0; b >>= 1, f /= 2) if (b & 1) r += f; return r; };
  const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => vdc(p) - vdc(q) || p - q);
  const rank = new Array(n);
  order.forEach((i, r) => { rank[i] = r; });
  return Array.from({ length: n }, (_, i) => [((i + 0.5) / n) * 2 - 1, ((rank[i] + 0.5) / n) * 2 - 1]);
}

// The rooms a design is shown in: those built for it (index entry `designs`), else every room not built for one design.
export function roomsFor(ridx, design) {
  const all = ridx?.rooms ?? [];
  const own = all.filter((r) => r.designs?.includes(design));
  return own.length ? own : all.filter((r) => !r.designs);
}

// room.json shape: returns a list of problems (empty = valid).
export function roomProblems(room) {
  const bad = [];
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  if (!room || typeof room !== "object") return ["not an object"];
  if (!Array.isArray(room.plate_px) || room.plate_px.length !== 2 || !room.plate_px.every(num)) bad.push("plate_px");
  if (!Array.isArray(room.quad_px) || room.quad_px.length !== 4 || !room.quad_px.every((p) => Array.isArray(p) && p.length === 2 && p.every(num))) bad.push("quad_px");
  if (!Array.isArray(room.wall_mm) || room.wall_mm.length !== 2 || !room.wall_mm.every((v) => num(v) && v > 0)) bad.push("wall_mm");
  const k = room.key_light;
  if (!k || !num(k.az_deg) || !num(k.el_deg) || k.el_deg <= 0 || k.el_deg >= 90) bad.push("key_light");
  const a = room.ambient;
  if (!a || !num(a.ambient_frac) || a.ambient_frac < 0 || a.ambient_frac > 1 || !num(a.exposure_gain)) bad.push("ambient");
  const e = room.key_extent_deg;
  if (!e || !num(e.az_half) || !num(e.el_half) || e.az_half < 0 || e.el_half < 0 || typeof e.why !== "string" || !e.why) bad.push("key_extent_deg");
  if (a && (typeof a.why !== "string" || !a.why || !a.method || typeof a.method !== "object")) bad.push("ambient.why/method");
  if (typeof room.plate !== "string") bad.push("plate");
  const pa = room.panel_albedo;
  if (!pa || !num(pa.linear) || pa.linear <= 0 || pa.linear >= 1 || typeof pa.why !== "string" || !pa.why) bad.push("panel_albedo");
  return bad;
}
