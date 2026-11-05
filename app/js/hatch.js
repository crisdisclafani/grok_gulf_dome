import * as THREE from 'three';
import { pointsMaterial, driftPoints } from './common.js';

// Hatchery: dim room, blue LEDs, round larval tanks with glowing yellow-green water (as in the video).
export const HERO_TANK = new THREE.Vector3(3, 0, 3.5);
export function buildHatch(renderer, TIER, camera) {
  const scene = new THREE.Scene();
  const fogC = new THREE.Color(0x0b1f3a); scene.background = fogC.clone(); scene.fog = new THREE.Fog(fogC, 8, 34);
  const W = 30, D = 20, H = 4.2;
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: '#2a3b52', roughness: .85, side: THREE.BackSide })); room.position.y = H / 2; scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#33465a', roughness: .25 })); floor.position.y = .01; scene.add(floor);
  scene.add(new THREE.HemisphereLight(0x8ea6d8, 0x16243a, .9));
  const led = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#4a86ff', emissiveIntensity: 4 });
  for (const z of [-7, 0, 7]) { const b = new THREE.Mesh(new THREE.BoxGeometry(26, .06, .16), led); b.position.set(0, H - .05, z); scene.add(b); }
  for (const x of [-8, 0, 8]) { const L = new THREE.PointLight(0x7f9ee8, 3, 12, 1.5); L.position.set(x, H - .4, 0); scene.add(L); }

  const tankW = new THREE.MeshStandardMaterial({ color: '#eef1f3', roughness: .5 });
  const glowIn = new THREE.MeshStandardMaterial({ color: '#c4cf45', emissive: '#a9b62a', emissiveIntensity: 1.0, roughness: .7, side: THREE.BackSide });
  const glowBot = glowIn.clone(); glowBot.side = THREE.FrontSide;
  const waterM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; varying vec3 vW;
      void main(){ vec2 p=vW.xz*3.; float t=uTime;
        vec2 g=vec2(cos(p.x*2.+t*1.1)+cos(p.x*1.3-p.y*2.+t*.8)*.6, sin(p.y*2.3-t*.9)+sin(p.x*1.7+p.y-t*1.2)*.5)*.05;
        vec3 N=normalize(vec3(g.x,1.,g.y)); vec3 V=normalize(cameraPosition-vW);
        float fr=.03+.97*pow(1.-max(dot(N,V),0.),5.);
        vec3 R=reflect(-V,N); float sp=pow(max(dot(R,normalize(vec3(.2,1.,.1))),0.),60.);
        vec3 c=vec3(.55,.62,.10)*.55 + vec3(.5,.7,1.)*sp*.8 + vec3(.25,.4,.8)*fr*.5;
        gl_FragColor=vec4(c,.22+fr*.45); }`
  });
  const R = 1.6, TH = 1.1, TANKS = [];
  for (const x of [-9, -3, 3, 9]) for (const z of [-3.5, 3.5]) TANKS.push(new THREE.Vector3(x, 0, z));
  const outer = new THREE.CylinderGeometry(R, R, TH, 56, 1, true), inner = new THREE.CylinderGeometry(R - .06, R - .06, TH, 56, 1, true), rim = new THREE.TorusGeometry(R - .03, .05, 8, 56).rotateX(Math.PI / 2);
  const bottom = new THREE.CircleGeometry(R - .06, 40).rotateX(-Math.PI / 2), surf = new THREE.CircleGeometry(R - .07, 56).rotateX(-Math.PI / 2);
  for (const c of TANKS) {
    const g = new THREE.Group(); g.position.copy(c); scene.add(g);
    const o = new THREE.Mesh(outer, tankW); o.position.y = TH / 2; const i = new THREE.Mesh(inner, glowIn); i.position.y = TH / 2;
    const r = new THREE.Mesh(rim, tankW); r.position.y = TH; const b = new THREE.Mesh(bottom, glowBot); b.position.y = .03;
    const s = new THREE.Mesh(surf, waterM); s.position.y = TH - .1; s.renderOrder = 3;
    g.add(o, i, r, b, s);
    const L = new THREE.PointLight(0xd6e35a, 3, 3.2, 1.6); L.position.set(c.x, TH + .25, c.z); scene.add(L);
    // aeration line into tank
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.6, 6), tankW); pipe.position.set(c.x + .4, TH + .2, c.z); pipe.rotation.z = .6; scene.add(pipe);
  }
  // larvae: GPU particles (jitter + slow swirl + elongated sprite with an eye dot)
  const NH = TIER > 1 ? 30000 : 12000, NO = TIER > 1 ? 1800 : 800, N = NH + NO * (TANKS.length - 1);
  const pos = new Float32Array(N * 3), seed = new Float32Array(N), ctr = new Float32Array(N * 3);
  let k = 0;
  TANKS.forEach(c => {
    const n = c.equals(HERO_TANK) ? NH : NO;
    for (let i = 0; i < n; i++, k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * (R - .12); pos[k * 3] = Math.cos(a) * r; pos[k * 3 + 1] = .08 + Math.pow(Math.random(), .6) * (TH - .22); pos[k * 3 + 2] = Math.sin(a) * r; seed[k] = Math.random(); ctr[k * 3] = c.x; ctr[k * 3 + 1] = c.y; ctr[k * 3 + 2] = c.z; }
  });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); lg.setAttribute('aC', new THREE.BufferAttribute(ctr, 3));
  const lm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 800 } },
    vertexShader: `uniform float uTime; uniform float uScale; attribute float aSeed; attribute vec3 aC; varying float vRot; varying float vA;
      void main(){ vec3 p=position; float a=uTime*(.05+aSeed*.06); float c=cos(a), s=sin(a); p.xz=mat2(c,-s,s,c)*p.xz;
        float r=length(p.xz); if(r>1.45) p.xz*=1.45/r;
        p+=vec3(sin(uTime*(2.+aSeed*3.)+aSeed*40.), sin(uTime*(1.5+aSeed*2.)+aSeed*17.)*.6, cos(uTime*(2.4+aSeed*2.)+aSeed*23.))*.012;
        vec4 mv=modelViewMatrix*vec4(p+aC,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(.011*uScale/-mv.z,1.,56.); vRot=aSeed*6.28+uTime*(aSeed-.5)*.8; vA=clamp(1.2-(-mv.z)/14.,0.,1.); }`,
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
  // the real L3T6 whiteboard photo (cropped from the client's video), mounted at the tank
  const wbTex = new THREE.TextureLoader().load('whiteboard.jpg'); wbTex.colorSpace = THREE.SRGBColorSpace; wbTex.anisotropy = 8;
  const wb = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(.98, .82, .03), new THREE.MeshStandardMaterial({ color: '#d9dde0', roughness: .4, metalness: .6 }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(.92, .76), new THREE.MeshBasicMaterial({ map: wbTex, color: new THREE.Color(.62, .64, .66) })); board.position.z = .017;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.3, 8), new THREE.MeshStandardMaterial({ color: '#b9c0c5', metalness: .7, roughness: .3 })); post.position.y = -.9;
  wb.add(frame, board, post); wb.position.set(HERO_TANK.x - 1.0, 1.55, HERO_TANK.z - R - .35); wb.rotation.y = Math.PI - .3; scene.add(wb);
  const dust = driftPoints(TIER > 1 ? 900 : 400, new THREE.Vector3(24, 4, 18), pointsMaterial({ color: '#8fb0ff', size: .9, opacity: .35 })); scene.add(dust);
  function update(dt, t, cam) {
    waterM.uniforms.uTime.value = t; lm.uniforms.uTime.value = t; dust.material.uniforms.uTime.value = t; dust.material.uniforms.uCam.value.copy(cam.position);
    lm.uniforms.uScale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  }
  return { scene, update, exposure: 1.0, bloom: .55, bloomThreshold: .7, bloomRadius: .6, near: .02, far: 120, hotspots: [{ id: 'l3t6', pos: new THREE.Vector3(HERO_TANK.x, 2.0, HERO_TANK.z), key: 'hsTank', sub: 'hsTankS' }] };
}
