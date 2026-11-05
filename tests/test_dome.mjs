import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../app/', import.meta.url);
const exterior = fs.readFileSync(new URL('js/exterior.js', root), 'utf8');
const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');
const css = fs.readFileSync(new URL('css/app.css', root), 'utf8');

test('entire dome plaza is inland and clear of every existing structure', () => {
  const domeX = -175, domeZ = 60, radius = 36 * 1.08;
  assert.match(exterior, /const domeX = -175, domeZ = 60;/);
  const shoreX = z => 70 + 18 * Math.sin(z / 140) + 8 * Math.sin(z / 53 + 1);
  assert.ok(domeX + radius < shoreX(domeZ), 'entire paved plaza must be inland');
  assert.ok(domeX - radius > -215 && domeX + radius < 58, 'plaza stays within compound X');
  assert.ok(domeZ - 36 > -255 && domeZ + 36 < 235, 'plaza stays within compound Z');
  const buildings = [
    ['hatchery', -10, -95, 64, 70], ['brood hall 1', -5, 10, 70, 26],
    ['brood hall 2', -5, 42, 70, 26], ['labs', -120, -110, 52, 60],
    ['RAS', -115, 10, 42, 42], ['wave roof', -110, 120, 66, 46],
    ['parking canopies', -12, 130, 76, 44],
  ];
  for (const [name, x, z, w, d] of buildings) {
    const distance = Math.hypot(Math.max(Math.abs(domeX - x) - w / 2, 0), Math.max(Math.abs(domeZ - z) - d / 2, 0));
    assert.ok(distance > radius, `${name} must clear the dome plaza beyond the plaza; got ${distance}`);
  }
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
  assert.match(exterior, /the surface cannot ripple, foam, or shimmer/);
  assert.doesNotMatch(exterior, /uTime|float foam/);
  assert.match(exterior, /float a=atan\(r\.y,r\.x\);/);
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
