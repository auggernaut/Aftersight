// State, ownership and the daily economy.
// Owners: households ('h1'...), 'helix' (outside company), 'town' (the commons).
// Every productive asset has fractional shares; when someone adds capacity, shares re-weight by value.
let S = null;

const ASSET_LABEL = { solar: 'Solar', compute: 'Compute', factory: 'Robot factory', fleet: 'Robot fleet' };
function unitCost(type) {
  const P = S.P;
  return type === 'solar' ? P.solarCost : type === 'compute' ? P.rackCost : type === 'factory' ? P.factoryCost : P.robotCost;
}
const UNIT_NAME = { solar: 'MW', compute: 'racks', factory: 'robots/day', fleet: 'robots' };
function assetValue(a) { return a.cap * unitCost(a.type); }
function ownerName(id) {
  if (id === 'helix') return 'Helix Systems (outside)';
  if (id === 'town') return 'Town commons';
  const h = S.hh[id];
  return h ? (h.isPlayer ? 'You' : h.name + ' household') : id;
}
function ownerKind(id) { return id === 'helix' ? 'outside' : id === 'town' ? 'town' : 'resident'; }

function addShares(a, owner, units) {
  // value-weighted dilution: existing owners keep their units, newcomer gets theirs
  const total = a.cap + units;
  if (total <= 0) return;
  for (const k in a.shares) a.shares[k] *= a.cap / total;
  a.shares[owner] = (a.shares[owner] || 0) + units / total;
  a.cap = total;
}
function transferShare(a, from, to, frac) {
  const f = Math.min(frac, a.shares[from] || 0);
  if (f <= 0) return 0;
  a.shares[from] -= f;
  if (a.shares[from] < 1e-6) delete a.shares[from];
  a.shares[to] = (a.shares[to] || 0) + f;
  return f;
}
function isCoop(a) { return Object.keys(a.shares).filter(k => ownerKind(k) === 'resident').length >= 3; }
function localShare(a) { return sum(Object.entries(a.shares), ([k, v]) => k === 'helix' ? 0 : v); }

function placeAsset(type, name, owner, units, opts = {}) {
  let site = opts.site;
  if (!site) {
    const pref = opts.outside ? S.parcels.filter(p => !p.used && !p.town) : S.parcels.filter(p => !p.used && p.town).concat(S.parcels.filter(p => !p.used && !p.town));
    const parcel = pref[0];
    if (!parcel) return null;
    parcel.used = true;
    site = makeSite(type, name, parcel, { asset: true });
    S.sites.push(site);
  }
  const a = { id: 'a' + (++S.nextAsset), type, name, cap: 0, shares: {}, site, pending: [], built: S.day, coop: !!opts.coop, out: 0, profit: 0 };
  site.assets = site.assets || [];
  site.assets.push(a);
  if (opts.immediate) addShares(a, owner, units);
  else a.pending.push({ owner, units, done: S.day + S.P.buildDays[type], start: S.day, contrib: opts.contrib });
  S.assets.push(a);
  return a;
}
function expandAsset(a, owner, units, contrib) {
  const d = S.P.buildDays[a.type];
  if (d <= 0) addShares(a, owner, units);
  else a.pending.push({ owner, units, done: S.day + d, start: S.day, contrib });
}

function log(text, kind = 'info') {
  S.log.unshift({ t: S.t, text, kind });
  if (S.log.length > 80) S.log.pop();
}

// ---------- the daily tick ----------
function econDay() {
  const P = S.P, M = S.market;
  const day = S.day;
  const people = S.agents.filter(a => !a.isRobot);
  const pop = people.length;
  const season = 1 + 0.22 * Math.sin(2 * Math.PI * (day - 90) / 360);

  // finish construction (volunteers speed it up)
  for (const a of S.assets) {
    a.pending = a.pending.filter(p => {
      if (day >= p.done) { addShares(a, p.owner, p.units); if (ownerKind(p.owner) !== 'resident' || p.units * unitCost(a.type) > 25000 || a.cap === p.units) log(`${a.name} ${a.cap === p.units ? 'opened' : 'expanded'} (+${num(p.units)} ${UNIT_NAME[a.type]}, ${ownerName(p.owner)})`, 'build'); return false; }
      return true;
    });
  }
  const by = t => S.assets.filter(a => a.type === t && a.cap > 0);
  const solar = by('solar'), racks = by('compute'), facs = by('factory'), fleets = by('fleet');
  const nRobots = sum(fleets, f => f.cap);

  // ENERGY
  const solarOut = sum(solar, a => a.cap) * P.solarYield * season;
  const robotsBuilt = Math.min(sum(facs, f => f.cap) * (P.factoryMult || 1), S.orders.reduce((s, o) => s + o.units, 0) + 0.0001);
  const dHome = pop * P.homeE * M.mE, dRobot = nRobots * P.robotE, dFac = robotsBuilt * P.factoryE, dRack = sum(racks, a => a.cap) * P.rackE;
  const dE = dHome + dRobot + dFac + dRack;
  const deficit = Math.max(0, dE - solarOut);
  const imp = Math.min(deficit, P.gridCap);
  const servedE = dE > 0 ? Math.min(1, (solarOut + imp) / dE) : 1;
  M.pe = lerp(M.pe, P.peBase * clamp(Math.pow(dE / Math.max(0.01, solarOut), 0.7), 0.35, 6), 0.25);
  const soldE = Math.min(solarOut, dE);

  // COMPUTE: locally owned racks serve local demand first; Helix sells to whoever pays
  const rackOut = (P.rackOut || 1) * servedE;
  const cLocal = sum(racks, a => a.cap * localShare(a)) * rackOut, cHelix = sum(racks, a => a.cap * (1 - localShare(a))) * rackOut;
  const dCL = pop * P.aiPerCap * M.mC + nRobots * P.robotC, dCX = P.extC * M.mX;
  const a1 = Math.min(dCL, cLocal), remL = dCL - a1;
  const b1 = Math.min(remL, cHelix * remL / Math.max(0.001, remL + dCX));
  const servedC = dCL > 0 ? (a1 + b1) / dCL : 1;
  const sC = cLocal + cHelix;
  M.pc = lerp(M.pc, P.pcBase * clamp(Math.pow((dCL + dCX) / Math.max(0.01, sC), 0.5), 0.5, 8), 0.25);

  // ROBOTS AND LABOR
  const robotEff = nRobots * P.robotHours * servedE * Math.min(1, servedC + 0.15);
  const L = pop * P.laborPerCap * M.mL;
  const autoable = L * P.autoFrac;
  const robotWork = Math.min(robotEff, autoable), robotExport = robotEff - robotWork;
  // the outside market for remote robot labor is big but finite: price falls as the valley floods it
  const exportCap = P.exportCap * M.mL, exportRate = P.exportRate * Math.min(1, exportCap / Math.max(1, robotExport));
  M.exportRate = exportRate;
  const humanNeed = Math.max(0, L - robotWork);
  const offered = sum(people, p => p.workedToday);
  const paid = Math.min(offered, humanNeed);
  const payPerHour = offered > 0 ? P.wage * paid / offered : P.wage;
  M.jobOpen = lerp(M.jobOpen, clamp(humanNeed / Math.max(1, M.offeredAvg), 0, 2), 0.3);
  M.offeredAvg = lerp(M.offeredAvg, Math.max(offered, 1), 0.3);

  // factory output: fill robot orders in order
  let built = sum(facs, f => f.cap) * (P.factoryMult || 1) * servedE + M.robotCarry;
  M.robotCarry = 0;
  while (S.orders.length && built > 0) {
    const o = S.orders[0], n = Math.min(o.units, built);
    expandAsset(o.fleet, o.owner, n);
    o.units -= n; built -= n;
    if (o.units <= 1e-6) S.orders.shift();
  }
  if (!S.orders.length) M.robotCarry = 0;

  // ---------- income by owner ----------
  const income = {}; // owner -> $
  const pay = (shares, amt) => { for (const k in shares) income[k] = (income[k] || 0) + shares[k] * amt; };
  for (const a of solar) { const share = a.cap * P.solarYield * season / Math.max(0.001, solarOut); a.out = soldE * share; a.profit = a.out * M.pe - a.cap * P.solarCost * 0.01 / 30; pay(a.shares, a.profit); }
  for (const a of racks) { a.out = a.cap * rackOut; a.profit = a.out * M.pc - a.cap * P.rackE * servedE * M.pe; pay(a.shares, a.profit); }
  const robotRev = robotWork * P.robotRate * P.wage + robotExport * exportRate * P.wage - nRobots * (P.robotE * M.pe + P.robotC * M.pc * Math.min(1, servedC));
  for (const a of fleets) { a.out = robotEff * a.cap / Math.max(1, nRobots); a.profit = robotRev * a.cap / Math.max(1, nRobots); pay(a.shares, a.profit); }
  for (const a of facs) { a.out = robotsBuilt; a.profit = robotsBuilt * P.robotCost * 0.25 - dFac * M.pe; pay(a.shares, a.profit); }

  // town: tax + its own assets + property tax on Helix's valley profits
  const helixProfit = Math.max(0, income.helix || 0);
  let townIn = (income.town || 0) + helixProfit * P.propTax;
  S.helix.cash += (income.helix || 0) * (1 - P.propTax);
  M.outflow = lerp(M.outflow, helixProfit * (1 - P.propTax) + imp * P.gridPrice, 0.3);

  // households
  let wagesTotal = 0, divTotal = 0;
  for (const h of S.households) {
    const members = h.members;
    const wages = sum(members, m => m.workedToday) * payPerHour;
    const div = income[h.id] || 0;
    const gross = wages + Math.max(0, div);
    const tax = gross * P.tax;
    townIn += tax;
    const essentials = members.length * P.essential * P.essentialIdx;
    const energy = members.length * P.homeE * M.mE * M.pe;
    const aiWant = members.length * P.aiPerCap * M.mC * M.pc * servedC;
    const ai = Math.min(aiWant, members.length * P.essential * 0.35);
    h.lastIncome = { wages, div, tax, essentials, energy, ai, ubi: 0 };
    h.cash += gross - tax - essentials - energy - ai + Math.min(0, div);
    h.aiMet = aiWant > 0 ? ai / aiWant * servedC : 1;
    wagesTotal += wages; divTotal += div;
    for (const m of members) { m.paidHoursWeek = lerp(m.paidHoursWeek, m.workedToday * 7 * (offered > 0 ? paid / offered : 1), 1 / 7); m.workedToday = 0; }
  }
  const payout = S.town.cash < 0 ? 0.4 : P.townPayout; // a town in debt pays its bond first
  const ubi = townIn * payout / Math.max(1, pop);
  S.town.cash += townIn * (1 - payout);
  for (const h of S.households) { const u = ubi * h.members.length; h.cash += u; h.lastIncome.ubi = u; }
  M.ubi = ubi;

  Object.assign(M, { solarOut, dE, imp, servedE, sC, dCL, dCX, servedC, nRobots, robotEff, robotWork, L, humanNeed, offered, paid, payPerHour,
    shortE: dE > 0 ? deficit / dE : 0, shortC: 1 - servedC, wagesTotal, divTotal, townIn });

  investDaily();
  if (day % 30 === 29) econMonth();
  if (day % 7 === 6) sampleHistory();
}

function econMonth() {
  const P = S.P, M = S.market;
  M.mE *= 1 + P.gE; M.mC *= 1 + P.gC; M.mX *= 1 + P.gX; M.mL *= 1 + P.gL;
  S.helix.monthBudget = P.helixBudget * (1 + S.day / 360);
  // the town council invests its treasury in whatever is shortest, in the commons
  if (S.town.cash > 150000) {
    const type = M.shortC > M.shortE ? 'compute' : 'solar';
    const spend = S.town.cash * 0.7, units = spend / unitCost(type);
    S.town.cash -= spend;
    const existing = S.assets.find(a => a.type === type && a.shares.town > 0.99 && a.site.town !== false && a.cap > 0);
    if (existing && rand() < 0.6) expandAsset(existing, 'town', units);
    else placeAsset(type, type === 'solar' ? 'Commons Solar ' + (++S.counter) : 'Commons Compute ' + (++S.counter), 'town', units);
    log(`Town council invested ${money(spend)} in commons ${type}.`, 'town');
  }
}

// ---------- investment ----------
function annualReturn(type) {
  const P = S.P, M = S.market;
  if (type === 'solar') return (P.solarYield * M.pe * 360 * Math.min(1, M.dE / Math.max(1, M.solarOut))) / P.solarCost;
  if (type === 'compute') return ((P.rackOut || 1) * M.pc - P.rackE * M.pe) * (M.servedE ?? 1) * 360 / P.rackCost;
  if (type === 'fleet') {
    const spareAuto = Math.max(0, M.L * P.autoFrac - M.robotWork);
    const rate = spareAuto > P.robotHours ? P.robotRate : (M.exportRate ?? P.exportRate);
    return ((P.robotHours * rate * P.wage) - P.robotE * M.pe - P.robotC * M.pc) * 360 / P.robotCost;
  }
  if (type === 'factory') return (P.robotCost * 0.25 * (P.factoryMult || 1)) * 360 / P.factoryCost * (S.orders.length ? 1 : 0.4);
  return 0;
}

function investDaily() {
  const P = S.P;
  // Helix: weekly, builds whatever clears its hurdle, mostly outside town on its own parcels
  if (S.day % 7 === 3 && S.helix.monthBudget > 0) {
    const opts = ['solar', 'compute', 'fleet', 'factory'].map(t => ({ t, r: annualReturn(t) })).sort((a, b) => b.r - a.r);
    const best = opts[0];
    if (best.r > P.helixHurdle) {
      const spend = Math.min(S.helix.monthBudget, P.helixBudget * 0.5 * (1 + S.day / 360));
      S.helix.monthBudget -= spend;
      const units = spend / unitCost(best.t);
      if (best.t === 'fleet') orderRobots('helix', units, S.assets.find(a => a.id === S.helix.depot));
      else {
        const own = S.assets.find(a => a.type === best.t && a.shares.helix > 0.99 && a.cap > 0 && a.pending.length === 0 && a.cap * unitCost(a.type) < 6e6);
        if (own) expandAsset(own, 'helix', units);
        else placeAsset(best.t, 'Helix ' + ASSET_LABEL[best.t] + ' ' + (++S.counter), 'helix', units, { outside: true });
      }
    }
  }
  // residents: invest weekly according to their household's loyalties; distressed ones sell
  if (S.day % 7 === 5) for (const h of S.households) if (!h.isPlayer) householdInvest(h);
  for (const h of S.households) if (h.cash < -800 && !h.isPlayer) distressSale(h);
}

function householdValues(h) {
  const adults = h.members.filter(m => m.age !== 'kid');
  const w = { self: 0, family: 0, community: 0, nation: 0 };
  adults.forEach(m => SPHERES.forEach(k => w[k] += m.w[k] / adults.length));
  return w;
}
function householdBuffer(h) { return h.members.length * S.P.essential * S.P.essentialIdx * 30; }

function householdInvest(h) {
  const buffer = householdBuffer(h) * (1 + householdValues(h).family * 2);
  const surplus = h.cash - buffer;
  if (surplus < 1500) return;
  const w = householdValues(h);
  const drive = S.coops.find(c => c.open);
  const amt = surplus * 0.35;
  const choice = weighted([
    { w: drive ? w.community * 2.2 * (0.6 + h.trust) : 0, v: 'coop' },
    { w: w.community * 0.8, v: 'commons' },
    { w: w.self * 1.6, v: 'stocks' },
    { w: w.nation * 1.4, v: 'bonds' },
    { w: w.family * 0.9, v: 'save' },
  ]);
  if (choice === 'coop') pledge(h, drive, amt);
  else if (choice === 'commons') { h.cash -= amt; S.town.cash += amt; h.bonds = (h.bonds || 0) + amt * 0; h.civic = (h.civic || 0) + amt; }
  else if (choice === 'stocks') buyBestAsset(h, amt);
  else if (choice === 'bonds') { h.cash -= amt; h.bonds = (h.bonds || 0) + amt; S.nation.research += amt / 20000; }
}

function buyBestAsset(h, amt) {
  // buy into whichever existing asset pays best (often Helix's) at book value
  const cands = S.assets.filter(a => a.cap > 0 && a.type !== 'factory' || (a.type === 'factory' && a.cap > 0));
  let best = null, bestR = 0;
  for (const a of cands) { const r = annualReturn(a.type); if (r > bestR) { bestR = r; best = a; } }
  if (!best) return;
  if (best.type === 'fleet') { h.cash -= amt; orderRobots(h.id, amt / unitCost('fleet'), best); return; }
  // Helix sells small slices, at a premium that reflects what the asset earns
  if ((best.shares.helix || 0) > 0.05 && rand() < 0.5) {
    const premium = 1 + Math.max(0, bestR);
    const frac = Math.min(amt / (assetValue(best) * premium), best.shares.helix * 0.04);
    const got = transferShare(best, 'helix', h.id, frac);
    h.cash -= got * assetValue(best) * premium;
    S.helix.cash += got * assetValue(best) * premium;
  } else {
    // new capacity goes into a resident-owned vehicle, not into Helix's buildings
    let target = (best.shares.helix || 0) > 0.5 ? S.assets.find(a => a.type === best.type && a.investors && a.cap + a.pending.length > 0) : best;
    if (!target) target = placeAsset(best.type, 'Valley Investors ' + ASSET_LABEL[best.type], h.id, 0, { immediate: true });
    if (!target) return;
    target.investors = target.investors || (best.shares.helix || 0) > 0.5;
    h.cash -= amt; expandAsset(target, h.id, amt / unitCost(best.type));
  }
}

function orderRobots(owner, units, fleet) {
  if (!fleet) return;
  S.orders.push({ owner, units, fleet });
}

function distressSale(h) {
  // sell enough of the most valuable stake to get back above zero
  const holdings = S.assets.filter(a => (a.shares[h.id] || 0) > 0).sort((a, b) => assetValue(b) * b.shares[h.id] - assetValue(a) * a.shares[h.id]);
  if (!holdings.length) { h.cash += 0; return; }
  const a = holdings[0];
  if (a.shares[h.id] * assetValue(a) < 200) { h.broke = true; return; }
  const need = -h.cash + householdBuffer(h) * 0.2;
  const frac = Math.min(a.shares[h.id], need / (assetValue(a) * 0.85));
  const buyer = S.policy.firstRefusal && S.town.cash > frac * assetValue(a) * 0.85 ? 'town' : 'helix';
  transferShare(a, h.id, buyer, frac);
  const price = frac * assetValue(a) * 0.85;
  h.cash += price;
  if (buyer === 'town') S.town.cash -= price; else S.helix.cash -= price;
  log(`${h.name} household sold part of its ${a.name} stake to ${buyer === 'town' ? 'the town (first refusal)' : 'Helix'} for ${money(price)}.`, buyer === 'town' ? 'town' : 'helix');
}

// ---------- co-ops ----------
function openCoop(type, proposer, by) {
  const target = type === 'fleet' ? S.P.robotCost * 10 : type === 'compute' ? S.P.rackCost * 12 : S.P.solarCost * 0.8;
  const c = { id: 'c' + (++S.counter), type, name: (by || 'Valley') + ' ' + ASSET_LABEL[type] + ' Co-op', target, raised: 0, pledges: {}, open: true, opened: S.day, proposer, deadline: S.day + 60 };
  S.coops.push(c);
  log(`${c.name} pledge drive opened (goal ${money(target)}).`, 'coop');
  return c;
}
function pledge(h, c, amt) {
  amt = Math.min(amt, c.target - c.raised, Math.max(0, h.cash));
  if (amt <= 0) return 0;
  h.cash -= amt; c.raised += amt;
  c.pledges[h.id] = (c.pledges[h.id] || 0) + amt;
  if (c.raised >= c.target - 1) closeCoop(c);
  return amt;
}
function closeCoop(c) {
  c.open = false;
  if (c.raised < 1000) { log(`${c.name} drive closed with too little raised.`, 'coop'); refundCoop(c); return; }
  const ids = Object.keys(c.pledges);
  const units = c.raised / unitCost(c.type);
  let a;
  if (c.type === 'fleet') {
    a = placeAsset('fleet', c.name, ids[0], 0, { immediate: true, coop: true });
    if (a) { a.shares = {}; ids.forEach(id => orderRobots(id, units * c.pledges[id] / c.raised, a)); }
  } else {
    a = placeAsset(c.type, c.name, ids[0], 0, { coop: true });
    if (a) { a.pending = []; ids.forEach(id => a.pending.push({ owner: id, units: units * c.pledges[id] / c.raised, done: S.day + S.P.buildDays[c.type], start: S.day })); }
  }
  if (!a) { refundCoop(c); return; }
  c.asset = a.id;
  log(`${c.name} funded by ${ids.length} households (${money(c.raised)}). Building now.`, 'coop');
}
function refundCoop(c) { for (const id in c.pledges) S.hh[id].cash += c.pledges[id]; }

// ---------- metrics ----------
function metrics() {
  const tot = sum(S.assets, a => assetValue(a));
  const helix = sum(S.assets, a => assetValue(a) * (a.shares.helix || 0));
  const town = sum(S.assets, a => assetValue(a) * (a.shares.town || 0));
  // each resident's productive wealth = their household's stakes + their per-capita slice of the commons
  const pop = S.agents.filter(a => !a.isRobot).length;
  const perPerson = S.agents.filter(a => !a.isRobot).map(p => {
    const h = p.home;
    const stake = sum(S.assets, a => assetValue(a) * (a.shares[h.id] || 0)) / h.members.length;
    return stake + town / pop;
  });
  // concentration counts Helix as one giant holder among residents
  const g = gini(perPerson.concat([helix]));
  const adults = S.agents.filter(a => a.age === 'adult');
  const work = sum(adults, a => a.paidHoursWeek) / Math.max(1, adults.length);
  return { totalValue: tot, outside: tot ? helix / tot : 0, townShare: tot ? town / tot : 0, gini: g, work, shortE: S.market.shortE, shortC: S.market.shortC };
}
function sampleHistory() {
  const m = metrics();
  S.history.push({ day: S.day, outside: m.outside, gini: m.gini, work: m.work, shortE: m.shortE, shortC: m.shortC, robots: S.market.nRobots, wellbeing: sum(S.agents.filter(a => !a.isRobot), a => a.wellbeing) / S.agents.filter(a => !a.isRobot).length });
  if (S.history.length > 400) S.history.shift();
}
