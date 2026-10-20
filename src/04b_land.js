// Land use: every town lot has a use and an owner. Uses go vacant as the economy shifts
// (cars give way to robotaxis, paid work and retail shrink), and vacant lots get redeveloped
// by whoever owns them, according to their own interests. Nothing here is scripted by date.
const LOT_USE = {
  // present day
  house: { label: 'House', color: '#b98f5e' }, shop: { label: 'Shop', color: '#d9774b' }, office: { label: 'Office', color: '#8fa3b8' },
  parking: { label: 'Parking lot', color: '#5b5f66' }, gas: { label: 'Gas station', color: '#cfcfcf' }, restaurant: { label: 'Restaurant', color: '#c0504d' },
  carlot: { label: 'Car dealership', color: '#9aa0a8' }, motel: { label: 'Motel', color: '#c7a26a' }, church: { label: 'Church', color: '#d8d0c0' },
  bigbox: { label: 'Big-box store', color: '#7d8fb0' }, warehouse: { label: 'Warehouse', color: '#7a6a5a' },
  // what comes after
  garden: { label: 'Community garden', color: '#5aa04a' }, apartments: { label: 'Apartments', color: '#c4876a' }, makerspace: { label: 'Makerspace', color: '#b07cc6' },
  vfarm: { label: 'Vertical farm', color: '#3fae7a' }, vacant: { label: 'Vacant', color: '#4a4440' },
  solar: { label: 'Solar canopy', color: '#24345e' }, compute: { label: 'Compute', color: '#2f3644' }, fleet: { label: 'Robot depot', color: '#41525c' }, factory: { label: 'Micro-fab', color: '#8d6e63' },
};
const ASSET_USES = new Set(['solar', 'compute', 'fleet', 'factory']);

function landSignals() {
  const P = S.P, M = S.market;
  const rt = clamp((P.robotaxi || 0) + Math.max(0, P.autoFrac - 0.45) * 0.7, 0, 0.95); // share of trips in robotaxis
  const work = clamp(M.humanNeed / Math.max(1, S.base.humanNeed), 0, 1.5);               // paid human work vs. year 1
  const retail = clamp(1 - 0.45 * rt - Math.max(0, P.autoFrac - 0.35) * 0.5, 0.3, 1);   // delivery robots eat walk-in retail
  return { rt, car: 1 - rt, work, retail };
}
const VIABILITY = {
  parking: s => s.car, gas: s => Math.pow(s.car, 1.6), carlot: s => Math.pow(s.car, 2), office: s => s.work, shop: s => s.retail, bigbox: s => s.retail * 0.9,
  restaurant: s => 0.6 + 0.4 * s.retail, church: () => 0.85, motel: s => 0.4 + 0.6 * s.car, warehouse: s => 0.3 + 0.7 * s.work, vacant: () => 0,
};
function countUse(u) { return S.lots.filter(l => l.use === u).length; }
function lotValue(l) { return l.w * l.h * 1800 * (1 + S.day / 720); }

function lotOwnerValues(owner) {
  if (S.hh[owner]) return householdValues(S.hh[owner]);
  // the unsimulated local owners lean like the town does on average
  const w = { self: 0, family: 0, community: 0, nation: 0 }, ad = S.people.filter(p => p.age !== 'kid' && !p.isPlayer);
  ad.forEach(p => SPHERES.forEach(k => w[k] += p.w[k] / ad.length));
  return w;
}

function setUse(l, use, note) {
  if (l.use === use) return;
  l.history.push({ day: S.day, use, owner: l.owner });
  l.use = use; l.vac = use === 'vacant' ? 1 : 0; l.since = S.day;
  if (note) log(note, ownerKind(l.owner) === 'outside' ? 'helix' : l.owner === 'town' ? 'town' : 'build');
}

// A lot becomes a productive asset. The owner pays for the build.
function lotToAsset(l, type, owner, opts = {}) {
  const units = (l.w * l.h / 20) * ({ solar: 0.12, compute: 8, fleet: 8, factory: 0.12 }[type]);
  const cost = units * unitCost(type);
  if (!opts.prepaid) {
    if (owner === 'helix') { if (S.helix.monthBudget < cost) return null; S.helix.monthBudget -= cost; }
    else if (owner === 'town') { if (S.town.cash < cost) return null; S.town.cash -= cost; }
    else if (S.hh[owner]) { if (S.hh[owner].cash < cost) return null; S.hh[owner].cash -= cost; }
  }
  const prefix = owner === 'helix' ? 'Helix ' : owner === 'town' ? 'Commons ' : S.hh[owner] ? S.hh[owner].name + ' ' : 'Local ';
  const name = opts.name || prefix + LOT_USE[type].label + ' ' + (++S.counter);
  const site = makeSite(type, name, l, { asset: true, lot: l });
  S.sites.push(site);
  const a = placeAsset(type, name, owner, opts.units != null ? opts.units : units, { site, immediate: type === 'fleet' && !opts.units, coop: opts.coop });
  if (type === 'fleet' && opts.units == null) { a.shares = {}; a.cap = 0; orderRobots(owner, units, a); }
  l.site = site; l.asset = a;
  const was = LOT_USE[l.use].label.toLowerCase();
  setUse(l, type, opts.quiet ? null : `${ownerName(owner)} turned a ${was} into ${name}.`);
  return a;
}

function sellLot(l, buyer) {
  const price = lotValue(l);
  if (buyer === 'helix') S.helix.cash -= price; else if (buyer === 'town') S.town.cash -= price; else if (S.hh[buyer]) S.hh[buyer].cash -= price;
  if (S.hh[l.owner]) S.hh[l.owner].cash += price; else if (l.owner === 'helix') S.helix.cash += price; else if (l.owner === 'town') S.town.cash += price;
  log(`${ownerName(l.owner) === 'local owner' ? 'A local owner' : ownerName(l.owner)} sold a ${LOT_USE[l.use].label.toLowerCase()} lot to ${ownerName(buyer)} for ${money(price)}.`, buyer === 'helix' ? 'helix' : 'town');
  l.owner = buyer;
}

function redevelop(l) {
  const sig = landSignals(), P = S.P, M = S.market;
  const roi = ['solar', 'compute', 'fleet'].map(t => ({ t, r: annualReturn(t) })).sort((a, b) => b.r - a.r)[0];
  const done = id => S.discoveries.some(d => d.id === id);
  // outside capital bids for vacant land when it has a use for it
  if (l.owner !== 'helix' && l.owner !== 'town' && roi.r > P.helixHurdle && S.helix.monthBudget > lotValue(l) * 3) {
    const w = lotOwnerValues(l.owner);
    const sells = l.owner === 'private' ? 0.7 : 0.25 + w.self * 0.8;
    if (rand() < sells) {
      const town = S.policy.firstRefusal && S.town.cash > lotValue(l) * 2;
      sellLot(l, town ? 'town' : 'helix');
    }
  }
  const o = l.owner, w = lotOwnerValues(o);
  if (o === 'helix') {
    const t = sig.rt > 0.35 && rand() < 0.3 ? 'fleet' : roi.t;
    if (lotToAsset(l, t, 'helix')) return;
  }
  if (o === 'town') {
    const t = M.shortC > M.shortE ? 'compute' : 'solar';
    if (S.town.cash > 200000 && lotToAsset(l, t, 'town')) return;
  }
  if (S.hh[o]) {
    const h = S.hh[o];
    const t = weighted([{ w: w.self, v: roi.t }, { w: w.community, v: 'garden' }, { w: w.family, v: 'apartments' }, { w: w.nation, v: 'makerspace' }]);
    if (ASSET_USES.has(t)) { if (lotToAsset(l, t, o)) return; }
    else { setUse(l, t, `The ${h.name} household turned their ${LOT_USE[l.use].label.toLowerCase()} into a ${LOT_USE[t].label.toLowerCase()}.`); return; }
  }
  // everyone else repurposes cheaply, shaped by the town's mood and what's been invented
  const opts = [
    { w: w.community * 1.4 / (1 + countUse('garden') / 4), v: 'garden' }, { w: w.family * 1.2, v: 'apartments' }, { w: 0.25 + w.nation * 0.4, v: 'makerspace' },
    { w: done('vfarms') ? 0.9 / (1 + countUse('vfarm') / 3) : 0, v: 'vfarm' }, { w: l.use === 'vacant' ? 0 : 0.5, v: 'vacant' },
  ];
  // the old use suggests the new one: parking and gas become solar canopies, warehouses robot depots, offices server rooms
  const was = l.use;
  if (was === 'parking' || was === 'gas' || was === 'carlot') opts.push({ w: 1.6 * clamp(annualReturn('solar'), 0, 1.5), v: 'solar' });
  if (was === 'warehouse' || was === 'bigbox') opts.push({ w: 1.4, v: 'fleet' });
  if (was === 'office') opts.push({ w: 0.8 * clamp(annualReturn('compute'), 0, 1.5), v: 'compute' });
  if (was === 'gas' && sig.rt > 0.3) opts.push({ w: 0.8, v: 'fleet' }); // robotaxi charging depot
  const t = weighted(opts);
  if (ASSET_USES.has(t)) { if (lotToAsset(l, t, o, { prepaid: true })) return; }
  setUse(l, t, t === 'vacant' ? null : `A ${LOT_USE[l.use].label.toLowerCase()} became a ${LOT_USE[t].label.toLowerCase()}.`);
}

// Investors who need land for a new asset take the most redevelopable lot in town, else a field.
function lotForInvestor(owner) {
  const cands = S.lots.filter(l => !l.site && l.use !== 'house' && !l.locked && (l.owner === owner || l.owner === 'private' || (S.hh[l.owner] && owner !== 'helix')) && (l.vac > 0.3 || l.use === 'vacant' || l.use === 'parking' && landSignals().car < 0.8));
  cands.sort((a, b) => b.vac - a.vac);
  return cands[0] || null;
}

function landMonth() {
  const sig = landSignals();
  for (const l of S.lots) {
    if (l.site || l.locked) continue;
    const v = VIABILITY[l.use];
    if (v) l.vac = lerp(l.vac, clamp(1 - v(sig), 0, 1), 0.35);
    if (l.use === 'house') {
      // rooftop solar spreads when it pays
      if (!l.roof && rand() < clamp((annualReturn('solar') - 0.12) * 0.25, 0, 0.12)) { l.roof = true; addShares(S.neighborRoofs, 'neighbors', 0.008); }
      continue;
    }
    if ((l.vac > 0.5 || l.use === 'vacant') && rand() < 0.22) redevelop(l);
  }
}

function eraName() {
  const n = S.discoveries.length;
  return n === 0 ? 'Present day' : n <= 3 ? 'Early AI' : n <= 7 ? 'Automation' : n <= 11 ? 'Abundance' : 'Singularity';
}
