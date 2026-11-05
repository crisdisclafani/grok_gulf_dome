import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ribNormal, boxUV, shaftMaterial, pointsMaterial, driftPoints } from './common.js';
import { fishGeometry, fishTexture, fishMaterial, fishInstances } from './fish.js';

// Broodstock hall: white circular tanks under deep-blue light (as in the video). Photoperiod is a live control.
export function buildBrood(renderer, TIER) {
  const scene = new THREE.Scene();
  const fogC = new THREE.Color(0x0a2747);
  scene.background = fogC.clone(); scene.fog = new THREE.Fog(fogC, 14, 60);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  const W = 60, D = 30, H = 8;
  const rib = ribNormal(12);
  const wallM = new THREE.MeshStandardMaterial({ color: '#dfe7ef', roughness: .7, normalMap: rib, normalScale: new THREE.Vector2(.5, .5), side: THREE.BackSide, envMapIntensity: .15 });
  const room = new THREE.Mesh(boxUV(new THREE.BoxGeometry(W, H, D), W, H, D, 3), wallM); room.position.y = H / 2; scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4f6577', roughness: .22, metalness: 0, envMapIntensity: .35 }));
  floor.position.y = .01; scene.add(floor);
  const hemi = new THREE.HemisphereLight(0x7fa6e8, 0x0b2140, .55); scene.add(hemi);
  const duct = new THREE.MeshStandardMaterial({ color: '#c8d0d8', roughness: .3, metalness: .9, envMapIntensity: .6 });
  for (const z of [-11, 11]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, W, 20).rotateZ(Math.PI / 2), duct); c.position.set(0, 6.9, z); scene.add(c); }
  const pipeM = new THREE.MeshStandardMaterial({ color: '#e8ecef', roughness: .4, metalness: .2 });
  for (const z of [-13.5, 13.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, W, 8).rotateZ(Math.PI / 2), pipeM); c.position.set(0, 2.2, z); scene.add(c); }

  const tankW = new THREE.MeshStandardMaterial({ color: '#f3f6f8', roughness: .4, envMapIntensity: .4 });
  const tankIn = new THREE.MeshStandardMaterial({ color: '#2f6fb8', emissive: '#0b3f8a', emissiveIntensity: 1.1, roughness: .6, side: THREE.BackSide });
  const waterM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uLight: { value: 1 } },
    vertexShader: `varying vec3 vW; varying vec2 vUv; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform float uLight; varying vec3 vW; varying vec2 vUv;
      void main(){ vec2 p=vW.xz; float t=uTime;
        vec2 g=vec2(cos(p.x*5.+t*1.3)+cos(p.x*3.1-p.y*4.+t)*.7, sin(p.y*5.5-t*1.1)+sin(p.x*4.+p.y*2.-t*1.4)*.6)*.06;
        vec3 N=normalize(vec3(g.x,1.,g.y)); vec3 V=normalize(cameraPosition-vW);
        float fr=.03+.97*pow(1.-max(dot(N,V),0.),5.);
        vec3 R=reflect(-V,N); float sp=pow(max(R.y,0.),40.)*smoothstep(.2,1.,sin(p.x*9.+t*.8)*sin(p.y*8.-t*.6)+.6);
        vec3 c=vec3(.02,.16,.42)*(.4+.6*uLight);
        c+=vec3(.55,.75,1.)*sp*1.2*uLight + vec3(.4,.6,.9)*fr*.6*uLight;
        gl_FragColor=vec4(c,.42+fr*.4); }`
  });
  const TANKS = [];
  for (const x of [-16, -4, 8]) for (const z of [-6, 6]) TANKS.push(new THREE.Vector3(x, 0, z));
  const R = 3.2, TH = 1.4;
  const outer = new THREE.CylinderGeometry(R, R, TH, 64, 1, true), inner = new THREE.CylinderGeometry(R - .08, R - .08, TH, 64, 1, true), rim = new THREE.TorusGeometry(R - .04, .07, 8, 64).rotateX(Math.PI / 2);
  const bottom = new THREE.CircleGeometry(R - .08, 48).rotateX(-Math.PI / 2), surf = new THREE.CircleGeometry(R - .09, 64).rotateX(-Math.PI / 2);
  const lights = [], leds = [], rays = [];
  const ledM = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#cfe3ff', emissiveIntensity: 5 });
  const ray = shaftMaterial('#8fbaff', .1);
  for (const c of TANKS) {
    const g = new THREE.Group(); g.position.copy(c); scene.add(g);
    const o = new THREE.Mesh(outer, tankW); o.position.y = TH / 2; const i = new THREE.Mesh(inner, tankIn); i.position.y = TH / 2;
    const r = new THREE.Mesh(rim, tankW); r.position.y = TH; const b = new THREE.Mesh(bottom, tankIn); b.position.y = .03; b.material = tankIn.clone(); b.material.side = THREE.FrontSide;
    const s = new THREE.Mesh(surf, waterM); s.position.y = TH - .16; s.renderOrder = 2;
    g.add(o, i, r, b, s);
    const L = new THREE.PointLight(0x9cc2ff, 26, 13, 1.6); L.position.set(c.x, 6.2, c.z); scene.add(L); lights.push(L);
    const led = new THREE.Mesh(new THREE.BoxGeometry(5, .08, .22), ledM); led.position.set(c.x, 7.75, c.z); scene.add(led); leds.push(led);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.6, R * .95, 6.5, 40, 1, true), ray); cone.position.set(c.x, 7.7 - 3.25, c.z); scene.add(cone); rays.push(cone);
  }
  // broodstock fish (seabream-like silver fish, no species claim) circling in each tank
  const geo = fishGeometry('bream', .8), mat = fishMaterial(fishTexture('bream'), { metalness: .35, roughness: .35, swim: 6, amp: .04 });
  mat.envMapIntensity = .6;
  const perTank = 7, fish = fishInstances(geo, mat, TANKS.length * perTank); scene.add(fish);
  const F = []; TANKS.forEach((c, ti) => { for (let k = 0; k < perTank; k++) F.push({ c, a: Math.random() * 6.28, r: 1.2 + Math.random() * 1.6, y: .35 + Math.random() * .6, w: (.28 + Math.random() * .1) * (ti % 2 ? 1 : -1), s: .5 + Math.random() * .12, ph: Math.random() * 6 }); });
  // bubbles from the aeration in each tank
  const NB = TIER > 1 ? 360 : 160;
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#dbefff', emissive: '#4f8fd8', emissiveIntensity: .6, roughness: .1, transparent: true, opacity: .55 }), NB);
  const B = []; for (let i = 0; i < NB; i++) { const c = TANKS[i % TANKS.length], a = Math.random() * 6.28, r = Math.random() * .25; B.push({ c, x: Math.cos(a) * r + .6, z: Math.sin(a) * r - .4, y: Math.random() * 1.1, v: .25 + Math.random() * .25, s: .012 + Math.random() * .02, ph: Math.random() * 6 }); }
  bub.frustumCulled = false; scene.add(bub);
  const dust = driftPoints(TIER > 1 ? 1600 : 700, new THREE.Vector3(40, 8, 30), pointsMaterial({ color: '#bcd6ff', size: 1.3, opacity: .45 })); scene.add(dust);

  let photo = 0; // 0 = day, 1 = night
  function setPhoto(p) {
    photo = p; const L = 1 - p * .85;
    lights.forEach(l => l.intensity = 26 * L); ledM.emissiveIntensity = 5 * (1 - p * .9); ray.uniforms.uStrength.value = .1 * (1 - p * .9);
    hemi.intensity = .55 * (1 - p * .6); waterM.uniforms.uLight.value = L; tankIn.emissiveIntensity = 1.1 * (1 - p * .65);
    scene.traverse(o => { if (o.material && o.material !== tankIn && o.material.emissive && o.geometry === bottom) o.material.emissiveIntensity = tankIn.emissiveIntensity; });
  }
  const dm = new THREE.Object3D();
  function update(dt, t, cam) {
    waterM.uniforms.uTime.value = t; ray.uniforms.uTime.value = t; mat.userData.uTime.value = t; dust.material.uniforms.uTime.value = t; dust.material.uniforms.uCam.value.copy(cam.position);
    F.forEach((f, i) => {
      const a = f.a + t * f.w, y = f.y + Math.sin(t * .5 + f.ph) * .12;
      dm.position.set(f.c.x + Math.cos(a) * f.r, y, f.c.z + Math.sin(a) * f.r);
      const vx = -Math.sin(a) * f.w, vz = Math.cos(a) * f.w; dm.rotation.set(0, Math.atan2(-vz, vx), Math.cos(t * .5 + f.ph) * .08, 'YZX'); dm.scale.setScalar(f.s);
      dm.updateMatrix(); fish.setMatrixAt(i, dm.matrix);
    });
    fish.instanceMatrix.needsUpdate = true;
    B.forEach((b, i) => { const y = (b.y + t * b.v) % 1.15; dm.position.set(b.c.x + b.x + Math.sin(t * 3 + b.ph) * .03, .05 + y, b.c.z + b.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(b.s * (1 + y * .4)); dm.updateMatrix(); bub.setMatrixAt(i, dm.matrix); });
    bub.instanceMatrix.needsUpdate = true;
  }
  return { scene, update, setPhoto, tanks: TANKS, exposure: 1.05, bloom: .42, bloomThreshold: .75, bloomRadius: .6, near: .05, far: 200, hotspots: [] };
}
