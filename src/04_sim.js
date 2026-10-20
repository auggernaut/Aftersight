// ---------- simulation: economy, days, routines, story ----------
let S = null; // the saved game state

function newState(setup) {
  const households = {};
  for (const id of RES_IDS) {
    const r = RES[id];
    households[id] = { work: 0, energy: r.energy, rel: 0, met: false, knowPressure: false, knowInterest: false, stage: 'overworked', stageDays: 0, nudged: false, focus: null, talkedDay: 0, history: [] };
  }
  const projects = {};
  for (const id in PROJECTS) projects[id] = { status: 'locked', style: null, option: null, owners: null, approach: null, buildLeft: 0, upgrades: {}, pending: null, ramp: 1, damaged: false, builtDay: 0, stories: [] };
  const creations = {};
  for (const id in CREATIONS) creations[id] = { status: 'locked', style: null, features: [], approach: null, buildLeft: 0, builtDay: 0, stories: [] };
  const st = {
    v: 1, day: 1, minute: 16 * 60 + 30, speed: 1, paused: false,
    player: { name: setup.name, look: setup.look, x: 1150, y: 1548, dir: 'up' },
    bot: { name: setup.botName, color: setup.botColor, x: 1190, y: 1560 },
    parts: 20, fund: 150, warmth: 0.04, warmthTarget: 0.04, weather: 'cloudy',
    households, projects, creations,
    salvage: {}, flags: {}, seen: {}, quest: 'meet', log: [], placeStories: [],
    lastReport: null, sound: true,
  };
  S = st;
  for (const id of RES_IDS) { const h = st.households[id]; h.work = Math.ceil(requiredWork(id) * 2) / 2; h.history.push(snapshotHH(id)); }
  return st;
}

// ----- economy -----
function H(id) { return S.households[id]; }
function online(pid) { return S.projects[pid] && S.projects[pid].status === 'online'; }
function choresOf() { return online('workshop') ? 1.5 : 2.5; }

function expensesOf(id) {
  const b = RES[id].base;
  const P = S.projects;
  let power = b.power, food = b.food, transport = b.transport;
  if (online('solar')) power = P.solar.option === 'brightline' ? b.power * (S.flags.blHike ? 1.1 : 0.75) : 2;
  if (online('workshop')) transport = b.transport * (P.workshop.option === 'brightline' ? 0.6 : 0.35) * (P.workshop.upgrades.bikes ? 0.6 : 1);
  if (online('greenhouse')) food = b.food * 0.5 * (P.greenhouse.upgrades.aqua ? 0.8 : 1);
  const total = b.housing + food + power + transport + b.other;
  const baseTotal = b.housing + b.food + b.power + b.transport + b.other;
  return { housing: b.housing, food, power, transport, other: b.other, total, baseTotal };
}

function projectEcon(pid, actual) {
  const p = S.projects[pid], d = PROJECTS[pid];
  if (!p || p.status !== 'online') return { revenue: 0, op: 0, net: 0, fab: 0 };
  let revenue = d.revenue;
  let fab = d.fab || 0;
  let nUp = 0;
  for (const u of d.upgrades) if (p.upgrades[u.id]) { revenue += u.revenue; fab += u.fab || 0; nUp++; }
  if (pid === 'solar') revenue *= (actual ? WEATHER[S.weather].solar : 0.9) * (p.damaged ? 0.55 : 1);
  if (pid === 'greenhouse' && actual && S.weather === 'rain') revenue *= 1.1;
  if (pid === 'workshop') { revenue *= p.ramp; fab = Math.round(fab * p.ramp); }
  let op = d.op + nUp * 4;
  if (pid === 'compute') op += computePowerCost();
  return { revenue, op, net: revenue - op, fab };
}

// Compute racks run on the array: nearly free if the street owns it, a real bill if Brightline does or there is no array.
function computePowerCost() { return !online('solar') ? 34 : S.projects.solar.option === 'brightline' ? 26 : 2; }
function incomeOf(id, actual) {
  const by = {};
  let total = 0;
  for (const pid in PROJECTS) {
    const p = S.projects[pid];
    if (p.status !== 'online' || !p.owners) continue;
    const share = p.owners[id] || 0;
    if (!share) continue;
    const v = Math.max(0, projectEcon(pid, actual).net) * share;
    by[pid] = v; total += v;
  }
  return { total, by };
}
function requiredWork(id) {
  const e = expensesOf(id), i = incomeOf(id);
  return Math.max(0, (e.total - i.total) / RES[id].wage);
}
function freeTime(id) {
  const h = H(id);
  return Math.max(0, 16 - h.work - (h.work > 0 ? RES[id].commute : 0) - choresOf());
}
function snapshotHH(id) {
  const e = expensesOf(id), i = incomeOf(id);
  return { day: S.day, work: round1(H(id).work), energy: Math.round(H(id).energy), income: Math.round(i.total), expenses: Math.round(e.total), free: round1(freeTime(id)) };
}
function stageLabel(id) {
  const h = H(id);
  if (h.stage === 'thriving') return { t: 'Living well', c: 'good' };
  if (h.stage === 'rest') return { t: 'Taking a breath', c: 'calm' };
  if (h.work <= 0) return { t: 'Essentials covered', c: 'good' };
  if (h.work < 6) return { t: 'Easing off', c: 'mid' };
  return { t: 'Overworked', c: 'bad' };
}

// Ownership presets
function gapsNow() {
  const g = {};
  for (const id of RES_IDS) g[id] = Math.max(0, expensesOf(id).total - incomeOf(id).total);
  return g;
}
function ownersFor(option) {
  if (option === 'equal') return { mara: 0.2, teo: 0.2, juno: 0.2, odile: 0.2, commons: 0.2 };
  if (option === 'odile') return { mara: 0.1, teo: 0.1, juno: 0.1, odile: 0.5, commons: 0.2 };
  if (option === 'brightline') return { brightline: 0.95, commons: 0.05 };
  if (option === 'need') {
    const g = gapsNow();
    const tot = RES_IDS.reduce((a, id) => a + g[id], 0);
    const o = { commons: 0.2 };
    if (tot <= 0) { for (const id of RES_IDS) o[id] = 0.2; return o; }
    const min = 0.06;
    for (const id of RES_IDS) o[id] = min + (0.8 - min * 4) * (g[id] / tot);
    return o;
  }
  return null;
}
function communityPartsFor(pid, option) {
  const cost = PROJECTS[pid].parts;
  if (option === 'brightline') return 0;
  if (option === 'odile') return Math.ceil(cost / 2);
  return cost;
}
function pledgesFor(pid, option) { return (pid === 'solar' && option !== 'brightline') ? (option === 'odile' ? 20 : 20) : 0; }
function affordable(partsNeeded) {
  const fromFund = Math.max(0, partsNeeded - S.parts);
  const fundCost = fromFund * 4;
  return { ok: fundCost <= S.fund, fromStock: Math.min(S.parts, partsNeeded), fromFund, fundCost };
}
function spendParts(n) {
  const a = affordable(n);
  S.parts -= a.fromStock; S.fund -= a.fundCost;
  return a;
}

// Evaluate a hypothetical: what would each household look like if pid ran with these owners?
function projectWith(pid, option) {
  const p = S.projects[pid];
  const saved = { status: p.status, owners: p.owners, option: p.option, ramp: p.ramp };
  const before = {};
  for (const id of RES_IDS) before[id] = { exp: expensesOf(id).total, inc: incomeOf(id).total, work: requiredWork(id) };
  p.status = 'online'; p.owners = ownersFor(option); p.option = option; p.ramp = 1;
  const after = {};
  for (const id of RES_IDS) after[id] = { exp: expensesOf(id).total, inc: incomeOf(id).total, work: requiredWork(id) };
  const econ = projectEcon(pid);
  const owners = p.owners;
  Object.assign(p, saved);
  return { before, after, econ, owners };
}

// ----- log + notifications (UI hooks filled in later) -----
const hooks = { toast: () => {}, bolt: () => {}, cutscene: () => {}, changed: () => {}, sfx: () => {} };
function logEvent(text, kind = 'note') {
  S.log.unshift({ day: S.day, text, kind });
  if (S.log.length > 80) S.log.length = 80;
}
function addStory(target, text) {
  if (!target.stories.includes(text)) target.stories.push(text);
}

// ----- weather -----
function rollWeather(day) {
  const scripted = { 1: 'cloudy', 2: 'sunny', 3: 'sunny', 4: 'cloudy', 5: 'sunny' };
  if (S.flags.stormNext) { S.flags.stormNext = false; return 'storm'; }
  if (scripted[day]) return scripted[day];
  const r = hash(day * 7.31);
  return r < 0.58 ? 'sunny' : r < 0.82 ? 'cloudy' : 'rain';
}

// ----- the night: accrue, build, adjust lives -----
function endOfDay() {
  const report = { day: S.day, weather: S.weather, projects: {}, households: {}, parts: 0, fund: 0, events: [] };
  // 1. income accrues for the day that just ended
  for (const pid in PROJECTS) {
    const p = S.projects[pid];
    if (p.status !== 'online') continue;
    const e = projectEcon(pid, true);
    report.projects[pid] = e;
    const net = Math.max(0, e.net);
    if (p.owners) {
      const c = (p.owners.commons || 0) * net;
      S.fund += c; report.fund += c;
    }
    if (e.fab) { const f = Math.round(e.fab * (p.owners && p.owners.brightline ? 0.4 : 1)); S.parts += f; report.parts += f; }
  }
  // 2. construction
  const finished = [];
  for (const pid in PROJECTS) {
    const p = S.projects[pid];
    if (p.status === 'building') {
      p.buildLeft--;
      if (p.buildLeft <= 0) { p.status = 'online'; p.builtDay = S.day + 1; if (pid === 'workshop') p.ramp = 0.6; finished.push(pid); }
    } else if (p.status === 'online' && pid === 'workshop' && p.ramp < 1) p.ramp = Math.min(1, round1(p.ramp + 0.2));
    if (p.pending) { p.upgrades[p.pending] = true; report.events.push(`${PROJECTS[pid].upgrades.find(u => u.id === p.pending).name} installed at the ${PROJECTS[pid].name}.`); p.pending = null; }
  }
  for (const cid in CREATIONS) {
    const c = S.creations[cid];
    if (c.status === 'building') { c.buildLeft--; if (c.buildLeft <= 0) { c.status = 'built'; c.builtDay = S.day + 1; finished.push(cid); } }
  }
  // 3. new day
  S.day++;
  if (S.flags.stormArmed && !S.flags.stormDone && online('solar')) { S.flags.stormNext = true; S.flags.stormDone = true; }
  S.weather = rollWeather(S.day);
  // Brightline's introductory discount ends
  if (online('solar') && S.projects.solar.option === 'brightline' && !S.flags.blHike && S.day - S.projects.solar.builtDay >= 2) {
    S.flags.blHike = true;
    report.events.push('A letter from Brightline: the introductory discount has ended. Power on the street now costs 10% more than it did before the array.');
    logEvent('Brightline ended its discount. Power bills went up.', 'note');
  }
  if (S.weather === 'storm' && online('solar') && !S.projects.solar.damaged) {
    S.projects.solar.damaged = true;
    report.events.push('A windstorm tore loose a row of panels on Sunfield. The array is running at half strength.');
    S.flags.solarDamaged = true;
  }
  // 4. households re-plan their week around expected income
  for (const id of RES_IDS) {
    const h = H(id);
    const before = h.work;
    h.worked = (h.worked || 0) + h.work;
    const req = requiredWork(id);
    let nw;
    if (req < h.work) nw = Math.max(req, h.work - 4.5);
    else nw = req;
    nw = nw <= 0.05 ? 0 : Math.ceil(nw * 2) / 2;
    h.work = nw;
    const free = freeTime(id);
    let target = 10 + free * 6.4 + (h.stage === 'thriving' ? 12 : 0) + h.rel * 0.06;
    target = clamp(target, 6, 100);
    h.energy = clamp(h.energy + (target - h.energy) * 0.45, 0, 100);
    // stage changes
    const prev = h.stage;
    if (h.work > 0) { if (h.stage === 'rest' || h.stage === 'thriving') { /* setback */ } h.stage = h.work >= 6 ? 'overworked' : 'easing'; }
    else if (prev === 'overworked' || prev === 'easing') { h.stage = 'rest'; h.stageDays = 0; h.coveredDay = S.day; }
    else if (prev === 'rest') {
      h.stageDays++;
      const need = { mara: 1, teo: 1, juno: 1, odile: 1 }[id];
      if ((h.stageDays >= need && (h.nudged || id === 'odile' || id === 'mara')) || h.stageDays >= need + 2) { h.stage = 'thriving'; h.stageDays = 0; }
    } else if (prev === 'thriving') h.stageDays++;
    if (prev !== h.stage) report.households[id] = { from: prev, to: h.stage };
    if (before - h.work >= 0.5) report.events.push(`${RES[id].short} cut ${fmtHours(before - h.work)} of paid work a day${h.work <= 0 ? ', and no longer needs a job to cover the essentials' : ''}.`);
    else if (h.work - before >= 0.5) report.events.push(`${RES[id].short} had to pick up ${fmtHours(h.work - before)} more work a day.`);
    if (prev !== 'thriving' && h.stage === 'thriving') report.events.push(thriveLine(id));
    h.history.push(snapshotHH(id));
    if (h.history.length > 60) h.history.shift();
  }
  // 5. story beats that happen overnight
  for (const pid of finished) onFinished(pid, report);
  morningStory(report);
  updateWarmthTarget();
  S.warmth = lerp(S.warmth, S.warmthTarget, 0.55);
  S.lastReport = report;
  return report;
}
function thriveLine(id) {
  return {
    mara: 'Mara baked bread this morning. The whole street smells of cardamom.',
    teo: S.households.teo.focus === 'bikes' ? 'Teo spent the morning rebuilding old bicycles with the robots.' : "Teo planted Rosa's purple artichokes.",
    juno: 'Juno took her sketchbook to the waterfall.',
    odile: "Odile closed the store early and dusted off her father's accordion.",
  }[id];
}

function onFinished(id, report) {
  if (id === 'solar') {
    report.events.unshift('The Community Solar array is online. Every home on the street now runs on sunlight.');
    logEvent('Community Solar came online.', 'milestone');
    if (S.quest === 'wait_solar') S.quest = 'ledger1';
    S.flags.fountainOn = true;
  }
  if (id === 'workshop') {
    report.events.unshift('The Robot Workshop opened. The first repair orders arrived from the valley before breakfast.');
    logEvent('The Robot Workshop opened.', 'milestone');
    S.flags.vanGone = true;
    if (S.quest === 'wait_workshop') S.quest = 'garden';
  }
  if (id === 'greenhouse') {
    report.events.unshift('The greenhouse is growing. The first basket of tomatoes went to Mara and Pip.');
    logEvent('The Automated Greenhouse started growing food.', 'milestone');
    if (S.quest === 'wait_greenhouse') S.quest = 'cover';
    S.flags.stormArmed = true;
  }
  if (id === 'kitchen') {
    report.events.unshift('The Shared Kitchen on the terrace is finished.');
    logEvent('The Shared Kitchen opened on the terrace.', 'milestone');
    if (S.quest === 'wait_kitchen') S.quest = 'breakfast';
  }
  if (id === 'garden') { report.events.unshift('The Waterfall Garden is finished.'); logEvent('The Waterfall Garden opened.', 'milestone'); }
  if (id === 'pavilion') { report.events.unshift('The Music Pavilion is finished.'); logEvent('The Music Pavilion opened.', 'milestone'); }
  rebuildColliders(S);
}

function allCovered() { return RES_IDS.every(id => H(id).work <= 0); }

function morningStory(report) {
  if (S.quest === 'cover' && allCovered() && !S.flags.afterlight) {
    S.flags.afterlight = true;
    S.flags.afterlightPending = true;
    S.quest = 'freedom';
    logEvent('Every household on the street has its essentials covered.', 'milestone');
  }
  if (S.quest === 'freedom' && H('mara').stage === 'thriving' && S.creations.kitchen.status === 'locked') {
    S.creations.kitchen.status = 'teased';
  }
  if (S.quest === 'cover' || S.quest === 'freedom') {
    // The workshop's arrival lets Teo stop driving: his van is gone
  }
}

function updateWarmthTarget() {
  let e = 0, f = 0;
  for (const id of RES_IDS) { e += clamp((H(id).energy - 30) / 60, 0, 1); f += clamp((freeTime(id) - 3.5) / 10, 0, 1); }
  e /= 4; f /= 4;
  let w = 0.04 + 0.58 * (0.5 * e + 0.5 * f);
  for (const pid in PROJECTS) { if (online(pid)) w += 0.04; for (const u in S.projects[pid].upgrades) w += 0.02; }
  for (const id of RES_IDS) if (H(id).stage === 'thriving') w += 0.03;
  for (const cid in CREATIONS) if (S.creations[cid].status === 'built') w += 0.04;
  if (S.flags.breakfastDone) w += 0.05;
  S.warmthTarget = clamp(w, 0, 1);
}

// ----- quests and objectives -----
const QUEST_ORDER = ['meet', 'idea_solar', 'plan_solar', 'wait_solar', 'ledger1', 'van', 'idea_workshop', 'plan_workshop', 'wait_workshop', 'garden', 'idea_greenhouse', 'plan_greenhouse', 'wait_greenhouse', 'cover', 'freedom', 'kitchen', 'wait_kitchen', 'breakfast', 'epilogue'];
function questIndex(q) { return QUEST_ORDER.indexOf(q || S.quest); }
function setQuest(q) {
  if (questIndex(q) <= questIndex()) return;
  S.quest = q;
  hooks.sfx('quest');
  hooks.changed();
}

function salvageAvailable(key) {
  const sv = SALVAGE[key];
  if (S.salvage[key]) return false;
  const p = S.projects[sv.unlock];
  return p.status !== 'locked';
}

function objectives() {
  const out = [];
  const q = S.quest;
  const met = RES_IDS.filter(id => H(id).met).length;
  const resPos = id => { const n = NPCS[id]; return n && n.visible ? { x: n.x, y: n.y } : null; };
  const near = ids => { let best = null, bd = Infinity; for (const id of ids) { const p = resPos(id); if (p) { const d = dist(p.x, p.y, S.player.x, S.player.y); if (d < bd) { bd = d; best = p; } } } return best; };
  const partsLine = (pid) => {
    const need = PROJECTS[pid].parts;
    return `Parts on hand: ${S.parts} of ${need}`;
  };
  if (q === 'meet') {
    const left = RES_IDS.filter(id => !H(id).met);
    out.push({ text: `Meet your neighbors (${met}/4)`, detail: 'Walk up to someone and press E, or tap them. ' + (left.length ? 'Still to meet: ' + left.map(id => RES[id].short).join(', ') + '.' : ''), target: near(left) || POI.plaza });
  } else if (q === 'idea_solar') {
    out.push({ text: 'Sketch an idea at your workbench', detail: 'Power bills came up with almost everyone. Your workbench is outside your workshop, east of the plaza.', target: POI.workbench });
  } else if (q === 'plan_solar' || q === 'plan_workshop' || q === 'plan_greenhouse') {
    const pid = q.split('_')[1];
    out.push({ text: `Call a town meeting about the ${PROJECTS[pid].name}`, detail: 'The notice board on the plaza is where the street decides who owns what. ' + partsLine(pid) + '.', target: POI.notice });
    const sv = Object.keys(SALVAGE).filter(k => SALVAGE[k].unlock === pid && !S.salvage[k]);
    if (sv.length) out.push({ text: 'Find salvage: ' + sv.map(k => SALVAGE[k].name).join(', '), detail: 'Parts are the community’s building material. ' + SALVAGE[sv[0]].text, target: POI[SALVAGE[sv[0]].poi], side: true });
  } else if (q === 'wait_solar' || q === 'wait_workshop' || q === 'wait_greenhouse' || q === 'wait_kitchen') {
    const id = q.split('_')[1];
    const obj = PROJECTS[id] ? S.projects[id] : S.creations[id];
    const name = (PROJECTS[id] || CREATIONS[id]).name;
    out.push({ text: `The ${name} is being built`, detail: `${obj.buildLeft} night${obj.buildLeft === 1 ? '' : 's'} to go. Explore and talk to people, or press "Next morning" to skip ahead.`, target: lotCenter((PROJECTS[id] || CREATIONS[id]).lot) });
  } else if (q === 'ledger1') {
    out.push({ text: 'Open the Ledger to see what changed', detail: 'Press L or the Ledger button. See where the solar money goes and what happened to everyone’s bills.', target: null });
  } else if (q === 'van') {
    out.push({ text: "Teo's van broke down. Find Teo.", detail: 'He stayed home today. He has been looking at your garage with interest.', target: resPos('teo') || BUILDINGS.teo.door });
  } else if (q === 'idea_workshop') {
    out.push({ text: 'Draft the Robot Workshop at your workbench', detail: 'Teo will teach the old robots in your garage.', target: POI.workbench });
  } else if (q === 'garden') {
    out.push({ text: 'Ask Teo about his garden', detail: 'Now that he is home before dark, Teo has been pulling weeds.', target: resPos('teo') || BUILDINGS.teo.door });
  } else if (q === 'idea_greenhouse') {
    out.push({ text: 'Draft the Automated Greenhouse at your workbench', detail: 'Food is the next-biggest bill on the street.', target: POI.workbench });
  } else if (q === 'cover') {
    const short = RES_IDS.filter(id => H(id).work > 0);
    out.push({ text: "Cover everyone's essentials", detail: short.length ? 'Still working for the essentials: ' + short.map(id => `${RES[id].short} (${fmtHours(H(id).work)}/day)`).join(', ') + '. Add upgrades at the project sites, or change who owns what.' : 'Everyone is covered. It will show in the morning.', target: null });
  } else if (q === 'freedom') {
    const left = RES_IDS.filter(id => !S.seen['free_' + id]);
    out.push({ text: `See how your neighbors spend their first free days (${4 - left.length}/4)`, detail: 'There is no right answer. Some people rest. Some start something. Days pass with "Next morning".', target: near(left) });
    if (S.creations.kitchen.status === 'teased') out.push({ text: 'Mara has an idea. Go see her.', detail: 'She has been baking.', target: resPos('mara'), side: true });
  } else if (q === 'kitchen') {
    out.push({ text: 'Plan the Shared Kitchen on the old terrace', detail: 'The terrace is east of the store. Choose a style, what it holds, and how it gets built.', target: POI.terraceSpot });
  } else if (q === 'breakfast') {
    const hour = S.minute / 60;
    out.push({ text: 'Host the first breakfast at the terrace kitchen', detail: hour >= 6 && hour < 11.5 ? 'Everyone is invited. Go to the kitchen.' : 'Breakfast happens between 6:00 and 11:30. Press "Next morning" or wait.', target: POI.kitchenTable });
  } else if (q === 'epilogue') {
    const opts = [];
    if (S.creations.garden.status === 'available') opts.push('the Waterfall Garden');
    if (S.creations.pavilion.status === 'available') opts.push('the Music Pavilion');
    out.push({ text: 'Make the town your own', detail: (opts.length ? 'You can still build ' + opts.join(' and ') + '. ' : '') + 'Wander, talk, watch the town live. Riverside, over the bridge, is next.', target: null });
  }
  // side objectives
  if (S.projects.solar.damaged) out.push({ text: 'Repair the storm-damaged array', detail: 'Costs 8 parts. Sunfield meadow, south-east.', target: POI.sunfield, side: true });
  if (odileShareReady()) out.push({ text: 'Odile wants a word', detail: 'Something about her shares.', target: resPos('odile'), side: true });
  if (buybackAvailable()) { const bp = buybackPid(); out.push({ text: `Buy back the ${PROJECTS[bp].name} from ${buybackSeller(bp)}`, detail: `The Commons Fund has ${fmtMoney(S.fund)} of the ${fmtMoney(buybackPrice(bp))} needed.${S.projects[bp].option === 'brightline' ? ' The price goes up every day.' : ''} Use the notice board.`, target: POI.notice, side: true }); }
  const cp = S.projects.compute;
  if (cp.status === 'idea') out.push({ text: "Juno's idea: draft Community Compute", detail: 'At your workbench. Racks in the old depot yard, running on the array.', target: POI.workbench, side: true });
  if (cp.status === 'drafted' && !Object.keys(PROJECTS).some(k => k !== 'compute' && S.projects[k].status === 'drafted')) out.push({ text: 'Call a town meeting: Community Compute', detail: `Who owns the racks? Parts on hand: ${S.parts} of ${PROJECTS.compute.parts}.`, target: POI.notice, side: true });
  return out;
}
function lotCenter(lot) { const L = LOTS[lot]; return { x: L.x + L.w / 2, y: L.y + L.d + 10 }; }

function odileShareReady() {
  if (S.flags.odileShared) return false;
  const any = Object.values(S.projects).some(p => p.status === 'online' && p.option === 'odile');
  return any && H('odile').work <= 0 && RES_IDS.some(id => id !== 'odile' && H(id).work > 0);
}
// Projects the Commons Fund can buy back: anything Brightline owns, or Odile's stake if she chose to keep it.
function buybackPid() {
  for (const pid in PROJECTS) { const p = S.projects[pid]; if (p.status === 'online' && (p.option === 'brightline' || (p.option === 'odile' && S.flags.odileKept))) return pid; }
  return null;
}
function buybackSeller(pid) { return S.projects[pid].option === 'brightline' ? 'Brightline' : 'Odile'; }
function buybackPrice(pid = buybackPid()) {
  if (!pid) return 0;
  const p = S.projects[pid], net = Math.max(0, projectEcon(pid).net);
  if (p.option === 'odile') return Math.round(Math.max(100, p.owners.odile * net * 5) / 10) * 10;
  const days = clamp(S.day - p.builtDay, 0, 10);
  return Math.round(Math.max(150, net * 3) * (1 + 0.1 * days) / 10) * 10;
}
function buybackAvailable() { return !!buybackPid(); }
function doBuyback(pid = buybackPid()) {
  if (!pid) return false;
  const price = buybackPrice(pid);
  if (S.fund < price) return false;
  const seller = buybackSeller(pid);
  S.fund -= price;
  const p = S.projects[pid];
  p.option = 'equal'; p.owners = ownersFor('equal');
  S.flags['bought_' + pid] = seller;
  addStory(p, `Day ${S.day}: the Commons Fund bought the ${PROJECTS[pid].name} from ${seller} for ${fmtMoney(price)}.`);
  logEvent(`The street bought the ${PROJECTS[pid].name} from ${seller}.`, 'milestone');
  return true;
}
function doOdileKeep() {
  S.flags.odileShared = true; S.flags.odileKept = true;
  logEvent('Odile kept her stake. The Commons Fund can still buy it from her.', 'note');
}
// Who owns the street's engine: each owner's slice of what every running project earns.
function engineShares() {
  const out = {}; let tot = 0;
  for (const pid in PROJECTS) {
    const p = S.projects[pid]; if (p.status !== 'online' || !p.owners) continue;
    const net = Math.max(0, projectEcon(pid).net);
    for (const k in p.owners) { out[k] = (out[k] || 0) + p.owners[k] * net; tot += p.owners[k] * net; }
  }
  return { by: out, tot };
}
function doOdileShare() {
  S.flags.odileShared = true;
  const g = gapsNow();
  const others = RES_IDS.filter(id => id !== 'odile');
  for (const pid in S.projects) {
    const p = S.projects[pid];
    if (p.option !== 'odile' || !p.owners) continue;
    const give = p.owners.odile * 0.5;
    p.owners.odile -= give;
    const tot = others.reduce((a, id) => a + g[id] + 0.01, 0);
    for (const id of others) p.owners[id] += give * (g[id] + 0.01) / tot;
    p.option = 'odile-shared';
    addStory(p, `Day ${S.day}: Odile moved half her stake into her neighbors' names.`);
  }
  logEvent("Odile shared half her stake with the neighbors who needed it.", 'milestone');
}
