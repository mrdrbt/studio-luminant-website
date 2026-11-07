/* ─── RELIGHT TRAY — several designs side by side under one light (WebGL2) ───
 *
 * Markup: a [data-tray] root holding .tray-grid > .tray-cell[data-slug] > .tray-sample > img.tray-poster, plus the
 * .tray-shadow behind it, the .tray-pad dome control and [data-light] buttons. The posters are the first paint and
 * the fallback; one canvas over them shades the on-screen samples in one pass, one viewport per sample, so the whole
 * range costs one context and one shader compile. A sample's textures load as its row comes near the screen. The canvas
 * sits in the page, covers the screen plus a row each way and moves a whole row at a time, so scrolling never lags it.
 * Textures, posters and manifest come from tools/tray_bake.py.
 *
 * The light is one direction for every sample, never a point at the cursor: a point would give each design a
 * different light, and a comparison needs the same one. It comes from above or the sides only, as in relief-light.js:
 * lit from below, relief on a screen reads inverted. The dome control is the sky in plan: the rim is a grazing light,
 * the centre of its base is head-on. The tray grid maps the same way, so the light comes from where the pointer is.
 *
 * Never shades under prefers-reduced-motion or without WebGL2: the [data-light] buttons swap baked posters instead.
 * Sleeps when settled, off-screen or in a hidden tab. If frames run slow AND the GPU itself is over budget it drops steps,
 * then resolution, and stays there; a slow cadence alone proves nothing, because phones, WebViews and power saving cap
 * rAF at 30 Hz with the GPU idle (Galaxy A32, 2026-11-07: 33.3 ms at 6.6 ms of GPU work).
 * window.RelightTray exposes state and bench() for QA and for measuring a real device.
 */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var CFG = {
    elMin: 7, elMax: 60,            // dome rim = grazing, base centre = head-on
    springW: 6,                     // critically damped, ~1 s settle (relief-light.js)
    sweepS: 18, sweepAz: 82,        // the one slow pass after loading, either side of the default light
    standOffMm: 5,                  // how far a sample stands off the page, for the shadow it casts on the page
    stepsPerTexel: 1.25, minSteps: 6,
    budgetMs: 26, budgetFrames: 30, // mean frame time above this over that many frames asks the GPU...
    gpuBudgetMs: 14                 // ...and a frame costing more than this drops a quality level
  };
  var LIVE_AFTER_MS = 700;   // the canvas has faded in: the posters under it can stop being composited
  var BENCH_SETTLE_MS = 800; // after the jump to where the load peaks, for the page to stop moving
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var DPR_CAP = FINE ? 1.5 : 2;
  var QUALITY = [
    { dpr: DPR_CAP, steps: 32 },
    { dpr: DPR_CAP, steps: 16 },
    { dpr: Math.min(DPR_CAP, 1.5), steps: 12 },
    { dpr: 1, steps: 10 }
  ];

  var VS = [
    '#version 300 es',
    'out vec2 vUv;',
    'void main(){',
    '  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));',
    '  vUv=vec2(p.x,1.0-p.y);',
    '  gl_Position=vec4(p*2.0-1.0,0.0,1.0);',
    '}'
  ].join('\n');

  // relief-light.js's shading, without the wall: every pixel is on the sample, and the sample's own shadow on the page
  // is a CSS layer. The texture may hold more than the window (the design's module, or the window plus an apron).
  var FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv;',
    'uniform sampler2D uNormal;  // RGB tangent-space normal, +Y up',
    'uniform sampler2D uHeight;  // R = relief 0..1',
    'uniform vec2 uWinOrigin, uWinSize, uTexMm, uDir;',
    'uniform vec3 uL, uAlbedo;',
    'uniform float uReliefMm, uTanEl, uTanPen, uExposure, uStrength, uStepPow;',
    'uniform float uAmbient, uBounce, uShoulder, uSpec, uSpecPow;',
    'uniform int uSteps, uWrap;',
    'out vec4 outColor;',
    'void main(){',
    '  vec2 uv=uWinOrigin+vUv*uWinSize;',
    '  vec3 nt=texture(uNormal,uv).xyz*2.0-1.0;',
    '  vec3 N=normalize(vec3(nt.xy/max(nt.z,0.05),1.0));',
    '  float h0=textureLod(uHeight,uv,0.0).r*uReliefMm;',
    '  vec2 d=vec2(uDir.x,-uDir.y)/uTexMm;',
    '  float tEnd=max((uReliefMm-h0)/uTanEl,1e-3);',
    '  float s=1.0, fs=float(uSteps);',
    '  float bias=uReliefMm*(1.5/255.0);',
    '  for(int i=0;i<uSteps;i++){',
    '    float t=tEnd*pow((float(i)+1.0)/fs,uStepPow);',
    '    vec2 q=uv+d*t;',
    '    if(uWrap==0&&(q.x<0.0||q.y<0.0||q.x>1.0||q.y>1.0)) break;',
    '    float hs=textureLod(uHeight,q,0.0).r*uReliefMm;',
    '    s=min(s,(h0+t*uTanEl-hs+bias)/(t*uTanPen));',
    '    if(s<=0.0) break;',
    '  }',
    '  s=clamp(s,0.0,1.0); s=s*s*(3.0-2.0*s);',
    '  float sh=1.0-uStrength*(1.0-s);',
    '  float ndl=max(dot(N,uL),0.0);',
    '  vec3 H=normalize(uL+vec3(0.0,0.0,1.0));',
    '  float spec=uSpec*pow(max(dot(N,H),0.0),uSpecPow);',
    '  float x=uExposure*(uAmbient+uBounce*(1.0-N.z)+sh*(ndl+spec));',
    '  float k=uShoulder;',
    '  float y=x<k?x:k+(1.0-k)*(1.0-exp(-(x-k)/(1.0-k)));',
    '  outColor=vec4(clamp(uAlbedo*y,0.0,1.0),1.0);',
    '}'
  ].join('\n');

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function loadImage(url) {
    var img = new Image();
    img.src = url;
    return img.decode().then(function () { return img; });
  }

  function makeTexture(gl, img, single, wrap) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); // data, not colour
    if (single) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
    else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, single ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var mode = wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mode);
    return tex;
  }

  // Resolves {p, U}. Reading LINK_STATUS blocks until the driver has compiled, so with KHR_parallel_shader_compile
  // it polls on a timer and reads the status only then (relief-light.js).
  function compile(gl) {
    var ext = gl.getExtension('KHR_parallel_shader_compile');
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    function finish() {
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(p));
      }
      var U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var name = gl.getActiveUniform(p, i).name;
        U[name] = gl.getUniformLocation(p, name);
      }
      return { p: p, U: U };
    }
    if (!ext) return Promise.resolve().then(finish);
    return new Promise(function (resolve, reject) {
      (function poll() {
        if (gl.isContextLost()) { reject(new Error('relight-tray: context lost while compiling')); return; }
        if (!gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) { setTimeout(poll, 16); return; }
        try { resolve(finish()); } catch (err) { reject(err); }
      })();
    });
  }

  function mount(root) {
    var base = root.getAttribute('data-tray');
    var grid = root.querySelector('.tray-grid');
    var pad = root.querySelector('.tray-pad');
    var dock = root.querySelector('.tray-dock');
    var dot = pad.querySelector('.tray-pad__dot');
    var ray = pad.querySelector('.tray-pad__ray');
    var buttons = [].slice.call(root.querySelectorAll('[data-light]'));
    var cells = [].slice.call(root.querySelectorAll('.tray-cell')).map(function (el) {
      return {
        slug: el.getAttribute('data-slug'),
        sample: el.querySelector('.tray-sample'),
        poster: el.querySelector('.tray-poster'),
        shadow: el.querySelector('.tray-shadow'),
        el: el, visible: false, loaded: false, pending: null, live: false
      };
    });
    var state = {
      mode: 'poster', ready: false, frames: 0, level: 0, lod: null, light: null, readyMs: null, textureBytes: 0
    };
    root.relightTray = state;

    var M, gl, canvas, prog, drawn = { az: NaN, el: NaN }, running = false, visible = true, dirty = true, lastT = 0;
    var sweep = null, touched = false, benching = false, limit = Infinity, acc = 0, accN = 0, stepsCap = QUALITY[0].steps;
    var canvasTop = 0, canvasHeight = 0, rowPitch = 1, dpr = 1, shadowTransform = '', faded = false;
    var qualitySettled = false;
    var dprNow = QUALITY[0].dpr, L = { az: 90, el: 12, vAz: 0, vEl: 0, tAz: 90, tEl: 12 }, manual = false, sampleCss = 0;
    state.light = L;

    // On a first visit the consent banner covers the bottom of the screen, which is where a phone keeps the dock.
    function standClearOfConsent() {
      var banner = document.getElementById('sl-consent');
      root.style.setProperty('--consent-h', banner ? banner.offsetHeight + 'px' : '0px');
    }
    standClearOfConsent();
    new MutationObserver(standClearOfConsent).observe(document.body, { childList: true });

    /* ── the light ── */
    function aimAt(nx, ny) {
      var r = Math.min(1, Math.hypot(nx, ny));
      if (r > 0.02) L.tAz = clamp(Math.atan2(Math.max(0, ny), nx) / DEG, 0, 180);
      L.tEl = lerp(CFG.elMax, CFG.elMin, r);
    }
    function markManual() {
      if (manual) return;
      manual = touched = true;
      sweep = null;
      root.classList.add('tray-touched');
      setPressed(null);
    }
    function setPressed(name) {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-light') === name)); });
    }
    function drawPad() {
      var R = 100, r = (CFG.elMax - L.el) / (CFG.elMax - CFG.elMin);
      var x = 100 + R * r * Math.cos(L.az * DEG), y = 104 - R * r * Math.sin(L.az * DEG);
      dot.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      ray.setAttribute('x2', x.toFixed(1));
      ray.setAttribute('y2', y.toFixed(1));
    }
    function describeLight() {
      var key = L.az > 135 ? 'left' : L.az > 105 ? 'upleft' : L.az > 75 ? 'up' : L.az > 45 ? 'upright' : 'right';
      var word = pad.getAttribute('data-from-' + key) || key;
      pad.setAttribute('aria-valuetext', word + ', ' + Math.round(L.el) + '°');
      pad.setAttribute('aria-valuenow', String(Math.round(L.az)));
    }
    function drawShadows() {
      var az = L.az * DEG, mm = CFG.standOffMm / Math.tan(L.el * DEG);
      var px = (sampleCss || cells[0].sample.getBoundingClientRect().width) / M.windowMm * mm;
      shadowTransform = 'translate3d(' + (-Math.cos(az) * px).toFixed(2) + 'px,' + (Math.sin(az) * px).toFixed(2) + 'px,0)';
      cells.forEach(function (c) { if (c.visible || state.mode !== 'live') c.shadow.style.transform = shadowTransform; });
    }

    /* ── drawing ── */
    function layout() {
      var g = grid.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, dprNow);
      cells.forEach(function (c) {
        var r = c.sample.getBoundingClientRect();
        c.w = Math.round(r.width * dpr);
        c.h = Math.round(r.height * dpr);
        c.x = Math.round((r.left - g.left) * dpr);
        c.top = Math.round((r.top - g.top) * dpr);
        c.topCss = r.top - g.top;
      });
      var rows = cells.map(function (c) { return c.topCss; }).filter(function (t, i, all) { return all.indexOf(t) === i; });
      rowPitch = rows.length > 1 ? rows[1] - rows[0] : g.height;
      canvasHeight = Math.min(g.height, window.innerHeight + 2 * rowPitch);
      var w = Math.max(1, Math.round(g.width * dpr)), h = Math.max(1, Math.round(canvasHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      canvas.style.height = canvasHeight + 'px';
      sampleCss = cells[0].sample.getBoundingClientRect().width;
      state.canvas = [w, h];
      state.dpr = dpr;
      canvasTop = -1;
      placeCanvas();
      updateVisible();
      dirty = true;
    }
    // Whole rows only, so a sample's place in the canvas stays put between moves.
    function placeCanvas() {
      var g = grid.getBoundingClientRect();
      var want = Math.floor(Math.max(0, -g.top) / rowPitch - 1) * rowPitch;
      want = Math.max(0, Math.min(g.height - canvasHeight, want));
      if (want === canvasTop) return false;
      canvasTop = want;
      canvas.style.transform = 'translateY(' + want + 'px)';
      return true;
    }
    // What a viewer can see of the grid: the screen, less the opaque nav above and, on a phone, the dock below.
    // Asked on every scroll, so a row is shaded in the frame it enters, with no poster at the old light first.
    function updateVisible() {
      var g = grid.getBoundingClientRect(), d = dock.getBoundingClientRect(), nav = document.querySelector('nav');
      var top = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
      var bottom = d.left < g.right && d.right > g.left ? Math.min(window.innerHeight, d.top) : window.innerHeight;
      var changed = false;
      cells.forEach(function (c) {
        var y = g.top + c.topCss, on = y < bottom && y + sampleCss > top;
        if (on === c.visible) return;
        c.visible = on;
        changed = true;
        if (on) c.shadow.style.transform = shadowTransform;
      });
      return changed;
    }
    function drawCell(c, U) {
      var D = c.data, tanEl = Math.tan(L.el * DEG);
      var steps = Math.ceil(D.reliefMm / tanEl * c.heightPxPerMm * CFG.stepsPerTexel);
      gl.viewport(c.x, canvas.height - (c.top - Math.round(canvasTop * dpr)) - c.h, c.w, c.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, c.texN);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, c.texH);
      gl.uniform2f(U.uTexMm, D.texMm[0], D.texMm[1]);
      gl.uniform2f(U.uWinOrigin, D.win[0] / D.texMm[0], D.win[1] / D.texMm[1]);
      gl.uniform2f(U.uWinSize, M.windowMm / D.texMm[0], M.windowMm / D.texMm[1]);
      gl.uniform1f(U.uReliefMm, D.reliefMm);
      gl.uniform1i(U.uWrap, D.wrap ? 1 : 0);
      gl.uniform1i(U.uSteps, clamp(steps, CFG.minSteps, stepsCap));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function draw() {
      var S = M.shade, U = prog.U, az = L.az * DEG, elv = L.el * DEG, ce = Math.cos(elv);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uDir, Math.cos(az), Math.sin(az));
      gl.uniform3f(U.uL, ce * Math.cos(az), ce * Math.sin(az), Math.sin(elv));
      gl.uniform1f(U.uTanEl, Math.tan(elv));
      gl.uniform1f(U.uExposure, S.flatLevel / (S.ambient + Math.sin(elv)));
      var shaded = 0;
      cells.forEach(function (c) {
        var draws = c.visible && c.loaded && shaded < limit;
        if (draws) { drawCell(c, U); shaded++; }
        var live = draws && faded;
        if (live !== c.live) { c.live = live; c.el.classList.toggle('is-live', live); }   // its poster can stop compositing
      });
      drawn.az = L.az; drawn.el = L.el; dirty = false; state.frames++;
      drawPad();
      drawShadows();
    }
    function setStatic() {
      var S = M.shade, U = prog.U;
      gl.useProgram(prog.p);
      gl.bindVertexArray(gl.createVertexArray());
      gl.clearColor(0, 0, 0, 0);
      gl.uniform1i(U.uNormal, 0);
      gl.uniform1i(U.uHeight, 1);
      gl.uniform3f(U.uAlbedo, S.albedo[0] / 255, S.albedo[1] / 255, S.albedo[2] / 255);
      gl.uniform1f(U.uTanPen, Math.tan(S.penumbraDeg * DEG));
      gl.uniform1f(U.uStrength, S.shadowStrength);
      gl.uniform1f(U.uStepPow, S.stepPow);
      gl.uniform1f(U.uAmbient, S.ambient);
      gl.uniform1f(U.uBounce, S.bounce);
      gl.uniform1f(U.uShoulder, S.shoulder);
      gl.uniform1f(U.uSpec, S.spec);
      gl.uniform1f(U.uSpecPow, S.specPow);
    }

    /* ── the loop ── */
    function spring(x, v, target, dt) {
      v += (CFG.springW * CFG.springW * (target - x) - 2 * CFG.springW * v) * dt;
      return [x + v * dt, v];
    }
    function gpuFrameMs() {
      var read = new Uint8Array(4);
      draw();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, read);   // flush the queue first
      var t0 = performance.now();
      draw();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, read);   // returns once the GPU has finished the frame
      return performance.now() - t0;
    }
    function governor(rawMs) {
      if (qualitySettled || rawMs <= 0 || rawMs > 250 || state.level >= QUALITY.length - 1) return;
      acc += rawMs; accN++;
      if (accN < CFG.budgetFrames) return;
      var slow = acc / accN > CFG.budgetMs;
      acc = accN = 0;
      if (!slow) return;
      state.gpuMs = +gpuFrameMs().toFixed(1);
      if (state.gpuMs < CFG.gpuBudgetMs) { qualitySettled = true; return; }   // the cadence is a cap, not the GPU
      state.level++;
      stepsCap = QUALITY[state.level].steps;
      if (QUALITY[state.level].dpr !== dprNow) { dprNow = QUALITY[state.level].dpr; layout(); draw(); }
    }
    function tick(now) {
      if (!visible || !state.ready || benching) { running = false; return; }
      var raw = now - lastT, dt = Math.min(0.05, Math.max(0, raw / 1000));
      lastT = now;
      if (sweep) {
        var p = Math.max(0, (now - sweep.t0) / 1000 / CFG.sweepS);
        if (p >= 1) { L.tAz = sweep.az; L.tEl = sweep.el; sweep = null; }
        else { L.tAz = sweep.az + CFG.sweepAz * Math.sin(2 * Math.PI * p); L.tEl = sweep.el; }
      }
      var a = spring(L.az, L.vAz, L.tAz, dt), e = spring(L.el, L.vEl, L.tEl, dt);
      L.az = a[0]; L.vAz = a[1]; L.el = e[0]; L.vEl = e[1];
      // 0.02° of light movement is invisible on the relief; stop drawing and sleep below that
      if (dirty || Math.abs(L.az - drawn.az) > 0.02 || Math.abs(L.el - drawn.el) > 0.01) { draw(); governor(raw); }
      var settled = !sweep && Math.abs(L.vAz) < 0.05 && Math.abs(L.vEl) < 0.05 &&
        Math.abs(L.tAz - L.az) < 0.02 && Math.abs(L.tEl - L.el) < 0.01;
      if (settled) {
        L.az = L.tAz; L.el = L.tEl; L.vAz = L.vEl = 0;
        draw();
        describeLight();
        running = false;
        return;
      }
      requestAnimationFrame(tick);
    }
    function wake() {
      if (running || !visible || !state.ready || benching) return;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
    }

    /* ── input ── */
    function aimFromGrid(e) {
      var r = grid.getBoundingClientRect();
      var top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);   // the part of the tray on screen
      aimAt((e.clientX - r.left - r.width / 2) / (r.width / 2), (bottom - e.clientY) / Math.max(1, bottom - top));
    }
    function aimFromPad(e) {
      // viewBox -8 -8 216 120: the dome's base sits 8 units above the bottom, its radius is 100
      var r = pad.getBoundingClientRect(), R = r.width * 100 / 216;
      aimAt((e.clientX - (r.left + r.width / 2)) / R, (r.bottom - r.height * 8 / 120 - e.clientY) / R);
    }
    function bindLive() {
      grid.addEventListener('pointermove', function (e) {
        if (benching) return;
        markManual();
        aimFromGrid(e);
        wake();
      }, { passive: true });
      pad.addEventListener('pointerdown', function (e) {
        pad.setPointerCapture(e.pointerId);
        markManual();
        aimFromPad(e);
        wake();
      });
      pad.addEventListener('pointermove', function (e) {
        if (!pad.hasPointerCapture(e.pointerId)) return;
        aimFromPad(e);
        wake();
      });
      pad.addEventListener('keydown', function (e) {
        var dAz = { ArrowLeft: 5, ArrowRight: -5 }[e.key] || 0, dEl = { ArrowUp: 3, ArrowDown: -3 }[e.key] || 0;
        if (!dAz && !dEl) return;
        e.preventDefault();
        markManual();
        L.tAz = clamp(L.tAz + dAz, 0, 180);
        L.tEl = clamp(L.tEl + dEl, CFG.elMin, CFG.elMax);
        wake();
      });
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting && !document.hidden;
        wake();
      }).observe(grid);
      window.addEventListener('scroll', function () {
        var moved = placeCanvas(), exposed = updateVisible();
        if (moved || exposed) { dirty = true; wake(); }
      }, { passive: true });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { visible = false; return; }
        var r = grid.getBoundingClientRect();
        visible = r.bottom > 0 && r.top < window.innerHeight;
        wake();
      });
      new ResizeObserver(function () { if (state.ready) { layout(); wake(); } }).observe(grid);
    }
    function pickLight(name) {
      var P = M.lights[name];
      setPressed(name);
      touched = true;
      root.classList.add('tray-touched');
      manual = false;
      sweep = null;
      L.tAz = P.az;
      L.tEl = P.el;
      if (state.mode === 'live') { wake(); return; }
      L.az = P.az;
      L.el = P.el;
      cells.forEach(function (c) {
        var src = base + c.slug + '/poster-' + name + '-';
        c.poster.srcset = M.posterPx.map(function (px) { return src + px + '.webp ' + px + 'w'; }).join(', ');
        c.poster.src = src + M.posterPx[0] + '.webp';
      });
      drawPad();
      drawShadows();
      describeLight();
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { if (M) pickLight(b.getAttribute('data-light')); });
    });

    /* ── loading ── */
    function pickLod() {
      var need = cells[0].sample.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, dprNow) / M.windowMm;
      return need <= M.lodPxPerMm.s * 1.15 ? 's' : 'l';
    }
    function loadCell(c) {
      if (c.pending) return c.pending;
      c.data = M.designs[c.slug];
      var f = c.data.lods[state.lod];
      c.heightPxPerMm = f.heightPxPerMm;
      c.pending = Promise.all([loadImage(base + c.slug + '/' + f.normal), loadImage(base + c.slug + '/' + f.height)])
        .then(function (imgs) {
          gl.activeTexture(gl.TEXTURE0);
          c.texN = makeTexture(gl, imgs[0], false, c.data.wrap);
          c.texH = makeTexture(gl, imgs[1], true, c.data.wrap);
          state.textureBytes += imgs[0].naturalWidth * imgs[0].naturalHeight * 4 * 4 / 3 + imgs[1].naturalWidth * imgs[1].naturalHeight;
          c.loaded = true;
          dirty = true;
          wake();
        });
      return c.pending;
    }
    function watchCells() {
      var byEl = new Map(cells.map(function (c) { return [c.sample, c]; }));
      var near = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          near.unobserve(e.target);
          loadCell(byEl.get(e.target)).catch(function (err) { console.warn(String(err && err.message || err)); });
        });
      }, { rootMargin: '25% 0px' });   // a screen's worth reached the whole range on a phone before anyone scrolled
      cells.forEach(function (c) { near.observe(c.sample); });
    }
    function enterStill(mode) {
      state.mode = mode;
      cells.forEach(function (c) { c.live = false; c.el.classList.remove('is-live'); });
      root.classList.add('tray-still');
      pad.removeAttribute('tabindex');
    }
    function startLive() {
      canvas = document.createElement('canvas');
      canvas.className = 'tray-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      gl = canvas.getContext('webgl2', {
        antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'low-power'
      });
      if (!gl) { enterStill('poster'); return; }
      grid.appendChild(canvas);
      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        state.ready = false;
        enterStill('poster');
        canvas.remove();
      });
      state.lod = pickLod();
      var onFirstScreen = cells.filter(function (c) {
        var r = c.sample.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
      var compiled = compile(gl);
      Promise.all(onFirstScreen.map(loadCell))
        .then(function () { return compiled; })
        .then(function (p) {
          prog = p;
          setStatic();
          layout();
          state.mode = 'live';
          draw();
          state.ready = true;
          state.readyMs = Math.round(performance.now());
          requestAnimationFrame(function () { canvas.classList.add('is-on'); });
          setTimeout(function () { faded = true; dirty = true; wake(); }, LIVE_AFTER_MS);
          bindLive();
          watchCells();
          if (!touched) sweep = { t0: performance.now() + 700, az: L.az, el: L.el };
          wake();
          root.dispatchEvent(new CustomEvent('relighttray:ready', { detail: state }));
        })
        .catch(function (err) {
          console.warn(String(err && err.message || err) + ' — showing the posters');
          enterStill('poster');
          canvas.remove();
        });
    }

    /* ── measuring (a real device: the button on the page; QA: RelightTray.bench()) ── */
    function renderer() {
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    }
    function pctl(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0; }
    function benchLight(t) {
      L.az = L.tAz = 90 + 80 * Math.sin(2 * Math.PI * t / 4);
      L.el = L.tEl = 20 + 12 * Math.sin(2 * Math.PI * t / 7);
      L.vAz = L.vEl = 0;
    }
    function runBench(cfg, seconds) {
      dprNow = cfg.dpr;
      stepsCap = cfg.steps;
      limit = cfg.n || Infinity;
      layout();
      draw();
      var px = cells.filter(function (c) { return c.visible && c.loaded; }).slice(0, limit)
        .reduce(function (sum, c) { return sum + c.w * c.h; }, 0);
      return new Promise(function (resolve) {
        var deltas = [], t0 = performance.now(), last = t0;
        (function frame(now) {
          var t = (now - t0) / 1000;
          deltas.push(now - last);
          last = now;
          if (cfg.work !== 'idle') {
            benchLight(t);
            if (cfg.work === 'layers') { drawPad(); drawShadows(); } else draw();
          }
          if (t < seconds) { requestAnimationFrame(frame); return; }
          deltas.shift();
          var sync = [], i;
          for (i = 0; !cfg.work && i < 12; i++) {
            benchLight(i * 0.31);
            sync.push(gpuFrameMs());
          }
          var d = deltas.slice().sort(function (a, b) { return a - b; });
          sync.sort(function (a, b) { return a - b; });
          var mean = deltas.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, deltas.length);
          var slow = deltas.filter(function (x) { return x > 25; }).length;
          resolve({
            work: cfg.work || 'full', designs: cells.filter(function (c) { return c.visible && c.loaded; }).slice(0, limit).length, dpr: cfg.dpr, stepsCap: cfg.steps, canvas: [canvas.width, canvas.height], shadedPx: px,
            fps: +(1000 / mean).toFixed(1), p50ms: +pctl(d, 0.5).toFixed(1), p95ms: +pctl(d, 0.95).toFixed(1),
            slowFramePct: +(100 * slow / Math.max(1, deltas.length)).toFixed(1), frames: deltas.length,
            gpuFrameMs: sync.length ? +pctl(sync, 0.5).toFixed(2) : null
          });
        })(performance.now());
      });
    }
    function bytes() {
      var out = { posters: 0, textures: 0, manifest: 0, script: 0, chrome: 0 };
      performance.getEntriesByType('resource').forEach(function (r) {
        var n = r.encodedBodySize || 0, u = r.name;
        if (/relief-tray\/.*poster/.test(u)) out.posters += n;
        else if (/relief-tray\/.*(normal|height)-/.test(u)) out.textures += n;
        else if (/relief-tray\/manifest/.test(u)) out.manifest += n;
        else if (/relight-tray\./.test(u)) out.script += n;
        else out.chrome += n;
      });
      return out;
    }
    state.bench = function (opts) {
      opts = opts || {};
      if (!state.ready) return Promise.reject(new Error('the tray is not live on this device: ' + state.mode));
      var seconds = opts.seconds || 4, saved = { dpr: dprNow, steps: stepsCap };
      var cap = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      // idle = nothing moves: what the device's own frame loop allows. layers = shadows and dot move, no shading.
      var runs = opts.runs || [
        { dpr: cap, steps: 32, work: 'idle' },
        { dpr: cap, steps: 32, work: 'layers' },
        { dpr: cap, steps: 32 },
        { dpr: cap, steps: 16 },
        { dpr: Math.min(cap, 1.5), steps: 16 },
        { dpr: 1, steps: 16 }
      ];
      benching = true;
      sweep = null;
      var out = [];
      return runs.reduce(function (chain, cfg) {
        return chain.then(function () { return runBench(cfg, seconds); }).then(function (r) { out.push(r); });
      }, Promise.resolve()).then(function () {
        dprNow = saved.dpr;
        stepsCap = saved.steps;
        limit = Infinity;
        benching = false;
        layout();
        L.tAz = L.az = M.lights[M.defaultLight].az;
        L.tEl = L.el = M.lights[M.defaultLight].el;
        draw();
        return {
          renderer: renderer(), ua: navigator.userAgent, viewport: [window.innerWidth, window.innerHeight],
          devicePixelRatio: window.devicePixelRatio, lod: state.lod, sampleCssPx: Math.round(cells[0].sample.getBoundingClientRect().width),
          governorLevel: state.level, governorGpuMs: state.gpuMs, readyMs: state.readyMs, textureMB: +(state.textureBytes / 1048576).toFixed(1),
          bytes: bytes(), runs: out
        };
      });
    };
    // The load peaks with a row half under the nav: every row below it fits too, so the most samples are shaded at once.
    state.benchAtPeak = function (opts) {
      var nav = document.querySelector('nav');
      window.scrollTo(0, window.scrollY + grid.getBoundingClientRect().top - (nav ? nav.getBoundingClientRect().bottom : 0) + rowPitch * 1.5);
      return new Promise(function (resolve) { setTimeout(resolve, BENCH_SETTLE_MS); })
        .then(function () { return Promise.all(cells.filter(function (c) { return c.visible; }).map(loadCell)); })
        .then(function () { return state.bench(opts); });
    };
    var benchBtn = root.parentNode.querySelector('[data-tray-bench]');
    if (benchBtn) {
      var benchOut = root.parentNode.querySelector('[data-tray-bench-out]');
      benchBtn.addEventListener('click', function () {
        benchBtn.disabled = true;
        benchOut.hidden = false;
        benchOut.textContent = benchBtn.getAttribute('data-running');
        state.benchAtPeak()
          .then(function (r) { benchOut.textContent = JSON.stringify(r); }, function (err) { benchOut.textContent = String(err.message); })
          .then(function () { benchBtn.disabled = false; });
      });
    }

    /* ── start ── */
    fetch(base + 'manifest.json')
      .then(function (r) { if (!r.ok) throw new Error('relight-tray: manifest ' + r.status); return r.json(); })
      .then(function (m) {
        M = m;
        var P = M.lights[M.defaultLight];
        L.az = L.tAz = P.az;
        L.el = L.tEl = P.el;
        setPressed(M.defaultLight);
        drawPad();
        describeLight();
        if (REDUCED || !window.WebGL2RenderingContext) { enterStill('still'); return; }
        startLive();
      })
      .catch(function (err) { console.warn(String(err && err.message || err)); });
    return state;
  }

  function init() {
    var root = document.querySelector('[data-tray]');
    if (!root) return;
    root.classList.add('tray-js');
    function go() { window.RelightTray = mount(root); }
    if (document.readyState === 'complete') (window.requestIdleCallback || setTimeout)(go, { timeout: 800 });
    else window.addEventListener('load', function () { (window.requestIdleCallback || setTimeout)(go, { timeout: 800 }); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
