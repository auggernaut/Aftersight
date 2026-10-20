// ---------- drawing the world ----------
let cvs, ctx, DPR = 1, VW = 0, VH = 0;
const cam = { x: 1150, y: 1400, zoom: 1.2, tx: 1150, ty: 1400 };
let GROUND_DRAB = null, GROUND_LUSH = null, COBBLE_A = null, COBBLE_B = null;
const GSCALE = 0.75;
let TIME = 0; // real seconds, for animation
let LOW_FX = false; // set when the device is too slow for decorative effects
const PARTICLES = [];

function setupCanvas(c) {
  cvs = c; ctx = c.getContext('2d');
  resize();
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = cvs.clientWidth; VH = cvs.clientHeight;
  cvs.width = Math.round(VW * DPR); cvs.height = Math.round(VH * DPR);
  const base = VW < VH ? Math.min(VW / 520, VH / 900) : Math.min(VW / 980, VH / 640);
  cam.baseZoom = clamp(base, 0.62, 1.7);
  if (!cam.userZoom) cam.userZoom = 1.15;
}
function screenToWorld(sx, sy) {
  const z = cam.zoom;
  return { x: (sx - VW / 2) / z + cam.x, y: (sy - VH / 2) / z + cam.y };
}
function worldToScreen(x, y) {
  const z = cam.zoom;
  return { x: (x - cam.x) * z + VW / 2, y: (y - cam.y) * z + VH / 2 };
}

// ----- prerendered ground (two moods, crossfaded by warmth) -----
function makeGround(lush) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * GSCALE); c.height = Math.ceil(WH * GSCALE);
  const g = c.getContext('2d');
  g.scale(GSCALE, GSCALE);
  const R = rng(lush ? 77 : 78);
  const base = lush ? '#6a9636' : '#8b957a';
  const dark = lush ? '#3f7426' : '#77806a';
  const light = lush ? '#b0c154' : '#a1a68c';
  g.fillStyle = base; g.fillRect(0, 0, W, WH);
  for (let i = 0; i < 260; i++) {
    const x = R() * W, y = R() * WH, r = 60 + R() * 220;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const cc = R() < 0.5 ? dark : light;
    gr.addColorStop(0, cc + '66'); gr.addColorStop(1, cc + '00');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (lush) for (let i = 0; i < 60; i++) { // sunlit golden patches
    const x = R() * W, y = 280 + R() * (WH - 280), r = 50 + R() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, '#e2cf5c55'); gr.addColorStop(1, '#e2cf5c00');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (!lush) for (let i = 0; i < 70; i++) { // dry patches
    const x = R() * W, y = 280 + R() * (WH - 280), r = 30 + R() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, '#a89f7e88'); gr.addColorStop(1, '#a89f7e00');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const shades = lush ? ['#4c8430', '#5f9534', '#7aa83e', '#9cb84a', '#3e7228', '#c6c25a'] : ['#7a846a', '#848d73', '#949a80', '#6f775f', '#9c9a7e'];
  g.lineCap = 'round';
  for (let i = 0; i < 26000; i++) {
    const x = R() * W, y = R() * WH;
    g.strokeStyle = shades[(R() * shades.length) | 0];
    g.lineWidth = 1.4 + R() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 4, y - 4 - R() * 6); g.stroke();
  }
  if (lush) {
    const fl = ['#fff6e0', '#ffd75e', '#f59ab5', '#c9a0f0', '#ff9f6b'];
    for (let i = 0; i < 2600; i++) {
      const x = R() * W, y = 270 + R() * (WH - 270);
      g.fillStyle = fl[(R() * fl.length) | 0];
      g.beginPath(); g.arc(x, y, 1.6 + R() * 1.6, 0, TAU); g.fill();
    }
  }
  // stream banks and pond shore
  g.strokeStyle = lush ? '#b8a77a' : '#a29b84'; g.lineWidth = STREAM_W + 22; g.lineJoin = 'round';
  g.beginPath(); STREAM.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  g.fillStyle = lush ? '#b8a77a' : '#a29b84';
  g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx + 16, POND.ry + 12, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(POOL.x, POOL.y, POOL.rx + 14, POOL.ry + 12, 0, 0, TAU); g.fill();
  // northern hills and the cliff
  const hill = lush ? ['#4f7f3c', '#5d8e45', '#6b9b4e'] : ['#6a7461', '#737d68', '#7c8670'];
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = hill[layer];
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, 90 + layer * 55 + Math.sin(x * 0.004 + layer * 2) * 30 + Math.sin(x * 0.013 + layer) * 12);
    g.lineTo(W, 0); g.closePath(); g.fill();
  }
  g.fillStyle = hill[2];
  g.fillRect(0, 0, W, 60);
  // cliff face
  const cliffTop = x => 236 + Math.sin(x * 0.02) * 6;
  g.fillStyle = lush ? '#8d7b66' : '#857c72';
  g.beginPath(); g.moveTo(0, 230);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, cliffTop(x));
  for (let x = W; x >= 0; x -= 20) g.lineTo(x, 268 + Math.sin(x * 0.03) * 5);
  g.closePath(); g.fill();
  for (let i = 0; i < 420; i++) {
    const x = R() * W, y = 238 + R() * 28;
    g.fillStyle = R() < 0.5 ? (lush ? '#a08d74' : '#968d82') : (lush ? '#6f604f' : '#6d665e');
    g.beginPath(); g.ellipse(x, y, 4 + R() * 9, 3 + R() * 4, 0, 0, TAU); g.fill();
  }
  g.fillStyle = lush ? '#5d8e45' : '#737d68';
  g.beginPath(); g.moveTo(0, 226);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, cliffTop(x) + (R() * 4));
  g.lineTo(W, 200); g.lineTo(0, 200); g.closePath(); g.fill();
  // waterfall cliff
  g.fillStyle = lush ? '#7b6a58' : '#7a7168';
  g.beginPath(); g.moveTo(1930, 120); g.lineTo(2050, 110); g.lineTo(2070, 300); g.lineTo(1910, 300); g.closePath(); g.fill();
  for (let i = 0; i < 60; i++) {
    g.fillStyle = R() < 0.5 ? '#6a5a4a' : '#8f7c66';
    g.beginPath(); g.ellipse(1915 + R() * 150, 120 + R() * 180, 6 + R() * 10, 4 + R() * 6, 0, 0, TAU); g.fill();
  }
  // sunfield meadow tint
  g.fillStyle = lush ? '#9fc4664d' : '#a5a7804d';
  g.beginPath(); g.ellipse(1520, 1336, 260, 140, 0, 0, TAU); g.fill();
  return c;
}

function makeCobble(lush) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const R = rng(lush ? 5 : 6);
  g.fillStyle = lush ? '#b9804a' : '#b9b1a3'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 11) for (let x = (y / 11) % 2 ? -6 : 0; x < 64; x += 13) {
    g.fillStyle = lush ? ['#e9bd7e', '#dca668', '#f0cc92', '#d39a5c'][(R() * 4) | 0] : ['#c2bbad', '#aea79b', '#cbc4b6', '#a39d92'][(R() * 4) | 0];
    rrect(g, x + 1, y + 1, 11, 9, 3); g.fill();
    g.strokeStyle = lush ? '#9a6436' : '#8f8a80'; g.lineWidth = 0.8; g.stroke();
    if (lush) { g.fillStyle = '#fff1cf55'; rrect(g, x + 2, y + 1.5, 7, 3, 1.5); g.fill(); }
  }
  return c;
}

function initArt() {
  GROUND_DRAB = makeGround(false);
  GROUND_LUSH = makeGround(true);
  COBBLE_A = ctx.createPattern(makeCobble(false), 'repeat');
  COBBLE_B = ctx.createPattern(makeCobble(true), 'repeat');
}

// ----- frame -----
function render(dt) {
  TIME += dt;
  GRADE = Math.round(S.warmth * 20);
  const z = cam.zoom = cam.baseZoom * cam.userZoom;
  // camera clamp
  const hw = VW / 2 / z, hh = VH / 2 / z;
  cam.x = clamp(cam.x, hw, W - hw); cam.y = clamp(cam.y, Math.min(140 + hh, WH / 2), WH - hh);
  if (hw * 2 > W) cam.x = W / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4c6b3c'; ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (VW / 2 - cam.x * z), DPR * (VH / 2 - cam.y * z));
  const view = { x0: cam.x - hw - 80, x1: cam.x + hw + 80, y0: cam.y - hh - 160, y1: cam.y + hh + 120 };

  // ground
  const sx = Math.max(0, view.x0) * GSCALE, sy = Math.max(0, view.y0) * GSCALE;
  const sw = Math.min(W, view.x1) * GSCALE - sx, sh = Math.min(WH, view.y1) * GSCALE - sy;
  ctx.globalAlpha = 1;
  ctx.drawImage(GROUND_DRAB, sx, sy, sw, sh, sx / GSCALE, sy / GSCALE, sw / GSCALE, sh / GSCALE);
  ctx.globalAlpha = smooth(clamp(S.warmth * 1.15, 0, 1));
  ctx.drawImage(GROUND_LUSH, sx, sy, sw, sh, sx / GSCALE, sy / GSCALE, sw / GSCALE, sh / GSCALE);
  ctx.globalAlpha = 1;
  drawRoads();
  drawWater();
  drawGroundDetails(view);

  // y-sorted scene
  const items = [];
  const vis = (x, y, pad = 200) => x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - 40 && y < view.y1 + pad + 80;
  for (const t of TREES) if (vis(t.x, t.y)) items.push({ y: t.y, f: () => drawTree(t) });
  for (const k in BUILDINGS) { const b = BUILDINGS[k]; if (vis(b.x + b.w / 2, b.y + b.d, 260)) items.push({ y: b.y + b.d, f: () => drawBuilding(k, b) }); }
  items.push({ y: 682, f: drawStoreStall });
  for (const p of PROPS) if (vis(p.x, p.y)) items.push({ y: p.y, f: () => drawProp(p) });
  addProjectItems(items, vis);
  for (const id of RES_IDS) { const n = NPCS[id]; if (n.visible && vis(n.x, n.y)) items.push({ y: n.y, f: () => drawNPC(id, n) }); }
  if (PIP.visible) items.push({ y: PIP.y, f: () => drawPerson(ctx, PIP.x, PIP.y, PIP_LOOK, { facing: PIP.facing, phase: PIP.phase, moving: PIP.moving, mood: 'happy', scale: 0.68 }) });
  for (const w of WORKERS) if (w.visible && vis(w.x, w.y)) items.push({ y: w.y, f: () => drawBot(ctx, w.x, w.y, w.color, { worker: true, carry: w.carry, facing: w.facing, t: TIME + w.seed }) });
  const P = S.player;
  items.push({ y: P.y, f: () => drawPerson(ctx, P.x, P.y, P.look, { facing: P.facing || 1, phase: P.phase || 0, moving: P.moving, mood: 'happy', back: P.dirY < -0.5 && P.moving, k: 0.45 }) });
  const B = S.bot;
  items.push({ y: B.y, f: () => drawBot(ctx, B.x, B.y, B.color, { facing: B.facing || 1, t: TIME, mood: BOT_FX.mood }) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.f();

  drawParticles(dt, view);
  drawLighting(view);
  drawOverlays();
}

// ----- roads, plaza -----
function drawRoads() {
  const w = smooth(clamp(S.warmth * 1.15, 0, 1));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = r => { ctx.beginPath(); r.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
  for (const r of ROADS) { path(r); ctx.strokeStyle = col('#8a6440', 0.6); ctx.lineWidth = r.w + 12; ctx.stroke(); }
  // plaza
  ctx.fillStyle = col('#8a6440', 0.65); ellipse(ctx, PLAZA.x, PLAZA.y, PLAZA.rx + 9, PLAZA.ry + 8); ctx.fill();
  for (const [pat, a] of [[COBBLE_A, 1], [COBBLE_B, w]]) {
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    for (const r of ROADS) { path(r); ctx.strokeStyle = pat; ctx.lineWidth = r.w; ctx.stroke(); }
    ctx.fillStyle = pat; ellipse(ctx, PLAZA.x, PLAZA.y, PLAZA.rx, PLAZA.ry); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // plaza rings
  ctx.strokeStyle = col('#a3876a', 0.6); ctx.lineWidth = 3;
  for (const k of [0.45, 0.75]) { ellipse(ctx, PLAZA.x, PLAZA.y - 6, PLAZA.rx * k, PLAZA.ry * k); ctx.stroke(); }
}

// ----- water -----
function streamPoly() {
  if (streamPoly.c) return streamPoly.c;
  const L = [], R = [];
  for (let i = 0; i < STREAM.length; i++) {
    const [x, y] = STREAM[i];
    const a = STREAM[Math.max(0, i - 1)], b = STREAM[Math.min(STREAM.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy); dx /= d; dy /= d;
    const hw = STREAM_W / 2 + Math.sin(i * 1.7) * 4;
    L.push([x - dy * hw, y + dx * hw]); R.push([x + dy * hw, y - dx * hw]);
  }
  streamPoly.c = { L, R };
  return streamPoly.c;
}
function smoothPath(pts, close) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}
function drawWater() {
  const { L, R } = streamPoly();
  const water = col('#4f8fae'), deep = col('#3b6f91'), lite = col('#8fc9dc');
  // stream
  ctx.beginPath(); smoothPath(L); const rr = [...R].reverse(); ctx.lineTo(rr[0][0], rr[0][1]);
  for (let i = 1; i < rr.length; i++) ctx.lineTo(rr[i][0], rr[i][1]);
  ctx.closePath();
  const gr = ctx.createLinearGradient(1900, 0, 2120, 0);
  gr.addColorStop(0, water); gr.addColorStop(0.5, deep); gr.addColorStop(1, water);
  ctx.fillStyle = gr; ctx.fill();
  // pond + pool
  for (const P of [POND, POOL]) {
    const g2 = ctx.createRadialGradient(P.x, P.y, 10, P.x, P.y, P.rx);
    g2.addColorStop(0, deep); g2.addColorStop(1, water);
    ctx.fillStyle = g2; ellipse(ctx, P.x, P.y, P.rx, P.ry); ctx.fill();
  }
  // flowing highlights
  ctx.strokeStyle = col('#cdeaf2', 0.55); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, ay] = STREAM[i], [bx, by] = STREAM[i + 1];
    for (let k = 0; k < 5; k++) {
      const t = ((TIME * 0.18 + k / 5 + i * 0.13) % 1);
      const x = lerp(ax, bx, t) + Math.sin(k * 3 + i) * 16, y = lerp(ay, by, t);
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 2, x + 6, y); ctx.stroke();
    }
  }
  for (const P of [POND, POOL]) for (let k = 0; k < 9; k++) {
    const a = k * 0.7 + TIME * 0.05, r = 0.25 + (k % 3) * 0.22;
    const x = P.x + Math.cos(a) * P.rx * r, y = P.y + Math.sin(a * 1.3) * P.ry * r;
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(TIME * 1.5 + k);
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x, y - 2.5, x + 8, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // lily pads when the town warms up
  if (S.warmth > 0.35) {
    const R2 = rng(9);
    for (let i = 0; i < 14; i++) {
      const a = R2() * TAU, r = 0.35 + R2() * 0.5;
      const x = POND.x + Math.cos(a) * POND.rx * r, y = POND.y + Math.sin(a) * POND.ry * r;
      ctx.fillStyle = col('#5f9a4a'); ctx.beginPath(); ctx.ellipse(x, y, 10, 6, 0, 0.3, TAU); ctx.lineTo(x, y); ctx.fill();
      if (i % 3 === 0 && S.warmth > 0.6) { ctx.fillStyle = col('#f7b6c8'); circle(ctx, x + 2, y - 2, 3.2); ctx.fill(); }
    }
  }
  // waterfall
  const fx0 = 1950, fx1 = 2030;
  const wg = ctx.createLinearGradient(0, 120, 0, 300);
  wg.addColorStop(0, col('#a9d8e6')); wg.addColorStop(1, col('#dff3f7'));
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.moveTo(fx0, 124); ctx.lineTo(fx1, 118); ctx.lineTo(fx1 + 14, 300); ctx.lineTo(fx0 - 12, 300); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col('#ffffff', 0.7); ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = fx0 + 4 + i * 6;
    const off = ((TIME * 120 + i * 37) % 180);
    ctx.beginPath(); ctx.moveTo(x, 120 + off); ctx.lineTo(x + 1, 120 + off + 26); ctx.stroke();
  }
  // foam
  ctx.fillStyle = col('#ffffff', 0.75);
  for (let i = 0; i < 10; i++) { circle(ctx, fx0 - 10 + i * 11, 300 + Math.sin(TIME * 4 + i) * 3, 8 + Math.sin(TIME * 3 + i * 2) * 2); ctx.fill(); }
  if (Math.random() < 0.3) spawn('mist', fx0 + Math.random() * 80, 300, { vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 8, life: 2.5 });
  // bridge
  const b = BRIDGE;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; rrect(ctx, b.x1 + 34, b.y2 - 2, b.x2 - b.x1 - 70, 10, 4); ctx.fill();
  ctx.fillStyle = col('#a0866a'); rrect(ctx, b.x1 + 28, b.y1 + 2, b.x2 - b.x1 - 56, b.y2 - b.y1 - 4, 6); ctx.fill();
  ctx.strokeStyle = col('#7a634c'); ctx.lineWidth = 1.5;
  for (let x = b.x1 + 36; x < b.x2 - 30; x += 10) { ctx.beginPath(); ctx.moveTo(x, b.y1 + 4); ctx.lineTo(x, b.y2 - 4); ctx.stroke(); }
  ctx.fillStyle = col('#c9b291'); ctx.fillRect(b.x1 + 26, b.y1 - 6, b.x2 - b.x1 - 52, 6); ctx.fillRect(b.x1 + 26, b.y2 - 3, b.x2 - b.x1 - 52, 5);
}

// ----- ground-level details -----
const GROUND_BITS = [];
function buildGroundBits() {
  const R = rng(4242);
  for (let i = 0; i < 520; i++) {
    const x = 30 + R() * (W - 60), y = 280 + R() * (WH - 300);
    if (roadDist(x, y) < 8 || inWater(x, y) || nearAnyLot(x, y, 4)) continue;
    GROUND_BITS.push({ x, y, k: R() < 0.55 ? 'tuft' : 'flower', c: ['#fff4dc', '#ffd34e', '#f78fb0', '#b48cf0', '#ff8f5a', '#7fc3ff'][(R() * 6) | 0], th: R(), s: 0.7 + R() * 0.6 });
  }
}
function drawGroundDetails(view) {
  const w = S.warmth;
  for (const g of GROUND_BITS) {
    if (g.x < view.x0 || g.x > view.x1 || g.y < view.y0 || g.y > view.y1) continue;
    if (g.k === 'tuft') {
      ctx.strokeStyle = col('#4f7f36'); ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(g.x + i * 2, g.y); ctx.quadraticCurveTo(g.x + i * 3, g.y - 5, g.x + i * 4 + Math.sin(TIME * 2 + g.x) * 1.2, g.y - 9 * g.s); }
      ctx.stroke();
    } else if (g.th < w * 1.1) {
      const sway = Math.sin(TIME * 1.8 + g.x * 0.1) * 1.2;
      ctx.strokeStyle = col('#4f8a3a'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + sway, g.y - 7 * g.s); ctx.stroke();
      ctx.fillStyle = col(g.c);
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; circle(ctx, g.x + sway + Math.cos(a) * 2.4 * g.s, g.y - 7 * g.s + Math.sin(a) * 2.4 * g.s, 1.8 * g.s); ctx.fill(); }
      ctx.fillStyle = col('#ffe08a'); circle(ctx, g.x + sway, g.y - 7 * g.s, 1.3 * g.s); ctx.fill();
    }
  }
  drawTeoGarden();
  drawLotsGround();
  // fountain basin is ground-level
  drawFountain();
}

function drawTeoGarden() {
  const x = 470, y = 1250, w = 160, h = 120;
  const thriving = H('teo').stage === 'thriving' || (H('teo').stage === 'easing' && H('teo').energy > 50);
  const lush = H('teo').stage === 'thriving';
  ctx.fillStyle = col(thriving ? '#6b4a32' : '#7d6a52'); rrect(ctx, x, y, w, h, 10); ctx.fill();
  const R = rng(31);
  for (let r = 0; r < 4; r++) {
    const yy = y + 20 + r * 26;
    if (thriving) { ctx.strokeStyle = col('#5a3c28'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 12, yy + 6); ctx.lineTo(x + w - 12, yy + 6); ctx.stroke(); }
    for (let i = 0; i < 7; i++) {
      const px = x + 18 + i * 20 + (R() - 0.5) * 6, py = yy + (R() - 0.5) * 6;
      if (lush) {
        // artichoke plants: silver-green leaves with purple heads
        ctx.fillStyle = col('#7fa88a');
        for (let l = 0; l < 5; l++) { const a = -Math.PI / 2 + (l - 2) * 0.55; ctx.beginPath(); ctx.ellipse(px + Math.cos(a) * 6, py + Math.sin(a) * 5, 7, 2.6, a, 0, TAU); ctx.fill(); }
        if ((i + r) % 2 === 0) { ctx.fillStyle = col('#8a4f9e'); circle(ctx, px, py - 7, 4); ctx.fill(); ctx.fillStyle = col('#b07cc4'); circle(ctx, px - 1, py - 8, 1.6); ctx.fill(); }
      } else {
        ctx.strokeStyle = col(thriving ? '#6f9a4a' : '#8a8a52'); ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { ctx.moveTo(px, py); ctx.lineTo(px + (R() - 0.5) * 16, py - 6 - R() * 9); }
        ctx.stroke();
      }
    }
  }
  // fence
  ctx.strokeStyle = col('#9b8262'); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 6, y + h + 6); ctx.lineTo(x + w + 6, y + h + 6); ctx.stroke();
  for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(x - 6 + i * (w + 12) / 8, y + h + 6); ctx.lineTo(x - 6 + i * (w + 12) / 8, y + h - 8); ctx.stroke(); }
}

function drawLotsGround() {
  // overgrown lot (until the greenhouse goes up)
  const G = LOTS.greenhouse, gp = S.projects.greenhouse;
  if (gp.status !== 'online' && gp.status !== 'building') {
    ctx.fillStyle = col('#8a7d58'); rrect(ctx, G.x, G.y, G.w, G.d, 14); ctx.fill();
    const R = rng(55);
    for (let i = 0; i < 22; i++) {
      const x = G.x + 16 + R() * (G.w - 32), y = G.y + 16 + R() * (G.d - 26), r = 8 + R() * 10;
      ctx.fillStyle = col('#5d7a3c'); circle(ctx, x, y, r); ctx.fill();
      ctx.fillStyle = col('#78964a'); circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.6); ctx.fill();
      ctx.strokeStyle = col('#6b4e36'); ctx.lineWidth = 1.2;
      ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = R() * TAU; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * r, y + Math.sin(a) * r - 6, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.2); } ctx.stroke();
      if (R() < 0.3) { ctx.fillStyle = col('#4a2a4a'); circle(ctx, x + r * 0.4, y, 1.8); ctx.fill(); }
    }
    if (!S.salvage.frames) {
      ctx.strokeStyle = col('#8a5a3a'); ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const x = G.x + 50 + i * 45; ctx.beginPath(); ctx.arc(x, G.y + 80, 20, Math.PI, 0); ctx.stroke(); }
    }
  } else {
    ctx.fillStyle = col('#7a5e44'); rrect(ctx, G.x, G.y, G.w, G.d, 12); ctx.fill();
  }
  // terrace
  const K = LOTS.kitchen;
  ctx.fillStyle = col('#c9ae8a'); rrect(ctx, K.x, K.y - 10, K.w, K.d + 14, 8); ctx.fill();
  ctx.strokeStyle = col('#a88d6b'); ctx.lineWidth = 1;
  for (let x = K.x + 20; x < K.x + K.w; x += 20) { ctx.beginPath(); ctx.moveTo(x, K.y - 8); ctx.lineTo(x, K.y + K.d + 2); ctx.stroke(); }
  for (let y = K.y + 6; y < K.y + K.d + 4; y += 18) { ctx.beginPath(); ctx.moveTo(K.x + 2, y); ctx.lineTo(K.x + K.w - 2, y); ctx.stroke(); }
  if (S.creations.kitchen.status !== 'built') {
    const R = rng(66);
    ctx.strokeStyle = col('#6f7a48'); ctx.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) { const x = K.x + R() * K.w, y = K.y + R() * K.d; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 6); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 5); ctx.stroke(); }
    ctx.strokeStyle = col('#8f7a62'); ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { const x = K.x + 20 + R() * (K.w - 40), y = K.y + 10 + R() * (K.d - 20); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 4); ctx.lineTo(x + 14, y + 12); ctx.stroke(); }
  }
  // pavilion lot / garden lot hints
  const PV = LOTS.pavilion;
  if (S.creations.pavilion.status === 'built' || S.creations.pavilion.status === 'building') {
    ctx.fillStyle = col('#c8a982'); ellipse(ctx, PV.x + PV.w / 2, PV.y + 50, 88, 46); ctx.fill();
  }
}

function drawFountain() {
  const { x, y } = POI.fountain;
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(ctx, x + 4, y + 8, 62, 36); ctx.fill();
  ctx.fillStyle = col('#cdb894'); ellipse(ctx, x, y, 60, 36); ctx.fill();
  ctx.fillStyle = col('#a8916e'); ellipse(ctx, x, y + 4, 60, 34); ctx.fill();
  ctx.fillStyle = col('#d9c6a3'); ellipse(ctx, x, y, 58, 33); ctx.fill();
  const on = S.flags.fountainOn;
  ctx.fillStyle = on ? col('#5d9fbf') : col('#8f8a7a'); ellipse(ctx, x, y, 50, 27); ctx.fill();
  if (on) {
    ctx.strokeStyle = col('#cdeaf2', 0.7); ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { const r = ((TIME * 14 + k * 16) % 46); ctx.globalAlpha = 1 - r / 46; ellipse(ctx, x, y, r, r * 0.55); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = col('#7a7466'); ctx.beginPath(); ctx.ellipse(x - 12, y + 6, 16, 6, 0, 0, TAU); ctx.fill();
  }
}

// ----- trees -----
function drawTree(t) {
  const { x, y } = t, s = t.s;
  const R = rng(Math.floor(t.seed * 1000) + 1);
  const sway = Math.sin(TIME * 0.9 + t.seed) * 1.3 * (S.weather === 'storm' ? 3 : 1);
  ctx.fillStyle = 'rgba(25,30,20,0.22)'; ellipse(ctx, x + 8 * s, y + 2, 26 * s, 9 * s); ctx.fill();
  if (t.kind === 'cypress') {
    ctx.fillStyle = col('#5a4632'); ctx.fillRect(x - 2.5, y - 12 * s, 5, 12 * s);
    const g = ctx.createLinearGradient(x - 14 * s, 0, x + 14 * s, 0);
    g.addColorStop(0, col('#4f7a3f')); g.addColorStop(1, col('#2f5530'));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y - 8 * s);
    ctx.bezierCurveTo(x - 16 * s, y - 20 * s, x - 13 * s + sway, y - 70 * s, x + sway * 1.5, y - 98 * s);
    ctx.bezierCurveTo(x + 13 * s + sway, y - 70 * s, x + 16 * s, y - 20 * s, x, y - 8 * s); ctx.fill();
    ctx.strokeStyle = col('#1f3420', 0.6); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = col('#68924f', 0.6); ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const yy = y - 20 * s - i * 12 * s; ctx.beginPath(); ctx.moveTo(x - 6 * s + sway * i / 6, yy); ctx.quadraticCurveTo(x - 2 * s, yy - 6 * s, x + 2 * s, yy - 2 * s); ctx.stroke(); }
    return;
  }
  if (t.kind === 'bush') {
    const bl = []; for (let i = 0; i < 5; i++) bl.push([x + (R() - 0.5) * 22 * s, y - 8 * s - R() * 10 * s, (9 + R() * 6) * s]);
    ctx.fillStyle = col('#1f3a1c', 0.7); for (const [bx, by, br] of bl) { circle(ctx, bx, by, br + 1.8); ctx.fill(); }
    bl.forEach(([bx, by, br], i) => { ctx.fillStyle = col(i < 3 ? '#467a30' : '#62983e'); circle(ctx, bx, by, br); ctx.fill(); });
    ctx.fillStyle = col('#93c457', 0.8); for (const [bx, by, br] of bl.slice(2)) { circle(ctx, bx - br * 0.3, by - br * 0.35, br * 0.45); ctx.fill(); }
    if (S.warmth > 0.5 && t.seed % 2 < 1) { ctx.fillStyle = col('#f48fb1'); for (let i = 0; i < 6; i++) { circle(ctx, x + (R() - 0.5) * 24 * s, y - 6 * s - R() * 16 * s, 2.2); ctx.fill(); } }
    return;
  }
  const olive = t.kind === 'olive', lemon = t.kind === 'lemon';
  ctx.strokeStyle = col(olive ? '#6e5e4a' : '#6b4f36'); ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (olive ? 6 : 2) * s, y - 14 * s, x + sway * 0.5, y - 28 * s); ctx.stroke();
  if (olive) { ctx.lineWidth = 3.5 * s; ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 16 * s); ctx.lineTo(x - 10 * s, y - 28 * s); ctx.stroke(); }
  const base = olive ? '#66844c' : lemon ? '#356f26' : '#326c24';
  const mid = olive ? '#869f62' : lemon ? '#4f8a30' : '#4a862e';
  const hi = olive ? '#b4c682' : lemon ? '#8ab848' : '#90bc48';
  const cy = y - (olive ? 40 : 48) * s;
  const blobs = [];
  for (let i = 0; i < 7; i++) blobs.push([x + (R() - 0.5) * 38 * s + sway, cy + (R() - 0.5) * 26 * s, (13 + R() * 9) * s]);
  ctx.fillStyle = col('#1f3420', 0.65); for (const [bx, by, br] of blobs) { circle(ctx, bx, by + 4, br + 2); ctx.fill(); }
  ctx.fillStyle = col(base); for (const [bx, by, br] of blobs) { circle(ctx, bx, by + 4, br); ctx.fill(); }
  ctx.fillStyle = col(mid); for (const [bx, by, br] of blobs) { circle(ctx, bx - 2, by, br * 0.86); ctx.fill(); }
  ctx.fillStyle = col(hi, 0.85); for (const [bx, by, br] of blobs.slice(0, 4)) { circle(ctx, bx - br * 0.3, by - br * 0.35, br * 0.42); ctx.fill(); }
  if (lemon && S.warmth > 0.25) { ctx.fillStyle = col('#ffd84a'); for (let i = 0; i < 7; i++) { circle(ctx, x + (R() - 0.5) * 36 * s + sway, cy + (R() - 0.2) * 22 * s, 2.8); ctx.fill(); } }
  if (!olive && !lemon && S.warmth > 0.72 && t.seed % 3 < 1) { ctx.fillStyle = col('#ffd0dc'); for (let i = 0; i < 10; i++) { circle(ctx, x + (R() - 0.5) * 40 * s + sway, cy + (R() - 0.5) * 26 * s, 2); ctx.fill(); } }
}

// ----- buildings -----
// Buildings are drawn as little dioramas: a front face, a shaded right-hand side
// receding by (SIDE_X, -SIDE_Y), and a hip roof whose side and ridge show too.
const SIDE_X = 24, SIDE_Y = 14;
const inkCol = a => col('#3a2620', a === undefined ? 0.72 : a);
function sideWall(x, top, front, color, sd = SIDE_X, sk = SIDE_Y) {
  const g = ctx.createLinearGradient(x, 0, x + sd, 0);
  g.addColorStop(0, col(shade(color, -0.3))); g.addColorStop(1, col(shade(color, -0.2)));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x, front); ctx.lineTo(x + sd, front - sk); ctx.lineTo(x + sd, top - sk); ctx.lineTo(x, top); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col('#7c6e5c');
  ctx.beginPath(); ctx.moveTo(x, front); ctx.lineTo(x + sd, front - sk); ctx.lineTo(x + sd, front - sk - 12); ctx.lineTo(x, front - 12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = inkCol(); ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, front); ctx.lineTo(x + sd, front - sk); ctx.lineTo(x + sd, top - sk); ctx.stroke();
}
// ground shadow cast to the lower right, plus a soft contact shadow along the front
function buildingShadow(x, w, front, top, sd = SIDE_X, sk = SIDE_Y) {
  ctx.fillStyle = 'rgba(40,26,30,0.22)';
  ctx.beginPath(); ctx.moveTo(x + w + sd, front - sk); ctx.lineTo(x + w + sd + 30, front - sk + 8); ctx.lineTo(x + w + 30, front + 12); ctx.lineTo(x + 6, front + 12); ctx.lineTo(x, front); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, front - 2, 0, front + 10);
  g.addColorStop(0, 'rgba(40,26,30,0.3)'); g.addColorStop(1, 'rgba(40,26,30,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 6, front - 2, w + 12, 12);
}
// side slope and ridge of a hip roof; returns nothing, outlines the whole roof
function roofSide(x0, x1, yb, yt, inset, color, sd = SIDE_X, sk = SIDE_Y) {
  ctx.fillStyle = col(shade(color, -0.26));
  ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x1 + sd, yb - sk); ctx.lineTo(x1 - inset + sd, yt - sk); ctx.lineTo(x1 - inset, yt); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col(shade(color, -0.45), 0.5); ctx.lineWidth = 1.1;
  for (let j = 1; j < 6; j++) { const t = j / 6; ctx.beginPath(); ctx.moveTo(lerp(x1, x1 - inset, t), lerp(yb, yt, t)); ctx.lineTo(lerp(x1 + sd, x1 - inset + sd, t), lerp(yb - sk, yt - sk, t)); ctx.stroke(); }
  ctx.fillStyle = col(shade(color, 0.18));
  ctx.beginPath(); ctx.moveTo(x0 + inset, yt); ctx.lineTo(x1 - inset, yt); ctx.lineTo(x1 - inset + sd, yt - sk); ctx.lineTo(x0 + inset + sd, yt - sk); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = inkCol(); ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.lineTo(x1 + sd, yb - sk); ctx.lineTo(x1 - inset + sd, yt - sk); ctx.lineTo(x0 + inset + sd, yt - sk); ctx.lineTo(x0 + inset, yt); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = inkCol(0.45); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x1 - inset, yt); ctx.lineTo(x1 - inset + sd, yt - sk); ctx.stroke();
}
function roofTiles(x0, x1, yb, yt, inset, color, rows, side) {
  const g = ctx.createLinearGradient(0, yt, 0, yb);
  g.addColorStop(0, col(shade(color, 0.12))); g.addColorStop(1, col(shade(color, -0.12)));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.lineTo(x1 - inset, yt); ctx.lineTo(x0 + inset, yt); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = col(shade(color, -0.3), 0.55); ctx.lineWidth = 1.2;
  const n = rows || Math.floor((yb - yt) / 8);
  for (let j = 1; j <= n; j++) {
    const yy = lerp(yb, yt, j / (n + 0.5));
    const t = (yb - yy) / (yb - yt);
    const lx = lerp(x0, x0 + inset, t), rx = lerp(x1, x1 - inset, t);
    ctx.beginPath();
    for (let xx = lx; xx < rx; xx += 9) { ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 4.5, yy + 4, xx + 9, yy); }
    ctx.stroke();
  }
  ctx.strokeStyle = col(shade(color, 0.25), 0.35);
  const cols = Math.floor((x1 - x0) / 9);
  for (let i = 1; i < cols; i++) {
    const bx = lerp(x0, x1, i / cols), tx = lerp(x0 + inset, x1 - inset, i / cols);
    ctx.beginPath(); ctx.moveTo(bx, yb); ctx.lineTo(tx, yt); ctx.stroke();
  }
  ctx.restore();
  if (side) { roofSide(x0, x1, yb, yt, inset, color); return; }
  ctx.strokeStyle = col(shade(color, -0.35)); ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0 + inset, yt); ctx.lineTo(x1 - inset, yt); ctx.stroke();
}
function wallRect(x, y, w, h, color, seed) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, col(shade(color, 0.08))); g.addColorStop(1, col(shade(color, -0.1)));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const R = rng(seed);
  for (let i = 0; i < 10; i++) { ctx.fillStyle = col(shade(color, (R() - 0.5) * 0.18), 0.35); ellipse(ctx, x + R() * w, y + R() * h, 6 + R() * 14, 4 + R() * 8); ctx.fill(); }
  // stone base
  ctx.fillStyle = col('#9a8a74'); ctx.fillRect(x, y + h - 12, w, 12);
  ctx.strokeStyle = col('#7c6e5c'); ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 14) { ctx.strokeRect(x + i + ((i / 14) % 2) * 4, y + h - 12, 14, 6); ctx.strokeRect(x + i, y + h - 6, 14, 6); }
  // quoins
  ctx.fillStyle = col(shade(color, -0.12));
  for (let j = 0; j < h - 14; j += 14) { ctx.fillRect(x, y + j, (j / 14) % 2 ? 7 : 11, 12); ctx.fillRect(x + w - ((j / 14) % 2 ? 7 : 11), y + j, (j / 14) % 2 ? 7 : 11, 12); }
  // shadow under the eaves
  const eg = ctx.createLinearGradient(0, y, 0, y + 22);
  eg.addColorStop(0, 'rgba(50,30,30,0.32)'); eg.addColorStop(1, 'rgba(50,30,30,0)');
  ctx.fillStyle = eg; ctx.fillRect(x, y, w, 22);
  ctx.strokeStyle = inkCol(); ctx.lineWidth = 1.8; ctx.strokeRect(x, y, w, h);
}
function windowAt(x, y, w, h, trim, lit, opts = {}) {
  ctx.fillStyle = col(shade(trim, 0.55)); rrect(ctx, x - 3, y - 3, w + 6, h + 6, 3); ctx.fill();
  if (opts.arch) { ctx.beginPath(); ctx.arc(x + w / 2, y + 2, w / 2 + 3, Math.PI, 0); ctx.fill(); }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (lit) { g.addColorStop(0, '#ffe2a0'); g.addColorStop(1, lit === 'blue' ? '#9fc8ff' : '#ffb760'); }
  else { g.addColorStop(0, col('#7f98a8')); g.addColorStop(1, col('#4a5e6e')); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (opts.arch) { ctx.beginPath(); ctx.arc(x + w / 2, y + 1, w / 2, Math.PI, 0); ctx.fill(); }
  if (!lit) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(x + 2, y + h - 2); ctx.lineTo(x + w * 0.5, y + 2); ctx.lineTo(x + w * 0.7, y + 2); ctx.lineTo(x + 4, y + h - 2); ctx.fill(); }
  ctx.strokeStyle = col(shade(trim, 0.4)); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  if (opts.shutters !== false) {
    ctx.fillStyle = col(trim);
    ctx.fillRect(x - 11, y - 2, 8, h + 4); ctx.fillRect(x + w + 3, y - 2, 8, h + 4);
    ctx.strokeStyle = col(shade(trim, -0.3)); ctx.lineWidth = 1;
    for (let j = 3; j < h; j += 4) { ctx.beginPath(); ctx.moveTo(x - 10, y + j); ctx.lineTo(x - 4, y + j); ctx.moveTo(x + w + 4, y + j); ctx.lineTo(x + w + 10, y + j); ctx.stroke(); }
  }
  ctx.fillStyle = col('#cdbb9c'); ctx.fillRect(x - 5, y + h + 2, w + 10, 4);
  if (opts.flowers) {
    ctx.fillStyle = col('#a0603a'); ctx.fillRect(x - 3, y + h + 5, w + 6, 7);
    const R = rng(Math.floor(x * 7 + y));
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = col('#4f8a3a'); circle(ctx, x + i * (w / 5), y + h + 4, 3.5); ctx.fill();
      ctx.fillStyle = col(['#ff6f6f', '#ffd34e', '#f78fb0', '#ffffff'][(R() * 4) | 0]); circle(ctx, x + i * (w / 5) + (R() - 0.5) * 3, y + h + 1, 2.4); ctx.fill();
    }
  }
}
function doorAt(x, y, w, h, color, opts = {}) {
  ctx.fillStyle = col('#8a7a62'); ctx.fillRect(x - 6, y + h - 2, w + 12, 5);
  ctx.fillStyle = col(shade(color, 0.4)); ctx.beginPath(); ctx.moveTo(x - 4, y + h); ctx.lineTo(x - 4, y + 10); ctx.arc(x + w / 2, y + 10, w / 2 + 4, Math.PI, 0); ctx.lineTo(x + w + 4, y + h); ctx.fill();
  ctx.fillStyle = col(color); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + 10); ctx.arc(x + w / 2, y + 10, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.fill();
  ctx.strokeStyle = col(shade(color, -0.3)); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  ctx.fillStyle = col('#e8c25a'); circle(ctx, x + w * 0.7, y + h * 0.6, 1.8); ctx.fill();
  if (opts.plants) {
    for (const px of [x - 14, x + w + 14]) {
      ctx.fillStyle = col('#b0603e'); ctx.beginPath(); ctx.moveTo(px - 7, y + h - 12); ctx.lineTo(px + 7, y + h - 12); ctx.lineTo(px + 5, y + h); ctx.lineTo(px - 5, y + h); ctx.fill();
      ctx.fillStyle = col('#4f8a3a'); circle(ctx, px, y + h - 18, 8); ctx.fill(); circle(ctx, px - 4, y + h - 22, 5); ctx.fill();
      ctx.fillStyle = col('#ff7a8a'); circle(ctx, px + 3, y + h - 22, 2.4); ctx.fill(); circle(ctx, px - 3, y + h - 15, 2.2); ctx.fill();
    }
  }
}
function vines(x, y, w, h, amt, seed) {
  if (amt <= 0) return;
  const R = rng(seed);
  ctx.strokeStyle = col('#4f7f36'); ctx.lineWidth = 1.6;
  const n = Math.floor(amt * 5);
  for (let i = 0; i < n; i++) {
    const vx = x + R() * w; let vy = y + h;
    ctx.beginPath(); ctx.moveTo(vx, vy);
    const len = h * (0.4 + R() * 0.5) * amt;
    for (let k = 0; k < len; k += 8) { ctx.quadraticCurveTo(vx + (R() - 0.5) * 12, vy - k - 4, vx + (R() - 0.5) * 8, vy - k - 8); }
    ctx.stroke();
    ctx.fillStyle = col('#5f9a44');
    for (let k = 0; k < len; k += 7) { circle(ctx, vx + (R() - 0.5) * 12, vy - k, 3); ctx.fill(); }
    if (amt > 0.7) { ctx.fillStyle = col('#e46aa0'); for (let k = 0; k < len; k += 18) { circle(ctx, vx + (R() - 0.5) * 10, vy - k - 4, 2.2); ctx.fill(); } }
  }
}
function homeLit(id) {
  const n = NPCS[id], b = currentBlock(id), m = S.minute % 1440;
  if (!b.hidden) return false;
  if (b.act === 'away') return false;
  if (m > 22.3 * 60 || m < 6 * 60) return false;
  if (b.gig) return 'blue';
  return true;
}
function bloomFor(id) { return Math.max(S.warmth - 0.15, (H(id).energy - 45) / 50); }

function drawBuilding(key, b) {
  const front = b.y + b.d, top = front - b.h;
  const x = b.x, w = b.w;
  buildingShadow(x, w, front, top);
  sideWall(x + w, top, front, b.kind === 'shed' ? '#8f7a62' : b.wall);
  const night = lightLevel();
  if (b.kind === 'house') {
    const id = key;
    wallRect(x, top, w, b.h, b.wall, x);
    const lit = night > 0.2 && homeLit(id);
    const fl = bloomFor(id) > 0.3;
    windowAt(x + 26, top + 34, 30, 34, b.trim, lit, { flowers: fl });
    windowAt(x + w - 56, top + 34, 30, 34, b.trim, lit, { flowers: fl });
    doorAt(x + w / 2 - 15, front - 54, 30, 50, shade(b.trim, -0.15), { plants: bloomFor(id) > 0.45 });
    vines(x, top, 30, b.h, clamp(bloomFor(id) * 1.2, 0, 1), x + 3);
    roofTiles(x - 16, x + w + 16, top + 8, top - 64, 34, b.roof, 0, true);
    // chimney
    ctx.fillStyle = col(shade(b.wall, -0.15)); ctx.fillRect(x + w - 48, top - 74, 16, 30);
    ctx.fillStyle = col('#7c6e5c'); ctx.fillRect(x + w - 51, top - 78, 22, 6);
    const smoking = (id === 'mara' && (currentBlock('mara').smoke)) || (lit && Math.random() < 0.01);
    if (smoking && Math.random() < 0.25) spawn('smoke', x + w - 40, top - 80, { vx: 4 + Math.random() * 4, vy: -14, life: 3.5, bread: id === 'mara' });
    if (id === 'mara' && H('mara').stage !== 'overworked' && S.warmth > 0.3) { // Pip's chalk drawings
      ctx.strokeStyle = col('#ffd34e', 0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + w + 20, front + 30, 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(x + w + 20 + Math.cos(a) * 11, front + 30 + Math.sin(a) * 11); ctx.lineTo(x + w + 20 + Math.cos(a) * 15, front + 30 + Math.sin(a) * 15); ctx.stroke(); }
    }
  } else if (b.kind === 'apartment') {
    wallRect(x, top, w, b.h, b.wall, x);
    const lit = night > 0.2 && homeLit('juno');
    const fl = bloomFor('juno') > 0.3;
    for (let i = 0; i < 3; i++) windowAt(x + 20 + i * 52, top + 26, 26, 32, b.trim, i === 1 ? lit : (night > 0.3 && i === 0 ? true : false), { flowers: fl && i !== 1 });
    windowAt(x + 76, top + 96, 26, 32, b.trim, false, { shutters: false });
    windowAt(x + 128, top + 96, 26, 32, b.trim, night > 0.3 && hash(S.day) > 0.4, {});
    doorAt(x + 18, front - 52, 30, 48, shade(b.trim, -0.2), { plants: bloomFor('juno') > 0.5 });
    // balcony
    ctx.fillStyle = col('#9a8a74'); ctx.fillRect(x + 62, top + 62, 66, 6);
    ctx.strokeStyle = col('#4a4a52'); ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 62, top + 44, 66, 18);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x + 66 + i * 7.5, top + 44); ctx.lineTo(x + 66 + i * 7.5, top + 62); ctx.stroke(); }
    if (bloomFor('juno') > 0.35) { for (let i = 0; i < 4; i++) { ctx.fillStyle = col('#b0603e'); ctx.fillRect(x + 66 + i * 16, top + 54, 9, 8); ctx.fillStyle = col(['#4f8a3a', '#6aa64c'][i % 2]); circle(ctx, x + 70 + i * 16, top + 50, 6); ctx.fill(); } }
    if (H('juno').stage === 'thriving') { // drawings taped in the window
      ctx.fillStyle = '#fffaf0'; for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(x + 78 + i * 7, top + 34); ctx.rotate((i - 1) * 0.15); ctx.fillRect(-3, -4, 6, 8); ctx.restore(); }
    }
    roofTiles(x - 16, x + w + 16, top + 8, top - 58, 32, b.roof, 0, true);
    ctx.fillStyle = col('#7c6e5c'); ctx.fillRect(x + 30, top - 64, 14, 26);
  } else if (b.kind === 'store') {
    wallRect(x, top, w, b.h, b.wall, x);
    const open = currentBlock('odile').act === 'store';
    const lit = night > 0.15 && (open || homeLit('odile'));
    windowAt(x + 18, top + 40, 52, 46, b.trim, open && night > 0.1 ? true : false, { shutters: false });
    windowAt(x + w - 70, top + 40, 52, 46, b.trim, open && night > 0.1 ? true : false, { shutters: false });
    doorAt(x + w / 2 - 17, front - 58, 34, 54, '#4e7d6b', { plants: S.warmth > 0.4 });
    // produce in the windows
    const R = rng(12);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = col(['#e8a23a', '#d6553a', '#9cc24a', '#f2d24a'][(R() * 4) | 0]); circle(ctx, x + 22 + (i % 7) * 7 + (i > 6 ? 108 : 0), top + 80, 3); ctx.fill(); }
    // awning
    const ay = top + 22;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = col(i % 2 ? '#f3e8d2' : b.trim);
      ctx.beginPath(); ctx.moveTo(x - 8 + i * (w + 16) / 10, ay); ctx.lineTo(x - 8 + (i + 1) * (w + 16) / 10, ay); ctx.lineTo(x - 8 + (i + 1) * (w + 16) / 10 + 2, ay + 18);
      ctx.arc(x - 8 + (i + 0.5) * (w + 16) / 10 + 1, ay + 18, (w + 16) / 20, 0, Math.PI); ctx.closePath(); ctx.fill();
    }
    roofTiles(x - 16, x + w + 16, top + 8, top - 60, 36, b.roof, 0, true);
    // sign
    ctx.fillStyle = col('#3f5f52'); rrect(ctx, x + w / 2 - 48, top - 16, 96, 22, 5); ctx.fill();
    ctx.fillStyle = col('#f3e3bf'); ctx.font = '700 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText("BRANDT'S", x + w / 2, top - 5);
    vines(x + w - 30, top, 30, b.h, clamp((S.warmth - 0.3) * 1.5, 0, 1), 99);
  } else if (b.kind === 'garage') {
    wallRect(x, top, w, b.h, b.wall, x);
    // big roll door, half open, warm inside
    const dx = x + 50, dw = 92, dh = 74;
    ctx.fillStyle = col('#3a3230'); ctx.fillRect(dx, front - dh - 4, dw, dh);
    ctx.fillStyle = night > 0.2 ? 'rgba(255,190,110,0.55)' : col('#5a4a40'); ctx.fillRect(dx + 4, front - 40, dw - 8, 36);
    ctx.fillStyle = col('#a8603a');
    for (let i = 0; i < 6; i++) ctx.fillRect(dx, front - dh - 4 + i * 6, dw, 5);
    ctx.fillStyle = col('#7d4a2e'); ctx.fillRect(dx - 3, front - dh - 6, dw + 6, 4);
    windowAt(x + 14, top + 34, 24, 28, b.trim, night > 0.25, { shutters: false });
    ctx.fillStyle = col('#2f2a28'); rrect(ctx, x + 52, top + 10, 88, 18, 4); ctx.fill();
    ctx.fillStyle = col('#f2c56a'); ctx.font = '800 11px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('WORKSHOP', x + 96, top + 19);
    // corrugated roof
    ctx.fillStyle = col('#8e7c6c'); ctx.beginPath(); ctx.moveTo(x - 10, top + 6); ctx.lineTo(x + w + 10, top + 6); ctx.lineTo(x + w - 10, top - 40); ctx.lineTo(x + 10, top - 40); ctx.fill();
    ctx.strokeStyle = col('#6f5f52'); ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) { const bx = lerp(x - 10, x + w + 10, i / 20), tx = lerp(x + 10, x + w - 10, i / 20); ctx.beginPath(); ctx.moveTo(bx, top + 6); ctx.lineTo(tx, top - 40); ctx.stroke(); }
    roofSide(x - 10, x + w + 10, top + 6, top - 40, 20, '#8e7c6c');
    // workbench outside
    const wx = POI.workbench.x - 28, wy = POI.workbench.y - 18;
    ctx.fillStyle = col('#7a5a3e'); ctx.fillRect(wx, wy - 18, 56, 6); ctx.fillRect(wx + 3, wy - 12, 4, 14); ctx.fillRect(wx + 49, wy - 12, 4, 14);
    ctx.fillStyle = col('#c8c2b6'); ctx.fillRect(wx + 8, wy - 24, 12, 6); ctx.fillStyle = col('#e8c25a'); ctx.fillRect(wx + 26, wy - 22, 18, 4);
    ctx.fillStyle = '#fffaf0'; ctx.save(); ctx.translate(wx + 36, wy - 21); ctx.rotate(-0.1); ctx.fillRect(-8, -5, 16, 10); ctx.restore();
    // retired robots in a heap until salvaged
    if (!S.salvage.garage) {
      const gx = POI.garageSalvage.x, gy = POI.garageSalvage.y - 14;
      for (let i = 0; i < 3; i++) { ctx.fillStyle = col(['#8a8f96', '#9a8a72', '#7f8a86'][i]); rrect(ctx, gx - 22 + i * 14, gy - 10 - i * 4, 18, 16, 5); ctx.fill(); ctx.fillStyle = col('#3a4a50'); ctx.fillRect(gx - 18 + i * 14, gy - 6 - i * 4, 10, 5); }
    }
  } else if (b.kind === 'shed') {
    ctx.fillStyle = col('#8f7a62'); ctx.fillRect(x, top, w, b.h);
    ctx.strokeStyle = col('#6f5c48'); ctx.lineWidth = 2;
    for (let i = 0; i < w; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, top); ctx.lineTo(x + i, front); ctx.stroke(); }
    ctx.fillStyle = col('#3a3230'); ctx.fillRect(x + 60, front - 66, 60, 62);
    ctx.strokeStyle = col('#8a5a3a'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 60, front - 66); ctx.lineTo(x + 120, front - 4); ctx.moveTo(x + 120, front - 66); ctx.lineTo(x + 60, front - 4); ctx.stroke();
    ctx.fillStyle = col('#8a5c48'); ctx.beginPath(); ctx.moveTo(x - 10, top + 6); ctx.lineTo(x + w + 10, top + 6); ctx.lineTo(x + w - 8, top - 34); ctx.lineTo(x + 8, top - 34); ctx.fill();
    ctx.strokeStyle = col('#6a4434'); for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.moveTo(lerp(x - 10, x + w + 10, i / 18), top + 6); ctx.lineTo(lerp(x + 8, x + w - 8, i / 18), top - 34); ctx.stroke(); }
    roofSide(x - 10, x + w + 10, top + 6, top - 34, 18, '#8a5c48');
    ctx.fillStyle = col('#2f2a28'); rrect(ctx, x + 40, top + 10, 100, 16, 3); ctx.fill();
    ctx.fillStyle = col('#d9c6a3'); ctx.font = '700 10px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('VALLEY RAIL · 1962', x + 90, top + 18);
    // rails
    ctx.strokeStyle = col('#6f655c'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(300, 560); ctx.lineTo(300, 1560); ctx.moveTo(338, 560); ctx.lineTo(338, 1560); ctx.stroke();
    ctx.strokeStyle = col('#7c6a56'); ctx.lineWidth = 5;
    for (let y = 570; y < 1560; y += 18) { ctx.beginPath(); ctx.moveTo(292, y); ctx.lineTo(346, y); ctx.stroke(); }
    ctx.strokeStyle = col('#8a8f96'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(300, 560); ctx.lineTo(300, 1560); ctx.moveTo(338, 560); ctx.lineTo(338, 1560); ctx.stroke();
    if (!S.salvage.depot) {
      const sx = POI.depotSalvage.x, sy = POI.depotSalvage.y - 10;
      for (let i = 0; i < 4; i++) { ctx.fillStyle = col('#9a7a52'); ctx.fillRect(sx - 34 + (i % 2) * 34, sy - 14 - Math.floor(i / 2) * 16, 30, 16); ctx.strokeStyle = col('#6f5636'); ctx.lineWidth = 1; ctx.strokeRect(sx - 34 + (i % 2) * 34, sy - 14 - Math.floor(i / 2) * 16, 30, 16); }
      ctx.fillStyle = col('#2f4f7a'); ctx.fillRect(sx - 30, sy - 50, 56, 6);
    }
  }
}
function drawStoreStall() {
  const x = 1150, y = 682;
  ctx.fillStyle = 'rgba(30,25,40,0.18)'; ctx.fillRect(x - 46, y - 4, 92, 8);
  ctx.fillStyle = col('#8a6a48'); ctx.fillRect(x - 44, y - 22, 88, 20);
  ctx.fillStyle = col('#a8845a'); ctx.fillRect(x - 46, y - 26, 92, 6);
  const R = rng(3);
  const fruits = S.warmth > 0.4 ? ['#f2a03a', '#e0503a', '#9cc24a', '#f4d34a', '#c45aa0'] : ['#c8a060', '#b0705a', '#9aa070'];
  for (let i = 0; i < 16; i++) { ctx.fillStyle = col(fruits[(R() * fruits.length) | 0]); circle(ctx, x - 38 + (i % 8) * 10.5, y - 30 + Math.floor(i / 8) * 4, 4); ctx.fill(); }
  if (S.warmth > 0.45) { // café table
    const tx = 1268, ty = 700;
    ctx.fillStyle = 'rgba(30,25,40,0.18)'; ellipse(ctx, tx, ty, 16, 5); ctx.fill();
    ctx.fillStyle = col('#4e7d6b'); ctx.fillRect(tx - 1.5, ty - 18, 3, 18); ellipse(ctx, tx, ty - 19, 13, 4.5); ctx.fill();
    ctx.fillStyle = col('#ffffff'); ctx.fillRect(tx - 4, ty - 26, 6, 6);
    ctx.fillStyle = col('#c4643c'); ctx.beginPath(); ctx.moveTo(tx - 18, ty - 52); ctx.lineTo(tx + 18, ty - 52); ctx.lineTo(tx, ty - 64); ctx.fill();
    ctx.strokeStyle = col('#7a634c'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, ty - 52); ctx.lineTo(tx, ty - 22); ctx.stroke();
  }
}

// ----- props -----
function drawProp(p) {
  const { x, y } = p;
  if (p.kind === 'lamp') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ellipse(ctx, x + 3, y + 1, 7, 3); ctx.fill();
    ctx.fillStyle = col('#3f4248'); ctx.fillRect(x - 1.5, y - 52, 3, 52); ctx.fillRect(x - 4, y - 3, 8, 4);
    ctx.fillStyle = col('#3f4248'); ctx.beginPath(); ctx.moveTo(x - 7, y - 54); ctx.lineTo(x + 7, y - 54); ctx.lineTo(x + 4, y - 64); ctx.lineTo(x - 4, y - 64); ctx.fill();
    const on = lightLevel() > 0.25;
    ctx.fillStyle = on ? '#ffe6a8' : col('#d8d0b8'); ctx.fillRect(x - 4, y - 62, 8, 7);
    if (S.warmth > 0.55) { ctx.fillStyle = col('#c4643c'); ctx.beginPath(); ctx.moveTo(x - 1, y - 40); ctx.lineTo(x + 12, y - 36); ctx.lineTo(x - 1, y - 32); ctx.fill(); }
  } else if (p.kind === 'bench') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ellipse(ctx, x + 2, y + 2, 28, 5); ctx.fill();
    ctx.fillStyle = col('#5a4a3a'); ctx.fillRect(x - 22, y - 10, 3, 10); ctx.fillRect(x + 19, y - 10, 3, 10);
    ctx.fillStyle = col('#9a6e48'); ctx.fillRect(x - 26, y - 13, 52, 5); ctx.fillRect(x - 26, y - 26, 52, 4); ctx.fillRect(x - 26, y - 20, 52, 3);
  } else if (p.kind === 'notice') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(ctx, x + 3, y + 3, 28, 5); ctx.fill();
    ctx.fillStyle = col('#6b4f36'); ctx.fillRect(x - 22, y - 46, 4, 46); ctx.fillRect(x + 18, y - 46, 4, 46);
    ctx.fillStyle = col('#8a6a48'); ctx.fillRect(x - 28, y - 56, 56, 36);
    ctx.fillStyle = col('#c49a6a'); ctx.fillRect(x - 25, y - 53, 50, 30);
    const notes = ['#fffaf0', '#ffe9a8', '#cfe8ff', '#ffd0dc'];
    for (let i = 0; i < 5; i++) { ctx.fillStyle = col(notes[i % 4]); ctx.save(); ctx.translate(x - 16 + (i % 3) * 15, y - 44 + Math.floor(i / 3) * 12); ctx.rotate((i - 2) * 0.08); ctx.fillRect(-6, -5, 12, 10); ctx.restore(); }
    ctx.fillStyle = col('#b4573a'); ctx.beginPath(); ctx.moveTo(x - 32, y - 56); ctx.lineTo(x + 32, y - 56); ctx.lineTo(x, y - 68); ctx.fill();
  } else if (p.kind === 'busstop') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - 44, y - 2, 92, 8);
    ctx.fillStyle = col('#5f6a72'); ctx.fillRect(x - 42, y - 56, 3, 56); ctx.fillRect(x + 39, y - 56, 3, 56);
    ctx.fillStyle = col('#a9c4cf', 0.5); ctx.fillRect(x - 40, y - 52, 80, 40);
    ctx.fillStyle = col('#4e7d6b'); ctx.fillRect(x - 46, y - 62, 92, 8);
    ctx.fillStyle = col('#9a6e48'); ctx.fillRect(x - 30, y - 16, 60, 4);
    ctx.fillStyle = col('#3f5f52'); ctx.fillRect(x + 52, y - 66, 3, 66); ctx.fillStyle = col('#e8c25a'); circle(ctx, x + 53, y - 70, 9); ctx.fill();
    ctx.fillStyle = col('#2f2a28'); ctx.font = '800 9px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BUS', x + 53, y - 70);
  } else if (p.kind === 'tower') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(ctx, x + 10, y + 4, 52, 12); ctx.fill();
    ctx.strokeStyle = col('#6f655c'); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - 36, y); ctx.lineTo(x - 24, y - 90); ctx.moveTo(x + 36, y); ctx.lineTo(x + 24, y - 90); ctx.moveTo(x - 12, y - 6); ctx.lineTo(x - 10, y - 90); ctx.moveTo(x + 12, y - 6); ctx.lineTo(x + 10, y - 90); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 32, y - 30); ctx.lineTo(x + 32, y - 60); ctx.moveTo(x + 32, y - 30); ctx.lineTo(x - 32, y - 60); ctx.stroke();
    ctx.fillStyle = col('#8a8070'); rrect(ctx, x - 40, y - 140, 80, 54, 8); ctx.fill();
    ctx.strokeStyle = col('#6f655c'); ctx.lineWidth = 1.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x - 40, y - 132 + i * 10); ctx.lineTo(x + 40, y - 132 + i * 10); ctx.stroke(); }
    ctx.fillStyle = col('#6f5f52'); ctx.beginPath(); ctx.moveTo(x - 44, y - 138); ctx.lineTo(x + 44, y - 138); ctx.lineTo(x, y - 160); ctx.fill();
    if (!S.salvage.tower) { ctx.fillStyle = col('#c07a4a'); ctx.fillRect(x - 10, y + 20, 30, 6); ctx.fillRect(x - 4, y + 28, 24, 5); }
  } else if (p.kind === 'sign') {
    ctx.fillStyle = col('#6b4f36'); ctx.fillRect(x - 2, y - 40, 4, 40);
    ctx.fillStyle = col('#c49a6a'); ctx.beginPath(); ctx.moveTo(x - 40, y - 46); ctx.lineTo(x + 34, y - 46); ctx.lineTo(x + 44, y - 37); ctx.lineTo(x + 34, y - 28); ctx.lineTo(x - 40, y - 28); ctx.fill();
    ctx.fillStyle = col('#3a2e26'); ctx.font = '700 10px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.text, x, y - 37);
  } else if (p.kind === 'van') {
    if (S.flags.vanGone) return;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ellipse(ctx, x + 4, y + 2, 50, 9); ctx.fill();
    ctx.fillStyle = col('#c9c2b0'); rrect(ctx, x - 44, y - 44, 88, 38, 7); ctx.fill();
    ctx.fillStyle = col('#a8a090'); ctx.fillRect(x - 44, y - 16, 88, 10);
    ctx.fillStyle = col('#5a6a78'); rrect(ctx, x + 18, y - 40, 22, 16, 3); ctx.fill();
    ctx.fillStyle = col('#2f2a28'); circle(ctx, x - 26, y - 4, 8); ctx.fill(); circle(ctx, x + 26, y - 4, 8); ctx.fill();
    ctx.fillStyle = col('#8a8070'); circle(ctx, x - 26, y - 4, 3); ctx.fill(); circle(ctx, x + 26, y - 4, 3); ctx.fill();
    ctx.fillStyle = col('#b4573a'); ctx.font = '800 9px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.fillText('MARCHETTI', x - 10, y - 26);
    if (S.quest === 'van') { ctx.fillStyle = 'rgba(80,80,80,0.5)'; if (Math.random() < 0.08) spawn('smoke', x + 40, y - 20, { vx: 6, vy: -8, life: 2 }); }
  } else if (p.kind === 'bed') {
    const bl = S.warmth;
    ctx.fillStyle = col('#8a6a4a'); ellipse(ctx, x, y, 26, 11); ctx.fill();
    ctx.fillStyle = col('#6b4e36'); ellipse(ctx, x, y - 1, 23, 9); ctx.fill();
    const R = rng(Math.floor(p.seed));
    for (let i = 0; i < 9; i++) {
      const px = x + (R() - 0.5) * 36, py = y + (R() - 0.5) * 12 - 2;
      ctx.fillStyle = col(bl > 0.25 ? '#4f8a3a' : '#7a7a4a'); circle(ctx, px, py - 3, 4); ctx.fill();
      if (R() < bl * 1.1) { ctx.fillStyle = col(['#ff6f6f', '#ffd34e', '#f78fb0', '#b48cf0', '#ffffff'][(R() * 5) | 0]); circle(ctx, px, py - 7, 2.8); ctx.fill(); }
    }
  } else if (p.kind === 'rock') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(ctx, x + 2, y + 2, 14, 5); ctx.fill();
    ctx.fillStyle = col('#9a9286'); ctx.beginPath(); ctx.ellipse(x, y - 4, 13, 8, 0, Math.PI, 0); ctx.lineTo(x + 13, y); ctx.lineTo(x - 13, y); ctx.fill();
    ctx.fillStyle = col('#b8b0a4'); ellipse(ctx, x - 3, y - 7, 6, 3); ctx.fill();
  } else if (p.kind === 'shrub') {
    ctx.fillStyle = col('#1f3a1c', 0.65); circle(ctx, x - 6, y - 6, 9.6); ctx.fill(); circle(ctx, x + 6, y - 6, 9.6); ctx.fill(); circle(ctx, x, y - 10, 10.6); ctx.fill();
    ctx.fillStyle = col('#4d7b3a'); circle(ctx, x - 6, y - 6, 8); ctx.fill(); circle(ctx, x + 6, y - 6, 8); ctx.fill();
    ctx.fillStyle = col('#69984c'); circle(ctx, x, y - 10, 9); ctx.fill();
    if (S.warmth > 0.5) { ctx.fillStyle = col('#ffd34e'); circle(ctx, x + 3, y - 13, 2); ctx.fill(); circle(ctx, x - 5, y - 8, 2); ctx.fill(); }
  }
}

// ----- characters -----
const PIP_LOOK = { skin: '#7b4a32', hair: '#1d1512', hairStyle: 'curly', outfit: '#4fa3c4', pants: '#d9773f' };
function resLook(id) {
  const r = RES[id], h = H(id);
  const free = h.stage === 'rest' || h.stage === 'thriving';
  const look = { ...r.look };
  if (free) { look.outfit = r.look.freeOutfit; look.vest = false; }
  if (id === 'mara' && h.stage === 'thriving') look.apron = true;
  return look;
}
function drawNPC(id, n) {
  const b = currentBlock(id);
  drawPerson(ctx, n.x, n.y, resLook(id), { facing: n.facing, phase: n.phase, moving: n.moving, mood: n.mood, pose: n.moving ? 'walk' : n.pose, back: n.moving && n.dirY < -0.6 && Math.abs(n.dirY) > 0, id });
  if (!n.moving && (b.act === 'accordion') && Math.random() < 0.03) spawn('note', n.x + 10, n.y - 40, { vx: 6, vy: -16, life: 2.5 });
  if (!n.moving && (b.act === 'tinker') && Math.random() < 0.04) spawn('spark', n.x + 12 * n.facing, n.y - 12, { life: 0.5 });
  // thought icons
  const h = H(id);
  const phase = (TIME * 0.25 + id.length) % 6;
  if (!n.moving && phase < 2.2 && !n.bubble) {
    let icon = null;
    if (h.stage === 'overworked' && h.energy < 40) icon = (id.length % 2 ? 'bill' : 'zzz');
    if (h.stage === 'thriving') icon = RES[id].icon;
    if (b.act === 'breakfast' || b.act === 'social') icon = 'heart';
    if (icon) drawThought(n.x + 14, n.y - 62, icon, Math.min(1, phase * 2, (2.2 - phase) * 2));
  }
}
function drawPerson(c, x, y, look, o = {}) {
  const s = o.scale || 1, k = o.k === undefined ? 0.8 : o.k;
  const f = o.facing || 1;
  const pose = o.pose || (o.moving ? 'walk' : 'stand');
  const mood = o.mood || 'neutral';
  const ph = o.phase || 0;
  // ink outline: the same figure stamped in a dark color around itself
  if (!o.ink && !LOW_FX) {
    c.save(); c.globalAlpha = 0.8;
    const d = 1.3 * s;
    for (const [dx, dy] of [[-d, 0], [d, 0], [0, -d], [0, d]]) drawPerson(c, x + dx, y + dy, look, { ...o, ink: true });
    c.restore();
  }
  const C = o.ink ? () => '#2e2024' : (hex, a) => col(hex, a, k);
  c.save();
  c.translate(x, y); c.scale(s, s);
  if (!o.ink) { c.fillStyle = 'rgba(20,20,30,0.24)'; ellipse(c, 0, 0, 12, 4.4); c.fill(); }
  const sit = pose === 'sit' || pose === 'tea' || pose === 'sketch';
  const crouch = pose === 'garden' || pose === 'tinker';
  let bob = 0;
  if (pose === 'walk') bob = Math.abs(Math.sin(ph)) * -2;
  else if (pose === 'bake') bob = Math.sin(TIME * 6) * 1;
  else bob = Math.sin(TIME * 1.6 + x) * 0.5;
  const hunch = mood === 'tired' ? 2 : mood === 'rushed' ? 1 : 0;
  const lean = mood === 'rushed' && pose === 'walk' ? f * 2.5 : 0;
  const dy = sit ? 8 : crouch ? 10 : 0;
  // legs
  c.fillStyle = C(look.pants || '#3e4250');
  if (sit) {
    c.fillRect(-7, -12, 6, 5); c.fillRect(1, -12, 6, 5);
    c.fillRect(-7 + f * 3, -9, 5, 9); c.fillRect(1 + f * 3, -9, 5, 9);
  } else if (crouch) {
    c.fillRect(-8, -8, 6, 8); c.fillRect(2, -8, 6, 8);
  } else {
    const l1 = pose === 'walk' ? Math.max(0, Math.sin(ph)) * 3 : 0, l2 = pose === 'walk' ? Math.max(0, -Math.sin(ph)) * 3 : 0;
    const sw = pose === 'walk' ? Math.sin(ph) * 2 * f : 0;
    rrect(c, -7 + sw, -16 + bob, 6, 16 - l1, 2.5); c.fill();
    rrect(c, 1 - sw, -16 + bob, 6, 16 - l2, 2.5); c.fill();
  }
  c.fillStyle = C('#2f2a2a');
  if (!sit) { ellipse(c, -4 + f, -1, 4, 2.2); c.fill(); ellipse(c, 4 + f, -1, 4, 2.2); c.fill(); }
  else { ellipse(c, -4 + f * 4, -1, 3.5, 2); c.fill(); ellipse(c, 4 + f * 4, -1, 3.5, 2); c.fill(); }
  c.translate(lean, bob + dy + hunch * 0.5);
  // torso
  const tg = c.createLinearGradient(-9, -34, 9, -14);
  tg.addColorStop(0, C(shade(look.outfit, 0.15))); tg.addColorStop(1, C(shade(look.outfit, -0.15)));
  c.fillStyle = tg; rrect(c, -9, -34, 18, 21, 6); c.fill();
  if (look.vest) { c.fillStyle = C('#d8c44a'); c.fillRect(-9, -31, 5, 17); c.fillRect(4, -31, 5, 17); c.fillStyle = C('#f0f0e0'); c.fillRect(-9, -22, 18, 2.5); }
  if (look.apron) { c.fillStyle = C('#fff4e4'); rrect(c, -6, -28, 12, 17, 3); c.fill(); c.fillStyle = C('#e8d0b0'); c.fillRect(-3, -22, 6, 3); }
  // arms
  const armSw = pose === 'walk' ? Math.sin(ph) * 4 : 0;
  c.strokeStyle = C(shade(look.outfit, -0.05)); c.lineWidth = 5; c.lineCap = 'round';
  let lh = [-11 - armSw * 0.3 * f, -17 + Math.abs(armSw) * 0.2], rh = [11 + armSw * 0.3 * f, -17];
  if (pose === 'walk') { lh = [-10 + armSw * f, -17]; rh = [10 - armSw * f, -17]; }
  if (pose === 'tea') { rh = [5 * f, -26]; }
  if (pose === 'sketch') { lh = [-4, -18]; rh = [5 + Math.sin(TIME * 7) * 2, -18]; }
  if (pose === 'garden' || pose === 'tinker') { lh = [-6 + f * 6, -12 + Math.sin(TIME * 4) * 2]; rh = [6 + f * 8, -11 - Math.sin(TIME * 4) * 2]; }
  if (pose === 'bake') { lh = [-5, -20 + Math.sin(TIME * 6) * 2]; rh = [5, -20 - Math.sin(TIME * 6) * 2]; }
  if (pose === 'paint') { rh = [8 * f, -40 + Math.sin(TIME * 3) * 6]; }
  if (pose === 'accordion') { const e = Math.sin(TIME * 2.6) * 4; lh = [-9 - e, -22]; rh = [9 + e, -22]; }
  if (pose === 'chat') { rh = [10 * f, -22 + Math.sin(TIME * 2 + x) * 4]; }
  if (pose === 'store') { lh = [-9, -20]; rh = [9, -20]; }
  c.beginPath(); c.moveTo(-8, -30); c.lineTo(lh[0], lh[1]); c.moveTo(8, -30); c.lineTo(rh[0], rh[1]); c.stroke();
  c.fillStyle = C(look.skin); circle(c, lh[0], lh[1], 2.6); c.fill(); circle(c, rh[0], rh[1], 2.6); c.fill();
  if (pose === 'tea') { c.fillStyle = C('#f3e8d2'); c.fillRect(rh[0] - 3, rh[1] - 5, 6, 6); if (!o.ink && Math.random() < 0.04) spawn('steam', x + rh[0] * s, y + (rh[1] - 6 + dy) * s, { life: 1.4 }); }
  if (pose === 'sketch') { c.fillStyle = C('#fffaf0'); c.fillRect(-6, -21, 12, 8); c.strokeStyle = '#7a6a5a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-4, -16); c.quadraticCurveTo(0, -20, 4, -16); c.stroke(); }
  if (pose === 'paint') { c.strokeStyle = C('#8a6a48'); c.lineWidth = 1.5; c.beginPath(); c.moveTo(rh[0], rh[1]); c.lineTo(rh[0] + 4 * f, rh[1] - 7); c.stroke(); c.fillStyle = C('#e0503a'); circle(c, rh[0] + 4 * f, rh[1] - 8, 1.8); c.fill(); }
  if (pose === 'accordion') {
    const e = 14 + Math.sin(TIME * 2.6) * 4;
    c.fillStyle = C('#b4342e'); c.fillRect(-e / 2 - 4, -28, 8, 14); c.fillRect(e / 2 - 4, -28, 8, 14);
    c.fillStyle = C('#f3e8d2'); for (let i = 0; i < 4; i++) c.fillRect(-e / 2 + 4 + i * (e - 8) / 4, -27, (e - 8) / 8, 12);
  }
  if (pose === 'tinker') { c.strokeStyle = C('#9aa0a8'); c.lineWidth = 2; c.beginPath(); c.moveTo(rh[0], rh[1]); c.lineTo(rh[0] + 6 * f, rh[1] + 2); c.stroke(); }
  if (pose === 'garden') { c.strokeStyle = C('#7a5a3e'); c.lineWidth = 2; c.beginPath(); c.moveTo(rh[0], rh[1]); c.lineTo(rh[0] + 3 * f, rh[1] + 7); c.stroke(); }
  // head
  c.translate(f * hunch * 0.6, hunch);
  const hx = 0, hy = -45;
  if (look.hairStyle === 'long' || look.hairStyle === 'ponytail') { c.fillStyle = C(look.hair); rrect(c, -11, hy - 6, 22, look.hairStyle === 'long' ? 24 : 14, 8); c.fill(); }
  if (look.hairStyle === 'ponytail') { c.fillStyle = C(look.hair); ellipse(c, -f * 11, hy + 2, 4, 9); c.fill(); }
  c.fillStyle = C(look.skin); circle(c, hx, hy, 10.5); c.fill();
  c.fillStyle = C(shade(look.skin, -0.12), 0.6); ellipse(c, hx + 3, hy + 4, 7, 5); c.fill();
  c.fillStyle = C(look.skin); circle(c, hx - 1, hy - 1, 9.5); c.fill();
  circle(c, hx - 10, hy + 1, 2.4); c.fill(); circle(c, hx + 10, hy + 1, 2.4); c.fill();
  drawHair(c, look, hx, hy, f, o.back, C);
  if (!o.back && !o.ink) drawFace(c, look, hx, hy, f, mood, C);
  c.restore();
  if (o.ink) return;
  if (mood === 'rushed' && o.moving && Math.random() < 0.02) spawn('sweat', x - f * 10 * s, y - 52 * s, { life: 0.6 });
}
function drawHair(c, look, hx, hy, f, back, C) {
  c.fillStyle = C(look.hair);
  const st = look.hairStyle;
  if (back) { circle(c, hx, hy - 1, 10.8); c.fill(); }
  if (st === 'short' || st === 'long' || st === 'ponytail') {
    c.beginPath(); c.arc(hx, hy - 1, 11, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(hx + 4, hy - 6, hx - 2 * f, hy - 5); c.quadraticCurveTo(hx - 6, hy - 4, hx - 11, hy); c.fill();
  } else if (st === 'bob') {
    c.beginPath(); c.arc(hx, hy - 1, 11.5, Math.PI, 0); c.lineTo(hx + 12, hy + 7); c.lineTo(hx + 7, hy + 7); c.lineTo(hx + 7, hy - 4); c.lineTo(hx - 7, hy - 4); c.lineTo(hx - 7, hy + 7); c.lineTo(hx - 12, hy + 7); c.closePath(); c.fill();
  } else if (st === 'bun') {
    c.beginPath(); c.arc(hx, hy - 1, 11, Math.PI * 1.05, Math.PI * 1.95); c.quadraticCurveTo(hx, hy - 7, hx - 10.5, hy - 2); c.fill();
    circle(c, hx, hy - 13, 5.5); c.fill();
  } else if (st === 'curly') {
    for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; circle(c, hx + Math.cos(a) * 10, hy - 2 + Math.sin(a) * 9, 4.2); c.fill(); }
  } else if (st === 'buzz') {
    c.globalAlpha = 0.85; c.beginPath(); c.arc(hx, hy - 1, 10.6, Math.PI * 1.05, Math.PI * 1.95); c.quadraticCurveTo(hx, hy - 6, hx - 10, hy - 3); c.fill(); c.globalAlpha = 1;
  } else if (st === 'wrap') {
    c.fillStyle = C(look.wrap || '#c86a34');
    c.beginPath(); c.arc(hx, hy - 2, 11.5, Math.PI * 0.95, Math.PI * 2.05); c.quadraticCurveTo(hx, hy - 5, hx - 11, hy); c.fill();
    c.beginPath(); c.ellipse(hx - f * 2, hy - 14, 9, 6, -0.3 * f, 0, TAU); c.fill();
    c.fillStyle = C(shade(look.wrap || '#c86a34', -0.2)); c.beginPath(); c.ellipse(hx + f * 7, hy - 10, 4, 3, 0.5, 0, TAU); c.fill();
    c.strokeStyle = C(shade(look.wrap || '#c86a34', 0.25)); c.lineWidth = 1.2; c.beginPath(); c.arc(hx, hy - 3, 9, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  } else if (st === 'cap') {
    c.fillStyle = C(look.hair); circle(c, hx - f * 7, hy + 1, 4); c.fill();
    c.fillStyle = C(look.cap || '#5c4a3a');
    c.beginPath(); c.arc(hx, hy - 3, 11, Math.PI * 1.0, Math.PI * 2.0); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(hx + f * 8, hy - 3, 8, 2.6, 0, 0, TAU); c.fill();
  }
}
function drawFace(c, look, hx, hy, f, mood, C) {
  const ex = hx + f * 1.5, ey = hy;
  const blink = (TIME * 0.7 + hx) % 4 < 0.12;
  c.fillStyle = C('#2a2228'); c.strokeStyle = C('#2a2228'); c.lineWidth = 1.4; c.lineCap = 'round';
  const eyes = (fn) => { fn(ex - 4, ey); fn(ex + 4, ey); };
  if (blink || mood === 'calm') {
    eyes((x, y) => { c.beginPath(); c.arc(x, y - 0.5, 2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); });
  } else if (mood === 'happy') {
    eyes((x, y) => { c.beginPath(); c.arc(x, y + 1, 2.2, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); });
  } else if (mood === 'tired') {
    eyes((x, y) => { c.beginPath(); c.arc(x, y + 0.5, 1.9, 0, Math.PI); c.fill(); c.strokeStyle = C(shade(look.skin, -0.3)); c.beginPath(); c.moveTo(x - 2, y + 3.4); c.quadraticCurveTo(x, y + 4.4, x + 2, y + 3.4); c.stroke(); c.strokeStyle = C('#2a2228'); });
  } else {
    eyes((x, y) => { circle(c, x, y, 1.7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.8)'; circle(c, x + 0.6, y - 0.6, 0.6); c.fill(); c.fillStyle = C('#2a2228'); });
  }
  if (mood === 'rushed') { c.beginPath(); c.moveTo(ex - 6, ey - 4); c.lineTo(ex - 2, ey - 3); c.moveTo(ex + 6, ey - 4); c.lineTo(ex + 2, ey - 3); c.stroke(); }
  // mouth
  const my = ey + 5.5, mx = ex;
  c.beginPath();
  if (mood === 'happy') { c.arc(mx, my - 1.5, 3, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); c.fillStyle = 'rgba(240,110,110,0.35)'; circle(c, ex - 6.5, ey + 3, 2.2); c.fill(); circle(c, ex + 6.5, ey + 3, 2.2); c.fill(); }
  else if (mood === 'calm') { c.arc(mx, my - 2, 2.4, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
  else if (mood === 'tired') { c.moveTo(mx - 2.5, my + 0.5); c.quadraticCurveTo(mx, my - 0.8, mx + 2.5, my + 0.5); c.stroke(); }
  else if (mood === 'rushed') { c.ellipse(mx, my, 1.6, 1.2, 0, 0, TAU); c.fill(); }
  else { c.moveTo(mx - 2, my); c.lineTo(mx + 2, my); c.stroke(); }
  if (look.mustache) { c.fillStyle = C('#9a928a'); c.beginPath(); c.ellipse(mx - 2.2, my - 1.6, 3, 1.5, 0.2, 0, TAU); c.ellipse(mx + 2.2, my - 1.6, 3, 1.5, -0.2, 0, TAU); c.fill(); }
  if (look.glasses) { c.strokeStyle = C('#6a5a7a'); c.lineWidth = 1; c.beginPath(); c.arc(ex - 4, ey, 3.2, 0, TAU); c.moveTo(ex + 7.2, ey); c.arc(ex + 4, ey, 3.2, 0, TAU); c.moveTo(ex - 0.8, ey); c.lineTo(ex + 0.8, ey); c.stroke(); }
}

function drawBot(c, x, y, color, o = {}) {
  const t = o.t || 0, f = o.facing || 1;
  const hover = 13 + Math.sin(t * 3) * 2.2;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(20,20,30,0.22)'; ellipse(c, 0, 0, 10 - Math.sin(t * 3), 3.6); c.fill();
  c.translate(0, -hover);
  if (o.worker) {
    c.fillStyle = col('#6a6f78'); c.fillRect(-9, -4, 18, 4);
    c.fillStyle = col(color); rrect(c, -11, -26, 22, 22, 5); c.fill();
    c.fillStyle = col('#2a3a42'); rrect(c, -8, -22, 16, 10, 3); c.fill();
    c.fillStyle = '#9ff0ff'; circle(c, -3 + f, -17, 1.6); c.fill(); circle(c, 3 + f, -17, 1.6); c.fill();
    if (o.carry) { c.fillStyle = col('#a8845a'); c.fillRect(-10, -42, 20, 14); c.strokeStyle = col('#7a5a3e'); c.lineWidth = 1; c.strokeRect(-10, -42, 20, 14); }
    c.restore(); return;
  }
  // thruster glow
  const g = c.createRadialGradient(0, 4, 0, 0, 4, 10);
  g.addColorStop(0, 'rgba(140,230,255,0.7)'); g.addColorStop(1, 'rgba(140,230,255,0)');
  c.fillStyle = g; circle(c, 0, 4, 10); c.fill();
  // arms
  const wav = Math.sin(t * 4) * 3;
  c.strokeStyle = col(shade(color, -0.2), undefined, 0.4); c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-11, -10); c.lineTo(-16, -6 + wav); c.moveTo(11, -10); c.lineTo(16, -6 - wav); c.stroke();
  // body
  const bg = c.createLinearGradient(-12, -28, 12, 2);
  bg.addColorStop(0, col(shade(color, 0.3), undefined, 0.4)); bg.addColorStop(1, col(shade(color, -0.15), undefined, 0.4));
  c.fillStyle = bg; rrect(c, -12, -26, 24, 26, 11); c.fill();
  c.fillStyle = col('#1f3640', undefined, 0.3); rrect(c, -9, -21, 18, 12, 6); c.fill();
  const blink = (t * 0.8) % 3.5 < 0.12;
  c.fillStyle = BOT_FX.mood === 'happy' ? '#ffd88a' : '#8ff4ff';
  if (blink) { c.fillRect(-6 + f, -15.5, 4, 1.2); c.fillRect(2 + f, -15.5, 4, 1.2); }
  else if (BOT_FX.mood === 'happy') { c.strokeStyle = '#ffd88a'; c.lineWidth = 1.6; c.beginPath(); c.arc(-4 + f, -14, 2, Math.PI * 1.1, Math.PI * 1.9); c.moveTo(6 + f, -14); c.arc(4 + f, -14, 2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  else { circle(c, -4 + f, -15, 2.1); c.fill(); circle(c, 4 + f, -15, 2.1); c.fill(); }
  c.strokeStyle = col('#5a5f68', undefined, 0.3); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -26); c.lineTo(0, -32); c.stroke();
  c.fillStyle = (t * 1.2) % 2 < 1 ? '#ff9a6a' : '#ffd36a'; circle(c, 0, -33, 2.4); c.fill();
  c.restore();
}
const BOT_FX = { mood: 'normal' };

function drawThought(x, y, icon, a) {
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  ctx.fillStyle = 'rgba(255,252,244,0.95)'; ctx.strokeStyle = 'rgba(60,50,60,0.25)'; ctx.lineWidth = 1;
  circle(ctx, x - 6, y + 14, 2); ctx.fill(); circle(ctx, x - 3, y + 9, 3); ctx.fill();
  rrect(ctx, x - 12, y - 12, 24, 20, 9); ctx.fill(); ctx.stroke();
  drawIcon(ctx, icon, x, y - 2, 7);
  ctx.restore();
}
function drawIcon(c, icon, x, y, r) {
  c.save(); c.translate(x, y);
  c.lineWidth = 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
  if (icon === 'bill') { c.fillStyle = '#fff'; c.strokeStyle = '#b4573a'; c.fillRect(-r * 0.7, -r, r * 1.4, r * 2); c.strokeRect(-r * 0.7, -r, r * 1.4, r * 2); c.fillStyle = '#b4573a'; c.font = `800 ${r * 1.4}px Nunito, system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 1); }
  else if (icon === 'zzz') { c.fillStyle = '#6f8fd0'; c.font = `800 ${r * 1.3}px Nunito, system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', -3, 2); c.font = `800 ${r}px Nunito, system-ui`; c.fillText('z', 4, -3); }
  else if (icon === 'bread') { c.fillStyle = '#d9954a'; c.beginPath(); c.ellipse(0, 1, r, r * 0.65, 0, 0, TAU); c.fill(); c.strokeStyle = '#a8632e'; c.beginPath(); c.moveTo(-3, -1); c.lineTo(-1, 3); c.moveTo(1, -2); c.lineTo(3, 2); c.stroke(); }
  else if (icon === 'sprout') { c.strokeStyle = '#4f8a3a'; c.beginPath(); c.moveTo(0, r); c.lineTo(0, -1); c.stroke(); c.fillStyle = '#6aa64c'; c.beginPath(); c.ellipse(-3.5, -2, 4, 2.2, -0.5, 0, TAU); c.ellipse(3.5, -3, 4, 2.2, 0.5, 0, TAU); c.fill(); }
  else if (icon === 'pencil') { c.rotate(-0.7); c.fillStyle = '#e8c25a'; c.fillRect(-r, -2, r * 1.6, 4); c.fillStyle = '#f0c8a0'; c.beginPath(); c.moveTo(r * 0.6, -2); c.lineTo(r, 0); c.lineTo(r * 0.6, 2); c.fill(); c.fillStyle = '#e88a9a'; c.fillRect(-r - 2, -2, 3, 4); }
  else if (icon === 'music') { c.fillStyle = '#c46a9a'; c.strokeStyle = '#c46a9a'; circle(c, -3, 4, 2.5); c.fill(); circle(c, 4, 2, 2.5); c.fill(); c.beginPath(); c.moveTo(-0.6, 4); c.lineTo(-0.6, -5); c.lineTo(6.4, -7); c.lineTo(6.4, 2); c.stroke(); }
  else if (icon === 'heart') { c.fillStyle = '#e8607a'; c.beginPath(); c.moveTo(0, r * 0.8); c.bezierCurveTo(-r * 1.4, -r * 0.2, -r * 0.5, -r * 1.2, 0, -r * 0.35); c.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.4, -r * 0.2, 0, r * 0.8); c.fill(); }
  else if (icon === 'sun') { c.fillStyle = '#f2b33a'; circle(c, 0, 0, r * 0.55); c.fill(); c.strokeStyle = '#f2b33a'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); c.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); c.stroke(); } }
  else if (icon === 'wrench') { c.rotate(0.7); c.fillStyle = '#8a929c'; c.fillRect(-1.5, -r, 3, r * 2); circle(c, 0, -r, 3.2); c.fill(); c.fillStyle = '#fff'; c.fillRect(-1, -r - 3.5, 2, 3); }
  else if (icon === 'gear') { c.fillStyle = '#e8c25a'; for (let i = 0; i < 8; i++) { c.save(); c.rotate(i / 8 * TAU); c.fillRect(-1.5, -r, 3, 3); c.restore(); } circle(c, 0, 0, r * 0.7); c.fill(); c.fillStyle = '#5a4a3a'; circle(c, 0, 0, r * 0.28); c.fill(); }
  else if (icon === 'cloud') { c.fillStyle = '#b8c2cc'; circle(c, -3, 1, 4); c.fill(); circle(c, 2, -1, 5); c.fill(); circle(c, 5, 2, 3.5); c.fill(); c.fillRect(-3, 1, 9, 4); }
  else if (icon === 'rain') { c.fillStyle = '#9aa6b2'; circle(c, -3, -2, 4); c.fill(); circle(c, 2, -3, 5); c.fill(); c.strokeStyle = '#6f9fd0'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-4 + i * 4, 3); c.lineTo(-5 + i * 4, 7); c.stroke(); } }
  else if (icon === 'wind') { c.strokeStyle = '#8a9aa8'; c.beginPath(); c.moveTo(-r, -3); c.lineTo(3, -3); c.arc(3, -5.5, 2.5, Math.PI / 2, -Math.PI / 2, true); c.moveTo(-r, 2); c.lineTo(5, 2); c.stroke(); }
  c.restore();
}

// ----- particles -----
function spawn(kind, x, y, o = {}) {
  if (PARTICLES.length > 500) return;
  PARTICLES.push({ kind, x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 1, max: o.life || 1, bread: o.bread, c: o.c, s: o.s || 1 });
}
function drawParticles(dt, view) {
  // ambient spawns
  const w = S.warmth, m = S.minute % 1440;
  if (w > 0.35 && Math.random() < w * 0.08 && m > 7 * 60 && m < 19 * 60) spawn('butterfly', view.x0 + Math.random() * (view.x1 - view.x0), view.y0 + Math.random() * (view.y1 - view.y0), { life: 7, c: ['#ffd34e', '#f78fb0', '#9fd0ff', '#ffffff'][(Math.random() * 4) | 0] });
  if (w > 0.4 && lightLevel() > 0.5 && Math.random() < w * 0.15) spawn('firefly', view.x0 + Math.random() * (view.x1 - view.x0), view.y0 + Math.random() * (view.y1 - view.y0), { life: 4 });
  if ((S.weather === 'rain' || S.weather === 'storm') && m > 6 * 60 && m < 21 * 60) for (let i = 0; i < 6; i++) spawn('rain', view.x0 + Math.random() * (view.x1 - view.x0 + 200), view.y0 + Math.random() * (view.y1 - view.y0), { life: 0.5 });
  if (S.weather === 'storm' && Math.random() < 0.3) spawn('leaf', view.x0 - 20, view.y0 + Math.random() * (view.y1 - view.y0), { vx: 120 + Math.random() * 60, vy: 10, life: 6, c: '#8aa45a' });
  if (w > 0.6 && Math.random() < 0.02) spawn('leaf', view.x0 + Math.random() * (view.x1 - view.x0), view.y0, { vx: 10, vy: 20, life: 8, c: '#f2a6c0' });
  for (let i = PARTICLES.length - 1; i >= 0; i--) {
    const p = PARTICLES[i];
    p.life -= dt;
    if (p.life <= 0) { PARTICLES.splice(i, 1); continue; }
    const a = p.life / p.max;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'smoke') {
      p.vx += 2 * dt;
      ctx.fillStyle = p.bread ? `rgba(255,240,215,${0.45 * a})` : `rgba(200,200,205,${0.4 * a})`;
      circle(ctx, p.x, p.y, 5 + (1 - a) * 12); ctx.fill();
      if (p.bread && Math.random() < 0.05) spawn('heart', p.x, p.y, { vy: -10, life: 1.5 });
    } else if (p.kind === 'mist') { ctx.fillStyle = `rgba(255,255,255,${0.28 * a})`; circle(ctx, p.x, p.y, 6 + (1 - a) * 14); ctx.fill(); }
    else if (p.kind === 'steam') { p.y -= 10 * dt; ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`; circle(ctx, p.x + Math.sin(p.life * 6) * 2, p.y, 2 + (1 - a) * 3); ctx.fill(); }
    else if (p.kind === 'spark') { ctx.fillStyle = `rgba(255,220,120,${a})`; for (let k = 0; k < 4; k++) { circle(ctx, p.x + Math.cos(k * 1.6 + p.max) * (1 - a) * 10, p.y + Math.sin(k * 1.6) * (1 - a) * 8, 1.4); ctx.fill(); } }
    else if (p.kind === 'note') { ctx.fillStyle = `rgba(196,106,154,${a})`; ctx.font = '700 14px Nunito, system-ui'; ctx.fillText('♪', p.x + Math.sin(p.life * 4) * 4, p.y); }
    else if (p.kind === 'heart') { ctx.save(); ctx.globalAlpha = a * 0.8; drawIcon(ctx, 'heart', p.x, p.y, 4); ctx.restore(); }
    else if (p.kind === 'sweat') { ctx.fillStyle = `rgba(150,200,255,${a})`; ellipse(ctx, p.x, p.y + (1 - a) * 6, 1.6, 2.6); ctx.fill(); }
    else if (p.kind === 'butterfly') {
      p.vx = Math.sin(TIME * 1.3 + p.max * 10 + i) * 24; p.vy = Math.cos(TIME * 1.1 + i) * 14;
      const fl = Math.abs(Math.sin(TIME * 14 + i)) * 4 + 1;
      ctx.fillStyle = col(p.c, Math.min(1, a * 3));
      ellipse(ctx, p.x - fl / 2 - 1, p.y - 20, fl, 3); ctx.fill(); ellipse(ctx, p.x + fl / 2 + 1, p.y - 20, fl, 3); ctx.fill();
    } else if (p.kind === 'firefly') {
      p.vx = Math.sin(TIME + i) * 8; p.vy = Math.cos(TIME * 0.8 + i) * 6;
      const glow = (0.5 + 0.5 * Math.sin(TIME * 3 + i)) * Math.min(1, a * 2);
      ctx.fillStyle = `rgba(230,255,140,${glow})`; circle(ctx, p.x, p.y - 16, 1.8); ctx.fill();
      LIGHTS.push({ x: p.x, y: p.y - 16, r: 14, c: [200, 255, 120], a: glow * 0.5 });
    } else if (p.kind === 'rain') { ctx.strokeStyle = 'rgba(200,220,240,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 4, p.y + 14); ctx.stroke(); }
    else if (p.kind === 'leaf') { ctx.fillStyle = col(p.c, Math.min(1, a * 2)); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(TIME * 3 + i); ellipse(ctx, 0, 0, 4, 2); ctx.fill(); ctx.restore(); p.vy = 16 + Math.sin(TIME * 2 + i) * 10; }
    else if (p.kind === 'confetti') { p.vy += 60 * dt; ctx.fillStyle = col(p.c, a); ctx.fillRect(p.x, p.y, 4, 3); }
  }
}

// ----- light -----
const LIGHTS = [];
function lightLevel() {
  const m = S.minute % 1440;
  if (m < 5 * 60) return 1;
  if (m < 6.75 * 60) return 1 - (m - 300) / 105;
  if (m < 17.6 * 60) return 0;
  if (m < 20.2 * 60) return (m - 17.6 * 60) / (2.6 * 60);
  return 1;
}
const TINT_KEYS = [
  [0, '#1a2550', 0.62], [300, '#1a2550', 0.62], [365, '#6a5a92', 0.38], [420, '#ffae6e', 0.16], [540, '#fff0d0', 0.05],
  [960, '#ffe2b4', 0.06], [1060, '#ff9c58', 0.2], [1150, '#9a5a8a', 0.34], [1230, '#2a2d62', 0.55], [1440, '#1a2550', 0.62],
];
function tintAt(m) {
  for (let i = 0; i < TINT_KEYS.length - 1; i++) {
    const [a, ca, aa] = TINT_KEYS[i], [b, cb, ab] = TINT_KEYS[i + 1];
    if (m >= a && m <= b) { const t = (m - a) / (b - a); return { c: mixHex(ca, cb, t), a: lerp(aa, ab, t) }; }
  }
  return { c: '#ffffff', a: 0 };
}
function drawLighting(view) {
  const m = S.minute % 1440;
  const tint = tintAt(m);
  let a = tint.a;
  if (S.weather === 'cloudy') a += 0.05; if (S.weather === 'rain' || S.weather === 'storm') a += 0.12;
  const mul = mixHex('#ffffff', tint.c, clamp(a * 1.35, 0, 1));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = mul; ctx.fillRect(0, 0, cvs.width, cvs.height);
  if (S.weather !== 'sunny') { ctx.fillStyle = S.weather === 'cloudy' ? '#eef0f2' : '#d2d6dc'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
  ctx.globalCompositeOperation = 'source-over';
  // haze of a tired town
  ctx.fillStyle = `rgba(150,158,172,${0.08 * (1 - S.warmth)})`; ctx.fillRect(0, 0, cvs.width, cvs.height);
  // warm glow of a living one
  if (S.warmth > 0.3 && m > 6 * 60 && m < 19.5 * 60) {
    const g = ctx.createRadialGradient(cvs.width * 0.2, -cvs.height * 0.1, 0, cvs.width * 0.2, -cvs.height * 0.1, cvs.width);
    g.addColorStop(0, `rgba(255,214,140,${0.16 * (S.warmth - 0.3)})`); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, cvs.width, cvs.height); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // lights
  const L = lightLevel();
  if (L > 0.02) {
    collectLights();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of LIGHTS) {
      if (l.x < view.x0 - 100 || l.x > view.x1 + 100 || l.y < view.y0 - 100 || l.y > view.y1 + 200) continue;
      const amp = (l.a || 0.5) * L;
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      const [r, gg, b] = l.c || [255, 190, 110];
      g.addColorStop(0, `rgba(${r},${gg},${b},${amp})`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.restore();
  }
  LIGHTS.length = 0;
  // vignette
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(cvs.width / 2, cvs.height / 2, Math.min(cvs.width, cvs.height) * 0.35, cvs.width / 2, cvs.height / 2, Math.max(cvs.width, cvs.height) * 0.75);
  vg.addColorStop(0, 'rgba(20,16,30,0)'); vg.addColorStop(1, `rgba(20,16,30,${0.28 - S.warmth * 0.1})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.restore();
}
function collectLights() {
  for (const p of PROPS) if (p.kind === 'lamp') LIGHTS.push({ x: p.x, y: p.y - 58, r: 90, a: 0.42 });
  for (const id of RES_IDS) {
    const b = BUILDINGS[RES[id].home];
    const lit = homeLit(id);
    if (lit) LIGHTS.push({ x: b.x + b.w / 2, y: b.y + b.d - b.h / 2, r: 110, a: 0.38, c: lit === 'blue' ? [120, 170, 255] : [255, 180, 100] });
  }
  LIGHTS.push({ x: 1520, y: 960, r: 80, a: 0.3 });
  if (online('workshop')) LIGHTS.push({ x: 1725, y: 940, r: 120, a: 0.4, c: [255, 200, 130] });
  if (online('compute')) LIGHTS.push({ x: 175, y: 1080, r: 110, a: 0.35, c: [140, 255, 200] });
  if (online('greenhouse')) LIGHTS.push({ x: 960, y: 1300, r: 120, a: 0.32, c: [200, 140, 255] });
  if (S.projects.solar.upgrades.canopy) for (let i = 0; i < 6; i++) LIGHTS.push({ x: 1070 + i * 32, y: 940, r: 40, a: 0.5, c: [255, 220, 150] });
  if (S.creations.kitchen.status === 'built') LIGHTS.push({ x: 1440, y: 640, r: 150, a: 0.45, c: [255, 190, 110] });
  if (S.creations.pavilion.status === 'built') LIGHTS.push({ x: 880, y: 960, r: 140, a: 0.45, c: [255, 200, 140] });
  if (S.creations.garden.status === 'built') for (let i = 0; i < 5; i++) LIGHTS.push({ x: 1760 + i * 28, y: 400 - i * 12, r: 40, a: 0.5, c: [255, 210, 140] });
  if (S.warmth > 0.6) for (let i = 0; i < 8; i++) LIGHTS.push({ x: 1000 + i * 42, y: 720 + Math.sin(i) * 6, r: 30, a: 0.45, c: [255, 210, 140] });
}

// ----- overlays: markers, labels, bubbles -----
function drawOverlays() {
  const objs = objectives();
  const main = objs.find(o => o.target && !o.side) || objs.find(o => o.target);
  if (main && main.target && !UI.cutscene) {
    const t = main.target;
    const by = Math.sin(TIME * 3) * 4;
    const sp = worldToScreen(t.x, t.y);
    const on = sp.x > 30 && sp.x < VW - 30 && sp.y > 60 && sp.y < VH - 30;
    if (on) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,214,110,0.95)'; ctx.strokeStyle = 'rgba(80,50,20,0.6)'; ctx.lineWidth = 1.5;
      const yy = t.y - 78 + by;
      ctx.beginPath(); ctx.moveTo(t.x, yy + 14); ctx.lineTo(t.x - 9, yy); ctx.lineTo(t.x - 4, yy); ctx.lineTo(t.x - 4, yy - 10); ctx.lineTo(t.x + 4, yy - 10); ctx.lineTo(t.x + 4, yy); ctx.lineTo(t.x + 9, yy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `rgba(255,214,110,${0.5 + 0.3 * Math.sin(TIME * 3)})`; ctx.lineWidth = 2;
      ellipse(ctx, t.x, t.y + 2, 22 + Math.sin(TIME * 3) * 3, 8); ctx.stroke();
      ctx.restore();
    } else {
      UI.offscreen = { x: sp.x, y: sp.y };
    }
    if (on) UI.offscreen = null;
  } else UI.offscreen = null;
  // interaction ring
  const it = UI.nearby;
  if (it && !UI.dialog) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ellipse(ctx, it.x, it.y + 2, 20, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  // speech bubbles
  for (const id of RES_IDS) {
    const n = NPCS[id];
    if (n.visible && n.bubble) speech(n.x, n.y - 64, n.bubble.text, Math.min(1, n.bubble.t * 2));
    const near = n.visible && dist(n.x, n.y, S.player.x, S.player.y) < 150;
    if (near && !n.bubble && !UI.dialog) nameTag(n.x, n.y + 16, H(id).met ? RES[id].short : '?');
  }
  if (BOT_FX.say && BOT_FX.sayT > 0) speech(S.bot.x, S.bot.y - 52, BOT_FX.say, Math.min(1, BOT_FX.sayT * 2), true);
  // build progress bars
  for (const pid in PROJECTS) { const p = S.projects[pid]; if (p.status === 'building') { const c = lotCenter(PROJECTS[pid].lot); progressBar(c.x, LOTS[PROJECTS[pid].lot].y - 70, 1 - p.buildLeft / p.buildTotal, PROJECTS[pid].name); } }
  for (const cid in CREATIONS) { const p = S.creations[cid]; if (p.status === 'building') { const L = LOTS[CREATIONS[cid].lot]; progressBar(L.x + L.w / 2, L.y - 60, 1 - p.buildLeft / p.buildTotal, CREATIONS[cid].name); } }
}
function speech(x, y, text, a, bot) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = '600 11.5px Nunito, system-ui, sans-serif';
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > 170 && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  const wd = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18, ht = lines.length * 14 + 10;
  ctx.fillStyle = bot ? 'rgba(232,248,252,0.97)' : 'rgba(255,251,242,0.97)'; ctx.strokeStyle = 'rgba(60,40,50,0.25)'; ctx.lineWidth = 1;
  rrect(ctx, x - wd / 2, y - ht, wd, ht, 9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x, y + 6); ctx.lineTo(x + 5, y - 1); ctx.fill();
  ctx.fillStyle = '#2d2633'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, y - ht + 5 + i * 14));
  ctx.restore();
}
function nameTag(x, y, t) {
  ctx.save(); ctx.font = '700 11px Nunito, system-ui'; const w = ctx.measureText(t).width + 12;
  ctx.fillStyle = 'rgba(24,36,40,0.72)'; rrect(ctx, x - w / 2, y, w, 16, 8); ctx.fill();
  ctx.fillStyle = '#fbf3e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 8.5); ctx.restore();
}
function progressBar(x, y, p, label) {
  ctx.save(); ctx.font = '700 11px Nunito, system-ui';
  ctx.fillStyle = 'rgba(24,36,40,0.78)'; rrect(ctx, x - 70, y - 16, 140, 30, 9); ctx.fill();
  ctx.fillStyle = '#fbf3e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; rrect(ctx, x - 60, y + 4, 120, 5, 3); ctx.fill();
  ctx.fillStyle = '#f2b955'; rrect(ctx, x - 60, y + 4, Math.max(5, 120 * clamp(p, 0, 1)), 5, 3); ctx.fill();
  ctx.restore();
}

// portrait for dialogue + ledger
function drawPortrait(canvas, id, mood) {
  const c = canvas.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 72, h = canvas.clientHeight || 72;
  canvas.width = w * d; canvas.height = h * d;
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  const saveG = GRADE; GRADE = 20;
  if (id === 'bolt') drawBot(c, w / 2, h * 1.02, S.bot.color, { t: TIME, facing: 1 });
  else if (id === 'you') drawPerson(c, w / 2, h * 1.55, S.player.look, { mood: mood || 'happy', scale: 1.9, facing: 1 });
  else drawPerson(c, w / 2, h * 1.55, resLook(id), { mood: mood || 'neutral', scale: 1.9, facing: -1 });
  GRADE = saveG;
}
