// light.js -- the light view: Sun Studio's honest graze shader (lib/graze_shader.js) fed with the COMPOSED
// wall. The shader is not edited; the colour tint is a CSS multiply over the canvas (an albedo multiply),
// so what the canvas holds is exactly what graze.py would draw. Mirrors sun_studio.html: two-channel texture
// (R = high byte, G = low byte), no colour conversion, NEAREST + texelFetch, v = R*256+G over uReliefMM.
import { levelsToMm, composeHeight } from "./lib/composer_layout.js?v=b748dc4d";

export const AMBIENT = 0.35;            // sun_studio.html AMBIENT = graze.py shadow_floor
export const MAX_STEPS_GLSL = 600;      // the shader's MAX_STEPS
export const MAX_TEX_SIDE = 4096;
export const MAX_TEX_PIXELS = 4_200_000;
export const FINE_SCALE_MAX = 4;

// ---- physical light model (used only once setTint() has been called; the untinted path is unchanged) ----
// Units: sun irradiance on a face square-on to the sun = 1. Everything else is relative to that.
export const SUN_E = 1.0;
// why: clear-sky diffuse is about 0.15-0.25 of direct-normal irradiance; a vertical wall also takes ground-bounce
// light, so the sky term on a flat face is taken at the middle of that band.
export const SKY_OVER_SUN = 0.20;
// why: after dusk some skyglow/streetlight remains and the eye (or a camera) adapts; this is the sky term at night
// as a fraction of the daytime sky, chosen so the relief still reads faintly. An authoring value, not a photometric one.
export const NIGHT_SKY = 0.25;
// why: sky brightness falls through civil twilight (sun -6 deg) and is full by about 12 deg of sun elevation.
export const TWILIGHT_FROM_DEG = -6, TWILIGHT_FULL_DEG = 12;
// why: the camera's exposure follows the total light, but only down to this floor (about 1.3 stops below a lit wall),
// so a north wall or a night wall reads dimmer than a wall in sun instead of being auto-exposed back to the swatch.
export const EXPOSURE_FLOOR_E = 0.40;
// why: exposure maps a flat face square-on to the total light onto the albedo; this EV offset (+1/4 stop) makes up for the 0.64 cosine of the real wall-local sun at noon, so Bone in sun reads within a few % of the swatch.
export const EXPOSURE_EV = 0.25;
// why: the filmic shoulder is the identity below the knee (so the flat field keeps the swatch) and eases to
// KNEE + HEADROOM, so a facet lit harder than the reference does not clip.
export const SHOULDER_KNEE = 0.85, SHOULDER_HEADROOM = 0.30;
// why: the sky-view factor looks out about 3x the relief depth (clamped), because a ridge farther away subtends a
// negligible angle; 8 azimuths x 12 steps is the cheapest sampling free of visible banding.
export const SVF_REACH_RELIEF_MULT = 3, SVF_REACH_MM_MIN = 10, SVF_REACH_MM_MAX = 90;
export const SVF_AZIMUTHS = 8, SVF_STEPS = 12;

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// Sky strength (1 = full day) from the REAL sun elevation; null/undefined = daytime.
export function skyScale(sunElDeg) {
  if (sunElDeg === null || sunElDeg === undefined) return 1;
  return NIGHT_SKY + (1 - NIGHT_SKY) * smoothstep(TWILIGHT_FROM_DEG, TWILIGHT_FULL_DEG, sunElDeg);
}

// Light for one frame: sun and sky irradiance (relative) and the exposure that maps a flat face square-on to the
// total light onto the albedo.
export function lightBudget({ directLit, sunElDeg }) {
  const sun = directLit ? SUN_E : 0;
  const sky = SKY_OVER_SUN * SUN_E * skyScale(sunElDeg);
  const exposure = 2 ** EXPOSURE_EV / Math.max(sun + sky, EXPOSURE_FLOOR_E);
  return { sun, sky, exposure };
}

// Filmic shoulder on the scalar light (applied to irradiance, so hue stays the swatch's). Mirrors SKY_FRAG.
export function shoulder(x) {
  if (x <= SHOULDER_KNEE) return x;
  return SHOULDER_KNEE + SHOULDER_HEADROOM * Math.tanh((x - SHOULDER_KNEE) / SHOULDER_HEADROOM);
}

// Second pass: ADDS the sky to the untouched graze shader's direct term, then exposes, tone-maps, outputs sRGB.
const SKY_FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uHeightTex;
uniform sampler2D uDirect;
uniform ivec2 uTexSize;
uniform float uReliefMM;
uniform float uPxMM;
uniform float uSunE;
uniform float uSkyE;
uniform float uExposure;
uniform vec3 uAlbedo;
uniform float uReachTex;
uniform float uKnee;
uniform float uHead;
uniform int uMode;
uniform vec2 uSub;
const int AZ = ${SVF_AZIMUTHS};
const int ST = ${SVF_STEPS};
float heightMM(ivec2 t) {
  t = clamp(t, ivec2(0), uTexSize - ivec2(1));
  vec4 c = texelFetch(uHeightTex, t, 0);
  return ((floor(c.r * 255.0 + 0.5) * 256.0 + floor(c.g * 255.0 + 0.5)) / 65535.0) * uReliefMM;
}
// cosine-weighted visible fraction of the wall's front hemisphere: mean over azimuths of cos^2(horizon elevation)
float skyView(ivec2 texel) {
  float here = heightMM(texel);
  float vis = 0.0;
  for (int k = 0; k < AZ; k++) {
    float a = (float(k) + 0.37) * 6.2831853 / float(AZ);
    vec2 dir = vec2(cos(a), sin(a));
    float tmax = 0.0;
    for (int i = 1; i <= ST; i++) {
      float f = float(i) / float(ST);
      float d = max(float(i), uReachTex * f * f);
      vec2 p = vec2(texel) + dir * d;
      if (p.x < 0.0 || p.y < 0.0 || p.x >= float(uTexSize.x) || p.y >= float(uTexSize.y)) continue;
      tmax = max(tmax, (heightMM(ivec2(p)) - here) / (d / uPxMM));
    }
    vis += 1.0 / (1.0 + tmax * tmax);
  }
  return vis / float(AZ);
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  ivec2 texel = clamp(ivec2(vUV.x * float(uTexSize.x), (1.0 - vUV.y) * float(uTexSize.y)), ivec2(0), uTexSize - ivec2(1));
  float direct = texture(uDirect, vUV).r;
  float svf = skyView(texel);
  if (uSub.x > 0.0) {                 // the finished draw: four sky samples inside this pixel, not one (x = texels per pixel)
    vec2 here = vec2(vUV.x * float(uTexSize.x), (1.0 - vUV.y) * float(uTexSize.y));
    vec2 grid[4] = vec2[4](vec2(-0.375, -0.125), vec2(0.125, -0.375), vec2(0.375, 0.125), vec2(-0.125, 0.375));
    svf = 0.0;
    for (int i = 0; i < 4; i++) svf += 0.25 * skyView(clamp(ivec2(here + grid[i] * uSub), ivec2(0), uTexSize - ivec2(1)));
  }
  if (uMode == 1) { fragColor = vec4(vec3(svf), 1.0); return; }
  if (uMode == 2) { fragColor = vec4(vec3(direct), 1.0); return; }
  float e = (uSunE * direct + uSkyE * svf) * uExposure;
  float g = e <= uKnee ? e : uKnee + uHead * tanh((e - uKnee) / uHead);
  vec3 lin = uAlbedo * g;
  float n = (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 7.1) - 1.0) / 255.0;   // triangular dither: no banding in the dark
  fragColor = vec4(clamp(toSrgb(lin) + n, 0.0, 1.0), 1.0);
}`;

// ---------------------------------------------------------------------------- pure helpers (node-testable)
// Smallest stride (a divisor of the mould size, both sides of a rectangular mould) that keeps the wall texture inside
// the GPU-safe limits. mouldPx = mould width in px; mouldPxH = its height (default: square).
export function pickStride(cols, rows, mouldPx, maxSide = MAX_TEX_SIDE, maxPixels = MAX_TEX_PIXELS, mouldPxH = mouldPx) {
  for (let f = 1; f <= mouldPx; f++) {
    if (mouldPx % f || mouldPxH % f) continue;
    const nw = mouldPx / f, nh = mouldPxH / f;
    if (cols * nw <= maxSide && rows * nh <= maxSide && cols * rows * nw * nh <= maxPixels) return f;
  }
  return mouldPx;
}

// A wall with more texels than the canvas has pixels: one texel per pixel is a random sample of any relief finer than a pixel, which reads as noise.
// So the finished draw lights the wall this many times finer and averages the light down. 1 = the wall is not minified: the draw is untouched.
export function fineScale(texW, canvasW, canvasH, maxSide = MAX_TEX_SIDE, maxPixels = MAX_TEX_PIXELS) {
  let s = Math.min(FINE_SCALE_MAX, Math.ceil(texW / canvasW - 1e-6));
  while (s > 1 && (canvasW * s > maxSide || canvasH * s > maxSide || canvasW * s * canvasH * s > maxPixels)) s -= 1;
  return Math.max(1, s);
}

export function decimate(mould, f) {
  if (f === 1) return mould;
  const mw = mould.w ?? mould.px, mh = mould.h ?? mould.px;
  const nw = mw / f, nh = mh / f;
  const data = new Float32Array(nw * nh);
  for (let i = 0; i < nh; i++) for (let j = 0; j < nw; j++) data[i * nw + j] = mould.data[i * f * mw + j * f];
  return { px: nw, w: nw, h: nh, data };
}

// mm array -> {rgba, w, h, reliefMM}: level = round((mm - min) / range * 65535), R = level >> 8, G = level & 255.
export function encodeTwoChannel(wall) {
  let lo = Infinity, hi = -Infinity;
  for (const v of wall.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const range = hi - lo > 0 ? hi - lo : 1;
  const rgba = new Uint8Array(wall.w * wall.h * 4);
  for (let i = 0; i < wall.data.length; i++) {
    const level = Math.round((wall.data[i] - lo) / range * 65535);
    rgba[i * 4] = level >> 8;
    rgba[i * 4 + 1] = level & 255;
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, w: wall.w, h: wall.h, reliefMM: range };
}

// sun_studio.html render(): step budget for the shadow march (range is the whole texture range here).
export function shadowSteps(reliefMM, elDeg, pxMM, w, h) {
  const reach = Math.ceil(reliefMM / Math.max(Math.tan(Math.max(elDeg, 0.01) * Math.PI / 180), 1e-9) * pxMM) + 1;
  return Math.min(Math.floor(Math.min(w, h) * 0.5), Math.max(reach, 1), MAX_STEPS_GLSL);
}

// Browser: fetch the baked PNGs for the moulds a wall uses and decode them to {px, data} mm arrays.
export async function loadMoulds(kitDir, manifest, ids) {
  const out = {};
  await Promise.all(ids.map(async (id) => {
    const info = manifest.moulds[id];
    const img = await new Promise((resolve, reject) => {      // <img> like sun_studio.html: widest support
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`mould ${id}: could not load ${info.file}`));
      im.src = `${kitDir}/${info.file}`;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    out[id] = levelsToMm(ctx.getImageData(0, 0, c.width, c.height).data, c.width, manifest, 4, c.height);
  }));
  return out;
}

// cutRows = cuts() output (needed for staggered / plan rows; null = whole pieces only)
export function composeWall(rows, kit, moulds, cols, nRows, cutRows = null) {
  const first = Object.values(moulds)[0];
  const px = first.px;
  const f = pickStride(cols, nRows, px, MAX_TEX_SIDE, MAX_TEX_PIXELS, first.h ?? px);
  const small = {};
  for (const [id, m] of Object.entries(moulds)) small[id] = decimate(m, f);
  const wall = composeHeight(rows, kit, small, cutRows);
  return { wall, stride: f, pxPerMm: small[Object.keys(small)[0]].px / kit.module_mm[0] };
}

// ---------------------------------------------------------------------------- WebGL2
export function createLightView(canvas, shaderSrc) {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
  if (!gl) return null;
  const compile = (src, type) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(shaderSrc.VERT_SRC, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(shaderSrc.FRAG_SRC, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const U = {};
  for (const n of ["uHeightTex", "uTexSize", "uReliefMM", "uPxMM", "uAzDeg", "uElDeg", "uNSteps", "uDirectLight", "uAmbient"]) {
    U[n] = gl.getUniformLocation(prog, n);
  }
  const vao = gl.createVertexArray();
  let tex = null, meta = null;
  // tinted pipeline: pass 1 = the graze program into an offscreen texture (ambient 0, so a shadowed pixel is 0), pass 2 = SKY_FRAG
  let tint = null, prog2 = null, fbo = null, fboTex = null, fboW = 0, fboH = 0;
  const U2 = {};
  const ensurePass2 = () => {
    if (prog2) return;
    prog2 = gl.createProgram();
    gl.attachShader(prog2, compile(shaderSrc.VERT_SRC, gl.VERTEX_SHADER));
    gl.attachShader(prog2, compile(SKY_FRAG, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog2);
    if (!gl.getProgramParameter(prog2, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog2));
    for (const n of ["uHeightTex", "uDirect", "uTexSize", "uReliefMM", "uPxMM", "uSunE", "uSkyE", "uExposure", "uAlbedo",
                     "uReachTex", "uKnee", "uHead", "uMode", "uSub"]) U2[n] = gl.getUniformLocation(prog2, n);
    fbo = gl.createFramebuffer();
  };
  const ensureFbo = (w, h) => {
    if (fboTex && fboW === w && fboH === h) return;
    if (fboTex) gl.deleteTexture(fboTex);
    fboTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
                          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
    fboW = w; fboH = h;
  };
  // opts adds: sunElDeg (REAL sun elevation: dims the sky at dusk/night; omitted = daytime), debug ("sky" | "direct")
  function drawTinted(opts, nSteps) {
    ensurePass2();
    const scale = opts.fine ? fineScale(meta.w, canvas.width, canvas.height) : 1;
    ensureFbo(canvas.width * scale, canvas.height * scale);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);          // pass 1: the unedited graze shader, direct term only
    gl.viewport(0, 0, canvas.width * scale, canvas.height * scale);
    gl.useProgram(prog);
    gl.uniform1i(U.uHeightTex, 0);
    gl.uniform2i(U.uTexSize, meta.w, meta.h);
    gl.uniform1f(U.uReliefMM, meta.reliefMM);
    gl.uniform1f(U.uPxMM, meta.pxPerMm);
    gl.uniform1f(U.uAzDeg, opts.azDeg);
    gl.uniform1f(U.uElDeg, opts.elDeg);
    gl.uniform1i(U.uNSteps, nSteps);
    gl.uniform1i(U.uDirectLight, opts.directLit ? 1 : 0);
    gl.uniform1f(U.uAmbient, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);         // pass 2: sky + exposure + tone-map + sRGB
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog2);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    if (scale > 1) gl.generateMipmap(gl.TEXTURE_2D);  // pass 2 reads the direct light averaged down to its own pixel
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, scale > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    const b = lightBudget({ directLit: opts.directLit, sunElDeg: opts.sunElDeg });
    const reachMM = Math.min(SVF_REACH_MM_MAX, Math.max(SVF_REACH_MM_MIN, SVF_REACH_RELIEF_MULT * meta.reliefMM));
    gl.uniform1i(U2.uHeightTex, 0);
    gl.uniform1i(U2.uDirect, 1);
    gl.uniform2i(U2.uTexSize, meta.w, meta.h);
    gl.uniform1f(U2.uReliefMM, meta.reliefMM);
    gl.uniform1f(U2.uPxMM, meta.pxPerMm);
    gl.uniform1f(U2.uSunE, b.sun);
    gl.uniform1f(U2.uSkyE, b.sky);
    gl.uniform1f(U2.uExposure, b.exposure);
    gl.uniform3f(U2.uAlbedo, tint[0], tint[1], tint[2]);
    gl.uniform1f(U2.uReachTex, reachMM * meta.pxPerMm);
    gl.uniform1f(U2.uKnee, SHOULDER_KNEE);
    gl.uniform1f(U2.uHead, SHOULDER_HEADROOM);
    gl.uniform1i(U2.uMode, opts.debug === "sky" ? 1 : opts.debug === "direct" ? 2 : 0);
    gl.uniform2f(U2.uSub, scale > 1 ? meta.w / canvas.width : 0, scale > 1 ? meta.h / canvas.height : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return { nSteps, w: canvas.width, h: canvas.height, scale, ...b };
  }

  return {
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    supportsTint: true,
    // rgb = 0-1 sRGB from the swatch; null clears it (back to the untinted graze path + page-side multiply)
    setTint(rgb) { tint = rgb ? rgb.map((c) => srgbToLinear(Math.min(1, Math.max(0, c)))) : null; },
    setWall(encoded, pxPerMm) {
      if (encoded.w > gl.getParameter(gl.MAX_TEXTURE_SIZE) || encoded.h > gl.getParameter(gl.MAX_TEXTURE_SIZE)) {
        throw new Error("wall texture is larger than this device allows");
      }
      if (tex) gl.deleteTexture(tex);
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, encoded.w, encoded.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, encoded.rgba);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
                            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
        gl.texParameteri(gl.TEXTURE_2D, k, v);
      }
      meta = { w: encoded.w, h: encoded.h, reliefMM: encoded.reliefMM, pxPerMm };
    },
    get meta() { return meta; },
    // opts: {azDeg, elDeg, directLit, canvasW (device px; omitted = native texture size), nSteps, ambient, fine (the finished draw: see fineScale)}
    draw(opts) {
      if (!tex || !meta) return null;
      const cw = opts.canvasW ? Math.max(1, Math.round(opts.canvasW)) : meta.w;
      canvas.width = cw;
      canvas.height = Math.max(1, Math.round(cw * meta.h / meta.w));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const nSteps = opts.nSteps ?? shadowSteps(meta.reliefMM, opts.elDeg, meta.pxPerMm, meta.w, meta.h);
      if (tint) return drawTinted(opts, nSteps);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(U.uHeightTex, 0);
      gl.uniform2i(U.uTexSize, meta.w, meta.h);
      gl.uniform1f(U.uReliefMM, meta.reliefMM);
      gl.uniform1f(U.uPxMM, meta.pxPerMm);
      gl.uniform1f(U.uAzDeg, opts.azDeg);
      gl.uniform1f(U.uElDeg, opts.elDeg);
      gl.uniform1i(U.uNSteps, nSteps);
      gl.uniform1i(U.uDirectLight, opts.directLit ? 1 : 0);
      gl.uniform1f(U.uAmbient, opts.ambient ?? AMBIENT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return { nSteps, w: canvas.width, h: canvas.height };
    },
  };
}
