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
  assert.doesNotMatch(hatch, /\.pdf|autocad|SITE PLAN/i);
  assert.doesNotMatch(html, /\.pdf|autocad/i);
  assert.doesNotMatch(main, /\.pdf|SITE PLAN/i);
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
