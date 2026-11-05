import './seed.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { renderer, camera, composer, bokeh, setWorld, render, adapt, DEMO, CAPTURE, TIER, MOBILE } from './core.js';
import { buildExterior, HERO_CAGE, G } from './exterior.js';
import { buildBrood } from './brood.js';
import { buildHatch, HERO_TANK, HATCH_APPROACH } from './hatch.js';
import { buildUnder } from './under.js';
import { STR } from './i18n.js';

const $ = s => document.querySelector(s);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
gsap.ticker.remove(gsap.updateRoot); gsap.ticker.lagSmoothing(0); gsap.updateRoot(0); // pin GSAP's clock to the app clock (T) so timing never depends on load time
let T = 0; // app clock (seconds) — drives GSAP, shaders, fish: identical in live and capture modes

// ---------------- worlds ----------------
const EXT = buildExterior(renderer);
const BRD = buildBrood(renderer, TIER);
const HAT = buildHatch(renderer, TIER, camera);
const UND = buildUnder(renderer, TIER);
EXT.offset = V(0, 0, 0); BRD.offset = V(0, 0, 0); HAT.offset = V(0, 0, 0); UND.offset = HERO_CAGE.clone();
let W = EXT;
function useWorld(w) { W = w; setWorld(w); bokeh.enabled = false; buildHotspots(w === EXT ? (state.cagesMode ? EXT.cageHotspots : EXT.hotspots) : w.hotspots); }

// ---------------- camera rig ----------------
// rig.pos / rig.tgt are in "journey" coordinates (exterior world coordinates; underwater adds the cage offset)
const rig = { pos: V(-330, 210, 330), tgt: V(-40, 0, -20), sway: 1, fov: 40 };
let mode = 'rig'; // 'rig' | 'orbit' | 'follow' | 'drift'
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = .08;
let flight = null;
function fly(points, targets, dur, ease = 'power2.inOut', extra = {}) {
  if (flight) flight.kill();
  stopOrbit();
  mode = 'rig';
  const P = new THREE.CatmullRomCurve3([rig.pos.clone(), ...points], false, 'centripetal');
  const Tg = new THREE.CatmullRomCurve3([rig.tgt.clone(), ...targets], false, 'centripetal');
  const o = { p: 0 }, f0 = rig.fov, f1 = extra.fov ?? rig.fov, s0 = rig.sway;
  flight = gsap.to(o, { p: 1, duration: dur, ease, onUpdate() { P.getPoint(o.p, rig.pos); Tg.getPoint(o.p, rig.tgt); rig.fov = f0 + (f1 - f0) * o.p; rig.sway = s0 * (1 - o.p) + (extra.sway ?? 1) * o.p; extra.onUpdate && extra.onUpdate(o.p); }, onComplete() { flight = null; extra.onComplete && extra.onComplete(); if (!DEMO) startOrbit(); } });
  return flight;
}
function place(pos, tgt, fov = rig.fov) { if (flight) flight.kill(); flight = null; rig.pos.copy(pos); rig.tgt.copy(tgt); rig.fov = fov; }
function startOrbit() {
  if (DEMO || CAPTURE || mode !== 'rig') return;
  mode = 'orbit'; controls.target.copy(rig.tgt).sub(W.offset); controls.enabled = true;
  const hatch = W === HAT;
  controls.minDistance = W === EXT ? 20 : hatch ? 1.6 : 1;
  controls.maxDistance = W === EXT ? 700 : hatch ? 40 : 25;
  controls.minPolarAngle = hatch ? 0.32 : 0;
  controls.maxPolarAngle = W === EXT ? 1.45 : hatch ? 1.58 : Math.PI;
}
function stopOrbit() { if (mode === 'orbit') { rig.pos.copy(camera.position).add(W.offset); rig.tgt.copy(controls.target).add(W.offset); } controls.enabled = false; }
const lookTmp = V(0, 0, 0);
function applyCamera(dt) {
  if (mode === 'orbit') { controls.update(); return; }
  if (mode === 'follow') updateFollow(dt);
  if (mode === 'drift') { const a = drift.a0 + (T - drift.t0) * .016; rig.pos.set(HERO_CAGE.x + Math.cos(a) * drift.r, drift.y + Math.sin((T - drift.t0) * .2) * .08, HERO_CAGE.z + Math.sin(a) * drift.r); rig.tgt.set(HERO_CAGE.x + Math.cos(a + 1.9) * 4, drift.y - .6, HERO_CAGE.z + Math.sin(a + 1.9) * 4); }
  const sw = rig.sway * (W === EXT ? extSway : .05); // exterior sway is 0 so the gulf does not drift
  camera.position.copy(rig.pos).sub(W.offset).add(lookTmp.set(Math.sin(T * .21) * sw, Math.sin(T * .17 + 1) * sw * .5, Math.cos(T * .19) * sw));
  camera.lookAt(lookTmp.copy(rig.tgt).sub(W.offset));
  if (Math.abs(camera.fov - rig.fov) > .01) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
}
const drift = { a0: 0, t0: 0, r: 8, y: -4.5 };
let extSway = 0; // no handheld drift over the exterior sea

// ---------------- i18n ----------------
let lang = 'en';
const t = k => (STR[lang][k] ?? STR.en[k] ?? k);
function applyLang(l) {
  lang = l; document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
  document.querySelectorAll('[data-th]').forEach(e => e.innerHTML = t(e.dataset.th));
  document.querySelectorAll('#langToggle button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
  $('#btnLangCard').innerHTML = l === 'ar' ? '<span>EN</span>' : '<span class="ar">عربي</span>';
  $('#planImg').alt = t('phase1Title');
  buildHotspots(currentHS); renderCrumb(); renderLevel(); setPP(pp, true);
}

// ---------------- hotspots ----------------
let HS = [], currentHS = [];
const hsLayer = $('#hotspots');
function buildHotspots(list) {
  currentHS = list; hsLayer.innerHTML = '';
  HS = list.map(h => {
    const el = document.createElement('div'); el.className = 'hs'; el.dataset.id = h.id;
    el.innerHTML = `<i></i><span class="ln"></span><div class="hl"><b>${t(h.key)}</b><span>${t(h.sub)}</span></div>`;
    el.addEventListener('click', e => { e.stopPropagation(); onHotspot(h.id); });
    el.style.visibility = 'hidden'; hsLayer.appendChild(el);
    return { ...h, el, a: 0 };
  });
  HS.forEach(h => h.el.classList.toggle('sel', h.id === selHS));
}
let selHS = null, hsVisible = false;
function showHotspots(on, stagger = .12) { hsVisible = on; HS.forEach((h, i) => gsap.to(h, { a: on ? 1 : 0, duration: on ? .6 : .3, delay: on ? i * stagger : 0, ease: 'power2.out' })); }
function selectHS(id) { selHS = id; HS.forEach(h => h.el.classList.toggle('sel', h.id === id)); }
const pv = V(0, 0, 0);
function projectHotspots() {
  for (const h of HS) {
    pv.copy(h.pos).project(camera);
    const vis = pv.z < 1 && h.a > .001 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
    if (!vis) { h.el.style.visibility = 'hidden'; continue; }
    const x = (pv.x * .5 + .5) * innerWidth, y = (-pv.y * .5 + .5) * innerHeight;
    const left = x > innerWidth * .7; h.el.classList.toggle('l', left);
    h.el.style.visibility = 'visible'; h.el.style.opacity = h.a;
    h.el.style.transform = `translate(${left ? x - h.el.offsetWidth + 10 : x - 10}px,${y - 10}px) scale(${.85 + .15 * h.a})`;
  }
  // fish tag follows the selected fish
  if (UND.state.sel >= 0 && W === UND) {
    const fp = UND.school.p[UND.state.sel]; pv.copy(fp).project(camera);
    const x = (pv.x * .5 + .5) * innerWidth; pv.copy(fp).addScaledVector(camera.up, -UND.school.s[UND.state.sel] * .62).project(camera);
    const y = (-pv.y * .5 + .5) * innerHeight;
    $('#fishTag').style.transform = `translate(${x - 60}px,${y + 8}px)`;
  }
}

// ---------------- breadcrumb & levels ----------------
let crumb = [], level = 1, levelKey = 'lv1';
function setCrumb(c) { crumb = c; renderCrumb(); }
function renderCrumb() {
  const el = $('#crumb'); el.innerHTML = '';
  crumb.forEach((c, i) => {
    if (i) { const s = document.createElement('i'); s.textContent = lang === 'ar' ? '‹' : '›'; el.appendChild(s); }
    const a = document.createElement('a'); a.textContent = t(c.k); if (i === crumb.length - 1) a.className = 'on';
    if (c.fn && i < crumb.length - 1) a.onclick = () => c.fn(); el.appendChild(a);
  });
}
function setLevel(n, k) { level = n; levelKey = k; renderLevel(); }
function renderLevel() {
  $('#dots').innerHTML = Array.from({ length: 7 }, (_, i) => `<s class="${i + 1 < level ? 'd' : i + 1 === level ? 'on' : ''}"></s>`).join('');
  $('#levelTxt').innerHTML = `${t('lvl')} <b>${level}</b> ${t('of')} 7 · ${t(levelKey)}`;
}
function setNav(k) { document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === k)); }

// ---------------- panels ----------------
const shown = new Set();
function show(sel, from = { y: 18 }, d = 0) { const el = $(sel); shown.add(sel); gsap.killTweensOf(el); return gsap.fromTo(el, { autoAlpha: 0, x: 0, y: 0, ...from }, { autoAlpha: 1, x: 0, y: 0, duration: .8, delay: d, ease: 'power3.out' }); }
function hide(sel, d = 0) { const el = $(sel); shown.delete(sel); gsap.killTweensOf(el); return gsap.to(el, { autoAlpha: 0, duration: .35, delay: d, ease: 'power2.in' }); }
function hideAll(except = []) { [...shown].forEach(s => { if (!except.includes(s)) hide(s); }); }
function toast(k, dur = 3.2) { const el = $('#toast'); el.textContent = t(k); gsap.killTweensOf(el); gsap.timeline().fromTo(el, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .4 }).to(el, { autoAlpha: 0, duration: .4 }, dur); }
const veil = $('#veil');
function veilSwap(fn, inD = .45, outD = .65) {
  return gsap.timeline().to(veil, { opacity: 1, duration: inD, ease: 'power2.in' }).call(fn).to(veil, { opacity: 0, duration: outD, ease: 'power2.out' });
}
function count(el, to, dur = 1.6, fmt = v => Math.round(v).toLocaleString('en-US')) { const o = { v: 0 }; gsap.to(o, { v: to, duration: dur, ease: 'power2.out', onUpdate: () => el.textContent = fmt(o.v) }); }

// ---------------- photoperiod (live control of the hall lighting) ----------------
let pp = 0;
function setPP(v, silent) {
  pp = Math.max(0, Math.min(1, v));
  $('#ppFill').style.width = pp * 100 + '%'; $('#ppKnob').style.left = pp * 100 + '%';
  $('#ppLabel').textContent = t(pp < .34 ? 'ppDay' : pp < .72 ? 'ppDusk' : 'ppNight');
  if (lang === 'ar') { $('#ppKnob').style.left = 'auto'; $('#ppKnob').style.right = pp * 100 + '%'; $('#ppKnob').style.marginRight = '-10px'; $('#ppFill').style.marginInlineStart = 'auto'; } else { $('#ppKnob').style.right = 'auto'; $('#ppKnob').style.marginRight = '0'; }
  BRD.setPhoto(pp);
}
{ const s = $('#ppSlider'); let drag = false; const at = e => { const r = s.getBoundingClientRect(); let v = (e.clientX - r.left) / r.width; if (lang === 'ar') v = 1 - v; setPP(v); };
  s.addEventListener('pointerdown', e => { drag = true; s.setPointerCapture(e.pointerId); at(e); }); s.addEventListener('pointermove', e => drag && at(e)); s.addEventListener('pointerup', () => drag = false); }

// ---------------- navigation (shared by manual use and the guided demo) ----------------
const state = { where: 'campus', cagesMode: false };
function crumbCampus() { return { k: 'crCampus', fn: goCampus }; }
function goCampus() {
  hideAll(); state.cagesMode = false; selectHS(null);
  const go = () => { useWorld(EXT); extSway = 0; stopOrbit(); place(V(-290, 175, 270), V(-35, 0, -25), 40); applyCamera(0); showHotspots(true); startOrbit(); };
  if (W !== EXT || state.where !== 'campus') veilSwap(go); else go();
  state.where = 'campus'; setCrumb([{ k: 'crCampus' }]); setLevel(1, 'lv1'); setNav('campus'); $('#crumb').title = t('crCampus') + ' · ' + t('start');
}
function enterBroodstock() {
  hideAll(); selectHS('brood'); state.where = 'brood';
  setCrumb([crumbCampus(), { k: 'crFac' }, { k: 'crBrood' }]); setLevel(2, 'lv2'); setNav('facilities');
  const inside = () => {
    useWorld(BRD); setPP(0);
    place(V(29, 2.3, 1.5), V(0, 1.4, 0), 44);
    fly([V(21, 3.0, 6), V(13, 3.7, 10.5)], [V(4, 1.2, 1), V(-6, .8, -1.5)], 5.2, 'power2.out', { sway: 1 });
    setLevel(3, 'lv3'); show('#brood', { x: lang === 'ar' ? -40 : 40 }, 1.2);
  };
  if (W === EXT) {
    showHotspots(false);
    fly([V(-150, 115, 215), V(-20, 46, 140), V(-6, 16, 96)], [V(-20, 0, 10), V(-5, 4, 40), V(-5, 5, 42)], 4.4, 'power2.inOut', { fov: 44 });
    gsap.delayedCall(3.7, () => veilSwap(inside, .45, .7));
  } else veilSwap(inside);
}
function goHatchery() {
  hideAll(); state.where = 'hatch';
  setCrumb([crumbCampus(), { k: 'crFac' }, { k: 'crHatch' }, { k: 'crL3T6' }]); setNav('trace');
  veilSwap(() => {
    useWorld(HAT); setLevel(4, 'lv4');
    const A = MOBILE ? HATCH_APPROACH.mobile : HATCH_APPROACH.desktop;
    const V3 = a => V(a[0], a[1], a[2]);
    place(V3(A.place), V3(A.look), A.fov0);
    fly(A.pts.map(V3), A.tgts.map(V3), HATCH_APPROACH.dur, 'power2.inOut', { fov: A.fov1, sway: .7 });
    showHotspots(true);
    show('#lifecycle', { y: -14 }, .8); show('#tank', { x: lang === 'ar' ? -40 : 40 }, 1.3);
    gsap.delayedCall(1.3, () => {
      document.querySelectorAll('.lc-step').forEach((s, i) => { s.classList.toggle('done', i < 1); s.classList.toggle('on', i === 1); });
      gsap.fromTo('#lcFill', { width: '0%' }, { width: '33%', duration: 1.2, ease: 'power2.out' });
      count($('#cStocked'), 750000); count($('#cHatched'), 580000, 1.8); count($('#cUnhatched'), 170000, 1.8);
      gsap.fromTo('#rateBar', { width: '0%' }, { width: (580 / 750 * 100).toFixed(1) + '%', duration: 1.8, ease: 'power2.out' });
    });
  });
}
function larvaeCloseUp() {
  showHotspots(false);
  const h = HERO_TANK;
  fly(
    [V(h.x - 2.55, 2.2, h.z + 3.55), V(h.x - 0.82, MOBILE ? 2.05 : 1.56, h.z + 1.42)],
    [V(h.x - 0.12, 0.98, h.z + 0.5), V(h.x + 0.04, MOBILE ? 0.4 : 0.66, h.z + 0.1)],
    3.4, 'power2.inOut', { fov: MOBILE ? 40 : 33, sway: .22 }
  );
}
function goSeaCages() {
  hideAll(); state.where = 'cages'; state.cagesMode = true;
  setCrumb([crumbCampus(), { k: 'crCages' }, { k: 'crC03' }]); setNav('cages');
  veilSwap(() => {
    useWorld(EXT); setLevel(5, 'lv5'); extSway = 0;
    document.querySelectorAll('.lc-step').forEach((s, i) => { s.classList.toggle('done', i < 3); s.classList.toggle('on', i === 3); });
    place(V(-60, 70, 20), V(120, 0, -80), 46);
    fly([V(90, 55, -30), V(260, 38, -60), V(372, 24, -86)], [V(300, 0, -110), V(400, 0, -118), V(414, -1, -124)], 6.2, 'power1.inOut', { fov: 42 });
    gsap.delayedCall(4.2, () => { showHotspots(true); selectHS('c03'); show('#cages', { x: lang === 'ar' ? -40 : 40 }); });
  });
}
function diveCage() {
  hideAll(); showHotspots(false); state.where = 'under';
  setCrumb([crumbCampus(), { k: 'crCages' }, { k: 'crC03' }, { k: 'crUnder' }]); setLevel(6, 'lv6'); setNav('species');
  if (W !== EXT) { useWorld(EXT); }
  const C = HERO_CAGE; let crossed = false;
  fly([V(C.x - 3, 9, C.z + 15), V(C.x - 2, 1.2, C.z + 8.5), V(C.x - 2.5, -1.6, C.z + 7.5), V(C.x - 4, -4.4, C.z + 7)],
      [V(C.x, -1, C.z), V(C.x - .5, -2, C.z + 2), V(C.x + 1, -4.5, C.z), V(C.x + 3, -5, C.z - 2)], 5.4, 'power1.inOut',
      { fov: 50, sway: .5, onUpdate() { if (!crossed && rig.pos.y < 0) { crossed = true; useWorld(UND); UND.burst(rig.pos.clone().sub(C).add(V(0, -.8, -1.2)), T); bokeh.enabled = false; show('#depth', { x: lang === 'ar' ? 20 : -20 }); } },
        onComplete() { drift.a0 = Math.atan2(rig.pos.z - C.z, rig.pos.x - C.x); drift.t0 = T; drift.r = Math.hypot(rig.pos.x - C.x, rig.pos.z - C.z); drift.y = rig.pos.y; mode = 'drift'; show('#tapHint', { y: 10 }, .6); } });
}
// ---- fish selection: ring, slow motion, follow camera with depth of field, fish card ----
const fol = { k: 0, pos: V(0, 0, 0), tgt: V(0, 0, 0), side: 1 };
function pickFishNear(sx, sy) {
  let best = -1, bd = 1e9;
  UND.school.p.forEach((p, i) => { pv.copy(p).project(camera); if (pv.z > 1) return; const d = Math.hypot((pv.x * .5 + .5) * innerWidth - sx, (-pv.y * .5 + .5) * innerHeight - sy); const dist = camera.position.distanceTo(p); if (dist < 3 || dist > 12) return; if (d + dist * 8 < bd) { bd = d + dist * 8; best = i; } });
  return best;
}
function selectFish(i) {
  if (i < 0) return;
  const S = UND.state, first = S.sel < 0; S.sel = i;
  hide('#tapHint'); UND.ring.visible = true;
  gsap.fromTo(UND.ringM.uniforms.uA, { value: 0 }, { value: 1, duration: .8 });
  gsap.to(S, { timeScale: .32, duration: 1.4, ease: 'power2.out' });
  if (mode !== 'follow') { fol.pos.copy(rig.pos); fol.tgt.copy(rig.tgt); }
  mode = 'follow'; fol.k = 0; gsap.to(fol, { k: 1, duration: 2.2, ease: 'power2.inOut' });
  bokeh.enabled = true;
  show('#fishTag', { y: 8 }, .3);
  setLevel(7, 'lv7'); setCrumb([crumbCampus(), { k: 'crCages' }, { k: 'crC03' }, { k: 'crHamour' }]);
  if (first) show('#card', { x: lang === 'ar' ? -70 : 70 }, 1.2);
}
const tv = V(0, 0, 0), fw = V(0, 0, 0), sd = V(0, 0, 0), up = V(0, 1, 0), wantP = V(0, 0, 0), wantT = V(0, 0, 0), camR = V(0, 0, 0);
function updateFollow(dt) {
  const S = UND.state, p = UND.school.p[S.sel], v = UND.school.v[S.sel];
  fw.copy(v).setY(v.y * .3).normalize(); sd.crossVectors(up, fw).normalize();
  const side = lang === 'ar' ? -1 : 1; fol.side += (side - fol.side) * Math.min(1, dt * 2);
  wantP.copy(p).addScaledVector(fw, -.9).addScaledVector(sd, 1.85).addScaledVector(up, .28).add(HERO_CAGE);
  camR.copy(sd); // fish placed off-centre, away from the card
  wantT.copy(p).addScaledVector(fw, .25).add(HERO_CAGE);
  const ofs = tv.subVectors(wantP, wantT).normalize().cross(up).normalize().multiplyScalar(-.62 * fol.side);
  wantT.add(ofs);
  const a = 1 - Math.exp(-dt * 2.2);
  fol.pos.lerp(wantP, a); fol.tgt.lerp(wantT, a);
  rig.pos.lerpVectors(rig.pos, fol.pos, fol.k < 1 ? fol.k * .2 + .02 : 1); rig.tgt.lerpVectors(rig.tgt, fol.tgt, fol.k < 1 ? fol.k * .2 + .02 : 1);
  rig.fov += (38 - rig.fov) * a * .5; rig.sway = .15;
  const dist = camera.position.distanceTo(p);
  bokeh.uniforms.focus.value = dist; bokeh.uniforms.aperture.value = .0042 * fol.k; bokeh.uniforms.maxblur.value = .0075;
}
function nextFish() { selectFish(pickFishNear(innerWidth * (lang === 'ar' ? .7 : .3), innerHeight * .5)); }
function setLang(l) {
  if (l === lang) return;
  if (shown.has('#card')) {
    gsap.timeline().to('#card', { autoAlpha: 0, x: lang === 'ar' ? -30 : 30, duration: .3, ease: 'power2.in' }).call(() => applyLang(l)).fromTo('#card', { autoAlpha: 0, x: l === 'ar' ? -60 : 60 }, { autoAlpha: 1, x: 0, duration: .7, ease: 'power3.out' });
  } else applyLang(l);
}
function showEnd() {
  hideAll(); hide('#fishTag');
  gsap.to(UND.ringM.uniforms.uA, { value: 0, duration: .6 }); gsap.to(UND.state, { timeScale: 1, duration: 2 });
  gsap.to(bokeh.uniforms.aperture, { value: 0, duration: 1.2, onComplete: () => bokeh.enabled = false });
  mode = 'rig'; UND.state.sel = -1;
  const C = HERO_CAGE;
  fly([V(C.x - 3, -5.5, C.z + 6), V(C.x - 1.5, -6.5, C.z + 3)], [V(C.x, -2.5, C.z - 2), V(C.x + 1, 0, C.z - 4)], 9, 'sine.inOut', { fov: 50, sway: .4 });
  gsap.fromTo('#endcard', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6, delay: .8, ease: 'power2.out' });
  gsap.fromTo('.end-inner > *', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, stagger: .14, delay: 1.1, ease: 'power3.out' });
}

// ---------------- UI wiring ----------------
function onHotspot(id) {
  if (id === 'brood') enterBroodstock();
  else if (id === 'hatch') goHatchery();
  else if (id === 'labs') { selectHS(id); const h = HS.find(x => x.id === id); fly([V(h.pos.x - 80, 60, h.pos.z + 90)], [h.pos.clone().setY(G + 4)], 2.6, 'power2.inOut', { onComplete: openPhase1 }); }
  else if (id === 'ras') { selectHS(id); const h = HS.find(x => x.id === id); fly([V(h.pos.x - 80, 60, h.pos.z + 90)], [h.pos.clone().setY(G + 4)], 2.6); toast('toastRas', 4); }
  else if (id === 'dome') { hide('#intro'); selectHS(id); const h = HS.find(x => x.id === id); fly([V(h.pos.x - 90, 105, h.pos.z + 100)], [h.pos.clone().setY(G + 6)], 2.6, 'power2.inOut', { fov: 40 }); toast('toastDome', 4); }
  else if (id === 'cages') goSeaCages();
  else if (id === 'c03') diveCage();
  else if (id === 'l3t6') larvaeCloseUp();
}
// Laboratories opens the hosted Phase 1 ground-floor sheet. No new campus pin.
const planView = { s: 1, fit: 1, x: 0, y: 0, drag: null };
const planPts = new Map();
let planPinch = null;
function drawPlan() { $('#planImg').style.transform = `translate(${planView.x}px,${planView.y}px) scale(${planView.s})`; }
function clampPlan(s) { return Math.min(2.5, Math.max(planView.fit || .05, s)); }
function fitPlan() {
  const img = $('#planImg'), stage = $('#planStage');
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
  planView.fit = Math.min((stage.clientWidth - 28) / nw, (stage.clientHeight - 28) / nh);
  planView.s = planView.fit;
  planView.x = (stage.clientWidth - nw * planView.s) / 2;
  planView.y = (stage.clientHeight - nh * planView.s) / 2;
  drawPlan();
}
function zoomPlan(factor) {
  const stage = $('#planStage'), mx = stage.clientWidth / 2, my = stage.clientHeight / 2;
  const next = clampPlan(planView.s * factor), k = next / planView.s;
  planView.x = mx - (mx - planView.x) * k; planView.y = my - (my - planView.y) * k; planView.s = next; drawPlan();
}
function openPhase1() {
  const el = $('#plan'); el.hidden = false;
  const img = $('#planImg');
  if (img.complete && img.naturalWidth) fitPlan();
}
function closePhase1() { $('#plan').hidden = true; planPts.clear(); planView.drag = null; planPinch = null; }
$('#planImg').addEventListener('load', () => { if (!$('#plan').hidden) fitPlan(); });
$('#planClose').onclick = closePhase1;
$('#planIn').onclick = () => zoomPlan(1.25);
$('#planOut').onclick = () => zoomPlan(1 / 1.25);
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#plan').hidden) closePhase1(); });
addEventListener('resize', () => { if (!$('#plan').hidden) fitPlan(); });
{ const stage = $('#planStage');
  stage.addEventListener('wheel', e => {
    if ($('#plan').hidden) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const next = clampPlan(planView.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12)), k = next / planView.s;
    planView.x = mx - (mx - planView.x) * k; planView.y = my - (my - planView.y) * k; planView.s = next; drawPlan();
  }, { passive: false });
  stage.addEventListener('pointerdown', e => {
    planPts.set(e.pointerId, { x: e.clientX, y: e.clientY }); stage.setPointerCapture(e.pointerId);
    if (planPts.size === 1) { planView.drag = { x: e.clientX, y: e.clientY, ox: planView.x, oy: planView.y }; stage.classList.add('dragging'); }
    else if (planPts.size === 2) { planView.drag = null; const [a, b] = [...planPts.values()]; planPinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: planView.s, x: planView.x, y: planView.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!planPts.has(e.pointerId)) return;
    planPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (planPts.size === 2 && planPinch) {
      const [a, b] = [...planPts.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const next = clampPlan(planPinch.s * d / planPinch.d), r = stage.getBoundingClientRect();
      const mx = planPinch.mx - r.left, my = planPinch.my - r.top, k = next / planPinch.s;
      planView.s = next; planView.x = mx - (mx - planPinch.x) * k; planView.y = my - (my - planPinch.y) * k; drawPlan();
    } else if (planView.drag && planPts.size === 1) {
      planView.x = planView.drag.ox + e.clientX - planView.drag.x; planView.y = planView.drag.oy + e.clientY - planView.drag.y; drawPlan();
    }
  });
  const up = e => { planPts.delete(e.pointerId); if (planPts.size < 2) planPinch = null; if (!planPts.size) { planView.drag = null; stage.classList.remove('dragging'); } };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', fitPlan);
}
$('#btnStart').onclick = () => enterBroodstock();
$('#btnFree').onclick = () => { hide('#intro'); toast('toastFree'); };
$('#crumb').addEventListener('dblclick', () => { if (state.where === 'campus') enterBroodstock(); });
let campusTap = null;
$('#crumb').addEventListener('click', () => { if (state.where !== 'campus') return; if (campusTap) { clearTimeout(campusTap); campusTap = null; enterBroodstock(); } else campusTap = setTimeout(() => campusTap = null, 320); });
$('#btnToHatch').onclick = goHatchery; $('#btnLarvae').onclick = larvaeCloseUp; $('#btnToCages').onclick = goSeaCages; $('#btnDive').onclick = diveCage;
$('#btnNext').onclick = nextFish; $('#btnAR').onclick = () => toast('toastAR');
$('#btnLangCard').onclick = () => setLang(lang === 'ar' ? 'en' : 'ar');
document.querySelectorAll('#langToggle button').forEach(b => b.onclick = () => setLang(b.dataset.l));
document.querySelectorAll('#nav a').forEach(a => a.onclick = () => ({ campus: goCampus, facilities: enterBroodstock, cages: goSeaCages, species: () => W === UND ? nextFish() : diveCage(), trace: goHatchery })[a.dataset.nav]());
{ let down = null; renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; if (W === UND) { const i = pickFishNear(e.clientX, e.clientY); if (i >= 0) selectFish(i); } }); }
controls.addEventListener('start', () => {});

// ---------------- illustrative live values ----------------
function liveValues() {
  if (shown.has('#brood')) { $('#vTemp').textContent = (24.6 + Math.sin(T * .7) * .04).toFixed(1); $('#vSal').textContent = (38.2 + Math.sin(T * .4 + 1) * .05).toFixed(1); $('#vO2').textContent = (7.1 - pp * .2 + Math.sin(T * .9) * .05).toFixed(1); $('#vPh').textContent = (8.10 + Math.sin(T * .5 + 2) * .01).toFixed(2); }
  if (shown.has('#card')) { $('#fT').textContent = (26.4 + Math.sin(T * .6) * .05).toFixed(1); $('#fO').textContent = (6.8 + Math.sin(T * .8 + 1) * .05).toFixed(1); }
  if (shown.has('#depth') || W === UND) { const d = Math.max(0, -camera.position.y); $('#depthVal').textContent = d.toFixed(1); $('#depthBar').style.top = Math.min(136, d / 12 * 136) + 'px'; }
}

// ---------------- guided demo (?demo=1): a scripted cursor presses the real UI ----------------
const cur = { x: innerWidth * .55, y: innerHeight * .62 }, curEl = $('#cursor');
function curDraw() { curEl.style.transform = `translate(${cur.x - 5}px,${cur.y - 3}px)`; }
function center(el) { const r = (typeof el === 'string' ? $(el) : el).getBoundingClientRect(); return { x: r.left + r.width * .5, y: r.top + r.height * .55 }; }
function moveTo(get, dur = 1.1) { const o = { p: 0 }; let s; return gsap.to(o, { p: 1, duration: dur, ease: 'power2.inOut', onUpdate() { if (!s) s = { ...cur }; const g = get(); cur.x = s.x + (g.x - s.x) * o.p; cur.y = s.y + (g.y - s.y) * o.p; curDraw(); } }); }
function press(sel, fn) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  gsap.fromTo('#cursor .ripple', { scale: .3, opacity: .95 }, { scale: 1.35, opacity: 0, duration: .7, ease: 'power2.out' });
  gsap.fromTo('#cursor svg', { scale: .85 }, { scale: 1, duration: .25, transformOrigin: '20% 10%' });
  if (el) { el.classList.add('pressed'); gsap.delayedCall(.16, () => el.classList.remove('pressed')); }
  fn ? fn() : el.click();
}
function heroFish() { // a well-placed fish in front of the camera
  let best = -1, bs = 1e9;
  UND.school.p.forEach((p, i) => { pv.copy(p).project(camera); if (pv.z > 1) return; const dist = camera.position.distanceTo(p); const sx = pv.x, sy = pv.y; const score = Math.hypot(sx + .15, sy + .05) * 6 + Math.abs(dist - 5.5); if (Math.abs(sx) < .7 && Math.abs(sy) < .6 && dist > 3.5 && dist < 9 && score < bs) { bs = score; best = i; } });
  return best;
}
function runDemo() {
  curEl.style.display = 'block'; gsap.set(curEl, { autoAlpha: 0 }); curDraw();
  const tl = gsap.timeline();
  const C = (time, fn) => tl.call(fn, null, time);
  C(5.0, () => gsap.to(curEl, { autoAlpha: 1, duration: .4 }));
  C(5.1, () => moveTo(() => center('#btnStart'), 1.2));
  C(6.5, () => press(null, enterBroodstock));
  // broodstock: drag the photoperiod (really dims the hall), then back
  C(16.6, () => moveTo(() => center('#ppKnob'), 1.1));
  C(17.9, () => { press(null, () => {}); const o = { v: 0 }; gsap.to(o, { v: .78, duration: 1.9, ease: 'power1.inOut', onUpdate() { setPP(o.v); const c = center('#ppKnob'); cur.x = c.x; cur.y = c.y; curDraw(); } }); });
  C(21.0, () => { const o = { v: .78 }; gsap.to(o, { v: 0, duration: 1.5, ease: 'power1.inOut', onUpdate() { setPP(o.v); const c = center('#ppKnob'); cur.x = c.x; cur.y = c.y; curDraw(); } }); });
  C(23.0, () => moveTo(() => center('#btnToHatch'), 1.0));
  C(24.2, () => press('#btnToHatch'));
  C(31.4, () => moveTo(() => center('#btnLarvae'), 1.1));
  C(32.6, () => press('#btnLarvae'));
  C(38.4, () => moveTo(() => center('#btnToCages'), 1.0));
  C(39.6, () => press('#btnToCages'));
  C(47.0, () => moveTo(() => center('#btnDive'), 1.1));
  C(48.3, () => press('#btnDive'));
  let fishI = -1;
  C(56.0, () => { fishI = heroFish(); moveTo(() => { pv.copy(UND.school.p[fishI]).project(camera); return { x: (pv.x * .5 + .5) * innerWidth, y: (-pv.y * .5 + .5) * innerHeight }; }, 1.3); });
  C(57.4, () => press(null, () => selectFish(fishI)));
  C(58.2, () => gsap.to(curEl, { autoAlpha: 0, duration: .5 }));
  C(62.6, () => { gsap.to(curEl, { autoAlpha: 1, duration: .3 }); moveTo(() => center('#btnLangCard'), 1.1); });
  C(63.9, () => press('#btnLangCard'));
  C(68.6, () => moveTo(() => center('#langToggle button[data-l=en]'), 1.2));
  C(69.9, () => press('#langToggle button[data-l=en]'));
  C(71.0, () => gsap.to(curEl, { autoAlpha: 0, duration: .5 }));
  C(72.4, () => showEnd());
  return tl;
}
export const DEMO_LENGTH = 82;

// ---------------- frame loop ----------------
function step(dt) {
  T += dt; gsap.updateRoot(T);
  applyCamera(dt); camera.updateMatrixWorld();
  W.update(dt, T, camera);
  liveValues(); projectHotspots();
}
async function boot() {
  const fonts = ['500 20px "Cormorant Garamond"', 'italic 400 20px "Cormorant Garamond"', '600 20px "Cormorant Garamond"', '400 16px Inter', '600 16px Inter', '400 20px "Noto Naskh Arabic"', '400 16px "Noto Sans Arabic"', '600 16px "Noto Sans Arabic"'];
  await Promise.all(fonts.map(f => document.fonts.load(f, 'Aaهامور'))); await document.fonts.ready;
  gsap.updateRoot(0); console.log('gsap t0', gsap.globalTimeline.time());
  applyLang('en');
  // warm up every world once so shader compilation does not stall the first transition
  for (const w of [BRD, HAT, UND, EXT]) { useWorld(w); w.update(0, 0, camera); renderer.compile(w.scene, camera); render(); }
  useWorld(EXT); applyCamera(0);
  $('#loading').style.display = 'none';
  goCampus(); gsap.to(veil, { opacity: 0, duration: 1.4, ease: 'power2.out', delay: .1 });
  if (DEMO) runDemo();
  if (CAPTURE) {
    window.__frame = dt => { step(dt ?? 1 / 30); render(); };
    window.__advance = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt); };
    window.__T = () => T;
    step(0); render(); window.__ready = true;
  } else {
    let last = performance.now();
    const loop = now => { const rd = (now - last) / 1000; last = now; adapt(rd); step(Math.min(rd, 1 / 20)); render(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
}
boot();
