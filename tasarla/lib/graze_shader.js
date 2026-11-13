"use strict";

(() => {
  const VERT_SRC = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUV;
void main(){
  vec2 p = verts[gl_VertexID];
  gl_Position = vec4(p, 0.0, 1.0);
  vUV = (p + 1.0) * 0.5;
}`;

  // Exact GLSL port of graze.shade().
  const FRAG_SRC = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uHeightTex;
uniform ivec2 uTexSize;
uniform float uReliefMM;
uniform float uPxMM;
uniform float uAzDeg;
uniform float uElDeg;
uniform int   uNSteps;
uniform int   uDirectLight;
uniform float uAmbient;

const int MAX_STEPS = 600;

float heightMM(ivec2 texel) {
  texel = clamp(texel, ivec2(0), uTexSize - ivec2(1));
  vec4 c = texelFetch(uHeightTex, texel, 0);
  float r = floor(c.r * 255.0 + 0.5);
  float g = floor(c.g * 255.0 + 0.5);
  float v = r * 256.0 + g;
  return (v / 65535.0) * uReliefMM;
}

void main(){
  ivec2 texel = ivec2(
    vUV.x * float(uTexSize.x),
    (1.0 - vUV.y) * float(uTexSize.y)
  );
  texel = clamp(texel, ivec2(0), uTexSize - ivec2(1));

  if (uDirectLight == 0) {
    fragColor = vec4(vec3(uAmbient), 1.0);
    return;
  }

  float az = radians(uAzDeg);
  float el = radians(uElDeg);
  float lx = cos(el) * cos(az);
  float ly = cos(el) * sin(az);
  float lz = sin(el);

  float hereMM = heightMM(texel);
  float hR = heightMM(texel + ivec2(1, 0));
  float hL = heightMM(texel + ivec2(-1, 0));
  float hD = heightMM(texel + ivec2(0, 1));
  float hU = heightMM(texel + ivec2(0, -1));
  float gx = (hR - hL) * uPxMM * 0.5;
  float gy = (hD - hU) * uPxMM * 0.5;
  float nrm = sqrt(gx * gx + gy * gy + 1.0);
  float lam = clamp(
    (-gx * lx + gy * ly + lz) / nrm,
    0.0,
    1.0
  );

  float dCol = cos(az);
  float dRow = -sin(az);
  float stepMM = 1.0 / uPxMM;
  float accOccl = -1.0e9;
  for (int s = 1; s <= MAX_STEPS; s++) {
    if (s > uNSteps) break;
    vec2 sTexel = vec2(texel)
      + vec2(dCol, dRow) * float(s);
    if (
      sTexel.x < 0.0
      || sTexel.x >= float(uTexSize.x)
      || sTexel.y < 0.0
      || sTexel.y >= float(uTexSize.y)
    ) continue;
    float sampledMM = heightMM(ivec2(sTexel));
    float dMM = float(s) * stepMM;
    float rise = (sampledMM - hereMM) / max(dMM, 1e-6);
    accOccl = max(accOccl, rise);
  }

  float shadow = accOccl > tan(el) ? uAmbient : 1.0;
  lam *= shadow;
  fragColor = vec4(vec3(lam), 1.0);
}`;

  globalThis.SunStudioGrazeShader = Object.freeze({
    VERT_SRC,
    FRAG_SRC
  });
})();
