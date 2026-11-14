/* Age of Ultron-style JARVIS neural sphere v11.3 (speech-reactive core). Local three.js, no build step. */
(function(){
"use strict";
const canvas = document.getElementById("sphere");
if (!canvas) { console.error("sphere: missing canvas"); return; }
if (!window.THREE) { console.error("sphere: THREE not loaded"); return; }
const THREE = window.THREE;
const qs = new URLSearchParams(location.search);
const freezeT = qs.has("t") ? parseFloat(qs.get("t")) : null;

const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || matchMedia("(pointer:coarse)").matches;
const LOW = mobile || Math.min(canvas.clientWidth || 700, canvas.clientHeight || 700) < 480;
const DPR = Math.min(LOW ? 1.5 : 2, window.devicePixelRatio || 1);
function viewSize(){
  const r = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : canvas.getBoundingClientRect();
  const w = Math.max(160, Math.round(r.width || canvas.clientWidth || 700));
  const h = Math.max(160, Math.round(r.height || canvas.clientHeight || w));
  return { w: w, h: h };
}
const renderer = new THREE.WebGLRenderer({
  canvas, alpha: true, antialias: !LOW, premultipliedAlpha: false, powerPreference: LOW ? "low-power" : "high-performance"
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(DPR);
(function firstSize(){ const s=viewSize(); renderer.setSize(s.w, s.h, false); })();
if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
camera.position.set(0, 0.06, 5.0);
camera.lookAt(0, 0, 0);

const root = new THREE.Group();
scene.add(root);
const netGroup = new THREE.Group();
const ringGroup = new THREE.Group();
const sparkGroup = new THREE.Group();
root.add(netGroup);
root.add(ringGroup);
root.add(sparkGroup);

let _s = 20261114;
const rand = () => (_s = (_s * 16807) % 2147483647) / 2147483647;

const SPHERE_R = 0.62;

/* Film gold from Age of Ultron frames: pale yellow-gold, near-white highlights, honey mids, soft brown-gold edges. Not saturated orange. */
const COL_CORE = 0xfff7d8;  // near-white pale yellow
const COL_HOT  = 0xffefb8;  // cream-yellow highlight
const COL_GOLD = 0xf3d27a;  // yellow-gold mid, hue ~43
const COL_AMBER = 0xe0bc6a; // soft gold, not orange-brown
const COL_OUTER = 0xc9a456; // dim gold

function fibonacciSphere(n, r) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const j = 0.016;
    const x = Math.cos(theta) * radius + (rand() - 0.5) * j;
    const z = Math.sin(theta) * radius + (rand() - 0.5) * j;
    const yy = y + (rand() - 0.5) * j * 0.5;
    pts.push(new THREE.Vector3(x, yy, z).normalize().multiplyScalar(r));
  }
  return pts;
}
function ballPoints(n, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const rad = r * Math.pow(rand(), 0.55);
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    pts.push(new THREE.Vector3(
      rad * Math.sin(phi) * Math.cos(theta),
      rad * Math.cos(phi),
      rad * Math.sin(phi) * Math.sin(theta)
    ));
  }
  return pts;
}

const surface = fibonacciSphere(LOW ? 280 : 480, SPHERE_R);
const interior = ballPoints(LOW ? 50 : 80, SPHERE_R * 0.70);
const points = surface.concat(interior);
const nSurf = surface.length;

function knnEdges(pts, kSurf, kInt, maxDist) {
  const edges = [];
  const seen = new Set();
  const add = (a, b) => {
    if (a === b) return;
    const key = a < b ? a + "," + b : b + "," + a;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(a, b);
  };
  const tmp = [];
  const mdSurf = maxDist * maxDist;
  const mdInt = (maxDist * 0.85) * (maxDist * 0.85);
  for (let i = 0; i < pts.length; i++) {
    tmp.length = 0;
    const k = i < nSurf ? kSurf : kInt;
    const md = i < nSurf ? mdSurf : mdInt;
    const pi = pts[i];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = pi.distanceToSquared(pts[j]);
      if (d < md) tmp.push(d, j);
    }
    const pairs = [];
    for (let t = 0; t < tmp.length; t += 2) pairs.push([tmp[t], tmp[t + 1]]);
    pairs.sort((a, b) => a[0] - b[0]);
    const take = pairs.slice(0, k);
    for (let t = 0; t < take.length; t++) add(i, take[t][1]);
  }
  for (let i = nSurf; i < pts.length; i++) {
    const cand = [];
    for (let j = 0; j < nSurf; j++) cand.push([pts[i].distanceToSquared(pts[j]), j]);
    cand.sort((a, b) => a[0] - b[0]);
    add(i, cand[0][1]);
    if (cand[1]) add(i, cand[1][1]);
  }
  for (let n = 0; n < 24; n++) {
    const a = (rand() * pts.length) | 0;
    const b = (rand() * pts.length) | 0;
    if (pts[a].distanceTo(pts[b]) > SPHERE_R * 0.25 && pts[a].distanceTo(pts[b]) < SPHERE_R * 1.15) add(a, b);
  }
  return edges;
}

const edges = knnEdges(points, 5, 3, SPHERE_R * 0.33);

const linePos = new Float32Array(edges.length * 3);
const lineCol = new Float32Array(edges.length * 3);
const lineSeed = new Float32Array(edges.length);
const colNear = new THREE.Color(COL_HOT);
const colMid = new THREE.Color(COL_GOLD);
const colFar = new THREE.Color(COL_AMBER);
for (let e = 0; e < edges.length; e += 2) {
  const a = points[edges[e]], b = points[edges[e + 1]];
  const midR = (a.length() + b.length()) * 0.5;
  const inner = 1 - (midR / SPHERE_R);
  const c = colFar.clone().lerp(colMid, 0.62 + inner * 0.38).lerp(colNear, 0.12 + Math.max(0, inner) * 0.50);
  c.offsetHSL(0.035 + (rand() - 0.5) * 0.01, -0.10, 0.06 + (rand() - 0.5) * 0.04);
  for (let k = 0; k < 2; k++) {
    const p = k === 0 ? a : b;
    const i = (e + k) * 3;
    linePos[i] = p.x; linePos[i + 1] = p.y; linePos[i + 2] = p.z;
    lineCol[i] = c.r; lineCol[i + 1] = c.g; lineCol[i + 2] = c.b;
    lineSeed[e + k] = rand();
  }
}
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
lineGeo.setAttribute("seed", new THREE.BufferAttribute(lineSeed, 1));

const lineUniforms = { uTime: { value: 0 }, uAmp: { value: 0.2 }, uFlare: { value: 0 } };
const lineMat = new THREE.ShaderMaterial({
  uniforms: lineUniforms,
  vertexShader: [
    "attribute vec3 color;",
    "attribute float seed;",
    "varying vec3 vColor;",
    "uniform float uTime;",
    "uniform float uAmp;",
    "uniform float uFlare;",
    "void main(){",
    "  float pulse = 0.55 + 0.45 * sin(uTime * 3.2 + seed * 6.28318);",
    "  float travel = 0.5 + 0.5 * sin(uTime * 6.0 + seed * 20.0);",
    "  float inner = 1.0 - clamp(length(position) / 0.62, 0.0, 1.0);",
    "  float flick = step(0.55, fract(seed * 37.0 + floor(uTime * 14.0) * 0.618));",
    "  float lit = 0.80 + 0.12 * pulse + uAmp * (0.55 * travel + 0.25 * pulse + 0.35 * flick) + uFlare * (0.45 + 0.9 * inner);",
    "  vColor = min(color * lit, vec3(1.6));",
    "  float wobble = 1.0 + 0.012 * sin(uTime * 1.7 + seed * 6.28318) + 0.008 * sin(uTime * 0.85 + seed * 11.0);",
    "  vec3 pos = position * wobble;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "varying vec3 vColor;",
    "void main(){",
    "  gl_FragColor = vec4(vColor, 0.86);",
    "}"
  ].join("\n"),
  transparent: true,
  blending: THREE.NormalBlending,
  depthWrite: false,
  depthTest: true
});
netGroup.add(new THREE.LineSegments(lineGeo, lineMat));

const pPos = new Float32Array(points.length * 3);
const pCol = new Float32Array(points.length * 3);
const pSeed = new Float32Array(points.length);
for (let i = 0; i < points.length; i++) {
  const p = points[i];
  pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
  const d = p.length() / SPHERE_R;
  const c = new THREE.Color(COL_AMBER).lerp(new THREE.Color(COL_GOLD), 0.40 + (1 - d) * 0.40);
  c.lerp(new THREE.Color(COL_HOT), Math.max(0, (1 - d) * 0.50));
  c.offsetHSL(0.035, -0.10, 0.08);
  pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
  pSeed[i] = rand();
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute("seed", new THREE.BufferAttribute(pSeed, 1));

const ptC = document.createElement("canvas"); ptC.width = ptC.height = 64;
(function(){
  const x = ptC.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,248,230,1)");
  g.addColorStop(0.18, "rgba(255,239,184,0.95)");
  g.addColorStop(0.42, "rgba(243,210,122,0.50)");
  g.addColorStop(0.72, "rgba(201,164,86,0.10)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
})();
const ptTex = new THREE.CanvasTexture(ptC);

const pointUniforms = { uTime: { value: 0 }, uAmp: { value: 0.2 }, uFlare: { value: 0 }, uTex: { value: ptTex } };
const pointMat = new THREE.ShaderMaterial({
  uniforms: pointUniforms,
  vertexShader: [
    "attribute vec3 color;",
    "attribute float seed;",
    "varying vec3 vColor;",
    "uniform float uTime;",
    "uniform float uAmp;",
    "uniform float uFlare;",
    "void main(){",
    "  float pulse = 0.7 + 0.3 * sin(uTime * 4.0 + seed * 6.28318);",
    "  float flick = step(0.5, fract(seed * 53.0 + floor(uTime * 16.0) * 0.618));",
    "  float inner = 1.0 - clamp(length(position) / 0.62, 0.0, 1.0);",
    "  vColor = color * (0.85 + uAmp * (0.9 * pulse + 0.6 * flick) + uFlare * (0.5 + 1.1 * inner));",
    "  float wobble = 1.0 + 0.012 * sin(uTime * 1.7 + seed * 6.28318);",
    "  vec4 mv = modelViewMatrix * vec4(position * wobble, 1.0);",
    "  gl_PointSize = (7.0 + 4.0 * uAmp * pulse * (0.4 + 0.6 * flick) + 3.0 * uFlare * inner) * (5.0 / max(3.0, -mv.z));",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D uTex;",
    "varying vec3 vColor;",
    "void main(){",
    "  vec4 t = texture2D(uTex, gl_PointCoord);",
    "  if (t.a < 0.04) discard;",
    "  gl_FragColor = vec4(vColor * t.rgb, t.a);",
    "}"
  ].join("\n"),
  transparent: true,
  blending: THREE.NormalBlending,
  depthWrite: false
});
netGroup.add(new THREE.Points(pGeo, pointMat));

function glowSprite(stops, size) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  }));
  spr.scale.set(size, size, 1);
  return spr;
}
const bloom = glowSprite([
  [0, "rgba(255,236,200,0.22)"],
  [0.20, "rgba(228,184,136,0.10)"],
  [0.48, "rgba(196,150,106,0.04)"],
  [0.75, "rgba(142,90,60,0.012)"],
  [1, "rgba(0,0,0,0)"]
], 1.15);
const coreGlow = glowSprite([
  [0, "rgba(255,247,230,0.82)"],
  [0.12, "rgba(255,226,184,0.48)"],
  [0.32, "rgba(228,184,136,0.20)"],
  [0.60, "rgba(196,150,106,0.06)"],
  [1, "rgba(0,0,0,0)"]
], 0.62);
const coreHot = glowSprite([
  [0, "rgba(255,255,250,1)"],
  [0.14, "rgba(255,241,212,0.86)"],
  [0.36, "rgba(255,226,184,0.38)"],
  [0.65, "rgba(228,184,136,0.08)"],
  [1, "rgba(0,0,0,0)"]
], 0.22);
netGroup.add(bloom);
netGroup.add(coreGlow);
netGroup.add(coreHot);

function makeRing(radius, tiltX, tiltZ, ticks, speed, phase) {
  const g = new THREE.Group();
  g.rotation.x = tiltX;
  g.rotation.z = tiltZ;
  g.userData = { radius: radius, speed: speed, phase: phase, base: radius };

  const segs = 256;
  function circle(r, color, opacity) {
    const pos = new Float32Array((segs + 1) * 3);
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    g.add(line);
    return mat;
  }
  const loopMat = circle(radius, COL_GOLD, 0.72);
  circle(radius + 0.008, COL_AMBER, 0.22);

  const tickGeo = new THREE.BufferGeometry();
  const tpos = new Float32Array(ticks * 2 * 3);
  const tcol = new Float32Array(ticks * 2 * 3);
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2 + phase;
    const inner = radius - 0.006;
    const outer = radius + 0.012;
    tpos[i * 6] = Math.cos(a) * inner; tpos[i * 6 + 1] = 0; tpos[i * 6 + 2] = Math.sin(a) * inner;
    tpos[i * 6 + 3] = Math.cos(a) * outer; tpos[i * 6 + 4] = 0; tpos[i * 6 + 5] = Math.sin(a) * outer;
    const c = (i % 4 === 0) ? [1, 0.95, 0.62] : [1, 0.80, 0.22];
    for (let k = 0; k < 2; k++) {
      tcol[i * 6 + k * 3] = c[0]; tcol[i * 6 + k * 3 + 1] = c[1]; tcol[i * 6 + k * 3 + 2] = c[2];
    }
  }
  tickGeo.setAttribute("position", new THREE.BufferAttribute(tpos, 3));
  tickGeo.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
  const tickMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  g.add(new THREE.LineSegments(tickGeo, tickMat));

  const nNodes = 8 + (ticks % 5);
  const nPos = new Float32Array(nNodes * 3);
  const nOff = new Float32Array(nNodes);
  const nSpd = new Float32Array(nNodes);
  for (let i = 0; i < nNodes; i++) {
    nOff[i] = phase + (i / nNodes) * Math.PI * 2;
    nSpd[i] = (0.35 + rand() * 0.55) * (i % 2 === 0 ? 1 : -1);
    const a = nOff[i];
    nPos[i * 3] = Math.cos(a) * radius;
    nPos[i * 3 + 1] = 0;
    nPos[i * 3 + 2] = Math.sin(a) * radius;
  }
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute("position", new THREE.BufferAttribute(nPos, 3));
  const nMat = new THREE.PointsMaterial({
    map: ptTex,
    color: 0xfff6c8,
    size: 7,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false
  });
  g.add(new THREE.Points(nGeo, nMat));

  g.userData.loopMat = loopMat;
  g.userData.tickGeo = tickGeo;
  g.userData.tickCount = ticks;
  g.userData.tickMat = tickMat;
  g.userData.nodes = { geo: nGeo, n: nNodes, off: nOff, spd: nSpd, mat: nMat };
  ringGroup.add(g);
  return g;
}

const rings = [
  makeRing(0.76,  0.22,  0.10, 96,  0.18, 0.0),
  makeRing(0.88, -0.38, -0.08, 80, -0.13, 0.7),
  makeRing(1.00,  0.12,  0.32, 72,  0.09, 1.4),
  makeRing(1.10, -0.18, -0.22, 64, -0.21, 2.1)
];

const SPARK_N = LOW ? 70 : 120;
const sparkPos = new Float32Array(SPARK_N * 3);
const sparkSeed = new Float32Array(SPARK_N);
const sparkBase = [];
for (let i = 0; i < SPARK_N; i++) {
  const rad = SPHERE_R * (0.85 + rand() * 0.85);
  const theta = rand() * Math.PI * 2;
  const phi = Math.acos(2 * rand() - 1);
  const v = new THREE.Vector3(
    rad * Math.sin(phi) * Math.cos(theta),
    rad * Math.cos(phi),
    rad * Math.sin(phi) * Math.sin(theta)
  );
  sparkBase.push(v, 0.15 + rand() * 0.45, rand() * Math.PI * 2);
  sparkPos[i * 3] = v.x; sparkPos[i * 3 + 1] = v.y; sparkPos[i * 3 + 2] = v.z;
  sparkSeed[i] = rand();
}
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
const sparkMat = new THREE.PointsMaterial({
  map: ptTex,
  color: COL_HOT,
  size: 3,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: false
});
sparkGroup.add(new THREE.Points(sparkGeo, sparkMat));

const pulses = [];
function spawnPulse(amp) {
  if (pulses.length > 5) return;
  const segs = 160;
  const pos = new Float32Array((segs + 1) * 3);
  const r0 = 0.70;
  for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(a) * r0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: COL_HOT, transparent: true, opacity: 0.75 * amp,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const mesh = new THREE.Line(geo, mat);
  mesh.rotation.x = 0.18;
  ringGroup.add(mesh);
  pulses.push({ mesh: mesh, mat: mat, geo: geo, pos: pos, t: 0, r: r0, amp: amp });
}
let prevAmp = 0, lastPulse = 0;

function updateTicks(ring, amp, t) {
  const geo = ring.userData.tickGeo;
  const arr = geo.attributes.position.array;
  const n = ring.userData.tickCount;
  const radius = ring.userData.base;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ring.userData.phase;
    const shimmer = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.47 + t * 2.4));
    const ext = 0.008 + 0.010 * shimmer;
    const inner = radius - 0.005;
    const outer = radius + ext;
    arr[i * 6] = Math.cos(a) * inner; arr[i * 6 + 1] = 0; arr[i * 6 + 2] = Math.sin(a) * inner;
    arr[i * 6 + 3] = Math.cos(a) * outer; arr[i * 6 + 4] = 0; arr[i * 6 + 5] = Math.sin(a) * outer;
  }
  geo.attributes.position.needsUpdate = true;
  ring.userData.tickMat.opacity = 0.46;   // film: thin rings hold steady while he speaks
  ring.userData.loopMat.opacity = 0.56;
}

function speechEnvelope(t) {
  const word = Math.max(0, Math.sin(t * 5.2));
  const syll = Math.pow(Math.max(0, Math.sin(t * 17.0) * Math.sin(t * 13.3 + 1.2)), 1.4);
  const gap = (Math.sin(t * 1.7) + 1) / 2;
  const pause = gap > 0.18 ? 1 : 0.08;
  return Math.min(1, (0.28 + 0.72 * syll * word) * pause);
}

/* v11.3 voice driver. Film study (AoU lab + Ultron attack): the outer sphere and rings hold size and
   position while JARVIS talks; the reaction is light, not motion. So: real-time loudness from the app's
   WebAudio analyser (window.JARVIS_AUDIO.level) -> fast-attack envelope -> per-word onset flares that
   swell the core glow and brighten/flicker fragments. Outer net and thin rings stay steady. */
const testFlag = qs.has("amp") || qs.has("speak") || qs.has("demo");
function rawVoice(t) {
  const A = window.JARVIS_AUDIO;
  if (A && typeof A.level === "function") {
    let lv = +A.level(t);
    if (!isFinite(lv)) lv = 0;
    let sp;
    if (typeof A.speaking === "function") sp = !!A.speaking() || (testFlag && lv > 0.05);
    else sp = lv > 0.26;
    return { lv: lv, sp: sp };
  }
  if (qs.has("amp")) return { lv: Math.min(1, Math.max(0, parseFloat(qs.get("amp")) || 0.85)), sp: true };
  if (qs.has("speak")) return { lv: speechEnvelope(t), sp: true };
  return { lv: 0.16, sp: false };
}
const V = { env: 0, slow: 0, peak: 0.45, flare: 0, lastOn: -9, speak: 0, last: null };
function voiceStep(t) {
  const dt = V.last == null ? 0.016 : Math.min(0.1, Math.max(0.001, t - V.last));
  V.last = t;
  const r = rawVoice(t);
  let x = 0;
  if (r.sp) {
    V.peak = Math.max(0.32, Math.max(r.lv, V.peak - dt * 0.12));
    x = Math.max(0, Math.min(1, (r.lv - 0.10) / Math.max(0.2, V.peak - 0.10)));
  }
  const k = x > V.env ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.15);
  V.env += (x - V.env) * k;
  V.slow += (V.env - V.slow) * (1 - Math.exp(-dt / 0.32));
  if (r.sp && V.env - V.slow > 0.14 && t - V.lastOn > 0.11) {
    V.flare = Math.min(1, V.flare + 0.55 + 0.45 * V.env);
    V.lastOn = t;
  }
  V.flare *= Math.exp(-dt / 0.22);
  V.speak += ((r.sp ? 1 : 0) - V.speak) * (1 - Math.exp(-dt / 0.25));
  const idle = 0.16 + 0.05 * Math.sin(t * 0.8);
  const amp = Math.max(idle * (1 - V.speak), V.env);
  const F = Math.min(1, 0.55 * V.env + 0.65 * V.flare);
  return { amp: amp, flare: F, speak: V.speak };
}

const t0 = performance.now();
let hidden = document.hidden;
let needsResize = false;
function applySize(){
  const s = viewSize();
  const bw = renderer.domElement.width / Math.max(0.01, renderer.getPixelRatio());
  const bh = renderer.domElement.height / Math.max(0.01, renderer.getPixelRatio());
  if (Math.abs(bw - s.w) > 1 || Math.abs(bh - s.h) > 1) renderer.setSize(s.w, s.h, false);
}
if (window.ResizeObserver){
  try { new ResizeObserver(() => { needsResize = true; }).observe(canvas.parentElement || canvas); }
  catch (e) {}
}
addEventListener("resize", () => { needsResize = true; });
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  if (!hidden) requestAnimationFrame(frame);
});
function frame(now) {
  if (hidden) { window.JARVIS_SPHERE_READY = true; return; }
  if (needsResize) { needsResize = false; applySize(); }
  const t = (freezeT != null && !qs.has("demo")) ? freezeT : (now - t0) / 1000;
  const vs = voiceStep(t);
  const amp = vs.amp, F = vs.flare;

  lineUniforms.uTime.value = t;
  lineUniforms.uAmp.value = amp;
  lineUniforms.uFlare.value = F;
  pointUniforms.uFlare.value = F;
  pointUniforms.uTime.value = t;
  pointUniforms.uAmp.value = amp;

  if (freezeT == null || qs.has("demo")) {
    netGroup.rotation.y += 0.0034;
    netGroup.rotation.x = 0.16 + 0.04 * Math.sin(t * 0.35);
    netGroup.rotation.z = 0.04 * Math.sin(t * 0.22);
  } else {
    netGroup.rotation.y = freezeT * 0.32;
    netGroup.rotation.x = 0.18;
    netGroup.rotation.z = 0.05;
  }

  // Film: outer size stays constant; fragments shimmer/brighten with the voice. No whole-sphere balloon.
  bloom.scale.set(1.18, 1.18, 1);
  // Core flare: the inner glow swells and whitens on every word (sized to read at phone size), outer net fixed.
  bloom.material.opacity = 0.20 + 0.42 * F + 0.06 * vs.speak;
  const gs = 0.46 * (1 + 1.25 * F + 0.08 * vs.speak);
  coreGlow.scale.set(gs, gs, 1);
  const hs = 0.18 * (1 + 1.9 * F);
  coreHot.scale.set(hs, hs, 1);
  coreGlow.material.opacity = Math.min(1, 0.30 + 0.70 * F + 0.05 * vs.speak);
  coreHot.material.opacity = Math.min(1, 0.62 + 0.38 * Math.min(1, F * 1.4 + 0.15 * vs.speak));

  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (freezeT == null || qs.has("demo")) r.rotation.y += r.userData.speed * 0.016;
    else r.rotation.y = freezeT * r.userData.speed + i * 0.7;
    updateTicks(r, amp, t);
    const nd = r.userData.nodes;
    const arr = nd.geo.attributes.position.array;
    const tt = (freezeT != null && !qs.has("demo")) ? freezeT : t;
    for (let k = 0; k < nd.n; k++) {
      const a = nd.off[k] + tt * nd.spd[k];
      arr[k * 3] = Math.cos(a) * r.userData.base;
      arr[k * 3 + 1] = 0;
      arr[k * 3 + 2] = Math.sin(a) * r.userData.base;
    }
    nd.geo.attributes.position.needsUpdate = true;
    nd.mat.opacity = 0.72;
    nd.mat.size = 6.5;
  }

  const sparkArr = sparkGeo.attributes.position.array;
  for (let i = 0; i < SPARK_N; i++) {
    const v = sparkBase[i * 3];
    const spd = sparkBase[i * 3 + 1];
    const ph = sparkBase[i * 3 + 2];
    const tt = (freezeT != null && !qs.has("demo")) ? freezeT : t;
    const ang = tt * spd * 0.25;
    const wob = 1 + 0.03 * Math.sin(tt * 0.7 + ph);
    const x = v.x * Math.cos(ang) - v.z * Math.sin(ang);
    const z = v.x * Math.sin(ang) + v.z * Math.cos(ang);
    const y = v.y * wob + 0.02 * Math.sin(tt * 0.9 + ph * 2);
    sparkArr[i * 3] = x * wob;
    sparkArr[i * 3 + 1] = y;
    sparkArr[i * 3 + 2] = z * wob;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkMat.opacity = 0.38 + 0.45 * amp + 0.15 * F;
  sparkGroup.rotation.y = ((freezeT != null && !qs.has("demo")) ? freezeT : t) * 0.06;

  // v11.3: no expanding pulse rings (the film sphere never emits them); reaction lives in the core.
  prevAmp = amp;
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.t += 0.016;
    const rr = p.r + p.t * (0.55 + 0.4 * p.amp);
    const arr = p.pos;
    const n = arr.length / 3;
    for (let k = 0; k < n; k++) {
      const a = k / (n - 1) * Math.PI * 2;
      arr[k * 3] = Math.cos(a) * rr;
      arr[k * 3 + 2] = Math.sin(a) * rr;
    }
    p.geo.attributes.position.needsUpdate = true;
    p.mat.opacity = Math.max(0, 0.7 * p.amp * (1 - p.t / 1.1));
    if (p.t > 1.1) {
      ringGroup.remove(p.mesh);
      p.geo.dispose();
      p.mat.dispose();
      pulses.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  window.JARVIS_SPHERE_READY = true;
  window.JARVIS_SPHERE_AMP = amp;
  window.JARVIS_SPHERE_FLARE = F;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.JARVIS_SPHERE = { renderer: renderer, scene: scene, camera: camera };
})();
