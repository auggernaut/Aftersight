// The valley at true relative scale. 1 tile = 5 m. The map is 1200 × 900 tiles (6 km × 4.5 km).
// Real footprints: house ~12×10 m on a ~25×40 m lot, big box ~120×100 m, fulfillment center
// ~300×150 m, hyperscale data hall ~200×100 m, solar farm parcels ~300×250 m (7.5 ha).
const TILE_M = 5;
const MAP_W = 1200, MAP_H = 900;
const TOWN = { x0: 140, y0: 90, x1: 960, y1: 720 };
const T = { PAVE: 2, GRASS: 0, GRASS2: 1, WATER: 4, FIELD: 5, FOREST: 6, BANK: 8, METRO: 9, FIELD2: 10, FIELD3: 11, LAWN: 13, SPORT: 14 };
const RW = { interstate: 7, ramp: 2.2, arterial: 4.2, collector: 3, local: 2.2, downtown: 2.6, main: 3.4, service: 1.8 };

// ---------- geometry helpers ----------
function polyAt(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; if (x >= ax && x <= bx) return ay + (by - ay) * (x - ax) / (bx - ax); }
  return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}
const RIVER = [[0, 330], [180, 352], [360, 412], [480, 440], [620, 470], [760, 500], [900, 548], [1050, 590], [1200, 622]];
const I80 = [[0, 232], [200, 240], [420, 262], [640, 272], [820, 250], [1000, 226], [1200, 214]];
const RIVER_RD = [[0, 300], [180, 322], [330, 370], [420, 392], [520, 408], [650, 428], [760, 466], [900, 512], [1050, 556], [1200, 588]];
const SOUTH_RD = [[250, 440], [420, 468], [520, 482], [660, 506], [780, 538], [900, 584], [1050, 626]];
const RAIL = [[0, 422], [200, 448], [400, 482], [560, 502], [700, 532], [900, 604], [1200, 694]];
const I = x => [x, polyAt(I80, x)];
const RR = x => [x, polyAt(RIVER_RD, x)];
const SR = x => [x, polyAt(SOUTH_RD, x)];

// ---------- the world builder ----------
function buildWorld() {
  const wr = makeRng(1234);
  const W = MAP_W, H = MAP_H;
  const terrain = new Uint8Array(W * H), occ = new Uint8Array(W * H); // occ: 0 free, 1 road/rail, 2 built, 3 water, 4 reserved
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x, y) => (y | 0) * W + (x | 0);
  const occAt = (x, y) => inMap(x, y) ? occ[idx(x, y)] : 9;
  const roads = [], rail = [], power = [], houses = [], lots = [], sites = [], parcels = [], fields = [];

  // value noise for wobbly edges
  const hashN = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, y, s) => { const gx = Math.floor(x / s), gy = Math.floor(y / s), fx = x / s - gx, fy = y / s - gy; const sm = t => t * t * (3 - 2 * t); const a = hashN(gx, gy), b = hashN(gx + 1, gy), c = hashN(gx, gy + 1), d = hashN(gx + 1, gy + 1); return lerp(lerp(a, b, sm(fx)), lerp(c, d, sm(fx)), sm(fy)); };

  // terrain: grass, wooded valley walls north and south
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x, y, 60) * 0.7 + noise(x, y, 17) * 0.3;
    let t = ((x * 7 + y * 13) ^ (x * y)) % 5 === 0 ? T.GRASS2 : T.GRASS;
    if (y < 70 + n * 70 || y > 790 + n * 80) t = T.FOREST;
    terrain[idx(x, y)] = t;
  }
  // river
  const stroke = (pts, wdt, fn) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let i = 0; i <= n; i++) {
        const x = lerp(ax, bx, i / n), y = lerp(ay, by, i / n), r = wdt / 2;
        for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          const d = Math.hypot(dx, dy); if (d <= r && inMap(x + dx, y + dy)) fn(Math.floor(x + dx), Math.floor(y + dy), d / r);
        }
      }
    }
  };
  stroke(RIVER, 18, (x, y, d) => { const i = idx(x, y); if (d < 0.7) { terrain[i] = T.WATER; occ[i] = 3; } else if (terrain[i] !== T.WATER) { terrain[i] = T.BANK; if (!occ[i]) occ[i] = 4; } });

  // roads: every road is a polyline with a class; we rasterize it into occ so nothing gets built on it
  const addRoad = (cls, pts, name, res = false) => {
    const r = { cls, pts: pts.map(p => [p[0], p[1]]), name, res };
    roads.push(r);
    stroke(r.pts, RW[cls] + 0.6, (x, y) => { const i = idx(x, y); if (occ[i] !== 3) occ[i] = 1; });
    return r;
  };
  const nearestOnRoads = (x, y, skip) => { // closest point on any surface road
    let best = null, bd = Infinity;
    for (const r of roads) {
      if (r === skip || r.cls === 'interstate' || r.cls === 'ramp') continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = [px, py]; }
      }
    }
    return [best, bd];
  };
  const snapStart = pts => { const [p, d] = nearestOnRoads(pts[0][0], pts[0][1]); if (p && d > 0.05 && d < 14) pts.unshift(p); return pts; };
  const curve = (pts, step = 6) => { // Catmull-Rom smoothing of control points
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  };

  // interstate with a diamond interchange at Valley Parkway (x = 640)
  addRoad('interstate', I80, 'Interstate 17');
  addRoad('ramp', [I(588), [618, 254], [640, 245]], 'ramp');
  addRoad('ramp', [I(692), [662, 252], [640, 245]], 'ramp');
  addRoad('ramp', [I(588), [616, 290], [640, 300]], 'ramp');
  addRoad('ramp', [I(692), [664, 290], [640, 300]], 'ramp');
  // arterials following the terrain
  addRoad('arterial', [[640, 70], [640, 182], [640, 245], [640, 300], [642, 348], [646, 400], RR(650), [656, 470], [664, 520], [676, 580], [688, 680], [700, 900]].map((p, i, a) => p), 'Valley Parkway');
  addRoad('arterial', RIVER_RD, 'River Road');
  addRoad('collector', SOUTH_RD, 'South River Road');
  // Main Street runs north from River Road through downtown and becomes the old county road
  addRoad('main', [RR(456), [456, 348], [456, 300], [470, 270], [500, 220], [530, 160], [560, 60]], 'Main Street / Old County Rd');
  addRoad('collector', [RR(508), [510, 430], [514, 470], SR(518), [524, 560], [534, 660], [548, 780]], 'Bridge Street');
  addRoad('arterial', [[546, 348], [600, 348], [642, 348]], 'Commerce Blvd');
  addRoad('collector', [[646, 348], [700, 344], [780, 352], [860, 362], [960, 380]], 'Commerce Blvd East');
  addRoad('collector', [[560, 186], [640, 182], [720, 178], [800, 175], [900, 170], [980, 166]], 'Industrial Parkway');
  addRoad('service', [[800, 175], [800, 116], [930, 112]], 'Campus Drive');
  addRoad('service', [[566, 140], [640, 140], [720, 140], [796, 140]], 'Logistics Way');
  addRoad('collector', [SR(300), [300, 520], [310, 600], [330, 700]], 'Mill Road');
  addRoad('collector', snapStart([[692, 600], [760, 610], [840, 640], [900, 700]]), 'Orchard Lane');
  addRoad('collector', [RR(900), [905, 450], [915, 380], [930, 300], [940, 240]].reverse().concat([]).reverse(), 'Ridge Road');
  // rail line south of the river, and the transmission corridor feeding the substation
  rail.push(RAIL.map(p => p.slice()));
  stroke(RAIL, 2.2, (x, y) => { const i = idx(x, y); if (occ[i] !== 3) occ[i] = 1; });
  power.push([[1200, 140], [1040, 136], [900, 140], [872, 136]], [[872, 136], [760, 150], [650, 230], [600, 330], [560, 420], [520, 520]]);

  // downtown: a tight, irregular grid of older streets
  const DT_V = [[404, 300], [421, 316], [438, 300], [474, 300], [491, 316], [527, 316], [546, 300]];
  for (const [x, y0] of DT_V) addRoad('downtown', [[x, y0], RR(x)], 'downtown');
  const DT_H = [[300, 400, 550], [316, 404, 509], [332, 398, 546], [364, 404, 546]];
  for (const [y, x0, x1] of DT_H) addRoad('downtown', [[x0, y], [x1, y]], 'downtown');
  addRoad('downtown', [[421, 348], [546, 348]], 'downtown');

  for (let y = 300; y < 412; y++) for (let x = 398; x < 560; x++) if (!occ[idx(x, y)] && y < polyAt(RIVER_RD, x) - 2) terrain[idx(x, y)] = T.PAVE;
  // ---------- placing buildings ----------
  const rectFree = (r, allow4 = false) => {
    for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.h); y++) for (let x = Math.floor(r.x); x < Math.ceil(r.x + r.w); x++) { const o = occAt(x, y); if (o && !(allow4 && o === 4)) return false; }
    return true;
  };
  const mark = (r, v = 2) => { for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.h); y++) for (let x = Math.floor(r.x); x < Math.ceil(r.x + r.w); x++) if (inMap(x, y)) occ[idx(x, y)] = v; };
  const place = (r, search = 12) => { // nudge a planned footprint until it fits
    for (let d = 0; d <= search; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const q = { ...r, x: r.x + dx, y: r.y + dy };
      if (rectFree(q)) { mark(q); return q; }
    }
    return null;
  };
  const lot = (r, use, owner, extra) => { const q = place(r); if (!q) return null; const l = { x: q.x, y: q.y, w: q.w, h: q.h, use, owner, ...extra }; lots.push(l); return l; };
  const site = (spec, r) => { const q = place(r, 20); if (!q) return null; const s = { ...spec, x: q.x, y: q.y, w: q.w, h: q.h }; sites.push(s); return s; };

  // downtown civic blocks, then fill the rest of downtown with small lots
  // a downtown block's buildable interior, between the curbs of the streets around it
  const blk = (xa, xb, ya, yb, m = 2.6) => ({ x: xa + m, y: ya + m, w: xb - xa - 2 * m, h: yb - ya - 2 * m });
  site({ kind: 'hall', name: 'Town Hall', job: [0.6, 1] }, blk(456, 474, 332, 348, 2.8));
  site({ kind: 'plaza', name: 'Plaza' }, blk(474, 491, 332, 348));
  site({ kind: 'learn', name: 'Library & Learning Hub', job: [0.5, 1] }, blk(438, 456, 348, 364, 2.8));
  const dc0 = blk(491, 509, 364, 382); site({ kind: 'clinic', name: 'Downtown Clinic', job: [0.7, 1] }, { ...dc0, w: 8 });
  site({ kind: 'cafe', name: 'Main St Café', job: [0.7, 0] }, { ...blk(456, 474, 316, 332, 2.8), w: 6 });
  site({ kind: 'repair', name: 'Repair Shop', job: [0.7, 0] }, { ...blk(527, 546, 364, 382), w: 8 });
  const DTX = [398, 404, 421, 438, 456, 474, 491, 509, 527, 546, 560], DTY = [300, 316, 332, 348, 364, 382, 412];
  const dtUses = () => weighted([{ w: 0.34, v: 'shop' }, { w: 0.2, v: 'office' }, { w: 0.13, v: 'restaurant' }, { w: 0.2, v: 'parking' }, { w: 0.08, v: 'apartments' }, { w: 0.03, v: 'church' }]);
  for (let yi = 0; yi < DTY.length - 1; yi++) for (let xi = 0; xi < DTX.length - 1; xi++) {
    const x0 = DTX[xi] + 2.2, x1 = DTX[xi + 1] - 2.2, y0 = DTY[yi] + 2.2, y1 = DTY[yi + 1] - 2.2;
    if (x1 - x0 < 3 || y1 - y0 < 3) continue;
    const rows = y1 - y0 >= 11 ? [[y0, (y1 - y0) / 2 - 0.2], [y0 + (y1 - y0) / 2 + 0.2, (y1 - y0) / 2 - 0.2]] : [[y0, y1 - y0]];
    for (const [ry, rh] of rows) {
      let x = x0;
      while (x < x1 - 2) {
        const w = Math.min(x1 - x, 3 + Math.floor(wr() * 4));
        const r = { x, y: ry, w: w - 0.3, h: rh };
        if (rectFree(r)) { mark(r); lots.push({ x: r.x, y: r.y, w: r.w, h: r.h, use: dtUses(), owner: 'private', downtown: true }); }
        x += w;
      }
    }
  }
  // big footprints: strip and big-box corridor along the parkway near the interchange
  const BIG = [];
  const bigbox = (name, x, y, owner) => { const st = lot({ x, y, w: 24, h: 20 }, 'bigbox', owner, { name }); const pk = st && lot({ x, y: st.y + 21, w: 24, h: 21 }, 'parking', owner); return st; };
  bigbox('MegaMart', 604, 303, 'helix'); bigbox('HomeStore', 660, 305, 'private');
  site({ kind: 'market', name: 'Valley Market', job: [1.0, 0] }, { x: 688, y: 305, w: 20, h: 14 }); lot({ x: 688, y: 320, w: 20, h: 14 }, 'parking', 'private');
  lot({ x: 572, y: 352, w: 30, h: 7 }, 'shop', 'private', { name: 'Riverside Plaza strip' }); lot({ x: 572, y: 360, w: 30, h: 11 }, 'parking', 'private');
  lot({ x: 660, y: 352, w: 30, h: 7 }, 'shop', 'private', { name: 'Parkway Center strip' }); lot({ x: 660, y: 360, w: 30, h: 11 }, 'parking', 'private');
  lot({ x: 612, y: 352, w: 8, h: 8 }, 'gas', 'private'); lot({ x: 694, y: 338, w: 8, h: 8 }, 'gas', 'private'); lot({ x: 612, y: 362, w: 7, h: 6 }, 'restaurant', 'private', { name: 'Burger stand' });
  site({ kind: 'diner', name: 'Parkway Diner', job: [0.8, 0] }, { x: 696, y: 352, w: 8, h: 7 });
  lot({ x: 600, y: 380, w: 14, h: 8 }, 'carlot', 'private', { name: 'Valley Motors' }); lot({ x: 600, y: 389, w: 18, h: 12 }, 'carlot', 'private');
  lot({ x: 660, y: 374, w: 16, h: 8 }, 'motel', 'private');
  lot({ x: 700, y: 372, w: 18, h: 12 }, 'office', 'helix', { name: 'Helix regional office' }); lot({ x: 700, y: 386, w: 18, h: 12 }, 'office', 'private'); lot({ x: 720, y: 372, w: 12, h: 26 }, 'parking', 'private');
  site({ kind: 'clinic', name: 'Valley General Hospital', job: [1.6, 1] }, { x: 726, y: 404, w: 30, h: 22 }); lot({ x: 758, y: 404, w: 14, h: 22 }, 'parking', 'town');
  // industrial / logistics park and the data-center campus near the highway
  const fc = site({ kind: 'fleet', name: 'Helix Fulfillment Center', asset: 'depot', job: [0.7, 0] }, { x: 652, y: 192, w: 60, h: 30 });
  lot({ x: 652, y: 223, w: 60, h: 12 }, 'parking', 'helix', { name: 'truck yard' });
  site({ kind: 'warehouse', name: 'Valley Distribution', job: [1.3, 0] }, { x: 720, y: 190, w: 30, h: 16 });
  site({ kind: 'factory', name: 'Okafor Manufacturing', asset: 'okafor', job: [1.0, 1] }, { x: 578, y: 192, w: 24, h: 14 });
  for (const [x, y, w, h] of [[578, 150, 26, 14], [608, 150, 26, 14], [756, 190, 26, 16], [578, 210, 26, 12], [610, 205, 24, 14], [700, 150, 36, 18], [740, 150, 26, 14], [660, 110, 30, 16], [700, 112, 34, 16], [610, 112, 24, 14]]) lot({ x, y, w, h }, 'warehouse', wr() < 0.4 ? 'helix' : 'private');
  site({ kind: 'compute', name: 'Helix Datacenter', asset: 'dc', job: [0.8, 1] }, { x: 812, y: 124, w: 40, h: 20 });
  lot({ x: 812, y: 146, w: 18, h: 9 }, 'parking', 'helix');
  site({ kind: 'substation', name: 'Valley Substation' }, { x: 862, y: 126, w: 12, h: 10 });
  site({ kind: 'solar', name: 'Landfill Solar (town)', asset: 'landfill' }, { x: 930, y: 262, w: 30, h: 24 });
  site({ kind: 'station', name: 'Rail Station / Federal Works' }, { x: 494, y: 488, w: 12, h: 6 });
  // schools, parks, apartments
  site({ kind: 'school', name: 'Valley High School', job: [1.0, 1] }, { x: 556, y: 552, w: 36, h: 20 });
  site({ kind: 'sport', name: 'School fields' }, { x: 556, y: 574, w: 40, h: 24 });
  site({ kind: 'school', name: 'Elm Elementary', job: [0.5, 1] }, { x: 790, y: 420, w: 16, h: 10 });
  site({ kind: 'park', name: 'Riverside Park' }, { x: 560, y: 412, w: 60, h: 9 });
  site({ kind: 'park', name: 'Mill Pond Park' }, { x: 420, y: 600, w: 30, h: 22 });
  for (const [x, y, n] of [[360, 304, 'Westgate Apartments'], [700, 520, 'River Bend Apartments'], [860, 420, 'Ridge Commons Apartments']]) {
    for (let k = 0; k < 4; k++) lot({ x: x + (k % 2) * 14, y: y + Math.floor(k / 2) * 8, w: 12, h: 5 }, 'apartments', 'private', { name: n });
    lot({ x: x + 28, y, w: 8, h: 13 }, 'parking', 'private');
  }
  site({ kind: 'farm', name: 'Moreno Farm', job: [1.0, 0] }, { x: 250, y: 690, w: 60, h: 50 });

  // ---------- neighborhoods ----------
  const streets = [];
  const growStreet = (start, heading, opts) => {
    // walk forward, turning gently; stop before running into anything
    const pts = [start.slice()];
    let [x, y] = start, h = heading, len = 0;
    const turn = opts.turn || 0.06, step = 3;
    while (len < opts.max) {
      h += (wr() - 0.5) * turn * 2 + (opts.bias || 0);
      const nx = x + Math.cos(h) * step, ny = y + Math.sin(h) * step;
      const ax = nx + Math.cos(h) * 4, ay = ny + Math.sin(h) * 4;
      if (len > 5 && (occAt(ax, ay) || occAt(ax + Math.sin(h) * 2, ay - Math.cos(h) * 2) || occAt(ax - Math.sin(h) * 2, ay + Math.cos(h) * 2))) break;
      if (!opts.zone(nx, ny)) break;
      x = nx; y = ny; len += step;
      if (pts.length === 1 || len % 6 < step) pts.push([x, y]);
    }
    if (Math.hypot(pts[pts.length - 1][0] - x, pts[pts.length - 1][1] - y) > 0.5) pts.push([x, y]);
    return len >= (opts.min || 12) ? pts : null;
  };
  const commit = (pts, cls, name, cul) => { snapStart(pts); const r = addRoad(cls, pts, name, true); r.cul = cul; streets.push(r); return r; };

  // postwar west side: a gently warped grid between the interstate and River Road
  const zW = (x, y) => x > 150 && x < 394 && y > polyAt(I80, x) + 10 && y < polyAt(RIVER_RD, x) - 5;
  const crossX = [];
  for (let x = 170; x < 390; x += 46) crossX.push(x);
  for (const cx of crossX) commit([[cx, polyAt(I80, cx) + 12], RR(cx)], 'local', 'postwar');
  for (let k = 0; k < 6; k++) {
    const y0 = 262 + k * 19;
    const pts = [];
    for (let x = 152; x < 394; x += 6) { const y = y0 + Math.sin(x / 45 + k) * 3 + (x - 152) * 0.18; if (zW(x, y)) pts.push([x, y]); else if (pts.length) break; }
    if (pts.length > 4) { const r = addRoad('local', pts, 'postwar', true); streets.push(r); }
  }
  // newer suburbs: "pods" with a curving collector spine and side streets ending in cul-de-sacs.
  // Streets sit ~18 tiles (90 m) apart: two 40 m lots back to back plus the street.
  const clearRun = (pts, minLen) => { // longest stretch of a polyline that doesn't hit anything built
    let best = [], cur = [];
    for (const p of pts) { const ok = !occAt(p[0], p[1]) && inMap(p[0], p[1]); if (ok) cur.push(p); else { if (cur.length > best.length) best = cur; cur = []; } }
    if (cur.length > best.length) best = cur;
    return best.length * 3 >= minLen ? best : null;
  };
  const connect = (pt, maxD, skip) => { const [q, d] = nearestOnRoads(pt[0], pt[1], skip); if (q && d > 0.3 && d < maxD) { addRoad('local', [q, pt], 'connector', true); return true; } return d <= 0.3; };
  const pod = (cx, cy, len, half, ang, bend, zone) => {
    const dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    const spine = [];
    for (let u = -len / 2; u <= len / 2; u += 3) { const b = Math.sin((u / len + 0.5) * Math.PI) * bend; spine.push([cx + dir[0] * u + nrm[0] * b, cy + dir[1] * u + nrm[1] * b]); }
    const run = clearRun(spine.filter(p => zone(p[0], p[1])), 40);
    if (!run) return;
    const sp = addRoad('collector', run, 'suburb collector', true); streets.push(sp);
    if (!connect(run[0], 60, sp) && !connect(run[run.length - 1], 60, sp)) { const mid = run[run.length >> 1]; connect(mid, 90, sp); }
    else connect(run[run.length - 1], 60, sp);
    for (let i = 3; i < run.length - 2; i += 6) for (const side of [-1, 1]) {
      const [ax, ay] = run[i], [bx, by] = run[i + 1], base = Math.atan2(by - ay, bx - ax) + side * Math.PI / 2;
      const pts = [[ax, ay]]; let x = ax, y = ay, h = base, L = 0; const curl = (wr() - 0.5) * 0.04;
      while (L < half) {
        h += curl; const nx = x + Math.cos(h) * 3, ny = y + Math.sin(h) * 3;
        const fx = nx + Math.cos(h) * 6, fy = ny + Math.sin(h) * 6;
        if (L > 4 && (occAt(fx, fy) || !zone(fx, fy))) break;
        x = nx; y = ny; L += 3; pts.push([x, y]);
      }
      if (L >= 15) { const r = addRoad('local', pts, 'suburb', true); r.cul = true; streets.push(r); }
    }
  };
  const notForest = (x, y) => inMap(x, y) && terrain[idx(x, y)] !== T.FOREST;
  const zSB = (x, y) => notForest(x, y) && y > polyAt(RAIL, x) + 8 && y < 720;
  const zE = (x, y) => notForest(x, y) && x > 704 && x < 935 && y > 286 && y < polyAt(RIVER_RD, x) - 5;
  const zN = (x, y) => notForest(x, y) && x > 220 && x < 560 && y < polyAt(I80, x) - 10;
  const zSE = (x, y) => notForest(x, y) && x > 690 && x < 960 && y > polyAt(RAIL, x) + 8 && y < 770;
  for (const [cx, cy, len, half, ang, bend, z] of [
    [370, 540, 150, 40, 0.15, 10, zSB], [455, 625, 150, 34, -0.1, -12, zSB], [345, 640, 90, 30, 1.4, 8, zSB], [620, 650, 110, 32, 0.3, 10, zSB], [470, 540, 70, 26, 0.1, 6, zSB],
    [770, 318, 120, 22, 0.05, 6, zE], [850, 410, 120, 28, -0.6, 10, zE], [750, 450, 70, 18, 0.35, 4, zE],
    [760, 620, 140, 34, 0.35, 12, zSE], [850, 690, 140, 34, 0.45, -10, zSE], [740, 720, 90, 26, 0.2, 8, zSE],
    [400, 190, 150, 30, 0.08, -10, zN], [300, 205, 90, 24, 0.12, 8, zN], [500, 150, 100, 26, -0.5, 10, zN],
  ]) pod(cx, cy, len, half, ang, bend, z);

  // houses along every residential street (and around cul-de-sac bulbs)
  const tryHouse = (cx, cy, ang) => {
    const hw = 1.2, hd = 1.0, ca = Math.cos(ang), sa = Math.sin(ang);
    const pts = []; for (let u = -hw - 0.6; u <= hw + 0.6; u += 0.7) for (let v = -hd - 0.6; v <= hd + 0.6; v += 0.7) pts.push([cx + u * ca - v * sa, cy + u * sa + v * ca]);
    if (pts.some(([x, y]) => occAt(x, y))) return null;
    pts.forEach(([x, y]) => { if (inMap(x, y)) occ[idx(x, y)] = 2; });
    const hs = { x: cx, y: cy, ang, w: 2.4, h: 2.0, roof: false, v: Math.floor(wr() * 20) };
    houses.push(hs); return hs;
  };
  for (const r of roads.filter(q => q.res)) {
    const half = RW[r.cls] / 2;
    let carry = 2;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1], L = Math.hypot(bx - ax, by - ay);
      if (L < 0.01) continue;
      const tx = (bx - ax) / L, ty = (by - ay) / L, ang = Math.atan2(ty, tx);
      let s = carry;
      for (; s < L; s += 5.2) {
        const px = ax + tx * s, py = ay + ty * s;
        for (const side of [-1, 1]) {
          const off = half + 2.4;
          const back = [px - ty * side * (half + 7.5), py + tx * side * (half + 7.5)];
          if (occAt(back[0], back[1]) === 1) continue;
          tryHouse(px - ty * side * off, py + tx * side * off, ang);
        }
      }
      carry = s - L;
    }
    if (r.cul) {
      const [ex, ey] = r.pts[r.pts.length - 1], [qx, qy] = r.pts[Math.max(0, r.pts.length - 2)], back = Math.atan2(qy - ey, qx - ex);
      for (let a = -2.2; a <= 2.21; a += 1.1) { const an = back + Math.PI + a; tryHouse(ex + Math.cos(an) * 6, ey + Math.sin(an) * 6, an + Math.PI / 2); }
    }
  }

  // farmland on the open valley floor, woodlots between fields, the metro edge to the east
  const farmZone = (x, y) => (x < 150 || x > 940 || y > 640 || (y < 230 && (x < 240 || x > 980))) && terrain[idx(x, y)] !== T.FOREST && terrain[idx(x, y)] !== T.WATER;
  for (let fy = 0; fy < H; fy += 40) for (let fx = 0; fx < W; fx += 50) {
    const fw = 40 + Math.floor(wr() * 20), fh = 30 + Math.floor(wr() * 12), kind = wr();
    for (let y = fy; y < Math.min(H, fy + fh); y++) for (let x = fx; x < Math.min(W, fx + fw); x++) {
      if (!farmZone(x, y) || occ[idx(x, y)]) continue;
      terrain[idx(x, y)] = kind < 0.12 ? T.FOREST : kind < 0.5 ? ((Math.floor(y / 2) % 2) ? T.FIELD : T.FIELD2) : kind < 0.85 ? ((Math.floor(x / 2) % 2) ? T.FIELD3 : T.FIELD2) : T.GRASS2;
    }
    if (kind > 0.12 && farmZone(fx + 2, fy + 2)) fields.push({ x: fx, y: fy, w: fw, h: fh });
  }
  for (let y = 120; y < 360; y++) for (let x = 1150; x < W; x++) if (!occ[idx(x, y)] && terrain[idx(x, y)] !== T.WATER) terrain[idx(x, y)] = T.METRO;
  // lawns around houses read as suburb at a distance
  for (const hs of houses) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = Math.floor(hs.x + dx), y = Math.floor(hs.y + dy); if (inMap(x, y) && (terrain[idx(x, y)] === T.GRASS || terrain[idx(x, y)] === T.GRASS2 || terrain[idx(x, y)] === T.FOREST)) terrain[idx(x, y)] = T.LAWN; }

  // parcels for big future builds: campus halls, industrial sheds, solar farms on farmland
  const tryParcels = (kind, x0, x1, y0, y1, w, h, gap) => { for (let y = y0; y + h <= y1; y += h + gap) for (let x = x0; x + w <= x1; x += w + gap) { const r = { x, y, w, h }; if (rectFree(r, true)) { mark(r, 4); parcels.push({ ...r, kind, used: false }); } } };
  tryParcels('campus', 770, 980, 60, 168, 40, 20, 4);
  tryParcels('industrial', 560, 780, 70, 176, 30, 18, 4);
  tryParcels('farm', 960, 1190, 250, 560, 60, 50, 6);
  tryParcels('farm', 40, 1150, 690, 860, 60, 50, 6);
  tryParcels('farm', 20, 150, 120, 300, 60, 50, 6);
  parcels.sort((a, b) => a.kind === b.kind ? Math.hypot(a.x - 860, a.y - 140) - Math.hypot(b.x - 860, b.y - 140) : 0);

  return { terrain, occ, roads, rail, power, houses, lots, sites, parcels };
}

// ---------- road graph and routing (Yuka Graph + A*) ----------
function buildRoadGraph(roads) {
  // 1) densify, 2) split segments where roads meet, 3) merge coincident points into nodes
  const segs = [];
  roads.forEach((r, ri) => {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / 12));
      for (let k = 0; k < n; k++) segs.push({ ri, cls: r.cls, a: [lerp(ax, bx, k / n), lerp(ay, by, k / n)], b: [lerp(ax, bx, (k + 1) / n), lerp(ay, by, (k + 1) / n)], cuts: [] });
    }
  });
  const CELL = 24, grid = new Map();
  segs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s.a[0], s.b[0]) / CELL), x1 = Math.floor(Math.max(s.a[0], s.b[0]) / CELL), y0 = Math.floor(Math.min(s.a[1], s.b[1]) / CELL), y1 = Math.floor(Math.max(s.a[1], s.b[1]) / CELL);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = x + ',' + y; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  });
  const crosses = (s, t) => { const iS = s.cls === 'interstate', iT = t.cls === 'interstate'; return iS === iT || s.cls === 'ramp' || t.cls === 'ramp'; };
  const projT = (p, s) => { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L2 = dx * dx + dy * dy; const t = clamp(((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / L2, 0, 1); return [t, Math.hypot(s.a[0] + dx * t - p[0], s.a[1] + dy * t - p[1])]; };
  const seen = new Set();
  for (const list of grid.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const i = list[a], j = list[b], key = i < j ? i + ':' + j : j + ':' + i;
    if (seen.has(key)) continue; seen.add(key);
    const s = segs[i], t = segs[j];
    if (s.ri === t.ri || !crosses(s, t)) continue;
    // proper intersection
    const d = (t.b[1] - t.a[1]) * (s.b[0] - s.a[0]) - (t.b[0] - t.a[0]) * (s.b[1] - s.a[1]);
    if (Math.abs(d) > 1e-9) {
      const ua = ((t.b[0] - t.a[0]) * (s.a[1] - t.a[1]) - (t.b[1] - t.a[1]) * (s.a[0] - t.a[0])) / d;
      const ub = ((s.b[0] - s.a[0]) * (s.a[1] - t.a[1]) - (s.b[1] - s.a[1]) * (s.a[0] - t.a[0])) / d;
      if (ua > 0.001 && ua < 0.999 && ub > 0.001 && ub < 0.999) { s.cuts.push(ua); t.cuts.push(ub); continue; }
    }
    // T-junctions: an endpoint lying on the other segment
    for (const [p, q, other] of [[s.a, s, t], [s.b, s, t], [t.a, t, s], [t.b, t, s]]) {
      const [tt, dist] = projT(p, other);
      if (dist < 0.8) other.cuts.push(tt); // the endpoint becomes a node; nodeAt merges the two within tolerance
    }
  }
  const graph = new YUKA.Graph(); graph.digraph = false;
  const nodes = [], keyOf = new Map();
  const nodeAt = (x, y) => { // merge points closer than 0.9 tiles into one node
    const gx = Math.floor(x), gy = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const id of keyOf.get((gx + dx) + ',' + (gy + dy)) || []) if (Math.hypot(nodes[id].x - x, nodes[id].y - y) < 0.9) return id;
    const id = nodes.length; nodes.push({ x, y });
    const k = gx + ',' + gy; if (!keyOf.has(k)) keyOf.set(k, []); keyOf.get(k).push(id);
    graph.addNode(new YUKA.NavNode(id, new YUKA.Vector3(x, y, 0))); return id;
  };
  const speedOf = { interstate: 2.2, ramp: 1.4, arterial: 1.5, collector: 1.2, main: 1, downtown: 0.9, local: 0.9, service: 1 };
  for (const s of segs) {
    const ts = [0, 1, ...s.cuts].sort((a, b) => a - b);
    let prev = null;
    for (const t of ts) {
      const id = nodeAt(lerp(s.a[0], s.b[0], t), lerp(s.a[1], s.b[1], t));
      if (prev !== null && prev !== id && !graph.hasEdge(prev, id)) { const p = nodes[prev], q = nodes[id]; const c = Math.hypot(p.x - q.x, p.y - q.y) / speedOf[s.cls]; graph.addEdge(new YUKA.NavEdge(prev, id, c)); }
      prev = id;
    }
  }
  // spatial index of nodes (driveway access: no interstate or ramp nodes)
  const nIdx = new Map(), NC = 20;
  const access = new Set();
  segs.forEach(s => { if (s.cls !== 'interstate' && s.cls !== 'ramp') { access.add(nodeAt(s.a[0], s.a[1])); access.add(nodeAt(s.b[0], s.b[1])); } });
  nodes.forEach((n, i) => { if (!access.has(i)) return; const k = Math.floor(n.x / NC) + ',' + Math.floor(n.y / NC); if (!nIdx.has(k)) nIdx.set(k, []); nIdx.get(k).push(i); });
  const nearestNode = (x, y) => {
    for (let r = 0; r < 12; r++) {
      let best = -1, bd = Infinity;
      const cx = Math.floor(x / NC), cy = Math.floor(y / NC);
      for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) for (const i of nIdx.get(gx + ',' + gy) || []) { const d = Math.hypot(nodes[i].x - x, nodes[i].y - y); if (d < bd) { bd = d; best = i; } }
      if (best >= 0 && bd < (r + 1) * NC) return best;
    }
    return 0;
  };
  // keep only the largest connected component reachable for access nodes
  return { graph, nodes, nearestNode, edges: segs.length };
}

let ROUTE_CACHE = new Map();
function nodePath(a, b) {
  const key = a + '>' + b;
  let p = ROUTE_CACHE.get(key);
  if (!p) {
    const astar = new YUKA.AStar(S.road.graph, a, b);
    astar.heuristic = YUKA.HeuristicPolicyEuclid;
    astar.search();
    p = astar.found ? astar.getPath() : [a, b];
    if (ROUTE_CACHE.size > 20000) ROUTE_CACHE.clear();
    ROUTE_CACHE.set(key, p);
  }
  return p;
}
// Route along the road network: to the nearest street, along the streets, then in the door.
function route(from, site, target) {
  const R = S.road;
  const a = R.nearestNode(from.x, from.y), b = site ? (site.node ?? (site.node = R.nearestNode(site.cx, site.cy))) : R.nearestNode(target.x, target.y);
  const pts = [{ x: from.x, y: from.y }];
  for (const i of nodePath(a, b)) pts.push({ x: R.nodes[i].x, y: R.nodes[i].y });
  pts.push(target);
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.3);
}

let SITE_ID = 0;
function makeSite(kind, name, r, extra = {}) {
  const s = { id: 's' + (++SITE_ID), kind, name, x: r.x, y: r.y, w: r.w, h: r.h, ...extra };
  s.cx = s.x + s.w / 2; s.cy = s.y + s.h / 2;
  return s;
}
function spotIn(site, margin = 0.6) {
  const m = Math.min(margin, site.w / 3, site.h / 3);
  return { x: site.x + m + rand() * Math.max(0.1, site.w - m * 2), y: site.y + m + rand() * Math.max(0.1, site.h - m * 2) };
}
// "in town": the valley floor south of the interstate (the logistics park and data campus sit outside, by the highway)
function inTown(x, y) { return x >= TOWN.x0 && x <= TOWN.x1 && y >= polyAt(I80, x) + 8 && y <= TOWN.y1; }

const FAMILY_NAMES = ['Okafor', 'Patel', 'Moreno', 'Kowalski', 'Nguyen', 'Haddad', 'Lindqvist', 'Mensah', 'Sato', 'Romero', 'Byrne', 'Achterberg', 'Dubois', 'Castillo', 'Ivanova', 'Park'];
const FIRST = ['Mara', 'Teo', 'Juno', 'Odile', 'Ravi', 'Ines', 'Kofi', 'Lena', 'Omar', 'Sana', 'Pavel', 'Yuki', 'Bea', 'Tomas', 'Ada', 'Felix', 'Nia', 'Hugo', 'Rosa', 'Idris', 'Mei', 'Arlo', 'Zara', 'Emil', 'Noor', 'Cyrus', 'Lucia', 'Dev', 'Ola', 'Wren', 'Iris', 'Bram', 'Kaito', 'Esme', 'Joaquin', 'Talia', 'Sami', 'Greta', 'Milo', 'Amara', 'Rhys', 'Lark', 'Basil', 'Frida', 'Anouk', 'Tariq', 'Vera', 'Quinn', 'Ezra', 'Pia'];
