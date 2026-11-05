import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const Q = new URLSearchParams(location.search);
export const DEMO = Q.has('demo');
export const CAPTURE = Q.has('capture');
export const MOBILE = Math.min(innerWidth, innerHeight) < 700;
// quality tier: 2 = desktop, 1 = mobile / low; adaptive pixel ratio on top
export const TIER = Q.get('q') ? +Q.get('q') : (MOBILE ? 1 : 2);

export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
const MAXPR = CAPTURE ? 1 : Math.min(devicePixelRatio, TIER > 1 ? 1.5 : 2);
let pr = MAXPR;
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

export const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 7000);

const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
export const composer = new EffectComposer(renderer, rt);
const dummyScene = new THREE.Scene();
export const renderPass = new RenderPass(dummyScene, camera);
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.25, 0.55, 0.9);
export const bokeh = new BokehPass(dummyScene, camera, { focus: 6, aperture: 0.0025, maxblur: 0.008 });
bokeh.enabled = false;
const output = new OutputPass();
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(bokeh); composer.addPass(output);

export let world = null;
export function setWorld(w) {
  world = w;
  renderPass.scene = w.scene; bokeh.scene = w.scene;
  bloom.strength = w.bloom ?? 0.25; bloom.threshold = w.bloomThreshold ?? 0.9; bloom.radius = w.bloomRadius ?? 0.55;
  renderer.toneMappingExposure = w.exposure ?? 1.0;
  renderer.shadowMap.needsUpdate = true;
  camera.near = w.near ?? 0.1; camera.far = w.far ?? 7000; camera.updateProjectionMatrix();
}

export function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);

// Adaptive quality: lower the internal resolution (and bloom) when the device struggles, raise it again when there is headroom.
let acc = 0, n = 0;
export function adapt(realDt) {
  if (CAPTURE) return;
  acc += realDt; n++;
  if (acc < 2) return;
  const avg = acc / n; acc = 0; n = 0;
  if (avg > 1 / 38 && pr > 0.6) { pr = Math.max(0.6, pr - 0.15); resize(); if (pr < 0.8) bloom.enabled = false; }
  else if (avg < 1 / 57 && pr < MAXPR) { pr = Math.min(MAXPR, pr + 0.1); resize(); bloom.enabled = true; }
}
export function render() { composer.render(); }
