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

test('laboratories opens the hosted Phase 1 sheet and adds no campus pin', () => {
  const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');
  const labs = main.split("id === 'labs'")[1].split('else if')[0];
  assert.match(labs, /fly\(/);
  assert.match(labs, /openPhase1/);
  assert.doesNotMatch(labs, /useWorld|goHatchery|toastLabs/);
  assert.match(html, /docs\/phase1-ground-floor\.jpg/);
  assert.match(html, /docs\/phase1-ground-floor\.pdf/);
  assert.match(html, /id="plan"/);
  assert.doesNotMatch(exterior, /id: 'phase1'|hsPhase/);
  assert.match(exterior, /id: 'labs'/);
  assert.match(exterior, /id: 'hatch'/);
  for (const key of ['phase1Title', 'phase1Close', 'phase1Pdf']) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, 'g')) || [];
    assert.equal(matches.length, 2, `${key} must exist in EN and AR`);
  }
  assert.equal(fs.existsSync(new URL('docs/phase1-ground-floor.jpg', root)), true);
  assert.equal(fs.existsSync(new URL('docs/phase1-ground-floor.pdf', root)), true);
});

test('hatchery journey still flies the aisle and closes on L3T6', () => {
  assert.match(main, /HATCH_APPROACH/);
  assert.match(main, /function goHatchery\(\)/);
  assert.match(main, /id === 'hatch'\) goHatchery/);
  assert.match(main, /HERO_TANK/);
  const larvae = main.slice(main.indexOf('function larvaeCloseUp'), main.indexOf('function goSeaCages'));
  assert.match(larvae, /HERO_TANK/);
  assert.match(larvae, /fly\(/);
  assert.match(main, /show\('#lifecycle'/);
  assert.match(main, /show\('#tank'/);
  assert.match(main, /btnToHatch/);
  assert.match(main, /btnLarvae/);
});

test('broodstock photoperiod and entry stay wired', () => {
  assert.match(brood, /function setPhoto/);
  assert.match(brood, /CLUSTERS/);
  assert.match(main, /function enterBroodstock/);
  assert.match(main, /buildBrood/);
  assert.match(main, /setPP\(0\)/);
  assert.match(main, /show\('#brood'/);
});

test('dome, still sea, and hidden intro are untouched', () => {
  assert.match(exterior, /const domeX = -175, domeZ = 60;/);
  assert.match(exterior, /vec2 dh=vec2\(0\.\); \/\/ Still water/);
  assert.match(main, /else if \(id === 'dome'\)/);
  assert.doesNotMatch(main, /show\('#intro'/);
});
