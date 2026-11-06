import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../app/', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const css = fs.readFileSync(new URL('css/app.css', root), 'utf8');
const main = fs.readFileSync(new URL('js/main.js', root), 'utf8');
const i18n = fs.readFileSync(new URL('js/i18n.js', root), 'utf8');

test('standing chrome is removed from the 3D view', () => {
  assert.match(css, /header\.top,#crumb,#levels,#conceptNote,#lifecycle,#brood,#depth,#tapHint,#endcard\{display:none!important\}/);
  assert.match(html, /<header class="top glass" hidden>/);
  assert.match(html, /id="langToggle"/);
  assert.ok(html.indexOf('id="langToggle"') < html.indexOf('<header'), 'language control sits outside the hidden header');
  assert.match(html, /id="homeBtn"/);
  assert.match(html, /id="detailChip"[^>]*hidden/);
  assert.doesNotMatch(main, /show\('#intro'|show\('#brood'|show\('#lifecycle'|show\('#tank'|show\('#cages'|show\('#card'|show\('#depth'|show\('#tapHint'/);
});

test('last-level detail starts closed and only then can open', () => {
  assert.match(main, /function offerDetail\(kind\)/);
  assert.match(main, /detailOpen = false/);
  assert.match(main, /aria-expanded', detailOpen \? 'true' : 'false'/);
  const cages = main.slice(main.indexOf('function goSeaCages'), main.indexOf('function diveCage'));
  const fish = main.slice(main.indexOf('function selectFish'), main.indexOf('function nextFish'));
  assert.match(cages, /offerDetail\('cage'\)/);
  assert.doesNotMatch(cages, /show\('#cages'/);
  assert.match(fish, /offerDetail\('fish'\)/);
  assert.doesNotMatch(fish, /show\('#card'/);
});

test('language and detail labels exist in English and Arabic', () => {
  for (const key of ['detailMore', 'detailLess', 'navCampus']) {
    const matches = i18n.match(new RegExp(`\\b${key}:`, 'g')) || [];
    assert.equal(matches.length, 2, `${key} must exist in EN and AR`);
  }
});

test('laboratories enter the Phase 1 interior with the campus control, not a plan viewer', () => {
  const labs = main.split("id === 'labs'")[1].split('else if')[0];
  assert.match(labs, /enterPhase1/);
  assert.doesNotMatch(html, /id="plan"/);
  const entry = main.slice(main.indexOf('function enterPhase1'), main.indexOf('const CAMPUS_IDS'));
  assert.match(entry, /syncHome\(\)/);
  assert.match(entry, /useWorld\(P1\)/);
  assert.doesNotMatch(entry, /offerDetail|show\('#phase1'/);
  const drill = main.slice(main.indexOf('function larvalCloseUp'), main.indexOf('function liveValues'));
  assert.match(drill, /offerDetail\('phase1'\)/);
  assert.match(main, /phase1: \{ title: 'phase1Title', panel: '#phase1' \}/);
  assert.match(main, /detailOpen = false/);
});
