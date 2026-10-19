// ---------- loop, input, saving, start screens ----------
const SAVE_KEY = 'afterlight-save-v1';
const SPEEDS = { 1: 2, 2: 6, 3: 16 }; // game minutes per real second
const keys = new Set();
let lastT = 0, saveT = 0, demo = true, booted = false;

// ----- sound: soft synthesized chimes and an ambient music box -----
const Audio2 = {
  ac: null, master: null, on: true, nextNote: 0,
  init() {
    if (this.ac) return;
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ac.createGain(); this.master.gain.value = 0.16; this.master.connect(this.ac.destination); } catch (e) { this.ac = null; }
  },
  enable(v) { this.on = v; if (v) { this.init(); if (this.ac && this.ac.state === 'suspended') this.ac.resume(); } },
  note(f, when, dur, type = 'triangle', vol = 0.25) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime + (when || 0);
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  sfx(name) {
    if (!this.ac || !this.on) return;
    const N = n => 261.63 * Math.pow(2, n / 12);
    if (name === 'click') this.note(N(19), 0, 0.12, 'sine', 0.08);
    if (name === 'quest') { this.note(N(12), 0, 0.5); this.note(N(16), 0.1, 0.5); this.note(N(19), 0.2, 0.8); }
    if (name === 'coin') { this.note(N(24), 0, 0.3, 'sine', 0.15); this.note(N(28), 0.08, 0.4, 'sine', 0.15); }
    if (name === 'build') { this.note(N(7), 0, 0.3, 'square', 0.05); this.note(N(12), 0.12, 0.5, 'triangle', 0.2); }
    if (name === 'chime') [0, 4, 7, 12, 16].forEach((n, i) => this.note(N(n + 12), i * 0.12, 1.2, 'sine', 0.15));
    if (name === 'afterlight') [0, 4, 7, 11, 14, 19, 24].forEach((n, i) => this.note(N(n), i * 0.22, 2.4, 'sine', 0.18));
  },
  music(dt) {
    if (!this.ac || !this.on || demo) return;
    this.nextNote -= dt;
    if (this.nextNote > 0) return;
    const w = S.warmth, m = S.minute % 1440, night = m < 6 * 60 || m > 21 * 60;
    this.nextNote = (night ? 2.4 : 1.1) + Math.random() * (2.4 - w * 1.4);
    const scale = w > 0.5 ? [0, 2, 4, 7, 9, 12, 14, 16, 19] : [0, 3, 5, 7, 10, 12];
    const n = scale[(Math.random() * scale.length) | 0] + (Math.random() < 0.3 ? 12 : 0);
    this.note(261.63 * Math.pow(2, n / 12), 0, 2.2, 'sine', (night ? 0.05 : 0.08) * (0.6 + w * 0.6));
    if (Math.random() < 0.25) this.note(130.81 * Math.pow(2, scale[(Math.random() * 3) | 0] / 12), 0, 3.5, 'triangle', 0.05);
  },
};

// ----- saving -----
function saveGame() {
  if (demo || !S) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: play continues */ }
}
function readSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
function hydrate(data) {
  const base = newState({ name: data.player.name, look: data.player.look, botName: data.bot.name, botColor: data.bot.color });
  for (const k in data) {
    if (k === 'households' || k === 'projects' || k === 'creations') { for (const id in data[k]) base[k][id] = Object.assign(base[k][id] || {}, data[k][id]); }
    else base[k] = data[k];
  }
  S = base;
  return S;
}

// ----- the player -----
function updatePlayer(dt) {
  const P = S.player;
  if (UI.dialog || UI.panel || UI.cutscene) { P.moving = false; return; }
  let vx = 0, vy = 0;
  if (keys.has('arrowleft') || keys.has('a')) vx -= 1;
  if (keys.has('arrowright') || keys.has('d')) vx += 1;
  if (keys.has('arrowup') || keys.has('w')) vy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) vy += 1;
  const speed = 160;
  if (vx || vy) { P.path = null; P.goal = null; }
  else if (P.path && P.path.length) {
    if (P.goal && P.goal.type === 'npc') {
      const n = NPCS[P.goal.id];
      P.repath = (P.repath || 0) - dt;
      if (n.visible && P.repath <= 0) { P.repath = 0.4; P.path = findPath(P.x, P.y, n.x, n.y + 10); }
    }
    const t = P.path[0];
    const dx = t.x - P.x, dy = t.y - P.y, d = Math.hypot(dx, dy);
    if (d < 4) P.path.shift();
    else { vx = dx / d; vy = dy / d; }
  }
  const len = Math.hypot(vx, vy);
  P.moving = len > 0;
  if (P.moving) {
    vx /= len; vy /= len;
    const nx = P.x + vx * speed * dt, ny = P.y + vy * speed * dt;
    let moved = false;
    if (footFree(nx, P.y)) { P.x = nx; moved = true; }
    if (footFree(P.x, ny)) { P.y = ny; moved = true; }
    if (!moved && P.path) P.path.shift();
    if (Math.abs(vx) > 0.2) P.facing = vx > 0 ? 1 : -1;
    P.dirY = vy;
    P.phase = (P.phase || 0) + dt * 11;
  }
  // arrive at a clicked target
  if (P.goal) {
    const g = P.goal;
    const gp = g.type === 'npc' ? NPCS[g.id] : g;
    if (g.type === 'npc' && !NPCS[g.id].visible) P.goal = null;
    else if (dist(P.x, P.y, gp.x, gp.y) < 52) { P.path = null; P.goal = null; P.moving = false; interact(findInteractable(g)); }
    else if (!P.path || !P.path.length) P.goal = null;
  }
  // camera follows
  const k = Math.min(1, dt * 4);
  cam.x += (P.x - cam.x) * k; cam.y += (P.y - 40 - cam.y) * k;
}
function updateBot(dt) {
  const B = S.bot, P = S.player;
  const tx = P.x - (P.facing || 1) * 34, ty = P.y + 8;
  const d = dist(B.x, B.y, tx, ty);
  if (d > 600) { B.x = tx; B.y = ty; }
  const k = Math.min(1, dt * (d > 80 ? 3.5 : 2));
  if (d > 6) { B.facing = tx > B.x ? 1 : -1; B.x += (tx - B.x) * k; B.y += (ty - B.y) * k; }
  if (BOT_FX.sayT > 0) BOT_FX.sayT -= dt;
}

// ----- things you can interact with -----
function interactables() {
  const out = [];
  for (const id of RES_IDS) { const n = NPCS[id]; if (n.visible) out.push({ type: 'npc', id, x: n.x, y: n.y, label: `Talk to ${H(id).met ? RES[id].short : 'your neighbor'}`, pri: 3 }); }
  out.push({ type: 'workbench', x: POI.workbench.x, y: POI.workbench.y, label: 'Use your workbench', pri: 2 });
  const drafted = Object.keys(PROJECTS).find(k => S.projects[k].status === 'drafted');
  out.push({ type: 'notice', x: POI.notice.x, y: POI.notice.y, label: drafted ? `Call a town meeting: ${PROJECTS[drafted].name}` : buybackAvailable() ? 'Notice board: buy back the array' : 'Read the notice board', pri: 2 });
  for (const k in SALVAGE) if (salvageAvailable(k)) { const p = POI[SALVAGE[k].poi]; out.push({ type: 'salvage', key: k, x: p.x, y: p.y, label: `Salvage: ${SALVAGE[k].name}`, pri: 2 }); }
  for (const pid in PROJECTS) { const p = S.projects[pid]; if (p.status === 'online' || p.status === 'building') { const c = siteSpot(pid); out.push({ type: 'site', pid, x: c.x, y: c.y, label: p.damaged ? 'Repair the storm damage' : `Visit the ${PROJECTS[pid].name}`, pri: 1 }); } }
  for (const cid in CREATIONS) {
    const c = S.creations[cid];
    if (c.status === 'available' || c.status === 'building' || c.status === 'built') {
      const p = cid === 'kitchen' ? POI.terraceSpot : cid === 'garden' ? { x: 1820, y: 430 } : POI.pavilionSpot;
      if (cid === 'kitchen' && S.quest === 'breakfast' && breakfastHours()) out.push({ type: 'breakfast', x: POI.kitchenTable.x, y: POI.kitchenTable.y + 40, label: 'Start the first breakfast', pri: 4 });
      else out.push({ type: 'creation', cid, x: p.x, y: p.y, label: c.status === 'available' ? `Plan the ${CREATIONS[cid].name}` : `Visit the ${CREATIONS[cid].name}`, pri: 1 });
    }
  }
  for (const id of RES_IDS) {
    const n = NPCS[id], b = currentBlock(id);
    if (!n.visible && b.hidden && b.act !== 'away') { const d = BUILDINGS[RES[id].home].door; out.push({ type: 'door', id, x: d.x, y: d.y + 18, label: `Knock on ${H(id).met ? RES[id].short + '’s' : 'the'} door`, pri: 1 }); }
  }
  out.push({ type: 'flavor', x: 2250, y: 1000, label: 'Read the sign', text: 'Riverside, 3 km. Another town, another street of tired people. Someday this bridge will carry more than bicycles.', pri: 0 });
  out.push({ type: 'flavor', x: 1200, y: 1590, label: 'Look at the timetable', text: S.warmth < 0.4 ? 'The 6:45 is always full. People sleep standing up.' : 'Someone has drawn a little sun on the timetable. The 6:45 has seats now.', pri: 0 });
  out.push({ type: 'bot', x: S.bot.x, y: S.bot.y, label: `Ask ${S.bot.name} for a hint`, pri: -1 });
  return out;
}
function siteSpot(pid) {
  if (pid === 'solar') return POI.sunfield;
  if (pid === 'workshop') return { x: 1725, y: 1004 };
  return { x: 960, y: 1392 };
}
function breakfastHours() { const h = (S.minute % 1440) / 60; return h >= 6.5 && h < 11.5; }
function findInteractable(g) {
  const list = interactables();
  return list.find(i => i.type === g.type && (i.id || i.key || i.pid || i.cid) === (g.id || g.key || g.pid || g.cid)) || null;
}
function nearestInteractable() {
  const P = S.player;
  let best = null, bs = Infinity;
  for (const it of interactables()) {
    const d = dist(P.x, P.y, it.x, it.y);
    const r = it.type === 'bot' ? 0 : 50;
    if (d < r) { const score = d - it.pri * 12; if (score < bs) { bs = score; best = it; } }
  }
  return best;
}
function interact(it) {
  it = it || UI.nearby;
  if (!it || UI.dialog || UI.panel || UI.cutscene) return;
  hooks.sfx('click');
  if (it.type === 'npc') { startDialog(talkTo(it.id), it.id); return; }
  if (it.type === 'bot') { startDialog(talkBolt(), null); return; }
  if (it.type === 'workbench') { openPanel('workbench'); return; }
  if (it.type === 'notice') {
    const drafted = Object.keys(PROJECTS).find(k => S.projects[k].status === 'drafted');
    if (drafted || buybackAvailable()) openPanel('meeting');
    else startDialog([L('narr', noticeText(), null)], null);
    return;
  }
  if (it.type === 'salvage') { doSalvage(it.key); return; }
  if (it.type === 'site') { openPanel('site', it.pid); return; }
  if (it.type === 'creation') { openPanel('creation', it.cid); return; }
  if (it.type === 'breakfast') { startBreakfast(); return; }
  if (it.type === 'door') {
    const r = knockDoor(it.id);
    if (r === 'asleep') startDialog([L('narr', 'No answer. The lights are off. Let them sleep.', null)], null);
    else if (r === 'ok') { boltSay('Knock knock!', 2); setTimeout(() => { if (!UI.dialog && !UI.panel) startDialog(talkTo(it.id), it.id); }, 500); }
    return;
  }
  if (it.type === 'flavor') { startDialog([L('narr', it.text, null)], null); }
}
function noticeText() {
  if (S.flags.breakfastDone) return 'In Odile’s handwriting, in ink: SUNDAY BREAKFAST, TERRACE, EVERYONE. Below it, Pip has drawn a jam jar.';
  if (online('solar')) return 'Ownership records for everything the street has built are pinned here, along with a lost-cat poster and a recipe for cardamom bread.';
  return 'A faded flyer for a 1998 street party. A lost-cat poster. Nothing about the future yet.';
}
function doSalvage(key) {
  const sv = SALVAGE[key];
  S.salvage[key] = true;
  S.parts += sv.parts;
  hooks.sfx('coin');
  logEvent(`Salvaged ${sv.parts} parts: ${sv.name}.`, 'salvage');
  startDialog([L('bolt', `${sv.text} Scanning... ${sv.parts} parts of usable material! I’ll have the robots bring it to the workshop.`, 'happy')], null);
  toast(`+${sv.parts} parts`, 'good');
  if (key === 'frames') rebuildColliders(S);
}

// ----- time -----
function nextMorning() {
  if (UI.dialog || UI.panel || UI.cutscene || demo) return;
  const fade = $('#fade');
  fade.classList.add('on');
  setTimeout(() => {
    if (S.minute % 1440 >= 360) endOfDay();
    S.minute = 360;
    afterNewDay(true);
    S.player.x = 1520; S.player.y = 1022; S.player.path = null; S.player.goal = null;
    S.bot.x = 1490; S.bot.y = 1030;
    cam.x = S.player.x; cam.y = S.player.y;
    fade.classList.remove('on');
    openPanel('morning');
    S.pendingMorning = false;
    saveGame();
  }, 420);
}
function afterNewDay(skip) {
  rebuildSchedules();
  if (skip) placeAllNPCs();
  rebuildColliders(S);
  FERRY_PATH = null;
}
function advanceTime(dt) {
  if (S.paused || UI.dialog || UI.panel || UI.cutscene) return 0;
  const gmps = SPEEDS[S.speed] || 2;
  const prev = S.minute;
  S.minute += gmps * dt;
  if (S.minute >= 1440) { S.minute -= 1440; endOfDay(); afterNewDay(false); S.pendingMorning = true; }
  if (S.pendingMorning && S.minute >= 360) { S.pendingMorning = false; openPanel('morning'); }
  if (Math.floor(prev / 30) !== Math.floor(S.minute / 30)) { updateWarmthTarget(); saveGame(); }
  S.warmth += (S.warmthTarget - S.warmth) * Math.min(1, gmps * dt * 0.004);
  if (Math.floor(prev / 60) !== Math.floor(S.minute / 60) && Math.floor(S.minute / 60) === 23) boltSay('It’s getting late. Press Next morning whenever you’re ready to sleep.', 6);
  return gmps;
}

// ----- input -----
function setupInput() {
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (demo) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (UI.cutscene) { if (k === 'enter' || k === ' ' || k === 'e') { const b = $('#cs-go'); if (b) b.click(); } return; }
    if (UI.dialog) {
      if (k === 'e' || k === ' ' || k === 'enter') advanceDialog();
      if (/^[1-4]$/.test(k)) choose(+k - 1);
      return;
    }
    if (k === 'escape') { if (UI.panel) closePanel(); else openPanel('menu'); return; }
    if (UI.panel) { if (k === 'l' && UI.panel.kind === 'ledger' || k === 'n' && UI.panel.kind === 'notebook' || k === 'b' && UI.panel.kind === 'projects') closePanel(); return; }
    if (k === 'e' || k === ' ' || k === 'enter') interact();
    if (k === 'l') openPanel('ledger');
    if (k === 'n') openPanel('notebook');
    if (k === 'b') openPanel('projects');
    if (k === 'p') setSpeed(0);
    if (k === '1' || k === '2' || k === '3') setSpeed(+k);
    if (k === 'z') nextMorning();
    if (k === '+' || k === '=') cam.userZoom = clamp(cam.userZoom * 1.12, 0.7, 2.2);
    if (k === '-') cam.userZoom = clamp(cam.userZoom / 1.12, 0.7, 2.2);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  cvs.addEventListener('pointerdown', e => {
    Audio2.enable(S.sound !== false);
    if (demo || UI.dialog || UI.panel || UI.cutscene) { if (UI.dialog) advanceDialog(); return; }
    const r = cvs.getBoundingClientRect();
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    clickWorld(w.x, w.y);
  });
  cvs.addEventListener('wheel', e => { e.preventDefault(); cam.userZoom = clamp(cam.userZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.7, 2.2); }, { passive: false });
  window.addEventListener('resize', resize);
}
function clickWorld(x, y) {
  const P = S.player;
  let hit = null, hd = Infinity;
  for (const it of interactables()) {
    if (it.type === 'bot') { if (dist(x, y, it.x, it.y - 18) < 20) { hit = it; break; } continue; }
    const yy = it.type === 'npc' ? it.y - 22 : it.y - 10;
    const d = dist(x, y, it.x, yy);
    if (d < (it.type === 'npc' ? 30 : 40) && d < hd) { hd = d; hit = it; }
  }
  if (hit) {
    if (dist(P.x, P.y, hit.x, hit.y) < 52) { interact(hit); return; }
    P.goal = { type: hit.type, id: hit.id, key: hit.key, pid: hit.pid, cid: hit.cid, x: hit.x, y: hit.y };
    P.path = findPath(P.x, P.y, hit.x, hit.y + (hit.type === 'npc' ? 12 : 8));
    return;
  }
  P.goal = null;
  P.path = findPath(P.x, P.y, x, y);
  spawn('spark', x, y, { life: 0.4 });
}

// ----- main loop -----
// If the device can't keep up, drop the purely decorative effects (tilt-shift blur,
// ink outlines on people) once, for good, so the town never stutters.
const FX_WATCH = { t: 0, n: 0, sum: 0 };
function watchFrameRate(dt) {
  if (LOW_FX) return;
  FX_WATCH.t += dt;
  if (FX_WATCH.t < 2) return; // let fonts and art settle first
  FX_WATCH.n++; FX_WATCH.sum += dt;
  if (FX_WATCH.n < 90) return;
  if (FX_WATCH.sum / FX_WATCH.n > 1 / 40) { LOW_FX = true; document.body.classList.add('lowfx'); }
  FX_WATCH.n = 0; FX_WATCH.sum = 0;
}
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  watchFrameRate(dt);
  if (demo) {
    S.minute = 17 * 60 + 40 + Math.sin(t / 9000) * 20;
    cam.x = 1150 + Math.sin(t / 14000) * 300; cam.y = 900 + Math.cos(t / 17000) * 140;
    updateNPCs(dt, 2);
  } else {
    const gmps = advanceTime(dt);
    updatePlayer(dt);
    updateBot(dt);
    updateNPCs(dt, gmps);
    // passers-by say things
    for (const id of RES_IDS) {
      const n = NPCS[id];
      if (n.visible && !n.bubble && n.barkCD <= 0 && !UI.dialog && dist(n.x, n.y, S.player.x, S.player.y) < 120 && Math.random() < 0.02) { n.bubble = { text: barkFor(id), t: 3.4 }; n.barkCD = 16 + Math.random() * 14; }
    }
    UI.nearby = nearestInteractable();
    // a gentle nudge if you seem stuck
    const o = objectives()[0];
    const ot = o ? o.text : '';
    if (ot !== UI.lastObj) { UI.lastObj = ot; UI.objT = 0; } else if (!UI.dialog && !UI.panel) { UI.objT += dt; if (UI.objT > 75 && o) { UI.objT = 0; boltSay(o.text + '.', 5); } }
    Audio2.music(dt);
    updateHUD();
  }
  updateWorkers();
  render(dt);
  requestAnimationFrame(frame);
}

// ----- start screens -----
const LOOK_OPTS = {
  skin: ['#f3d2bd', '#e9bf9b', '#c99572', '#a8714d', '#7b4a32', '#4e2f22'],
  hairStyle: ['short', 'long', 'bob', 'curly', 'bun', 'ponytail', 'buzz'],
  hair: ['#1b1a22', '#4a2e1e', '#8a5a32', '#d9a85a', '#b8402e', '#c8c2ba'],
  outfit: ['#4fa38a', '#e0874a', '#6f8fd0', '#c45a6a', '#e8c25a', '#8a6ab8', '#5f7f4b', '#f2efe6'],
  pants: ['#3e4250', '#5a4a3a', '#2f4a5a', '#6a5a4a'],
  bot: ['#7fd0c8', '#f2b955', '#e8805a', '#a8b8e8', '#9cc46a'],
};
const HAIR_NAMES = { short: 'Short', long: 'Long', bob: 'Bob', curly: 'Curls', bun: 'Bun', ponytail: 'Ponytail', buzz: 'Buzz' };
function showTitle() {
  const save = readSave();
  const ov = $('#title');
  ov.hidden = false;
  ov.innerHTML = `<div class="title-card">
    <p class="eyebrow">A neighborhood life sim</p>
    <h1>Afterlight</h1>
    <p class="sub">A tired little town. Four neighbors who never have time. One workshop, one helpful robot, and a chance to build a future where everyone has enough, and then some.</p>
    <div class="row">${save ? `<button class="btn primary" id="t-continue">Continue · day ${save.day}</button><button class="btn" id="t-new">New game</button>` : '<button class="btn primary" id="t-new">Begin</button>'}</div>
    <p class="fine">Saves automatically in this browser. Works with keyboard, mouse, or touch.</p></div>`;
  if (save) $('#t-continue').onclick = () => { Audio2.enable(save.sound !== false); hydrate(save); startGame(false); };
  $('#t-new').onclick = () => { Audio2.enable(true); showCreator(); };
}
function showCreator() {
  const sel = { name: '', skin: LOOK_OPTS.skin[2], hairStyle: 'short', hair: LOOK_OPTS.hair[1], outfit: LOOK_OPTS.outfit[0], pants: LOOK_OPTS.pants[0], botName: 'Pim', bot: LOOK_OPTS.bot[0] };
  const ov = $('#title');
  const sw = (key, vals) => `<div class="sw" data-key="${key}">${vals.map(v => `<button class="swatch${sel[key] === v ? ' on' : ''}" data-v="${v}" style="background:${v}" aria-label="${v}"></button>`).join('')}</div>`;
  const draw = () => {
    const c = $('#cc-preview'); if (!c) return;
    const g = c.getContext('2d'); const d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = 220 * d; c.height = 240 * d; g.setTransform(d, 0, 0, d, 0, 0);
    const bg = g.createRadialGradient(110, 150, 10, 110, 150, 140); bg.addColorStop(0, '#f6dca8'); bg.addColorStop(1, '#e7b77a');
    g.fillStyle = bg; g.fillRect(0, 0, 220, 240);
    g.fillStyle = '#9cc46a'; g.beginPath(); g.ellipse(110, 214, 120, 34, 0, 0, TAU); g.fill();
    const sv = GRADE; GRADE = 20;
    drawPerson(g, 92, 212, { skin: sel.skin, hair: sel.hair, hairStyle: sel.hairStyle, outfit: sel.outfit, pants: sel.pants }, { scale: 3.1, mood: 'happy', facing: 1 });
    drawBot(g, 182, 206, sel.bot, { t: performance.now() / 1000, facing: -1 });
    GRADE = sv;
  };
  ov.innerHTML = `<div class="title-card creator">
    <h2>Who arrives on the evening bus?</h2>
    <div class="cc-grid">
      <canvas id="cc-preview" width="220" height="240" aria-label="Character preview"></canvas>
      <div class="cc-fields">
        <label for="cc-name">Your name</label><input id="cc-name" maxlength="16" placeholder="Type a name" autocomplete="off">
        <label>Skin</label>${sw('skin', LOOK_OPTS.skin)}
        <label>Hair</label><div class="chips" data-key="hairStyle">${LOOK_OPTS.hairStyle.map(h => `<button class="chipbtn${sel.hairStyle === h ? ' on' : ''}" data-v="${h}">${HAIR_NAMES[h]}</button>`).join('')}</div>
        ${sw('hair', LOOK_OPTS.hair)}
        <label>Clothes</label>${sw('outfit', LOOK_OPTS.outfit)}
        <label for="cc-bot">Your robot</label><input id="cc-bot" maxlength="12" value="Pim" autocomplete="off">
        ${sw('bot', LOOK_OPTS.bot)}
      </div>
    </div>
    <div class="row"><button class="btn" id="cc-rand">Surprise me</button><button class="btn primary" id="cc-go">Step off the bus</button></div></div>`;
  ov.querySelectorAll('.sw, .chips').forEach(group => group.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    sel[group.dataset.key] = b.dataset.v;
    group.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    draw();
  }));
  $('#cc-rand').onclick = () => {
    for (const k of ['skin', 'hairStyle', 'hair', 'outfit', 'bot']) sel[k] = pick(LOOK_OPTS[k === 'bot' ? 'bot' : k]);
    ov.querySelectorAll('.sw, .chips').forEach(group => group.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === sel[group.dataset.key])));
    if (!$('#cc-name').value) $('#cc-name').value = pick(['Ren', 'Sol', 'Ava', 'Ines', 'Kofi', 'Lio', 'Maya', 'Tomas', 'Noor', 'Ezra']);
    draw();
  };
  $('#cc-go').onclick = () => {
    const name = ($('#cc-name').value || '').trim() || 'Ren';
    const botName = ($('#cc-bot').value || '').trim() || 'Pim';
    wipeSave();
    newState({ name, look: { skin: sel.skin, hair: sel.hair, hairStyle: sel.hairStyle, outfit: sel.outfit, pants: sel.pants }, botName, botColor: sel.bot });
    startGame(true);
  };
  draw();
  const anim = () => { if ($('#cc-preview')) { draw(); requestAnimationFrame(anim); } };
  requestAnimationFrame(anim);
}
function startGame(fresh) {
  demo = false;
  $('#title').hidden = true;
  $('#hud').hidden = false;
  rebuildColliders(S);
  initNPCs();
  FERRY_PATH = null;
  cam.x = S.player.x; cam.y = S.player.y;
  updateHUD(true);
  if (fresh) {
    logEvent(`${S.player.name} and ${S.bot.name} arrived on the evening bus.`, 'milestone');
    setTimeout(() => startDialog([
      L('narr', 'The evening bus wheezes away. The street is quiet in the way tired places are quiet.', null),
      L('bolt', 'Here we are, {name}! Your workshop is east of the plaza. And look: the neighbors are coming home from work.', 'happy'),
      L('bolt', 'They look exhausted. Let’s say hello. Walk with WASD or the arrow keys, or click where you want to go. Press E or tap someone to talk.', 'happy'),
    ], null), 500);
  }
  saveGame();
}

function boot() {
  setupCanvas($('#game'));
  buildScenery();
  buildGroundBits();
  newState({ name: 'Ren', look: { skin: '#c99572', hair: '#4a2e1e', hairStyle: 'short', outfit: '#4fa38a', pants: '#3e4250' }, botName: 'Pim', botColor: '#7fd0c8' });
  S.minute = 17 * 60 + 40;
  rebuildColliders(S);
  initArt();
  initNPCs();
  buildHUD();
  setupInput();
  hooks.toast = toast; hooks.bolt = (t) => boltSay(t, 6); hooks.sfx = n => Audio2.sfx(n); hooks.changed = () => updateHUD(true);
  booted = true;
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(() => ({ save: !demo && S ? JSON.stringify(S) : null })); } catch (e) { } }
  const start = (data) => {
    if (data && data.save) { try { hydrate(JSON.parse(data.save)); startGame(false); } catch (e) { showTitle(); } }
    else showTitle();
    requestAnimationFrame(t => { lastT = t; frame(t); });
  };
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
}

// test and debugging hooks
window.__AL = {
  get S() { return S; }, NPCS, UI, objectives, interact, interactables, talkTo, openPanel, closePanel, nextMorning, advanceDialog, choose,
  teleport(x, y) { const p = nearestWalkable(x, y); S.player.x = p.x; S.player.y = p.y; S.player.path = null; cam.x = p.x; cam.y = p.y; },
  near(type, id) { const it = interactables().find(i => i.type === type && (i.id === id || i.key === id || i.pid === id || i.cid === id || id === undefined)); if (it) this.teleport(it.x, it.y + 14); return it; },
  econ: () => RES_IDS.map(id => ({ id, work: H(id).work, req: round1(requiredWork(id)), exp: round1(expensesOf(id).total), inc: round1(incomeOf(id).total), energy: Math.round(H(id).energy), stage: H(id).stage })),
};
window.addEventListener('load', boot);
