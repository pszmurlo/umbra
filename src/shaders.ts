export const VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uProgress;
uniform float uImpact;
uniform float uMoonScale;
uniform float uZoom;
uniform float uPlate;
uniform float uReduced;

const float SUN_R = 0.14;
const float PI = 3.14159265359;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float limbNoise(vec2 dir) {
  return (fbm(dir * 7.5 + 3.1) - 0.5) * 0.0038
    + (fbm(dir * 19.0 + 8.0) - 0.5) * 0.0016;
}

float coronaField(vec2 p, float sunR, float t) {
  float r = length(p);
  float ang = atan(p.y, p.x);
  float lr = log(max(r, 0.0008));
  float drift = t * 0.014;
  vec2 ring = vec2(cos(ang), sin(ang));
  float stream = fbm(ring * 2.15 + vec2(lr * 3.2 + drift, 0.4));
  float fine = fbm(ring * 4.5 + vec2(1.4, lr * 5.6 - drift * 0.55));
  float veins = pow(max(1.0 - abs(stream - 0.52) * 3.4, 0.0), 4.0);
  float polar = 0.65 + 0.55 * pow(abs(sin(ang)), 0.45);
  float jets = pow(abs(cos(ang + 0.08)), 9.0) * 1.15;
  float shape = polar + jets;
  float envelope =
      exp(-max(r - sunR, 0.0) * 16.0) * 1.15
    + exp(-max(r - sunR, 0.0) * 4.8) * 0.38
    + exp(-max(r - sunR, 0.0) * 1.55) * 0.1;
  float body = pow(stream, 2.35) * 1.55 + pow(fine, 3.1) * 1.05 + veins * 2.2;
  return body * shape * envelope;
}

float prominences(vec2 p, float sunR) {
  float r = length(p);
  float ang = atan(p.y, p.x);
  float radial = exp(-pow((r - sunR * 1.045) * 70.0, 2.0));
  float a = exp(-pow((ang - 0.42) * 14.0, 2.0));
  float b = exp(-pow((ang + 1.92) * 11.0, 2.0));
  float c = exp(-pow((ang - 2.55) * 16.0, 2.0));
  return radial * (a * 1.1 + b * 0.75 + c * 0.9);
}

float starField(vec2 uv, float t) {
  float s = 0.0;
  vec2 p = uv * 38.0;
  vec2 gv = fract(p) - 0.5;
  vec2 id = floor(p);
  float n = hash21(id);
  float tw = 0.7 + 0.3 * sin(t * (1.3 + n * 4.0) + n * 20.0);
  s += exp(-dot(gv, gv) * mix(140.0, 420.0, n)) * step(0.94, n) * tw;
  vec2 p2 = uv * 17.0 + 4.2;
  gv = fract(p2) - 0.5;
  id = floor(p2);
  n = hash21(id + 9.1);
  s += exp(-dot(gv, gv) * 90.0) * step(0.97, n) * 1.4;
  return s;
}

float terrain(float x) {
  return -0.365
    + 0.055 * sin(x * 1.55 + 0.5)
    + 0.03 * sin(x * 3.6 + 1.2)
    + 0.016 * sin(x * 7.8 + 0.2)
    + 0.02 * fbm(vec2(x * 2.8, 2.4));
}

float observatory(vec2 uv) {
  vec2 c = vec2(0.46, terrain(0.46) + 0.012);
  float dome = length(uv - c) - 0.015;
  float slit = abs(uv.x - c.x) - 0.0016;
  float tower = max(abs(uv.x - c.x) - 0.011, c.y - 0.01 - uv.y);
  float d = min(max(dome, -slit), tower);
  return 1.0 - smoothstep(0.0, 0.0025, d);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 res = uResolution;
  vec2 uv = (frag - 0.5 * res) / res.y;
  uv /= max(uZoom, 0.35);
  uv.y += 0.03;

  float t = mix(0.0, uTime, 1.0 - uReduced);
  float sunR = SUN_R;
  float moonR = SUN_R * uMoonScale;
  float travel = SUN_R * 2.9;
  vec2 sun = vec2(0.0, 0.06);
  vec2 moon = sun + vec2((uProgress * 2.0 - 1.0) * travel, uImpact * sunR * 0.7);

  vec2 ps = uv - sun;
  vec2 pm = uv - moon;
  float rs = length(ps);
  float rm = length(pm);
  vec2 moonDir = pm / max(rm, 1e-5);
  float jagged = limbNoise(moonDir);
  float moonEdge = moonR + jagged;

  float sunDisk = 1.0 - smoothstep(sunR - 0.0009, sunR + 0.0009, rs);
  float moonDisk = 1.0 - smoothstep(moonEdge - 0.0012, moonEdge + 0.0012, rm);
  float photosphere = sunDisk * (1.0 - moonDisk);
  float covered = 1.0 - smoothstep(moonR - sunR - 0.002, moonR - sunR + 0.004, length(moon - sun));
  covered *= step(sunR, moonR);
  float annular = 1.0 - smoothstep(sunR - moonR - 0.002, sunR - moonR + 0.004, length(moon - sun));
  annular *= step(moonR, sunR);

  float coverAmt = clamp((sunR + moonR - length(moon - sun)) / (2.0 * sunR), 0.0, 1.0);
  float darkness = mix(coverAmt * 0.55, 1.0, covered);
  darkness = max(darkness, coverAmt * mix(0.35, 0.7, annular));

  float horizon = smoothstep(-0.08, -0.4, uv.y);
  vec3 dayZenith = vec3(0.62, 0.72, 0.86);
  vec3 dayHoriz = vec3(0.86, 0.82, 0.72);
  vec3 eerieZenith = vec3(0.22, 0.24, 0.2);
  vec3 eerieHoriz = vec3(0.38, 0.35, 0.26);
  vec3 nightZenith = vec3(0.008, 0.01, 0.028);
  vec3 nightHoriz = vec3(0.22, 0.08, 0.04);
  vec3 twilight = vec3(0.7, 0.28, 0.12);

  vec3 zenith = mix(mix(dayZenith, eerieZenith, coverAmt), nightZenith, covered);
  vec3 horiz = mix(mix(dayHoriz, eerieHoriz, coverAmt), nightHoriz, covered);
  vec3 sky = mix(zenith, horiz, pow(horizon, 1.6));
  sky += twilight * covered * pow(horizon, 5.0) * 0.45;

  float stars = starField(uv + vec2(0.02, 0.0), t) * mix(0.0, 1.0, pow(covered, 1.2));
  sky += vec3(0.85, 0.9, 1.0) * stars * (0.45 + 0.55 * (1.0 - uPlate));

  float limb = 1.0 - 0.62 * pow(clamp(rs / sunR, 0.0, 1.0), 1.65);
  vec3 sunCol = vec3(1.0, 0.94, 0.78) * limb;
  vec3 hdr = sky;

  float coronaVis = covered * (1.0 - uPlate) * (1.0 - moonDisk);
  float corona = coronaField(ps, sunR, t);
  vec3 innerC = vec3(1.0, 0.7, 0.32);
  vec3 midC = vec3(1.0, 0.86, 0.58);
  vec3 outerC = vec3(0.7, 0.8, 1.0);
  float rNorm = clamp((rs - sunR) / 0.42, 0.0, 1.0);
  vec3 coronaCol = mix(innerC, mix(midC, outerC, rNorm), smoothstep(0.0, 0.4, rNorm));
  hdr += coronaCol * corona * 2.2 * coronaVis;
  hdr += vec3(1.0, 0.74, 0.38) * exp(-max(rs - sunR, 0.0) * 32.0) * 2.4 * coronaVis;

  float chromo = smoothstep(sunR, sunR + 0.0015, rs) * (1.0 - smoothstep(sunR + 0.0015, sunR + 0.0065, rs));
  chromo *= (1.0 - moonDisk);
  float flash = (1.0 - covered) * smoothstep(0.012, 0.0, abs(length(moon - sun) - abs(moonR - sunR)));
  hdr += vec3(1.0, 0.22, 0.28) * chromo * (0.35 * coronaVis + 2.2 * flash * (1.0 - uPlate));
  hdr += vec3(1.0, 0.32, 0.45) * prominences(ps, sunR) * (coronaVis + flash * 0.6);

  float nearMoon = 1.0 - smoothstep(0.0, 0.007, abs(rm - moonEdge));
  float valley = smoothstep(0.42, 0.72, fbm(moonDir * 22.0 + 5.0));
  float beads = nearMoon * valley * sunDisk * (1.0 - covered);
  hdr += vec3(1.0, 0.92, 0.7) * beads * 9.0 * (1.0 - uPlate * 0.85);
  float diamond = beads * (1.0 - smoothstep(0.006, 0.0, abs(length(moon - sun) - abs(moonR - sunR))));
  hdr += vec3(1.0, 0.95, 0.85) * diamond * 14.0 * (1.0 - uPlate);

  hdr += sunCol * photosphere * mix(18.0, 2.2, uPlate);

  vec3 umbraCol = vec3(0.003, 0.004, 0.008);
  hdr = mix(hdr, umbraCol, moonDisk * (1.0 - photosphere));

  float groundY = terrain(uv.x);
  float ground = 1.0 - smoothstep(groundY, groundY + 0.004, uv.y);
  float farY = terrain(uv.x * 0.7 + 2.0) - 0.045;
  float far = (1.0 - smoothstep(farY, farY + 0.01, uv.y)) * (1.0 - ground);
  float bands = sin(uv.x * 52.0 + t * 9.0 + fbm(uv * 18.0) * 8.0);
  bands = bands * 0.5 + 0.5;
  float bandMix = flash * (1.0 - covered) * (1.0 - uPlate) * 0.35;

  vec3 farCol = mix(vec3(0.12, 0.11, 0.1), vec3(0.03, 0.025, 0.03), darkness);
  vec3 groundCol = mix(vec3(0.04, 0.035, 0.03), vec3(0.008, 0.007, 0.01), darkness);
  groundCol *= 1.0 + bandMix * bands;
  groundCol += vec3(0.55, 0.18, 0.06) * covered * (1.0 - uPlate) * smoothstep(groundY + 0.008, groundY, uv.y) * 0.55;
  hdr = mix(hdr, farCol, far * 0.85);
  hdr = mix(hdr, groundCol, ground);
  hdr = mix(hdr, vec3(0.012, 0.01, 0.014), observatory(uv) * ground);

  float glare = photosphere * (1.0 - uPlate);
  hdr += vec3(1.0, 0.96, 0.88) * glare * 6.0;
  float wash = smoothstep(0.02, 0.0, rs) * glare;
  hdr = mix(hdr, vec3(1.0, 0.97, 0.9), clamp(glare * 1.8 + wash, 0.0, 1.0) * 0.72);

  vec2 q = frag / res;
  float vig = 1.0 - 0.42 * pow(length((q - 0.5) * vec2(1.55, 1.1)), 2.1);

  vec3 plateTint = vec3(0.07, 0.12, 0.04);
  float scratches = pow(noise(vec2(uv.x * 22.0 + uv.y * 0.35, uv.y * 0.12)), 16.0) * 0.1;
  float dust = noise(uv * 36.0) * 0.025;
  vec3 plated = plateTint * (0.35 + 0.12 * vig);
  plated += sunCol * photosphere * vec3(1.35, 0.88, 0.22) * 4.2;
  plated += vec3(0.16, 0.18, 0.06) * scratches + dust * vec3(0.18, 0.2, 0.07);
  plated *= 0.9 + 0.1 * sin(rs * 28.0);
  hdr = mix(hdr, plated, uPlate);
  hdr *= vig;

  vec3 col = aces(hdr * 1.05);
  float grain = (hash21(frag + floor(t * 24.0) * 17.0) - 0.5) * mix(0.045, 0.02, uReduced);
  col += grain;
  col = pow(clamp(col, 0.0, 1.0), vec3(0.96));
  col.r += 0.002 * photosphere * (1.0 - uPlate);
  col.b -= 0.001 * photosphere * (1.0 - uPlate);

  fragColor = vec4(col, 1.0);
}
`;
