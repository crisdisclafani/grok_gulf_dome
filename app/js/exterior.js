import * as THREE from 'three';
import { canvasTex, ribNormal, boxUV, noiseTex } from './common.js';

export const G = 1.6; // compound ground level
export const shoreX = z => 70 + 18 * Math.sin(z / 140) + 8 * Math.sin(z / 53 + 1);
export const CAGES = [[360, -170], [410, -170], [360, -120], [410, -120], [360, -70], [410, -70]];
export const HERO_CAGE = new THREE.Vector3(410, 0, -120);
export const CAGE_R = 13;
const SUN = new THREE.Vector3(.55, .5, .67).normalize();

const SKY_GLSL = `
uniform vec3 uSun;
vec3 skyCol(vec3 d, float disk){
  float h=d.y;
  vec3 top=vec3(.13,.36,.76), hor=vec3(.70,.80,.86);
  vec3 c=mix(hor,top,pow(clamp(h,0.,1.),.5));
  c=mix(c,vec3(.80,.82,.82),smoothstep(0.,-.06,h));
  float s=max(dot(d,uSun),0.);
  c+=vec3(1.,.9,.75)*(pow(s,6.)*.2+disk*pow(s,1500.)*40.);
  return c;
}`;
const HAZE = new THREE.Color(.80, .82, .82);

function skyDome(disk) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN } },
    vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: SKY_GLSL + `varying vec3 vD; void main(){ gl_FragColor=vec4(skyCol(normalize(vD),${disk ? '1.' : '0.'}),1.); }`
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), m); s.frustumCulled = false; s.renderOrder = -10; return s;
}

export function buildExterior(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 900, 4200);
  scene.add(skyDome(true));
  // environment map from the same sky (no sun disk) for PBR reflections
  const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); es.add(skyDome(false));
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb9ab8f })); gnd.position.y = -1; es.add(gnd);
  scene.environment = pm.fromScene(es, 0.02).texture;

  scene.add(new THREE.HemisphereLight(0xcfe3f5, 0xd8c7a3, 0.55));
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.position.copy(SUN).multiplyScalar(400).add(new THREE.Vector3(-60, 0, -10));
  sun.target.position.set(-60, 0, -10); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 50, far: 900 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; sun.shadow.radius = 3;

  // ---------- terrain ----------
  const TS = 4000, SEG = 360;
  const tg = new THREE.PlaneGeometry(TS, TS, SEG, SEG).rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, col = new Float32Array(tp.count * 3);
  const sand = new THREE.Color('#efdcb4').convertSRGBToLinear(), wet = new THREE.Color('#cdb48a').convertSRGBToLinear(), grade = new THREE.Color('#ece3d0').convertSRGBToLinear(), dune = new THREE.Color('#f0d6a4').convertSRGBToLinear();
  const inCompound = (x, z) => x > -215 && x < 58 && z > -255 && z < 235;
  const c = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), d = shoreX(z) - x;
    let h = G * THREE.MathUtils.smoothstep(d, -6, 30) - 3.5 * (1 - THREE.MathUtils.smoothstep(d, -90, -2));
    const far = THREE.MathUtils.smoothstep(d, 120, 420);
    const dn = (Math.sin(x * .011 + z * .004) * Math.sin(z * .013 - x * .002) + .5 * Math.sin(x * .031 + 2) * Math.sin(z * .027)) * 6;
    if (!inCompound(x, z)) h += far * Math.max(-1, dn) * (z > -300 || x < -300 ? 1 : 1);
    tp.setY(i, h);
    c.copy(sand).lerp(dune, Math.max(0, dn / 8) * far);
    if (inCompound(x, z) && d > 8) c.copy(grade);
    c.lerp(wet, 1 - THREE.MathUtils.smoothstep(d, 0, 10));
    const v = .94 + .12 * (Math.sin(x * .07) * Math.sin(z * .05) * .5 + .5);
    col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.computeVertexNormals();
  const grain = noiseTex(256, 22, 250); grain.repeat.set(500, 500);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: .96, envMapIntensity: .4 }));
  terrain.receiveShadow = true; scene.add(terrain);

  // ---------- sea ----------
  const cageU = CAGES.map(([x, z]) => new THREE.Vector2(x, z));
  const water = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uCages: { value: cageU }, uCageR: { value: CAGE_R - .4 }, uHaze: { value: HAZE } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: SKY_GLSL + `
      uniform vec2 uCages[6]; uniform float uCageR; uniform vec3 uHaze; varying vec3 vW;
      float shoreX(float z){ return 70.+18.*sin(z/140.)+8.*sin(z/53.+1.); }
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      void main(){
        // Frozen gulf: every term is a function of world position. No time uniform,
        // and no cameraPosition, so the surface cannot ripple, foam, or shimmer.
        vec3 eye=vec3(-290.,175.,270.);
        vec3 V=eye-vW; float dist=length(V); V/=dist;
        vec2 p=vW.xz;
        vec3 N=vec3(0.,1.,0.);
        float d=vW.x-shoreX(vW.z);
        vec3 deep=vec3(.004,.07,.15), mid=vec3(.008,.22,.32), shal=vec3(.05,.55,.55), sandb=vec3(.42,.62,.50);
        vec3 base=mix(deep,mid,exp(-max(d,0.)/260.));
        base=mix(base,shal,exp(-max(d,0.)/40.));
        base=mix(base,sandb,exp(-max(d,0.)/7.)*.6);
        // net pens: greener water and static dark patches of the stock below
        for(int i=0;i<6;i++){ vec2 r=p-uCages[i]; float dc=length(r); float inside=smoothstep(uCageR,uCageR-.8,dc);
          float a=atan(r.y,r.x);
          float sh=smoothstep(.66,.9,vnoise(vec2(a*16.,dc*2.2+float(i)*7.)))*smoothstep(1.5,4.,dc);
          base=mix(base,mix(vec3(.02,.22,.24),vec3(.012,.11,.12),sh*.55),inside*.9); }
        float fr=.02+.98*pow(1.-max(dot(N,V),0.),5.);
        vec3 R=reflect(-V,N); R.y=abs(R.y);
        vec3 col=base*(.45+.55*max(dot(N,uSun),0.));
        col=mix(col,skyCol(R,0.)*.85,fr*.55);
        float sp=pow(max(dot(R,uSun),0.),120.);
        col+=vec3(1.,.95,.85)*(sp*.65+pow(max(dot(R,uSun),0.),24.)*.035);
        col=mix(col,uHaze,1.-exp(-dist*.00028));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  water.toneMapped = false; // composer OutputPass does tone mapping; keep linear here
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2), water);
  sea.position.set(1500, 0, 0); scene.add(sea);

  // ---------- materials ----------
  const rib = ribNormal(16);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: .5, metalness: .05, normalMap: rib, normalScale: new THREE.Vector2(.7, .7) });
  const wallPlain = new THREE.MeshStandardMaterial({ color: '#efebe2', roughness: .8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#dcdad4', roughness: .65, metalness: .1, normalMap: rib, normalScale: new THREE.Vector2(.4, .4) });
  const glass = new THREE.MeshStandardMaterial({ color: '#2a4658', roughness: .08, metalness: .7 });
  const grey = new THREE.MeshStandardMaterial({ color: '#c9c8c3', roughness: .6, metalness: .3 });
  const asphalt = new THREE.MeshStandardMaterial({ color: '#77777a', roughness: .9, map: noiseTex(128, 40, 230) }); asphalt.map.repeat.set(60, 60);
  const paving = new THREE.MeshStandardMaterial({ color: '#d4c8b0', roughness: .9 });
  const kerb = new THREE.MeshStandardMaterial({ color: '#e7c64e', roughness: .7 });
  const green = new THREE.MeshStandardMaterial({ color: '#61783c', roughness: .95, flatShading: true });
  const green2 = new THREE.MeshStandardMaterial({ color: '#7b8a45', roughness: .95, flatShading: true });
  const trunkM = new THREE.MeshStandardMaterial({ color: '#7b6650', roughness: .9 });
  const fabric = new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: .7, side: THREE.DoubleSide });
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };

  function shed(x, z, w, d, h, o = {}) {
    add(boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, 4), wallMat, x, G + h / 2, z);
    add(boxUV(new THREE.BoxGeometry(w + .8, .6, d + .8), w + .8, .6, d + .8, 4), roofMat, x, G + h + .3, z);
    // roof units
    const nu = Math.max(2, Math.round(w / 22));
    for (let i = 0; i < nu; i++) add(new THREE.BoxGeometry(3.2, 1.6, 2.4), grey, x - w / 2 + (i + .5) * w / nu, G + h + 1.4, z + (i % 2 ? d * .2 : -d * .2));
    if (o.windows) for (const lv of o.windows) for (const s of [1, -1]) add(new THREE.BoxGeometry(w * .86, 1.5, .3), glass, x, G + lv, z + s * (d / 2 + .05), false);
    if (o.doors) for (const dx of o.doors) add(new THREE.BoxGeometry(4.5, 5.2, .3), grey, x + dx, G + 2.6, z + d / 2 + .05, false);
  }
  // Phase 2 hatchery (sign as seen in the video)
  shed(-10, -95, 64, 70, 12, { doors: [-18, 6] });
  const sign = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#1f4f9c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#fff'; g.font = '700 96px Inter, Arial'; g.textAlign = 'center'; g.fillText('PHASE 2', w / 2, 110); g.font = '600 64px Inter, Arial'; g.fillText('HATCHERY BUILDING', w / 2, 200);
  });
  add(new THREE.PlaneGeometry(16, 4), new THREE.MeshStandardMaterial({ map: sign, roughness: .5 }), -10, G + 8.6, -59.8, false);
  // broodstock & grow-out halls
  shed(-5, 10, 70, 26, 10, { doors: [-25, 0, 25] });
  shed(-5, 42, 70, 26, 10, { doors: [-25, 0, 25] });
  // laboratories (window bands) & RAS building
  shed(-120, -110, 52, 60, 9, { windows: [2.4, 6.2] });
  shed(-115, 10, 42, 42, 11, { doors: [-8, 8] });
  // wave-roof building
  {
    const x = -110, z = 120, w = 60, d = 40, h = 7.5;
    add(boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, 4), wallPlain, x, G + h / 2, z);
    for (const s of [1, -1]) add(new THREE.BoxGeometry(w * .92, 4.5, .3), glass, x, G + 3.2, z + s * (d / 2 + .05), false);
    const rg = new THREE.PlaneGeometry(w + 6, d + 6, 120, 2).rotateX(-Math.PI / 2), rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) { const u = rp.getX(i) / (w + 6) + .5; rp.setY(i, 1.5 + 1.5 * Math.sin(u * Math.PI * 6 - Math.PI / 2) + rp.getZ(i) * .02); }
    rg.computeVertexNormals();
    const roof = add(rg, new THREE.MeshStandardMaterial({ color: '#f6f5f1', roughness: .4, side: THREE.DoubleSide }), x, G + h + .6, z);
    roof.receiveShadow = true;
  }
  // roads (asphalt, yellow kerbs)
  const road = (x, z, w, d) => { add(new THREE.BoxGeometry(w, .12, d), asphalt, x, G + .06, z, false); };
  road(-62, -10, 11, 470); road(-62 - 100, 180, 200 + 11, 11); road(-62 + 50, 180, 100, 11); road(-80, -150, 160, 11); road(-80, 75, 110, 11); road(30, -20, 10, 300);
  for (const s of [1, -1]) { add(new THREE.BoxGeometry(.4, .3, 470), kerb, -62 + s * 5.7, G + .15, -10, false); }
  // Visitor centre dome — concept geometry from the client's aerial render.
  // Entire plaza is inside the compound and inland of shoreX(20) = 82.56; no shed overlap.
  const domeX = -175, domeZ = 60;
  const domeWhite = new THREE.MeshStandardMaterial({ color: '#f8f8f5', roughness: .48, metalness: .03 });
  const domeRib = new THREE.MeshStandardMaterial({ color: '#deded9', roughness: .62, metalness: .04 });
  const plaza = add(new THREE.CircleGeometry(36, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d7d5cf', roughness: .9 }), domeX, G + .16, domeZ, false);
  plaza.scale.x = 1.08;
  const domeBase = add(new THREE.CylinderGeometry(25.5, 25.5, .45, 64), wallPlain, domeX, G + .38, domeZ);
  domeBase.scale.x = 1.08;
  const glassCurtain = add(new THREE.CylinderGeometry(24.4, 24.4, 5.4, 64, 1, true), glass, domeX, G + 3.05, domeZ, false);
  glassCurtain.scale.x = 1.06;
  const domeShell = add(new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), domeWhite, domeX, G + 5.6, domeZ);
  domeShell.scale.set(27, 12, 20);
  // Fine radial seams follow the flattened shell; 24 ribs, 10 segments each, stay light on phones.
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, points = [];
    for (let j = 0; j <= 10; j++) {
      const p = .045 + j / 10 * (Math.PI / 2 - .045);
      points.push(new THREE.Vector3(domeX + Math.cos(a) * Math.sin(p) * 27.08, G + 5.6 + Math.cos(p) * 12.08, domeZ + Math.sin(a) * Math.sin(p) * 20.08));
    }
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, .055, 4, false), domeRib);
    seam.receiveShadow = true; scene.add(seam);
  }
  const domeRim = add(new THREE.TorusGeometry(1, .012, 4, 64).rotateX(Math.PI / 2), domeWhite, domeX, G + 5.62, domeZ);
  domeRim.scale.set(27, 20, 1);
  const mullionG = new THREE.CylinderGeometry(.07, .07, 5.4, 5);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    add(mullionG, wallPlain, domeX + Math.cos(a) * 25.9, G + 3.05, domeZ + Math.sin(a) * 24.4, false);
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6, lx = domeX + Math.cos(a) * 34, lz = domeZ + Math.sin(a) * 31;
    add(new THREE.CylinderGeometry(.09, .12, 6.5, 6), grey, lx, G + 3.25, lz);
    add(new THREE.BoxGeometry(1.8, .12, .22), grey, lx, G + 6.5, lz, false);
  }
  // car-park shade canopies (tensile sails, as seen)
  add(new THREE.BoxGeometry(76, .1, 44), paving, -12, G + .05, 130, false);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) {
    const sx = -42 + k * 7.6, sz = 116 + r * 14;
    const sg = new THREE.PlaneGeometry(7.2, 6, 4, 4).rotateX(-Math.PI / 2), sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setY(i, sp.getZ(i) * .25 - Math.abs(sp.getX(i)) * .05);
    sg.computeVertexNormals();
    add(sg, fabric, sx, G + 3.4, sz);
    if (k % 3 === 0) add(new THREE.CylinderGeometry(.12, .12, 3.6, 6), grey, sx - 3.4, G + 1.8, sz + 2.8);
  }
  // entrance gate with wheel-wash pool (biosecurity)
  for (const s of [1, -1]) add(new THREE.BoxGeometry(1.6, 6, 1.6), wallPlain, -205, G + 3, 180 + s * 8);
  add(new THREE.BoxGeometry(2.4, 1.2, 19), wallPlain, -205, G + 6.4, 180);
  add(new THREE.BoxGeometry(4, 3.2, 4), wallPlain, -198, G + 1.6, 191);
  add(new THREE.BoxGeometry(9, .1, 9), new THREE.MeshStandardMaterial({ color: '#3a7f93', roughness: .08, metalness: .2 }), -190, G + .14, 180, false);
  // perimeter wall
  const wallP = (x, z, w, d) => add(new THREE.BoxGeometry(w, 2.4, d), wallPlain, x, G + 1.2, z);
  wallP(-215, -36, .5, 438); wallP(-215, 207, .5, 40 - 0);
  wallP(-78, -255, 274, .5); wallP(-78, 235, 274, .5);
  // landscaping: shrubs & small trees along the roads and buildings (no palms — not seen in the video)
  const shrubG = new THREE.IcosahedronGeometry(1, 1), crownG = new THREE.IcosahedronGeometry(1, 1), trunkG = new THREE.CylinderGeometry(.18, .25, 1, 5);
  const S = [], T = [];
  for (let z = -230; z < 220; z += 9) for (const s of [1, -1]) { if (Math.abs(z - 180) < 10 || Math.abs(z + 150) < 10 || Math.abs(z - 75) < 10) continue; (Math.abs(z) % 27 < 9 ? T : S).push([-62 + s * 8.5, z + Math.random() * 2]); }
  for (let x = -200; x < -70; x += 10) for (const s of [1, -1]) S.push([x, 180 + s * 8.5]);
  for (let i = 0; i < 70; i++) { const x = -40 + Math.random() * 80, z = -40 + Math.random() * 6; S.push([x, z - 5]); }
  for (let i = 0; i < 40; i++) T.push([-160 + Math.random() * 90, 60 + Math.random() * 10]);
  for (let i = 0; i < 30; i++) S.push([-150 + Math.random() * 70, 150 + Math.random() * 12]);
  // Keep the visitor dome's dedicated plot completely clear, including procedural landscaping.
  for (let i = T.length - 1; i >= 0; i--) if (Math.hypot(T[i][0] - domeX, T[i][1] - domeZ) < 44) T.splice(i, 1);
  for (let i = S.length - 1; i >= 0; i--) if (Math.hypot(S[i][0] - domeX, S[i][1] - domeZ) < 44) S.splice(i, 1);
  const dm = new THREE.Object3D();
  const shrubs = new THREE.InstancedMesh(shrubG, green, S.length);
  S.forEach(([x, z], i) => { dm.position.set(x, G + .9, z); dm.scale.set(1.6 + Math.random(), 1.1 + Math.random() * .5, 1.6 + Math.random()); dm.rotation.y = Math.random() * 6; dm.updateMatrix(); shrubs.setMatrixAt(i, dm.matrix); });
  const crowns = new THREE.InstancedMesh(crownG, green2, T.length), trunks = new THREE.InstancedMesh(trunkG, trunkM, T.length);
  T.forEach(([x, z], i) => { const s = 2.2 + Math.random() * 1.2; dm.position.set(x, G + 3 + s * .6, z); dm.scale.set(s, s * .8, s); dm.updateMatrix(); crowns.setMatrixAt(i, dm.matrix); dm.position.set(x, G + 1.6, z); dm.scale.set(1, 3.2, 1); dm.updateMatrix(); trunks.setMatrixAt(i, dm.matrix); });
  for (const m of [shrubs, crowns, trunks]) { m.castShadow = m.receiveShadow = true; scene.add(m); }

  // ---------- sea cages: HDPE double collar, handrail, net above water, square service platform, orange buoys ----------
  const hdpe = new THREE.MeshStandardMaterial({ color: '#e6e7e2', roughness: .7 }); // matte HDPE: no sparkling highlights on thin rails
  const collar = new THREE.MeshStandardMaterial({ color: '#2f6f80', roughness: .5 });
  const buoyM = new THREE.MeshStandardMaterial({ color: '#f07a24', roughness: .45 });
  const netTex = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,45,45,1)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); });
  netTex.repeat.set(220, 6); netTex.anisotropy = 16;
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide, roughness: .9 }); // alpha-blended through mipmaps: no alpha-test crawl
  const cageGroup = new THREE.Group(); scene.add(cageGroup);
  const tA = new THREE.TorusGeometry(CAGE_R, .32, 10, 96).rotateX(Math.PI / 2), tB = new THREE.TorusGeometry(CAGE_R + .7, .32, 10, 96).rotateX(Math.PI / 2), tC = new THREE.TorusGeometry(CAGE_R + .35, .09, 8, 128).rotateX(Math.PI / 2), tD = new THREE.TorusGeometry(CAGE_R - .45, .13, 8, 96).rotateX(Math.PI / 2);
  const postG = new THREE.CylinderGeometry(.08, .08, 1.1, 8), netG = new THREE.CylinderGeometry(CAGE_R + .3, CAGE_R + .3, 1.1, 96, 1, true);
  const cageMeshes = [];
  for (const [cx, cz] of CAGES) {
    const g = new THREE.Group(); g.position.set(cx, 0, cz);
    const m1 = new THREE.Mesh(tA, hdpe); m1.position.y = .15; const m2 = new THREE.Mesh(tB, hdpe); m2.position.y = .15;
    const m3 = new THREE.Mesh(tC, hdpe); m3.position.y = 1.2; const m4 = new THREE.Mesh(tD, collar); m4.position.y = .22;
    const net = new THREE.Mesh(netG, netMat); net.position.y = .65;
    g.add(m1, m2, m3, m4, net);
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, p = new THREE.Mesh(postG, hdpe); p.position.set(Math.cos(a) * (CAGE_R + .35), .7, Math.sin(a) * (CAGE_R + .35)); g.add(p); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4, b = new THREE.Mesh(new THREE.SphereGeometry(.65, 16, 12), buoyM); b.position.set(Math.cos(a) * (CAGE_R + 6), .2, Math.sin(a) * (CAGE_R + 6)); g.add(b); }
    cageGroup.add(g); cageMeshes.push(g);
  }
  // square service platform beside the pens
  const plat = new THREE.Group(); plat.position.set(455, 0, -120);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, .8, 14), new THREE.MeshStandardMaterial({ color: '#8d9497', roughness: .7 })); deck.position.y = .4;
  const house = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#f1f1ec', roughness: .5 })); house.position.set(-1.5, 2.4, 0);
  const hroof = new THREE.Mesh(new THREE.BoxGeometry(7.6, .3, 6.6), roofMat); hroof.position.set(-1.5, 4.1, 0);
  plat.add(deck, house, hroof); for (const ch of plat.children) ch.castShadow = true; scene.add(plat);

  const hotspots = [
    { id: 'hatch', pos: new THREE.Vector3(-10, G + 17, -95), key: 'hsHatch', sub: 'hsHatchS' },
    { id: 'brood', pos: new THREE.Vector3(-5, G + 15, 26), key: 'hsBrood', sub: 'hsBroodS' },
    { id: 'labs', pos: new THREE.Vector3(-120, G + 14, -110), key: 'hsLabs', sub: 'hsLabsS' },
    { id: 'ras', pos: new THREE.Vector3(-115, G + 16, 10), key: 'hsRas', sub: 'hsRasS' },
    { id: 'dome', pos: new THREE.Vector3(domeX, G + 17, domeZ), key: 'hsDome', sub: 'hsDomeS' },
    { id: 'cages', pos: new THREE.Vector3(385, 8, -120), key: 'hsCages', sub: 'hsCagesS' },
  ];
  const cageHotspots = [{ id: 'c03', pos: HERO_CAGE.clone().setY(6), key: 'hsC03', sub: 'hsC03S' }];

  function update() { /* exterior sea is time-invariant; nothing to advance */ }
  return { scene, update, hotspots, cageHotspots, exposure: 1.0, bloom: .18, bloomThreshold: .95, near: .5, far: 7000, sun };
}
