// The valley: a tile grid (1 unit = 1 tile), the town's street grid, sites and parcels.
const MAP_W = 200, MAP_H = 140;
const TOWN = { x0: 60, y0: 40, x1: 144, y1: 100, bx: 12, by: 10 };
const ROAD_X = [], ROAD_Y = [];
for (let x = TOWN.x0; x <= TOWN.x1; x += TOWN.bx) ROAD_X.push(x);
for (let y = TOWN.y0; y <= TOWN.y1; y += TOWN.by) ROAD_Y.push(y);
const T = { GRASS: 0, GRASS2: 1, ROAD: 2, HWY: 3, WATER: 4, FIELD: 5, FOREST: 6, PAVE: 7, BANK: 8, TOWNB: 9, FIELD2: 10 };

function blockRect(i, j) { return { x: TOWN.x0 + i * TOWN.bx + 1, y: TOWN.y0 + j * TOWN.by + 1, w: TOWN.bx - 1, h: TOWN.by - 1 }; }

function buildTerrain() {
  const g = new Uint8Array(MAP_W * MAP_H);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y * MAP_W + x] = t; };
  const get = (x, y) => g[y * MAP_W + x];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) set(x, y, ((x * 7 + y * 13) ^ (x * y)) % 5 === 0 ? T.GRASS2 : T.GRASS);
  // forests: blobs
  const tr = makeRng(42);
  for (let k = 0; k < 26; k++) {
    const cx = tr() * MAP_W, cy = tr() * MAP_H, r = 3 + tr() * 7;
    if (cx > TOWN.x0 - 8 && cx < TOWN.x1 + 8 && cy > TOWN.y0 - 8 && cy < TOWN.y1 + 8) continue;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r * (0.6 + tr() * 0.5)) set(x, y, T.FOREST);
  }
  // farmland south and north of town
  const field = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, (Math.floor(y / 2) % 2) ? T.FIELD : T.FIELD2); };
  field(64, 108, 30, 22); field(112, 110, 28, 20); field(60, 6, 34, 12); field(98, 4, 40, 10);
  // river
  const pts = [[0, 30], [30, 34], [48, 60], [44, 90], [55, 125], [70, 140]];
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, ay] = pts[s], [bx, by] = pts[s + 1], n = Math.hypot(bx - ax, by - ay) * 2;
    for (let i = 0; i <= n; i++) {
      const x = lerp(ax, bx, i / n), y = lerp(ay, by, i / n);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 1.8) set(Math.round(x + dx), Math.round(y + dy), T.WATER);
        else if (d <= 2.9 && get(clamp(Math.round(x + dx), 0, MAP_W - 1), clamp(Math.round(y + dy), 0, MAP_H - 1)) !== T.WATER) set(Math.round(x + dx), Math.round(y + dy), T.BANK);
      }
    }
  }
  // town ground and streets
  for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) set(x, y, T.PAVE);
  for (const x of ROAD_X) for (let y = TOWN.y0; y <= TOWN.y1; y++) set(x, y, T.ROAD);
  for (const y of ROAD_Y) for (let x = TOWN.x0; x <= TOWN.x1; x++) set(x, y, T.ROAD);
  // highway east-west through the middle, spur to the Helix campus, lanes to farm and station
  for (let x = 0; x < MAP_W; x++) set(x, 70, T.HWY);
  for (let x = TOWN.x1; x <= 150; x++) set(x, 50, T.ROAD);
  for (let y = 44; y <= 50; y++) set(150, y, T.ROAD);
  for (let y = TOWN.y1; y <= 110; y++) set(96, y, T.ROAD);
  for (let y = TOWN.y1; y <= 106; y++) set(108, y, T.ROAD);
  // neighbouring towns
  const town = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, (x % 4 === 0 || y % 4 === 0) ? T.ROAD : T.TOWNB); };
  town(8, 96, 22, 18); town(166, 104, 24, 20);
  return g;
}

// Parcels where new energy/compute/factory/fleet assets can go: empty town blocks first, then fields.
function buildParcels() {
  const P = [];
  for (let x = 62; x <= 134; x += 12) for (const y of [22, 31]) P.push({ x, y, w: 11, h: 8, used: false });
  for (let x = 152; x <= 188; x += 12) for (let y = 54; y <= 94; y += 10) P.push({ x, y, w: 11, h: 9, used: false });
  for (let y = 76; y <= 94; y += 10) for (const x of [6, 18, 30]) P.push({ x: x + 14, y, w: 11, h: 9, used: false });
  return P;
}

// Route along the street grid: up/down to a street, across, then to the destination door.
function nearest(arr, v) { return arr.reduce((b, a) => Math.abs(a - v) < Math.abs(b - v) ? a : b, arr[0]); }
function route(from, site, target) {
  const pts = [];
  const door = site.door;
  const inTown = p => p.x >= TOWN.x0 - 1 && p.x <= TOWN.x1 + 1 && p.y >= TOWN.y0 - 1 && p.y <= TOWN.y1 + 1;
  if (inTown(from)) {
    const ry0 = nearest(ROAD_Y, from.y);
    pts.push({ x: from.x, y: ry0 });
    const rx = nearest(ROAD_X, door.x);
    pts.push({ x: rx, y: ry0 });
    pts.push({ x: rx, y: door.ry });
  } else {
    pts.push({ x: from.x, y: from.y });
  }
  pts.push({ x: door.x, y: door.ry });
  pts.push({ x: door.x, y: door.y });
  pts.push(target);
  // drop consecutive duplicates
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.3);
}

let SITE_ID = 0;
function makeSite(kind, name, r, extra = {}) {
  const s = { id: 's' + (++SITE_ID), kind, name, x: r.x, y: r.y, w: r.w, h: r.h, ...extra };
  s.cx = s.x + s.w / 2; s.cy = s.y + s.h / 2;
  if (!s.door) {
    const ry = nearest(ROAD_Y, s.y + s.h);
    const inTown = s.x >= TOWN.x0 && s.x <= TOWN.x1 && s.y >= TOWN.y0 && s.y <= TOWN.y1;
    s.door = inTown ? { x: Math.round(s.cx), y: ry, ry } : { x: Math.round(s.cx), y: Math.round(s.y + s.h + 0.5), ry: Math.round(s.y + s.h + 0.5) };
  }
  return s;
}
function spotIn(site, margin = 0.8) {
  return { x: site.x + margin + rand() * Math.max(0.1, site.w - margin * 2), y: site.y + margin + rand() * Math.max(0.1, site.h - margin * 2) };
}

// The present-day town, block by block. Layouts split a block into lots:
// res6 = six houses, quad = four 5x4 lots, half = two 5x9 lots, whole = one lot.
// Entries: a plain lot use, ['job', kind, name, jobWeight, hiSkill], ['civic', kind, name] or ['asset', key].
const LAYOUTS = {
  res6: [[0, 0, 3, 4], [4, 0, 3, 4], [8, 0, 3, 4], [0, 5, 3, 4], [4, 5, 3, 4], [8, 5, 3, 4]],
  quad: [[0, 0, 5, 4], [6, 0, 5, 4], [0, 5, 5, 4], [6, 5, 5, 4]],
  half: [[0, 0, 5, 9], [6, 0, 5, 9]],
  whole: [[0, 0, 11, 9]],
};
const R6 = ['res6'];
const BLOCK_PLAN = {
  '0,0': R6, '1,0': R6, '2,0': ['whole', ['job', 'school', 'School', 1.0, 1]], '3,0': ['whole', ['job', 'clinic', 'Clinic', 1.1, 1]], '4,0': R6, '5,0': R6,
  '0,1': ['half', ['job', 'market', 'Market', 1.0, 0], 'parking'], '1,1': ['quad', ['job', 'cafe', 'Café', 0.8, 0], 'shop', 'restaurant', 'parking'],
  '2,1': ['whole', ['job', 'learn', 'Library & Learning Hub', 0.5, 1]], '3,1': ['quad', 'office', 'office', 'parking', 'office'],
  '4,1': ['quad', 'office', ['asset', 'valleycompute'], 'parking', 'office'], '5,1': R6,
  '0,2': ['quad', 'gas', 'carlot', 'shop', 'motel'], '1,2': ['whole', ['asset', 'okafor']], '2,2': ['whole', ['civic', 'plaza', 'Plaza']],
  '3,2': ['whole', ['job', 'hall', 'Town Hall', 0.6, 1]], '4,2': ['whole', ['asset', 'depot']], '5,2': ['quad', 'office', 'parking', 'shop', 'church'],
  '0,3': R6, '1,3': ['half', ['job', 'warehouse', 'Valley Distribution', 1.3, 0], 'parking'], '2,3': ['whole', ['civic', 'park', 'Park']],
  '3,3': ['quad', 'shop', 'restaurant', 'parking', 'office'], '4,3': ['quad', 'office', 'office', 'parking', 'office'], '5,3': R6,
  '0,4': R6, '1,4': ['quad', ['job', 'repair', 'Repair Shop', 0.7, 0], 'gas', 'shop', 'parking'], '2,4': R6, '3,4': R6,
  '4,4': ['quad', ['job', 'diner', 'Diner', 0.8, 0], 'parking', 'shop', 'motel'], '5,4': R6,
  '0,5': R6, '1,5': R6, '2,5': ['quad', 'church', 'shop', 'parking', 'gas'], '3,5': R6, '4,5': R6, '5,5': R6,
  '6,0': R6, '6,1': ['quad', 'office', 'shop', 'parking', 'gas'], '6,2': ['half', 'warehouse', 'parking'], '6,3': R6, '6,4': ['quad', 'carlot', 'parking', 'shop', 'office'], '6,5': R6,
};
// highway strip outside town
const STRIP_LOTS = [
  [146, 63, 6, 5, 'gas'], [153, 62, 10, 6, 'bigbox'], [164, 63, 7, 5, 'parking'], [146, 72, 7, 5, 'motel'], [154, 72, 9, 6, 'warehouse'], [164, 72, 6, 5, 'carlot'],
  [51, 63, 6, 5, 'gas'], [51, 72, 6, 5, 'restaurant'],
];
const FAMILY_NAMES = ['Okafor', 'Patel', 'Moreno', 'Kowalski', 'Nguyen', 'Haddad', 'Lindqvist', 'Mensah', 'Sato', 'Romero', 'Byrne', 'Achterberg', 'Dubois', 'Castillo', 'Ivanova', 'Park'];
const FIRST = ['Mara', 'Teo', 'Juno', 'Odile', 'Ravi', 'Ines', 'Kofi', 'Lena', 'Omar', 'Sana', 'Pavel', 'Yuki', 'Bea', 'Tomas', 'Ada', 'Felix', 'Nia', 'Hugo', 'Rosa', 'Idris', 'Mei', 'Arlo', 'Zara', 'Emil', 'Noor', 'Cyrus', 'Lucia', 'Dev', 'Ola', 'Wren', 'Iris', 'Bram', 'Kaito', 'Esme', 'Joaquin', 'Talia', 'Sami', 'Greta', 'Milo', 'Amara', 'Rhys', 'Lark', 'Basil', 'Frida', 'Anouk', 'Tariq', 'Vera', 'Quinn', 'Ezra', 'Pia'];
