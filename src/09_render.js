// Drawing: flat tiles, colored blocks, dots for people and robots. Everything in tile units.
const PAL = {
  [T.GRASS]: ['#3f7a3a', '#3b7436'], [T.GRASS2]: ['#46833f', '#3f7a3a'], [T.ROAD]: ['#5a5f6e', '#555a68'], [T.HWY]: ['#4a4e5a', '#6b6f7c'],
  [T.WATER]: ['#2c5d9e', '#3468ad'], [T.FIELD]: ['#9c8a4a', '#8e7d42'], [T.FIELD2]: ['#7f9a44', '#76903f'], [T.FOREST]: ['#24512a', '#2c5e31'],
  [T.PAVE]: ['#6d7a63', '#687560'], [T.BANK]: ['#b9a874', '#ad9d6b'], [T.TOWNB]: ['#7d7a78', '#8a8784'],
};
const OWNER_COLOR = { outside: '#d062e6', town: '#4aa3ff', coop: '#6fdc6f', resident: '#f2c14e' };
const SITE_COLOR = {
  home: '#b98f5e', school: '#e0c050', clinic: '#e9ecf4', market: '#d9774b', cafe: '#a8673a', learn: '#8e7cc3', hall: '#aab3c6', warehouse: '#7a6a5a',
  repair: '#6c8a5c', diner: '#c0504d', farm: '#a3743f', station: '#8e8e8e', plaza: '#c9bf9f', park: '#4f9a46', solar: '#24345e', compute: '#2f3644', factory: '#8d6e63', fleet: '#41525c',
};
let terrainCanvas = null;
const TPX = 4; // terrain pixels per tile
function bakeTerrain() {
  terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = MAP_W * TPX; terrainCanvas.height = MAP_H * TPX;
  const g = terrainCanvas.getContext('2d');
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = S.terrain[y * MAP_W + x], [c1, c2] = PAL[t];
    g.fillStyle = c1; g.fillRect(x * TPX, y * TPX, TPX, TPX);
    g.fillStyle = c2;
    if (t === T.FOREST) { g.fillRect(x * TPX + 1, y * TPX + 1, 2, 2); }
    else if (t === T.WATER) { if ((x + y) % 3 === 0) g.fillRect(x * TPX, y * TPX + 1, 2, 1); }
    else if (t === T.ROAD || t === T.HWY) { if (t === T.HWY && x % 3 === 0) g.fillRect(x * TPX, y * TPX + 1, 2, 1); }
    else if ((x * 3 + y * 5) % 7 === 0) g.fillRect(x * TPX + 2, y * TPX + 2, 1, 1);
  }
}

const cam = { x: 102, y: 70, z: 6, tx: 102, ty: 70, tz: 6, follow: null };
let canvas, ctx, W = 0, H = 0, DPR = 1;
const view = { colorBy: 'loyalty', selected: null, selSite: null, selLot: null, hover: null };

function w2s(x, y) { return [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2]; }
function s2w(sx, sy) { return [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]; }
function minZoom() { return Math.max(1.2, Math.min(W / MAP_W, H / MAP_H) * 0.9); }

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

function draw(now) {
  // ease camera
  if (cam.follow) { cam.tx = cam.follow.position.x; cam.ty = cam.follow.position.y; }
  const k = 0.18;
  cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(cam.tz), k));
  cam.x = lerp(cam.x, cam.tx, k); cam.y = lerp(cam.y, cam.ty, k);
  const z = cam.z;
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, W, H);
  const [ox, oy] = w2s(0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(terrainCanvas, Math.round(ox), Math.round(oy), Math.round(MAP_W * z), Math.round(MAP_H * z));
  const [vx0, vy0] = s2w(0, 0), [vx1, vy1] = s2w(W, H);
  const visible = (x, y, w, h) => x + w > vx0 && x < vx1 && y + h > vy0 && y < vy1;

  // lots (ordinary town fabric), then sites (workplaces, civic, assets, the simulated homes)
  for (const l of S.lots) { if (!l.site && visible(l.x, l.y, l.w, l.h)) drawLot(l, now); }
  for (const s of S.sites) { if (visible(s.x, s.y, s.w, s.h)) drawSite(s, now); }
  drawCars();
  // region labels
  if (z < 5) {
    regionLabel('ASHFORD', 19, 105); regionLabel('KESTREL', 178, 114); regionLabel('HELIX CAMPUS', 171, 11); regionLabel('VALLEY TOWN', 102, 37);
    regionLabel('river', 40, 46, '#9cc4ff'); regionLabel('highway to the capital', 22, 68, '#c8ccd8');
  }
  // robots
  const rs = Math.max(2, Math.min(z * 0.42, 9));
  for (const r of S.robots) {
    const { x, y } = r.position; if (!visible(x - 1, y - 1, 2, 2)) continue;
    const [sx, sy] = w2s(x, y);
    ctx.fillStyle = '#1b2b33'; ctx.fillRect(sx - rs / 2 - 1, sy - rs / 2 - 1, rs + 2, rs + 2);
    ctx.fillStyle = '#9fe7ff'; ctx.fillRect(sx - rs / 2, sy - rs / 2, rs, rs);
    if (z > 18) { ctx.fillStyle = '#1b2b33'; ctx.fillRect(sx - rs * 0.25, sy - rs * 0.15, rs * 0.15, rs * 0.15); ctx.fillRect(sx + rs * 0.1, sy - rs * 0.15, rs * 0.15, rs * 0.15); }
  }
  // people
  const ps = Math.max(3.5, Math.min(z * 0.62, 14));
  for (const p of S.people) {
    const { x, y } = p.position; if (!visible(x - 1, y - 1, 2, 2)) continue;
    const [sx, sy] = w2s(x, y);
    ctx.fillStyle = '#0b1020'; ctx.fillRect(sx - ps / 2 - 1, sy - ps / 2 - 1, ps + 2, ps + 2);
    ctx.fillStyle = agentColor(p); ctx.fillRect(sx - ps / 2, sy - ps / 2, ps, ps);
    if (p.age === 'kid' && z > 10) { ctx.fillStyle = '#0b1020'; ctx.fillRect(sx - ps / 2, sy - ps / 2, ps, ps * 0.3); ctx.fillStyle = agentColor(p); }
    if (p.isPlayer) { const r = ps + 4 + Math.sin(now / 200) * 2; ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.strokeRect(sx - r / 2, sy - r / 2, r, r); }
    if (p === view.selected) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(sx - ps / 2 - 4, sy - ps / 2 - 4, ps + 8, ps + 8);
      if (p.moving && p.wp) { ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(sx, sy); for (let i = p.wpi; i < p.wp.length; i++) { const [qx, qy] = w2s(p.wp[i].x, p.wp[i].y); ctx.lineTo(qx, qy); } ctx.stroke(); ctx.setLineDash([]); }
    }
    if (z >= 20 || (p === view.selected && z >= 8) || (p.isPlayer && z >= 10)) {
      label((p.isPlayer ? 'YOU' : p.first) + (p.activity && z >= 26 ? ' · ' + p.activity : ''), sx, sy - ps / 2 - 9, p.isPlayer ? '#ffe066' : '#ffffff');
    }
  }
  // night
  const hr = S.t % 24, dark = hr < 5 ? 0.42 : hr < 7 ? lerp(0.42, 0, (hr - 5) / 2) : hr < 19 ? 0 : hr < 21 ? lerp(0, 0.42, (hr - 19) / 2) : 0.42;
  if (dark > 0) {
    ctx.fillStyle = `rgba(8,12,40,${dark})`; ctx.fillRect(0, 0, W, H);
    for (const h of S.households) { const s = h.site; if (!visible(s.x, s.y, s.w, s.h) || z < 3) continue; const [sx, sy] = w2s(s.x + s.w * 0.3, s.y + s.h * 0.55); ctx.fillStyle = `rgba(255,214,110,${dark * 2})`; ctx.fillRect(sx, sy, Math.max(1, z * 0.6), Math.max(1, z * 0.6)); }
  }
}

function regionLabel(text, x, y, color = '#ffffff') {
  const [sx, sy] = w2s(x, y);
  ctx.font = 'bold 11px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(text, sx + 1, sy + 1); ctx.fillStyle = color; ctx.fillText(text, sx, sy);
}
function label(text, sx, sy, color = '#ffffff', bg = 'rgba(8,12,28,0.78)') {
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 6;
  ctx.fillStyle = bg; ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - 7), Math.round(w), 12);
  ctx.fillStyle = color; ctx.fillText(text, Math.round(sx), Math.round(sy + 2));
}

function drawSite(s, now) {
  const z = cam.z;
  const [sx, sy] = w2s(s.x, s.y), w = s.w * z, h = s.h * z;
  const asset = s.assets && s.assets.find(a => !a.rooftop);
  const kind = asset ? asset.type : s.kind;
  const base = SITE_COLOR[kind] || '#777';
  if (s.kind === 'farm') { ctx.fillStyle = '#7a3b2a'; ctx.fillRect(sx + w * 0.75, sy + h * 0.1, w * 0.2, h * 0.25); }
  else if (s.kind === 'park') {
    ctx.fillStyle = base; ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#2f6e2c'; for (let i = 0; i < 7; i++) { const tx = s.x + 1 + ((i * 37) % 9), ty = s.y + 1 + ((i * 23) % 7); const [px, py] = w2s(tx, ty); ctx.fillRect(px, py, z * 1.2, z * 1.2); }
  } else if (s.kind === 'plaza') {
    ctx.fillStyle = base; ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#9fb7d9'; const [fx, fy] = w2s(s.cx - 1, s.cy - 1); ctx.fillRect(fx, fy, z * 2, z * 2);
  } else if (kind === 'solar') {
    const built = asset ? asset.cap > 0 : true;
    ctx.fillStyle = built ? '#1c2a4f' : '#3a3424'; ctx.fillRect(sx, sy, w, h);
    if (built && z > 2.5) { ctx.fillStyle = '#4f7fd1'; const cw = Math.max(1, z * 0.8); for (let yy = s.y + 0.5; yy < s.y + s.h - 0.8; yy += 1.4) for (let xx = s.x + 0.5; xx < s.x + s.w - 0.8; xx += 1.1) { const [px, py] = w2s(xx, yy); ctx.fillRect(px, py, cw, Math.max(1, z * 0.9)); } }
  } else if (kind === 'compute') {
    ctx.fillStyle = base; ctx.fillRect(sx, sy, w, h);
    if (z > 2.5 && asset && asset.cap > 0) {
      const lit = S.market.servedE;
      for (let xx = s.x + 1; xx < s.x + s.w - 1; xx += 2) { const [px, py] = w2s(xx, s.y + 1); ctx.fillStyle = '#151a24'; ctx.fillRect(px, py, z * 1.2, h - z * 2); }
      for (let i = 0; i < Math.min(60, s.w * s.h / 3); i++) {
        const xx = s.x + 1.2 + ((i * 7) % Math.max(1, Math.floor(s.w - 2))), yy = s.y + 1.2 + ((i * 13) % Math.max(1, Math.floor(s.h - 2)));
        const on = ((i * 97 + Math.floor(now / 300)) % 5) < 4 * lit;
        const [px, py] = w2s(xx, yy); ctx.fillStyle = on ? (lit > 0.6 ? '#5dff8f' : '#ffb347') : '#3a2020'; ctx.fillRect(px, py, Math.max(1, z * 0.3), Math.max(1, z * 0.3));
      }
    }
  } else if (kind === 'factory') {
    ctx.fillStyle = base; ctx.fillRect(sx, sy + h * 0.25, w, h * 0.75);
    ctx.fillStyle = '#6d5249'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx + w * i / 4, sy + h * 0.25); ctx.lineTo(sx + w * (i + 1) / 4, sy); ctx.lineTo(sx + w * (i + 1) / 4, sy + h * 0.25); ctx.fill(); }
  } else if (s.kind === 'home') {
    const h0 = s.household;
    ctx.fillStyle = base; ctx.fillRect(sx, sy + h * 0.35, w, h * 0.65);
    ctx.fillStyle = h0 && h0.isPlayer ? '#e8d44d' : '#8a4b3a'; ctx.fillRect(sx - z * 0.2, sy, w + z * 0.4, h * 0.4);
    if (z > 8) { ctx.fillStyle = '#3a2a1e'; ctx.fillRect(sx + w * 0.45, sy + h * 0.65, w * 0.15, h * 0.35); }
    const roof = s.assets && s.assets.find(a => a.rooftop && a.cap > 0);
    if (roof) { ctx.fillStyle = '#4f7fd1'; ctx.fillRect(sx + w * 0.1, sy + h * 0.05, w * 0.8, h * 0.25); }
  } else {
    ctx.fillStyle = base; ctx.fillRect(sx, sy, w, h);
    if (s.kind === 'clinic' && z > 3) { ctx.fillStyle = '#d33'; ctx.fillRect(sx + w / 2 - z * 0.5, sy + h / 2 - z * 1.5, z, z * 3); ctx.fillRect(sx + w / 2 - z * 1.5, sy + h / 2 - z * 0.5, z * 3, z); }
    if (s.kind === 'station' && z > 2) { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(sx, sy + h * 0.8, w, Math.max(1, z * 0.3)); }
    if (s.kind === 'hall' && z > 3) { ctx.fillStyle = '#e8ecf6'; for (let i = 0; i < 5; i++) ctx.fillRect(sx + w * (0.15 + i * 0.16), sy + h * 0.3, z * 0.6, h * 0.55); }
  }
  // fleet: robot count
  if (kind === 'fleet' && asset && z > 3) { label(`${Math.round(asset.cap)} robots`, sx + w / 2, sy + h / 2, '#9fe7ff'); }
  // ownership bar along the bottom of anything productive
  const assets = (s.assets || []).filter(a => a.cap > 0);
  if (assets.length) {
    const a = assets.find(x => !x.rooftop) || assets[0];
    const b = ownerBuckets(a), bh = Math.max(2, Math.min(z * 0.6, 6));
    let x = sx;
    for (const k of ['outside', 'town', 'coop', 'resident']) { if (b[k] <= 0) continue; ctx.fillStyle = OWNER_COLOR[k]; ctx.fillRect(x, sy + h - bh, w * b[k], bh); x += w * b[k]; }
  }
  // construction
  const pend = (s.assets || []).flatMap(a => a.pending);
  if (pend.length) {
    const p = pend[0], prog = clamp((S.day + (S.t % 24) / 24 - p.start) / Math.max(1, p.done - p.start), 0, 1);
    ctx.strokeStyle = Math.floor(now / 250) % 2 ? '#ffd23f' : '#222'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(sx + 1, sy + 1, w - 2, h - 2); ctx.setLineDash([]);
    if (z > 2) { ctx.fillStyle = '#222'; ctx.fillRect(sx + 2, sy + 2, w - 4, Math.max(2, z * 0.4)); ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx + 2, sy + 2, (w - 4) * prog, Math.max(2, z * 0.4)); }
  }
  if (s === view.selSite) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sx - 2, sy - 2, w + 4, h + 4); }
  // labels
  if (!s.small && (z >= 14 || (z >= 7 && (!s.lot || s.w * s.h >= 45)))) label(s.name, sx + w / 2, sy - 6);
  else if (z >= 3 && z < 7 && !s.small && (asset || s.kind === 'hall' || s.kind === 'plaza') && w > 30) label(s.name.replace('Helix ', 'H. '), sx + w / 2, sy + h / 2, '#ffffff', 'rgba(8,12,28,0.55)');
  if (z >= 14 && s.small && s.household) label(s.household.isPlayer ? 'your place' : s.household.name, sx + w / 2, sy - 5, '#e6ecff');
}

// ---------- lots: the ordinary town, and whatever replaces it ----------
function hash2(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
const CAR_COLORS = ['#c0392b', '#2e86c1', '#f4f6f7', '#1c2833', '#7d8c8e', '#d4ac0d', '#6c3483', '#239b56'];
function drawLot(l, now) {
  const z = cam.z;
  const [sx, sy] = w2s(l.x, l.y), w = l.w * z, h = l.h * z;
  const u = LOT_USE[l.use] || LOT_USE.vacant;
  const hs = hash2(l.x, l.y);
  const R = (fx, fy, fw, fh, c) => { ctx.fillStyle = c; ctx.fillRect(sx + fx * z, sy + fy * z, Math.max(1, fw * z), Math.max(1, fh * z)); };
  const detail = z > 3;
  switch (l.use) {
    case 'house': {
      const walls = ['#b98f5e', '#c9b28a', '#a7b4a0', '#c99a7a', '#d6cbb4'][hs % 5], roof = ['#8a4b3a', '#5d4a3c', '#6e3b3b', '#4f5a62'][hs % 4];
      R(0.2, 1.4, l.w - 0.4, l.h - 1.6, walls); R(0, 0.3, l.w, 1.4, roof);
      if (l.roof) R(0.3, 0.45, l.w - 0.6, 1.0, '#4f7fd1');
      if (detail && z > 8) R(l.w / 2 - 0.3, l.h - 1.2, 0.6, 1.0, '#3a2a1e');
      break;
    }
    case 'parking': case 'bigbox': case 'carlot': {
      R(0, 0, l.w, l.h, '#54585e');
      const lotx = l.use === 'bigbox' ? 0 : 0, big = l.use === 'bigbox';
      if (big) { R(0.3, 0.3, l.w - 0.6, l.h * 0.45, '#7d8fb0'); R(l.w * 0.4, l.h * 0.45 - 0.5, l.w * 0.2, 0.5, '#e8d44d'); }
      if (detail) {
        const y0 = big ? l.h * 0.55 : 0.4, fill = l.use === 'carlot' ? 0.9 : (1 - l.vac) * 0.85;
        for (let yy = y0; yy < l.h - 0.9; yy += 1.6) for (let xx = 0.3 + lotx; xx < l.w - 0.6; xx += 1.0) {
          R(xx - 0.05, yy, 0.06, 1.2, '#9aa0a6');
          if (((hash2(xx * 10 | 0, yy * 10 | 0) % 100) / 100) < fill) R(xx + 0.15, yy + 0.15, 0.65, 0.95, CAR_COLORS[hash2(xx * 7 | 0, yy * 3 | 0) % CAR_COLORS.length]);
        }
      }
      break;
    }
    case 'gas':
      R(0, 0, l.w, l.h, '#6a6e74'); R(0.5, 0.5, l.w - 1, l.h * 0.5, '#e8e8e8'); R(0.5, 0.5, l.w - 1, 0.4, '#c0392b');
      if (detail) for (let i = 0; i < 3; i++) R(1 + i * (l.w - 2) / 3, l.h * 0.65, 0.5, 0.7, '#2e86c1');
      break;
    case 'office': {
      R(0.2, 0.2, l.w - 0.4, l.h - 0.4, l.vac > 0.6 ? '#5f6b78' : '#8fa3b8');
      if (detail) for (let yy = 0.7; yy < l.h - 0.6; yy += 0.9) for (let xx = 0.6; xx < l.w - 0.6; xx += 0.8) R(xx, yy, 0.45, 0.5, ((hash2(xx * 9 | 0, yy * 9 | 0) % 100) / 100) < (1 - l.vac) * 0.9 ? '#ffe9a8' : '#2b3440');
      break;
    }
    case 'shop': case 'restaurant': {
      R(0.2, 0.6, l.w - 0.4, l.h - 0.8, u.color);
      if (detail) for (let xx = 0.2; xx < l.w - 0.4; xx += 0.6) R(xx, 0.4, 0.3, 0.5, Math.round(xx / 0.6) % 2 ? '#ffffff' : (l.use === 'restaurant' ? '#2e7d32' : '#c0392b'));
      if (l.vac > 0.6) R(0.4, 1.2, l.w - 0.8, l.h - 2, 'rgba(20,20,20,0.55)');
      break;
    }
    case 'motel': R(0, 0, l.w, l.h, '#6a6e74'); R(0.3, 0.3, l.w - 0.6, 1.4, u.color); R(0.3, 0.3, 1.4, l.h - 0.6, u.color); if (detail) R(l.w - 1.4, 0.4, 0.9, 0.9, '#e74c3c'); break;
    case 'church': R(0.5, 1, l.w - 1, l.h - 1.4, u.color); R(l.w / 2 - 0.5, 0.1, 1, 1.4, '#bfb6a4'); if (detail) { R(l.w / 2 - 0.1, 0, 0.2, 0.9, '#5d4a3c'); } break;
    case 'warehouse': R(0.2, 0.2, l.w - 0.4, l.h - 0.4, u.color); if (detail) for (let xx = 0.8; xx < l.w - 1; xx += 1.6) R(xx, l.h - 1.4, 1.0, 1.0, '#4e4238'); break;
    case 'garden':
      R(0, 0, l.w, l.h, '#6b4f2e');
      if (detail) for (let yy = 0.4; yy < l.h - 0.3; yy += 0.8) R(0.3, yy, l.w - 0.6, 0.45, ['#5aa04a', '#7fc65a', '#c9b44a'][Math.round(yy / 0.8) % 3]);
      break;
    case 'apartments':
      R(0.2, 0.2, l.w - 0.4, l.h - 0.4, u.color);
      if (detail) for (let yy = 0.6; yy < l.h - 0.5; yy += 0.8) for (let xx = 0.6; xx < l.w - 0.5; xx += 0.8) R(xx, yy, 0.4, 0.4, '#ffe9a8');
      if (detail) R(0.4, 0.3, l.w - 0.8, 0.4, '#4f7fd1');
      break;
    case 'makerspace': R(0.2, 0.2, l.w - 0.4, l.h - 0.4, u.color); if (detail) { R(l.w / 2 - 0.8, l.h / 2 - 0.8, 1.6, 1.6, '#e8d44d'); R(l.w / 2 - 0.3, l.h / 2 - 0.3, 0.6, 0.6, u.color); } break;
    case 'vfarm':
      R(0.2, 0.2, l.w - 0.4, l.h - 0.4, '#1f3b33');
      if (detail) for (let yy = 0.5; yy < l.h - 0.4; yy += 0.7) R(0.5, yy, l.w - 1, 0.35, (Math.floor(now / 700) + Math.round(yy * 3)) % 4 ? '#3fae7a' : '#c86bd6');
      break;
    default:
      R(0, 0, l.w, l.h, '#4a4440');
      if (detail) { ctx.strokeStyle = '#2b2622'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + w, sy + h); ctx.moveTo(sx + w, sy); ctx.lineTo(sx, sy + h); ctx.stroke(); }
  }
  if (view.colorBy === 'stake') {
    const k = l.owner === 'helix' ? 'outside' : l.owner === 'town' ? 'town' : S.hh[l.owner] ? 'resident' : null;
    if (k) { ctx.fillStyle = OWNER_COLOR[k] + '88'; ctx.fillRect(sx, sy, w, h); }
  }
  if (l === view.selLot) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sx - 2, sy - 2, w + 4, h + 4); }
  if (z >= 16 && l.use !== 'house') label(u.label + (l.vac > 0.6 && !ASSET_USES.has(l.use) && l.use !== 'vacant' ? ' (empty)' : ''), sx + w / 2, sy + h / 2, '#e6ecff', 'rgba(8,12,28,0.6)');
}

// ---------- traffic: cars now, robotaxis later. Visual only, but the mix follows the economy ----------
const CARS = [];
function syncCars() {
  const sig = landSignals();
  const want = Math.round(26 + 20 * Math.min(1, S.people.length / 40));
  const taxis = Math.round(want * sig.rt);
  while (CARS.length < want) CARS.push(newCar());
  CARS.length = want;
  CARS.forEach((c, i) => { c.taxi = i < taxis; });
}
function newCar() {
  const horiz = rand() < 0.5;
  const c = { horiz, dir: rand() < 0.5 ? 1 : -1, color: pick(CAR_COLORS), speed: rr(30, 45) };
  if (horiz) { c.y = pick(ROAD_Y); c.x = rr(TOWN.x0, TOWN.x1); } else { c.x = pick(ROAD_X); c.y = rr(TOWN.y0, TOWN.y1); }
  return c;
}
function stepCars(hours) {
  const d = Math.min(2.5, hours * 38);
  for (const c of CARS) {
    const move = d * c.speed / 38;
    if (c.horiz) {
      const nx = c.x + c.dir * move;
      const lo = c.y === 70 ? 0 : TOWN.x0, hi = c.y === 70 ? MAP_W : TOWN.x1;
      const cross = ROAD_X.find(x => (c.x - x) * (nx - x) <= 0 && x !== c.x);
      if (cross !== undefined && c.y !== 70 && rand() < 0.35) { c.x = cross; c.horiz = false; c.dir = rand() < 0.5 ? 1 : -1; continue; }
      c.x = nx; if (c.x < lo || c.x > hi) { c.dir *= -1; c.x = clamp(c.x, lo, hi); }
    } else {
      const ny = c.y + c.dir * move;
      const cross = ROAD_Y.find(y => (c.y - y) * (ny - y) <= 0 && y !== c.y);
      if (cross !== undefined && rand() < 0.35) { c.y = cross; c.horiz = true; c.dir = rand() < 0.5 ? 1 : -1; continue; }
      c.y = ny; if (c.y < TOWN.y0 || c.y > TOWN.y1) { c.dir *= -1; c.y = clamp(c.y, TOWN.y0, TOWN.y1); }
    }
  }
}
function drawCars() {
  const z = cam.z; if (z < 2.2) return;
  for (const c of CARS) {
    const off = 0.28 * c.dir;
    const x = c.horiz ? c.x : c.x + off, y = c.horiz ? c.y + off : c.y;
    const [sx, sy] = w2s(x, y);
    const L = Math.max(2, z * 0.9), Wd = Math.max(1.5, z * 0.45);
    const w = c.horiz ? L : Wd, h = c.horiz ? Wd : L;
    ctx.fillStyle = c.taxi ? '#f4f6f7' : c.color; ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
    if (c.taxi) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx - Math.max(1, z * 0.12), sy - Math.max(1, z * 0.12), Math.max(1.5, z * 0.24), Math.max(1.5, z * 0.24)); }
  }
}
