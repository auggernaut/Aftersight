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
  [[5, 1], [0, 2], [5, 2], [3, 3], [4, 3], [0, 4], [2, 4], [3, 4], [5, 4], [2, 5], [3, 5]].forEach(([i, j]) => P.push({ ...blockRect(i, j), town: true, used: false }));
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

// Job sites: base share of the town's work, and whether they lean high-skill.
const JOB_SITES = [
  ['school', 'School', [2, 0], 1.0, 1], ['clinic', 'Clinic', [3, 0], 1.1, 1], ['market', 'Market', [0, 1], 1.0, 0],
  ['cafe', 'Café', [1, 1], 0.8, 0], ['learn', 'Learning Hub', [2, 1], 0.5, 1], ['hall', 'Town Hall', [3, 2], 0.6, 1],
  ['warehouse', 'Helix Warehouse', [1, 3], 1.3, 0], ['repair', 'Repair Shop', [1, 4], 0.7, 0], ['diner', 'Diner', [4, 4], 0.8, 0],
];
const HOME_BLOCKS = [[0, 0], [1, 0], [4, 0], [5, 0], [0, 3], [5, 3], [0, 5], [1, 5], [4, 5], [5, 5]];

const FAMILY_NAMES = ['Okafor', 'Patel', 'Moreno', 'Kowalski', 'Nguyen', 'Haddad', 'Lindqvist', 'Mensah', 'Sato', 'Romero', 'Byrne', 'Achterberg', 'Dubois', 'Castillo', 'Ivanova', 'Park'];
const FIRST = ['Mara', 'Teo', 'Juno', 'Odile', 'Ravi', 'Ines', 'Kofi', 'Lena', 'Omar', 'Sana', 'Pavel', 'Yuki', 'Bea', 'Tomas', 'Ada', 'Felix', 'Nia', 'Hugo', 'Rosa', 'Idris', 'Mei', 'Arlo', 'Zara', 'Emil', 'Noor', 'Cyrus', 'Lucia', 'Dev', 'Ola', 'Wren', 'Iris', 'Bram', 'Kaito', 'Esme', 'Joaquin', 'Talia', 'Sami', 'Greta', 'Milo', 'Amara', 'Rhys', 'Lark', 'Basil', 'Frida', 'Anouk', 'Tariq', 'Vera', 'Quinn', 'Ezra', 'Pia'];
