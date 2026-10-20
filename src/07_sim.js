// Creating the world and stepping it.
function newWorld(seed = 7) {
  rand = makeRng(seed);
  SITE_ID = 0; AGENT_ID = 0;
  S = {
    seed, t: 6, day: 0, P: baseParams(), terrain: buildTerrain(), parcels: buildParcels(), sites: [], assets: [], households: [], hh: {}, agents: [], people: [], robots: [],
    orders: [], coops: [], log: [], history: [], discoveries: [], council: null, policy: { firstRefusal: false }, counter: 0, nextAsset: 0, volHours: 0,
    helix: { cash: 5e7, monthBudget: 0, depot: null }, town: { cash: 40000 }, nation: { research: 0 },
    market: { mE: 1, mC: 1, mX: 1, mL: 1, dE: 1, dCL: 1, dCX: 1, sC: 1, pe: 80, pc: 120, jobOpen: 1, offeredAvg: 200, outflow: 0, robotCarry: 0, shortE: 0, shortC: 0, ubi: 0, solarOut: 1, L: 350, robotWork: 0 },
    nextDiscoveryDay: 75, actions: [],
  };
  // civic and job sites
  const add = (kind, name, r, extra) => { const s = makeSite(kind, name, r, extra); S.sites.push(s); return s; };
  add('plaza', 'Plaza', blockRect(2, 2)); add('park', 'Park', blockRect(2, 3));
  for (const [kind, name, [i, j], weight, hi] of JOB_SITES) add(kind, name, blockRect(i, j), { jobWeight: weight, hiSkill: hi });
  add('farm', 'Moreno Farm', { x: 66, y: 110, w: 26, h: 18 }, { jobWeight: 1.0, hiSkill: 0, door: { x: 96, y: 108, ry: 100 } });
  add('station', 'Federal Works / Rail', { x: 104, y: 102, w: 12, h: 5 }, { door: { x: 108, y: 104, ry: 100 } });
  const campus = { x: 152, y: 14, w: 38, h: 30 };
  // assets
  const asset = (type, name, rect, shares, cap, extra = {}) => {
    const site = add(type, name, rect, { asset: true, ...extra });
    const a = placeAsset(type, name, null, 0, { site, immediate: true });
    a.shares = { ...shares }; a.cap = cap;
    return a;
  };
  asset('solar', 'Town Solar', blockRect(3, 1), { town: 1 }, 0.6);
  const hs = asset('solar', 'Helix Solar Farm', { x: campus.x, y: campus.y, w: 22, h: campus.h }, { helix: 1 }, 3.0, { door: { x: 150, y: 44, ry: 50 } });
  asset('compute', 'Helix Datacenter', { x: campus.x + 24, y: campus.y + 4, w: 14, h: 22 }, { helix: 1 }, 20, { jobWeight: 0.8, hiSkill: 1, door: { x: 150, y: 44, ry: 50 } });
  // households
  const homeSlots = [];
  for (let k = 0; k < 4; k++) for (const [i, j] of HOME_BLOCKS) { const b = blockRect(i, j); homeSlots.push({ x: b.x + (k % 2) * 6, y: b.y + Math.floor(k / 2) * 5, w: 4, h: 3.6 }); }
  const usedFirst = new Set();
  const firstName = () => { let n; do n = pick(FIRST); while (usedFirst.has(n) && usedFirst.size < FIRST.length); usedFirst.add(n); return n; };
  const mkWeights = (bias) => { const w = { self: rr(0.15, 0.5), family: rr(0.15, 0.5), community: rr(0.05, 0.35), nation: rr(0.05, 0.3) }; if (bias) w[bias] += 0.25; return normalize(w); };
  const nH = 16;
  for (let i = 0; i <= nH; i++) {
    const isPlayer = i === nH;
    const slot = homeSlots[i];
    const name = isPlayer ? 'You' : FAMILY_NAMES[i];
    const site = add('home', isPlayer ? 'Your place' : name + ' home', slot, { small: true });
    const h = { id: 'h' + i, name, site, members: [], cash: isPlayer ? 9000 : rr(2000, 22000), isPlayer, trust: 0.3 };
    site.household = h;
    S.households.push(h); S.hh[h.id] = h;
    if (isPlayer) continue;
    const bias = pick([null, 'self', 'family', 'community', 'nation', null]);
    const kids = rand() < 0.5 ? Math.floor(rr(1, 3)) : 0, adults = rand() < 0.75 ? 2 : 1, elder = rand() < 0.25 ? 1 : 0;
    const roles = [...Array(adults).fill('adult'), ...Array(kids).fill('kid'), ...Array(elder).fill('elder')];
    for (const age of roles) {
      const w = mkWeights(bias);
      if (age === 'kid') { w.family += 0.2; normalize(w); }
      const m = { name: firstName() + ' ' + name, first: '', age, w, skill: age === 'kid' ? rr(0.1, 0.3) : rr(0.2, 0.8), home: h };
      m.first = m.name.split(' ')[0];
      h.members.push(m);
    }
  }
  // famous starting stakes
  const okafor = S.hh.h0, patel = S.hh.h1;
  okafor.cash += 30000; patel.cash += 20000;
  asset('factory', 'Okafor Fabrication', blockRect(1, 2), { [okafor.id]: 1 }, 0.25, { jobWeight: 1.0, hiSkill: 1 });
  asset('compute', 'Valley Compute', blockRect(4, 1), { helix: 0.7, [patel.id]: 0.3 }, 4, { jobWeight: 0.5, hiSkill: 1 });
  const depot = asset('fleet', 'Helix Robot Depot', blockRect(4, 2), { helix: 1 }, 12, { jobWeight: 0.4, hiSkill: 0 });
  S.helix.depot = depot.id;
  [S.hh.h2, S.hh.h5, S.hh.h9].forEach(h => { const a = placeAsset('solar', h.name + ' rooftop', null, 0, { site: h.site, immediate: true }); a.shares = { [h.id]: 1 }; a.cap = 0.03; a.rooftop = true; });
  // jobs
  S.jobSites = S.sites.filter(s => s.jobWeight);
  for (const h of S.households) for (const m of h.members) {
    const agent = new Agent(m);
    if (m.age === 'adult') {
      const pool = S.jobSites.filter(s => (s.hiSkill ? m.skill > 0.45 : m.skill <= 0.6));
      agent.job = weighted(pool.map(s => ({ w: s.jobWeight, v: s })));
    }
    const p = spotIn(h.site, 0.4); agent.position.set(p.x, p.y, 0);
    h.members[h.members.indexOf(m)] = agent;
    S.agents.push(agent); S.people.push(agent);
  }
  // the player
  const ph = S.households.find(h => h.isPlayer);
  const you = new Agent({ name: 'You', first: 'You', age: 'adult', w: normalize({ self: 0.25, family: 0.25, community: 0.25, nation: 0.25 }), skill: 0.6, home: ph, isPlayer: true, trust: 1 });
  const pp = spotIn(ph.site, 0.4); you.position.set(pp.x, pp.y, 0);
  you.job = siteOf('repair');
  ph.members.push(you); S.agents.push(you); S.people.push(you); S.player = you;
  econDay(); // fill in the market numbers for day 0
  syncRobots();
  log('Year 1. The valley runs on Helix\'s solar farm and datacenter. Most of the engine is owned from outside.', 'info');
  sampleHistory();
  return S;
}

// One fixed step of the world, dt in hours.
function simStep(dt) {
  SIM.dt = dt;
  const prevDay = S.day;
  S.t += dt;
  S.day = Math.floor(S.t / 24);
  for (const a of S.people) a.tick(dt);
  for (const r of S.robots) r.tick(dt);
  if (S.day !== prevDay) dayRollover();
}

function dayRollover() {
  econDay();
  for (const p of S.people) p.daily();
  for (const h of S.households) { const ad = h.members.filter(m => m.age !== 'kid'); h.trust = ad.length ? sum(ad, m => m.trust) / ad.length : 0.3; }
  for (const c of S.coops) if (c.open && S.day >= c.deadline) closeCoop(c);
  if (S.council && S.day > S.council.day) resolveCouncil();
  syncRobots();
  // discoveries
  const rate = S.P.researchBoost * (1 + Math.min(0.5, S.nation.research / 400));
  S.discoveryClock = (S.discoveryClock || 0) + rate;
  if (S.discoveryClock >= S.P.discoveryEvery * rr(0.8, 1.2) && S.day >= S.nextDiscoveryDay) { S.discoveryClock = 0; discover(); }
}

function discover(id) {
  const done = new Set(S.discoveries.map(d => d.id));
  let left = DISCOVERIES.filter(d => !done.has(d.id));
  if (!left.length) left = [nextGenDiscovery(S.discoveries.length)];
  const tier = Math.min(...left.map(d => d.tier));
  const d = id ? DISCOVERIES.find(x => x.id === id) : pick(left.filter(x => x.tier === tier));
  if (d && d.generated) DISCOVERIES.push(d);
  if (!d || done.has(d.id)) return null;
  d.fx(S.P);
  S.discoveries.push({ id: d.id, title: d.title, day: S.day });
  log(`DISCOVERY: ${d.title}. ${d.changes.join('; ')}.`, 'discovery');
  S.nextDiscoveryDay = S.day + 60;
  if (typeof onDiscovery === 'function') onDiscovery(d);
  return d;
}
