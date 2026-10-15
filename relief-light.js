/* ─── RELIEF LIGHT — a real relief heightmap lit by a moving raking light (WebGL2) ───
 *
 * Markup (the poster <img> is the LCP element and the fallback; the canvas only fades in over it):
 *   <figure class="relief-light" data-relief-light="assets/relief/080-iznik-cypress/" data-input="auto">
 *     <img class="relief-light__poster" src=".../poster-1680.jpg" srcset="... 840w, ... 1680w" sizes="..." alt="...">
 *   </figure>
 * The folder holds manifest.json + textures written by tools/relief_bake.py; the shading constants come
 * from the manifest, so the first frame matches the poster.
 *
 * Inputs (data-input):
 *   pointer  the light follows the cursor; after 3 s without movement it drifts in a slow idle arc
 *   scroll   the element's progress through the viewport is the sun: azimuth 150° → 30°, elevation
 *            rising then falling (dawn → noon → dusk). An element already on screen at load (a hero)
 *            starts at the poster's light and only sets as the page scrolls, so nothing jumps.
 *   auto     pointer on a fine hover pointer, scroll everywhere else (default)
 *
 * Never runs under prefers-reduced-motion or without WebGL2 (the poster stays). Sleeps when settled,
 * off-screen or in a hidden tab. Exposes window.ReliefLight.mount(el) and el.reliefLight (state, for QA).
 */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var CFG = {
    azLeft: 160, azRight: 20,          // pointer x → azimuth (light always from above: relief never reads inverted)
    elMin: 8, elMax: 25,               // pointer y → elevation (top = higher)
    sunAz: [150, 30], sunEl: [9, 22],  // scroll: azimuth sweep, elevation low → high → low
    idleDelayMs: 3000, idleArcS: 24, idleAz: [30, 150], idleEl: [12, 20], idleElPeriodS: 37,
    springW: 6,                        // critically damped, ~1 s settle
    depthScale: 1
  };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var VS = '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';

  var FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D uNormal;  // RGB tangent-space normal, +Y up',
    'uniform sampler2D uHeight;  // R = relief 0..1, G = albedo variation (0.5 = neutral)',
    'uniform vec2 uRes, uPanelPx, uPanelSize, uPanelMm, uDir;',
    'uniform vec3 uL, uAlbedo;',
    'uniform float uBaseMm, uReliefMm;',
    'uniform float uTanEl, uTanPen, uExposure, uDepth, uStrength, uStepPow;',
    'uniform float uAmbient, uBounce, uShoulder, uSpec, uSpecPow, uAlbedoVar;',
    'uniform int uSteps, uField;  // uField = 1: the relief repeats across the whole canvas (no wall)',
    'out vec4 outColor;',
    'bool onPanel(vec2 q){return q.x>=0.0&&q.y>=0.0&&q.x<=1.0&&q.y<=1.0;}',
    'void main(){',
    '  vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    '  vec2 uv=(fc-uPanelPx)/uPanelSize;',
    '  bool field=uField==1;',
    '  bool inside=field||onPanel(uv);',
    '  float relief=uReliefMm*uDepth;',
    '  vec3 N=vec3(0.0,0.0,1.0); float h0=0.0, av=0.0;',
    '  if(inside){',
    '    vec3 nt=texture(uNormal,uv).xyz*2.0-1.0;',
    '    N=normalize(vec3(uDepth*nt.xy/max(nt.z,0.05),1.0));',
    '    vec2 hv=textureLod(uHeight,uv,0.0).rg;',
    '    h0=uBaseMm+hv.r*relief; av=hv.g*2.0-1.0;',
    '  }',
    '  // soft self + cast shadow: march toward the light only over the stretch that crosses the panel',
    '  vec2 d=vec2(uDir.x,-uDir.y)/uPanelMm;',
    '  float tMax=max((uBaseMm+relief-h0)/uTanEl,1e-3);',
    '  vec2 inv=1.0/(abs(d)+1e-12)*sign(d+1e-12);',
    '  vec2 ta=(vec2(0.0)-uv)*inv, tb=(vec2(1.0)-uv)*inv;',
    '  vec2 tn=min(ta,tb), tf=max(ta,tb);',
    '  float tIn=field?0.0:max(max(tn.x,tn.y),0.0), tEnd=field?tMax:min(min(tf.x,tf.y),tMax);',
    '  float s=1.0;',
    '  if(tIn<tEnd){',
    '    float fs=float(uSteps);',
    '    for(int i=0;i<64;i++){',
    '      if(i>=uSteps) break;',
    '      float t=tIn+(tEnd-tIn)*pow((float(i)+1.0)/fs,uStepPow);',
    '      vec2 q=uv+d*t;',
    '      if(!field&&!onPanel(q)) continue;',
    '      float hs=uBaseMm+textureLod(uHeight,q,0.0).r*relief;',
    '      s=min(s,(h0+t*uTanEl-hs)/(t*uTanPen));',
    '      if(s<=0.0) break;',
    '    }',
    '  }',
    '  s=clamp(s,0.0,1.0); s=s*s*(3.0-2.0*s);',
    '  float sh=1.0-uStrength*(1.0-s);',
    '  float ndl=max(dot(N,uL),0.0);',
    '  vec3 H=normalize(uL+vec3(0.0,0.0,1.0));',
    '  float spec=uSpec*pow(max(dot(N,H),0.0),uSpecPow);',
    '  float x=uExposure*(uAmbient+uBounce*(1.0-N.z)+sh*(ndl+spec));',
    '  float k=uShoulder;',
    '  float y=x<k?x:k+(1.0-k)*(1.0-exp(-(x-k)/(1.0-k)));',
    '  outColor=vec4(clamp(uAlbedo*(1.0+uAlbedoVar*av)*y,0.0,1.0),1.0);',
    '}'
  ].join('\n');

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('relief-light: could not load ' + url)); };
      img.src = url;
    });
  }

  function texture(gl, img, unit, mips, wrap) {
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); // data, not colour
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return tex;
  }

  function program(gl) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name;
      U[name] = gl.getUniformLocation(p, name);
    }
    return { p: p, U: U };
  }

  function mount(el) {
    if (REDUCED || el.reliefLight) return null;
    var base = el.getAttribute('data-relief-light') || '';
    if (base && base.slice(-1) !== '/') base += '/';
    var poster = el.querySelector('.relief-light__poster');
    if (!poster) return null;
    var input = el.getAttribute('data-input') || 'auto';
    var mode = input === 'auto' ? (FINE ? 'pointer' : 'scroll') : input;

    var canvas = document.createElement('canvas');
    canvas.className = 'relief-light__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return null;
    el.appendChild(canvas);

    var state = {
      mode: mode, ready: false, frames: 0, idle: false,
      light: { az: 125, el: 16, vAz: 0, vEl: 0, tAz: 125, tEl: 16 }
    };
    el.reliefLight = state;

    var M, prog, running = false, visible = false, dirty = true, lastT = 0, lastPointer = -Infinity;
    var idleT0 = 0, azPhase = 0, elPhase = 0, idleTimer = 0;
    var drawn = { az: NaN, el: NaN };
    var panel = { x: 0, y: 0, w: 1, h: 1 };
    var steps = FINE ? 40 : 24;
    var maxDpr = FINE ? 1.5 : 1.25;

    function layout() {
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      var c = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(c.width * dpr)), h = Math.max(1, Math.round(c.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      var p = poster.getBoundingClientRect();
      var sx = w / Math.max(1, c.width);
      if (M.layout === 'field') {
        panel.x = (p.left - c.left) * sx;
        panel.y = (p.top - c.top) * sx;
        panel.w = p.width / M.fieldTiles[0] * sx;
        panel.h = p.height / M.fieldTiles[1] * sx;
      } else {
        var pw = M.panelWmm + 2 * M.marginMm, ph = M.panelHmm + 2 * M.marginMm;
        panel.x = (p.left + p.width * M.marginMm / pw - c.left) * sx;
        panel.y = (p.top + p.height * M.marginMm / ph - c.top) * sx;
        panel.w = p.width * M.panelWmm / pw * sx;
        panel.h = p.height * M.panelHmm / ph * sx;
      }
      dirty = true;
    }

    function draw() {
      var S = M.shade, U = prog.U, L = state.light;
      var az = L.az * DEG, elv = L.el * DEG, ce = Math.cos(elv);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uPanelPx, panel.x, panel.y);
      gl.uniform2f(U.uPanelSize, panel.w, panel.h);
      gl.uniform2f(U.uDir, Math.cos(az), Math.sin(az));
      gl.uniform3f(U.uL, ce * Math.cos(az), ce * Math.sin(az), Math.sin(elv));
      gl.uniform1f(U.uTanEl, Math.tan(elv));
      gl.uniform1f(U.uExposure, S.flatLevel / (S.ambient + Math.sin(elv)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawn.az = L.az; drawn.el = L.el; dirty = false; state.frames++;
    }

    function setStatic() {
      var S = M.shade, U = prog.U;
      gl.useProgram(prog.p);
      gl.uniform1i(U.uNormal, 0);
      gl.uniform1i(U.uHeight, 1);
      gl.uniform2f(U.uPanelMm, M.panelWmm, M.panelHmm);
      gl.uniform1i(U.uField, M.layout === 'field' ? 1 : 0);
      gl.uniform1f(U.uBaseMm, M.baseMm);
      gl.uniform1f(U.uReliefMm, M.reliefMm);
      gl.uniform3f(U.uAlbedo, S.albedo[0] / 255, S.albedo[1] / 255, S.albedo[2] / 255);
      gl.uniform1f(U.uTanPen, Math.tan(S.penumbraDeg * DEG));
      gl.uniform1f(U.uDepth, CFG.depthScale);
      gl.uniform1f(U.uStrength, S.shadowStrength);
      gl.uniform1f(U.uStepPow, S.stepPow);
      gl.uniform1f(U.uAmbient, S.ambient);
      gl.uniform1f(U.uBounce, S.bounce);
      gl.uniform1f(U.uShoulder, S.shoulder);
      gl.uniform1f(U.uSpec, S.spec);
      gl.uniform1f(U.uSpecPow, S.specPow);
      gl.uniform1f(U.uAlbedoVar, S.albedoVar);
      gl.uniform1i(U.uSteps, steps);
    }

    function scrollProgress() {
      var r = el.getBoundingClientRect(), vh = window.innerHeight;
      return clamp01((vh - r.top) / (vh + r.height));
    }

    // An element that starts below the fold gets the whole dawn → noon → dusk arc. One already on
    // screen at load (a hero) starts from the poster's light and only sets, so nothing jumps.
    var p0 = 0;
    function scrollTarget() {
      var p = scrollProgress(), L = state.light;
      if (p0 > 0) {
        var t = clamp01((p - p0) / (1 - p0));
        L.tAz = lerp(M.shade.azDefault, CFG.sunAz[1], t);
        L.tEl = lerp(M.shade.elDefault, CFG.sunEl[0], t);
      } else {
        L.tAz = lerp(CFG.sunAz[0], CFG.sunAz[1], p);
        L.tEl = lerp(CFG.sunEl[0], CFG.sunEl[1], Math.sin(Math.PI * p));
      }
    }

    function enterIdle(now) {
      var L = state.light, a = CFG.idleAz, e = CFG.idleEl;
      state.idle = true; idleT0 = now;
      azPhase = Math.acos(Math.max(-1, Math.min(1, (L.az - (a[0] + a[1]) / 2) / ((a[1] - a[0]) / 2))));
      elPhase = Math.asin(Math.max(-1, Math.min(1, (L.el - (e[0] + e[1]) / 2) / ((e[1] - e[0]) / 2))));
    }

    function idleTarget(now) {
      var t = (now - idleT0) / 1000, a = CFG.idleAz, e = CFG.idleEl;
      state.light.tAz = (a[0] + a[1]) / 2 + ((a[1] - a[0]) / 2) * Math.cos(azPhase + Math.PI * t / CFG.idleArcS);
      state.light.tEl = (e[0] + e[1]) / 2 + ((e[1] - e[0]) / 2) * Math.sin(elPhase + 2 * Math.PI * t / CFG.idleElPeriodS);
    }

    function spring(x, v, target, dt) {
      var w = CFG.springW;
      v += (w * w * (target - x) - 2 * w * v) * dt;
      return [x + v * dt, v];
    }

    function tick(now) {
      if (!visible || !state.ready) { running = false; return; }
      var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      var L = state.light;
      if (mode === 'pointer' && !state.idle && now - lastPointer > CFG.idleDelayMs) enterIdle(now);
      if (state.idle) idleTarget(now);
      var a = spring(L.az, L.vAz, L.tAz, dt), e = spring(L.el, L.vEl, L.tEl, dt);
      L.az = a[0]; L.vAz = a[1]; L.el = e[0]; L.vEl = e[1];
      // 0.02° of light movement is invisible on the relief; stop drawing and sleep below that
      if (dirty || Math.abs(L.az - drawn.az) > 0.02 || Math.abs(L.el - drawn.el) > 0.01) draw();
      var settled = !state.idle && Math.abs(L.vAz) < 0.05 && Math.abs(L.vEl) < 0.05 &&
        Math.abs(L.tAz - L.az) < 0.02 && Math.abs(L.tEl - L.el) < 0.01;
      if (settled) { L.az = L.tAz; L.el = L.tEl; L.vAz = L.vEl = 0; if (Math.abs(L.az - drawn.az) > 0) draw(); running = false; return; }
      requestAnimationFrame(tick);
    }

    function wake() {
      if (running || !visible || !state.ready) return;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
    }

    function onPointer(e) {
      if (e.pointerType === 'touch' || !visible) return;
      var r = el.getBoundingClientRect();
      lastPointer = performance.now();
      state.idle = false;
      state.light.tAz = lerp(CFG.azLeft, CFG.azRight, clamp01((e.clientX - r.left) / r.width));
      state.light.tEl = lerp(CFG.elMax, CFG.elMin, clamp01((e.clientY - r.top) / r.height));
      clearTimeout(idleTimer);
      idleTimer = setTimeout(wake, CFG.idleDelayMs + 50);
      wake();
    }

    function onScroll() { if (visible) { scrollTarget(); wake(); } }

    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting && !document.hidden;
      if (visible) { if (mode === 'scroll' && M) scrollTarget(); wake(); }
    }).observe(el);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) visible = false;
      else { var r = el.getBoundingClientRect(); visible = r.bottom > 0 && r.top < window.innerHeight; wake(); }
    });
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      state.ready = false;
      canvas.classList.remove('is-on');   // fall back to the poster
    });

    fetch(base + 'manifest.json')
      .then(function (r) { if (!r.ok) throw new Error('relief-light: manifest ' + r.status); return r.json(); })
      .then(function (m) {
        M = m;
        M.panelWmm = m.panelWmm || m.panelMm;
        M.panelHmm = m.panelHmm || m.panelMm;
        M.layout = m.layout || 'panel';
        M.fieldTiles = m.fieldTiles || [1, 1];
        var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
        var pr = poster.getBoundingClientRect();
        var need = (M.layout === 'field' ? Math.max(pr.width / M.fieldTiles[0], pr.height / M.fieldTiles[1])
                                         : Math.max(pr.width, pr.height)) * dpr;   // texture keys = long side
        var sizes = Object.keys(m.textures).map(Number).sort(function (a, b) { return a - b; });
        var pick = sizes.filter(function (s) { return s >= need * 0.9; })[0] || sizes[sizes.length - 1];
        state.textures = m.textures[pick];
        state.light.az = state.light.tAz = m.shade.azDefault;
        state.light.el = state.light.tEl = m.shade.elDefault;
        return Promise.all([loadImage(base + m.textures[pick].normal), loadImage(base + m.textures[pick].height)]);
      })
      .then(function (imgs) {
        prog = program(gl);
        gl.bindVertexArray(gl.createVertexArray());
        texture(gl, imgs[0], 0, true, M.layout === 'field');
        texture(gl, imgs[1], 1, false, M.layout === 'field');
        setStatic();
        layout();
        draw();                                   // first frame = the poster's light
        state.ready = true;
        requestAnimationFrame(function () { canvas.classList.add('is-on'); });
        new ResizeObserver(function () { if (state.ready) { layout(); wake(); } }).observe(el);
        if (mode === 'pointer') {
          window.addEventListener('pointermove', onPointer, { passive: true });
          lastPointer = performance.now();
          idleTimer = setTimeout(wake, CFG.idleDelayMs + 50);
        } else {
          var pNow = scrollProgress();
          p0 = el.getBoundingClientRect().top < window.innerHeight && pNow < 1 ? pNow : 0;
          window.addEventListener('scroll', onScroll, { passive: true });
          scrollTarget();
        }
        wake();
        el.dispatchEvent(new CustomEvent('relieflight:ready', { detail: state }));
      })
      .catch(function (err) {
        console.warn(String(err && err.message || err) + ' — showing the poster');
        canvas.remove();
      });
    return state;
  }

  function init() {
    var els = document.querySelectorAll('[data-relief-light]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  window.ReliefLight = { mount: mount, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
