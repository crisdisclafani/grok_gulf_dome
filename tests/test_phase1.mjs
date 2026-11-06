import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HALL, ROOMS, HANGING, nurseryTanks, weaningTanks, larvalTanks, blowers, incubators,
  LARVAL_FOCUS, PHASE1_APPROACH, assertPhase1Layout, roomById,
} from '../app/js/phase1-layout.js';

const root = new URL('../app/', import.meta.url);
const phase1 = fs.readFileSync(new URL('js/phase1.js', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');
const html = fs.readFileSync(new URL('index.html', root), 'utf8');

const SHEET_LABELS = new Set([
  'SEMI-OPEN AREA', 'AKVA BLOWERS', 'AKVA CONTROL ROOM', 'CONTROL ROOM', 'BIOSECURE AREA', 'W.C.',
  'BIO-LAB', 'RECEPTION', 'SITTING AREA', 'PRAYING AREA', 'CHANGING ROOM', 'CAFETERIA',
  'ARTEMIA DECAPSULATION', 'HEAT EXCHANGERS', 'ALGAL ROOM', 'ROTIFER ROOM', 'INCUBATIONAL TANKS',
  'COLD STORE', 'DEEP FREEZE', 'NURSERY TANKS', 'WEANING TANKS', 'LARVAL TANKS',
  'PERIPHERAL CONNECTION CORRIDOR', 'MAIN ENTRANCE', 'STAFF ENTRANCE',
]);

test('the phase 1 layout follows the ground-floor sheet', () => {
  assert.equal(assertPhase1Layout(), true);
  assert.equal(nurseryTanks.length, 8);
  assert.equal(nurseryTanks.filter(t => t.bank === 'north').length, 4);
  assert.equal(nurseryTanks.filter(t => t.bank === 'south').length, 4);
  assert.ok(nurseryTanks.every(t => Math.abs(t.hw * 2 - 5) < 0.01), 'nursery bays keep the 5.00 m module');
  assert.equal(weaningTanks.length, 16);
  assert.ok(weaningTanks.every(t => t.h === 1.3 && Math.abs(t.hw * 2 - 6.4) < 0.01 && Math.abs(t.hd * 2 - 1.85) < 0.01));
  assert.equal(larvalTanks.length, 16);
  assert.equal(new Set(larvalTanks.map(t => t.col)).size, 4);
  assert.equal(new Set(larvalTanks.map(t => t.row)).size, 4);
  assert.equal(blowers.length, 8);
  assert.equal(incubators.length, 14);
  for (const id of [
    'semiOpen', 'blowers', 'peripheral', 'reception', 'cafeteria', 'mainEntrance', 'staffEntrance',
    'algal', 'rotifer1', 'rotifer2', 'incubational', 'coldStore', 'deepFreeze', 'heatExchangers', 'artemia',
    'biosecure', 'praying', 'changing', 'server', 'control',
  ]) assert.ok(ROOMS.some(r => r.id === id), id);
  const peri = roomById('peripheral');
  assert.ok(peri.z < 0 && peri.z < Math.min(...nurseryTanks.filter(t => t.bank === 'south').map(t => t.z)));
  assert.ok(roomById('mainEntrance').z < HALL.z0 + 0.2);
  assert.ok(roomById('staffEntrance').z > HALL.z1 - 0.2);
  assert.ok(roomById('canopy').z < roomById('mainEntrance').z);
  const labels = [...ROOMS.filter(r => r.sign).map(r => r.sign), ...HANGING.map(s => s.text)];
  for (const label of labels) assert.ok(SHEET_LABELS.has(label), label);
  assert.doesNotMatch(phase1, /dormitor|parking|waste storage|broodstock|sedimentation/i);
});

test('phase 1 destination is the 3D hall, and the plan is not the interior', () => {
  assert.match(phase1, /export function buildPhase1/);
  assert.match(phase1, /phase1-layout\.js/);
  assert.match(phase1, /InstancedMesh/);
  assert.match(phase1, /RoomEnvironment/);
  assert.match(phase1, /TIER > 1/);
  assert.doesNotMatch(phase1, /phase1-ground-floor|autocad|SITE PLAN|\.jpg|\.pdf/i);
  assert.match(main, /function enterPhase1/);
  assert.match(main, /PHASE1_APPROACH/);
  assert.match(main, /id === 'larval'\) larvalCloseUp/);
  const entry = main.slice(main.indexOf('function enterPhase1'), main.indexOf('const CAMPUS_IDS'));
  assert.match(entry, /useWorld\(P1\)/);
  assert.doesNotMatch(entry, /#plan|openPhase1|phase1-ground-floor/);
  assert.doesNotMatch(html, /id="plan"|<img[^>]+phase1/);
  assert.match(html, /id="phase1"/);
  assert.match(html, /id="homeBtn"/);
  assert.equal(PHASE1_APPROACH.dur > 6 && PHASE1_APPROACH.dur < 12, true);
  assert.ok(LARVAL_FOCUS.r > 1);
  assert.equal(fs.existsSync(new URL('docs/phase1-ground-floor.pdf', root)), true);
});
