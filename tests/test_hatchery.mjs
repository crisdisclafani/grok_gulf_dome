import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../app/', import.meta.url);
const hatch = fs.readFileSync(new URL('js/hatch.js', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');
const brood = fs.readFileSync(new URL('js/brood.js', root), 'utf8');
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const exterior = fs.readFileSync(new URL('js/exterior.js', root), 'utf8');

test('phase 2 hatchery is a built interior, not a drawing', () => {
  assert.match(hatch, /export const HERO_TANK/);
  assert.match(hatch, /export const HATCH_APPROACH/);
  assert.match(hatch, /whiteboard\.jpg/);
  assert.match(hatch, /TIER > 1 \? 20000 : 8000/);
  assert.match(hatch, /InstancedMesh/);
  assert.doesNotMatch(hatch, /\.pdf|autocad|SITE PLAN|phase1-ground-floor/i);
  assert.doesNotMatch(main, /SITE PLAN/i);
});

test('laboratories pin enters a built interior instead of the plan viewer', () => {
  const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');
  const phase1 = fs.readFileSync(new URL('js/phase1.js', root), 'utf8');
  const labs = main.split("id === 'labs'")[1].split('else if')[0];
  assert.match(labs, /enterPhase1/);
  assert.doesNotMatch(labs, /openPhase1|useWorld|goHatchery|toastLabs/);
  assert.match(main, /function enterPhase1/);
  assert.match(main, /buildPhase1/);
  assert.match(main, /useWorld\(P1\)/);
  assert.doesNotMatch(html, /id="plan"|planImg|phase1-ground-floor/);
  assert.doesNotMatch(phase1, /phase1-ground-floor|\.pdf|TextureLoader/i);
  assert.match(exterior, /id: 'phase1'/);
  assert.match(exterior, /shed\(LABS\.x, LABS\.z, 52, 60, 9/);
  assert.doesNotMatch(exterior, /phase1-ground-floor/);
  assert.match(exterior, /id: 'hatch'/);
  for (const key of ['phase1Title', 'phase1Lead', 'phase1Fine', 'hsLarval']) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, 'g')) || [];
    assert.equal(matches.length, 2, `${key} must exist in EN and AR`);
  }
  assert.match(i18n, /endBy: 'Concept by Kriswa International'/);
  assert.equal(fs.existsSync(new URL('docs/phase1-ground-floor.jpg', root)), true);
  assert.equal(fs.existsSync(new URL('docs/phase1-ground-floor.pdf', root)), true);
});

test('hatchery journey still flies the aisle and closes on L3T6', () => {
  assert.match(main, /HATCH_APPROACH/);
  assert.match(main, /function goHatchery\(\)/);
  assert.match(main, /id === 'hatch'\) goHatchery/);
  assert.match(main, /HERO_TANK/);
  const hatchery = main.slice(main.indexOf('function goHatchery'), main.indexOf('function larvaeCloseUp'));
  const larvae = main.slice(main.indexOf('function larvaeCloseUp'), main.indexOf('function goSeaCages'));
  assert.match(larvae, /HERO_TANK/);
  assert.match(larvae, /fly\(/);
  assert.match(larvae, /offerDetail\('tank'\)/);
  assert.doesNotMatch(hatchery, /show\('#lifecycle'|show\('#tank'/);
  assert.match(main, /btnToHatch/);
  assert.match(main, /btnLarvae/);
});

test('broodstock photoperiod and entry stay wired', () => {
  assert.match(brood, /function setPhoto/);
  assert.match(brood, /CLUSTERS/);
  assert.match(main, /function enterBroodstock/);
  assert.match(main, /buildBrood/);
  assert.match(main, /setPP\(0\)/);
  const entry = main.slice(main.indexOf('function enterBroodstock'), main.indexOf('function goHatchery'));
  assert.doesNotMatch(entry, /show\('#brood'/);
});

test('dome, still sea, and hidden intro are untouched', () => {
  assert.match(exterior, /const domeX = -175, domeZ = 60;/);
  assert.match(exterior, /the surface cannot ripple, foam, or shimmer/);
  assert.match(main, /else if \(id === 'dome'\)/);
  assert.doesNotMatch(main, /show\('#intro'/);
});
