// Drawing. World units are 5 m tiles. Static things (terrain, roads, rail, power lines, the ~1,700
// houses) are baked into one cached canvas; lots, sites, cars, robots and people are drawn live with
// view culling. Detail and labels switch on by zoom (LOD).
const PAL = {
  [T.GRASS]: ['#4a7d3f', '#467839'], [T.GRASS2]: ['#4f8444', '#4a7d3f'], [T.WATER]: ['#2c5d9e', '#3468ad'], [T.FIELD]: ['#a8955a', '#9c8a4a'],
  [T.FIELD2]: ['#879f4c', '#7f9a44'], [T.FIELD3]: ['#b7a35e', '#a99550'], [T.FOREST]: ['#24512a', '#2c5e31'], [T.BANK]: ['#a99d72', '#9f936a'],
  [T.METRO]: ['#7b7c80', '#8a8b90'], [T.PAVE]: ['#9a958c', '#8f8a82'], [T.LAWN]: ['#5b8f4a', '#578a46'], [T.SPORT]: ['#3f9a46', '#ffffff'],
};
const ROAD_STYLE = {
  interstate: { c: '#3f434d', edge: '#262930', mark: '#e8d44d' }, ramp: { c: '#4a4e58', edge: '#2c2f36' }, arterial: { c: '#5a5e68', edge: '#3a3d45', mark: '#e8d44d' },
  collector: { c: '#666a73', edge: '#474a52', mark: '#d8d8d8' }, main: { c: '#6a6560', edge: '#4a4540', mark: '#e8d44d' }, downtown: { c: '#6e6a66', edge: '#4e4a46' },
  local: { c: '#74777e', edge: '#5d6067' }, service: { c: '#6e7178', edge: '#55585e' },
};
const ROAD_ORDER = ['local', 'service', 'downtown', 'collector', 'main', 'arterial', 'ramp', 'interstate'];
const OWNER_COLOR = { outside: '#d062e6', town: '#4aa3ff', coop: '#6fdc6f', resident: '#f2c14e' };
const SITE_COLOR = {
  home: '#b98f5e', school: '#d9b44a', clinic: '#e9ecf4', market: '#d9774b', cafe: '#a8673a', learn: '#8e7cc3', hall: '#aab3c6', warehouse: '#8a7c6c',
  repair: '#6c8a5c', diner: '#c0504d', farm: '#a3743f', station: '#8e8e8e', plaza: '#c9bf9f', park: '#4f9a46', sport: '#3f9a46', solar: '#24345e', compute: '#3a4150',
  factory: '#8d6e63', fleet: '#4d5f69', substation: '#6a6f78',
};
const HOUSE_WALL = ['#c9b28a', '#b98f5e', '#a7b4a0', '#c99a7a', '#d6cbb4', '#b0a8a0'];
const HOUSE_ROOF = ['#8a4b3a', '#5d4a3c', '#6e3b3b', '#4f5a62', '#7a6a58', '#3f4650'];

let terrainCanvas = null, bakedVersion = -1, lastBake = 0;
const BPX = 2; // baked pixels per tile
function strokePoly(g, pts, sc, width, color, dash) {
  g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []);
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * sc, y * sc) : g.moveTo(x * sc, y * sc)); g.stroke(); g.setLineDash([]);
}
function bakeTerrain() {
  const t0 = performance.now();
  if (!terrainCanvas) { terrainCanvas = document.createElement('canvas'); terrainCanvas.width = MAP_W * BPX; terrainCanvas.height = MAP_H * BPX; }
  const g = terrainCanvas.getContext('2d');
  const img = g.createImageData(MAP_W * BPX, MAP_H * BPX), d = img.data;
  const rgb = {}; for (const k in PAL) rgb[k] = PAL[k].map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = S.terrain[y * MAP_W + x], [c1, c2] = rgb[t];
    for (let py = 0; py < BPX; py++) for (let px = 0; px < BPX; px++) {
      let c = c1;
      if (t === T.FOREST) c = ((x * 3 + y * 7 + px * 5 + py * 11) % 5 < 2) ? c2 : c1;
      else if (t === T.WATER) c = ((x + y * 2 + px) % 7 === 0) ? c2 : c1;
      else if (t === T.METRO) c = (x % 8 === 0 || y % 8 === 0) ? c1 : c2;
      else if ((x * 3 + y * 5 + px) % 11 === 0) c = c2;
      const i = ((y * BPX + py) * MAP_W * BPX + x * BPX + px) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // rail and power corridor
  for (const r of S.rail) { strokePoly(g, r, BPX, 1.6 * BPX, '#5a4a3a'); strokePoly(g, r, BPX, 0.5 * BPX, '#a8a8a8', [3, 2]); }
  for (const line of S.power) strokePoly(g, line, BPX, 1, 'rgba(230,230,230,0.55)', [6, 3]);
  // roads, minor first, edge then surface
  for (const cls of ROAD_ORDER) for (const r of S.roads) if (r.cls === cls) strokePoly(g, r.pts, BPX, (RW[cls] + 0.6) * BPX, ROAD_STYLE[cls].edge);
  for (const cls of ROAD_ORDER) for (const r of S.roads) if (r.cls === cls) { g.lineCap = 'round'; strokePoly(g, r.pts, BPX, RW[cls] * BPX, ROAD_STYLE[cls].c); g.lineCap = 'butt'; }
  for (const r of S.roads) if (r.cls === 'interstate') strokePoly(g, r.pts, BPX, 0.6, '#9aa0a8');
  // houses (the unsimulated neighbors included) as tiny rotated roofs
  for (const hs of S.houses) {
    g.save(); g.translate(hs.x * BPX, hs.y * BPX); g.rotate(hs.ang);
    g.fillStyle = hs.roof ? '#4f7fd1' : HOUSE_ROOF[hs.v % HOUSE_ROOF.length];
    g.fillRect(-hs.w / 2 * BPX, -hs.h / 2 * BPX, hs.w * BPX, hs.h * BPX);
    g.restore();
  }
  bakedVersion = S.bakeVersion; lastBake = performance.now();
  S.bakeMs = Math.round(lastBake - t0);
}

const cam = { x: 560, y: 380, z: 2, tx: 560, ty: 380, tz: 2, follow: null };
let canvas, ctx, W = 0, H = 0, DPR = 1;
const view = { colorBy: 'loyalty', selected: null, selSite: null, selLot: null, hover: null };

function w2s(x, y) { return [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]; }
function s2w(sx, sy) { return [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]; }
function minZoom() { return Math.max(0.4, Math.min(W / MAP_W, H / MAP_H)); }

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function ownerBuckets(a) {
  const b = { outside: 0, town: 0, coop: 0, resident: 0 };
  for (const [k, v] of Object.entries(a.shares)) { const kind = ownerKind(k); b[kind === 'resident' && isCoop(a) ? 'coop' : kind] += v; }
  return b;
}

function agentColor(p) {
  if (p.isPlayer) return '#ffffff';
  if (view.colorBy === 'loyalty') return SPHERE_COLOR[dominant(p.w)];
  if (view.colorBy === 'wellbeing') { const v = clamp(p.wellbeing, 0, 1); return `rgb(${Math.round(230 - 170 * v)},${Math.round(70 + 170 * v)},${Math.round(70 + 40 * v)})`; }
  const stake = sum(holdingsOf(p.home.id), h => h.value) / p.home.members.length;
  if (stake < 500) return '#6c7488';
  const v = clamp(Math.log10(stake) / 6, 0, 1);
  return `rgb(${Math.round(150 + 100 * v)},${Math.round(130 + 80 * v)},${Math.round(60 - 40 * v)})`;
}

// ---------- labels: queued, then placed by priority without overlaps ----------
let LABELS = [];
function queueLabel(text, x, y, pri, color = '#ffffff', bg = 'rgba(8,12,28,0.78)', big = false) { LABELS.push({ text, x, y, pri, color, bg, big }); }
function flushLabels() {
  LABELS.sort((a, b) => b.pri - a.pri);
  const placed = [];
  for (const L of LABELS) {
    ctx.font = L.big ? 'bold 11px ui-monospace, Menlo, Consolas, monospace' : '10px ui-monospace, Menlo, Consolas, monospace';
    const w = ctx.measureText(L.text).width + 6, r = { x0: L.x - w / 2, x1: L.x + w / 2, y0: L.y - 8, y1: L.y + 6 };
    if (r.x1 < 0 || r.x0 > W || r.y1 < 0 || r.y0 > H) continue;
    if (placed.some(q => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue;
    placed.push(r);
    if (L.big) { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(L.text, L.x + 1, L.y + 1); ctx.fillStyle = L.color; ctx.fillText(L.text, L.x, L.y); }
    else label(L.text, L.x, L.y, L.color, L.bg);
  }
  LABELS = [];
}
function label(text, sx, sy, color = '#ffffff', bg = 'rgba(8,12,28,0.78)') {
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = bg; ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - 7), Math.round(w), 12);
  ctx.fillStyle = color; ctx.fillText(text, Math.round(sx), Math.round(sy + 2));
}
const REGION_LABELS = [
  ['DOWNTOWN', 478, 292], ['INTERSTATE 17', 230, 228, '#d8dce6'], ['VALLEY PKWY', 628, 140, '#d8dce6'], ['LOGISTICS PARK', 640, 140], ['HELIX DATA CAMPUS', 860, 100],
  ['PARKWAY RETAIL', 660, 296], ['WEST SIDE', 270, 290], ['SOUTH BANK', 420, 560], ['RIDGE', 820, 320], ['ORCHARD HILLS', 800, 650], ['NORTH HILLS', 400, 180],
  ['river', 120, 346, '#9cc4ff'], ['rail', 300, 470, '#cfcfcf'], ['to the metro →', 1150, 112, '#e6e6e6'], ['farmland', 1060, 420, '#e8dca0'], ['farmland', 130, 760, '#e8dca0'],
];

function draw(now) {
  if (cam.follow) { cam.tx = cam.follow.position.x; cam.ty = cam.follow.position.y; }
  const k = 0.18;
  cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(cam.tz), k));
  cam.x = lerp(cam.x, cam.tx, k); cam.y = lerp(cam.y, cam.ty, k);
  const z = cam.z;
  if (bakedVersion !== S.bakeVersion && now - lastBake > 3000) bakeTerrain(); // throttled re-bake when rooftops spread
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
  const [vx0, vy0] = s2w(0, 0), [vx1, vy1] = s2w(W, H);
  // blit only the visible part of the baked layer
  const bx0 = clamp(Math.floor(vx0) - 1, 0, MAP_W), by0 = clamp(Math.floor(vy0) - 1, 0, MAP_H), bx1 = clamp(Math.ceil(vx1) + 1, 0, MAP_W), by1 = clamp(Math.ceil(vy1) + 1, 0, MAP_H);
  if (bx1 > bx0 && by1 > by0) {
    const [dx, dy] = w2s(bx0, by0);
    ctx.imageSmoothingEnabled = z < BPX;
    ctx.drawImage(terrainCanvas, bx0 * BPX, by0 * BPX, (bx1 - bx0) * BPX, (by1 - by0) * BPX, dx, dy, (bx1 - bx0) * z, (by1 - by0) * z);
    ctx.imageSmoothingEnabled = false;
  }
  const visible = (x, y, w, h) => x + w > vx0 && x < vx1 && y + h > vy0 && y < vy1;
  if (z >= 3) drawRoadsLive(visible);
  if (z >= 4) drawHousesLive(visible, z);

  for (const l of S.lots) { if (!l.site && visible(l.x, l.y, l.w, l.h)) drawLot(l, now); }
  for (const s of S.sites) { if (visible(s.x, s.y, s.w, s.h)) drawSite(s, now); }
  drawCars(visible);
  if (z < 2.6) for (const [t, x, y, c] of REGION_LABELS) { const [sx, sy] = w2s(x, y); queueLabel(t, sx, sy, 50, c || '#ffffff', null, true); }
  // robots
  const rs = Math.max(2, Math.min(z * 0.25, 8));
  for (const r of S.robots) {
    const { x, y } = r.position; if (!visible(x - 1, y - 1, 2, 2)) continue;
    const [sx, sy] = w2s(x, y);
    ctx.fillStyle = '#1b2b33'; ctx.fillRect(sx - rs / 2 - 1, sy - rs / 2 - 1, rs + 2, rs + 2);
    ctx.fillStyle = '#9fe7ff'; ctx.fillRect(sx - rs / 2, sy - rs / 2, rs, rs);
  }
  // people
  const ps = Math.max(3, Math.min(z * 0.32, 12));
  for (const p of S.people) {
    const { x, y } = p.position; if (!visible(x - 1, y - 1, 2, 2)) continue;
    const [sx, sy] = w2s(x, y);
    ctx.fillStyle = '#0b1020'; ctx.fillRect(sx - ps / 2 - 1, sy - ps / 2 - 1, ps + 2, ps + 2);
    ctx.fillStyle = agentColor(p); ctx.fillRect(sx - ps / 2, sy - ps / 2, ps, ps);
    if (p.age === 'kid' && z > 10) { ctx.fillStyle = '#0b1020'; ctx.fillRect(sx - ps / 2, sy - ps / 2, ps, ps * 0.3); }
    if (p.isPlayer) { const r = ps + 4 + Math.sin(now / 200) * 2; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.strokeRect(sx - r / 2, sy - r / 2, r, r); }
    if (p === view.selected) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(sx - ps / 2 - 4, sy - ps / 2 - 4, ps + 8, ps + 8);
      if (p.moving && p.wp) { ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(sx, sy); for (let i = p.wpi; i < p.wp.length; i++) { const [qx, qy] = w2s(p.wp[i].x, p.wp[i].y); ctx.lineTo(qx, qy); } ctx.stroke(); ctx.setLineDash([]); }
    }
    if (z >= 22 || p === view.selected || (p.isPlayer && z >= 6)) queueLabel((p.isPlayer ? 'YOU' : p.first) + (p.activity && z >= 30 ? ' · ' + p.activity : ''), sx, sy - ps / 2 - 9, p.isPlayer ? 100 : p === view.selected ? 95 : 40, p.isPlayer ? '#ffe066' : '#ffffff');
  }
  // night
  const hr = S.t % 24, dark = hr < 5 ? 0.42 : hr < 7 ? lerp(0.42, 0, (hr - 5) / 2) : hr < 19 ? 0 : hr < 21 ? lerp(0, 0.42, (hr - 19) / 2) : 0.42;
  if (dark > 0) {
    ctx.fillStyle = `rgba(8,12,40,${dark})`; ctx.fillRect(0, 0, W, H);
    if (z >= 1.5) {
      ctx.fillStyle = `rgba(255,214,110,${dark * 1.6})`; const q = Math.max(1, z * 0.5);
      for (const hs of S.houses) { if (hs.v % 3 === 0 || !visible(hs.x - 2, hs.y - 2, 4, 4)) continue; const [sx, sy] = w2s(hs.x, hs.y); ctx.fillRect(sx - q / 2, sy - q / 2, q, q); }
    }
  }
  flushLabels();
}

function drawRoadsLive(visible) {
  const z = cam.z;
  for (const pass of [0, 1, 2]) for (const cls of ROAD_ORDER) for (const r of S.roads) {
    if (r.cls !== cls) continue;
    const bb = r.bb || (r.bb = r.pts.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }));
    if (!visible(bb.x0 - 5, bb.y0 - 5, bb.x1 - bb.x0 + 10, bb.y1 - bb.y0 + 10)) continue;
    const st = ROAD_STYLE[cls];
    ctx.beginPath(); r.pts.forEach(([x, y], i) => { const [sx, sy] = w2s(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    ctx.lineJoin = 'round';
    if (pass === 0) { ctx.strokeStyle = st.edge; ctx.lineWidth = (RW[cls] + 0.6) * z; ctx.lineCap = 'butt'; ctx.stroke(); }
    else if (pass === 1) { ctx.strokeStyle = st.c; ctx.lineWidth = RW[cls] * z; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt'; }
    else if (st.mark && z >= 6) { ctx.strokeStyle = st.mark; ctx.lineWidth = Math.max(1, z * 0.08); ctx.setLineDash(cls === 'interstate' ? [] : [z * 0.6, z * 0.9]); ctx.stroke(); ctx.setLineDash([]); }
  }
}
function drawHousesLive(visible, z) {
  for (const hs of S.houses) {
    if (!visible(hs.x - 3, hs.y - 3, 6, 6)) continue;
    const [sx, sy] = w2s(hs.x, hs.y);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(hs.ang);
    const w = hs.w * z, h = hs.h * z;
    if (z >= 7) { ctx.fillStyle = '#5b8f4a'; ctx.fillRect(-w * 0.95, -h * 1.0, w * 1.9, h * 2.1); ctx.fillStyle = '#8a8d92'; ctx.fillRect(w * 0.15, h * 0.5, w * 0.3, h * 0.75); } // yard and driveway
    ctx.fillStyle = HOUSE_WALL[hs.v % HOUSE_WALL.length]; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = hs.roof ? '#4f7fd1' : HOUSE_ROOF[hs.v % HOUSE_ROOF.length]; ctx.fillRect(-w / 2, -h / 2, w, h * 0.5);
    if (hs.owner && S.hh[hs.owner] && S.hh[hs.owner].isPlayer) { ctx.strokeStyle = '#e8d44d'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4); }
    ctx.restore();
  }
}

function drawSite(s, now) {
  const z = cam.z;
  if (s.kind === 'roofs') return;
  const [sx, sy] = w2s(s.x, s.y), w = s.w * z, h = s.h * z;
  const asset = s.assets && s.assets.find(a => !a.rooftop);
  const kind = asset ? asset.type : s.kind;
  const base = SITE_COLOR[kind] || '#777';
  const R = (fx, fy, fw, fh, c) => { ctx.fillStyle = c; ctx.fillRect(sx + fx * z, sy + fy * z, Math.max(1, fw * z), Math.max(1, fh * z)); };
  if (s.kind === 'home') {
    // the simulated households live in real houses from the street fabric; mark them
    if (z >= 2 && s.household && s.household.isPlayer) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, w, h); }
  } else if (s.kind === 'farm') {
    R(0, 0, s.w, s.h, '#8e7d42'); if (z > 1.5) for (let yy = 1; yy < s.h - 1; yy += 2.5) R(1, yy, s.w - 14, 1.2, '#6f8a36');
    R(s.w - 11, 2, 8, 6, '#7a3b2a'); R(s.w - 11, 9, 4, 4, '#bdbdbd');
  } else if (s.kind === 'park') {
    R(0, 0, s.w, s.h, base);
    if (z > 1.5) for (let i = 0; i < s.w * s.h / 18; i++) { const tx = (i * 37.3) % (s.w - 2) + 1, ty = (i * 23.7) % (s.h - 2) + 1; R(tx, ty, 2, 2, '#2f6e2c'); }
  } else if (s.kind === 'sport') {
    R(0, 0, s.w, s.h, '#3f9a46');
    R(1.5, 1.5, s.w * 0.55, s.h - 3, '#4fae52'); if (z > 2) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(sx + 1.5 * z, sy + 1.5 * z, s.w * 0.55 * z, (s.h - 3) * z); ctx.beginPath(); ctx.moveTo(sx + (1.5 + s.w * 0.275) * z, sy + 1.5 * z); ctx.lineTo(sx + (1.5 + s.w * 0.275) * z, sy + (s.h - 1.5) * z); ctx.stroke(); }
    R(s.w * 0.62, 2, s.w * 0.34, s.h * 0.55, '#a65a3a'); R(s.w * 0.62 + 1.2, 3.2, s.w * 0.34 - 2.4, s.h * 0.55 - 2.4, '#4fae52');
  } else if (s.kind === 'plaza') {
    R(0, 0, s.w, s.h, base); R(s.w / 2 - 1.5, s.h / 2 - 1.5, 3, 3, '#9fb7d9');
    if (z > 3) for (let i = 0; i < 6; i++) R(1 + (i % 3) * (s.w - 3) / 2, 1 + Math.floor(i / 3) * (s.h - 3), 1.2, 1.2, '#2f6e2c');
  } else if (s.kind === 'substation') {
    R(0, 0, s.w, s.h, '#8d9097');
    if (z > 2) for (let yy = 1.5; yy < s.h - 1; yy += 2.5) for (let xx = 1.5; xx < s.w - 1; xx += 2.5) R(xx, yy, 1, 1, '#4a4e56');
    if (z > 2) { ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, w, h); }
  } else if (kind === 'solar') {
    const built = asset ? asset.cap > 0 : true;
    R(0, 0, s.w, s.h, built ? '#33402c' : '#6e5e3a');
    if (built) {
      // panels cover the share of the site that's actually built (bigger arrays fill more rows)
      const fill = asset ? clamp(asset.cap / Math.max(1e-6, s.w * s.h * CAP_PER_TILE.solar * 1.0), 0.15, 1) : 1;
      const rows = Math.max(1, Math.floor((s.h - 1) / 1.4)), shown = Math.ceil(rows * fill);
      if (z > 1.2) for (let r = 0; r < shown; r++) R(0.5, 0.5 + r * 1.4, s.w - 1, 0.9, '#2b4c8f');
      else R(0.5, 0.5, s.w - 1, (s.h - 1) * fill, '#2b4c8f');
    }
  } else if (kind === 'compute') {
    R(0, 0, s.w, s.h, '#575d68'); R(0.8, 0.8, s.w - 1.6, s.h - 1.6, base);
    if (z > 1.5 && asset && asset.cap > 0) {
      const lit = S.market.servedE ?? 1;
      for (let xx = 2; xx < s.w - 2; xx += 3.5) R(xx, 1.8, 1.6, s.h - 3.6, '#262b36'); // cooling rows on the roof
      if (z > 3) for (let i = 0; i < Math.min(80, s.w * s.h / 8); i++) {
        const xx = 1.5 + ((i * 7.3) % Math.max(1, s.w - 3)), yy = 1.5 + ((i * 13.1) % Math.max(1, s.h - 3));
        const on = ((i * 97 + Math.floor(now / 300)) % 5) < 4 * lit;
        R(xx, yy, 0.4, 0.4, on ? (lit > 0.6 ? '#5dff8f' : '#ffb347') : '#3a2020');
      }
    }
  } else if (kind === 'factory') {
    R(0, s.h * 0.2, s.w, s.h * 0.8, base);
    ctx.fillStyle = '#6d5249'; const n = Math.max(2, Math.round(s.w / 5)); for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(sx + w * i / n, sy + h * 0.2); ctx.lineTo(sx + w * (i + 1) / n, sy); ctx.lineTo(sx + w * (i + 1) / n, sy + h * 0.2); ctx.fill(); }
  } else if (kind === 'fleet' || s.kind === 'warehouse') {
    R(0, 0, s.w, s.h, '#c8c8c4'); R(0.5, 0.5, s.w - 1, s.h - 1, kind === 'fleet' ? '#5d6f79' : base);
    if (z > 2) for (let xx = 1.5; xx < s.w - 2; xx += 2.4) R(xx, s.h - 1.4, 1.4, 1.2, '#2e3438'); // loading docks
    if (z > 2 && kind === 'fleet') for (let xx = 2; xx < s.w - 2; xx += 6) R(xx, 1.5, 4, s.h * 0.5, '#4a5a63');
  } else {
    R(0, 0, s.w, s.h, base);
    if (s.kind === 'clinic' && z > 1.5) { R(s.w / 2 - 0.6, s.h / 2 - 2, 1.2, 4, '#d33'); R(s.w / 2 - 2, s.h / 2 - 0.6, 4, 1.2, '#d33'); }
    if (s.kind === 'station' && z > 1.5) R(0, s.h * 0.75, s.w, 0.6, '#3a3a3a');
    if (s.kind === 'hall' && z > 3) for (let i = 0; i < 5; i++) R(s.w * (0.15 + i * 0.16), s.h * 0.3, 0.6, s.h * 0.55, '#e8ecf6');
    if (s.kind === 'school' && z > 1.5) { R(1, 1, s.w * 0.4, s.h - 2, '#c9a23e'); R(s.w * 0.5, 1, s.w * 0.45, s.h * 0.4, '#c9a23e'); }
    if (s.kind === 'market' && z > 2) R(1, 1, s.w - 2, 1.2, '#f4f6f7');
  }
  // fleet: robot count
  if (kind === 'fleet' && asset && z > 2.5 && w > 40) queueLabel(`${Math.round(asset.cap)} robots`, sx + w / 2, sy + h / 2, 30, '#9fe7ff');
  // ownership bar along the bottom of anything productive
  const assets = (s.assets || []).filter(a => a.cap > 0);
  if (assets.length && s.kind !== 'home') {
    const a = assets.find(x => !x.rooftop) || assets[0];
    const b = ownerBuckets(a), bh = Math.max(2, Math.min(z * 0.6, 6));
    let x = sx;
    for (const k of ['outside', 'town', 'coop', 'resident']) { if (b[k] <= 0) continue; ctx.fillStyle = OWNER_COLOR[k]; ctx.fillRect(x, sy + h - bh, w * b[k], bh); x += w * b[k]; }
  }
  // construction
  const pend = (s.assets || []).flatMap(a => a.pending);
  if (pend.length && s.kind !== 'home') {
    const p = pend[0], prog = clamp((S.day + (S.t % 24) / 24 - p.start) / Math.max(1, p.done - p.start), 0, 1);
    ctx.strokeStyle = Math.floor(now / 250) % 2 ? '#ffd23f' : '#222'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(sx + 1, sy + 1, w - 2, h - 2); ctx.setLineDash([]);
    if (w > 12) { ctx.fillStyle = '#222'; ctx.fillRect(sx + 2, sy + 2, w - 4, Math.max(2, z * 0.4)); ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx + 2, sy + 2, (w - 4) * prog, Math.max(2, z * 0.4)); }
  }
  if (s === view.selSite) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sx - 2, sy - 2, w + 4, h + 4); }
  // labels (LOD): big sites once they cover a decent patch of screen, small ones only up close or when selected
  const px2 = w * h, area = s.w * s.h;
  if (s === view.selSite) queueLabel(s.name, sx + w / 2, sy - 7, 99);
  else if (s.kind === 'home') { if (z >= 10) queueLabel(s.household.isPlayer ? 'your place' : s.household.name, sx + w / 2, sy - 5, s.household.isPlayer ? 60 : 20, '#e6ecff'); }
  else if ((area >= 200 && px2 >= 1800 && z >= 1.2) || (area >= 60 && z >= 5) || z >= 12) queueLabel(s.name.replace('Helix ', 'H. ').replace(' (town)', ''), sx + w / 2, sy + Math.min(h / 2, 10), 20 + Math.min(40, Math.sqrt(area) / 2), '#ffffff', 'rgba(8,12,28,0.62)');
}

// ---------- lots: the ordinary town, and whatever replaces it ----------
function hash2(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
const CAR_COLORS = ['#c0392b', '#2e86c1', '#f4f6f7', '#1c2833', '#7d8c8e', '#d4ac0d', '#6c3483', '#239b56'];
function drawLot(l, now) {
  const z = cam.z;
  const [sx, sy] = w2s(l.x, l.y), w = l.w * z, h = l.h * z;
  const u = LOT_USE[l.use] || LOT_USE.vacant;
  const hs = hash2(l.x * 10 | 0, l.y * 10 | 0);
  const R = (fx, fy, fw, fh, c) => { ctx.fillStyle = c; ctx.fillRect(sx + fx * z, sy + fy * z, Math.max(1, fw * z), Math.max(1, fh * z)); };
  const detail = z > 3;
  switch (l.use) {
    case 'parking': case 'carlot': {
      R(0, 0, l.w, l.h, '#55595f');
      if (z > 4) {
        const fill = l.use === 'carlot' ? 0.9 : (1 - l.vac) * 0.8;
        // real stalls: ~2.7 m × 5.5 m, in double rows with aisles
        for (let yy = 0.4; yy < l.h - 1.2; yy += 3.4) for (const off of [0, 1.15]) for (let xx = 0.3; xx < l.w - 0.6; xx += 0.55) {
          if (((hash2(xx * 20 | 0, (yy + off) * 10 | 0) % 100) / 100) < fill) R(xx + 0.06, yy + off + 0.1, 0.42, 0.9, CAR_COLORS[hash2(xx * 7 | 0, yy * 3 | 0) % CAR_COLORS.length]);
        }
      } else if (z > 1.5) for (let yy = 0.4; yy < l.h - 1.2; yy += 3.4) R(0.3, yy, l.w - 0.6, 2.3, (1 - l.vac) > 0.4 ? '#6d6f74' : '#5d6066');
      break;
    }
    case 'bigbox': {
      R(0, 0, l.w, l.h, '#c9ccd2'); R(0.4, 0.4, l.w - 0.8, l.h - 0.8, l.vac > 0.6 ? '#8b919c' : '#aeb6c4');
      if (z > 1.5) { for (let i = 0; i < 9; i++) R(2 + (i * 5.3) % (l.w - 4), 2 + (i * 3.7) % (l.h - 6), 1.2, 1, '#7d8592'); R(l.w * 0.3, l.h - 1.2, l.w * 0.4, 0.8, l.vac > 0.6 ? '#555' : '#e8d44d'); }
      break;
    }
    case 'gas':
      R(0, 0, l.w, l.h, '#6a6e74'); R(1, 1, l.w - 2, l.h * 0.45, '#e8e8e8'); R(1, 1, l.w - 2, 0.6, '#c0392b');
      if (detail) for (let i = 0; i < 3; i++) R(1.5 + i * (l.w - 3) / 3, l.h * 0.65, 0.6, 1, '#2e86c1');
      break;
    case 'office': {
      R(0.2, 0.2, l.w - 0.4, l.h - 0.4, l.vac > 0.6 ? '#5f6b78' : '#8fa3b8');
      if (detail) for (let yy = 0.8; yy < l.h - 0.6; yy += 1.1) for (let xx = 0.7; xx < l.w - 0.6; xx += 1.0) R(xx, yy, 0.5, 0.5, ((hash2(xx * 9 | 0, yy * 9 | 0) % 100) / 100) < (1 - l.vac) * 0.9 ? '#ffe9a8' : '#2b3440');
      break;
    }
    case 'shop': case 'restaurant': {
      R(0.15, 0.15, l.w - 0.3, l.h - 0.3, u.color);
      if (detail) for (let xx = 0.2; xx < l.w - 0.4; xx += 0.6) R(xx, 0.15, 0.3, 0.5, Math.round(xx / 0.6) % 2 ? '#ffffff' : (l.use === 'restaurant' ? '#2e7d32' : '#c0392b'));
      if (l.vac > 0.6) R(0.4, 1, l.w - 0.8, l.h - 1.4, 'rgba(20,20,20,0.55)');
      break;
    }
    case 'motel': R(0, 0, l.w, l.h, '#6a6e74'); R(0.3, 0.3, l.w - 0.6, 2.2, u.color); R(0.3, 0.3, 2.2, l.h - 0.6, u.color); if (detail) R(l.w - 1.6, l.h - 1.6, 1, 1, '#e74c3c'); break;
    case 'church': R(0.5, 1, l.w - 1, l.h - 1.4, u.color); R(l.w / 2 - 0.6, 0.1, 1.2, 1.6, '#bfb6a4'); break;
    case 'warehouse': R(0, 0, l.w, l.h, '#c8c8c4'); R(0.4, 0.4, l.w - 0.8, l.h - 0.8, u.color); if (detail) for (let xx = 1; xx < l.w - 1.5; xx += 2.4) R(xx, l.h - 1.3, 1.4, 1, '#4e4238'); break;
    case 'garden':
      R(0, 0, l.w, l.h, '#6b4f2e');
      if (z > 2) for (let yy = 0.4; yy < l.h - 0.3; yy += 0.9) R(0.3, yy, l.w - 0.6, 0.5, ['#5aa04a', '#7fc65a', '#c9b44a'][Math.round(yy / 0.9) % 3]);
      break;
    case 'apartments':
      R(0.2, 0.2, l.w - 0.4, l.h - 0.4, u.color);
      if (detail) for (let yy = 0.8; yy < l.h - 0.5; yy += 1.0) for (let xx = 0.7; xx < l.w - 0.5; xx += 1.0) R(xx, yy, 0.45, 0.45, '#ffe9a8');
      break;
    case 'makerspace': R(0.2, 0.2, l.w - 0.4, l.h - 0.4, u.color); if (detail) { R(l.w / 2 - 0.8, l.h / 2 - 0.8, 1.6, 1.6, '#e8d44d'); } break;
    case 'vfarm':
      R(0.2, 0.2, l.w - 0.4, l.h - 0.4, '#1f3b33');
      if (z > 2) for (let yy = 0.6; yy < l.h - 0.4; yy += 0.8) R(0.5, yy, l.w - 1, 0.4, (Math.floor(now / 700) + Math.round(yy * 3)) % 4 ? '#3fae7a' : '#c86bd6');
      break;
    default:
      R(0, 0, l.w, l.h, '#6a6250');
      if (detail) { ctx.strokeStyle = '#4b4438'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + w, sy + h); ctx.moveTo(sx + w, sy); ctx.lineTo(sx, sy + h); ctx.stroke(); }
  }
  if (view.colorBy === 'stake') {
    const k = l.owner === 'helix' ? 'outside' : l.owner === 'town' ? 'town' : S.hh[l.owner] ? 'resident' : null;
    if (k) { ctx.fillStyle = OWNER_COLOR[k] + '88'; ctx.fillRect(sx, sy, w, h); }
  }
  if (l === view.selLot) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sx - 2, sy - 2, w + 4, h + 4); queueLabel(l.name || u.label, sx + w / 2, sy - 7, 98); }
  else if (l.name && l.w * l.h >= 300 && w * h > 2000) queueLabel(l.name, sx + w / 2, sy + h / 2, 25, '#ffffff', 'rgba(8,12,28,0.6)');
  else if (z >= 14) queueLabel(u.label + (l.vac > 0.6 && !ASSET_USES.has(l.use) && l.use !== 'vacant' ? ' (empty)' : ''), sx + w / 2, sy + h / 2, 10, '#e6ecff', 'rgba(8,12,28,0.6)');
}

// ---------- traffic: cars on the road graph; robotaxis replace them as the economy shifts. Visual only ----------
const CARS = [];
function syncCars() {
  const sig = landSignals();
  const want = 160;
  const taxis = Math.round(want * sig.rt);
  while (CARS.length < want) CARS.push(newCar());
  CARS.length = want;
  CARS.forEach((c, i) => { c.taxi = i < taxis; });
}
function newCar() {
  const G = S.road;
  const a = Math.floor(rand() * G.nodes.length), ed = []; G.graph.getEdgesOfNode(a, ed);
  const e = ed.length ? pick(ed) : null;
  return { from: a, to: e ? e.to : a, t: rand(), color: pick(CAR_COLORS), speed: rr(0.85, 1.15), prev: -1 };
}
function stepCars(hours) {
  const G = S.road;
  for (const c of CARS) {
    let move = Math.min(hours, 0.02) * 4000 * c.speed; // ~20 km/h average in town, faster on the interstate
    let guard = 0;
    while (move > 0 && guard++ < 8) {
      const A = G.nodes[c.from], B = G.nodes[c.to], L = Math.max(0.01, Math.hypot(B.x - A.x, B.y - A.y));
      const e = []; G.graph.getEdgesOfNode(c.from, e); const ed = e.find(x => x.to === c.to);
      const k = ed ? (L / ed.cost) : 1; // the edge cost encodes road speed
      const left = (1 - c.t) * L;
      if (move * k < left) { c.t += move * k / L; move = 0; }
      else {
        move -= left / k; c.t = 0;
        const nx = []; G.graph.getEdgesOfNode(c.to, nx);
        const opts = nx.filter(x => x.to !== c.from);
        const n = opts.length ? pick(opts) : nx[0];
        c.from = c.to; c.to = n ? n.to : c.from;
      }
    }
  }
}
function drawCars(visible) {
  const z = cam.z; if (z < 1.5) return;
  const G = S.road;
  for (const c of CARS) {
    const A = G.nodes[c.from], B = G.nodes[c.to];
    const x = lerp(A.x, B.x, c.t), y = lerp(A.y, B.y, c.t);
    if (!visible(x - 1, y - 1, 2, 2)) continue;
    const ang = Math.atan2(B.y - A.y, B.x - A.x), off = 0.6;
    const [sx, sy] = w2s(x - Math.sin(ang) * off, y + Math.cos(ang) * off);
    const L = Math.max(2.5, z * 0.9), Wd = Math.max(1.5, z * 0.38);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
    ctx.fillStyle = c.taxi ? '#f4f6f7' : c.color; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
    if (c.taxi) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(-Wd * 0.4, -Wd * 0.4, Wd * 0.8, Wd * 0.8); }
    ctx.restore();
  }
}
