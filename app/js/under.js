import * as THREE from 'three';
import { canvasTex, shaftMaterial, pointsMaterial, driftPoints } from './common.js';
import { fishGeometry, fishTexture, fishMaterial, fishInstances, School } from './fish.js';

// Inside sea cage C-03 (local origin = cage centre, y = 0 = sea surface)
export function buildUnder(renderer, TIER) {
  const scene = new THREE.Scene();
  const fogC = new THREE.Color().setRGB(.025, .2, .25);
  scene.background = fogC.clone(); scene.fog = new THREE.FogExp2(fogC, .052);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader: `varying vec3 vD; void main(){ float y=normalize(vD).y; vec3 c=mix(vec3(.025,.2,.25),vec3(.2,.55,.58),smoothstep(0.,1.,y)); c=mix(c,vec3(.004,.04,.07),smoothstep(0.,-.8,y)); gl_FragColor=vec4(c,1.); }`
  }));
  dome.renderOrder = -10; scene.add(dome);
  scene.add(new THREE.HemisphereLight(0x9fe8ea, 0x082830, 1.4));
  const sunL = new THREE.DirectionalLight(0xc8f6ff, 2.4); sunL.position.set(4, 20, 3); scene.add(sunL);

  // sea surface seen from below: Snell's window + ripples
  const surfM = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, depthWrite: false, transparent: true, fog: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; varying vec3 vW;
      void main(){ vec3 V=vW-cameraPosition; float dist=length(V); V/=dist; vec2 p=vW.xz; float t=uTime*.45; // slow, calm surface seen from below
        vec2 g=vec2(sin(p.x*.9+t*1.2)+sin(p.x*.5-p.y*.8+t*.9)*.8+sin(p.x*2.3+p.y*1.7-t*1.6)*.3, cos(p.y*1.1-t)+cos(p.x*.7+p.y*.6+t*1.1)*.7+cos(p.y*2.6-p.x*1.4+t*1.8)*.3)*.05;
        float cosA=V.y+g.x*.6+g.y*.4;
        float win=smoothstep(.62,.72,cosA);
        vec3 c=mix(vec3(.05,.3,.34),vec3(.75,.95,.98)*1.6,win);
        c+=vec3(.6,.9,1.)*pow(max(sin(p.x*1.3+g.x*7.+t)*sin(p.y*1.1+g.y*7.-t*.8),0.),4.)*.35*win;
        float f=exp(-dist*.035);
        c=mix(vec3(.025,.2,.25),c,f);
        gl_FragColor=vec4(c,1.); }`
  });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1).rotateX(Math.PI / 2), surfM); surf.position.y = 0; scene.add(surf);
  // floating collar silhouettes and the pen net
  const R = 13;
  const dark = new THREE.MeshStandardMaterial({ color: '#cfd8d6', roughness: .6 });
  for (const r of [R, R + .7]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .32, 10, 96).rotateX(Math.PI / 2), dark); t.position.y = -.05; scene.add(t); }
  // pen net: soft, alpha-blended and mipmapped (no alpha-test popping / moire crawl when the camera drifts)
  const netTex = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(25,45,45,1)'; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke(); });
  netTex.repeat.set(160, 30); netTex.anisotropy = 16;
  const netM = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, roughness: .9, color: '#8fa7a2' });
  const net = new THREE.Mesh(new THREE.CylinderGeometry(R + .3, R + .3, 16, 96, 1, true), netM); net.position.y = -8; scene.add(net);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(R + .3, 4, 96, 1, true).rotateX(Math.PI), netM.clone()); cone.material.map = netTex.clone(); cone.material.map.repeat.set(160, 8); cone.position.y = -18; scene.add(cone);
  const ropeM = new THREE.MeshStandardMaterial({ color: '#d9e2df', roughness: .8 });
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, rp = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 16, 5), ropeM); rp.position.set(Math.cos(a) * (R + .25), -8, Math.sin(a) * (R + .25)); scene.add(rp); }
  // light shafts (camera-facing quads)
  const shafts = [], sm = shaftMaterial('#bff3ff', .16); sm.uniforms.uPlane.value = 1; sm.uniforms.uCalm.value = 1; // slow, soft streaks underwater
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + Math.random() * 2.2, 26), sm); m.position.set((Math.random() - .5) * 26, -12, (Math.random() - .5) * 26); m.userData.tilt = .12 + Math.random() * .08; m.userData.ph = Math.random() * 6; scene.add(m); shafts.push(m); }
  const snow = driftPoints(TIER > 1 ? 2600 : 1200, new THREE.Vector3(26, 18, 26), pointsMaterial({ color: '#e3fbff', size: 1.4, opacity: .5 })); scene.add(snow);

  // Hamour school (boids, circling current)
  const NF = TIER > 1 ? 190 : 90;
  const geo = fishGeometry('grouper', 1), mat = fishMaterial(fishTexture('grouper'), { roughness: .55, swim: 6.5, amp: .05 });
  const mesh = fishInstances(geo, mat, NF); scene.add(mesh);
  const school = new School(mesh, NF, { R: 10.5, y0: -10, y1: -1.8, center: new THREE.Vector3(0, 0, 0), speed: .85, size: .58, neigh: 2.4, sepR: .9 });
  for (let i = 0; i < 200; i++) school.step(1 / 30);
  // selection ring (billboard)
  const ringM = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv-.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform float uA; varying vec2 vUv;
      void main(){ float r=length(vUv)*2.; float ring=smoothstep(.009,0.,abs(r-.82))*.9;
        float pulse=fract(uTime*.6); float p2=smoothstep(.02,0.,abs(r-(.82+pulse*.16)))*(1.-pulse)*.7;
        float ticks=step(.985,abs(cos(atan(vUv.y,vUv.x)*2.)))*smoothstep(.04,0.,abs(r-.92));
        float a=(ring+p2+ticks*.8)*uA; gl_FragColor=vec4(vec3(1.,.84,.55)*1.05,a*.85); }`
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), ringM); ring.renderOrder = 10; ring.visible = false; scene.add(ring);
  // bubble burst for the dive
  const NB = 220, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: '#eefcff', emissive: '#7fd8e6', emissiveIntensity: .7, roughness: .05, transparent: true, opacity: .6 }), NB);
  bub.frustumCulled = false; scene.add(bub); const BB = []; let burstT = -99, burstO = new THREE.Vector3();
  for (let i = 0; i < NB; i++) BB.push({ o: new THREE.Vector3((Math.random() - .5) * 2.4, (Math.random() - .3) * 2, (Math.random() - .5) * 2.4), v: .8 + Math.random() * 1.6, s: .01 + Math.random() * .045, ph: Math.random() * 6 });

  const dm = new THREE.Object3D();
  let fishTime = 0;
  const state = { timeScale: 1, sel: -1 };
  function burst(at, t) { burstT = t; burstO.copy(at); }
  function update(dt, t, cam) {
    const fdt = dt * state.timeScale; fishTime += fdt;
    school.avoid = cam.position; school.exempt = state.sel; school.step(Math.min(fdt, 1 / 20)); school.write();
    mat.userData.uTime.value = fishTime; surfM.uniforms.uTime.value = t; sm.uniforms.uTime.value = t; snow.material.uniforms.uTime.value = t; snow.material.uniforms.uCam.value.copy(cam.position); ringM.uniforms.uTime.value = t;
    for (const s of shafts) { s.rotation.set(0, Math.atan2(cam.position.x - s.position.x, cam.position.z - s.position.z), 0); s.rotateX(s.userData.tilt); s.scale.x = .85 + .08 * Math.sin(t * .15 + s.userData.ph); }
    if (state.sel >= 0) { const p = school.p[state.sel]; ring.position.copy(p); ring.quaternion.copy(cam.quaternion); ring.scale.setScalar(school.s[state.sel] * 1.02); }
    const bt = t - burstT;
    for (let i = 0; i < NB; i++) { const b = BB[i]; if (bt < 0 || bt > 4) { dm.scale.setScalar(0); } else { dm.position.copy(burstO).add(b.o).add(new THREE.Vector3(Math.sin(t * 4 + b.ph) * .05, bt * b.v * (1 + bt * .3), 0)); dm.scale.setScalar(b.s * (1 - bt / 4.4)); } dm.updateMatrix(); bub.setMatrixAt(i, dm.matrix); }
    bub.instanceMatrix.needsUpdate = true;
  }
  return { scene, update, school, mesh, ring, ringM, state, burst, exposure: 1.1, bloom: .35, bloomThreshold: .8, bloomRadius: .7, near: .05, far: 200, hotspots: [], dof: true };
}
