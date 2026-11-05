import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural fish: body built from elliptical cross-sections, fins as shapes, one merged geometry.
// Model faces +x, length 1 (x from -0.5 tail-root to +0.5 nose), tail fin to x≈-0.72.
const PROFILES = {
  grouper: { H: [[0, .062], [.1, .068], [.3, .155], [.55, .2], [.75, .19], [.9, .135], [1, .045]], W: .58, yc: -.005, tail: 'round', dorsalSpines: true },
  bream:   { H: [[0, .05], [.1, .055], [.3, .19], [.5, .255], [.7, .235], [.88, .15], [1, .04]], W: .36, yc: 0, tail: 'fork', dorsalSpines: true },
};
function interp(pts, u) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i], [b, vb] = pts[i + 1];
    if (u <= b) { const t = (u - a) / (b - a); const s = t * t * (3 - 2 * t); return va + (vb - va) * s; }
  }
  return pts[pts.length - 1][1];
}
function setUV(g) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + .72) / 1.24; uv[i * 2 + 1] = .5 + p.getY(i) / .64; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export function fishGeometry(kind = 'grouper', detail = 1) {
  const P = PROFILES[kind];
  const N = Math.round(30 * detail), M = Math.round(20 * detail);
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = u - .5, H = interp(P.H, u), W = H * P.W * (u > .85 ? 1 - (u - .85) * 1.2 : 1);
    for (let j = 0; j <= M; j++) {
      const a = j / M * Math.PI * 2;
      const sy = Math.sin(a), y = P.yc + H * (sy > 0 ? sy * .95 : sy * 1.05);
      pos.push(x, y, W * Math.cos(a));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // nose cap
  const nose = pos.length / 3; pos.push(.515, P.yc, 0);
  for (let j = 0; j < M; j++) idx.push(N * (M + 1) + j, nose, N * (M + 1) + j + 1);
  let body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setIndex(idx);
  body.computeVertexNormals(); setUV(body);

  const parts = [body];
  const shapeGeo = (pts, z = 0) => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) s.lineTo(pts[k][0], pts[k][1]);
    const g = new THREE.ShapeGeometry(s, 6); g.translate(0, 0, z); return setUV(g);
  };
  // tail
  const tail = [];
  if (P.tail === 'round') { tail.push([-.47, .045]); for (let k = 0; k <= 12; k++) { const a = -.95 + 1.9 * k / 12; tail.push([-.5 - .2 * Math.cos(a * .9), .16 * Math.sin(a)].map((v, ii) => ii ? -v : v)); } tail.push([-.47, -.045]); }
  else { tail.push([-.47, .04], [-.62, .17], [-.74, .2], [-.64, .07], [-.6, 0], [-.64, -.07], [-.74, -.2], [-.62, -.17], [-.47, -.04]); }
  parts.push(shapeGeo(tail));
  // dorsal fin (spiny front, soft rear)
  const dors = [];
  const top = u => P.yc + interp(P.H, u) * .93;
  dors.push([.28 - .5, top(.28) - .01]);
  for (let k = 0; k <= 16; k++) { const u = .28 + .52 * k / 16, spike = (P.dorsalSpines && u < .58) ? (k % 2 ? .02 : -.01) : 0; dors.push([u - .5, top(u) + .085 * Math.sin(Math.min(1, (u - .28) / .52) * Math.PI * .92 + .15) + spike]); }
  dors.push([.8 - .5, top(.8) - .01]);
  parts.push(shapeGeo(dors));
  // anal fin
  const bot = u => P.yc - interp(P.H, u) * 1.0;
  const anal = [[.2 - .5, bot(.2) + .01]];
  for (let k = 0; k <= 8; k++) { const u = .2 + .22 * k / 8; anal.push([u - .5, bot(u) - .07 * Math.sin(k / 8 * Math.PI)]); }
  anal.push([.42 - .5, bot(.42) + .01]); parts.push(shapeGeo(anal));
  // pelvic fins
  const pel = [[.6 - .5, bot(.6) + .01], [.5 - .5, bot(.55) - .07], [.45 - .5, bot(.52) - .05], [.55 - .5, bot(.58) + .01]];
  parts.push(shapeGeo(pel));
  // pectoral fins (angled out to both sides)
  for (const s of [1, -1]) {
    const g = shapeGeo([[0, 0], [-.16, .05], [-.2, -.01], [-.15, -.06], [0, -.02]]);
    g.rotateX(s * 1.1); g.rotateY(s * -.5); g.translate(.2, P.yc - .02, s * interp(P.H, .7) * P.W * .9);
    setUV(g); parts.push(g);
  }
  for (const g of parts) { if (!g.index) continue; }
  const merged = mergeGeometries(parts.map(g => { const ng = g.index ? g : g; if (!ng.attributes.normal) ng.computeVertexNormals(); return ng; }), false);
  return merged;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// texture space: x = (posX+.72)/1.24 (tail left → nose right), y: top of canvas = dorsal
export function fishTexture(kind) {
  return canvasTex(1024, 512, (g, w, h) => {
    const X = x => (x + .72) / 1.24 * w, Y = y => (1 - (.5 + y / .64)) * h;
    if (kind === 'grouper') {
      const s = g.createLinearGradient(0, Y(.22), 0, Y(-.22));
      s.addColorStop(0, '#4c4234'); s.addColorStop(.35, '#7a6a50'); s.addColorStop(.62, '#a39274'); s.addColorStop(1, '#e2d6bd');
      g.fillStyle = s; g.fillRect(0, 0, w, h);
      // faint darker oblique bands
      g.globalAlpha = .22; g.fillStyle = '#2e281f';
      for (const bx of [-.3, -.12, .06, .22, .38]) { g.beginPath(); g.ellipse(X(bx), Y(.02), w * .03, h * .3, .15, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      // orange-brown spots everywhere (orange-spotted grouper)
      for (let i = 0; i < 1500; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 2.2 + Math.random() * 4.2;
        g.fillStyle = `rgba(${170 + Math.random() * 40|0},${88 + Math.random() * 30|0},${36 + Math.random() * 20|0},${.75 + Math.random() * .25})`;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      // pale blotches
      g.fillStyle = 'rgba(235,225,200,.18)';
      for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 10, 0, 7); g.fill(); }
      // gill line, mouth
      g.strokeStyle = 'rgba(40,32,24,.55)'; g.lineWidth = 4;
      g.beginPath(); g.arc(X(.22), Y(.0), h * .17, -1.1, 1.1); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(X(.5), Y(-.02)); g.lineTo(X(.4), Y(-.045)); g.stroke();
      // eye
      eye(g, X(.395), Y(.06), 13, '#c79a3e');
    } else {
      const s = g.createLinearGradient(0, Y(.26), 0, Y(-.26));
      s.addColorStop(0, '#4f5d66'); s.addColorStop(.3, '#93a0a6'); s.addColorStop(.55, '#d3d9da'); s.addColorStop(1, '#f6f7f4');
      g.fillStyle = s; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(70,80,90,.22)'; g.lineWidth = 2;
      for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(0, Y(.02 + k * .022)); g.lineTo(w, Y(.03 + k * .022)); g.stroke(); }
      g.fillStyle = 'rgba(40,45,55,.75)'; g.beginPath(); g.ellipse(X(.26), Y(.08), 14, 9, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(214,170,70,.9)'; g.fillRect(X(.425), Y(.16), 12, h * .17);
      eye(g, X(.4), Y(.05), 12, '#9aa3a8');
      g.strokeStyle = 'rgba(40,40,40,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(X(.25), Y(.0), h * .15, -1, 1); g.stroke();
    }
  });
}
function eye(g, x, y, r, iris) {
  g.fillStyle = iris; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(x, y, r * .62, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x - r * .25, y - r * .3, r * .2, 0, 7); g.fill();
}

// Material with GPU swim animation (body wave, stronger toward the tail). Needs aPhase instanced attribute.
export function fishMaterial(tex, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: opts.roughness ?? .5, metalness: opts.metalness ?? .08, side: THREE.DoubleSide });
  m.userData.uTime = { value: 0 }; m.userData.uSwim = { value: opts.swim ?? 7 }; m.userData.uAmp = { value: opts.amp ?? .055 };
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = m.userData.uTime; sh.uniforms.uSwim = m.userData.uSwim; sh.uniforms.uAmp = m.userData.uAmp;
    sh.vertexShader = 'attribute float aPhase;\nuniform float uTime;\nuniform float uSwim;\nuniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float tw = clamp(0.42 - position.x, 0.0, 1.2);
      transformed.z += sin(position.x * 6.5 - uTime * uSwim + aPhase) * uAmp * tw * tw * 1.8 + sin(uTime*uSwim*.5+aPhase)*0.008;`);
  };
  m.customProgramCacheKey = () => 'fishswim';
  return m;
}
export function fishInstances(geo, mat, count) {
  const g = geo.clone();
  const ph = new Float32Array(count); for (let i = 0; i < count; i++) ph[i] = Math.random() * 6.28;
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  const im = new THREE.InstancedMesh(g, mat, count);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  return im;
}

// Boids with a circular "cage current": fish circle the pen, keep separation, align with neighbours.
export class School {
  constructor(mesh, n, opts) {
    this.mesh = mesh; this.n = n; this.o = opts; this.p = []; this.v = []; this.s = [];
    const { R, y0, y1, center } = opts;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R * .9 + R * .08;
      this.p.push(new THREE.Vector3(center.x + Math.cos(a) * r, y0 + Math.random() * (y1 - y0), center.z + Math.sin(a) * r));
      const dir = opts.cw ? -1 : 1;
      this.v.push(new THREE.Vector3(-Math.sin(a) * dir, 0, Math.cos(a) * dir).multiplyScalar(opts.speed));
      this.s.push(opts.size * (.82 + Math.random() * .36));
    }
    this.hidden = -1; this.dummy = new THREE.Object3D(); this.tmp = new THREE.Vector3(); this.sep = new THREE.Vector3(); this.ali = new THREE.Vector3(); this.coh = new THREE.Vector3();
  }
  step(dt) {
    const { R, y0, y1, center, speed, cw } = this.o, n = this.n, P = this.p, V = this.v;
    const dir = cw ? -1 : 1, nr = this.o.neigh ?? 2.2, sr = this.o.sepR ?? .7;
    for (let i = 0; i < n; i++) {
      const p = P[i], v = V[i];
      this.sep.set(0, 0, 0); this.ali.set(0, 0, 0); this.coh.set(0, 0, 0); let c = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue; const q = P[j];
        const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < nr * nr) {
          c++; this.ali.add(V[j]); this.coh.add(q);
          if (d2 < sr * sr) { const k = 1 / (d2 + .02); this.sep.x += dx * k; this.sep.y += dy * k; this.sep.z += dz * k; }
        }
      }
      if (c) { this.ali.divideScalar(c).sub(v).multiplyScalar(.9); this.coh.divideScalar(c).sub(p).multiplyScalar(.25); v.addScaledVector(this.ali, dt).addScaledVector(this.coh, dt); }
      v.addScaledVector(this.sep, dt * .25 * speed);
      // circular current around the pen axis
      const rx = p.x - center.x, rz = p.z - center.z, r = Math.hypot(rx, rz) + 1e-4;
      const tx = -rz / r * dir, tz = rx / r * dir;
      v.x += (tx * speed - v.x) * dt * .35; v.z += (tz * speed - v.z) * dt * .35;
      if (r > R) { v.x -= rx / r * (r - R) * dt * 2.5; v.z -= rz / r * (r - R) * dt * 2.5; }
      if (r < R * .25) { v.x += rx / r * dt * .8; v.z += rz / r * dt * .8; }
      if (p.y > y1) v.y -= (p.y - y1) * dt * 2; if (p.y < y0) v.y += (y0 - p.y) * dt * 2;
      v.y *= (1 - dt * .8);
      const L = v.length(), want = speed * (.85 + .3 * ((i * 37 % 11) / 11));
      v.multiplyScalar(1 + (want / (L + 1e-4) - 1) * Math.min(1, dt * 1.5));
    }
    const A = this.avoid; if (A) for (let i = 0; i < n; i++) { if (i === this.exempt) continue; const p = P[i], dx = p.x - A.x, dy = p.y - A.y, dz = p.z - A.z, d2 = dx * dx + dy * dy + dz * dz, ar = this.avoidR || 2.4; if (d2 < ar * ar) { const d = Math.sqrt(d2) + 1e-3, k = (ar - d) / ar * 6 * dt; V[i].x += dx / d * k; V[i].y += dy / d * k * .6; V[i].z += dz / d * k; } }
    for (let i = 0; i < n; i++) P[i].addScaledVector(V[i], dt);
  }
  write() {
    const d = this.dummy;
    for (let i = 0; i < this.n; i++) {
      const v = this.v[i], L = v.length() + 1e-5;
      d.position.copy(this.p[i]);
      d.rotation.set(0, Math.atan2(-v.z, v.x), Math.asin(Math.max(-1, Math.min(1, v.y / L))), 'YZX');
      d.scale.setScalar(i === this.hidden ? 0 : this.s[i]);
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
