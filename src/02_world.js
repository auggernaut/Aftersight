// ---------- the neighborhood: layout, collision, pathfinding ----------
const W = 2400, WH = 1700;
const CELL = 16;
const GW = Math.ceil(W / CELL), GH = Math.ceil(WH / CELL);

// Building footprints are ground rectangles (x,y = back-left, w x d). Visuals rise above the front edge.
const BUILDINGS = {
  store:  { x: 1050, y: 556, w: 200, d: 84, h: 112, kind: 'store', wall: '#ecd2a6', roof: '#c4643c', trim: '#4e7d6b', name: "Brandt's Corner Store" },
  juno:   { x: 640, y: 404, w: 170, d: 84, h: 168, kind: 'apartment', wall: '#e2b9a6', roof: '#b65a3d', trim: '#5f78a3', name: "Juno's apartment" },
  mara:   { x: 560, y: 766, w: 180, d: 84, h: 112, kind: 'house', wall: '#ead6a2', roof: '#c76a40', trim: '#3f7a8c', name: "Mara's house" },
  teo:    { x: 640, y: 1146, w: 170, d: 84, h: 106, kind: 'house', wall: '#d9c39d', roof: '#b4573a', trim: '#7b6544', name: "Teo's house" },
  garage: { x: 1430, y: 900, w: 180, d: 90, h: 112, kind: 'garage', wall: '#d3c3a8', roof: '#8e7c6c', trim: '#a8603a', name: 'Your workshop' },
  depot:  { x: 96, y: 856, w: 180, d: 84, h: 100, kind: 'shed', wall: '#a99a86', roof: '#7d6f66', trim: '#6b5b4b', name: 'Old rail depot' },
};
BUILDINGS.store.door = { x: 1150, y: 640 };
BUILDINGS.juno.door = { x: 700, y: 488 };
BUILDINGS.mara.door = { x: 650, y: 850 };
BUILDINGS.teo.door = { x: 725, y: 1230 };
BUILDINGS.garage.door = { x: 1520, y: 990 };
BUILDINGS.depot.door = { x: 186, y: 940 };

// Lots where projects and creations get built.
const LOTS = {
  solar:     { x: 1320, y: 1236, w: 400, d: 200, name: 'Sunfield meadow' },
  workshop:  { x: 1630, y: 884, w: 190, d: 100, name: 'Lot beside your workshop' },
  greenhouse:{ x: 860, y: 1262, w: 200, d: 110, name: 'Overgrown lot' },
  kitchen:   { x: 1320, y: 584, w: 240, d: 110, name: 'The old terrace' },
  garden:    { x: 1740, y: 300, w: 160, d: 110, name: 'Waterfall overlook' },
  pavilion:  { x: 790, y: 944, w: 180, d: 100, name: 'Plaza green' },
  compute:   { x: 100, y: 1056, w: 150, d: 70, name: 'Yard beside the old depot' },
};

const POI = {
  busStop: { x: 1150, y: 1585 }, busExit: { x: 1150, y: 1690 },
  plaza: { x: 1150, y: 900 }, fountain: { x: 1150, y: 830 },
  workbench: { x: 1474, y: 1012 }, notice: { x: 1312, y: 776 },
  storeCounter: { x: 1150, y: 668 },
  depotSalvage: { x: 250, y: 1010 }, towerSalvage: { x: 332, y: 488 }, riverSalvage: { x: 1990, y: 1072 },
  garageSalvage: { x: 1580, y: 1018 }, framesSalvage: { x: 940, y: 1390 },
  waterfallSpot: { x: 1830, y: 420 }, terraceSpot: { x: 1440, y: 712 },
  sunfield: { x: 1520, y: 1460 }, maraPorch: { x: 708, y: 874 }, teoGarden: { x: 548, y: 1318 },
  junoBench: { x: 860, y: 520 }, plazaBench1: { x: 1000, y: 930 }, plazaBench2: { x: 1300, y: 930 },
  plazaBench3: { x: 1030, y: 742 }, accordion: { x: 1080, y: 990 }, workshopBikes: { x: 1700, y: 1010 },
  kitchenTable: { x: 1440, y: 680 }, riverside: { x: 2380, y: 950 }, pavilionSpot: { x: 880, y: 1062 },
};

const PLAZA = { x: 1150, y: 846, rx: 214, ry: 150 };
const POND = { x: 1860, y: 1480, rx: 200, ry: 112 };
const POOL = { x: 1990, y: 316, rx: 100, ry: 52 };
const STREAM = [[1990, 330], [2030, 470], [1985, 620], [2012, 780], [2070, 940], [2086, 1100], [2032, 1262], [1940, 1392], [1880, 1450]];
const STREAM_W = 66;
const BRIDGE = { x1: 1990, x2: 2150, y1: 918, y2: 966 };

const ROADS = [
  { w: 46, pts: [[1150, 1700], [1150, 1560], [1150, 994]] },
  { w: 40, pts: [[950, 850], [770, 860], [560, 892], [380, 930], [280, 960]] },
  { w: 34, pts: [[650, 850], [656, 878]] },
  { w: 38, pts: [[1004, 744], [880, 590], [740, 500], [520, 486], [340, 488]] },
  { w: 38, pts: [[1006, 952], [860, 1080], [740, 1236], [620, 1300]] },
  { w: 30, pts: [[860, 1100], [900, 1200], [940, 1262]] },
  { w: 42, pts: [[1356, 860], [1480, 996], [1700, 1004], [1880, 970], [2020, 942], [2400, 946]] },
  { w: 36, pts: [[1150, 700], [1150, 640]] },
  { w: 32, pts: [[1300, 760], [1380, 700]] },
  { w: 34, pts: [[1250, 1000], [1380, 1160], [1500, 1236]] },
  { w: 30, pts: [[1250, 650], [1480, 540], [1680, 440], [1820, 420]] },
];

const blocked = new Uint8Array(GW * GH);
const COLLIDERS = []; // {type:'rect'|'circle'|'ellipse', ...} - rebuilt when projects appear

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function polyDist(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}
function roadDist(x, y) {
  let d = Infinity;
  for (const r of ROADS) d = Math.min(d, polyDist(x, y, r.pts) - r.w / 2);
  const pe = ((x - PLAZA.x) / PLAZA.rx) ** 2 + ((y - PLAZA.y) / PLAZA.ry) ** 2;
  if (pe < 1.25) d = Math.min(d, 0);
  return d;
}
function inWater(x, y) {
  if (x > BRIDGE.x1 && x < BRIDGE.x2 && y > BRIDGE.y1 && y < BRIDGE.y2) return false;
  if (((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2 < 1) return true;
  if (((x - POOL.x) / POOL.rx) ** 2 + ((y - POOL.y) / POOL.ry) ** 2 < 1) return true;
  return polyDist(x, y, STREAM) < STREAM_W / 2;
}

// ----- trees and props (seeded, deterministic) -----
const TREES = [];
const PROPS = [];
function nearAnyLot(x, y, pad) {
  for (const k in BUILDINGS) { const b = BUILDINGS[k]; if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad - 60 && y < b.y + b.d + pad) return true; }
  for (const k in LOTS) { const b = LOTS[k]; if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad - 40 && y < b.y + b.d + pad) return true; }
  return false;
}
function buildScenery() {
  const R = rng(20251017);
  const fixed = [
    // cypress lines along the main road and the store
    ...[1040, 1260].flatMap(x => [1080, 1200, 1320, 1440].map(y => ({ x: x + (x < 1150 ? 0 : 0), y, kind: 'cypress' }))),
    { x: 1010, y: 600, kind: 'cypress' }, { x: 1290, y: 600, kind: 'cypress' },
    { x: 520, y: 760, kind: 'olive' }, { x: 790, y: 760, kind: 'round' }, { x: 860, y: 1180, kind: 'olive' },
    { x: 600, y: 1140, kind: 'lemon' }, { x: 470, y: 1220, kind: 'lemon' }, { x: 840, y: 420, kind: 'round' },
    { x: 590, y: 420, kind: 'cypress' }, { x: 1700, y: 1180, kind: 'olive' }, { x: 1360, y: 1080, kind: 'round' },
    { x: 1700, y: 760, kind: 'round' }, { x: 1600, y: 800, kind: 'olive' }, { x: 1900, y: 560, kind: 'round' },
    { x: 1880, y: 760, kind: 'cypress' }, { x: 1930, y: 1200, kind: 'round' }, { x: 2200, y: 820, kind: 'round' },
    { x: 2250, y: 1100, kind: 'cypress' }, { x: 2180, y: 1300, kind: 'round' }, { x: 2300, y: 600, kind: 'round' },
    { x: 1640, y: 560, kind: 'olive' }, { x: 960, y: 1460, kind: 'round' }, { x: 1300, y: 1520, kind: 'olive' },
    { x: 420, y: 640, kind: 'round' }, { x: 300, y: 1200, kind: 'round' }, { x: 440, y: 1480, kind: 'olive' },
  ];
  for (const t of fixed) TREES.push({ ...t, seed: R() * 1000, s: 0.9 + R() * 0.25 });
  let tries = 0;
  while (TREES.length < 115 && tries++ < 4000) {
    const x = 40 + R() * (W - 80), y = 270 + R() * (WH - 320);
    if (roadDist(x, y) < 40) continue;
    if (inWater(x, y) || polyDist(x, y, STREAM) < 70 || ((x - POND.x) / (POND.rx + 50)) ** 2 + ((y - POND.y) / (POND.ry + 40)) ** 2 < 1) continue;
    if (nearAnyLot(x, y, 50)) continue;
    if (Math.abs(x - 1150) < 260 && Math.abs(y - 846) < 200) continue;
    if (x > 280 && x < 360 && y > 560 && y < 1560) continue; // rails
    if (TREES.some(t => dist(t.x, t.y, x, y) < 70)) continue;
    const r = R();
    TREES.push({ x, y, kind: r < 0.45 ? 'round' : r < 0.7 ? 'olive' : r < 0.9 ? 'cypress' : 'bush', seed: R() * 1000, s: 0.85 + R() * 0.35 });
  }
  // hill-top trees along the north ridge (decor only, beyond the cliff)
  for (let x = 30; x < W; x += 70 + R() * 50) {
    if (Math.abs(x - 1990) < 120) continue;
    TREES.push({ x, y: 150 + R() * 70, kind: R() < 0.3 ? 'cypress' : 'round', seed: R() * 1000, s: 0.9 + R() * 0.3, ridge: true });
  }
  // lamp posts, benches, flower beds, rocks
  const lamps = [[1100, 1100], [1200, 1300], [1100, 1500], [920, 860], [600, 920], [880, 620], [560, 480], [960, 1020], [1400, 940], [1720, 1040], [1880, 1010], [1260, 690], [1040, 690], [1350, 1180]];
  for (const [x, y] of lamps) PROPS.push({ kind: 'lamp', x, y });
  for (const k of ['plazaBench1', 'plazaBench2', 'plazaBench3']) PROPS.push({ kind: 'bench', x: POI[k].x, y: POI[k].y - 4 });
  PROPS.push({ kind: 'bench', x: POI.maraPorch.x, y: POI.maraPorch.y - 4 });
  PROPS.push({ kind: 'bench', x: POI.junoBench.x, y: POI.junoBench.y - 4 });
  PROPS.push({ kind: 'notice', x: POI.notice.x, y: POI.notice.y - 18 });
  PROPS.push({ kind: 'busstop', x: 1236, y: 1566 });
  PROPS.push({ kind: 'tower', x: 330, y: 440 });
  PROPS.push({ kind: 'sign', x: 2250, y: 990, text: 'Riverside 3 km' });
  PROPS.push({ kind: 'van', x: 860, y: 1236 });
  const beds = [[980, 700], [1320, 700], [960, 980], [1340, 980], [610, 900], [780, 540], [700, 1260], [1360, 1050], [1530, 1060], [1180, 680], [1110, 680]];
  for (const [x, y] of beds) PROPS.push({ kind: 'bed', x, y, seed: R() * 1000 });
  for (let i = 0; i < 46; i++) {
    const x = 60 + R() * (W - 120), y = 280 + R() * (WH - 330);
    if (roadDist(x, y) < 20 || inWater(x, y) || nearAnyLot(x, y, 30)) continue;
    PROPS.push({ kind: R() < 0.55 ? 'rock' : 'shrub', x, y, seed: R() * 1000 });
  }
}

function addRect(x, y, w, h) { COLLIDERS.push({ type: 'rect', x, y, w, h }); }
function addEllipse(x, y, rx, ry) { COLLIDERS.push({ type: 'ellipse', x, y, rx, ry }); }

function rebuildColliders(state) {
  COLLIDERS.length = 0;
  for (const k in BUILDINGS) { const b = BUILDINGS[k]; addRect(b.x, b.y, b.w, b.d - 6); }
  addEllipse(POI.fountain.x, POI.fountain.y, 56, 36);
  for (const t of TREES) if (!t.ridge) addEllipse(t.x, t.y - 2, t.kind === 'bush' ? 16 : 11, 7);
  for (const p of PROPS) {
    if (p.kind === 'bench') addRect(p.x - 26, p.y - 8, 52, 10);
    else if (p.kind === 'lamp') addEllipse(p.x, p.y, 5, 4);
    else if (p.kind === 'notice') addRect(p.x - 26, p.y - 4, 52, 10);
    else if (p.kind === 'tower') { addRect(p.x - 46, p.y - 20, 92, 26); }
    else if (p.kind === 'busstop') addRect(p.x - 44, p.y - 14, 88, 14);
    else if (p.kind === 'rock') addEllipse(p.x, p.y, 13, 7);
    else if (p.kind === 'van' && state && !state.flags.vanGone) addRect(p.x - 46, p.y - 14, 92, 22);
  }
  if (state) {
    const P = state.projects;
    if (P.solar && (P.solar.status === 'online' || P.solar.status === 'building')) {
      const L = LOTS.solar;
      for (let r = 0; r < 3; r++) addRect(L.x + 20, L.y + 24 + r * 60, L.w - 40, 26);
      if (P.solar.upgrades.battery) addRect(1740, 1300, 64, 44);
    }
    if (P.workshop && (P.workshop.status === 'online' || P.workshop.status === 'building')) {
      const L = LOTS.workshop; addRect(L.x, L.y, L.w, L.d - 10);
    }
    if (P.greenhouse && (P.greenhouse.status === 'online' || P.greenhouse.status === 'building')) {
      const L = LOTS.greenhouse; addRect(L.x + 10, L.y + 8, L.w - 20, L.d - 30);
    }
    const C = state.creations;
    if (C.kitchen && C.kitchen.status !== 'locked' && C.kitchen.status !== 'available') {
      const L = LOTS.kitchen; addRect(L.x + 30, L.y, L.w - 60, 50);
    }
    if (C.pavilion && (C.pavilion.status === 'built' || C.pavilion.status === 'building')) {
      const L = LOTS.pavilion; addEllipse(L.x + L.w / 2, L.y + 40, 60, 26);
    }
  }
  buildGrid();
}

function buildGrid() {
  blocked.fill(0);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
    let b = 0;
    if (y < 262 || x < 20 || x > W - 14 || y > WH - 8) b = 1;
    else if (inWater(x, y)) b = 1;
    else if (x > 280 && x < 370 && y > 560 && y < 1560 && !(y > 900 && y < 1060)) b = 0; // rails are walkable
    if (!b) for (const c of COLLIDERS) {
      if (c.type === 'rect') { if (x > c.x - 4 && x < c.x + c.w + 4 && y > c.y - 4 && y < c.y + c.h + 4) { b = 1; break; } }
      else if (((x - c.x) / (c.rx + 4)) ** 2 + ((y - c.y) / (c.ry + 4)) ** 2 < 1) { b = 1; break; }
    }
    if (x >= W - 14 && y > 900 && y < 990) b = 0; // road to Riverside reaches the edge
    if (y > WH - 8 && x > 1110 && x < 1190) b = 0;
    blocked[gy * GW + gx] = b;
  }
}
function cellBlocked(gx, gy) { return gx < 0 || gy < 0 || gx >= GW || gy >= GH || blocked[gy * GW + gx] === 1; }
function walkable(x, y) { return !cellBlocked(Math.floor(x / CELL), Math.floor(y / CELL)); }
function footFree(x, y) {
  const r = 7;
  return walkable(x, y) && walkable(x - r, y) && walkable(x + r, y) && walkable(x, y - 4) && walkable(x, y + 3);
}
function nearestWalkable(x, y) {
  let gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  if (!cellBlocked(gx, gy)) return { x, y };
  for (let r = 1; r < 30; r++) {
    let best = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      if (!cellBlocked(gx + dx, gy + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [gx + dx, gy + dy]; } }
    }
    if (best) return { x: best[0] * CELL + CELL / 2, y: best[1] * CELL + CELL / 2 };
  }
  return { x, y };
}

// A* on the grid, then string-pulled for natural-looking walks.
function findPath(sx, sy, tx, ty) {
  const t = nearestWalkable(tx, ty);
  const s = nearestWalkable(sx, sy);
  const sgx = Math.floor(s.x / CELL), sgy = Math.floor(s.y / CELL);
  const tgx = Math.floor(t.x / CELL), tgy = Math.floor(t.y / CELL);
  const N = GW * GH;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = [];
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (x, y) => { const dx = Math.abs(x - tgx), dy = Math.abs(y - tgy); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  const si = sgy * GW + sgx, ti = tgy * GW + tgx;
  g[si] = 0; push(si, h(sgx, sgy));
  let found = false, iter = 0;
  while (heap.length && iter++ < 30000) {
    const [, i] = pop();
    if (closed[i]) continue;
    if (i === ti) { found = true; break; }
    closed[i] = 1;
    const x = i % GW, y = (i / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (cellBlocked(nx, ny)) continue;
      if (dx && dy && (cellBlocked(x + dx, y) || cellBlocked(x, y + dy))) continue;
      const ni = ny * GW + nx;
      const ng = g[i] + (dx && dy ? 1.414 : 1);
      if (ng < g[ni]) { g[ni] = ng; came[ni] = i; push(ni, ng + h(nx, ny)); }
    }
  }
  if (!found) return [{ x: t.x, y: t.y }];
  const cells = [];
  for (let i = ti; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map(i => ({ x: (i % GW) * CELL + CELL / 2, y: ((i / GW) | 0) * CELL + CELL / 2 }));
  pts[pts.length - 1] = { x: t.x, y: t.y };
  // string pulling
  const out = [];
  let a = { x: sx, y: sy };
  let k = 0;
  while (k < pts.length) {
    let far = k;
    for (let j = pts.length - 1; j > k; j--) { if (lineClear(a.x, a.y, pts[j].x, pts[j].y)) { far = j; break; } }
    out.push(pts[far]); a = pts[far]; k = far + 1;
  }
  return out;
}
function lineClear(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / 6);
  for (let i = 1; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
    if (!walkable(x, y) || !walkable(x - 6, y) || !walkable(x + 6, y)) return false;
  }
  return true;
}
