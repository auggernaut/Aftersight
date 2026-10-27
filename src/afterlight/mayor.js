/* Aftersight mayor layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * The player is mayor. Approval (0-100) is built from five factions, each weighing bills, water, noise, taxes,
 * jobs, school money and secrecy. Elections come every two years; under 50 you're out.
 *
 * Three kinds of decision card drive the drama, and every big event is either a card or the result of one:
 *  - Developer offers (Festus): tax abatement, PILOT, school fund, jobs, who pays for utility upgrades, an NDA and
 *    town equity, with post-labor terms (wealth fund, kids' trust, compute royalty, a town AI co-op) in the late
 *    tiers. Accept, counter with one or two asks, or reject.
 *  - Breakthroughs: a cost in dollars and compute and a duration. Compute comes from the town's equity share of
 *    local data centers, plus whatever it buys at market price. Finished research unlocks a building the player
 *    still has to place, fund and keep running. Pass and someone else gets it.
 *  - Town hall asks from a faction, raised by the state of the town (noise, water, secrecy, taxes).
 * A small director keeps something happening every few game months without stacking pop-ups.
 *
 * Mixed into AfterlightLayer (see layer.js). All state lives in layer.s so saves keep it.
 */

import { Random } from '../random.ts';
import * as TV from '../tileValues.ts';
import * as B from './buildings.js';
import { SITE, HALL_SPOTS, fieldAt, fieldTileCount } from './festus.js';

export const FACTIONS = [
  {id: 'res', name: 'Residents & homeowners', short: 'Residents', w: 0.30},
  {id: 'farm', name: 'Farmers', short: 'Farmers', w: 0.12},
  {id: 'work', name: 'Workers & unions', short: 'Workers', w: 0.22},
  {id: 'biz', name: 'Business', short: 'Business', w: 0.16},
  {id: 'school', name: 'Schools & families', short: 'Schools', w: 0.20}
];

export const DEVELOPERS = {
  festus: {name: 'Keystone Compute Partners', short: 'Keystone'},
  starter: {name: 'Helix', short: 'Helix'},
  empty: {name: 'Helix', short: 'Helix'}
};

// Election calendar, in months since Jan 2026: a council race in Apr 2026, then the mayor's seat every 2 years
export const COUNCIL_ELECTION = 3, COURT_HEARING = 11;
export const ELECTIONS = [27, 51, 75];
export const WIN_TERMS = 3, WIN_SHARE = 0.25;
var CARD_GAP = 6;          // fewest months between two decision cards
var DRAMA_GAP = 8;         // most months without anything meaningful before the director steps in

// ---- Developer offers ----
// Each tier is a full set of terms. Tier 0 is the opening offer: bad for citizens, as first offers are.
export const TIERS = [
  {abatePct: 100, abateYears: 20, pilot: 200, school: 0, jobs: 25, utilities: 'town', nda: true, equity: 0},
  {abatePct: 75, abateYears: 15, pilot: 500, school: 150, jobs: 40, utilities: 'split', nda: true, equity: 0},
  {abatePct: 50, abateYears: 10, pilot: 900, school: 300, jobs: 55, utilities: 'developer', nda: false, equity: 5},
  {abatePct: 40, abateYears: 10, pilot: 1100, school: 400, jobs: 60, utilities: 'developer', nda: false, equity: 10, fund: true, royalty: 40},
  {abatePct: 25, abateYears: 10, pilot: 1400, school: 500, jobs: 70, utilities: 'developer', nda: false, equity: 20, fund: true, kids: 5, royalty: 80, coop: true}
];
var UTIL_STEP = {town: 'split', split: 'developer', developer: 'developer'};
export const ASKS = {
  abate: {label: 'Cut the tax abatement', apply: function(t) { t.abatePct = Math.max(0, t.abatePct - 25); t.abateYears = Math.max(5, t.abateYears - 5); }, ok: function(t) { return t.abatePct > 0; }},
  pilot: {label: 'A bigger payment in lieu of taxes', apply: function(t) { t.pilot += 300; }, ok: function(t) { return t.pilot < 2000; }},
  school: {label: 'A school fund', apply: function(t) { t.school += 200; }, ok: function(t) { return t.school < 800; }},
  utilities: {label: 'They pay for the water and power upgrades', apply: function(t) { t.utilities = UTIL_STEP[t.utilities]; }, ok: function(t) { return t.utilities !== 'developer'; }},
  nda: {label: 'No secrecy clause', apply: function(t) { t.nda = false; }, ok: function(t) { return t.nda; }},
  jobs: {label: 'Local hiring: more permanent jobs', apply: function(t) { t.jobs += 15; }, ok: function(t) { return t.jobs < 100; }},
  equity: {label: 'A town equity stake', hard: 1, apply: function(t) { t.equity = (t.equity || 0) + 5; }, ok: function(t) { return (t.equity || 0) < 30; }},
  fund: {label: 'PILOT goes into a town wealth fund that pays a dividend', late: true, hard: 1, apply: function(t) { t.fund = true; }, ok: function(t) { return !t.fund; }},
  kids: {label: 'A kids\' trust: a share of revenue for every child, vesting at 21', late: true, hard: 1, apply: function(t) { t.kids = (t.kids || 0) + 5; }, ok: function(t) { return (t.kids || 0) < 10; }},
  royalty: {label: 'A compute royalty for the town', late: true, hard: 1, apply: function(t) { t.royalty = (t.royalty || 0) + 40; }, ok: function(t) { return (t.royalty || 0) < 160; }},
  coop: {label: 'One hall becomes a town-owned AI co-op', late: true, hard: 2, apply: function(t) { t.coop = true; }, ok: function(t) { return !t.coop; }}
};
export const UTIL_TEXT = {town: 'The town pays', split: 'Split 50/50', developer: 'Developer pays'};

// Money per hall per month, in game dollars (a Festus-sized town collects roughly $400 a year in taxes)
var HALL_TAX = 40, HALL_REVENUE = 120, WATER_UPGRADE = 400, HALL_WATER = 12;

// ---- Breakthroughs ----
export const RESEARCH = {
  cheap_solar: {name: 'Perovskite solar', cost: 800, compute: 240, months: 3,
    found: 'A lab has tandem perovskite cells that print like newspaper. Licensing and tuning them for the valley takes compute.',
    unlocks: 'Solar farms cost half and make three times the power.',
    pass: 'A solar co-op two counties over licenses it first. Your panels stay expensive.',
    passEffect: {biz: -2}},
  frontier_model: {name: 'A frontier model for city services', cost: 1500, compute: 600, months: 4,
    found: 'A new AI model can run whole departments. Fine-tuned on town records, it could do permits, billing and casework overnight.',
    unlocks: 'Town compute output triples. Office work starts to vanish.',
    pass: 'The data center tenant deploys it in its own halls. Their power draw doubles and the town rents access.',
    passEffect: {work: -3, biz: -2}, dependent: true},
  robots_build_robots: {name: 'Self-building robot lines', cost: 2000, compute: 900, months: 5,
    found: 'Robots that assemble robots. A co-op line in town would own the machines that replace local work.',
    unlocks: 'Robot depots house three times as many machines.',
    pass: 'The machines get built elsewhere and leased to local firms. Automation comes anyway; the town owns none of it.',
    passEffect: {work: -4}, dependent: true},
  the_cure: {name: 'AI-designed therapies', cost: 3000, compute: 1500, months: 6,
    found: 'Models have designed therapies that slow aging and beat most cancers. Running the trials here would bring them home.',
    unlocks: 'Healing Clinics ($1,200 to build, $15 a month to run).',
    pass: 'St. Louis hospitals license it first. Residents drive an hour and pay out of pocket.',
    passEffect: {res: -4, school: -5}, dependent: true},
  fusion: {name: 'Compact fusion', cost: 5000, compute: 3000, months: 8,
    found: 'A compact fusion design is ready for towns. Simulating the reactor for this site is a huge compute job.',
    unlocks: 'Fusion Plants ($8,000 to build, $40 a month to run, 6,000 power).',
    pass: 'The developer builds its own fusion plant for the campus and sells the town its power.',
    passEffect: {biz: -3, res: -2}, dependent: true, bills: 0.1}
};
export const RESEARCH_ORDER = ['cheap_solar', 'frontier_model', 'robots_build_robots', 'the_cure', 'fusion'];
var COMPUTE_PRICE = 3;     // dollars per compute unit bought on the market

// ---- Town hall asks: raised by the state of the town ----
var ASK_CARDS = {
  sound_wall: {faction: 'res', when: function(L) { return L.hallsOnline() > 0 && L.noise() > 0.6; },
    title: 'Neighbors want a sound wall', body: 'Families on the streets by the campus say the cooling fans never stop. They want earth berms and a sound wall.',
    yes: {label: 'Build it ($600)', cost: 600, d: {res: 7, school: 1}, effect: function(L) { L.s.mayor.soundWall = true; }},
    no: {label: 'Not now', d: {res: -5}}},
  farm_water: {faction: 'farm', when: function(L) { return !!L.s.deal; },
    title: 'Farmers ask for a water guarantee', body: 'The Farm Bureau wants it in writing: in a drought, the campus cuts its pumping before any farm does.',
    yes: {label: 'Guarantee it', d: {farm: 8, biz: -3}, effect: function(L) { L.s.mayor.waterGuarantee = true; }},
    no: {label: 'Decline', d: {farm: -6}}},
  local_hire: {faction: 'work', when: function(L) { return !!L.s.deal || !!L.s.construction; },
    title: 'The pipefitters want local hiring', body: 'The building trades local asks for an ordinance: most campus jobs go to people who live here.',
    yes: {label: 'Pass the ordinance', d: {work: 8, biz: -3}, effect: function(L) { L.s.mayor.localHire = true; }},
    no: {label: 'Decline', d: {work: -6}}},
  publish_deal: {faction: 'res', when: function(L) { return L.s.deal && L.s.deal.nda; },
    title: 'Publish the agreement?', body: 'Residents and the school board demand the council release the developer agreement and the minutes of its closed sessions.',
    yes: {label: 'Publish it', d: {res: 7, school: 4, biz: -2}, effect: function(L) { L.s.deal.nda = false; L.s.dev.patience = Math.max(0, L.s.dev.patience - 1); }},
    no: {label: 'Keep it sealed', d: {res: -6, school: -3}}},
  tax_cut: {faction: 'biz', repeat: 24, when: function(L) { return L.s.months > 10 && L._sim.budget.cityTax > 4; },
    title: 'The chamber wants a tax cut', body: 'Main Street shop owners ask for a one-point cut in the city tax rate.',
    yes: {label: 'Cut taxes 1 point', d: {biz: 6, school: -4}, effect: function(L) { L._sim.budget.cityTax--; }},
    no: {label: 'Hold the rate', d: {biz: -4}}},
  // reinvest: the town's own money (taxes, PILOT, equity) can buy back goodwill, and the ask comes back every year
  reinvest: {faction: 'school', repeat: 12, when: function(L) { return L.s.months > 8 && L._sim.budget.totalFunds > 4000; },
    title: 'What do we do with the surplus?', body: 'The budget office has money left over this year. The school board and the neighborhood groups both have a list.',
    yes: {label: 'Classrooms and parks ($1,200)', cost: 1200, d: {school: 6, res: 4, farm: 1}},
    no: {label: 'Bank it', d: {biz: 2, school: -2}}},
  // the town that said no grows its own way
  homegrown: {faction: 'work', repeat: 10, when: function(L) { return !L.s.deal && L.s.dev.walks > 0 && (L.s.mayor.homegrown || 0) < 3; },
    title: 'Grow it ourselves?', body: 'With no campus coming, the chamber and the trades pitch a plan: a community solar farm, Main Street grants and a training program at the high school.',
    yes: {label: 'Fund the plan ($1,000)', cost: 1000, d: {work: 6, biz: 5, res: 2, farm: 2}, effect: function(L) { L.s.mayor.homegrown = (L.s.mayor.homegrown || 0) + 1; }},
    no: {label: 'Not this year', d: {work: -3, biz: -3}}},
  // a bad deal can be reopened: the new council pushes, the developer comes back to the table
  reopen: {faction: 'res', when: function(L) { return L.s.deal && L._dealTier() <= 1 && L.s.dev.status === 'signed' && !L.s.construction &&
                                                         L.s.months - L.s.deal.month >= 8 && !L.s.mayor.reopened; },
    title: 'Reopen the deal?', body: 'The new council members say the agreement was signed too fast and too cheap. They want you to call the developer back to the table.',
    yes: {label: 'Call them back', d: {res: 4, school: 2, biz: -2}, effect: function(L) { L.s.mayor.reopened = true; L.s.mayor.reopenDue = L.mi() + 1; }},
    no: {label: 'A deal is a deal', d: {res: -4, biz: 3}}},
  school_levy: {faction: 'school', repeat: 24, when: function(L) { return L.s.months > 14 && L._sim.budget.cityTax < 12; },
    title: 'The school board wants a levy', body: 'Classrooms are packed. The board asks you to back a one-point tax increase for the schools.',
    yes: {label: 'Back the levy', d: {school: 9, res: -3, biz: -3}, effect: function(L) { L._sim.budget.cityTax++; L.s.mayor.levy = (L.s.mayor.levy || 0) + 1; }},
    no: {label: 'Decline', d: {school: -6}}}
};

var clamp = function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
var copy = function(o) { return JSON.parse(JSON.stringify(o)); };
var money = function(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
var signed = function(n) { n = Math.round(n); return (n > 0 ? '+' : n < 0 ? '\u2212' : '\u00b1') + Math.abs(n); };

export function freshMayor() {
  var f = {};
  FACTIONS.forEach(function(x) { f[x.id] = {v: 55, mem: 0}; });
  return {approval: 55, factions: f, electionsWon: 0, lastDrama: 0, lastCard: -99, history: [], asked: {},
          gameOver: null, won: null, sandbox: false, scripted: {}};
}
export function freshDev() { return {status: 'none', offer: null, due: -1, patience: 2, walks: 0, counters: 0, nextExpansion: -1}; }
export function freshResearch() { return {active: null, done: {}, passed: {}, next: 6}; }

export function installMayor(L) {
  var P = L.prototype;

  P.mi = function() { var d = this._sim.getDate(); return (d.year - 2026) * 12 + d.month; };
  P.dev = function() { return DEVELOPERS[this.s.scenario] || DEVELOPERS.starter; };
  P.festus = function() { return this.s.scenario === 'festus'; };
  P.nextElection = function() {
    var m = this.mi();
    for (var i = 0; i < ELECTIONS.length; i++) if (ELECTIONS[i] >= m) return ELECTIONS[i];
    return -1;
  };
  P.monthName = function(mi) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[((mi % 12) + 12) % 12] + ' ' + (2026 + Math.floor(mi / 12));
  };

  // ---- faction mood ----
  P.bump = function(d, why) {
    var m = this.s.mayor;
    for (var k in d) {
      if (!m.factions[k]) continue;
      m.factions[k].v = clamp(m.factions[k].v + d[k], 0, 100);
      m.factions[k].mem += d[k] * 0.8;
    }
    this._approval();
    if (why) m.history.unshift({date: this.dateString(), why: why, d: d, approval: Math.round(m.approval)});
    if (m.history.length > 20) m.history.length = 20;
  };
  P._approval = function() {
    var m = this.s.mayor, a = 0;
    FACTIONS.forEach(function(f) { a += f.w * m.factions[f.id].v; });
    m.approval = a;
    return a;
  };

  P.hallsOnline = function() {
    return this.dataCenters().filter(function(d) { return d.powered; }).length;
  };
  P.devHalls = function() { return this.dataCenters().filter(function(d) { return d.owner === 'helix'; }); };
  P.noise = function() {
    var self = this, n = 0;
    this.devHalls().forEach(function(d) { n += self.exposure(d) * 0.5; });
    return n * (this.s.mayor.soundWall ? 0.4 : 1);
  };
  P.farmLost = function() {
    if (!this.festus()) return 0;
    var map = this._map, lost = 0, total = fieldTileCount();
    for (var y = 0; y < map.height; y++)
      for (var x = 0; x < map.width; x++) {
        var f = fieldAt(x, y);
        if (f && map.getTileValue(x, y) !== TV.DIRT) lost++;
      }
    return total ? lost / total : 0;
  };
  // The town's compute: co-op halls it owns, its equity share of the developer's, and any royalty
  P.townCompute = function() {
    var s = this.s, eq = s.deal ? (s.deal.equity || 0) / 100 : 0;
    if (s.policies.communityFirst) eq = Math.max(eq, 0.25);
    return Math.round(s.computeCoop + s.computeHelix * eq + (s.deal && s.hallsBuilt ? (s.deal.royalty || 0) : 0));
  };
  P.townShare = function() { return this.s.compute > 0 ? this.townCompute() / Math.max(1, this.s.compute) : 0; };
  P.computePrice = function() { return COMPUTE_PRICE + (this.s.dependence || 0); };

  P._factionTargets = function(simData) {
    var s = this.s, m = s.mayor, c = simData.census, budget = this._sim.budget, deal = s.deal;
    var tax = budget.cityTax;
    var taxPain = clamp((tax - 7) * 2.5, -5, 25);
    var pm = this._sim._powerManager;
    var shortage = pm && pm.lastShort ? 1 : 0;
    var online = this.hallsOnline();
    var utilBill = {town: 0.14, split: 0.08, developer: 0};
    var bills = (deal ? utilBill[deal.utilities] * Math.min(2, online / 2) : 0) + shortage * 0.5 +
                (s.dependence || 0) * 0.04 + (s.passedBills || 0) - (c.alFusionPop > 0 ? 0.15 : 0);
    var pop = this._sim.evaluation.cityPop || 0;
    s.water.use = pop / 150 + online * HALL_WATER * (m.waterGuarantee ? 0.8 : 1);
    var stress = Math.max(0, s.water.use / Math.max(1, s.water.cap) - 0.85) * 4;
    var noise = this.noise();
    var secrecy = deal && deal.nda ? 1 : 0;
    var abateBite = deal && s.months - deal.month < deal.abateYears * 12 ? deal.abatePct / 100 * Math.min(1, deal.abateYears / 20) : 0;
    var schoolScore = (deal ? deal.school / 250 : 0) - abateBite * 1.2 + (deal ? (deal.kids || 0) * 0.15 : 0) + (m.levy || 0) * 0.5;
    var div = clamp((s.fundDividend || 0) / 25, 0, 1.5);
    var equity = this.townShare();
    var building = s.construction ? 1 : 0;
    var jobs = deal && online ? clamp(deal.jobs / 50, 0, 1.5) * (m.localHire ? 1.3 : 1) : 0;
    var lost = this._farmLostCache === undefined || s.months % 6 === 0 ? (this._farmLostCache = this.farmLost()) : this._farmLostCache;
    var clinics = c.alClinicOn || 0;
    // how good the deal is keeps mattering: people talk about what the town got for the land
    // voters feel the jobless rate over a year or so, not the month-to-month swing of the census
    m.jobless = m.jobless === undefined ? s.unemployment : m.jobless * 0.88 + s.unemployment * 0.12;
    var jobless = m.jobless;
    var fair = deal ? this._dealTier() - 1 : 0;
    var free = !deal && s.dev.walks > 0 ? 1 : 0, home = Math.min(3, m.homegrown || 0);   // said no, and grew its own way
    var growth = clamp((this._sim._valves ? this._sim._valves.comValve : 0) / 150, -8, 8);
    s.bills = bills; s.waterStress = stress;
    return {
      res: 56 + fair * 4 + free * 1 - bills * 40 - stress * 12 - noise * 5 - secrecy * 10 - taxPain - jobless * 40 + div * 8 + equity * 12 + clinics * 2,
      farm: 58 + fair + free * 2 - stress * 20 - lost * 80 - bills * 25 - taxPain * 1.2 + div * 4 + equity * 6,
      work: 52 - jobless * 90 + building * 12 + jobs * 11 + home * 3 + div * 10 + equity * 8 - s.automation * 15 * (1 - s.cover),
      biz: 54 + growth - taxPain * 1.5 - bills * 30 + (online ? 7 : 0) + jobs * 4 + home * 3 - (s.dependence || 0) * 2,
      school: 55 + fair * 3 + schoolScore * 10 - secrecy * 8 - taxPain * 0.6 + clinics * 2 + div * 4
    };
  };

  P.initMayor = function(simData) {
    var t = this._factionTargets(simData), m = this.s.mayor;
    FACTIONS.forEach(function(f) { m.factions[f.id].v = clamp(t[f.id], 0, 100); });
    this._approval();
  };

  // ---- monthly ----
  P.mayorMonthly = function(simData) {
    var s = this.s, m = s.mayor, mi = this.mi();
    if (!m.inited) { m.inited = true; this.initMayor(simData); }
    this._dealMoney(simData);
    this._construction(simData);
    var t = this._factionTargets(simData);
    FACTIONS.forEach(function(f) {
      var fx = m.factions[f.id];
      fx.mem *= 0.9;
      fx.v = clamp(fx.v + (t[f.id] + fx.mem - fx.v) * 0.25, 0, 100);
    });
    this._approval();
    this._researchMonthly(simData);
    if (m.gameOver && !m.sandbox) return;
    this._scripted(mi);
    this._elections(mi);
    this._developer(mi);
    this._director(mi);
  };

  // ---- cards ----
  P.canCard = function() { return !this.s.card && this.s.months - this.s.mayor.lastCard >= CARD_GAP; };
  P.showCard = function(card) {
    card.date = this.dateString();
    this.s.card = card;
    this.s.mayor.lastCard = this.s.months;
    this.s.mayor.lastType = card.type;
    this.drama();
    if (this.autoDecide) this.autoDecide(card);
  };
  P.drama = function() { this.s.mayor.lastDrama = this.s.months; };

  P.decide = function(option, asks) {
    var card = this.s.card;
    if (!card) return false;
    var opt = card.options.filter(function(o) { return o.id === option; })[0];
    if (!opt || opt.disabled) return false;
    this.s.card = null;
    if (card.type === 'offer') this._decideOffer(card, option, asks || []);
    else if (card.type === 'research') this._decideResearch(card, option);
    else if (card.type === 'ask') this._decideAsk(card, option);
    else if (card.type === 'campaign') this._decideCampaign(card, option);
    else if (card.type === 'intro' && this.s.dev.offer) this._offerCard();
    return true;
  };

  // ---- developer offers ----
  P._reaction = function(t, choice, asks) {
    if (choice === 'accept') {
      var util = {town: -5, split: -2, developer: 2}[t.utilities];
      return {
        res: -6 - (t.nda ? 4 : 0) + util + (t.fund ? 6 : 0) + (t.equity || 0) * 0.4 - t.abatePct / 100 * 3,
        farm: -5 + util * 0.8 + t.pilot / 400,
        work: 8 + t.jobs / 15 + (t.fund ? 4 : 0),
        biz: 8 + t.pilot / 500,
        school: -4 + t.school / 100 - t.abatePct / 100 * 6 + (t.kids || 0) * 1.2 - (t.nda ? 3 : 0)
      };
    }
    if (choice === 'counter') {
      var d = {res: 3, farm: 2, work: -2, biz: -2, school: 2};
      (asks || []).forEach(function(a) {
        if (a === 'school' || a === 'kids') d.school += 2;
        if (a === 'jobs') d.work += 3;
        if (a === 'nda' || a === 'abate') d.res += 2;
        if (a === 'utilities') { d.res += 1; d.farm += 2; }
        if (a === 'equity' || a === 'fund' || a === 'coop' || a === 'royalty') { d.res += 1; d.work += 1; }
      });
      return d;
    }
    // the first no stings the trades and the chamber most; after that they stop counting on the campus
    var sting = 1 / (1 + (this.s.dev.walks || 0));
    return {res: 5, farm: 5, work: -8 * sting, biz: -8 * sting, school: 1};
  };

  P.leverage = function() {
    var s = this.s;
    var surplus = this._sim._powerManager && !this._sim._powerManager.lastShort ? 0.05 : -0.05;
    return clamp(0.15 + s.months / 60 + (s.mayor.approval - 50) / 80 + s.dev.walks * 0.1 + surplus +
                 (this.has('frontier_model') || s.research.passed.frontier_model ? 0.1 : 0), 0, 1);
  };

  P.makeOffer = function(tier, kind) {
    var s = this.s;
    tier = clamp(tier, 0, TIERS.length - 1);
    var terms = copy(TIERS[tier]);
    var halls = kind === 'expansion' ? 2 : 2;
    s.dev.offer = {tier: tier, terms: terms, halls: halls, kind: kind || 'first'};
    s.dev.status = 'offer';
    return s.dev.offer;
  };

  P.asksFor = function(terms) {
    var late = this.s.dev.offer && this.s.dev.offer.tier >= 2 || this.mi() >= 24;
    return Object.keys(ASKS).filter(function(k) { return (!ASKS[k].late || late) && ASKS[k].ok(terms); });
  };

  P.termRows = function(t, halls) {
    var self = this;
    var rows = [
      ['Campus', halls + ' halls on the site' + (this.s.deal ? ' (more)' : '') + ', about ' + money(halls * HALL_REVENUE) + '/mo in revenue', 'neutral'],
      ['Tax abatement', t.abatePct ? t.abatePct + '% for ' + t.abateYears + ' years' : 'None', t.abatePct >= 75 ? 'bad' : t.abatePct <= 25 ? 'good' : 'neutral'],
      ['Payment in lieu of taxes', money(t.pilot) + ' a year' + (t.fund ? ', into a town wealth fund' : ''), t.pilot >= 900 ? 'good' : t.pilot < 400 ? 'bad' : 'neutral'],
      ['School fund', t.school ? money(t.school) + ' a year' : 'None', t.school >= 300 ? 'good' : t.school ? 'neutral' : 'bad'],
      ['Jobs promised', t.jobs + ' permanent (plus construction crews)', t.jobs >= 55 ? 'good' : t.jobs < 35 ? 'bad' : 'neutral'],
      ['Water and power upgrades', UTIL_TEXT[t.utilities] + (t.utilities !== 'developer' ? ' (' + money(self.utilityBill(t, halls)) + ' now, and higher bills)' : ''), t.utilities === 'developer' ? 'good' : t.utilities === 'town' ? 'bad' : 'neutral'],
      ['Secrecy', t.nda ? 'NDA: the tenant stays secret, sessions closed' : 'Open: terms and tenant public', t.nda ? 'bad' : 'good'],
      ['Town equity', (t.equity || 0) + '%' + ((t.equity || 0) ? ' of revenue and compute' : ''), (t.equity || 0) >= 10 ? 'good' : (t.equity || 0) ? 'neutral' : 'bad']
    ];
    if (t.kids) rows.push(['Kids\' trust', t.kids + '% of revenue for every child, vesting at 21', 'good']);
    if (t.royalty) rows.push(['Compute royalty', t.royalty + ' compute a month for the town', 'good']);
    if (t.coop) rows.push(['Town AI co-op', 'One hall is owned by the town', 'good']);
    return rows;
  };
  P.utilityBill = function(t, halls) { return {town: 1, split: 0.5, developer: 0}[t.utilities] * WATER_UPGRADE * halls; };

  P.preview = function(d) {
    return FACTIONS.map(function(f) { return {id: f.id, name: f.short, d: Math.round(d[f.id] || 0)}; });
  };

  P._offerCard = function() {
    var s = this.s, o = s.dev.offer, dev = this.dev();
    var kinds = {
      first: ['Offer from ' + dev.name, 'A $6 billion data center campus by the interstate'],
      better: [dev.short + ' comes back', 'A better offer, after your counter'],
      firm: [dev.short + ' holds firm', 'Same terms. Take it or leave it'],
      'return': [dev.short + ' is back', 'A new offer, after the deal fell through elsewhere'],
      expansion: [dev.short + ' wants to expand', 'Two more halls, and new terms for the whole campus'],
      renegotiate: ['Court orders a new agreement', dev.short + ' wants to re-sign fast, in the open'],
      reopen: [dev.short + ' comes back to the table', 'New terms for the campus you already have']
    };
    var k = kinds[o.kind] || kinds.first;
    var asks = this.asksFor(o.terms);
    var self = this;
    var body = o.kind === 'first' ?
      dev.name + ', the data center arm of a St. Louis builder, wants about 370 acres between the west subdivisions and I-55. It won\'t name the tenant. The council meets in the high school gym tonight.' :
      o.kind === 'expansion' ? 'The campus is full. ' + dev.short + ' wants two more halls on the site and offers to re-sign the whole agreement on these terms.' :
      o.kind === 'reopen' ? 'The council asked, and ' + dev.short + ' would rather re-sign than fight. Same halls. Say no and the old agreement stands.' :
      o.kind === 'renegotiate' ? 'The judge threw out the old agreement. ' + dev.short + ' has a new one, and this time the terms are public.' :
      'Leverage ' + Math.round(this.leverage() * 100) + '%: the longer you hold out and the more popular you are, the more they give.';
    this.showCard({
      type: 'offer', kicker: k[0], title: k[1], body: body, rows: this.termRows(o.terms, o.halls),
      options: [
        {id: 'accept', label: o.kind === 'expansion' ? 'Approve the expansion' : 'Accept', tone: 'good', preview: this.preview(this._reaction(o.terms, 'accept'))},
        {id: 'counter', label: 'Counter', tone: 'neutral', disabled: o.kind === 'firm' && s.dev.patience <= 0 || !asks.length,
         preview: this.preview(this._reaction(o.terms, 'counter', [])), note: 'Ask for 1 or 2 changes. ' + dev.short + ' answers in a couple of months.'},
        {id: 'reject', label: o.kind === 'expansion' ? 'Say no' : 'Reject', tone: 'bad', preview: this.preview(this._reaction(o.terms, 'reject'))}
      ],
      asks: asks.map(function(a) { return {id: a, label: ASKS[a].label}; }), maxAsks: 2,
      leverage: Math.round(self.leverage() * 100)
    });
  };

  P._decideOffer = function(card, option, asks) {
    var s = this.s, o = s.dev.offer, dev = this.dev(), mi = this.mi();
    if (!o) return;
    asks = asks.filter(function(a) { return ASKS[a]; }).slice(0, 2);
    if (option === 'counter' && !asks.length) asks = [this.asksFor(o.terms)[0]];
    if (option === 'accept') {
      var r = this._reaction(o.terms, 'accept');
      // terms the town fought for go down better than terms it was handed
      if (s.dev.counters > 0 && o.kind !== 'expansion') { r.res += 2; r.school += 2; r.farm += 1; }
      this.bump(r, 'Accepted ' + dev.short + '\'s offer');
      this.signDeal(o);
    } else if (option === 'counter') {
      this.bump(this._reaction(o.terms, 'counter', asks), 'Countered ' + dev.short + ': ' + asks.map(function(a) { return ASKS[a].label.toLowerCase(); }).join('; '));
      s.dev.status = 'review';
      s.dev.asks = asks;
      s.dev.counters++;
      s.dev.due = mi + 2 + Random.getRandom(1);
      this.news('neutral', dev.short + '\'s lawyers are reviewing your counter: ' + asks.map(function(a) { return ASKS[a].label.toLowerCase(); }).join(' and ') + '.');
    } else {
      this.bump(o.kind === 'expansion' || o.kind === 'reopen' ? {res: 2, farm: 2, work: -3, biz: -3} : this._reaction(o.terms, 'reject'), 'Rejected ' + dev.short);
      if (o.kind === 'reopen') {
        s.dev.status = 'signed'; s.dev.offer = null;
        this.news('neutral', 'Talks end. The old agreement with ' + dev.short + ' stands.');
      } else if (o.kind === 'expansion') {
        s.dev.status = 'signed'; s.dev.offer = null; s.dev.nextExpansion = mi + 14;
        this.news('neutral', 'The council turns down ' + dev.short + '\'s expansion. The halls already built keep running.');
      } else this.devWalks('rejected');
    }
  };

  P.devWalks = function(why) {
    var s = this.s, dev = this.dev(), mi = this.mi();
    s.dev.walks++;
    s.dev.status = 'away';
    s.dev.due = mi + 8 + Random.getRandom(4);
    s.dev.returnTier = Math.min(TIERS.length - 1, (s.dev.offer ? s.dev.offer.tier : 0) + 1);
    s.dev.offer = null;
    if (s.dev.walks >= 2 && (s.dependence || 0) < 2) s.dependence = (s.dependence || 0) + 1;   // walking away costs, but it doesn't compound forever
    this.bump({work: -5 / s.dev.walks, biz: -6 / s.dev.walks, res: 2, farm: 2}, dev.short + ' walked away');
    this.news('bad', (why === 'rejected' ? 'You said no. ' : 'Talks collapse. ') + dev.short + ' takes its campus across the river to a neighboring town. The trades and the chamber are furious.',
              {paper: true, tone: 'bad', headline: dev.short.toUpperCase() + ' WALKS: CAMPUS HEADS ACROSS THE RIVER',
               body: 'Construction crews, and the money, go to a neighboring town. ' + dev.short + ' says it may be back if the terms are right.',
               helps: 'Neighbors and farmers are relieved. Your leverage grows: they know you\'ll say no.',
               strains: 'Workers and businesses lose the jobs they were counting on.'});
    this.drama();
  };

  P.signDeal = function(o) {
    var s = this.s, dev = this.dev(), budget = this._sim.budget;
    var prevHalls = s.deal ? s.deal.halls : 0;
    var halls = Math.min(HALL_SPOTS.length, prevHalls + o.halls);
    s.deal = copy(o.terms);
    s.deal.halls = halls;
    s.deal.month = s.months;
    s.dev.status = 'signed';
    s.dev.offer = null;
    s.dev.nextExpansion = this.mi() + 16;
    if (!o.halls) {
      s.dev.nextExpansion = this.mi() + 16;
      this.news('neutral', 'The council re-signs with ' + dev.short + ' in a public session. Same halls, new terms.');
      return;
    }
    var bill = this.utilityBill(o.terms, o.halls);
    if (bill) budget.spend(Math.min(bill, budget.totalFunds));
    s.water.cap += HALL_WATER * o.halls;
    s.construction = {until: s.months + 4, from: prevHalls, to: halls};
    this.news('neutral', 'The council signs with ' + dev.short + '. Graders roll onto the site; ' + (halls - prevHalls) + ' halls go up over the next four months.' +
              (bill ? ' The town pays ' + money(bill) + ' toward water and power upgrades.' : ''), {x: SITE.x + 5, y: SITE.y + 8, showable: true});
  };

  P._construction = function(simData) {
    var s = this.s, c = s.construction;
    if (!c || s.months < c.until) return;
    s.construction = null;
    for (var i = c.from; i < c.to; i++) {
      var spot = HALL_SPOTS[i];
      var coop = s.deal.coop && i === 0 ? B.DC_COOP : B.DC_HELIX;
      this.placeBuilding(coop, spot.x, spot.y);
    }
    if (s.deal.coop && c.from > 0) this.placeBuilding(B.DC_COOP, HALL_SPOTS[0].x, HALL_SPOTS[0].y);
    s.hallsBuilt = c.to;
    this.news('good', 'The ' + this.dev().short + ' campus switches on: ' + c.to + ' halls humming by the interstate. Power demand jumps.',
              {x: SITE.x + 5, y: SITE.y + 8, showable: true});
    this.drama();
  };

  // Monthly money from the deal: abated property tax, PILOT (or the wealth fund), equity, kids' trust
  P._dealMoney = function(simData) {
    var s = this.s, d = s.deal, budget = this._sim.budget;
    s.fundDividend = 0;
    if (!d || !s.hallsBuilt) { s.dealIncome = 0; return; }
    var online = this.devHalls().filter(function(h) { return h.powered; }).length;
    var abated = s.months - d.month < d.abateYears * 12 ? d.abatePct / 100 : 0;
    var tax = online * HALL_TAX * (1 - abated);
    var pilot = d.pilot / 12;
    var equity = online * HALL_REVENUE * (d.equity || 0) / 100;
    var income = tax + equity;
    if (d.fund) s.fund = (s.fund || 0) + pilot; else income += pilot;
    if (d.kids) s.kidsTrust = (s.kidsTrust || 0) + online * HALL_REVENUE * d.kids / 100;
    if (s.fund) { s.fundDividend = s.fund * 0.006; s.fund -= s.fundDividend; }
    s.dealIncome = income;
    if (Math.round(income)) budget.spend(-Math.round(income));
  };

  P._developer = function(mi) {
    var s = this.s, dv = s.dev, dev = this.dev();
    if (!this.festus()) return;
    if (dv.status === 'review' && mi >= dv.due && !s.card) {
      var o = dv.offer, asks = dv.asks || [];
      var hard = asks.reduce(function(n, a) { return n + (ASKS[a].hard || 0); }, 0);
      var p = clamp(0.35 + 0.5 * this.leverage() - 0.12 * (asks.length - 1) - 0.08 * hard, 0.1, 0.9);
      if (this._forceCounter !== undefined) { p = this._forceCounter ? 1 : 0; this._forceCounter = undefined; }
      if (Random.getRandom(99) < p * 100) {
        asks.forEach(function(a) { ASKS[a].apply(o.terms); });
        o.tier = Math.min(TIERS.length - 1, o.tier + (asks.length > 1 ? 1 : 0));
        o.kind = 'better';
        dv.status = 'offer';
        this.bump({res: 2, school: 1}, dev.short + ' improved its offer');
        s.mayor.lastCard = -99;
        this._offerCard();
      } else {
        dv.patience--;
        if (dv.patience < 0) { dv.patience = 2; this.devWalks('counter'); return; }
        o.kind = 'firm';
        dv.status = 'offer';
        s.mayor.lastCard = -99;
        this._offerCard();
      }
      return;
    }
    if (s.mayor.reopenDue !== undefined && mi >= s.mayor.reopenDue && dv.status === 'signed' && !s.card) {
      s.mayor.reopenDue = undefined;
      this.makeOffer(Math.min(TIERS.length - 1, this._dealTier() + 1), 'reopen');
      dv.offer.halls = 0;
      s.mayor.lastCard = -99;
      this._offerCard();
      return;
    }
    if (dv.status === 'away' && mi >= dv.due && this.canCard()) {
      dv.patience = 2;
      this.makeOffer(dv.returnTier, 'return');
      this._offerCard();
      return;
    }
    if (dv.status === 'signed' && dv.nextExpansion >= 0 && mi >= dv.nextExpansion && s.deal.halls < HALL_SPOTS.length && !s.construction && this.canCard()) {
      var tier = Math.min(TIERS.length - 1, this._dealTier() + 1);
      this.makeOffer(tier, 'expansion');
      this._offerCard();
    }
  };
  P._dealTier = function() {
    var d = this.s.deal;
    if (!d) return 0;
    for (var i = TIERS.length - 1; i >= 0; i--) if ((d.equity || 0) >= (TIERS[i].equity || 0) && d.pilot >= TIERS[i].pilot) return i;
    return 0;
  };

  // ---- the scripted opening (echoes Festus, spring 2026) and the court date ----
  P._scripted = function(mi) {
    var s = this.s, sc = s.mayor.scripted, dev = this.dev();
    if (!this.festus()) return;
    if (!sc.council && mi >= COUNCIL_ELECTION) {
      sc.council = true;
      if (s.deal) {
        this.bump({res: -5, school: -2}, 'Council members who backed the deal were ousted');
        this.news('bad', 'VOTERS OUST ALL FOUR COUNCIL MEMBERS UP FOR RE-ELECTION. The deal was signed in closed sessions; the new council wants answers. Your own seat is on the ballot in April 2028.',
                  {paper: true, tone: 'bad', headline: 'VOTERS OUST ALL FOUR COUNCIL MEMBERS UP FOR RE-ELECTION',
                   body: 'Days after the ' + dev.short + ' vote, every incumbent on the ballot lost. Challengers ran on one issue: the data center, and how it was approved.',
                   helps: 'Nothing, for you. The message is clear.', strains: 'Residents and parents are angry. Your seat is up in April 2028; under 50% approval and you\'re out.'});
      } else {
        this.bump({res: 3, school: 2}, 'Challengers who opposed the secret deal won');
        this.news('good', 'Challengers who campaigned against the secret deal sweep the council races. They back your hard line with ' + dev.short + '.',
                  {paper: true, tone: 'good', headline: 'CHALLENGERS SWEEP COUNCIL RACES ON DATA CENTER',
                   body: 'Voters threw out the incumbents who wanted a quick yes. The new council says no deal without public terms.',
                   helps: 'Residents trust you more, and you have leverage.', strains: 'The trades and the chamber want a deal soon. Your seat is up in April 2028.'});
      }
      this.drama();
    }
    if (!sc.court && mi >= COURT_HEARING) {
      sc.court = true;
      if (s.deal && s.deal.nda) {
        if (this._forceCourt !== undefined ? this._forceCourt : Random.getRandom(1)) {
          s.deal.nda = false;
          this.bump({res: 5, school: 2, biz: -3}, 'A judge voided the closed-door agreement');
          this.news('bad', 'JUDGE VOIDS THE DATA CENTER AGREEMENT: the closed sessions broke the open-meetings law. ' + dev.short + ' must re-sign in public.',
                    {paper: true, tone: 'bad', headline: 'JUDGE VOIDS DATA CENTER AGREEMENT',
                     body: 'At the December 10 hearing, the residents\' lawsuit won: the council approved the deal in sessions the public couldn\'t attend.',
                     helps: 'Residents feel heard; the terms will be public.', strains: dev.short + ' wants a new agreement fast, and the trades worry about delays.'});
          this.makeOffer(Math.max(1, this._dealTier() + 1), 'renegotiate');
          s.dev.offer.halls = 0;
          s.mayor.lastCard = -99;
          this._offerCard();
        } else {
          this.bump({res: -4, school: -2}, 'A judge upheld the closed-door agreement');
          this.news('neutral', 'The judge upholds the data center agreement. The residents who sued vow to appeal and to remember in 2028.');
        }
        this.drama();
      } else if (s.deal) {
        this.news('neutral', 'The residents\' lawsuit is dropped: the agreement was made in the open.');
      }
    }
  };

  // ---- elections ----
  P._elections = function(mi) {
    var s = this.s, m = s.mayor;
    if (m.gameOver) return;
    ELECTIONS.forEach(function(e, i) {
      if (mi === e - 3 && !m['warned' + i]) {
        m['warned' + i] = true;
        this.news(m.approval < 50 ? 'bad' : 'neutral', 'Election in April: your approval is ' + Math.round(m.approval) + '%. Under 50 and the voters send you home.');
      }
      // the campaign is a choice too: shown as soon as no other card is open in the three months before the vote
      if (mi >= e - 3 && mi < e && !m['camp' + i] && !s.card) { m['camp' + i] = true; this._campaignCard(i); }
      if (mi >= e && !m['held' + i]) { m['held' + i] = true; this.election(i); }
    }, this);
  };

  var CAMPAIGN_COST = 600;
  P._campaignCard = function(i) {
    var m = this.s.mayor, self = this;
    var order = FACTIONS.slice().sort(function(a, b) { return m.factions[a.id].v - m.factions[b.id].v; });
    var tour = {}; tour[order[0].id] = 9; tour[order[1].id] = 4;
    this.campaign = {tour: tour, freeze: {res: 5, farm: 4, school: -6, biz: 1}};
    this.showCard({type: 'campaign', id: 'campaign' + i, kicker: 'Election ' + (2028 + 2 * i) + ' · the campaign',
      title: 'April is coming. How do you run?',
      body: 'You are at ' + Math.round(m.approval) + '%. You need 50. ' + order[0].name + ' (' + Math.round(m.factions[order[0].id].v) + ') and ' +
            order[1].name + ' (' + Math.round(m.factions[order[1].id].v) + ') are the least happy with City Hall.',
      rows: [],
      options: [{id: 'tour', label: 'Town hall tour ($' + CAMPAIGN_COST + ')', tone: 'good', disabled: this._sim.budget.totalFunds < CAMPAIGN_COST,
                 preview: this.preview(tour), note: 'Sit down with the angriest groups in the high school gym.'},
                {id: 'freeze', label: 'Promise a property tax freeze', tone: 'neutral', preview: this.preview(this.campaign.freeze),
                 note: 'Homeowners love it. The school budget doesn\'t.'},
                {id: 'record', label: 'Run on your record', tone: 'bad', preview: [], note: 'Spend nothing. Hope it holds.'}]});
  };
  P._decideCampaign = function(card, option) {
    var c = this.campaign || {tour: {res: 9}, freeze: {res: 5, farm: 4, school: -6, biz: 1}};
    if (option === 'tour') { this._sim.budget.spend(CAMPAIGN_COST); this.bump(c.tour, 'Town hall tour'); }
    else if (option === 'freeze') this.bump(c.freeze, 'Promised a property tax freeze');
  };

  P.election = function(i) {
    var s = this.s, m = s.mayor, dev = this.dev();
    var vote = clamp(m.approval + (this._forceVote !== undefined ? 0 : Random.getRandom(4) - 2), 0, 100);
    if (this._forceVote !== undefined) vote = this._forceVote;
    var year = 2028 + 2 * i;
    m.lastVote = Math.round(vote);
    this.drama();
    if (Math.round(vote) < 50) {
      m.gameOver = {year: year, vote: Math.round(vote)};
      var worst = FACTIONS.slice().sort(function(a, b) { return m.factions[a.id].v - m.factions[b.id].v; })[0];
      this.news('bad', 'VOTERS OUST MAYOR: you get ' + Math.round(vote) + '% in the ' + year + ' election.',
                {paper: true, tone: 'bad', gameOver: true, headline: 'VOTERS OUST MAYOR',
                 body: 'The mayor won ' + Math.round(vote) + '% of the vote. ' + worst.name + ' turned out against City Hall in force' +
                       (s.deal ? ', and the ' + dev.short + ' deal hung over the race.' : '.'),
                 helps: 'You served ' + (m.electionsWon ? m.electionsWon + 1 : 1) + ' term' + (m.electionsWon ? 's' : '') + '.',
                 strains: 'Game over. Start again, or keep watching the town as a private citizen.'});
      return;
    }
    m.electionsWon++;
    var share = this.townShare();
    var won = m.electionsWon >= WIN_TERMS || (share >= WIN_SHARE && (s.fundDividend > 0 || s.policies.dividend));
    if (won) m.won = {year: year, vote: Math.round(vote), share: Math.round(share * 100)};
    var pct = Math.round(share * 100), owns = share >= WIN_SHARE;
    var headline = !won ? 'MAYOR RE-ELECTED' : owns ? 'A TOWN THAT OWNS ITS FUTURE' : 'THREE TERMS AND DONE';
    this.news('good', 'MAYOR RE-ELECTED with ' + Math.round(vote) + '% of the vote.',
              {paper: true, tone: 'good', win: !!won, headline: headline,
               body: !won ? 'The mayor won ' + Math.round(vote) + '% and a new term. Next election: April ' + (year + 2) + '.' :
                     owns ? 'Re-elected with ' + Math.round(vote) + '%. The town owns ' + pct + '% of the compute it hosts' +
                            (s.fundDividend > 0 ? ' and its wealth fund pays every resident a dividend.' : '.') + ' You won.' :
                            'Re-elected with ' + Math.round(vote) + '% for a third term. You held the town together. You won.',
               helps: won ? 'AfterSight complete. Keep playing as long as you like.' : 'Two more years to make the deals work.',
               strains: won ? (owns ? 'The deal still has to hold for the next mayor.' :
                               'The town owns ' + pct + '% of the compute it hosts. ' + dev.short + ' owns the rest, and the next mayor inherits that.') :
                        'Goal: ' + WIN_TERMS + ' wins, or a win with the town owning ' + Math.round(WIN_SHARE * 100) + '%+ of local compute and paying a dividend. Wins so far: ' + m.electionsWon + '.'});
  };

  // ---- breakthroughs ----
  P.researchEstimate = function(id) {
    var r = RESEARCH[id], per = r.compute / r.months, own = this.townCompute();
    var market = Math.max(0, per - own) * r.months * this.computePrice();
    return {per: Math.round(per), own: own, market: Math.round(market), total: Math.round(r.cost + market)};
  };
  P._researchCard = function(id) {
    var r = RESEARCH[id], e = this.researchEstimate(id), funds = this._sim.budget.totalFunds;
    var canStart = funds >= r.cost;
    this.showCard({
      type: 'research', id: id, kicker: 'Breakthrough discovered', title: r.name, body: r.found,
      rows: [
        ['Cost', money(r.cost) + ' up front', 'neutral'],
        ['Compute', r.compute.toLocaleString() + ' over ' + r.months + ' months (' + e.per + ' a month)', 'neutral'],
        ['Your compute', e.own + ' a month from the town\'s data center share', e.own >= e.per ? 'good' : e.own ? 'neutral' : 'bad'],
        ['Market compute', e.market ? money(e.market) + ' to buy the rest at ' + money(this.computePrice()) + ' a unit' : 'Not needed', e.market ? 'bad' : 'good'],
        ['Total', money(e.total) + ' (you have ' + money(funds) + ')', e.total > funds ? 'bad' : 'good'],
        ['Unlocks', r.unlocks, 'good']
      ],
      options: [
        {id: 'invest', label: canStart ? 'Invest ' + money(e.total) : 'Can\'t afford ' + money(r.cost), tone: 'good', disabled: !canStart,
         preview: this.preview({work: 1, biz: 1, school: 1}), note: e.total > funds ? 'Market compute may stall the project if money runs low.' : ''},
        {id: 'pass', label: 'Pass', tone: 'bad', preview: this.preview(r.passEffect), note: r.pass}
      ]
    });
  };
  P._decideResearch = function(card, option) {
    var s = this.s, r = RESEARCH[card.id], R = s.research;
    if (option === 'invest') {
      this._sim.budget.spend(r.cost);
      R.active = {id: card.id, left: r.months, per: r.compute / r.months, stalled: 0};
      this.bump({work: 1, biz: 1, school: 1}, 'Invested in ' + r.name.toLowerCase());
      this.news('neutral', 'Research begins: ' + r.name + '. ' + r.months + ' months, ' + r.compute.toLocaleString() + ' compute.');
    } else {
      R.passed[card.id] = this.s.months;
      if (r.dependent) s.dependence = (s.dependence || 0) + 1;
      if (r.bills) s.passedBills = (s.passedBills || 0) + r.bills;
      this.bump(r.passEffect, 'Passed on ' + r.name.toLowerCase());
      this.news('bad', 'You passed on ' + r.name.toLowerCase() + '. ' + r.pass);
      R.next = this.mi() + 7;
    }
  };
  P._researchMonthly = function(simData) {
    var s = this.s, R = s.research, budget = this._sim.budget;
    var a = R.active;
    if (a) {
      var own = this.townCompute(), short = Math.max(0, a.per - own), cost = Math.round(short * this.computePrice());
      if (cost > budget.totalFunds) {
        if (!a.stalled) this.news('bad', 'Research on ' + RESEARCH[a.id].name.toLowerCase() + ' stalls: the town can\'t afford ' + money(cost) + ' of market compute this month.');
        a.stalled++;
        return;
      }
      if (cost) budget.spend(cost);
      a.stalled = 0;
      a.left--;
      if (a.left <= 0) {
        R.active = null;
        R.done[a.id] = s.months;
        R.next = this.mi() + 5;
        this.discover(a.id, simData);
        this.drama();
      }
    }
  };
  P.nextResearch = function() {
    var R = this.s.research;
    for (var i = 0; i < RESEARCH_ORDER.length; i++) {
      var id = RESEARCH_ORDER[i];
      if (!R.done[id] && R.passed[id] === undefined && !(R.active && R.active.id === id) && !this.has(id)) return id;
    }
    return null;
  };

  var scale = function(d, k) { var o = {}; Object.keys(d).forEach(function(f) { o[f] = d[f] * k; }); return o; };
  P._decideAsk = function(card, option) {
    var a = ASK_CARDS[card.id], pick = option === 'yes' ? a.yes : a.no, m = this.s.mayor;
    var log = m.askLog[card.id] = m.askLog[card.id] || {times: 0, declined: 0};
    log.times++;
    if (option === 'yes') log.declined = 0; else log.declined++;
    log.last = this.s.months;
    if (pick.cost) this._sim.budget.spend(pick.cost);
    if (pick.effect) pick.effect(this);
    this.bump(scale(pick.d, card.mult || 1), a.title + ': ' + pick.label.toLowerCase());
  };
  // An ask can come back: a declined one returns louder after ASK_RETURN months (twice at most), and the
  // yearly ones (surplus, tax rate, levy) come round again on their own schedule.
  var ASK_RETURN = 15;
  P._askReady = function(k) {
    var m = this.s.mayor, a = ASK_CARDS[k], log = m.askLog[k];
    if (!a.when(this)) return false;
    if (!log) return true;
    var since = this.s.months - log.last;
    if (log.declined) return log.declined <= 2 && since >= ASK_RETURN;
    return !!a.repeat && since >= a.repeat;
  };
  P._askCard = function() {
    var m = this.s.mayor, self = this;
    m.askLog = m.askLog || {};
    var ids = Object.keys(ASK_CARDS).filter(function(k) { return self._askReady(k); });
    if (!ids.length) return false;
    // the unhappiest faction speaks first
    ids.sort(function(a, b) { return m.factions[ASK_CARDS[a].faction].v - m.factions[ASK_CARDS[b].faction].v; });
    var id = ids[0], a = ASK_CARDS[id], log = m.askLog[id];
    var again = log && log.declined ? log.declined : 0, mult = 1 + 0.5 * again;
    m.asked[id] = this.s.months;
    var fname = FACTIONS.filter(function(f) { return f.id === a.faction; })[0].name;
    var funds = this._sim.budget.totalFunds;
    this.showCard({type: 'ask', id: id, mult: mult, kicker: 'Town hall · ' + fname + (again ? ' · back again' : ''),
      title: (again === 1 ? 'Again: ' : again > 1 ? 'Third time: ' : '') + a.title,
      body: a.body + (again ? ' You turned them down before. This time they packed the gym, and saying no will cost more.' : ''), rows: [],
      options: [{id: 'yes', label: a.yes.label, tone: 'good', disabled: (a.yes.cost || 0) > funds, preview: this.preview(scale(a.yes.d, mult))},
                {id: 'no', label: a.no.label, tone: 'bad', preview: this.preview(scale(a.no.d, mult))}]});
    return true;
  };

  // ---- the director: research cards on a schedule, and something every few months, never two cards at once ----
  P._director = function(mi) {
    // Something to decide every few months: a breakthrough when one is due, otherwise whichever faction is
    // angriest comes to City Hall with an ask, otherwise the developer comes back early.
    var s = this.s, R = s.research, m = s.mayor;
    if (!this.canCard()) return;
    var since = s.months - m.lastCard, quiet = s.months - m.lastDrama >= DRAMA_GAP;
    var nextR = !R.active && this.nextResearch();
    // a faction that's furious gets the floor before the next breakthrough does
    var furious = FACTIONS.some(function(f) { return m.factions[f.id].v < 30; });
    if (furious && m.lastType !== 'ask' && this._askCard()) return;
    if (nextR && mi >= R.next) { this._researchCard(nextR); return; }
    if (since < CARD_GAP && !quiet) return;
    if (m.lastType !== 'ask' && this._askCard()) return;
    if (nextR) { this._researchCard(nextR); return; }
    if (this.festus() && s.dev.status === 'away') { s.dev.due = mi; return; }
    this._askCard();
  };
}
