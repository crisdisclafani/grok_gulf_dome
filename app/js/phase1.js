import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ribNormal, shaftMaterial, pointsMaterial, driftPoints } from './common.js';
import {
  HALL, ROOMS, DIVIDERS, HANGING, nurseryTanks, weaningTanks, larvalTanks,
  blowers, incubators, LARVAL_FOCUS, PHASE1_APPROACH, assertPhase1Layout,
} from './phase1-layout.js';

export { PHASE1_APPROACH, LARVAL_FOCUS };
export const LARVAL_VIEW = { x: LARVAL_FOCUS.x, y: 1.9, z: 0.12 };

const VERT = `
varying vec3 vW;
void main(){
  #ifdef USE_INSTANCING
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vec4 w = modelMatrix * vec4(position, 1.0);
  #endif
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WATER_FRAG = `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uGlow;
varying vec3 vW;
void main(){
  vec2 p = vW.xz; float t = uTime;
  float rip = sin(p.x * 2.2 + t * 1.05) * cos(p.y * 1.8 - t * .8);
  vec2 g = vec2(
    cos(p.x * 3.1 + t * 1.2) + cos(p.x * 1.5 - p.y * 2.2 + t) * .5,
    sin(p.y * 2.8 - t * .9) + sin(p.x * 1.8 + p.y * 1.3 - t * 1.1) * .45
  ) * (0.034 + 0.014 * rip);
  vec3 N = normalize(vec3(g.x, 1.0, g.y));
  vec3 V = normalize(cameraPosition - vW);
  float nd = max(dot(N, V), 0.0);
  float fr = .04 + .96 * pow(1.0 - nd, 4.2);
  vec3 R = reflect(-V, N);
  float sp = pow(max(R.y, 0.0), 56.0);
  float ca = sin(p.x * 6.2 + t * 1.15) * sin(p.y * 5.4 - t * .9);
  ca += sin((p.x + p.y) * 2.2 + t * .6) * .55;
  ca = smoothstep(.05, .9, ca * .5 + .5);
  vec3 col = uDeep * (.62 + .28 * ca) + uGlow * ca * .35;
  col += vec3(.86, .94, 1.0) * sp * .9 + vec3(.55, .75, .95) * fr * .38;
  float fogD = smoothstep(18.0, 80.0, length(cameraPosition - vW));
  col = mix(col, vec3(.07, .15, .26), fogD * .8);
  gl_FragColor = vec4(col, mix(.62, .9, fr) * (1.0 - fogD * .2));
}`;

const CAUSTIC_FRAG = `
uniform float uTime; uniform vec3 uColor;
varying vec3 vW;
void main(){
  vec2 p = vW.xz + vW.y * vec2(.4, -.3); float t = uTime;
  float c = sin(p.x * 8.4 + t * 1.15) * sin(p.y * 7.2 - t * .8);
  c += sin(p.x * 3.1 + p.y * 2.4 + t * .7) * .65;
  float k = smoothstep(.15, .92, c * .5 + .5);
  vec3 col = uColor * (.55 + .45 * k) + vec3(.95, 1.0, .86) * k * .08;
  col = mix(col, vec3(.05, .12, .22), smoothstep(20.0, 78.0, length(cameraPosition - vW)));
  gl_FragColor = vec4(col, 1.0);
}`;

function cut(x0, x1, gaps) {
  let spans = [[x0, x1]];
  for (const [a, b] of gaps) {
    const next = [];
    for (const [s, e] of spans) {
      if (b <= s || a >= e) next.push([s, e]);
      else {
        if (a > s + 0.15) next.push([s, a]);
        if (e > b + 0.15) next.push([b, e]);
      }
    }
    spans = next;
  }
  return spans;
}

function plaque(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f6f8';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#b39257';
  g.lineWidth = 16;
  g.strokeRect(14, 14, 996, 228);
  g.fillStyle = '#0e3b5c';
  const size = text.length > 24 ? 58 : text.length > 16 ? 72 : 86;
  g.font = `600 ${size}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 512, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildPhase1(renderer, TIER) {
  assertPhase1Layout();
  const hi = TIER > 1;
  const scene = new THREE.Scene();
  const fogC = new THREE.Color(0x102843);
  scene.background = fogC.clone();
  scene.fog = new THREE.Fog(fogC, 18, 86);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.042).texture;
  pm.dispose();

  const rib = ribNormal(18);
  const shellM = new THREE.MeshStandardMaterial({ color: '#d5e0ea', roughness: .72, metalness: .02, normalMap: rib, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: .18 });
  const plasterM = new THREE.MeshStandardMaterial({ color: '#e7eef3', roughness: .78, metalness: 0, envMapIntensity: .12 });
  const floorM = new THREE.MeshStandardMaterial({ color: '#2c3c4c', roughness: .42, metalness: .08, envMapIntensity: .35 });
  const aisleM = new THREE.MeshStandardMaterial({ color: '#7f93a4', roughness: .14, metalness: .22, envMapIntensity: .85 });
  const publicM = new THREE.MeshStandardMaterial({ color: '#c4b7a4', roughness: .62, metalness: .02, envMapIntensity: .2 });
  const periM = new THREE.MeshStandardMaterial({ color: '#6d7e8c', roughness: .38, metalness: .08, envMapIntensity: .3 });
  const padM = new THREE.MeshStandardMaterial({ color: '#1b2833', roughness: .34, metalness: .18, envMapIntensity: .4 });
  const apronM = new THREE.MeshStandardMaterial({ color: '#b7c0c6', roughness: .8, metalness: 0 });
  const whiteM = new THREE.MeshStandardMaterial({ color: '#f4f7f8', roughness: .28, metalness: .14, envMapIntensity: .72 });
  const steelM = new THREE.MeshStandardMaterial({ color: '#d5dde4', roughness: .32, metalness: .72, envMapIntensity: .6 });
  const darkM = new THREE.MeshStandardMaterial({ color: '#24303a', roughness: .5, metalness: .4, envMapIntensity: .3 });
  const woodM = new THREE.MeshStandardMaterial({ color: '#d9cbb8', roughness: .62, metalness: 0, envMapIntensity: .15 });
  const algalM = new THREE.MeshStandardMaterial({ color: '#c5d4b4', roughness: .34, metalness: .08, envMapIntensity: .4 });
  const rotM = new THREE.MeshStandardMaterial({ color: '#c5d5d4', roughness: .32, metalness: .1, envMapIntensity: .42 });
  const glowM = new THREE.MeshStandardMaterial({ color: '#101820', emissive: '#e7eefc', emissiveIntensity: 2.6, roughness: .4 });
  const amberM = new THREE.MeshStandardMaterial({ color: '#2a1a08', emissive: '#ffb15a', emissiveIntensity: 2.2 });
  const coldM = new THREE.MeshStandardMaterial({ color: '#061820', emissive: '#7ee0ff', emissiveIntensity: 1.6 });
  const glassM = new THREE.MeshStandardMaterial({
    color: '#d7e8f2', roughness: .04, metalness: .08, transparent: true, opacity: .16,
    envMapIntensity: 1.15, depthWrite: false, side: THREE.DoubleSide,
  });
  glassM.polygonOffset = true; glassM.polygonOffsetFactor = -2; glassM.polygonOffsetUnits = -2;
  const dayM = new THREE.MeshBasicMaterial({ color: '#f6f1e6', side: THREE.DoubleSide });

  const bags = { shell: [], plaster: [], white: [], steel: [], dark: [], wood: [], glow: [], amber: [], cold: [], algal: [], rot: [], water: [], caustic: [], glass: [] };
  const putBox = (bag, w, h, d, x, y, z) => {
    if (w < 0.02 || h < 0.02 || d < 0.02) return;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    bags[bag].push(g);
  };
  const putFloor = (bag, w, d, x, y, z) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    bags[bag].push(g);
  };
  const putWall = (bag, w, h, x, y, z, ry = 0) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    bags[bag].push(g);
  };
  const putCyl = (bag, rTop, rBot, h, x, y, z, seg, open = false) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
    g.translate(x, y, z);
    bags[bag].push(g);
  };

  const H = HALL.h;
  const tW = 0.32;
  // Shell, with openings where the sheet shows the semi-open north wall and the two entrances.
  for (const [x0, x1] of cut(HALL.x0, HALL.x1, [[1.0, 16.4], [59.2, 63.8]])) {
    putBox('shell', x1 - x0, H, tW, (x0 + x1) / 2, H / 2, HALL.z1 - tW / 2);
  }
  for (const [x0, x1] of cut(HALL.x0, HALL.x1, [[63.2, 68.8]])) {
    putBox('shell', x1 - x0, H, tW, (x0 + x1) / 2, H / 2, HALL.z0 + tW / 2);
  }
  putBox('shell', tW, H, HALL.z1 - HALL.z0, HALL.x0 + tW / 2, H / 2, 0);
  putBox('shell', tW, H, HALL.z1 - HALL.z0, HALL.x1 - tW / 2, H / 2, 0);
  putBox('shell', HALL.x1 - HALL.x0, 0.16, HALL.z1 - HALL.z0, (HALL.x0 + HALL.x1) / 2, H - 0.08, 0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(HALL.x1 - HALL.x0, 0.06, HALL.z1 - HALL.z0), floorM);
  base.position.set((HALL.x0 + HALL.x1) / 2, 0.03, 0); scene.add(base);
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(102, 3.15).rotateX(-Math.PI / 2), aisleM);
  aisle.position.set(52, 0.045, 0); scene.add(aisle);
  const pub = new THREE.Mesh(new THREE.PlaneGeometry(18, 40).rotateX(-Math.PI / 2), publicM);
  pub.position.set(65.5, 0.05, 0); scene.add(pub);
  const peri = new THREE.Mesh(new THREE.PlaneGeometry(56, 3.5).rotateX(-Math.PI / 2), periM);
  peri.position.set(28, 0.048, -19.5); scene.add(peri);
  const larvalPad = new THREE.Mesh(new THREE.PlaneGeometry(22, 24).rotateX(-Math.PI / 2), padM);
  larvalPad.position.set(85, 0.042, 0); scene.add(larvalPad);
  const northPad = new THREE.Mesh(new THREE.PlaneGeometry(104, 5.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a4a58', roughness: .55, metalness: .06, envMapIntensity: .25 }));
  northPad.position.set(52, 0.04, 18.6); scene.add(northPad);

  // Section walls keep a low solid base and glass above, so the halls stay one lit volume.
  for (const x of DIVIDERS) {
    for (const z of [7.55, -7.55]) {
      putBox('plaster', 0.16, 1.15, 11.2, x, 0.58, z);
      putWall('glass', 11.2, H - 1.7, x, 1.15 + (H - 1.7) / 2, z, Math.PI / 2);
      putBox('steel', 0.05, 0.05, 11.2, x, 1.16, z);
    }
  }

  const rh = H - 0.35;
  for (const room of ROOMS) {
    if (room.kind !== 'room') continue;
    const { x, z, w, d } = room;
    const face = room.face || 's';
    const y = rh / 2;
    const wt = 0.09;
    const edges = ['w', 'e', 'n', 's'].filter(e => e !== face);
    if (face === 'w' || edges.includes('w')) {
      if (edges.includes('w')) putBox('plaster', wt, rh, d - wt * 2, x - w / 2 + wt / 2, y, z);
    }
    if (edges.includes('e')) putBox('plaster', wt, rh, d - wt * 2, x + w / 2 - wt / 2, y, z);
    if (edges.includes('n')) putBox('plaster', w - wt * 2, rh, wt, x, y, z + d / 2 - wt / 2);
    if (edges.includes('s')) putBox('plaster', w - wt * 2, rh, wt, x, y, z - d / 2 + wt / 2);
    // The face toward the hall is glass, unless the sheet's room is a closed store or plant room.
    const gz = face === 's' ? z - d / 2 + 0.04 : face === 'n' ? z + d / 2 - 0.04 : z;
    const gx = face === 'w' ? x - w / 2 + 0.04 : x;
    const gw = face === 'w' ? d - 0.3 : w - 0.28;
    const gy = room.solid ? 1.55 : rh / 2 + 0.05;
    const gh = room.solid ? 1.15 : rh - 0.45;
    const ry = face === 'w' ? Math.PI / 2 : 0;
    putWall('glass', gw, gh, face === 'w' ? gx : x, gy, face === 'w' ? z : gz, ry);
    putBox('steel', face === 'w' ? 0.04 : gw, 0.06, face === 'w' ? gw : 0.04, face === 'w' ? gx : x, (room.solid ? 1.55 : 0.2) + gh / 2, face === 'w' ? z : gz);
    if (!room.solid) putBox('steel', face === 'w' ? 0.04 : gw, 0.05, face === 'w' ? gw : 0.04, face === 'w' ? gx : x, 0.12, face === 'w' ? z : gz);
  }

  // Daylight beyond the semi-open wall and the two entrances. Not a drawing — a bright apron.
  putWall('glass', 15.2, H - 0.5, 8.7, H / 2, 21.05, 0);
  const northDay = new THREE.Mesh(new THREE.PlaneGeometry(16, H), dayM);
  northDay.position.set(8.7, H / 2, 22.15); scene.add(northDay);
  for (let i = 0; i < 7; i++) putBox('steel', 15.4, 0.06, 0.08, 8.7, 1.1 + i * 0.72, 21.22);
  putWall('glass', 2.05, 2.7, 60.35, 1.55, 21.12, 0);
  putWall('glass', 2.05, 2.7, 62.65, 1.55, 21.12, 0);
  putBox('steel', 0.08, 2.8, 0.08, 59.3, 1.5, 21.12);
  putBox('steel', 0.08, 2.8, 0.08, 63.7, 1.5, 21.12);
  const staffDay = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.2), dayM);
  staffDay.position.set(61.5, 2.2, 22.2); scene.add(staffDay);
  putWall('glass', 2.4, 2.85, 64.7, 1.6, -21.12, 0);
  putWall('glass', 2.4, 2.85, 67.3, 1.6, -21.12, 0);
  putBox('steel', 0.08, 3.0, 0.08, 63.4, 1.55, -21.12);
  putBox('steel', 0.08, 3.0, 0.08, 68.6, 1.55, -21.12);
  const mainDay = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.5), dayM);
  mainDay.position.set(66, 2.4, -22.35); scene.add(mainDay);
  putBox('steel', 11, 0.14, 3.6, 66, 3.72, -23.55);
  putBox('steel', 0.18, 3.72, 0.18, 61.2, 1.86, -24.9);
  putBox('steel', 0.18, 3.72, 0.18, 70.8, 1.86, -24.9);
  const apronS = new THREE.Mesh(new THREE.PlaneGeometry(16, 6).rotateX(-Math.PI / 2), apronM);
  apronS.position.set(66, 0.02, -24.2); scene.add(apronS);
  const apronN = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2).rotateX(-Math.PI / 2), apronM);
  apronN.position.set(61.5, 0.02, 22.8); scene.add(apronN);

  const NH = 1.18;
  const t = 0.075;
  for (const tank of nurseryTanks) {
    const zLo = tank.z - tank.hd, zHi = tank.z + tank.hd;
    const north = tank.bank === 'north';
    const zAisle = north ? zLo : zHi;
    const zFar = north ? zHi : zLo;
    const zStep = zAisle + (north ? 1.75 : -1.75);
    const bodyLen = Math.abs(zFar - zStep);
    const bodyZ = (zFar + zStep) / 2;
    const neckLen = 1.75;
    const neckZ = (zAisle + zStep) / 2;
    const neckW = 1.9;
    const xL = tank.x - tank.hw, xR = tank.x + tank.hw;
    putBox('white', t, NH, bodyLen - t, xL + t / 2, NH / 2, bodyZ);
    putBox('white', t, NH, bodyLen - t, xR - t / 2, NH / 2, bodyZ);
    putBox('white', tank.hw * 2, NH, t, tank.x, NH / 2, zFar + (north ? -t / 2 : t / 2));
    putBox('white', t, NH, neckLen - t, tank.x - neckW / 2, NH / 2, neckZ);
    putBox('white', t, NH, neckLen - t, tank.x + neckW / 2, NH / 2, neckZ);
    const shoulder = (tank.hw * 2 - neckW) / 2;
    putBox('white', shoulder, NH, t, tank.x - neckW / 2 - shoulder / 2, NH / 2, zStep);
    putBox('white', shoulder, NH, t, tank.x + neckW / 2 + shoulder / 2, NH / 2, zStep);
    putBox('steel', tank.hw * 2 - 0.1, 0.035, 0.08, tank.x, NH + 0.01, bodyZ);
    putFloor('water', tank.hw * 2 - 0.22, bodyLen - 0.2, tank.x, NH - 0.07, bodyZ);
    putFloor('water', neckW - 0.16, neckLen - 0.16, tank.x, NH - 0.07, neckZ);
    putFloor('caustic', tank.hw * 2 - 0.28, bodyLen - 0.25, tank.x, 0.06, bodyZ);
    putFloor('caustic', neckW - 0.2, neckLen - 0.2, tank.x, 0.06, neckZ);
  }

  for (const tank of weaningTanks) {
    const Hn = tank.h, y = Hn / 2;
    const L = tank.hw * 2, W = tank.hd * 2;
    putBox('white', t, Hn, W - t * 2, tank.x - tank.hw + t / 2, y, tank.z);
    putBox('white', t, Hn, W - t * 2, tank.x + tank.hw - t / 2, y, tank.z);
    putBox('white', L, Hn, t, tank.x, y, tank.z - tank.hd + t / 2);
    putBox('white', L, Hn, t, tank.x, y, tank.z + tank.hd - t / 2);
    putBox('steel', L - 0.12, 0.03, 0.05, tank.x, Hn + 0.01, tank.z);
    putFloor('water', L - 0.16, W - 0.16, tank.x, Hn - 0.06, tank.z);
    putFloor('caustic', L - 0.2, W - 0.2, tank.x, 0.055, tank.z);
  }

  // Round larval field — four columns by four rows, open aisle through the middle.
  const seg = hi ? 40 : 22;
  const LH = 1.42;
  const nL = larvalTanks.length;
  const outer = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, seg, 1, true), whiteM, nL);
  const inner = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, seg, 1, true), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.12, 0.42, 0.48) } },
    vertexShader: VERT, fragmentShader: CAUSTIC_FRAG,
  }), nL);
  const rims = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.028, 8, hi ? 36 : 20).rotateX(Math.PI / 2), steelM, nL);
  const discs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, hi ? 28 : 16).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    side: THREE.FrontSide, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.1, 0.38, 0.46) } },
    vertexShader: VERT, fragmentShader: CAUSTIC_FRAG,
  }), nL);
  const surf = new THREE.InstancedMesh(new THREE.CircleGeometry(1, hi ? 32 : 18).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(0.05, 0.28, 0.36) }, uGlow: { value: new THREE.Color(0.35, 0.78, 0.82) } },
    vertexShader: VERT, fragmentShader: WATER_FRAG,
  }), nL);
  surf.renderOrder = 3;
  const D = new THREE.Object3D();
  const stamp = (mesh, i, x, y, z, sx, sy, sz) => {
    D.position.set(x, y, z); D.rotation.set(0, 0, 0); D.scale.set(sx, sy, sz); D.updateMatrix(); mesh.setMatrixAt(i, D.matrix);
  };
  larvalTanks.forEach((tank, i) => {
    const r = tank.r;
    stamp(outer, i, tank.x, LH / 2, tank.z, r, LH, r);
    stamp(inner, i, tank.x, LH / 2, tank.z, r - 0.07, LH * 0.99, r - 0.07);
    stamp(rims, i, tank.x, LH, tank.z, r, r, r);
    stamp(discs, i, tank.x, 0.05, tank.z, r - 0.1, 1, r - 0.1);
    stamp(surf, i, tank.x, LH - 0.07, tank.z, r - 0.1, 1, r - 0.1);
  });
  for (const m of [outer, inner, rims, discs, surf]) {
    m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; scene.add(m);
  }
  for (const [x, z] of [[75.35, 12.05], [75.35, -12.05], [95.7, 12.05], [95.7, -12.05], [1.55, 12.3], [29.4, 12.3], [1.55, -12.3], [29.4, -12.3]]) {
    putBox('plaster', 0.36, H, 0.36, x, H / 2, z);
  }

  // Eight blowers, as noted in the AKVA blowers area.
  for (const b of blowers) {
    putBox('steel', 0.9, 0.1, 0.7, b.x, 0.08, b.z);
    putCyl('steel', 0.34, 0.36, 0.7, b.x, 0.5, b.z, hi ? 16 : 10);
    putBox('dark', 0.42, 0.36, 0.4, b.x - 0.15, 0.95, b.z);
    putCyl('amber', 0.045, 0.045, 0.04, b.x - 0.15, 1.2, b.z + 0.12, 8);
  }
  // Bench of 14 small vessels — the sheet's "14 X 5,00 Liters", not floor tanks.
  const bench = ROOMS.find(r => r.id === 'incubational');
  putBox('wood', bench.w - 0.7, 0.08, bench.d - 0.55, bench.x, 0.92, bench.z);
  putBox('wood', 0.08, 0.9, 0.08, bench.x - 1.4, 0.45, bench.z - 0.5);
  putBox('wood', 0.08, 0.9, 0.08, bench.x + 1.4, 0.45, bench.z - 0.5);
  for (const v of incubators) {
    putCyl('white', v.r, v.r * 0.92, 0.28, v.x, 1.1, v.z, hi ? 12 : 8);
    putFloor('water', v.r * 1.5, v.r * 1.5, v.x, 1.2, v.z);
  }

  // Furniture only inside rooms the sheet names. Anonymous circulation stays empty.
  const byId = id => ROOMS.find(r => r.id === id);
  const tables = [[78.6, 18.5], [81.2, 18.7], [83.8, 18.5], [80.0, 19.5]];
  for (const [x, z] of tables) {
    putCyl('wood', 0.55, 0.55, 0.04, x, 0.78, z, 16);
    putCyl('steel', 0.05, 0.06, 0.74, x, 0.4, z, 8);
  }
  putBox('wood', 3.2, 0.08, 0.7, 60.6, 0.95, -12.3);
  putBox('wood', 0.08, 0.9, 0.6, 59.2, 0.45, -12.3);
  putBox('wood', 0.08, 0.9, 0.6, 62.0, 0.45, -12.3);
  putBox('wood', 1.6, 0.42, 0.45, 71.2, 0.28, -12.4);
  putBox('wood', 1.4, 0.42, 0.42, 69.6, 0.28, -11.4);
  putBox('wood', 2.2, 0.9, 0.55, 71.2, 0.5, -19.6);
  putBox('wood', 1.5, 0.42, 0.4, 60.2, 0.28, -17.2);
  putBox('wood', 1.4, 0.42, 0.4, 65.2, 0.28, -17.4);
  putBox('wood', 1.4, 0.42, 0.4, 66.8, 0.28, -18.6);
  putBox('dark', 1.8, 0.08, 0.6, 71.0, 0.95, 12.6);
  putBox('dark', 0.9, 0.7, 0.04, 70.6, 1.45, 12.35);
  putBox('dark', 0.9, 0.7, 0.04, 71.6, 1.45, 12.35);
  putBox('glow', 0.7, 0.4, 0.02, 70.6, 1.45, 12.32);
  putBox('glow', 0.7, 0.4, 0.02, 71.6, 1.45, 12.32);
  const server = byId('server');
  for (let i = 0; i < 3; i++) {
    putBox('dark', 0.7, 2.0, 0.85, server.x - 1.1 + i * 1.05, 1.05, server.z + 0.6);
    putBox('amber', 0.5, 0.03, 0.02, server.x - 1.1 + i * 1.05, 1.7, server.z + 0.2);
  }
  for (const id of ['coldStore', 'deepFreeze']) {
    const r = byId(id);
    const zf = r.z + r.d / 2 - 0.08;
    putBox('steel', r.w * 0.55, 2.2, 0.08, r.x, 1.2, zf);
    putBox(id === 'deepFreeze' ? 'cold' : 'glow', r.w * 0.4, 0.04, 0.02, r.x, 0.35, zf + 0.05);
  }
  putBox('dark', 0.7, 1.1, 0.7, byId('garbage').x - 0.7, 0.55, byId('garbage').z);
  putBox('dark', 0.7, 0.9, 0.7, byId('garbage').x + 0.7, 0.45, byId('garbage').z);
  for (let i = 0; i < 3; i++) putBox('steel', 2.4, 0.06, 0.7, byId('storage').x, 0.6 + i * 0.55, byId('storage').z);
  putBox('wood', 1.6, 0.08, 0.6, byId('bioLab').x, 0.95, byId('bioLab').z);
  putBox('wood', 1.4, 0.08, 0.55, byId('security').x, 0.95, byId('security').z + 0.4);
  putBox('dark', 1.2, 1.6, 0.5, byId('eleRoom').x, 0.85, byId('eleRoom').z + 0.8);
  putBox('dark', 1.4, 1.5, 0.45, byId('emArea').x, 0.8, byId('emArea').z);
  putBox('dark', 1.3, 1.4, 0.4, byId('emRoom').x, 0.75, byId('emRoom').z);
  putBox('steel', 1.6, 1.2, 0.5, byId('maintenance').x, 0.65, byId('maintenance').z);
  putBox('wood', 1.3, 0.08, 0.6, byId('ichthyologists').x, 0.78, byId('ichthyologists').z);
  putBox('wood', 1.3, 0.08, 0.6, byId('hatcheryManager').x, 0.78, byId('hatcheryManager').z);
  putBox('dark', 1.6, 0.08, 0.55, byId('akvaControl').x, 0.95, byId('akvaControl').z - 1.2);
  putBox('glow', 1.1, 0.45, 0.03, byId('akvaControl').x, 1.35, byId('akvaControl').z - 0.9);
  putBox('plaster', 0.08, 1.3, 1.1, byId('wcMen').x, 0.7, byId('wcMen').z + 0.4);
  putBox('plaster', 0.08, 1.3, 1.1, byId('wcWomen').x, 0.7, byId('wcWomen').z + 0.4);
  // Algal and rotifer rooms: vertical columns, the shape drawn in those rooms.
  const columnsIn = (room, mat, n, radius, height) => {
    const x0 = room.x - room.w / 2 + 0.7, x1 = room.x + room.w / 2 - 0.7;
    for (let i = 0; i < n; i++) putCyl(mat, radius, radius, height, x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), height / 2, room.z, hi ? 16 : 10);
  };
  columnsIn(byId('algal'), 'algal', 4, 0.38, 2.15);
  columnsIn(byId('rotifer1'), 'rot', 3, 0.42, 2.0);
  columnsIn(byId('rotifer2'), 'rot', 3, 0.36, 1.85);
  // Artemia decapsulation: two round vessels in that room.
  const art = byId('artemia');
  for (const dx of [-1.5, 1.5]) {
    putCyl('white', 0.85, 0.88, 1.05, art.x + dx, 0.55, art.z, hi ? 20 : 12, true);
    putFloor('water', 1.5, 1.5, art.x + dx, 0.98, art.z);
  }
  const heat = byId('heatExchangers');
  for (const dz of [-2.2, 0, 2.2]) {
    const g = new THREE.CylinderGeometry(0.55, 0.55, 3.4, hi ? 18 : 12);
    g.rotateZ(Math.PI / 2); g.translate(heat.x, 1.15, heat.z + dz);
    bags.steel.push(g);
    putBox('steel', 2.6, 0.7, 0.4, heat.x, 0.4, heat.z + dz);
  }
  for (const [y, z, len, rad, x] of [[6.15, 2.6, 98, 0.11, 50], [5.35, -6.8, 64, 0.07, 34], [5.5, 6.4, 48, 0.07, 24]]) {
    const g = new THREE.CylinderGeometry(rad, rad, len, hi ? 12 : 8);
    g.rotateZ(Math.PI / 2); g.translate(x, y, z); bags.steel.push(g);
  }

  for (let i = 0; i < 28; i++) putBox('glow', 1.35, 0.045, 0.16, 4 + i * 3.15, 7.12, 0);
  for (const z of [-6.2, 6.2]) for (let i = 0; i < 8; i++) putBox('glow', 1.5, 0.04, 0.14, 76 + i * 2.35, 7.08, z);

  const signs = [];
  const hang = (text, x, y, z, ry, w = Math.min(4.4, Math.max(1.35, text.length * 0.13))) => {
    const mat = new THREE.MeshBasicMaterial({ map: plaque(text), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), mat);
    p.position.set(x, y, z); p.rotation.y = ry;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, w * 0.25 + 0.05, 0.03), steelM);
    frame.position.copy(p.position); frame.rotation.y = ry;
    scene.add(p, frame); signs.push(p);
  };
  for (const s of HANGING) hang(s.text, s.x, s.y, s.z, s.ry, s.text.length > 20 ? 4.6 : undefined);
  for (const room of ROOMS) {
    if (!room.sign || room.kind !== 'room') continue;
    const face = room.face || 's';
    let x = room.x, z = room.z, ry = 0;
    if (face === 's') { z = room.z - room.d / 2 - 0.08; ry = Math.PI; }
    else if (face === 'n') { z = room.z + room.d / 2 + 0.08; ry = 0; }
    else if (face === 'w') { x = room.x - room.w / 2 - 0.08; ry = Math.PI / 2; }
    const wide = Math.min(room.face === 'w' ? room.d - 0.4 : room.w - 0.35, room.sign.length > 16 ? 3.4 : 2.4);
    if (wide > 0.8) hang(room.sign, x, 2.15, z, ry, wide);
  }

  const mats = { shell: shellM, plaster: plasterM, white: whiteM, steel: steelM, dark: darkM, wood: woodM, glow: glowM, amber: amberM, cold: coldM, algal: algalM, rot: rotM, glass: glassM };
  for (const [name, list] of Object.entries(bags)) {
    if (!list.length || !mats[name]) continue;
    const g = mergeGeometries(list, false);
    list.forEach(item => item.dispose());
    const mesh = new THREE.Mesh(g, mats[name]);
    if (name === 'glass') mesh.renderOrder = 2;
    scene.add(mesh);
  }
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(0.42, 0.5, 0.1) }, uGlow: { value: new THREE.Color(0.72, 0.84, 0.28) } },
    vertexShader: VERT, fragmentShader: WATER_FRAG,
  });
  const causticMat = new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.55, 0.64, 0.18) } },
    vertexShader: VERT, fragmentShader: CAUSTIC_FRAG,
  });
  if (bags.water.length) {
    const g = mergeGeometries(bags.water, false); bags.water.forEach(item => item.dispose());
    const m = new THREE.Mesh(g, waterMat); m.renderOrder = 3; scene.add(m);
  }
  if (bags.caustic.length) {
    const g = mergeGeometries(bags.caustic, false); bags.caustic.forEach(item => item.dispose());
    scene.add(new THREE.Mesh(g, causticMat));
  }

  scene.add(new THREE.HemisphereLight(0xeef3f8, 0x314252, 0.95));
  scene.add(new THREE.AmbientLight(0xd5e0ea, 0.28));
  const lamps = [[16, 5.7, 0, 0xe7eef8, 18, 34], [48, 5.5, 0, 0xeef3fb, 14, 28], [66, 5.3, 0.2, 0xf6ead2, 12, 26], [66, 4.2, -15.5, 0xffe6c0, 18, 30], [85, 6.15, 0, 0xe4eeff, 20, 36], [9, 5.2, 16.5, 0xfff6e8, 14, 24]];
  for (const [x, y, z, c, intensity, dist] of lamps) {
    const L = new THREE.PointLight(c, intensity, dist, 2); L.position.set(x, y, z); scene.add(L);
  }
  const ray = shaftMaterial('#f3efe4', hi ? 0.07 : 0.05);
  const rayCool = shaftMaterial('#d5e4ff', hi ? 0.055 : 0.04);
  const addShaft = (mat, x, y, z, r0, r1, h) => {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 16, 1, true), mat);
    cone.position.set(x, y, z); scene.add(cone);
  };
  addShaft(ray, 66, 4.6, -16.5, 0.3, 1.8, 5.2);
  addShaft(ray, 8.5, 4.8, 16.2, 0.25, 1.6, 5.4);
  for (const x of hi ? [78, 85, 92] : [85]) addShaft(rayCool, x, 4.7, x % 2 ? 0.4 : -0.3, 0.2, 1.3, 5.0);

  const emitters = [
    ...nurseryTanks.map(t => ({ x: t.x, z: t.bank === 'north' ? t.z - t.hd + 1.1 : t.z + t.hd - 1.1, yMax: NH - 0.2, spread: 0.35 })),
    ...weaningTanks.map(t => ({ x: t.x, z: t.z, yMax: t.h - 0.16, spread: 0.35 })),
    ...larvalTanks.map(t => ({ x: t.x, z: t.z, yMax: LH - 0.16, spread: 0.45 })),
  ];
  const NB = hi ? 420 : 140;
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({
    color: '#e7f6ff', emissive: '#b7d4c8', emissiveIntensity: .4, roughness: .08, transparent: true, opacity: .48, depthWrite: false,
  }), NB);
  const B = [];
  for (let i = 0; i < NB; i++) {
    const e = emitters[i % emitters.length];
    const a = Math.random() * 6.2832, r = Math.random() * e.spread;
    B.push({ e, x: e.x + Math.cos(a) * r, z: e.z + Math.sin(a) * r, y: Math.random() * e.yMax, v: .2 + Math.random() * .26, s: .008 + Math.random() * .012, ph: Math.random() * 6 });
  }
  bub.frustumCulled = false; bub.renderOrder = 4; scene.add(bub);
  const dust = driftPoints(hi ? 640 : 200, new THREE.Vector3(40, 6, 16), pointsMaterial({ color: '#d5e2ff', size: 1.1, opacity: .32 }));
  scene.add(dust);

  // Tie the larval shaders to the same clock as the raceway water.
  const clocked = [waterMat, causticMat, inner.material, discs.material, surf.material, ray, rayCool];
  function update(dt, time, cam) {
    for (const m of clocked) m.uniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = time;
    dust.material.uniforms.uCam.value.copy(cam.position);
    for (let i = 0; i < NB; i++) {
      const b = B[i];
      const y = (b.y + time * b.v) % b.e.yMax;
      D.position.set(b.x + Math.sin(time * 2.2 + b.ph) * 0.02, 0.08 + y, b.z);
      D.rotation.set(0, 0, 0);
      D.scale.setScalar(b.s * (1 + y * 0.3));
      D.updateMatrix();
      bub.setMatrixAt(i, D.matrix);
    }
    bub.instanceMatrix.needsUpdate = true;
  }

  return {
    scene, update, exposure: 1.04, bloom: hi ? 0.4 : 0.28, bloomThreshold: 0.72, bloomRadius: 0.52,
    near: 0.06, far: 180,
    hotspots: [{ id: 'larval', pos: new THREE.Vector3(LARVAL_FOCUS.x, 2.45, LARVAL_FOCUS.z), key: 'hsLarval', sub: 'hsLarvalS' }],
    signs,
  };
}
