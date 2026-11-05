import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../app/', import.meta.url);
const exterior = fs.readFileSync(new URL('js/exterior.js', root), 'utf8');
const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');
const css = fs.readFileSync(new URL('css/app.css', root), 'utf8');

test('exterior has one visitor dome hotspot fully inland on the eastern plaza', () => {
  assert.match(exterior, /const domeX = -25, domeZ = 20;/);
  const shoreX = z => 70 + 18 * Math.sin(z / 140) + 8 * Math.sin(z / 53 + 1);
  assert.ok(-25 + 36 * 1.08 < shoreX(20), 'entire paved plaza must be inland of shoreX');
  assert.ok(-25 - 36 * 1.08 > -215 && -25 + 36 * 1.08 < 58, 'plaza stays within compound X');
  assert.ok(20 - 36 > -255 && 20 + 36 < 235, 'plaza stays within compound Z');
  assert.match(exterior, /id: 'dome', pos: new THREE\.Vector3\(domeX, G \+ 17, domeZ\), key: 'hsDome', sub: 'hsDomeS'/);
});

test('dome uses a white elliptical ribbed shell and ground-level glass', () => {
  assert.match(exterior, /Visitor centre dome — concept geometry/);
  assert.match(exterior, /SphereGeometry\(1, 64, 24, 0, Math\.PI \* 2, 0, Math\.PI \/ 2\)/);
  assert.match(exterior, /domeShell\.scale\.set\(27, 12, 20\)/);
  assert.match(exterior, /CylinderGeometry\(24\.4, 24\.4, 5\.4, 64, 1, true\)/);
  assert.match(exterior, /glassCurtain\.scale\.x = 1\.06/);
  assert.match(exterior, /for \(let i = 0; i < 24; i\+\+\)/);
  assert.match(exterior, /CircleGeometry\(36, 64\)/);
});

test('water shader has no time-driven waves, fish shadows or shoreline foam', () => {
  assert.match(exterior, /vec2 dh=vec2\(0\.\); \/\/ Still water/);
  assert.doesNotMatch(exterior, /W\(1\.,\.2|W\(-1\.,\.3|uTime\*\.02|d\*2\.2-uTime/);
  assert.match(exterior, /float a=atan\(r\.y,r\.x\);/);
  assert.match(exterior, /float foam=0\.0;/);
});

test('dome has English and Arabic labels and concept toast', () => {
  for (const key of ['hsDome', 'hsDomeS', 'toastDome']) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, 'g')) || [];
    assert.equal(matches.length, 2, `${key} must exist in EN and AR`);
  }
  assert.match(i18n, /hsDome: 'Visitor Centre'/);
  assert.match(i18n, /hsDomeS: 'Dome · concept'/);
  assert.match(i18n, /interior comes next/);
});

test('dome hotspot selects, flies closer and shows concept toast without interior', () => {
  assert.match(main, /else if \(id === 'dome'\)/);
  const block = main.split("else if (id === 'dome')")[1].split("else if")[0];
  assert.match(block, /selectHS\(id\)/);
  assert.match(block, /fly\(/);
  assert.match(block, /toast\('toastDome', 4\)/);
  assert.doesNotMatch(block, /buildBrood|buildHatch|veilSwap|useWorld/);
});

test('large intro panel never enters the initial campus view', () => {
  assert.match(css, /#intro\s*\{[^}]*display:\s*none\s*!important/);
  assert.doesNotMatch(main, /show\('#intro'/);
});

test('guided journey remains reachable from the existing facilities navigation', () => {
  assert.match(main, /facilities:\s*enterBroodstock/);
  assert.match(main, /C\(6\.5, \(\) => press\(null, enterBroodstock\)\)/);
});
