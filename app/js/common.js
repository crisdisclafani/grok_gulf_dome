import * as THREE from 'three';
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.repeat.set(...opts.repeat);
  return t;
}
// corrugated cladding normal map (vertical ribs)
export function ribNormal(ribs = 16) {
  return canvasTex(256, 16, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const ph = (x / w) * ribs * Math.PI * 2, nx = Math.sin(ph) * .55;
      for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; img.data[i] = 128 + nx * 127; img.data[i + 1] = 128; img.data[i + 2] = 255 * Math.sqrt(1 - nx * nx * .5); img.data[i + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  }, { color: false });
}
// scale box UVs by real dimensions so tiling textures keep their size (period in metres)
export function boxUV(geo, w, h, d, period = 4) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / period, uv.getY(i) * dims[f][1] / period); }
  return geo;
}
export function noiseTex(size = 256, amp = 40, base = 128) {
  return canvasTex(size, size, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = base + (Math.random() - .5) * amp; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  });
}
// soft additive light-shaft material (used for god rays in the hall and underwater)
export function shaftMaterial(color, strength = .15) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength }, uPlane: { value: 0 }, uCalm: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uStrength; uniform float uPlane; uniform float uCalm; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.6);
        float v=smoothstep(0.,.35,vUv.y)*smoothstep(1.,.93,vUv.y)*mix(1.,pow(sin(vUv.x*3.1416),2.),uPlane); edge=mix(edge,1.,uPlane);
        float streak=mix(.65+.35*sin(vUv.x*40.+uTime*.6)*sin(vUv.x*17.-uTime*.4), .8+.2*sin(vUv.x*9.+uTime*.12)*sin(vUv.x*5.-uTime*.08), uCalm);
        gl_FragColor=vec4(uColor*uStrength*edge*v*streak*(.4+.6*vUv.y),1.); }`
  });
}
export function pointsMaterial({ color = '#ffffff', size = 2, opacity = .6, additive = true }) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOpacity: { value: opacity }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(30, 20, 30) } },
    vertexShader: `uniform float uTime; uniform float uSize; uniform vec3 uCam; uniform vec3 uBox; attribute float aSeed; varying float vA;
      void main(){ vec3 p=position; p.x+=sin(uTime*.2+aSeed*6.)*.3; p.y+=uTime*(.03+aSeed*.04)*(aSeed>.5?1.:-1.); p.z+=cos(uTime*.15+aSeed*9.)*.3;
        p = uCam + mod(p - uCam + uBox*.5, uBox) - uBox*.5;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uSize*(.5+aSeed)*(30./-mv.z); vA=clamp(1.-(-mv.z)/(uBox.z*.5),0.,1.)*clamp(-mv.z*2.-.2,0.,1.); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(uColor, a*uOpacity*vA); }`
  });
}
export function driftPoints(n, box, mat) {
  const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * box.x; p[i * 3 + 1] = (Math.random() - .5) * box.y; p[i * 3 + 2] = (Math.random() - .5) * box.z; s[i] = Math.random(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  mat.uniforms.uBox.value.copy(box);
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; return pts;
}
