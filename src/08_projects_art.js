// ---------- projects, creations, helper robots ----------
const WORKERS = [];
let FERRY_PATH = null;

function pathLen(p) { let d = 0; for (let i = 1; i < p.length; i++) d += dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y); return d; }
function pathAt(p, s) {
  for (let i = 1; i < p.length; i++) {
    const d = dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y);
    if (s <= d) { const t = s / d; return { x: lerp(p[i - 1].x, p[i].x, t), y: lerp(p[i - 1].y, p[i].y, t), dx: p[i].x - p[i - 1].x }; }
    s -= d;
  }
  const l = p[p.length - 1]; return { x: l.x, y: l.y, dx: 0 };
}

function updateWorkers() {
  WORKERS.length = 0;
  const m = S.minute % 1440;
  const day = m > 6.5 * 60 && m < 20 * 60;
  const site = (lot, n, color) => {
    const L = LOTS[lot];
    for (let i = 0; i < n; i++) {
      const a = TIME * 0.4 + i * 2.1;
      WORKERS.push({ x: L.x + L.w / 2 + Math.cos(a) * L.w * 0.42, y: L.y + L.d + 14 + Math.sin(a * 1.3) * 12, color, carry: i % 2 === 0, facing: Math.sin(a) > 0 ? -1 : 1, seed: i, visible: true });
      if (Math.random() < 0.05) spawn('spark', L.x + L.w / 2 + Math.cos(a) * L.w * 0.42, L.y + L.d - 10, { life: 0.5 });
    }
  };
  for (const pid in PROJECTS) if (S.projects[pid].status === 'building') site(PROJECTS[pid].lot, 3, '#e8b23a');
  for (const cid in CREATIONS) if (S.creations[cid].status === 'building') site(CREATIONS[cid].lot, S.creations[cid].approach === 'hand' ? 1 : 3, '#e8b23a');
  if (online('workshop') && day) {
    if (!FERRY_PATH) { FERRY_PATH = findPath(1700, 1012, 1150, 1600); FERRY_PATH.unshift({ x: 1700, y: 1012 }); }
    const len = pathLen(FERRY_PATH);
    const n = S.projects.workshop.upgrades.bay ? 3 : 2;
    for (let i = 0; i < n; i++) {
      let s = (TIME * 34 + i * len * 0.66) % (len * 2);
      const back = s > len; if (back) s = len * 2 - s;
      const p = pathAt(FERRY_PATH, s);
      WORKERS.push({ x: p.x, y: p.y, color: '#4fb3a8', carry: !back, facing: (back ? -p.dx : p.dx) > 0 ? 1 : -1, seed: i + 5, visible: true });
    }
  }
  if (online('solar') && day) {
    const L = LOTS.solar; const r = Math.floor(TIME / 12) % 3;
    const t = (TIME % 12) / 12;
    WORKERS.push({ x: L.x + 30 + t * (L.w - 60), y: L.y + 56 + r * 60, color: '#7fb0e0', carry: false, facing: 1, seed: 9, visible: true });
  }
  if (online('greenhouse') && day) {
    const L = LOTS.greenhouse;
    WORKERS.push({ x: L.x + 30 + (Math.sin(TIME * 0.3) * 0.5 + 0.5) * (L.w - 60), y: L.y + L.d + 8, color: '#8ac06a', carry: true, facing: Math.cos(TIME * 0.3) > 0 ? 1 : -1, seed: 11, visible: true });
  }
}

function addProjectItems(items, vis) {
  const P = S.projects;
  // solar
  const sp = P.solar;
  if (sp.status === 'building' || sp.status === 'online') {
    const L = LOTS.solar;
    const prog = sp.status === 'online' ? 1 : 1 - sp.buildLeft / sp.buildTotal + 0.15;
    for (let r = 0; r < 3; r++) items.push({ y: L.y + 50 + r * 60, f: () => drawSolarRow(r, prog, sp) });
    if (sp.upgrades.battery || sp.pending === 'battery') items.push({ y: 1344, f: () => drawBattery(sp.upgrades.battery) });
    if (sp.upgrades.canopy || sp.pending === 'canopy') { items.push({ y: 930, f: () => drawCanopyBack() }); items.push({ y: 1002, f: () => drawCanopyFront(sp.upgrades.canopy) }); }
  }
  const wp = P.workshop;
  if (wp.status === 'building' || wp.status === 'online') items.push({ y: LOTS.workshop.y + LOTS.workshop.d - 4, f: () => drawWorkshop(wp) });
  if (wp.upgrades.bikes) items.push({ y: 1020, f: drawBikeRack });
  const gp = P.greenhouse;
  if (gp.status === 'building' || gp.status === 'online') items.push({ y: LOTS.greenhouse.y + LOTS.greenhouse.d - 24, f: () => drawGreenhouse(gp) });
  if (gp.upgrades.aqua || gp.pending === 'aqua') items.push({ y: 1384, f: drawAqua });
  // creations
  const C = S.creations;
  if (C.kitchen.status === 'built' || C.kitchen.status === 'building') {
    items.push({ y: LOTS.kitchen.y + 50, f: () => drawKitchenBack(C.kitchen) });
    if (C.kitchen.features.includes('table')) items.push({ y: 690, f: () => drawKitchenTable(C.kitchen) });
    if (C.kitchen.features.includes('herbs')) items.push({ y: 702, f: () => drawHerbs(C.kitchen) });
  } else items.push({ y: LOTS.kitchen.y + LOTS.kitchen.d + 4, f: drawBalustrade });
  if (C.garden.status === 'built' || C.garden.status === 'building') items.push({ y: 400, f: () => drawGarden(C.garden) });
  if (C.pavilion.status === 'built' || C.pavilion.status === 'building') items.push({ y: 1010, f: () => drawPavilion(C.pavilion) });
  // salvage sparkles
  for (const k in SALVAGE) if (salvageAvailable(k)) { const p = POI[SALVAGE[k].poi]; items.push({ y: p.y + 1, f: () => sparkle(p.x, p.y - 16) }); }
}

function sparkle(x, y) {
  const s = 1 + Math.sin(TIME * 4) * 0.25;
  ctx.save(); ctx.translate(x, y - 10 + Math.sin(TIME * 2) * 3); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,230,140,0.95)';
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 3 : 9; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  ctx.restore();
  LIGHTS.push({ x, y: y - 10, r: 30, a: 0.6, c: [255, 220, 140] });
}

function panelQuad(x0, x1, yb, yt, inset, glint) {
  const g = ctx.createLinearGradient(0, yt, 0, yb);
  g.addColorStop(0, col('#3e6aa8')); g.addColorStop(1, col('#1f3a66'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.lineTo(x1 - inset, yt); ctx.lineTo(x0 + inset, yt); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = col('#8fb4e0', 0.5); ctx.lineWidth = 1;
  for (let j = 1; j < 3; j++) { const y = lerp(yb, yt, j / 3); const t = j / 3; ctx.beginPath(); ctx.moveTo(lerp(x0, x0 + inset, t), y); ctx.lineTo(lerp(x1, x1 - inset, t), y); ctx.stroke(); }
  const n = Math.max(2, Math.round((x1 - x0) / 18));
  for (let i = 1; i < n; i++) { ctx.beginPath(); ctx.moveTo(lerp(x0, x1, i / n), yb); ctx.lineTo(lerp(x0 + inset, x1 - inset, i / n), yt); ctx.stroke(); }
  if (glint) {
    const gx = x0 + ((TIME * 60 + glint) % ((x1 - x0) + 160)) - 80;
    const gg = ctx.createLinearGradient(gx - 30, 0, gx + 30, 0);
    gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(gx - 30, yt, 60, yb - yt);
  }
  ctx.restore();
  ctx.strokeStyle = col('#c8ced6'); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.lineTo(x1 - inset, yt); ctx.lineTo(x0 + inset, yt); ctx.closePath(); ctx.stroke();
}

function drawSolarRow(r, prog, sp) {
  const L = LOTS.solar;
  const gy = L.y + 50 + r * 60; // ground line of this row
  const x0 = L.x + 20, x1 = L.x + L.w - 20;
  const segs = 5, segW = (x1 - x0) / segs;
  const shown = Math.floor(clamp(prog, 0, 1) * segs * 3 - r * segs);
  const style = sp.style || 'rows';
  const damaged = sp.damaged && r === 1;
  ctx.fillStyle = 'rgba(25,30,40,0.22)'; ctx.fillRect(x0, gy - 6, x1 - x0, 10);
  if (style === 'rows' && S.warmth > 0.2) {
    const R = rng(r + 3);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = col(['#ffd34e', '#f78fb0', '#ffffff', '#b48cf0'][(R() * 4) | 0]); circle(ctx, x0 + R() * (x1 - x0), gy + 6 + R() * 18, 2.2); ctx.fill(); }
  }
  for (let i = 0; i < segs; i++) {
    const sx = x0 + i * segW;
    if (i >= shown) {
      // scaffold for unbuilt segment
      if (sp.status === 'building') {
        ctx.strokeStyle = col('#c8a24a'); ctx.lineWidth = 2;
        ctx.strokeRect(sx + 4, gy - 30, segW - 8, 28);
        ctx.beginPath(); ctx.moveTo(sx + 4, gy - 2); ctx.lineTo(sx + segW - 4, gy - 30); ctx.stroke();
      }
      continue;
    }
    if (style === 'leaf') {
      for (let k = 0; k < 2; k++) {
        const lx = sx + segW * (0.3 + k * 0.4), sway = Math.sin(TIME * 0.8 + i + k) * 1.5;
        ctx.strokeStyle = col('#6a7a5a'); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(lx, gy); ctx.quadraticCurveTo(lx - 8, gy - 20, lx + sway, gy - 34); ctx.stroke();
        ctx.save(); ctx.translate(lx + sway, gy - 40); ctx.rotate((k ? 0.35 : -0.35) + sway * 0.02);
        if (damaged && k === 0) ctx.rotate(1.1);
        const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, col('#4a7ac0')); g.addColorStop(1, col('#1f3a66'));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = col('#e8c25a'); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = col('#9cc0ea', 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0);
        for (let v = -12; v <= 12; v += 6) { ctx.moveTo(v, 0); ctx.lineTo(v + 5, -9); ctx.moveTo(v, 0); ctx.lineTo(v + 5, 9); } ctx.stroke();
        ctx.restore();
      }
    } else if (style === 'pergola') {
      ctx.fillStyle = col('#8a6440'); ctx.fillRect(sx + 3, gy - 46, 5, 46); ctx.fillRect(sx + segW - 8, gy - 46, 5, 46);
      ctx.fillStyle = col('#7a5638'); ctx.fillRect(sx, gy - 50, segW, 5);
      if (!(damaged && i === 2)) panelQuad(sx + 2, sx + segW - 2, gy - 48, gy - 72, 3, i * 50 + r * 30);
      // vines
      ctx.fillStyle = col('#5f9a44'); for (let v = 0; v < 4; v++) { circle(ctx, sx + 8 + v * (segW / 4), gy - 44 + Math.sin(v + i) * 3, 4); ctx.fill(); }
      if (S.warmth > 0.4) { ctx.fillStyle = col('#c45aa0'); circle(ctx, sx + segW * 0.5, gy - 40, 2.2); ctx.fill(); }
    } else {
      ctx.fillStyle = col('#8a929c'); ctx.fillRect(sx + 6, gy - 16, 3, 16); ctx.fillRect(sx + segW - 9, gy - 16, 3, 16);
      if (damaged && (i === 1 || i === 3)) {
        ctx.save(); ctx.translate(sx + segW / 2, gy - 18); ctx.rotate(0.4); panelQuad(-segW / 2 + 4, segW / 2 - 4, 6, -16, 3, 0); ctx.restore();
      } else panelQuad(sx + 1, sx + segW - 1, gy - 12, gy - 38, 4, i * 50 + r * 30);
    }
  }
  if (damaged) { ctx.fillStyle = col('#f2a03a'); ctx.beginPath(); ctx.moveTo(x1 + 8, gy); ctx.lineTo(x1 + 16, gy - 18); ctx.lineTo(x1 + 24, gy); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x1 + 12, gy - 8, 8, 2); }
  if (r === 0 && sp.status === 'online' && sp.option === 'brightline') {
    ctx.fillStyle = col('#2f5fa8'); rrect(ctx, x0 - 6, gy - 66, 96, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 10px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BRIGHTLINE', x0 + 42, gy - 57);
  }
}
function drawBattery(done) {
  const x = 1740, y = 1344;
  ctx.fillStyle = 'rgba(25,30,40,0.2)'; ctx.fillRect(x - 2, y - 4, 70, 8);
  ctx.fillStyle = col('#e2d0b0'); ctx.fillRect(x, y - 40, 64, 40);
  for (let i = 0; i < 4; i++) { const on = done && (TIME * 2 + i) % 4 < 3; ctx.fillStyle = on ? col('#6fdc8c') : col('#5a6a5a'); ctx.fillRect(x + 6 + i * 14, y - 30, 10, 18); }
  roofTiles(x - 6, x + 70, y - 38, y - 56, 10, '#c4643c', 2);
  if (done) LIGHTS.push({ x: x + 32, y: y - 20, r: 40, a: 0.4, c: [120, 255, 160] });
}
function drawCanopyBack() {
  ctx.fillStyle = col('#7a7f88');
  for (const x of [1066, 1150, 1234]) ctx.fillRect(x - 2, 930 - 70, 4, 70);
}
let canopyFade = 1;
function drawCanopyFront(done) {
  ctx.fillStyle = col('#7a7f88');
  for (const x of [1066, 1150, 1234]) ctx.fillRect(x - 2.5, 1002 - 72, 5, 72);
  // see-through when someone stands underneath, so the plaza never hides the player
  const P = S.player, under = P && P.x > 1040 && P.x < 1260 && P.y > 830 && P.y < 1004;
  canopyFade = lerp(canopyFade, under ? 0.3 : 1, 0.12);
  ctx.save(); ctx.globalAlpha = (done ? 0.82 : 0.5) * canopyFade;
  panelQuad(1056, 1244, 1002 - 70, 930 - 74, 0, 120);
  ctx.restore();
  if (done && S.warmth > 0.3) {
    for (let i = 0; i < 12; i++) { const x = 1060 + i * 16; ctx.fillStyle = ['#ffd36a', '#ff9a6a', '#9fe0ff', '#ffb0d0'][i % 4]; circle(ctx, x, 1002 - 66 + Math.sin(i * 0.9) * 3, 2.2); ctx.fill(); }
  }
}
function drawWorkshop(wp) {
  const L = LOTS.workshop;
  const x = L.x, w = L.w, front = L.y + L.d - 4, h = 112;
  const prog = wp.status === 'online' ? 1 : clamp(1 - wp.buildLeft / wp.buildTotal + 0.25, 0, 1);
  const top = front - h * prog;
  ctx.fillStyle = 'rgba(30,25,40,0.2)'; ctx.fillRect(x - 4, front - 3, w + 8, 8);
  const glass = wp.style === 'glass';
  if (glass) {
    ctx.fillStyle = col('#e8e4dc'); ctx.fillRect(x, top, w, front - top);
    ctx.fillStyle = col('#9fc0d0', 0.75); ctx.fillRect(x + 8, Math.max(top + 10, front - 92), w - 16, Math.min(80, front - top - 12));
  } else {
    ctx.fillStyle = col('#a8583c'); ctx.fillRect(x, top, w, front - top);
    ctx.strokeStyle = col('#8a4430'); ctx.lineWidth = 1;
    for (let yy = front; yy > top; yy -= 7) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); for (let xx = x + ((front - yy) / 7 % 2) * 7; xx < x + w; xx += 14) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 7); ctx.stroke(); } }
  }
  if (prog >= 1) {
    // bays with robots working inside
    const bays = wp.upgrades.bay ? 2 : 1;
    for (let b = 0; b < bays; b++) {
      const bx = x + 16 + b * 92, bw = bays === 2 ? 76 : 100;
      ctx.fillStyle = col('#3a3230'); ctx.fillRect(bx, front - 70, bw, 66);
      ctx.fillStyle = 'rgba(255,200,130,0.5)'; ctx.fillRect(bx + 3, front - 66, bw - 6, 62);
      for (let k = 0; k < 2; k++) {
        const rx = bx + 16 + ((Math.sin(TIME * 0.7 + k * 2 + b) * 0.5 + 0.5) * (bw - 32));
        ctx.fillStyle = col(k ? '#4fb3a8' : '#e8b23a'); rrect(ctx, rx - 8, front - 30, 16, 16, 4); ctx.fill();
        ctx.fillStyle = '#9ff0ff'; ctx.fillRect(rx - 4, front - 26, 8, 3);
        if (Math.random() < 0.04) spawn('spark', rx + 8, front - 20, { life: 0.4 });
      }
      ctx.fillStyle = col('#6a6f78'); ctx.fillRect(bx, front - 74, bw, 5);
    }
    if (!wp.upgrades.bay) { ctx.fillStyle = col('#9fc0d0'); ctx.fillRect(x + 128, front - 66, 40, 34); ctx.strokeStyle = col('#e8e4dc'); ctx.lineWidth = 2; ctx.strokeRect(x + 128, front - 66, 40, 34); }
    // roof
    if (glass) {
      ctx.fillStyle = col('#d8d4cc'); ctx.fillRect(x - 8, top - 8, w + 16, 10);
      panelQuad(x, x + w, top - 8, top - 30, 12, 40);
    } else {
      const g = ctx.createLinearGradient(0, top - 44, 0, top + 6);
      g.addColorStop(0, col('#6fb0a0')); g.addColorStop(1, col('#4a8a7c'));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 12, top + 6); ctx.lineTo(x + w + 12, top + 6); ctx.lineTo(x + w - 24, top - 44); ctx.lineTo(x + 24, top - 44); ctx.fill();
      ctx.strokeStyle = col('#3f7a6c'); ctx.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(lerp(x - 12, x + w + 12, i / 16), top + 6); ctx.lineTo(lerp(x + 24, x + w - 24, i / 16), top - 44); ctx.stroke(); }
    }
    ctx.fillStyle = col('#2f2a28'); rrect(ctx, x + w / 2 - 66, top + 8, 132, 18, 4); ctx.fill();
    ctx.fillStyle = col('#8ff4e0'); ctx.font = '800 10.5px Nunito, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VALLEY REPAIR CO-OP', x + w / 2, top + 17);
  } else {
    ctx.strokeStyle = col('#c8a24a'); ctx.lineWidth = 2.5;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 4, front); ctx.lineTo(x + i * w / 4, front - h); ctx.stroke(); }
    for (let j = 1; j <= 3; j++) { ctx.beginPath(); ctx.moveTo(x, front - j * h / 3); ctx.lineTo(x + w, front - j * h / 3); ctx.stroke(); }
  }
}
function drawBikeRack() {
  const cols2 = ['#e0503a', '#4fa3c4', '#e8c25a', '#8ac06a'];
  for (let i = 0; i < 4; i++) {
    const x = 1640 + i * 40, y = 1018;
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(ctx, x + 12, y, 18, 3); ctx.fill();
    ctx.strokeStyle = col('#2f2a28'); ctx.lineWidth = 2; circle(ctx, x, y - 6, 6); ctx.stroke(); circle(ctx, x + 24, y - 6, 6); ctx.stroke();
    ctx.strokeStyle = col(cols2[i]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 10, y - 16); ctx.lineTo(x + 24, y - 6); ctx.moveTo(x + 10, y - 16); ctx.lineTo(x + 20, y - 18); ctx.stroke();
    ctx.fillStyle = col('#a8845a'); ctx.fillRect(x - 6, y - 18, 12, 8);
  }
}
function drawGreenhouse(gp) {
  const L = LOTS.greenhouse;
  const x0 = L.x + 10, x1 = L.x + L.w - 10, front = L.y + L.d - 24, h = 70;
  const prog = gp.status === 'online' ? 1 : clamp(1 - gp.buildLeft / gp.buildTotal + 0.25, 0, 1);
  ctx.fillStyle = 'rgba(30,25,40,0.18)'; ctx.fillRect(x0, front - 3, x1 - x0, 8);
  // beds inside
  ctx.fillStyle = col('#6b4a32'); ctx.fillRect(x0 + 6, front - 18, x1 - x0 - 12, 14);
  const R = rng(17);
  for (let i = 0; i < 18 * prog; i++) {
    const px = x0 + 12 + i * ((x1 - x0 - 24) / 18);
    ctx.fillStyle = col('#4f8a3a'); circle(ctx, px, front - 20, 6); ctx.fill(); circle(ctx, px + 3, front - 30, 5); ctx.fill();
    if (gp.status === 'online') { ctx.fillStyle = col(['#e0503a', '#f2a03a', '#c45aa0', '#f2d24a'][(R() * 4) | 0]); circle(ctx, px + (R() - 0.5) * 6, front - 26 + (R() - 0.5) * 8, 2.4); ctx.fill(); }
  }
  const dome = gp.style === 'dome';
  ctx.save(); ctx.globalAlpha = 0.9;
  if (dome) {
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = h * prog + 10;
    ctx.fillStyle = col('#cfe8f0', 0.35); ctx.beginPath(); ctx.ellipse(cx, front, rx, ry, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = col('#ffffff'); ctx.lineWidth = 1.6;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx, front, rx * (k / 4), ry, 0, Math.PI, 0); ctx.stroke(); }
    for (let k = 1; k < 3; k++) { const yy = front - ry * k / 3; const ww = rx * Math.sqrt(1 - (k / 3) ** 2); ctx.beginPath(); ctx.moveTo(cx - ww, yy); ctx.lineTo(cx + ww, yy); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(cx, front, rx, ry, 0, Math.PI, 0); ctx.stroke();
  } else {
    const n = 5, aw = (x1 - x0) / n;
    ctx.fillStyle = col('#cfe8f0', 0.32);
    ctx.fillRect(x0, front - h * prog, x1 - x0, h * prog);
    ctx.strokeStyle = col('#ffffff'); ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const ax = x0 + i * aw;
      ctx.beginPath(); ctx.moveTo(ax, front); ctx.lineTo(ax, front - h * prog * 0.7); ctx.quadraticCurveTo(ax + aw / 2, front - h * prog * 1.25, ax + aw, front - h * prog * 0.7); ctx.lineTo(ax + aw, front); ctx.stroke();
      ctx.fillStyle = col('#e4f4f8', 0.3); ctx.beginPath(); ctx.moveTo(ax, front - h * prog * 0.7); ctx.quadraticCurveTo(ax + aw / 2, front - h * prog * 1.25, ax + aw, front - h * prog * 0.7); ctx.fill();
    }
    ctx.lineWidth = 1; for (let yy = front - 12; yy > front - h * prog * 0.7; yy -= 14) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  }
  ctx.restore();
  if (gp.status === 'online') {
    // gantry arm
    const ax = x0 + 20 + (Math.sin(TIME * 0.5) * 0.5 + 0.5) * (x1 - x0 - 40);
    ctx.strokeStyle = col('#8a929c'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, front - 50); ctx.lineTo(x1, front - 50); ctx.moveTo(ax, front - 50); ctx.lineTo(ax, front - 34); ctx.stroke();
    if (Math.sin(TIME * 2) > 0.6) { ctx.fillStyle = 'rgba(150,200,255,0.6)'; for (let k = 0; k < 3; k++) { circle(ctx, ax + (k - 1) * 3, front - 30 + ((TIME * 30 + k * 5) % 10), 1.2); ctx.fill(); } }
  }
}
function drawAqua() {
  for (let i = 0; i < 2; i++) {
    const x = 880 + i * 46, y = 1384;
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ellipse(ctx, x + 18, y, 22, 5); ctx.fill();
    ctx.fillStyle = col('#7a8a96'); ctx.fillRect(x, y - 26, 38, 26);
    ctx.fillStyle = col('#4f9fc0'); ctx.fillRect(x + 3, y - 23, 32, 18);
    const fx = x + 6 + ((TIME * 10 + i * 13) % 24);
    ctx.fillStyle = col('#f2a03a'); ellipse(ctx, fx, y - 14, 3.5, 2); ctx.fill();
    ctx.fillStyle = col('#4f8a3a'); for (let k = 0; k < 4; k++) { circle(ctx, x + 5 + k * 9, y - 28, 5); ctx.fill(); }
  }
}

// ----- creations -----
function styleColors(style) {
  if (style === 'cottage') return { wall: '#e8d8b8', beam: '#7a5638', roof: '#6f8a4a', accent: '#d96a5a' };
  if (style === 'future') return { wall: '#f4f2ee', beam: '#c8d0d8', roof: '#e8eef2', accent: '#4fb3d8' };
  return { wall: '#e2c39a', beam: '#a8845a', roof: '#c4643c', accent: '#c45a3a' };
}
function buildProgress(c) { return c.status === 'built' ? 1 : clamp(1 - c.buildLeft / c.buildTotal + 0.25, 0, 1); }
function scaffold(x, y, w, h) {
  ctx.strokeStyle = col('#c8a24a'); ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 4, y); ctx.lineTo(x + i * w / 4, y - h); ctx.stroke(); }
  for (let j = 1; j <= 3; j++) { ctx.beginPath(); ctx.moveTo(x, y - j * h / 3); ctx.lineTo(x + w, y - j * h / 3); ctx.stroke(); }
}
function drawBalustrade() {
  const K = LOTS.kitchen;
  ctx.fillStyle = col('#d9c6a3');
  ctx.fillRect(K.x, K.y + K.d - 12, 90, 5); ctx.fillRect(K.x + K.w - 90, K.y + K.d - 12, 90, 5);
  for (let x = K.x + 4; x < K.x + 90; x += 10) { ctx.fillRect(x, K.y + K.d - 8, 5, 12); }
  for (let x = K.x + K.w - 86; x < K.x + K.w; x += 10) { ctx.fillRect(x, K.y + K.d - 8, 5, 12); }
}
function drawKitchenBack(k) {
  const K = LOTS.kitchen, sc = styleColors(k.style);
  const x0 = K.x + 30, x1 = K.x + K.w - 30, base = K.y + 50, h = 92;
  const p = buildProgress(k);
  drawBalustrade();
  ctx.fillStyle = 'rgba(30,25,40,0.18)'; ctx.fillRect(x0 - 4, base - 3, x1 - x0 + 8, 8);
  if (p < 1) { ctx.fillStyle = col(sc.wall); ctx.fillRect(x0, base - h * p * 0.8, x1 - x0, h * p * 0.8); scaffold(x0, base, x1 - x0, h); return; }
  const lit = lightLevel() > 0.2;
  if (k.style === 'future') {
    ctx.fillStyle = col('#9fd0e8', 0.6); ctx.fillRect(x0 + 6, base - h + 20, x1 - x0 - 12, h - 22);
    ctx.strokeStyle = col('#ffffff'); ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const ax = x0 + i * (x1 - x0) / 3; ctx.beginPath(); ctx.moveTo(ax, base); ctx.lineTo(ax, base - h + 30); ctx.stroke(); }
    ctx.fillStyle = col(sc.roof); ctx.beginPath(); ctx.moveTo(x0 - 24, base - h + 26); ctx.quadraticCurveTo((x0 + x1) / 2, base - h - 30, x1 + 24, base - h + 26); ctx.quadraticCurveTo((x0 + x1) / 2, base - h, x0 - 24, base - h + 26); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = col('#3e6aa8'); ctx.fillRect(x0 + 10 + i * 28, base - h - 6 - Math.sin(i / 5 * Math.PI) * 12, 18, 5); }
  } else {
    // back wall with three arches (villa) or timber frame (cottage)
    wallRect(x0, base - h, x1 - x0, h, sc.wall, 77);
    if (k.style === 'cottage') {
      ctx.strokeStyle = col(sc.beam); ctx.lineWidth = 5;
      ctx.beginPath(); for (let i = 0; i <= 4; i++) { const bx = x0 + i * (x1 - x0) / 4; ctx.moveTo(bx, base - h); ctx.lineTo(bx, base - 12); } ctx.moveTo(x0, base - h / 2); ctx.lineTo(x1, base - h / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, base - h); ctx.lineTo(x0 + (x1 - x0) / 4, base - h / 2); ctx.moveTo(x1, base - h); ctx.lineTo(x1 - (x1 - x0) / 4, base - h / 2); ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const ax = x0 + 22 + i * ((x1 - x0 - 44) / 3), aw = (x1 - x0 - 44) / 3 - 12;
      if (k.style === 'villa') {
        ctx.fillStyle = lit ? 'rgba(255,190,110,0.9)' : col('#5a4a40'); ctx.beginPath(); ctx.moveTo(ax, base - 12); ctx.lineTo(ax, base - 56); ctx.arc(ax + aw / 2, base - 56, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, base - 12); ctx.fill();
      } else windowAt(ax + aw / 2 - 13, base - 66, 26, 30, sc.accent, lit, { flowers: true });
    }
    if (k.features.includes('mural')) {
      const mx = x0 + 10, my = base - h + 8;
      const cs = ['#e0874a', '#8aa45a', '#6f8fd0', '#c46a9a', '#e8c25a'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = col(cs[i], 0.85); circle(ctx, mx + 18 + i * 34, my + 12, 9); ctx.fill(); ctx.fillRect(mx + 11 + i * 34, my + 18, 14, 10); }
      ctx.strokeStyle = col('#e8c25a'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my + 32); ctx.quadraticCurveTo(mx + 90, my + 22, mx + 180, my + 32); ctx.stroke();
    }
    const roof = k.style === 'cottage' ? sc.roof : sc.roof;
    roofTiles(x0 - 16, x1 + 16, base - h + 4, base - h - 34, 18, roof, 4);
    if (k.style === 'cottage') { ctx.fillStyle = col('#8ac06a', 0.5); for (let i = 0; i < 12; i++) { circle(ctx, x0 + i * 16, base - h - 4 - Math.sin(i) * 3, 5); ctx.fill(); } }
    vines(x0, base - h, x1 - x0, h, k.style === 'villa' ? 0.9 : 0.6, 13);
  }
  if (k.features.includes('oven')) {
    const ox = x1 + 4, oy = base + 6;
    ctx.fillStyle = col('#a8583c'); ctx.beginPath(); ctx.ellipse(ox, oy - 18, 22, 26, 0, Math.PI, 0); ctx.lineTo(ox + 22, oy); ctx.lineTo(ox - 22, oy); ctx.fill();
    ctx.strokeStyle = col('#8a4430'); ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(ox, oy - 18, 22, 26 * i / 4, 0, Math.PI, 0); ctx.stroke(); }
    ctx.fillStyle = lightLevel() > 0.1 || currentBlock('mara').act === 'bake' ? '#ffb050' : col('#2f2a28'); ctx.beginPath(); ctx.ellipse(ox, oy - 4, 8, 10, 0, Math.PI, 0); ctx.fill();
    if (currentBlock('mara').act === 'bake' && Math.random() < 0.2) spawn('smoke', ox, oy - 46, { vx: 3, vy: -12, life: 3, bread: true });
    LIGHTS.push({ x: ox, y: oy - 8, r: 50, a: 0.5, c: [255, 170, 80] });
  }
}
function drawKitchenTable(k) {
  if (buildProgress(k) < 1) return;
  const x0 = 1378, x1 = 1504, y = 690;
  ctx.fillStyle = 'rgba(30,25,40,0.18)'; ctx.fillRect(x0 - 4, y - 2, x1 - x0 + 8, 6);
  ctx.fillStyle = col('#8a6440'); ctx.fillRect(x0 + 4, y - 16, 4, 16); ctx.fillRect(x1 - 8, y - 16, 4, 16);
  ctx.fillStyle = col(k.style === 'future' ? '#e8eef2' : '#a8784a'); ctx.fillRect(x0, y - 22, x1 - x0, 8);
  ctx.fillStyle = col('#f3ead8'); ctx.fillRect(x0 + 4, y - 23, x1 - x0 - 8, 3);
  const bfast = UI.breakfast || RES_IDS.some(id => currentBlock(id).act === 'breakfast');
  if (bfast || S.flags.breakfastDone) {
    ctx.fillStyle = col('#d9954a'); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x0 + 20 + i * 40, y - 25, 9, 5, 0, 0, TAU); ctx.fill(); }
    if (bfast) { ctx.fillStyle = col('#c4343e'); for (let i = 0; i < 2; i++) { ctx.fillRect(x0 + 38 + i * 40, y - 30, 6, 7); } ctx.fillStyle = col('#ffffff'); ctx.fillRect(x0 + 100, y - 31, 9, 8); }
  }
}
function drawHerbs(k) {
  if (buildProgress(k) < 1) return;
  for (let i = 0; i < 5; i++) {
    const x = 1336 + i * 20, y = 702;
    ctx.fillStyle = col('#b0603e'); ctx.fillRect(x - 7, y - 12, 14, 12);
    ctx.fillStyle = col(i % 2 ? '#5f9a44' : '#7fb05a'); circle(ctx, x, y - 16, 7); ctx.fill();
    if (i === 2) { ctx.fillStyle = col('#4f7f36'); circle(ctx, x, y - 26, 10); ctx.fill(); ctx.fillStyle = col('#ffd84a'); circle(ctx, x - 3, y - 28, 2.4); ctx.fill(); circle(ctx, x + 4, y - 23, 2.4); ctx.fill(); }
  }
}
function drawGarden(g) {
  const L = LOTS.garden, sc = styleColors(g.style);
  const p = buildProgress(g);
  if (g.features.includes('meadow') && p >= 1) {
    const R = rng(88);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = col(['#ffd34e', '#f78fb0', '#ffffff', '#b48cf0', '#ff8f5a'][(R() * 5) | 0]); circle(ctx, L.x + R() * L.w, L.y + 40 + R() * (L.d - 30), 2.4); ctx.fill(); }
  }
  if (g.features.includes('stones')) for (let i = 0; i < 6; i++) { ctx.fillStyle = col('#c8c0b0'); ellipse(ctx, L.x + 20 + i * 24, L.y + L.d - 6 - i * 8, 9, 5); ctx.fill(); }
  if (p < 1) { scaffold(L.x + 40, L.y + 90, 80, 60); return; }
  // arbor with bench
  const ax = L.x + 60, ay = L.y + 86;
  ctx.fillStyle = col(sc.beam); ctx.fillRect(ax - 30, ay - 60, 5, 60); ctx.fillRect(ax + 25, ay - 60, 5, 60);
  if (g.style === 'future') { ctx.strokeStyle = col('#ffffff'); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ax, ay - 56, 30, Math.PI, 0); ctx.stroke(); }
  else if (g.style === 'cottage') { ctx.strokeStyle = col(sc.beam); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ax, ay - 56, 28, Math.PI, 0); ctx.stroke(); ctx.fillStyle = col('#e46a7a'); for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; circle(ctx, ax + Math.cos(a) * 28, ay - 56 + Math.sin(a) * 28, 3.5); ctx.fill(); } }
  else { ctx.fillStyle = col(sc.wall); ctx.fillRect(ax - 34, ay - 66, 68, 8); vines(ax - 30, ay - 66, 60, 66, 0.9, 5); }
  if (g.features.includes('bench')) { ctx.fillStyle = col('#9a6e48'); ctx.fillRect(ax - 22, ay - 14, 44, 5); ctx.fillRect(ax - 22, ay - 26, 44, 4); ctx.fillStyle = col('#5a4a3a'); ctx.fillRect(ax - 20, ay - 10, 3, 10); ctx.fillRect(ax + 17, ay - 10, 3, 10); }
  if (g.features.includes('lanterns')) for (let i = 0; i < 5; i++) {
    const lx = L.x + 20 + i * 28, ly = L.y + 100 - i * 12;
    ctx.fillStyle = col('#5a4a3a'); ctx.fillRect(lx - 1, ly - 22, 2, 22);
    ctx.fillStyle = lightLevel() > 0.2 ? '#ffd88a' : col('#e8d8b0'); ctx.fillRect(lx - 4, ly - 30, 8, 9);
  }
}
function drawPavilion(pv) {
  const L = LOTS.pavilion, sc = styleColors(pv.style);
  const cx = L.x + L.w / 2, cy = L.y + 50;
  const p = buildProgress(pv);
  if (pv.features.includes('floor')) { ctx.fillStyle = col('#d8c4a0'); ellipse(ctx, cx, cy + 40, 70, 18); ctx.fill(); ctx.strokeStyle = col('#b89a72'); ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 18, cy + 24); ctx.lineTo(cx + i * 20, cy + 56); ctx.stroke(); } }
  ctx.fillStyle = col('#b89a72'); ellipse(ctx, cx, cy, 62, 26); ctx.fill();
  ctx.fillStyle = col('#d9c6a3'); ellipse(ctx, cx, cy - 6, 62, 26); ctx.fill();
  if (p < 1) { scaffold(cx - 50, cy, 100, 80); return; }
  ctx.fillStyle = col(sc.beam);
  for (const dx of [-50, -18, 18, 50]) ctx.fillRect(cx + dx - 3, cy - 86, 6, 80);
  if (pv.style === 'future') { ctx.fillStyle = col('#f4f2ee'); ctx.beginPath(); ctx.moveTo(cx - 78, cy - 80); ctx.quadraticCurveTo(cx, cy - 140, cx + 78, cy - 80); ctx.quadraticCurveTo(cx, cy - 104, cx - 78, cy - 80); ctx.fill(); }
  else { ctx.fillStyle = col(sc.roof); ctx.beginPath(); ctx.moveTo(cx - 74, cy - 80); ctx.lineTo(cx + 74, cy - 80); ctx.lineTo(cx, cy - 130); ctx.closePath(); ctx.fill(); ctx.strokeStyle = col(shade(sc.roof, -0.25)); ctx.lineWidth = 1.2; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx - 74 + i * 10, cy - 80 - i * 10 * 50 / 74); ctx.lineTo(cx + 74 - i * 10, cy - 80 - i * 10 * 50 / 74); ctx.stroke(); } }
  if (pv.features.includes('lights')) for (let i = 0; i < 14; i++) { const x = cx - 72 + i * 11; ctx.fillStyle = ['#ffd36a', '#ff9a6a', '#9fe0ff', '#ffb0d0'][i % 4]; circle(ctx, x, cy - 78 + Math.sin(i / 13 * Math.PI) * 8, 2.2); ctx.fill(); }
  if (pv.features.includes('racks')) { for (let i = 0; i < 3; i++) { const x = cx + 80 + i * 14; ctx.strokeStyle = col(['#e0503a', '#4fa3c4', '#e8c25a'][i]); ctx.lineWidth = 2; circle(ctx, x, cy + 30, 5); ctx.stroke(); circle(ctx, x, cy + 44, 5); ctx.stroke(); } }
}
