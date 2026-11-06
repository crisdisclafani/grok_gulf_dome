// Phase 1 ground floor, read from as-built sheet MRC-AB-00A-02-003.
// The drawing is used for arrangement only: two nursery banks of 5.00 m bays,
// weaning modules noted 6.40 × 1.85 × 1.30, a 4×4 field of circular larval tanks,
// the peripheral connection corridor on the south, and the rooms the sheet names.
// The nursery run is shortened from the 15.90 m note so one hall can hold the
// galleries; widths, gaps, order, and the labeled counts are kept.
// Unlabeled site areas (roads, future plots) are not given a program.

export const HALL = { x0: 0, x1: 106, z0: -21.4, z1: 21.4, h: 7.35, aisle: 1.45 };

const room = (id, x, z, w, d, extra = {}) => ({ id, kind: 'room', x, z, w, d, ...extra });

export const ROOMS = [
  room('semiOpen', 8.7, 18.7, 15, 4.4, { face: 's', sign: 'SEMI-OPEN AREA' }),
  room('blowers', 24.0, 18.7, 14.4, 4.4, { face: 's', sign: 'AKVA BLOWERS' }),
  room('storage', 33.4, 18.7, 3.6, 4.4, { face: 's', solid: true }),
  room('akvaControl', 37.2, 8.2, 5.2, 9.0, { face: 's', sign: 'AKVA CONTROL ROOM' }),

  room('disinfection', 60.35, 6.95, 5.7, 8.5, { face: 's' }),
  room('server', 65.85, 5.65, 4.7, 5.9, { face: 's', solid: true }),
  room('eleRoom', 71.0, 5.65, 5.0, 5.9, { face: 's', solid: true }),
  room('emArea', 65.85, 12.2, 4.7, 6.4, { face: 's', solid: true }),
  room('control', 71.0, 12.3, 5.0, 6.6, { face: 's', sign: 'CONTROL ROOM' }),

  room('biosecure', 58.95, -5.75, 2.9, 6.1, { face: 'n', sign: 'BIOSECURE AREA' }),
  room('wcMen', 62.25, -5.75, 2.9, 6.1, { face: 'n', sign: 'W.C.' }),
  room('wcWomen', 65.55, -5.75, 2.9, 6.1, { face: 'n', sign: 'W.C.' }),
  room('biosecureAir', 68.55, -5.75, 2.8, 6.1, { face: 'n' }),
  room('bioLab', 71.9, -5.75, 3.2, 6.1, { face: 'n', sign: 'BIO-LAB' }),
  room('reception', 60.75, -12.0, 6.5, 5.2, { face: 'n', sign: 'RECEPTION' }),
  room('security', 66.5, -12.0, 4.2, 4.8, { face: 'n' }),
  room('sitting', 71.25, -11.8, 4.5, 5.2, { face: 'n', sign: 'SITTING AREA' }),
  room('praying', 60.35, -18.0, 5.7, 5.6, { face: 'n', sign: 'PRAYING AREA' }),
  room('changing', 66.0, -18.0, 4.8, 5.6, { face: 'n', sign: 'CHANGING ROOM' }),
  room('kitchenette', 71.15, -18.15, 4.7, 5.3, { face: 'n' }),

  room('cafeteria', 81.5, 18.65, 10, 4.5, { face: 's', sign: 'CAFETERIA' }),
  room('garbage', 89.6, 18.65, 5.2, 4.5, { face: 's', solid: true }),
  room('artemia', 100.5, 18.55, 8, 4.7, { face: 's', sign: 'ARTEMIA DECAPSULATION' }),
  room('heatExchangers', 101.7, 8.5, 7, 8.6, { face: 'w', solid: true, sign: 'HEAT EXCHANGERS' }),

  room('algal', 78.6, -15.05, 4.6, 3.1, { face: 'n', sign: 'ALGAL ROOM' }),
  room('rotifer1', 83.4, -15.05, 4.6, 3.1, { face: 'n', sign: 'ROTIFER ROOM' }),
  room('rotifer2', 88.2, -15.05, 4.6, 3.1, { face: 'n' }),
  room('lab', 92.6, -15.05, 3.8, 3.1, { face: 'n' }),
  room('incubational', 98.0, -15.05, 6.6, 3.1, { face: 'n', sign: 'INCUBATIONAL TANKS' }),

  room('coldStore', 78.0, -19.15, 3.6, 3.3, { face: 'n', solid: true, sign: 'COLD STORE' }),
  room('deepFreeze', 82.0, -19.15, 3.6, 3.3, { face: 'n', solid: true, sign: 'DEEP FREEZE' }),
  room('store', 86.0, -19.15, 3.6, 3.3, { face: 'n', solid: true }),
  room('ichthyologists', 90.2, -19.15, 4.0, 3.3, { face: 'n' }),
  room('hatcheryManager', 94.4, -19.15, 3.8, 3.3, { face: 'n' }),
  room('maintenance', 98.4, -19.15, 3.6, 3.3, { face: 'n', solid: true }),
  room('emRoom', 102.2, -19.15, 3.4, 3.3, { face: 'n', solid: true }),

  { id: 'peripheral', kind: 'corridor', x: 28, z: -19.5, w: 56, d: 3.4 },
  { id: 'mainEntrance', kind: 'door', x: 66, z: -21.35, w: 5.2, d: 0.35 },
  { id: 'staffEntrance', kind: 'door', x: 61.5, z: 21.35, w: 4.4, d: 0.35 },
  { id: 'canopy', kind: 'canopy', x: 66, z: -23.55, w: 11, d: 3.6 },
];

export const DIVIDERS = [33.4, 40.6, 56.5, 74.7, 96.1];

function bank(xs, z, hw, hd) {
  return xs.map(x => ({ x, z, hw, hd, shape: 'race' }));
}

// Four 5.00 m bays, 1.50 m gaps, funnel end toward the central aisle.
const NURSERY_X = [5.25, 11.75, 18.25, 24.75];
const NURSERY_HW = 2.5;
const NURSERY_HD = 6.1;
export const nurseryTanks = [
  ...bank(NURSERY_X, 8.55, NURSERY_HW, NURSERY_HD).map(t => ({ ...t, bank: 'north' })),
  ...bank(NURSERY_X, -8.55, NURSERY_HW, NURSERY_HD).map(t => ({ ...t, bank: 'south' })),
];

// Sheet note on the weaning block: 6.40 × 1.85 × 1.30. Two files each side of the aisle.
const WEAN_X = [44.6, 52.5];
const WEAN_Z = [3.425, 5.775, 8.125, 10.475];
export const weaningTanks = [];
for (const x of WEAN_X) for (const z of WEAN_Z) {
  weaningTanks.push({ x, z, hw: 3.2, hd: 0.925, h: 1.3, shape: 'rect', bank: 'north' });
  weaningTanks.push({ x, z: -z, hw: 3.2, hd: 0.925, h: 1.3, shape: 'rect', bank: 'south' });
}

const LARVAL_X = [77.2, 82.6, 88.0, 93.4];
const LARVAL_Z = [-9.35, -3.45, 3.45, 9.35];
export const LARVAL_R = 1.72;
export const larvalTanks = [];
LARVAL_X.forEach((x, col) => LARVAL_Z.forEach((z, row) => {
  larvalTanks.push({ x, z, hw: LARVAL_R, hd: LARVAL_R, r: LARVAL_R, shape: 'round', col, row });
}));

export const LARVAL_FOCUS = larvalTanks.find(t => t.col === 1 && t.row === 2);
export const LARVAL_VIEW = { x: LARVAL_FOCUS.x, y: 1.9, z: 0.12 };

export function roomById(id) {
  const r = ROOMS.find(item => item.id === id);
  if (!r) throw new Error('missing room ' + id);
  return r;
}

export const blowers = (() => {
  const room = roomById('blowers');
  const n = 8;
  const x0 = room.x - room.w / 2 + 1.15;
  const x1 = room.x + room.w / 2 - 1.15;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + (x1 - x0) * i / (n - 1), z: room.z, r: 0.42 }));
})();

export const incubators = (() => {
  const room = roomById('incubational');
  const cols = 7, rows = 2;
  const x0 = room.x - room.w / 2 + 0.55;
  const x1 = room.x + room.w / 2 - 0.55;
  const z0 = room.z - room.d / 2 + 0.5;
  const z1 = room.z + room.d / 2 - 0.5;
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ x: x0 + (x1 - x0) * c / (cols - 1), z: z0 + (z1 - z0) * r / (rows - 1), r: 0.16 });
  }
  return out;
})();

// Plaques use the sheet's own room names. Nothing else is labeled.
export const HANGING = [
  { text: 'NURSERY TANKS', x: 15, y: 4.55, z: 0, ry: Math.PI / 2 },
  { text: 'WEANING TANKS', x: 48.5, y: 4.55, z: 0, ry: Math.PI / 2 },
  { text: 'LARVAL TANKS', x: 85.2, y: 4.62, z: 0, ry: Math.PI / 2 },
  { text: 'PERIPHERAL CONNECTION CORRIDOR', x: 18, y: 2.7, z: -18.7, ry: 0 },
  { text: 'MAIN ENTRANCE', x: 66, y: 3.25, z: -20.55, ry: 0 },
  { text: 'STAFF ENTRANCE', x: 61.5, y: 3.25, z: 20.55, ry: Math.PI },
];

export const PHASE1_APPROACH = {
  dur: 9.2,
  desktop: {
    fov0: 48, fov1: 38,
    place: [3.4, 2.62, 0.12], look: [16, 1.2, 0.02],
    pts: [[18, 2.5, -0.18], [37, 2.7, 0.16], [52, 2.52, -0.08], [66, 2.95, 0.18], [84, 2.62, -0.1]],
    tgts: [[26, 1.12, 0.04], [46, 1.12, -0.1], [62, 1.25, -7.2], [78, 1.16, 0.15], [96, 1.05, 0.02]],
  },
  mobile: {
    fov0: 50, fov1: 44,
    place: [3.6, 3.15, 0.08], look: [15, 1.35, 0],
    pts: [[18, 3.05, -0.12], [37, 3.15, 0.1], [52, 3.0, -0.06], [66, 3.25, 0.12], [83, 3.05, -0.06]],
    tgts: [[24, 1.2, 0], [46, 1.2, -0.2], [62, 1.35, -6.4], [78, 1.25, 0.1], [94, 1.15, 0]],
  },
};

function boundsOf(item) {
  return { minX: item.x - (item.w != null ? item.w / 2 : item.hw), maxX: item.x + (item.w != null ? item.w / 2 : item.hw), minZ: item.z - (item.d != null ? item.d / 2 : item.hd), maxZ: item.z + (item.d != null ? item.d / 2 : item.hd) };
}

function overlaps(a, b, gap = 0.04) {
  return a.minX < b.maxX - gap && a.maxX > b.minX + gap && a.minZ < b.maxZ - gap && a.maxZ > b.minZ + gap;
}

function inside(inner, outer, pad = 0) {
  return inner.minX >= outer.minX + pad && inner.maxX <= outer.maxX - pad && inner.minZ >= outer.minZ + pad && inner.maxZ <= outer.maxZ - pad;
}

export function assertPhase1Layout() {
  const tanks = [...nurseryTanks, ...weaningTanks, ...larvalTanks];
  if (nurseryTanks.length !== 8) throw new Error('nursery banks should be 4 + 4');
  if (new Set(nurseryTanks.map(t => t.bank)).size !== 2) throw new Error('nursery needs two banks');
  if (nurseryTanks.filter(t => t.bank === 'north').some(t => t.z <= 0)) throw new Error('north nursery bank crossed the aisle');
  if (nurseryTanks.filter(t => t.bank === 'south').some(t => t.z >= 0)) throw new Error('south nursery bank crossed the aisle');
  if (weaningTanks.length !== 16) throw new Error('weaning modules');
  if (larvalTanks.length !== 16) throw new Error('larval grid');
  if (new Set(larvalTanks.map(t => t.col)).size !== 4 || new Set(larvalTanks.map(t => t.row)).size !== 4) throw new Error('larval grid is not 4 by 4');
  if (blowers.length !== 8) throw new Error('AKVA blowers area is 8 blowers on the sheet');
  if (incubators.length !== 14) throw new Error('incubational tanks are 14 × 5.00 L on the sheet');

  const aisle = { minX: 1, maxX: 102, minZ: -HALL.aisle, maxZ: HALL.aisle };
  for (const t of tanks) {
    const b = boundsOf(t);
    if (overlaps(b, aisle, 0)) throw new Error('tank blocks the aisle at ' + t.x + ',' + t.z);
  }
  for (let i = 0; i < tanks.length; i++) for (let j = i + 1; j < tanks.length; j++) {
    if (overlaps(boundsOf(tanks[i]), boundsOf(tanks[j]), 0.08)) throw new Error('tank overlap');
  }

  const solids = ROOMS.filter(r => r.kind === 'room');
  for (const r of solids) {
    if (overlaps(boundsOf(r), aisle, 0)) throw new Error(r.id + ' blocks the aisle');
  }
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    if (overlaps(boundsOf(solids[i]), boundsOf(solids[j]))) throw new Error(solids[i].id + ' overlaps ' + solids[j].id);
  }
  for (const t of tanks) for (const r of solids) {
    if (overlaps(boundsOf(t), boundsOf(r), 0.02)) throw new Error('tank overlaps ' + r.id);
  }

  const blowBox = boundsOf(roomById('blowers'));
  for (const b of blowers) {
    if (!inside(boundsOf({ ...b, hw: b.r, hd: b.r }), blowBox, 0)) throw new Error('blower outside the AKVA blowers area');
  }
  const incBox = boundsOf(roomById('incubational'));
  for (const b of incubators) {
    if (!inside(boundsOf({ ...b, hw: b.r, hd: b.r }), incBox, 0)) throw new Error('incubator outside the incubational room');
  }

  const peri = roomById('peripheral');
  const southNursery = nurseryTanks.find(t => t.bank === 'south');
  if (!(peri.z < southNursery.z)) throw new Error('peripheral corridor should run south of the nursery tanks');
  if (peri.x + peri.w / 2 < southNursery.x) throw new Error('peripheral corridor should pass the nursery');
  const main = roomById('mainEntrance');
  const staff = roomById('staffEntrance');
  if (!(main.z < 0 && staff.z > 0)) throw new Error('entrances swapped');
  if (!(roomById('canopy').z < main.z)) throw new Error('canopy should sit outside the main entrance');

  const order = ['nursery', 'weaning', 'reception', 'larval', 'artemia'];
  const xs = {
    nursery: Math.max(...nurseryTanks.map(t => t.x)),
    weaning: Math.min(...weaningTanks.map(t => t.x)),
    reception: roomById('reception').x,
    larval: Math.min(...larvalTanks.map(t => t.x)),
    artemia: roomById('artemia').x,
  };
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i], b = order[i + 1];
    if (!(xs[a] < xs[b])) throw new Error(a + ' should sit west of ' + b);
  }

  for (const key of ['desktop', 'mobile']) {
    const path = PHASE1_APPROACH[key];
    for (const p of [path.place, ...path.pts]) {
      if (Math.abs(p[2]) > 1.15) throw new Error('approach leaves the aisle');
      if (p[1] < 1.7 || p[1] > 5.5) throw new Error('approach height');
      if (p[0] < 1 || p[0] > 100) throw new Error('approach leaves the hall');
      for (const t of tanks) {
        if (Math.abs(p[0] - t.x) < t.hw + 0.45 && Math.abs(p[2] - t.z) < t.hd + 0.45) throw new Error('approach hits a tank');
      }
    }
  }
  const view = LARVAL_VIEW;
  const focus = LARVAL_FOCUS;
  const clear = Math.hypot(view.x - focus.x, view.z - focus.z) - focus.r;
  if (clear < 1.2) throw new Error('larval close-up is inside the tank');
  if (Math.abs(view.z) > HALL.aisle) throw new Error('larval close-up leaves the aisle');
  return true;
}

assertPhase1Layout();
