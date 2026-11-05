import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../app/', import.meta.url);
const exterior = fs.readFileSync(new URL('js/exterior.js', root), 'utf8');
const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');

test('exterior has one visitor dome hotspot in a free shore-side plaza', () => {
  assert.match(exterior, /const domeX = 48, domeZ = -190;/);
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
