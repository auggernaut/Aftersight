// ---------- daily routines and movement ----------
const NPCS = {};
const SCHED = {};
const PIP = { x: 0, y: 0, visible: false, phase: 0 };

function weekdayIdx(day) { return (day + 2) % 7; } // day 1 is a Thursday
function isSunday(day) { return weekdayIdx(day) === 6; }

const SOCIAL_SPOT = { x: 1150, y: 968 };
const SOCIAL_OFF = { mara: [-40, -6], teo: [40, -4], juno: [-14, 22], odile: [18, 24] };

function buildSchedule(id) {
  const h = H(id), r = RES[id];
  const home = BUILDINGS[r.home].door;
  const B = [];
  const add = (from, to, act, at, extra = {}) => { if (to > from) B.push({ from: Math.round(from * 60), to: Math.round(to * 60), act, at, ...extra }); };
  const hid = { hidden: true };
  const w = h.work, st = h.stage;
  const kitchen = S.creations.kitchen.status === 'built';
  const breakfastDay = S.flags.breakfastDone && isSunday(S.day);
  const social = S.warmth > 0.45 && (st === 'thriving' || st === 'rest');
  const away = POI.busExit;

  if (id === 'mara') {
    if (st === 'overworked' || st === 'easing') {
      const dep = w >= 6 ? 6.35 : 8.2, back = dep + 0.3 + r.commute + w;
      add(0, dep, 'home', home, hid);
      add(dep, back, 'away', away, hid);
      add(back, 18.5, 'home', home, hid);
      if (h.energy >= 38 || st === 'easing') { add(Math.max(back + 0.4, 18.5), 19.8, 'porch', POI.maraPorch, { pose: 'sit' }); add(19.8, 24, 'home', home, hid); }
      else add(18.5, 24, 'home', home, hid);
    } else if (st === 'rest') {
      add(0, 9, 'home', home, hid); add(9, 12, 'porch', POI.maraPorch, { pose: 'tea' }); add(12, 13.5, 'home', home, hid);
      add(13.5, 15.5, 'wander', POI.plaza, { pose: 'stand' }); add(15.5, 17.5, 'porch', POI.maraPorch, { pose: 'tea' }); add(17.5, 24, 'home', home, hid);
    } else {
      add(0, 6.5, 'home', home, hid);
      if (kitchen) add(6.5, 10.5, 'bake', { x: 1404, y: 668 }, { pose: 'bake' }); else add(6.5, 9.5, 'bakehome', home, { hidden: true, smoke: true });
      if (!kitchen) add(9.5, 10.5, 'porch', POI.maraPorch, { pose: 'tea' });
      add(10.5, 11.5, 'chat', { x: 1196, y: 676 }, { pose: 'stand' });
      add(11.5, 13, 'home', home, hid);
      add(13, 15.5, 'wander', POI.plaza, { pose: 'stand' });
      add(15.5, 17, 'porch', POI.maraPorch, { pose: 'tea' });
      if (social) add(17, 19, 'social', SOCIAL_SPOT, { pose: 'chat' }); else add(17, 19, 'porch', POI.maraPorch, { pose: 'sit' });
      add(19, 24, 'home', home, hid);
    }
  }
  if (id === 'teo') {
    const vanDay = S.quest === 'van';
    if ((st === 'overworked' || st === 'easing') && !vanDay) {
      const dep = w >= 6 ? 7.4 : 8.6, back = dep + 0.3 + r.commute + w;
      add(0, dep, 'home', home, hid);
      add(dep, back, 'away', away, hid);
      if (h.energy >= 36 || st === 'easing') { add(back, back + 0.6, 'home', home, hid); add(back + 0.6, 19.2, 'garden', POI.teoGarden, { pose: st === 'easing' ? 'garden' : 'sit' }); add(19.2, 24, 'home', home, hid); }
      else add(back, 24, 'home', home, hid);
    } else if (vanDay) {
      add(0, 8, 'home', home, hid); add(8, 12, 'garden', POI.teoGarden, { pose: 'sit' }); add(12, 13, 'home', home, hid);
      add(13, 16, 'stand', { x: 1600, y: 1030 }, { pose: 'stand' }); add(16, 19.5, 'garden', POI.teoGarden, { pose: 'sit' }); add(19.5, 24, 'home', home, hid);
    } else if (st === 'rest') {
      add(0, 7.2, 'home', home, hid); add(7.2, 8, 'busstop', { x: 1190, y: 1590 }, { pose: 'stand' });
      add(8, 9, 'wander', POI.plaza, { pose: 'stand' }); add(9, 11.5, 'bench', POI.plazaBench2, { pose: 'sit' });
      add(11.5, 13, 'home', home, hid); add(13, 16, 'wander', { x: 1640, y: 1050 }, { pose: 'stand' });
      add(16, 18, 'garden', POI.teoGarden, { pose: 'garden' }); add(18, 24, 'home', home, hid);
    } else {
      const gardenFirst = h.focus !== 'bikes';
      add(0, 6.3, 'home', home, hid);
      if (gardenFirst) { add(6.3, 11, 'garden', POI.teoGarden, { pose: 'garden' }); add(11, 12, 'stand', { x: 960, y: 1392 }, { pose: 'stand' }); }
      else { add(6.3, 11, 'bikes', POI.workshopBikes, { pose: 'tinker' }); add(11, 12, 'garden', POI.teoGarden, { pose: 'garden' }); }
      add(12, 13.5, 'home', home, hid);
      if (gardenFirst) add(13.5, 16.5, 'bikes', POI.workshopBikes, { pose: 'tinker' }); else add(13.5, 16.5, 'garden', POI.teoGarden, { pose: 'garden' });
      if (social) add(17, 19, 'social', SOCIAL_SPOT, { pose: 'chat' }); else add(17, 19, 'garden', POI.teoGarden, { pose: 'sit' });
      add(19, 24, 'home', home, hid);
    }
  }
  if (id === 'juno') {
    if (st === 'overworked' || st === 'easing') {
      const cafe = Math.min(w, 6.5), gig = Math.max(0, w - cafe);
      const dep = w >= 6 ? 9 : 9.5, back = dep + 0.3 + r.commute + cafe;
      add(0, dep, 'home', home, hid); add(dep, back, 'away', away, hid);
      if (h.energy >= 40 || st === 'easing') {
        const e = Math.min(back + 2, 19);
        add(back, back + 0.5, 'home', home, hid); add(back + 0.5, e, 'bench', POI.junoBench, { pose: 'sit' }); add(e, 19, 'home', home, hid);
      } else add(back, 19, 'home', home, hid);
      if (gig > 0) { add(19, 19 + gig, 'gig', home, { hidden: true, gig: true }); add(19 + gig, 24, 'home', home, hid); }
      else add(19, 24, 'home', home, hid);
    } else if (st === 'rest') {
      add(0, 10, 'home', home, hid); add(10.5, 13, 'sitfall', POI.waterfallSpot, { pose: 'sit' });
      add(13, 13.5, 'home', home, hid); add(13.5, 16, 'bench', POI.junoBench, { pose: 'sit' }); add(16, 24, 'home', home, hid);
      add(10, 10.5, 'home', home, hid);
    } else {
      add(0, 7, 'home', home, hid);
      const gardenBuilt = S.creations.garden.status === 'built';
      add(7, 11, 'sketch', gardenBuilt ? { x: 1800, y: 372 } : POI.waterfallSpot, { pose: 'sketch' });
      add(11, 12, 'chat', { x: 1110, y: 680 }, { pose: 'stand' });
      add(12, 12.5, 'home', home, hid);
      add(12.5, 15, 'sketch', POI.plazaBench1, { pose: 'sketch' });
      if (kitchen && S.creations.kitchen.features.includes('mural')) add(15, 17, 'paint', { x: 1512, y: 662 }, { pose: 'paint' });
      else add(15, 17, 'sketch', POI.junoBench, { pose: 'sketch' });
      if (social) add(17.2, 19.2, 'social', SOCIAL_SPOT, { pose: 'chat' }); else add(17, 19.2, 'home', home, hid);
      add(19.2, 24, 'home', home, hid);
    }
  }
  if (id === 'odile') {
    if (st === 'overworked' || st === 'easing') {
      const open = w >= 6 ? 7 : 8, close = Math.min(open + w + 3, 20);
      add(0, open, 'home', home, hid); add(open, close, 'store', POI.storeCounter, { pose: 'store' });
      if (st === 'easing') { add(close, 18.5, 'bench', POI.plazaBench3, { pose: 'sit' }); add(18.5, 24, 'home', home, hid); }
      else add(close, 24, 'home', home, hid);
    } else {
      add(0, 8, 'home', home, hid); add(8, 12.5, 'store', POI.storeCounter, { pose: 'store' });
      add(12.5, 16, 'bench', POI.plazaBench3, { pose: 'sit' }); add(16, 17.5, 'home', home, hid);
      if (st === 'thriving') {
        const stage = S.creations.pavilion.status === 'built' ? { x: 880, y: 1000 } : POI.accordion;
        add(17.5, 20.2, 'accordion', stage, { pose: 'accordion' });
      } else add(17.5, 19.5, 'bench', POI.plazaBench3, { pose: 'sit' });
      add(20.2, 24, 'home', home, hid);
      if (st !== 'thriving') add(19.5, 20.2, 'home', home, hid);
    }
  }
  if (breakfastDay && kitchen) {
    // Sunday breakfast at the terrace replaces whatever was planned for 8:00-9:30
    const seat = { mara: { x: 1400, y: 684 }, teo: { x: 1470, y: 684 }, juno: { x: 1420, y: 700 }, odile: { x: 1490, y: 700 } }[id];
    for (const b of B) {
      if (b.from < 9.5 * 60 && b.to > 8 * 60) {
        if (b.from >= 8 * 60 && b.to <= 9.5 * 60) b.to = b.from; // drop
        else if (b.from < 8 * 60) b.to = 8 * 60; else b.from = 9.5 * 60;
      }
    }
    add(8, 9.5, 'breakfast', seat, { pose: 'sit' });
  }
  B.sort((a, b) => a.from - b.from);
  return B.filter(b => b.to > b.from);
}

function rebuildSchedules() { for (const id of RES_IDS) SCHED[id] = buildSchedule(id); }

function currentBlock(id) {
  const m = S.minute % 1440;
  const n = NPCS[id];
  if (n && n.override && S.minute < n.override.until) return n.override;
  const sc = SCHED[id] || [];
  let last = sc[0];
  for (const b of sc) { if (m >= b.from && m < b.to) return b; if (b.from <= m) last = b; }
  return last || { act: 'home', at: BUILDINGS[RES[id].home].door, hidden: true };
}
function blockTarget(id, b) {
  let at = b.at;
  if (b.act === 'social') at = { x: SOCIAL_SPOT.x + SOCIAL_OFF[id][0], y: SOCIAL_SPOT.y + SOCIAL_OFF[id][1] };
  return at;
}

function initNPCs() {
  for (const id of RES_IDS) NPCS[id] = { id, x: 0, y: 0, visible: false, path: [], key: '', facing: 1, phase: 0, moving: false, pose: 'stand', bubble: null, barkCD: 0, wander: null, mood: 'tired', override: null };
  rebuildSchedules();
  placeAllNPCs();
}
function placeAllNPCs() {
  for (const id of RES_IDS) {
    const n = NPCS[id];
    n.override = null;
    const b = currentBlock(id);
    const t = blockTarget(id, b);
    n.x = t.x; n.y = t.y; n.path = []; n.key = t.x + ',' + t.y; n.visible = !b.hidden; n.pose = b.pose || 'stand'; n.moving = false; n.wander = null;
  }
}

function npcMood(id, b, moving) {
  const h = H(id);
  if (b.act === 'away' && moving) return 'rushed';
  if (h.stage === 'thriving') return 'happy';
  if (h.stage === 'rest') return h.energy > 60 ? 'calm' : 'neutral';
  if (h.energy < 36) return 'tired';
  if (h.energy > 62) return 'happy';
  return 'neutral';
}
function npcSpeed(mood) { return { rushed: 38, tired: 19, neutral: 25, calm: 22, happy: 26 }[mood] || 25; }

function updateNPCs(dt, gmps) {
  for (const id of RES_IDS) {
    const n = NPCS[id];
    const b = currentBlock(id);
    let t = blockTarget(id, b);
    if (b.act === 'wander') {
      if (!n.wander || S.minute > n.wander.until) {
        const a = Math.random() * TAU, r = 40 + Math.random() * 110;
        const p = nearestWalkable(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r * 0.7);
        n.wander = { x: p.x, y: p.y, until: S.minute + 12 + Math.random() * 20 };
      }
      t = n.wander;
    } else n.wander = null;
    const key = Math.round(t.x) + ',' + Math.round(t.y);
    if (key !== n.key) {
      n.key = key;
      if (dist(n.x, n.y, t.x, t.y) > 6) { n.visible = true; n.path = findPath(n.x, n.y, t.x, t.y); }
      else n.path = [];
    }
    n.moving = n.path.length > 0;
    n.mood = npcMood(id, b, n.moving);
    if (n.moving) {
      let step = npcSpeed(n.mood) * gmps * dt;
      while (step > 0 && n.path.length) {
        const p = n.path[0];
        const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy);
        if (d <= step) { n.x = p.x; n.y = p.y; n.path.shift(); step -= d; }
        else { n.x += dx / d * step; n.y += dy / d * step; if (Math.abs(dx) > 1) n.facing = dx > 0 ? 1 : -1; n.dirY = dy; step = 0; }
      }
      n.phase += dt * (n.mood === 'rushed' ? 11 : n.mood === 'tired' ? 6 : 8) * Math.min(3, Math.max(1, gmps / 2));
      if (!n.path.length && b.hidden) n.visible = false;
    } else {
      if (b.hidden && !(n.override && S.minute < n.override.until)) n.visible = false;
      else n.visible = true;
      n.pose = b.pose || 'stand';
      if (b.act === 'social') n.facing = n.x < SOCIAL_SPOT.x ? 1 : -1;
      if (b.act === 'store') n.facing = 1;
    }
    if (n.barkCD > 0) n.barkCD -= dt;
    if (n.bubble) { n.bubble.t -= dt; if (n.bubble.t <= 0) n.bubble = null; }
  }
  // Pip trails his mother once she has time for him
  const m = NPCS.mara;
  const pipOut = m.visible && H('mara').stage !== 'overworked' && S.minute % 1440 > 9 * 60 && S.minute % 1440 < 19.5 * 60;
  if (pipOut) {
    const tx = m.x + (m.facing > 0 ? -26 : 26), ty = m.y + 8;
    if (!PIP.visible) { PIP.x = tx; PIP.y = ty; }
    const d = dist(PIP.x, PIP.y, tx, ty);
    PIP.moving = d > 4;
    if (d > 2) { const k = Math.min(1, dt * 4); PIP.x += (tx - PIP.x) * k; PIP.y += (ty - PIP.y) * k; PIP.facing = tx > PIP.x ? 1 : -1; PIP.phase += dt * 12; }
    PIP.visible = true;
  } else PIP.visible = false;
}

// Short lines residents say when you pass by.
function barkFor(id) {
  const n = NPCS[id], b = currentBlock(id), h = H(id);
  const r = Math.random();
  if (b.act === 'away' && n.moving) return pick({
    mara: ["Can't stop, the bus!", 'Late, late, late.', 'Morning. Bye.'],
    teo: ['Hm.', 'Route starts at six.', 'Not now.'],
    juno: ['Sorry, sorry, bus.', "Coffee doesn't pour itself.", '...hi. Bye.'],
    odile: ['Busy.'],
  }[id]);
  if (b.act === 'store') return pick(h.stage === 'overworked' ? ["Milk's in the back.", 'Prices went up again. Not my fault.', 'Twelve hours. Every day.'] : ['Take a peach, they are good today.', 'I close at noon now. Imagine.', 'Morning, neighbor!']);
  if (b.act === 'accordion') return pick(['♪ This one is for my father.', '♪ I know three songs. This is one of them.', '♪ Clap or go home!']);
  if (b.act === 'sketch' || b.act === 'paint') return pick(['Hold still, I’m drawing the light.', 'Page fourteen!', 'Look at the color of that water.']);
  if (b.act === 'bake' || b.act === 'bakehome') return pick(['Cardamom. Trust me.', 'First loaf is for Teo, before he knocks.', 'The dough is rising and so am I.']);
  if (b.act === 'garden') return pick(h.stage === 'thriving' ? ['Purple ones. Rosa’s.', 'Soil this good, you could grow a piano.', 'Mind the seedlings!'] : ['Weeds win again.', 'Rosa would be ashamed of me.', 'Too tired for this.']);
  if (b.act === 'bikes') return pick(['Three bikes fixed today.', 'The robots are fast learners. Faster than Pip.', 'Want a bicycle? I have extras.']);
  if (b.act === 'social') return pick(['Ha! Teo, no.', 'Pass the peaches.', 'Did you see Juno’s drawing?', 'Same time tomorrow?']);
  if (b.act === 'busstop') return 'Forty years of six o\u2019clock alarms. My body still remembers.';
  if (b.act === 'tea') return pick(['Tea, while it’s hot. Revolutionary.', 'I’m not doing anything. On purpose.']);
  if (b.act === 'breakfast') return pick(['Pass the jam!', 'Mara, this bread...', 'Sunday breakfast. Best idea we ever had.']);
  if (h.energy < 36) return pick({ mara: ['So tired.', 'Long day.'], teo: ['My back...', 'Hm.'], juno: ['Need sleep.', 'Brain is soup.'], odile: ['My feet.', 'Long day.'] }[id]);
  return r < 0.5 ? 'Hi, ' + S.player.name + '!' : pick(['Nice evening.', 'Hello again.', 'Good to see you.']);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function knockDoor(id) {
  const n = NPCS[id];
  const door = BUILDINGS[RES[id].home].door;
  const m = S.minute % 1440;
  const b = currentBlock(id);
  if (b.act !== 'home' && b.act !== 'gig' && b.act !== 'bakehome') return 'out';
  if (m < 6.5 * 60 || m > 22 * 60) return 'asleep';
  n.override = { act: 'door', at: { x: door.x + 18, y: door.y + 26 }, pose: 'stand', until: S.minute + 45 };
  n.x = door.x; n.y = door.y + 4; n.visible = true; n.path = []; n.key = '';
  return 'ok';
}
