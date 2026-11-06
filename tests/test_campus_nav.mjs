import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CAMERA_CLEARANCE, CAMPUS_MAX_DISTANCE, CAMPUS_MIN_DISTANCE, G, LABS, SEA_BED,
  campusApproach, constrainCampusCamera, dropSeabed, landHeight, shoreX, stepCampusDolly, surfaceY,
} from '../app/js/campus-nav.js';

const root = new URL('../app/', import.meta.url);
const exterior = fs.readFileSync(new URL('js/exterior.js', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');
const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');
const css = fs.readFileSync(new URL('css/app.css', root), 'utf8');

test('Phase 1 pin is on the laboratories building and is labeled Phase 1', () => {
  assert.equal(LABS.x, -120);
  assert.equal(LABS.z, -110);
  assert.match(exterior, /shed\(LABS\.x, LABS\.z, 52, 60, 9/);
  assert.equal((exterior.match(/^\s*shed\(/gm) || []).length, 5);
  assert.match(exterior, /id: 'phase1', pos: new THREE\.Vector3\(LABS\.x, G \+ 20, LABS\.z\), key: 'hsPhase1', sub: 'hsLabs'/);
  assert.doesNotMatch(exterior, /id: 'labs'/);
  assert.match(i18n, /hsPhase1: 'Phase 1'/);
  assert.match(i18n, /hsPhase1: 'المرحلة 1'/);
  assert.match(css, /\.hs\.phase1/);
  assert.match(main, /classList\.toggle\('phase1', h\.id === 'phase1'\)/);
  const fly = main.slice(main.indexOf('function flyToCampus'), main.indexOf('function onHotspot'));
  assert.match(fly, /campusApproach/);
  assert.match(fly, /sway: 0/);
  assert.match(fly, /if \(id === 'phase1' \|\| id === 'labs'\) enterPhase1\(\)/);
});

test('every first-level campus pin flies to that point before entering it', () => {
  const fly = main.slice(main.indexOf('function flyToCampus'), main.indexOf('function onHotspot'));
  const click = main.slice(main.indexOf('function onHotspot'), main.indexOf('function larvalCloseUp'));
  assert.match(click, /flyToCampus\(id\)/);
  for (const id of ['phase1', 'hatch', 'brood', 'ras', 'dome', 'cages']) {
    assert.match(fly, new RegExp(`id === '${id}'`));
  }
  assert.match(fly, /else if \(id === 'hatch'\) goHatchery\(\)/);
  assert.match(fly, /else if \(id === 'brood'\) enterBroodstock\(true\)/);
  assert.match(fly, /else if \(id === 'cages'\) goSeaCages\(true\)/);
  assert.match(fly, /else if \(id === 'dome'\)/);
  assert.match(fly, /toast\('toastDome', 4\)/);
  assert.match(fly, /toast\('toastRas', 4\)/);
  assert.doesNotMatch(fly, /useWorld|veilSwap/);
  const from = { x: -290, y: 175, z: 270 };
  const look = { x: -35, y: 0, z: -25 };
  const pin = { x: LABS.x, y: G + 20, z: LABS.z };
  const path = campusApproach(from, look, pin, 'phase1');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  assert.ok(dist(path.end, pin) < dist(from, pin), 'the flight ends nearer the pin than it started');
  assert.ok(path.mid.y > from.y && path.mid.y > path.end.y, 'the flight arcs above the rooftops');
  assert.ok(path.dur >= 1.85 && path.dur <= 3.2);
  assert.equal(path.sway, 0);
  assert.ok(dist(path.mid, from) > 10 && dist(path.end, from) > 10, 'the flight is not a snap in place');
});

test('the gulf stays still when the camera moves in close', () => {
  assert.match(exterior, /dropSeabed\(/);
  assert.match(exterior, /polygonOffset = true/);
  assert.match(exterior, /vec3 eye=vec3\(-290\.,175\.,270\.\)/);
  assert.doesNotMatch(exterior, /cameraPosition\s*-/);
  assert.doesNotMatch(exterior, /uTime|float foam/);
  assert.ok(SEA_BED <= -16);
  for (const z of [-500, -120, 0, 240, 900]) {
    for (const x of [180, 420, 900, 2200]) {
      assert.ok(shoreX(z) < x, `${x},${z} is offshore`);
      const bed = dropSeabed(landHeight(x, z));
      assert.equal(bed, SEA_BED);
      assert.ok(surfaceY(x, z) === 0);
      assert.ok(-bed >= 16);
    }
  }
  const inland = dropSeabed(landHeight(-35, -25));
  assert.ok(inland > 1, 'the campus ground is not dropped into the seabed');
});

test('zooming in does not lock at 20m or sink the camera into the sea', () => {
  assert.ok(CAMPUS_MIN_DISTANCE < 12);
  assert.ok(CAMPUS_MAX_DISTANCE > 700);
  assert.match(main, /controls\.minDistance = W === EXT \? CAMPUS_MIN_DISTANCE/);
  assert.match(main, /constrainCampusCamera/);
  assert.doesNotMatch(main, /minDistance = W === EXT \? 20/);
  const floorY = G + CAMERA_CLEARANCE;
  let state = { radius: 427.4, phi: 1.149, targetY: 0, floorY };
  let passedOldLock = false;
  for (let i = 0; i < 70; i++) {
    state = stepCampusDolly(state, 0.9);
    assert.ok(state.camY >= floorY - 0.02, `camera sank to ${state.camY}`);
    if (state.radius < 12) passedOldLock = true;
  }
  assert.ok(passedOldLock, 'dolly keeps moving past the old 20m stop');
  const parked = { ...state };
  for (let i = 0; i < 15; i++) state = stepCampusDolly(state, 0.8);
  assert.ok(Math.abs(state.camY - parked.camY) < 0.05, 'holding zoom at the floor does not jitter');
  assert.ok(Math.abs(state.radius - parked.radius) < 0.05);
  const low = constrainCampusCamera({ x: 10, y: 0.2, z: 4 }, { x: 0, y: 0, z: 0 }, floorY);
  assert.ok(low.camY >= floorY - 0.001);
  assert.ok(low.maxPolar < 1.2);
});
