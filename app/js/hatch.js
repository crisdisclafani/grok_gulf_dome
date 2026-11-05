import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ribNormal, boxUV, shaftMaterial, pointsMaterial, driftPoints } from './common.js';

// Phase 2 hatchery: a long aisle between mixed circular tanks, raceways on one wall,
// and a seawater plant bay at the far end. Inspired by the hatchery plan, not a CAD extrude.
export const HERO_TANK = new THREE.Vector3();
const TH = 1.18;

export const HATCH_APPROACH = {
  dur: 6.15,
  desktop: {
    fov0: 50, fov1: 39,
    place: [-43.2, 4.05, 0.22], look: [-18, 1.35, 0.04],
    pts: [[-28, 3.15, -0.46], [-14, 2.72, 0.36], [-2.2, 2.62, -0.1]],
    tgts: [[-12, 1.2, 0.02], [2, 1.14, -0.32], [20, 1.06, -2.2]],
  },
  mobile: {
    fov0: 48, fov1: 44,
    place: [-43.2, 3.7, 0.16], look: [-16, 1.2, 0],
    pts: [[-28, 3.25, -0.32], [-14, 2.95, 0.22], [-4, 2.75, 0.04]],
    tgts: [[-10, 1.18, -0.05], [4, 1.12, -0.28], [18, 1.05, -1.35]],
  },
};

const VERT = `
varying vec3 vW; varying vec3 vTint;
void main(){
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #endif
  #ifdef USE_INSTANCING
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vec4 w = modelMatrix * vec4(position, 1.0);
  #endif
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

function shareTime(mat, src) { mat.uniforms.uTime = src.uniforms.uTime; return mat; }

function packRow(z, radii, { x0 = -38, gap = 0.8, pauseAfter = null, pause = 4.4 } = {}) {
  const out = [];
  let x = x0;
  radii.forEach((r, i) => {
    if (pauseAfter !== null && i === pauseAfter) x += pause;
    x += r;
    out.push({ x, z, r });
    x += r + gap;
  });
  return out;
}

function stadium(length, width) {
  const r = width / 2, hl = Math.max(0.001, (length - width) / 2);
  const s = new THREE.Shape();
  s.moveTo(-hl, -r);
  s.lineTo(hl, -r);
  s.absarc(hl, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hl, r);
  s.absarc(-hl, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return new THREE.ShapeGeometry(s, 8).rotateX(-Math.PI / 2);
}

function assertLayout(round, raceways) {
  for (let i = 0; i < round.length; i++) for (let j = i + 1; j < round.length; j++) {
    const d = Math.hypot(round[i].x - round[j].x, round[i].z - round[j].z);
    if (d < round[i].r + round[j].r + 0.42) throw new Error('hatch tank overlap');
  }
  for (const t of round) {
    if (t.x + t.r > 26.4) throw new Error('hatch tank enters the plant bay');
    if (Math.abs(t.z) - t.r < 2.5) throw new Error('hatch tank blocks the aisle');
  }
  for (const rw of raceways) for (const t of round) {
    const qx = Math.max(rw.x - rw.L / 2, Math.min(t.x, rw.x + rw.L / 2));
    const qz = Math.max(rw.z - rw.W / 2, Math.min(t.z, rw.z + rw.W / 2));
    if (Math.hypot(t.x - qx, t.z - qz) < t.r + 0.4) throw new Error('hatch raceway overlap');
  }
}

export function buildHatch(renderer, TIER) {
  const scene = new THREE.Scene();
  const fogC = new THREE.Color(0x102843);
  scene.background = fogC.clone();
  scene.fog = new THREE.Fog(fogC, 16, 78);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.045).texture;
  pm.dispose();

  const X0 = -46, X1 = 50, Z0 = -15.8, Z1 = 15.8, H = 7.7;
  const len = X1 - X0, wid = Z1 - Z0, cx = (X0 + X1) / 2;
  const rib = ribNormal(14);
  const wallM = new THREE.MeshStandardMaterial({ color: '#d7e2ec', roughness: .72, metalness: .02, normalMap: rib, normalScale: new THREE.Vector2(.45, .45), side: THREE.BackSide, envMapIntensity: .16 });
  const room = new THREE.Mesh(boxUV(new THREE.BoxGeometry(len, H, wid), len, H, wid, 3.2), wallM);
  room.position.set(cx, H / 2, 0); scene.add(room);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(len - .4, wid - .4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0d1b2c', roughness: .92, metalness: 0 }));
  ceil.position.set(cx, H - .08, 0); scene.add(ceil);
  const floorM = new THREE.MeshStandardMaterial({ color: '#2a3b4b', roughness: .58, metalness: .06, envMapIntensity: .28 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, wid).rotateX(-Math.PI / 2), floorM);
  floor.position.set(cx, .012, 0); scene.add(floor);
  const wet = new THREE.MeshStandardMaterial({ color: '#61788c', roughness: .34, metalness: .1, envMapIntensity: .32 });
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(70, 3.15).rotateX(-Math.PI / 2), wet);
  aisle.position.set(-6, .022, 0); scene.add(aisle);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 24).rotateX(-Math.PI / 2), wet);
  cross.position.set(6.1, .028, -1.2); scene.add(cross);
  const pad = new THREE.MeshStandardMaterial({ color: '#35485a', roughness: .46, metalness: .08, envMapIntensity: .3 });
  const southPad = new THREE.Mesh(new THREE.PlaneGeometry(66, 7.2).rotateX(-Math.PI / 2), pad);
  southPad.position.set(-8, .018, -6.6); scene.add(southPad);
  const northPad = new THREE.Mesh(new THREE.PlaneGeometry(64, 10.5).rotateX(-Math.PI / 2), pad);
  northPad.position.set(-8, .018, 8.2); scene.add(northPad);
  const bayPad = new THREE.Mesh(new THREE.PlaneGeometry(20, 26).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1b2833', roughness: .38, metalness: .22, envMapIntensity: .4 }));
  bayPad.position.set(39, .03, 0); scene.add(bayPad);
  const skirt = new THREE.MeshStandardMaterial({ color: '#1c2c3c', roughness: .8 });
  for (const z of [Z0 + .06, Z1 - .06]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(len, .72, .1), skirt); s.position.set(cx, .36, z); scene.add(s);
  }

  scene.add(new THREE.HemisphereLight(0x9eb6d4, 0x14202e, .42));
  const lamps = [[-30, 6.35, 0, 0xb7cef2, 9, 30], [-6, 6.35, 0, 0xc9daf8, 10, 32], [14, 5.6, -1.4, 0xd7e6ae, 7, 18], [39, 4.4, .4, 0x8ed4e2, 12, 26]];
  for (const [x, y, z, c, i, d] of lamps) {
    const L = new THREE.PointLight(c, i, d, 2); L.position.set(x, y, z); scene.add(L);
  }

  const south = packRow(-5.22, [1.55, 2.2, 1.65, 2.4, 1.7, 2.15, 1.6, 2.3, 1.75, 2.25, 1.85, 1.65], { pauseAfter: 9, pause: 4.3 });
  const north = packRow(5.28, [2.05, 1.6, 2.35, 1.7, 2.2, 1.55, 2.45, 1.75, 2.1, 2.05, 1.8, 1.65], { pauseAfter: 9, pause: 4.5 });
  const wall = packRow(11.62, [1.4, 1.65, 1.35, 1.7, 1.45, 1.6, 1.4, 1.75, 1.5, 1.55, 1.45, 1.35, 1.6, 1.4], { x0: -36.4, gap: .72, pauseAfter: 10, pause: 5.4 });
  const round = [...south, ...north, ...wall];
  south[9].hero = true;
  const raceways = [];
  const RW_L = 9, RW_W = 2.28, RW_H = 1.02;
  for (let i = 0, x = -34.6; i < 6; i++, x += RW_L + 1.18) raceways.push({ x: x + RW_L / 2, z: -12.45, L: RW_L, W: RW_W, h: RW_H });
  assertLayout(round, raceways);
  const hero = south[9];
  HERO_TANK.set(hero.x, 0, hero.z);

  const shell = new THREE.MeshStandardMaterial({ color: '#f4f7f8', roughness: .32, metalness: .08, envMapIntensity: .55 });
  const lip = new THREE.MeshStandardMaterial({ color: '#fbfcfd', roughness: .22, metalness: .18, envMapIntensity: .7 });
  const steel = new THREE.MeshStandardMaterial({ color: '#d5dde4', roughness: .32, metalness: .72, envMapIntensity: .6 });
  const steelD = new THREE.MeshStandardMaterial({ color: '#8b98a3', roughness: .4, metalness: .8, envMapIntensity: .45 });
  const amber = new THREE.MeshStandardMaterial({ color: '#2a1a08', emissive: '#ffb15a', emissiveIntensity: 2.4 });
  const ledM = new THREE.MeshStandardMaterial({ color: '#05070d', emissive: '#e7f1ff', emissiveIntensity: 3.4 });

  const waterM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(0.46, 0.52, 0.07) }, uGlow: { value: new THREE.Color(0.72, 0.82, 0.22) } },
    vertexShader: VERT,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uGlow; varying vec3 vW; varying vec3 vTint;
      void main(){
        vec2 p=vW.xz; float t=uTime;
        float rip=sin(p.x*2.4+t*1.05)*cos(p.y*2.1-t*.82);
        vec2 g=vec2(cos(p.x*3.2+t*1.25)+cos(p.x*1.6-p.y*2.5+t*.7)*.55, sin(p.y*3.1-t*.95)+sin(p.x*2.1+p.y*1.4-t*1.2)*.5)*(0.038+0.016*rip);
        vec3 N=normalize(vec3(g.x,1.,g.y)); vec3 V=normalize(cameraPosition-vW);
        float nd=max(dot(N,V),0.); float fr=.03+.97*pow(1.-nd,4.5);
        vec3 R=reflect(-V,N); float sp=pow(max(R.y,0.),64.);
        float ca=sin(p.x*8.+t*1.35)*sin(p.y*6.8-t*1.05); ca+=sin((p.x+p.y)*4.6+t*.75)*.55; ca=smoothstep(-.25,1.05,ca);
        vec3 col=uDeep*vTint*(.4+.42*ca)+uGlow*vTint*ca*.7;
        col+=vec3(.85,.94,1.)*sp*.95 + vec3(.55,.75,.95)*fr*.4;
        float fogD=smoothstep(16.,72.,length(cameraPosition-vW));
        col=mix(col,vec3(.07,.15,.27),fogD*.82);
        gl_FragColor=vec4(col, mix(.66,.92,fr)*(1.-fogD*.22)); }`
  });
  const causticM = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.62, 0.7, 0.16) } },
    vertexShader: VERT,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vW; varying vec3 vTint;
      void main(){
        vec2 p=vW.xz+vW.y*vec2(.55,-.35); float t=uTime;
        float c=sin(p.x*6.2+t*1.2)*sin(p.y*5.4-t*.85); c+=sin(p.x*12.+p.y*7.5+t*1.6)*.4;
        float k=smoothstep(-.2,1.,c);
        vec3 col=uColor*vTint*(.3+.75*k)+vec3(.95,1.,.78)*k*.16;
        col=mix(col,vec3(.05,.13,.24),smoothstep(18.,70.,length(cameraPosition-vW)));
        gl_FragColor=vec4(col,1.); }`
  });
  const causticFloor = shareTime(causticM.clone(), causticM);
  causticFloor.side = THREE.FrontSide;
  const intakeM = shareTime(waterM.clone(), waterM);
  intakeM.uniforms.uDeep.value.set(.015, .14, .24);
  intakeM.uniforms.uGlow.value.set(.2, .72, .82);
  const intakeFloor = shareTime(causticFloor.clone(), causticM);
  intakeFloor.uniforms.uColor.value.set(.04, .32, .4);

  const n = round.length;
  const tint = new THREE.Color();
  const D = new THREE.Object3D();
  function paint(mesh, i, t) {
    if (t.hero) tint.setRGB(1.15, 1.1, .7);
    else if ((i % 4) === 0) tint.setRGB(.82, .96, .78);
    else tint.setRGB(.98, 1, .74 + (i % 3) * .04);
    mesh.setColorAt(i, tint);
  }
  function stamp(mesh, i, x, y, z, sx, sy, sz) {
    D.position.set(x, y, z); D.rotation.set(0, 0, 0); D.scale.set(sx, sy ?? sx, sz ?? sx); D.updateMatrix(); mesh.setMatrixAt(i, D.matrix);
  }
  const outer = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), shell, n);
  const inner = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true), causticM, n);
  const rims = new THREE.InstancedMesh(new THREE.TorusGeometry(1, .034, 8, 40).rotateX(Math.PI / 2), lip, n);
  const bots = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), causticFloor, n);
  const surf = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), waterM, n);
  surf.renderOrder = 3;
  round.forEach((t, i) => {
    const rr = t.r - .06;
    stamp(outer, i, t.x, TH / 2, t.z, t.r, TH, t.r);
    stamp(inner, i, t.x, TH / 2, t.z, rr, TH * .99, rr);
    stamp(rims, i, t.x, TH, t.z, t.r, t.r, t.r);
    stamp(bots, i, t.x, .045, t.z, t.r - .08, 1, t.r - .08);
    stamp(surf, i, t.x, TH - .075, t.z, t.r - .09, 1, t.r - .09);
    paint(inner, i, t); paint(bots, i, t); paint(surf, i, t);
  });
  for (const m of [outer, inner, rims, bots, surf]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m); }

  // Raceways: elongated channels along the south wall, same water language, no extra program.
  const rwShell = racewayProto(shell, causticM, RW_L, RW_W, RW_H);
  for (const rw of raceways) { const g = rwShell.clone(); g.position.set(rw.x, 0, rw.z); scene.add(g); }
  const rwFloor = new THREE.InstancedMesh(stadium(RW_L - .22, RW_W - .2), causticFloor, raceways.length);
  const rwSurf = new THREE.InstancedMesh(stadium(RW_L - .28, RW_W - .26), waterM, raceways.length);
  rwSurf.renderOrder = 3;
  raceways.forEach((rw, i) => {
    stamp(rwFloor, i, rw.x, .05, rw.z, 1, 1, 1);
    stamp(rwSurf, i, rw.x, RW_H - .08, rw.z, 1, 1, 1);
    tint.setRGB(.78, .95, .8); rwSurf.setColorAt(i, tint);
  });
  for (const m of [rwFloor, rwSurf]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.frustumCulled = false; scene.add(m); }

  // Distribution headers and aeration drops.
  addPipe(scene, -6, 6.35, 3.15, 74, 'x', .16, steel);
  addPipe(scene, -6, 6.35, -8.6, 74, 'x', .16, steel);
  addPipe(scene, -8, 3.35, -5.22, 62, 'x', .055, steel);
  addPipe(scene, -8, 3.35, 5.28, 62, 'x', .055, steel);
  addPipe(scene, -8, 3.35, 11.62, 58, 'x', .05, steel);
  addPipe(scene, -4, 2.85, -12.45, 62, 'x', .06, steel);
  const drops = new THREE.InstancedMesh(new THREE.CylinderGeometry(.02, .02, 1, 6), steel, round.length);
  round.forEach((t, i) => stamp(drops, i, t.x, 2.26, t.z, 1, 2.2, 1));
  drops.instanceMatrix.needsUpdate = true; drops.frustumCulled = false; scene.add(drops);
  const collar = new THREE.InstancedMesh(new THREE.TorusGeometry(.085, .016, 6, 14).rotateX(Math.PI / 2), steel, n);
  round.forEach((t, i) => stamp(collar, i, t.x, TH - .03, t.z, 1, 1, 1));
  collar.instanceMatrix.needsUpdate = true; collar.frustumCulled = false; scene.add(collar);

  // Overhead LED runs and a few soft shafts — the aisle's leading lines.
  const ledGeo = new THREE.BoxGeometry(2.15, .05, .12);
  const ledCount = 30 * 3;
  const leds = new THREE.InstancedMesh(ledGeo, ledM, ledCount);
  let li = 0;
  for (const z of [0, -6.4, 6.5]) for (let k = 0; k < 30; k++) stamp(leds, li++, -40 + k * 2.35, 7.28, z, 1, 1, 1);
  leds.instanceMatrix.needsUpdate = true; leds.frustumCulled = false; scene.add(leds);
  const ray = shaftMaterial('#d5e4ff', .05);
  for (const x of [-30, -14, 2, 18]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.35, 1.7, 5.6, 20, 1, true), ray);
    cone.position.set(x, 4.55, x % 2 ? .7 : -.55); scene.add(cone);
  }

  const cols = new THREE.InstancedMesh(new THREE.BoxGeometry(.42, H, .42), new THREE.MeshStandardMaterial({ color: '#c5d2de', roughness: .6 }), 12);
  let ci = 0;
  for (const z of [-15.15, 15.15]) for (const x of [-36, -22, -8, 6, 20, 34]) stamp(cols, ci++, x, H / 2, z, 1, 1, 1);
  cols.instanceMatrix.needsUpdate = true; scene.add(cols);

  buildPlant(scene, { shell, steel, steelD, amber, intakeM, intakeFloor });

  // L3T6 — the filmed whiteboard, on the aisle side of the hero tank.
  const wbTex = new THREE.TextureLoader().load('whiteboard.jpg'); wbTex.colorSpace = THREE.SRGBColorSpace; wbTex.anisotropy = 8;
  const wb = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(.98, .82, .03), new THREE.MeshStandardMaterial({ color: '#d9dde0', roughness: .4, metalness: .6 }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(.92, .76), new THREE.MeshBasicMaterial({ map: wbTex, color: new THREE.Color(.72, .74, .76) })); board.position.z = .017;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, 1.35, 8), steel); post.position.y = -.95;
  wb.add(frame, board, post);
  wb.position.set(hero.x - hero.r - .85, 1.52, hero.z + .35);
  wb.rotation.y = -1.05;
  scene.add(wb);

  // Larvae: dense in L3T6, a living haze in the other round tanks. Raceways stay empty of stock.
  const NH = TIER > 1 ? 20000 : 8000, NO = TIER > 1 ? 280 : 100;
  const N = NH + NO * (round.length - 1);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), ctr = new Float32Array(N * 3), rad = new Float32Array(N);
  let k = 0;
  for (const t of round) {
    const count = t.hero ? NH : NO;
    for (let i = 0; i < count; i++, k++) {
      const a = Math.random() * 6.2832, r = Math.sqrt(Math.random()) * (t.r - .16);
      pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = .06 + Math.pow(Math.random(), .62) * (TH - .24); pos[k * 3 + 2] = Math.sin(a) * r;
      seed[k] = Math.random(); ctr[k * 3] = t.x; ctr[k * 3 + 1] = 0; ctr[k * 3 + 2] = t.z; rad[k] = t.r - .12;
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  lg.setAttribute('aC', new THREE.BufferAttribute(ctr, 3));
  lg.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
  const lm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 800 } },
    vertexShader: `uniform float uTime; uniform float uScale; attribute float aSeed; attribute vec3 aC; attribute float aRad; varying float vRot; varying float vA;
      void main(){ vec3 p=position; float a=uTime*(.05+aSeed*.06); float c=cos(a), s=sin(a); p.xz=mat2(c,-s,s,c)*p.xz;
        float r=length(p.xz); if(r>aRad) p.xz*=aRad/r;
        p+=vec3(sin(uTime*(2.+aSeed*3.)+aSeed*40.), sin(uTime*(1.5+aSeed*2.)+aSeed*17.)*.6, cos(uTime*(2.4+aSeed*2.)+aSeed*23.))*.012;
        vec4 mv=modelViewMatrix*vec4(p+aC,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(.012*uScale/-mv.z,1.,64.); vRot=aSeed*6.28+uTime*(aSeed-.5)*.8; vA=clamp(1.15-(-mv.z)/22.,0.,1.); }`,
    fragmentShader: `varying float vRot; varying float vA;
      void main(){ vec2 q=gl_PointCoord-.5; float c=cos(vRot), s=sin(vRot); q=mat2(c,-s,s,c)*q;
        float body=smoothstep(1.,.6,length(q*vec2(1.1,4.2))*2.);
        float eye=smoothstep(.09,.04,length(q-vec2(.3,0.)));
        float yolk=smoothstep(.13,.07,length((q-vec2(.12,0.))*vec2(1.,1.6)));
        float a=max(max(body*.8,eye),yolk*.9)*vA; if(a<.02) discard;
        vec3 col=mix(vec3(1.,1.,.94)*1.25,vec3(.55,.42,.12),yolk); col=mix(col,vec3(.02,.02,.02),eye);
        gl_FragColor=vec4(col,a); }`
  });
  const larvae = new THREE.Points(lg, lm); larvae.frustumCulled = false; larvae.renderOrder = 2; scene.add(larvae);

  const emitters = round.map(t => ({ x: t.x + t.r * .22, z: t.z - Math.sign(t.z || 1) * t.r * .18, yMax: TH - .16, spread: .2, along: 0 }));
  for (const rw of raceways) emitters.push({ x: rw.x, z: rw.z, yMax: RW_H - .14, spread: .45, along: RW_L * .7 });
  const NB = TIER > 1 ? 680 : 240;
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#e7f6ff', emissive: '#b7d98a', emissiveIntensity: .45, roughness: .08, transparent: true, opacity: .5, depthWrite: false }), NB);
  const B = [];
  for (let i = 0; i < NB; i++) {
    const e = emitters[i % emitters.length];
    const a = Math.random() * 6.2832, r = Math.random() * e.spread;
    B.push({ e, x: e.x + (e.along ? (Math.random() - .5) * e.along : Math.cos(a) * r), z: e.z + (e.along ? (Math.random() - .5) * e.spread : Math.sin(a) * r), y: Math.random() * e.yMax, v: .22 + Math.random() * .28, s: .008 + Math.random() * .012, ph: Math.random() * 6 });
  }
  bub.frustumCulled = false; bub.renderOrder = 4; scene.add(bub);
  const dust = driftPoints(TIER > 1 ? 1200 : 420, new THREE.Vector3(26, 6.5, 14), pointsMaterial({ color: '#c5d7ff', size: 1.15, opacity: .4 }));
  scene.add(dust);

  function update(dt, t, cam) {
    waterM.uniforms.uTime.value = t;
    causticM.uniforms.uTime.value = t;
    ray.uniforms.uTime.value = t;
    lm.uniforms.uTime.value = t;
    dust.material.uniforms.uTime.value = t;
    dust.material.uniforms.uCam.value.copy(cam.position);
    lm.uniforms.uScale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    for (let i = 0; i < NB; i++) {
      const b = B[i]; const y = (b.y + t * b.v) % b.e.yMax;
      D.position.set(b.x + Math.sin(t * 2.4 + b.ph) * .025, .08 + y, b.z);
      D.rotation.set(0, 0, 0); D.scale.setScalar(b.s * (1 + y * .35)); D.updateMatrix(); bub.setMatrixAt(i, D.matrix);
    }
    bub.instanceMatrix.needsUpdate = true;
  }
  return {
    scene, update, exposure: 1.02, bloom: .42, bloomThreshold: .74, bloomRadius: .55,
    near: .05, far: 220,
    hotspots: [{ id: 'l3t6', pos: new THREE.Vector3(hero.x, 2.35, hero.z), key: 'hsTank', sub: 'hsTankS' }],
  };
}

function addPipe(scene, x, y, z, length, axis, radius, mat) {
  const g = new THREE.CylinderGeometry(radius, radius, length, radius > .1 ? 16 : 8);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); scene.add(m); return m;
}

function racewayProto(shell, caustic, L, W, H) {
  const t = .07, body = L - W, g = new THREE.Group();
  const sideGeo = new THREE.BoxGeometry(body, H, t);
  const place = (geo, mat, x, y, z, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.y = rot; g.add(m); };
  place(sideGeo, shell, 0, H / 2, W / 2 - t / 2);
  place(sideGeo, shell, 0, H / 2, -W / 2 + t / 2);
  const cap = new THREE.CylinderGeometry(W / 2, W / 2, H, 22, 1, true, 0, Math.PI);
  const capIn = new THREE.CylinderGeometry(W / 2 - t, W / 2 - t, H * .99, 22, 1, true, 0, Math.PI);
  place(cap, shell, body / 2, H / 2, 0);
  place(cap, shell, -body / 2, H / 2, 0, Math.PI);
  place(capIn, caustic, body / 2, H / 2, 0);
  place(capIn, caustic, -body / 2, H / 2, 0, Math.PI);
  const inGeo = new THREE.BoxGeometry(body, H * .98, t * .8);
  place(inGeo, caustic, 0, H / 2, W / 2 - t * 1.7);
  place(inGeo, caustic, 0, H / 2, -(W / 2 - t * 1.7));
  return g;
}

function buildPlant(scene, M) {
  // Far-end mechanical bay: pumps, headers, and a seawater basin. No labels.
  const pit = new THREE.MeshStandardMaterial({ color: '#0c1924', roughness: .6, side: THREE.BackSide });
  const basin = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.1, 5.2), pit);
  basin.position.set(39.2, .2, -.4); scene.add(basin);
  const rimT = .16, rimY = .42, bw = 8.8, bd = 5.6;
  for (const [sx, sz, w, d] of [[bw, rimT, 0, bd / 2], [bw, rimT, 0, -bd / 2], [rimT, bd, bw / 2, 0], [rimT, bd, -bw / 2, 0]]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(sx, .12, sz), M.steelD);
    beam.position.set(39.2 + w, rimY, -.4 + d); scene.add(beam);
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 4.9).rotateX(-Math.PI / 2), M.intakeM);
  water.position.set(39.2, .28, -.4); water.renderOrder = 3; scene.add(water);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 4.9).rotateX(-Math.PI / 2), M.intakeFloor);
  glow.position.set(39.2, .06, -.4); scene.add(glow);

  const pump = (x, z, rot) => {
    const g = new THREE.Group();
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.1, .16, 1.15), M.steelD); skid.position.y = .08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.4, .44, 1.05, 18).rotateZ(Math.PI / 2), M.steel); body.position.set(.15, .62, 0);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(.78, .58, .58), new THREE.MeshStandardMaterial({ color: '#2c3844', roughness: .45, metalness: .5 })); motor.position.set(-.62, .64, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 8), M.amber); lamp.position.set(-.62, .98, .22);
    g.add(skid, body, motor, lamp); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  };
  pump(35.2, 3.6, .4); pump(41.6, 3.85, .2); pump(35.6, -4.7, -.5); pump(42.2, -4.9, -.2);

  const drumGeo = new THREE.CylinderGeometry(1.05, 1.05, 4.4, 28).rotateZ(Math.PI / 2);
  for (const z of [6.4, -7.1]) {
    const drum = new THREE.Mesh(drumGeo, M.steel); drum.position.set(34.2, 1.45, z); scene.add(drum);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(3.2, .9, .7), M.steelD); stand.position.set(34.2, .45, z); scene.add(stand);
  }
  for (const z of [2.2, -.8, -3.4]) addPipe(scene, 44.6, 3.2, z, 7.5, 'z', .11, M.steel);
  for (const y of [1.6, 2.5, 3.4]) addPipe(scene, 46.2, y, 0, 10, 'z', .08, M.steelD);
  addPipe(scene, 39.2, 2.4, 2.5, 3.6, 'y', .14, M.steel);
  addPipe(scene, 39.2, 4.6, 2.5, 6.2, 'z', .14, M.steel);
  // Aisle headers drop into the bay and run out over the basin.
  addPipe(scene, 31, 4.7, 3.15, 3.3, 'y', .16, M.steel);
  addPipe(scene, 31, 4.7, -8.6, 3.3, 'y', .16, M.steel);
  addPipe(scene, 36.2, 3.05, 3.15, 10.4, 'x', .14, M.steel);
  addPipe(scene, 36.2, 3.05, -8.6, 10.4, 'x', .14, M.steel);
  for (let i = 0; i < 5; i++) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(.16, .028, 6, 14), M.steel);
    valve.position.set(36.5 + i * .9, 1.7, 2.15); valve.rotation.y = Math.PI / 2; scene.add(valve);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(.28, 2.5, 3.4), new THREE.MeshStandardMaterial({ color: '#0c3344', emissive: '#166888', emissiveIntensity: .75, roughness: .4 }));
  gate.position.set(49.45, 1.9, -.4); scene.add(gate);
  const warm = new THREE.Mesh(new THREE.BoxGeometry(1.4, .06, .16), new THREE.MeshStandardMaterial({ color: '#1a1008', emissive: '#ffc48a', emissiveIntensity: 2.2 }));
  warm.position.set(40, 6.9, 4.5); scene.add(warm);
}
