/* Aftersight mayor layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * The player is mayor. Approval (0-100) is built from five factions, each weighing bills, water, noise, taxes,
 * jobs, school money and secrecy. Elections come every two years; under 50 you're out.
 *
 * Three kinds of decision card drive the drama, and every big event is either a card or the result of one:
 *  - Developer offers (Festus): tax abatement, PILOT, school fund, jobs, who pays for utility upgrades, an NDA and
 *    town equity, with post-labor terms (wealth fund, kids' trust, compute royalty, a town AI co-op) in the late
 *    tiers, plus a facility design: how the halls are cooled (water) and where their power comes from (bills, air).
 *    Accept, counter with one or two asks, or reject. There is no council: the mayor decides, and elections are the check.
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
import * as TF from '../tileFlags.ts';
import * as B from './buildings.js';
import { SITE, PLANS, DOWNTOWN, plan as sitePlan, fieldAt, fieldTileCount } from './festus.js';
import { money, usd, DOLLARS } from './money.js';

var coolWater = function(c) { return COOLING[c || 'evap'].water; };
var clamp = function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
var copy = function(o) { return JSON.parse(JSON.stringify(o)); };
var askLabel = function(id) { var a = ASKS[id]; return typeof a.label === 'function' ? a.label() : a.label; };

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

// Election calendar, in months since Jan 2026: a town poll in Apr 2026, then the mayor's seat every 2 years
export const SPRING_POLL = 3, COURT_HEARING = 11;
export const ELECTIONS = [27, 51, 75];
export const WIN_TERMS = 3, WIN_SHARE = 0.25;
var CARD_GAP = 6;          // fewest months between two decision cards
var GONE_AFTER = 3;        // walks after which the developer builds elsewhere for good
var FREE_FADE = 42;        // months over which voters stop crediting a mayor for saying no
var CITY_POP = 13000, CITY_MONTHS = 6;   // the town-to-city milestone: this many people, held this many months
var DRAMA_GAP = 8;         // most months without anything meaningful before the director steps in

// ---- Developer offers ----
// Each tier is a full set of terms. Tier 0 is the opening offer: bad for citizens, as first offers are.
// cooling: evap | hybrid | closed; power: grid | gas | clean. The developer opens with the cheapest design.
export const TIERS = [
  {abatePct: 100, abateYears: 20, pilot: 200, school: 0, jobs: 25, utilities: 'town', nda: true, equity: 0, cooling: 'evap', power: 'grid'},
  {abatePct: 75, abateYears: 15, pilot: 500, school: 150, jobs: 40, utilities: 'split', nda: true, equity: 0, cooling: 'evap', power: 'grid'},
  {abatePct: 50, abateYears: 10, pilot: 900, school: 300, jobs: 55, utilities: 'developer', nda: false, equity: 5, cooling: 'hybrid', power: 'grid'},
  {abatePct: 40, abateYears: 10, pilot: 1100, school: 400, jobs: 60, utilities: 'developer', nda: false, equity: 10, fund: true, royalty: 40, cooling: 'hybrid', power: 'grid'},
  {abatePct: 25, abateYears: 10, pilot: 1400, school: 500, jobs: 70, utilities: 'developer', nda: false, equity: 20, fund: true, kids: 5, royalty: 80, coop: true, cooling: 'hybrid', power: 'grid'}
];

// ---- Facility design ----
// Festus buys its water from the Jefferson County Water Authority's collector wells on the Mississippi (a newer main
// well, the original as backup; the city keeps its own wells for emergencies). How the halls are cooled sets how
// much of it they take; where their power comes from sets the town's bills and its air.
export const COOLING = {
  evap: {name: 'Evaporative towers', water: 1, rank: 0},
  hybrid: {name: 'Hybrid cooling', water: 0.5, rank: 1},
  closed: {name: 'Closed-loop liquid cooling', water: 0.1, rank: 2}
};
export const POWER = {
  grid: {name: 'Ameren grid', said: 'the Ameren grid', gridShare: 1},
  gas: {name: 'On-site gas turbines', said: 'its own gas turbines', gridShare: 0},
  clean: {name: 'Solar, batteries and a clean power contract', said: 'solar, batteries and a clean power contract', gridShare: 0.3}
};
var CLOSED_COST = 250, CLEAN_COST = 150, GAS_SAVING = 150;
// A stricter design costs the developer money, so it takes it out of something else on the table
// (first from one term, then the other, then from the jobs promised)
var trim = function(t, amt, first) {
  var order = first === 'school' ? ['school', 'pilot'] : ['pilot', 'school'], floor = {pilot: 100, school: 0};
  var name = {pilot: 'the payment in lieu of taxes', school: 'the school fund'}, parts = [];
  order.forEach(function(k) {
    var cut = Math.min(amt, Math.max(0, t[k] - floor[k]));
    if (cut > 0) { t[k] -= cut; amt -= cut; parts.push(money(cut) + ' a year off ' + name[k]); }
  });
  if (amt > 0) { var j = Math.min(t.jobs - 10, Math.ceil(amt / 25)); if (j > 0) { t.jobs -= j; parts.push(j + ' fewer permanent jobs'); } }
  return parts.join(' and ') || 'nothing left to cut';
};
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
  coop: {label: 'One hall becomes a town-owned AI co-op', late: true, hard: 2, apply: function(t) { t.coop = true; }, ok: function(t) { return !t.coop; }},
  // facility design: each one moves money off the table, or onto it
  cooling: {design: true, label: function() { return 'Require closed-loop cooling: almost no river water (Keystone cuts about ' + money(CLOSED_COST) + '/yr from other benefits)'; },
            apply: function(t) { t.cooling = 'closed'; return trim(t, CLOSED_COST, 'pilot'); },
            ok: function(t) { return t.cooling !== 'closed'; }},
  clean: {design: true, hard: 1, label: function() { return 'Require clean power: solar, batteries, a clean contract (Keystone cuts about ' + money(CLEAN_COST) + '/yr from other benefits)'; },
          apply: function(t) { t.power = 'clean'; return trim(t, CLEAN_COST, 'school'); },
          ok: function(t) { return t.power !== 'clean'; }},
  gas: {design: true, label: function() { return 'Keep it off our grid: Keystone burns its own gas (+' + money(GAS_SAVING) + '/yr PILOT, dirtier air)'; },
        apply: function(t) { t.power = 'gas'; t.pilot += GAS_SAVING; return money(GAS_SAVING) + ' a year to the payment in lieu of taxes'; },
        ok: function(t) { return t.power === 'grid'; }}
};
var DESIGN_DONE = {cooling: 'closed-loop cooling', clean: 'clean power', gas: 'its own gas turbines'};
export const UTIL_TEXT = {town: 'The town pays', split: 'Split 50/50', developer: 'Developer pays'};

// Money per hall per month, in game dollars (one game dollar is $1,000). HALL_TAX is the property tax the city
// collects (before any abatement). HALL_VALUE is what a hall pays its owners a month ($1.5M, three times that once
// a frontier model makes compute worth more): the town gets its equity share of it, all of a co-op hall's, and what
// is left of a bonded hall's after the bond payment. It all goes into the Festus Fund, not the city budget.
var HALL_TAX = 40, HALL_VALUE = 1500, WATER_UPGRADE = 400, HALL_WATER = 12, BOND_SHARE = 0.65;
// Household income per resident per year, in real dollars: the wage a resident earns at full employment, and what
// transfers (unemployment pay, food aid) replace for someone out of work. Dividends from the Fund are the third part.
var WAGE = 31500, TRANSFER = 11000, BASE_JOBLESS = 0.04;
var MIN_DIVIDEND = 1000;  // the ownership win needs a dividend people notice: Alaska-sized, this much per resident a year

// ---- The automation tide (Festus) ----
// Automation reaches every town in the region on its own clock, campus or no campus, and each breakthrough pushes
// it further whoever makes it (the town, or someone else after a pass, or the world by a set month). Hosting compute
// doesn't decide whether the jobs go; owning the engine decides who gets the gains.
export const TIDE = {start: 0.03, ramp: 0.3, rampFrom: 12, rampTo: 72, late: 0.1, lateTo: 120,
                     bumps: {cheap_solar: 0.02, frontier_model: 0.1, robots_build_robots: 0.1, fusion: 0.03},
                     world: {frontier_model: 36, robots_build_robots: 54}};

// ---- Which way the town is heading (the five paths in docs/IDEAS.md, plus the two in-between states) ----
export const PATHS = {
  early: {name: 'Early days', tone: 'neutral', desc: 'The big choices are still open.'},
  building: {name: 'Building a stake', tone: 'neutral', desc: 'The town owns part of the engine, not yet enough to replace lost wages.'},
  owners: {name: 'Thriving owners', tone: 'good', desc: 'Households own a real stake: dividends make up for the work machines took, and people have things worth doing.'},
  enclosure: {name: 'Rich few', tone: 'bad', desc: 'The developer owns the engine. The town gets rent, noise and a tax check; the gains go elsewhere.'},
  checks: {name: 'Checks without purpose', tone: 'bad', desc: 'Transfers and dividends keep people fed, but few have work or projects that need them.'},
  strain: {name: 'Boom and strain', tone: 'bad', desc: 'Growth tied to one company, and the water, power bills or air are paying for it.'},
  decline: {name: 'No deal, decline', tone: 'bad', desc: 'No campus and no stake of its own: the jobs shock arrives anyway, and nothing replaces the wages.'}
};
// The water authority adds capacity for the deal: it covers this share of an evaporative hall's draw
var WELL_UPGRADE = 0.6, GRID_STRAIN = 0.02, FUMES_RES = 6, FUMES_SCHOOL = 5;

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
// ---- Festus Fund ----
var FUND_GROWTH = 0.004, FUND_FLOOR = 0.04, FUND_RANGE = 0.36;   // ~5% a year; pays out 4% to 40% of the fund each January

// ---- Town projects (proposed tuning; see the equity and purpose research Page) ----
// A built project's Purpose fades over two years to a floor; a new season (a renewal at a fraction of the cost)
// brings it back, so the town keeps doing things together instead of building three things once.
var NEIGHBOR_COST = 1.15, ROBOT_PURPOSE = 0.6, NEIGHBOR_PURPOSE = 1.5, PROJECT_FADE = 24, PROJECT_FLOOR = 0.3;
var RENEW_COST = 0.3, RENEW_AT = 0.6;   // a season costs 30% of building it; offered once the boost has faded to 60%
export const PROJECTS = {
  garden: {name: 'Community garden plots', base: 300, labor: 0.7, purpose: 5, months: [2, 4], d: {res: 2, farm: 2},
    body: 'Raised beds and a tool shed on the empty lots off Main Street. Anyone can take a plot; the extension office will teach.',
    opened: ['The community garden opens. The robots did a tidy job; a few plots are already taken.',
             'The community garden opens with a potluck. Neighbors who built the beds are trading tomatoes and seed tips.']},
  murals: {name: 'Main Street murals', base: 600, labor: 0.8, purpose: 7, months: [2, 4], d: {biz: 3, res: 2},
    body: 'Painted walls down Main Street: the river, the old glassworks, the people of Festus. The chamber likes the foot traffic.',
    opened: ['The Main Street murals are finished. Printed from a design file, they look sharp.',
             'The Main Street murals are finished. Local painters, students and retirees signed their corners.']},
  park: {name: 'Riverfront park and trail', base: 2500, labor: 0.65, purpose: 10, months: [6, 12], d: {res: 4, biz: 2, school: 2},
    body: 'A trail and picnic lawns along the Mississippi bottoms, with a launch for kayaks and a stage for summer nights.',
    opened: ['The riverfront park and trail open. Families are out on the first warm weekend.',
             'The riverfront park and trail open. The crews who cleared the bottoms walk the first mile together, and the high school band plays.']},
  library: {name: 'Tool library and makerspace', base: 900, labor: 0.6, purpose: 7, months: [2, 5], d: {work: 3, school: 2, res: 1},
    body: 'An old storefront full of tools, printers and a robot arm anyone can book. Retired machinists teach the night classes.',
    opened: ['The tool library opens. The robots stocked it overnight; the shelves are full.',
             'The tool library opens. The machinists who fitted it out run the first class, and it is full.']},
  league: {name: 'Youth league and ball fields', base: 1200, labor: 0.7, purpose: 8, months: [3, 6], d: {school: 4, res: 2},
    body: 'Lights and new fields by the high school, and a league for every kid who wants one. Parents coach.',
    opened: ['The new ball fields open, mowed and lined by the robots.',
             'The new ball fields open. Parents who built the dugouts are coaching the first games.']},
  market: {name: 'Saturday market hall', base: 800, labor: 0.65, purpose: 6, months: [2, 4], d: {biz: 3, farm: 3, res: 1},
    body: 'A covered hall off Main Street where farms, bakers and makers sell on Saturdays. The chamber runs it.',
    opened: ['The market hall opens. The stalls are tidy and half empty for now.',
             'The market hall opens. Farmers who raised the frame are selling out by noon.']},
  observatory: {name: 'Night-sky observatory and science center', base: 6000, labor: 0.55, purpose: 12, months: [8, 14], d: {school: 6, res: 3, biz: 1},
    body: 'A dome on the bluffs with a big telescope and a science center underneath. Schools across the county will come.',
    opened: ['The observatory opens on the bluffs. The robots aligned the mirror to a hair.',
             'The observatory opens on the bluffs. Volunteers who poured the dome run the first star party, and the line goes down the hill.']},
  lantern: {name: 'The Lantern', base: 30000, labor: 0.8, purpose: 25, months: [12, 24], d: {res: 8, school: 6, work: 6, biz: 4, farm: 4}, abundance: 0.55,
    body: 'A tower of light on the riverfront, built for no reason except that the town can. Only deep abundance makes it affordable.',
    opened: ['The Lantern is lit. It is enormous, and nobody quite knows what it is for.',
             'The Lantern is lit. Half the town worked a shift on it, and the whole town is down by the river tonight.']}
};
export const PROJECT_ORDER = ['garden', 'murals', 'market', 'library', 'league', 'park', 'observatory', 'lantern'];
// where each project shows up on the map: near Main Street, on the river bottoms, or up on the bluffs
var PROJECT_SPOTS = {garden: 'downtown', murals: null, market: 'downtown', library: 'downtown', league: 'downtown', park: 'river', observatory: 'edge', lantern: 'river'};
var PROJECT_SIZE = {garden: 2, market: 2, library: 2, league: 3, park: 4, observatory: 3, lantern: 3};
export const RESEARCH_ORDER = ['cheap_solar', 'frontier_model', 'robots_build_robots', 'the_cure', 'fusion'];
var COMPUTE_PRICE = 3;     // dollars per compute unit bought on the market
// Research Labs: breakthroughs only turn up while one runs. Each uses some town compute (bought at market price
// when the town has too little) and costs upkeep; more labs and more town compute bring the next one sooner.
export const LAB_COST = 1500;
var LAB_COMPUTE = 10, LAB_UPKEEP = 10, LAB_FAST = 150;

// ---- Town hall asks: raised by the state of the town ----
var MAX_BONDS = 2, WELL_ADD = 25, WELL_COST = 1500;
var ASK_CARDS = {
  sound_wall: {faction: 'res', when: function(L) { return L.hallsOnline() > 0 && L.noise() > 0.6; },
    title: 'Neighbors want a sound wall', body: 'Families on the streets by the campus say the cooling fans never stop. They want earth berms and a sound wall.',
    yes: {label: function() { return 'Build it (' + money(600) + ')'; }, cost: 600, d: {res: 7, school: 1}, effect: function(L) { L.s.mayor.soundWall = true; }},
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
    title: 'Publish the agreement?', body: 'Residents and the school board demand that City Hall release the developer agreement and the notes from its closed-door talks.',
    yes: {label: 'Publish it', d: {res: 7, school: 4, biz: -2}, effect: function(L) { L.s.deal.nda = false; L.s.dev.patience = Math.max(0, L.s.dev.patience - 1); }},
    no: {label: 'Keep it sealed', d: {res: -6, school: -3}}},
  tax_cut: {faction: 'biz', repeat: 30, when: function(L) { return L.s.months > 10 && L._sim.budget.cityTax > 4; },
    title: 'The chamber wants a tax cut', body: 'Main Street shop owners ask for a one-point cut in the city tax rate.',
    yes: {label: 'Cut taxes 1 point', d: {biz: 6, school: -4}, effect: function(L) { L._sim.budget.cityTax--; }},
    no: {label: 'Hold the rate', d: {biz: -4}}},
  // reinvest: the town's own money (taxes, PILOT, equity) can buy back goodwill, and the ask comes back every year
  reinvest: {faction: 'school', repeat: 18, when: function(L) { return L.s.months > 8 && L._sim.budget.totalFunds > 4000; },
    title: 'What do we do with the surplus?', body: 'The budget office has money left over this year. The school board and the neighborhood groups both have a list.',
    yes: {label: function() { return 'Classrooms and parks (' + money(1200) + ')'; }, cost: 1200, d: {school: 6, res: 4, farm: 1}},
    no: {label: 'Bank it', d: {biz: 2, school: -2}}},
  // the town that said no grows its own way
  homegrown: {faction: 'work', repeat: 10, when: function(L) { return !L.s.deal && L.s.dev.walks > 0 && (L.s.mayor.homegrown || 0) < 2; },
    title: 'Grow it ourselves?', body: 'With no campus coming, the chamber and the trades pitch a plan: a community solar farm, Main Street grants and a training program at the high school.',
    yes: {label: function() { return 'Fund the plan (' + money(1000) + ')'; }, cost: 1000, d: {work: 6, biz: 5, res: 2, farm: 2},
          effect: function(L) { var m = L.s.mayor; m.homegrown = (m.homegrown || 0) + 1;
                                // the second plan includes a bond for a town-owned data center
                                if (m.homegrown === 2 && (m.coopBonds || 0) < MAX_BONDS) { m.coopBonds = (m.coopBonds || 0) + 1; L._bondNews(); } }},
    no: {label: 'Not this year', d: {work: -3, biz: -3}}},
  // the purpose engine: when the work goes, give people somewhere to be needed
  guild: {faction: 'work', when: function(L) { return L.festus() && !L.s.policies.purposeProgram && L.s.months > 10 && (L.s.automation > 0.1 || L.s.unemployment > 0.12); },
    title: 'An apprenticeship guild?', body: 'The trades and the community college want the city to fund a guild: paid apprenticeships, repair crews and civic work for people whose jobs went to machines.',
    yes: {label: function(L) { return 'Fund the guild (' + money(L.guildCost()) + ' a month)'; }, d: {work: 6, res: 2, school: 2, biz: -1},
          effect: function(L) { L.setPolicy('purposeProgram', true); }},
    no: {label: 'Not now', d: {work: -4, res: -1}}},
  // home-grown ownership: a bond for a data center the town owns outright
  coop_bond: {faction: 'work', repeat: 18, when: function(L) { return L.festus() && (L.s.months >= 30 || L.has('frontier_model')) && (!!L.s.deal || L.s.dev.walks > 0) &&
                                                                    (L.s.mayor.coopBonds || 0) < MAX_BONDS; },
    title: 'A town-owned data center?', body: 'The building trades and the credit union propose a bond: Festus builds and owns a data center hall of its own. Its revenue pays the bond first; the rest goes into the Festus Fund. You still place it, power it and pay the down payment.',
    yes: {label: 'Back the bond', d: {work: 5, res: 2, biz: 2, farm: -2}, effect: function(L) { L.s.mayor.coopBonds = (L.s.mayor.coopBonds || 0) + 1; L._bondNews(); }},
    no: {label: 'Not now', d: {work: -3, biz: -1}}},
  // the water authority's wells are near their limit, campus or no campus
  well_upgrade: {faction: 'farm', repeat: 18, when: function(L) { return L.festus() && L.s.months > 6 && L.s.water.use / Math.max(1, L.s.water.cap) > 0.85; },
    title: 'Expand the river wells?', body: 'The county water authority can add a collector well on the Mississippi. Festus pays its share, unless the developer agreed to pay for upgrades.',
    yes: {label: function(L) { var c = L.wellCost(); return c ? 'Pay for the well (' + money(c) + ')' : 'Have the developer pay for it'; },
          cost: function(L) { return L.wellCost(); }, d: {farm: 6, res: 3}, effect: function(L) { L.s.water.cap += WELL_ADD; }},
    no: {label: 'Not now', d: {farm: -4, res: -2}}},
  // a bad deal can be reopened: residents push, the developer comes back to the table
  reopen: {faction: 'res', card: true, when: function(L) { return L.s.deal && L._dealTier() <= 1 && L.s.dev.status === 'signed' && !L.s.construction &&
                                                         L.s.months - L.s.deal.month >= 8 && !L.s.mayor.reopened; },
    title: 'Reopen the deal?', body: 'Residents who packed the spring town hall say the agreement was signed too fast and too cheap. They want you to call the developer back to the table.',
    yes: {label: 'Call them back', d: {res: 4, school: 2, biz: -2}, effect: function(L) { L.s.mayor.reopened = true; L.s.mayor.reopenDue = L.mi() + 1; }},
    no: {label: 'A deal is a deal', d: {res: -4, biz: 3}}},
  school_levy: {faction: 'school', repeat: 30, when: function(L) { return L.s.months > 30 && L._sim.budget.cityTax < 12; },
    title: 'The school board wants a levy', body: 'Classrooms are packed. The board asks you to back a one-point tax increase for the schools.',
    yes: {label: 'Back the levy', d: {school: 9, res: -3, biz: -3}, effect: function(L) { L._sim.budget.cityTax++; L.s.mayor.levy = (L.s.mayor.levy || 0) + 1; }},
    no: {label: 'Decline', d: {school: -6}}}
};


var signed = function(n) { n = Math.round(n); return (n > 0 ? '+' : n < 0 ? '\u2212' : '\u00b1') + Math.abs(n); };

export function freshMayor() {
  var f = {};
  FACTIONS.forEach(function(x) { f[x.id] = {v: 55, mem: 0}; });
  return {approval: 55, factions: f, electionsWon: 0, lastDrama: 0, lastCard: -99, history: [], asked: {},
          gameOver: null, won: null, sandbox: false, scripted: {}};
}
export function freshDev() { return {status: 'none', offer: null, due: -1, patience: 2, walks: 0, counters: 0, nextExpansion: -1, plan: 0, farmed: null}; }
export function freshResearch() { return {active: null, done: {}, passed: {}, next: 6, clock: 0}; }   // next and clock count lab-months

export function installMayor(L) {
  var P = L.prototype;

  P.mi = function() { var d = this._sim.getDate(); return (d.year - 2026) * 12 + d.month; };
  P.dev = function() { return DEVELOPERS[this.s.scenario] || DEVELOPERS.starter; };
  P.festus = function() { return this.s.scenario === 'festus'; };
  // The campus parcel: the signed deal's, else the one on the table, else the one the developer wants next
  P.sitePlan = function() {
    var s = this.s, d = s.dev;
    return sitePlan(s.deal ? s.deal.plan : d.offer && d.offer.plan !== undefined ? d.offer.plan : d.plan);
  };
  // No proposed site on the map while the developer is away; that land is farmed again
  P.siteShown = function() { return this.festus() && (!!this.s.deal || (this.s.dev.status !== 'away' && this.s.dev.status !== 'gone')); };
  P.farmedRects = function() { return this.s.dev && (this.s.dev.status === 'away' || this.s.dev.status === 'gone') ? this.s.dev.farmed || null : null; };
  P.maxHalls = function() { return this.sitePlan().spots.length; };
  // Power a campus pulls, in MW (a coal plant makes 700), and how much more water it needs than the whole town uses now
  P.campusMW = function(halls) { return halls * this.dcDraw(); };
  P.campusWaterPct = function(halls, cooling) {
    var town = Math.max(1, (this._sim.evaluation.cityPop || 0) / 150);
    return Math.round(HALL_WATER * coolWater(cooling) * halls / town * 100);
  };
  // Share of the campus's power that comes off the town grid (on-site gas: none; solar + batteries: some firming)
  P.gridShare = function() { var d = this.s.deal; return d && this.festus() ? POWER[d.power || 'grid'].gridShare : 1; };
  P._designNews = function(t) {
    if (!t) return '';
    return ' Cooling: ' + COOLING[t.cooling || 'evap'].name.toLowerCase() + '. Power: ' + POWER[t.power || 'grid'].said + '.';
  };
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

  // ---- ownership: what each hall pays its owners, and the town's share of it ----
  P.hallValue = function() { return HALL_VALUE * this.dcCompute() / 100; };   // game dollars a month; x3 after a frontier model
  // co-op halls online: the one in the deal (if it has one) and the ones the town bonded and built itself
  P.coopHalls = function() {
    var all = this.dataCenters().filter(function(d) { return d.owner === 'coop' && d.powered; }).length;
    var inDeal = this.s.deal && this.s.deal.coop && this.s.hallsBuilt ? Math.min(1, all) : 0;
    return {deal: inDeal, bonded: Math.max(0, all - inDeal)};
  };
  P.bondedBuilt = function() {
    var all = this.dataCenters().filter(function(d) { return d.owner === 'coop'; }).length;
    return Math.max(0, all - (this.s.deal && this.s.deal.coop && this.s.hallsBuilt ? 1 : 0));
  };
  P.bondPermits = function() { return Math.max(0, (this.s.mayor.coopBonds || 0) - this.bondedBuilt()); };
  P._bondNews = function() {
    this.news('neutral', 'The co-op bond passes. Build the town\'s own data center from the Compute menu: it needs a clear 3x3 site by a power line, and ' +
              money(4000) + ' down.', {alert: 'fund'});
  };
  P.guildCost = function() { return Math.round(10 + (this._sim._census.resPop || 0) * 0.06); };
  P.wellCost = function() { return this.s.deal && this.s.deal.utilities === 'developer' ? 0 : WELL_COST; };

  // ---- the automation tide: the share of work machines do across the region (Festus) ----
  P.tideTarget = function() {
    var s = this.s, m = s.months, R = s.research || {}, self = this, t = TIDE.start;
    var ramp = function(from, to) { return clamp((m - from) / (to - from), 0, 1); };
    t += TIDE.ramp * ramp(TIDE.rampFrom, TIDE.rampTo) + TIDE.late * ramp(TIDE.rampTo, TIDE.lateTo);
    Object.keys(TIDE.bumps).forEach(function(id) {
      var here = self.has(id) || (R.passed && R.passed[id] !== undefined);
      if (here || (TIDE.world[id] !== undefined && m >= TIDE.world[id])) t += TIDE.bumps[id];
    });
    return clamp(t, 0, 0.9);
  };

  // ---- household income, per resident per year in real dollars: wages, ownership (the Fund's dividend), transfers ----
  P.incomeMix = function() {
    var s = this.s, u = clamp(s.unemployment || 0, 0, 1);
    var wages = WAGE * (1 - u), transfers = TRANSFER * u, own = s.dividendPerRes || 0, total = wages + transfers + own;
    var lost = WAGE * Math.max(0, u - BASE_JOBLESS);
    return {wages: wages, own: own, transfers: transfers, total: total, ownShare: total ? own / total : 0,
            cover: lost > 1 ? clamp(own / lost, 0, 1) : (own > 0 ? 1 : 0), lost: lost};
  };

  // ---- which of the paths the town is on ----
  P.pathNow = function() {
    var s = this.s, d = s.deal, mix = this.incomeMix(), use = s.water.use / Math.max(1, s.water.cap);
    var share = this.townShare();
    if (s.months < 15 && !d && !s.dev.walks) return 'early';
    if (mix.ownShare >= 0.08 && s.purpose >= 45) return 'owners';
    if (d && (use > 0.95 || (s.bills || 0) > 0.3 || (s.health && s.health.fumes > 0.5))) return 'strain';
    if (!d && s.dev.walks > 0 && mix.ownShare < 0.04 && share < 0.2) return 'decline';
    if (s.purpose < 40) return 'checks';
    // a real stake: dividends already a visible part of income, or the town owns a fifth of the engine and they're on the way
    if (mix.ownShare >= 0.04 || share >= 0.2) return 'building';
    if (d) return 'enclosure';
    return 'early';
  };
  P.pathLine = function(withNumbers) {
    var s = this.s, p = PATHS[s.path || 'early'], mix = this.incomeMix();
    return this.townLabel() + ' is on the ' + p.name.toLowerCase() + ' path: ' + p.desc.charAt(0).toLowerCase() + p.desc.slice(1) +
      (withNumbers ? ' Unemployment ' + Math.round(s.unemployment * 100) + '%, ownership ' + Math.round(mix.ownShare * 100) +
                     '% of household income (' + usd(mix.own) + ' a resident a year), Purpose ' + Math.round(s.purpose) + '.' : '');
  };
  P.townLabel = function() { return this.festus() ? 'Festus' : (this.townName || 'The town'); };
  // monthly: the path holds for three months before it counts, and a change is news
  P._pathMonthly = function() {
    var s = this.s, m = s.mayor, now = this.pathNow();
    if (!s.path) s.path = now;
    if (now === s.path) { m.pathNext = null; m.pathHeld = 0; return; }
    if (m.pathNext !== now) { m.pathNext = now; m.pathHeld = 0; }
    if (++m.pathHeld < 3) return;
    var was = s.path;
    s.path = now; m.pathNext = null; m.pathHeld = 0;
    if (now === 'early' || (m.pathNews !== undefined && s.months - m.pathNews < 6)) return;
    m.pathNews = s.months;
    var p = PATHS[now];
    this.news(p.tone, 'Path: ' + this.townLabel() + ' has moved from ' + PATHS[was].name.toLowerCase() + ' to ' + p.name.toLowerCase() + '. ' + p.desc, {alert: 'path'});
  };
  // ---- Research Labs ----
  P.labsOn = function() { return this.s.labsOn || 0; };
  P.labCompute = function() { return this.labsOn() * LAB_COMPUTE; };
  // compute left for breakthrough work once the labs have taken theirs
  P.researchCompute = function() { return Math.max(0, this.townCompute() - this.labCompute()); };
  // lab-months gained per calendar month: 1 for a lab, +0.5 for each extra (two at most), up to +1 for town compute
  P.labSpeed = function() {
    var n = this.labsOn();
    return n ? 1 + 0.5 * Math.min(2, n - 1) + Math.min(1, this.townCompute() / LAB_FAST) : 0;
  };
  P.nextBreakthroughIn = function() {
    var R = this.s.research, v = this.labSpeed();
    return v ? Math.max(0, Math.ceil(((R.next || 0) - (R.clock || 0)) / v)) : null;
  };

  P._factionTargets = function(simData) {
    var s = this.s, m = s.mayor, c = simData.census, budget = this._sim.budget, deal = s.deal;
    var tax = budget.cityTax;
    var taxPain = clamp((tax - 7) * 2.5, -5, 25);
    var pm = this._sim._powerManager;
    var shortage = pm && pm.lastShort ? 1 : 0;
    var online = this.hallsOnline();
    var utilBill = {town: 0.14, split: 0.08, developer: 0};
    // facility design: grid power strains Ameren and the bills; gas turbines foul the air; clean power is light on both
    var power = deal && this.festus() ? deal.power || 'grid' : null, cooling = deal && this.festus() ? deal.cooling || 'evap' : null;
    var load = Math.min(1, online / 2);
    var gridStrain = power === 'grid' ? GRID_STRAIN * Math.min(4, online) : power === 'clean' ? -0.02 * load : 0;
    var fumes = power === 'gas' ? load * (1 + Math.min(1, Math.max(0, online - 2) / 4)) : 0;
    var cleanAir = power === 'clean' ? load : 0;
    s.health = {fumes: fumes};
    // people watch the river: towers that drink from it worry farmers before any shortage; closed loops reassure them
    var riverWorry = cooling ? load * {evap: 0.5, hybrid: 0.2, closed: -0.6}[cooling] : 0;
    var bills = (deal ? utilBill[deal.utilities] * Math.min(2, online / 2) : 0) + shortage * 0.5 + gridStrain +
                (s.dependence || 0) * 0.04 + (s.passedBills || 0) - (c.alFusionPop > 0 ? 0.15 : 0);
    var pop = this._sim.evaluation.cityPop || 0;
    s.water.use = pop / 150 + online * HALL_WATER * coolWater(cooling) * (m.waterGuarantee ? 0.8 : 1);
    var stress = Math.max(0, s.water.use / Math.max(1, s.water.cap) - 0.85) * 4;
    var noise = this.noise();
    var secrecy = deal && deal.nda ? 1 : 0;
    var abateBite = deal && s.months - deal.month < deal.abateYears * 12 ? deal.abatePct / 100 * Math.min(1, deal.abateYears / 20) : 0;
    var schoolScore = (deal ? deal.school / 250 : 0) - abateBite * 1.2 + (deal ? (deal.kids || 0) * 0.15 : 0) + Math.min(2, m.levy || 0) * 0.5;
    schoolScore = Math.min(2.5, schoolScore);   // a well-funded school can only get so much happier
    // Festus: what ownership adds to household income (the Fund's dividend as a share of income); elsewhere the old fund
    var mix = this.festus() ? this.incomeMix() : null;
    var div = mix ? clamp(mix.ownShare / 0.15, 0, 1.2) : clamp((s.fundDividend || 0) / 25, 0, 1.5);
    var equity = this.townShare();
    var building = s.construction ? 1 : 0;
    var jobs = deal && online ? clamp(deal.jobs / 50, 0, 1.5) * (m.localHire ? 1.3 : 1) : 0;
    var lost = this._farmLostCache === undefined || s.months % 6 === 0 ? (this._farmLostCache = this.farmLost()) : this._farmLostCache;
    var clinics = c.alClinicOn || 0;
    // how good the deal is keeps mattering: people talk about what the town got for the land
    // voters feel the jobless rate over a year or so, not the month-to-month swing of the census
    m.jobless = m.jobless === undefined ? s.unemployment : m.jobless * 0.88 + s.unemployment * 0.12;
    // a dividend that replaces lost wages takes some of the sting out of a lost job (not all of it: see Purpose)
    var jobless = m.jobless * (mix ? 1 - 0.5 * mix.cover : 1);
    var fair = deal ? this._dealTier() - 1 : 0;
    // said no: people credit you for it at first, less as the months go by; and the town that grew its own way
    var free = !deal && s.dev.walks > 0 ? clamp(1 - (s.months - (s.dev.lastWalk || 0)) / FREE_FADE, 0, 1) : 0, home = Math.min(2, m.homegrown || 0);
    var growth = clamp((this._sim._valves ? this._sim._valves.comValve : 0) / 150, -8, 8);
    // purpose feeds approval (it already lags), and the fund's dividends add up to real household wealth
    var purp = this.festus() ? clamp((s.purpose - 60) / 10, -4, 3) : 0;
    var worth = this.festus() ? clamp((s.netWorth || 0) / 2500, 0, 4) : 0;
    s.bills = bills; s.waterStress = stress;
    return {
      res: 51 + fair * 5 + free * 6 - bills * 40 - stress * 12 - noise * 5 - secrecy * 10 - taxPain - jobless * 40 + div * 8 + equity * 12 + clinics * 2 -
           fumes * FUMES_RES + cleanAir * 2 - riverWorry * 2 + purp * 2.5 + worth,
      farm: 53 + fair * 2 + free * 4 - stress * 20 - lost * 80 - bills * 25 - taxPain * 1.2 + div * 4 + equity * 6 - fumes * 2 + cleanAir - riverWorry * 4,
      work: 47 + fair * 2 - jobless * 90 + building * 12 + jobs * 11 + home * 2 + div * 10 + equity * 8 - s.automation * 15 * (1 - s.cover) + purp * 2.5,
      biz: 49 + growth - taxPain * 1.5 - bills * 30 + (online ? 7 : 0) + jobs * 4 + home * 2 - (s.dependence || 0) * 2,
      school: 50 + fair * 4 + free * 5 + schoolScore * 10 - secrecy * 8 - taxPain * 0.6 + clinics * 2 + div * 4 - fumes * FUMES_SCHOOL + cleanAir + purp * 1.5
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
    this._fundMonthly();
    this._projectsMonthly();
    this._construction(simData);
    var t = this._factionTargets(simData);
    FACTIONS.forEach(function(f) {
      var fx = m.factions[f.id];
      fx.mem *= 0.9;
      fx.v = clamp(fx.v + (t[f.id] + fx.mem - fx.v) * 0.25, 0, 100);
    });
    this._approval();
    this._researchMonthly(simData);
    this._cityMilestone();
    if (this.festus()) this._pathMonthly();
    if (m.gameOver && !m.sandbox) return;
    this._scripted(mi);
    this._elections(mi);
    this._developer(mi);
    this._director(mi);
    if (this.festus()) this._quickAskLane();
    this._alerts();   // last, so it can see whether a card went up this month
  };

  // ---- town to city: once, after the town has held its growth, and never announced the other way ----
  P._cityMilestone = function() {
    var s = this.s, m = s.mayor, pop = this._sim.evaluation.cityPop || 0;
    if (s.cityStatus === 'city') return;
    m.cityMonths = pop >= CITY_POP ? (m.cityMonths || 0) + 1 : 0;
    if (m.cityMonths < CITY_MONTHS || s.card) return;
    s.cityStatus = 'city';
    var name = this.festus() ? 'Festus' : (this.townName || 'The town');
    this.news('good', name + ' is now a city: ' + Math.round(pop).toLocaleString() + ' people, and it has held there for half a year.',
              {paper: true, tone: 'good', headline: name.toUpperCase() + ' IS NOW A CITY',
               body: 'The census has had the town above ' + CITY_POP.toLocaleString() + ' people for ' + m.cityMonths + ' months running. The state reclassifies it, and the welcome signs get repainted.',
               helps: 'More pull in the state capital, and businesses take the place seriously.',
               strains: 'City problems come with it: traffic, water, and higher expectations of City Hall.'});
  };

  // ---- status alerts: short ticker notes when something real moves, at most one per topic a year ----
  // Never while a decision card is open or was just shown, and never more than one a month or two in a row.
  var ALERT_GAP = 12, ALERT_SPACING = 4;
  var MOOD_NAMES = {res: 'Residents', farm: 'Farmers', work: 'Workers', biz: 'Business owners', school: 'Parents and teachers'};
  P._alerts = function() {
    var s = this.s, m = s.mayor, c = this._sim._census;
    m.trend = m.trend || [];
    var snap = {jobless: m.jobless || 0, bills: s.bills || 0, stress: s.waterStress || 0, use: s.water.use / Math.max(1, s.water.cap),
                div: s.fundDividend || 0, perRes: s.dividendPerRes || 0, auto: s.automation || 0, cover: s.cover || 0, f: {}};
    FACTIONS.forEach(function(f) { snap.f[f.id] = m.factions[f.id].v; });
    m.trend.push(snap);
    if (m.trend.length > 7) m.trend.shift();
    if (m.trend.length < 7 || s.card || m.lastCard === s.months || (m.gameOver && !m.sandbox)) return;
    m.alertLog = m.alertLog || [];
    m.alertLast = m.alertLast || {};
    var last = m.alertLog.length ? m.alertLog[m.alertLog.length - 1].month : -99;
    if (s.months - last < ALERT_SPACING) return;
    var then = m.trend[0], now = snap, self = this, pct = function(v) { return Math.round(v * 100) + '%'; };
    var clinics = c.alClinicOn || 0, cure = !!(s.research.done.the_cure || this.has('the_cure'));
    var cands = [];
    // health
    var dl = s.deal, online = this.hallsOnline(), hs = s.health || {};
    if (hs.fumes > 0.4) cands.push(['health', 'bad', 'Health: asthma visits at the clinic are up since ' + this.dev().short + '\'s gas turbines started. Parents near the campus want them shut off.']);
    else if (cure && !clinics) cands.push(['health', 'bad', 'Health: the new therapies are licensed, but no clinic in town offers them. Residents drive an hour and pay out of pocket.']);
    else if (clinics && !m.alertLast.health) cands.push(['health', 'good', 'Health: the healing clinic has a waiting list. Sick days at the plant are down.']);
    else if (now.jobless > 0.15) cands.push(['health', 'bad', 'Health: the free clinic is turning people away. Many of the ' + pct(now.jobless) + ' out of work lost their insurance with their jobs.']);
    // jobs
    var dj = now.jobless - then.jobless;
    if (dj > 0.04) cands.push(['jobs', 'bad', 'Jobs: unemployment is up to ' + pct(now.jobless) + ', from ' + pct(then.jobless) + ' six months ago.']);
    else if (dj < -0.04) cands.push(['jobs', now.jobless < 0.15 ? 'good' : 'neutral', 'Jobs: unemployment is down to ' + pct(now.jobless) + ', from ' + pct(then.jobless) + ' six months ago.']);
    // household wealth
    if (this.festus() && now.perRes >= 100 && now.perRes > then.perRes * 1.3)
      cands.push(['wealth', 'good', 'Household wealth: the Festus Fund\'s dividend is up to ' + usd(now.perRes) + ' a resident a year, ' +
                  pct(this.incomeMix().ownShare) + ' of household income.']);
    else if (!this.festus() && now.div > 1 && now.div > then.div * 1.3)
      cands.push(['wealth', 'good', 'Household wealth: the wealth fund\'s dividend to residents is up to about ' + money(now.div * 12) + ' a year.']);
    else if (now.auto > 0.25 && now.cover < 0.3)
      cands.push(['wealth', 'bad', 'Household wealth: machines do ' + pct(now.auto) + ' of the work across the region, and ' +
                  (now.cover > 0.02 ? 'dividends replace only ' + pct(now.cover) + ' of the lost wages.' : 'nothing the town owns replaces the lost wages.') + ' Savings are draining.']);
    // water
    var towers = dl && online && (dl.cooling || 'evap') === 'evap' && this.festus();
    if (now.use > 0.85) cands.push(['water', 'bad', 'Water: the town is drawing ' + pct(now.use) + ' of what the water authority\'s river wells can supply.' + (now.stress > 0.3 ? ' Lawn watering is banned.' : '') +
                                    (towers ? ' The campus cooling towers are the biggest user.' : '')]);
    else if (dl && online && dl.cooling === 'closed' && !m.alertLast.water) cands.push(['water', 'good', 'Water: the campus runs closed-loop cooling and barely touches the county\'s river wells. Use is at ' + pct(now.use) + ' of supply.']);
    else if (now.use > 0.75 && now.use - then.use > 0.08) cands.push(['water', 'neutral', 'Water: use is up to ' + pct(now.use) + ' of supply, from ' + pct(then.use) + ' in the spring.']);
    // power bills
    var onGrid = dl && online && (dl.power || 'grid') === 'grid' && this.festus();
    if (now.bills - then.bills > 0.06 || now.bills > 0.25) cands.push(['bills', 'bad', 'Power bills: households are paying noticeably more than last year' + (this._sim._powerManager && this._sim._powerManager.lastShort ? ', and the grid is short at peak.' : '.') +
                                    (onGrid ? ' Ameren is asking the state for a rate increase to cover the campus\'s grid upgrades.' : '')]);
    else if (then.bills - now.bills > 0.06) cands.push(['bills', 'good', 'Power bills: they\'re coming down for the first time in a while.']);
    // faction mood shifts
    var shift = FACTIONS.map(function(f) { return {f: f, d: now.f[f.id] - then.f[f.id]}; }).sort(function(a, b) { return Math.abs(b.d) - Math.abs(a.d); })[0];
    if (Math.abs(shift.d) >= 12)
      cands.push(['mood', shift.d > 0 ? 'good' : 'bad', 'Mood: ' + MOOD_NAMES[shift.f.id] + (shift.d > 0 ? ' have warmed to City Hall' : ' have soured on City Hall') +
                  ', ' + Math.round(then.f[shift.f.id]) + ' to ' + Math.round(now.f[shift.f.id]) + ' in six months.']);
    cands = cands.filter(function(a) { return s.months - (m.alertLast[a[0]] === undefined ? -99 : m.alertLast[a[0]]) >= ALERT_GAP; });
    if (!cands.length) return;
    // the topic heard from least recently goes first
    cands.sort(function(a, b) { return (m.alertLast[a[0]] || -99) - (m.alertLast[b[0]] || -99); });
    var a = cands[0];
    m.alertLast[a[0]] = s.months;
    m.alertLog.push({type: a[0], month: s.months, text: a[2]});
    if (m.alertLog.length > 30) m.alertLog.shift();
    this.news(a[1], a[2], {alert: a[0]});
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
    if (!card) return this.s.quickAsk ? this.decideQuick(option) : false;
    var opt = card.options.filter(function(o) { return o.id === option; })[0];
    if (!opt || opt.disabled) return false;
    this.s.card = null;
    if (card.type === 'offer') this._decideOffer(card, option, asks || []);
    else if (card.type === 'research') this._decideResearch(card, option);
    else if (card.type === 'ask') this._decideAsk(card, option);
    else if (card.type === 'campaign') this._decideCampaign(card, option);
    else if (card.type === 'project') this._decideProject(card, option);
    else if (card.type === 'intro' && this.s.dev.offer) this._offerCard();
    return true;
  };

  // ---- developer offers ----
  P._reaction = function(t, choice, asks) {
    if (choice === 'accept') {
      var util = {town: -5, split: -2, developer: 2}[t.utilities];
      var cool = {evap: -1, hybrid: 0, closed: 3}[t.cooling || 'evap'];
      var pw = {grid: {res: 0, biz: 0, school: 0}, gas: {res: -3, biz: 2, school: -3}, clean: {res: 2, biz: 0, school: 1}}[t.power || 'grid'];
      if (!this.festus()) { cool = 0; pw = {res: 0, biz: 0, school: 0}; }
      return {
        res: -6 - (t.nda ? 4 : 0) + util + (t.fund ? 6 : 0) + (t.equity || 0) * 0.4 - t.abatePct / 100 * 3 + cool * 0.7 + pw.res,
        farm: -5 + util * 0.8 + t.pilot / 400 + cool,
        work: 8 + t.jobs / 15 + (t.fund ? 4 : 0),
        biz: 8 + t.pilot / 500 + pw.biz,
        school: -4 + t.school / 100 - t.abatePct / 100 * 6 + (t.kids || 0) * 1.2 - (t.nda ? 3 : 0) + pw.school
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
        if (a === 'cooling') { d.farm += 2; d.res += 1; }
        if (a === 'clean') { d.res += 1; d.school += 1; }
        if (a === 'gas') { d.biz += 1; d.res -= 1; }
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
    if (s.deal) {   // a design already won stays won: the campus is built around it
      if (COOLING[s.deal.cooling || 'evap'].rank > COOLING[terms.cooling].rank) terms.cooling = s.deal.cooling;
      if (terms.power !== 'clean') terms.power = s.deal.power || 'grid';
      if (!s.deal.nda) terms.nda = false;   // and an agreement once published stays public
    }
    var pl = s.deal ? (s.deal.plan || 0) : (s.dev.plan || 0);
    var halls = kind === 'expansion' ? 2 : sitePlan(pl).halls;
    s.dev.offer = {tier: tier, terms: terms, halls: halls, kind: kind || 'first', plan: pl};
    if (!s.deal) s.dev.farmed = null;   // the site is back on the map
    s.dev.status = 'offer';
    return s.dev.offer;
  };

  P.asksFor = function(terms) {
    var late = this.s.dev.offer && this.s.dev.offer.tier >= 2 || this.mi() >= 24;
    var festus = this.festus();
    return Object.keys(ASKS).filter(function(k) { return (!ASKS[k].late || late) && (!ASKS[k].design || festus) && !(festus && k === 'fund') && ASKS[k].ok(terms); });
  };

  // What a set of terms is worth to the town each year, in game dollars: into the Festus Fund, to the schools, to the city
  P.termMoney = function(t, halls) {
    var d = this.s.deal, n = halls ? (d ? d.halls + halls : halls) : (d ? d.halls : 2), hv = this.hallValue();
    var keystone = Math.max(0, n - (t.coop ? 1 : 0));
    var fund = t.pilot + keystone * hv * 12 * (t.equity || 0) / 100 + (t.coop ? hv * 12 : 0);
    var city = keystone * HALL_TAX * 12 * (1 - (t.abatePct || 0) / 100);
    return {fund: fund, school: t.school || 0, city: city, total: fund + (t.school || 0) + city, halls: n};
  };
  P.termRows = function(t, halls, o) {
    var self = this, pl = sitePlan(o && o.plan !== undefined ? o.plan : this.s.dev.plan), tm = this.termMoney(t, halls);
    var later = !this.has('frontier_model') ? ' (more once AI demand triples what a hall earns)' : '';
    var rows = [
      ['Money to the town', money(tm.total) + ' a year' + (function() {
          var parts = [];
          if (tm.fund) parts.push(money(tm.fund) + ' to the Festus Fund');
          if (tm.school) parts.push(money(tm.school) + ' to schools');
          if (tm.city) parts.push(money(tm.city) + ' in property tax');
          else if (t.abatePct >= 100) parts.push('no property tax for ' + t.abateYears + ' years');
          return parts.length ? ': ' + parts.join(', ') : '';
        })() + later,
       (t.equity || 0) >= 10 || t.coop ? 'good' : (t.equity || 0) ? 'neutral' : 'bad', true],
      ['Campus', !halls && this.s.deal ? 'The same ' + this.s.deal.halls + ' halls on ' + pl.acres + ' acres, new terms' :
                 halls + ' halls' + (this.s.deal ? ' more' : '') + ' on about ' + pl.acres + ' acres by I-55, earning their owners about ' + money(halls * this.hallValue()) + ' a month', 'neutral'],
      ['Tax abatement', t.abatePct ? t.abatePct + '% for ' + t.abateYears + ' years' : 'None', t.abatePct >= 75 ? 'bad' : t.abatePct <= 25 ? 'good' : 'neutral'],
      ['Payment in lieu of taxes', money(t.pilot) + ' a year' + (this.festus() ? ', into the Festus Fund' : t.fund ? ', into a town wealth fund' : ''), t.pilot >= 900 ? 'good' : t.pilot < 400 ? 'bad' : 'neutral'],
      ['School fund', t.school ? money(t.school) + ' a year' : 'None', t.school >= 300 ? 'good' : t.school ? 'neutral' : 'bad'],
      ['Jobs promised', t.jobs + ' permanent (plus construction crews)', t.jobs >= 55 ? 'good' : t.jobs < 35 ? 'bad' : 'neutral', true],
      ['Cooling', this.coolingText(t, halls), {evap: 'bad', hybrid: 'neutral', closed: 'good'}[t.cooling || 'evap'], true],
      ['Power', this.powerText(t, halls), {grid: 'bad', gas: 'bad', clean: 'good'}[t.power || 'grid'], true],
      ['Water and power upgrades', UTIL_TEXT[t.utilities] + (t.utilities !== 'developer' ? ' (' + money(self.utilityBill(t, halls)) + ' now, and higher bills)' : ''), t.utilities === 'developer' ? 'good' : t.utilities === 'town' ? 'bad' : 'neutral'],
      ['Secrecy', t.nda ? 'NDA: the tenant stays secret, sessions closed' : 'Open: terms and tenant public', t.nda ? 'bad' : 'good'],
      ['Town equity', (t.equity || 0) + '%' + ((t.equity || 0) ? ' of revenue and compute' + (this.festus() ? '; the revenue goes to the Festus Fund' : '') : ''), (t.equity || 0) >= 10 ? 'good' : (t.equity || 0) ? 'neutral' : 'bad', true]
    ];
    if (t.kids) rows.push(['Kids\' trust', t.kids + '% of revenue for every child, vesting at 21', 'good']);
    if (t.royalty) rows.push(['Compute royalty', t.royalty + ' compute a month for the town', 'good']);
    if (t.coop) rows.push(['Town AI co-op', 'One hall is owned by the town: all its revenue goes to the Festus Fund', 'good', true]);
    return rows;
  };
  // One line per design choice: what it is, what it costs the town, what it costs the developer
  P.coolingText = function(t, halls) {
    var c = t.cooling || 'evap', n = halls || (this.s.deal ? this.s.deal.halls : 2), w = this.campusWaterPct(n, c) + '% more water than the town uses now';
    return c === 'evap' ? 'Evaporative towers: cheapest to run, but ' + w + ', from the county\'s river wells' :
           c === 'hybrid' ? 'Hybrid: dry coolers, towers only on hot days. ' + w :
           'Closed-loop liquid: ' + w + '. Costs ' + this.dev().short + ' more to build';
  };
  P.powerText = function(t, halls) {
    var p = t.power || 'grid', mw = halls ? 'about ' + this.campusMW(halls) + ' MW (a coal plant makes 700)' : 'the whole campus';
    return p === 'grid' ? 'Ameren grid: ' + mw + '. Strains the grid; household bills go up' :
           p === 'gas' ? 'Its own gas turbines for ' + mw + ': off your grid, but exhaust near homes and schools' :
           'Solar, batteries and a clean power contract for ' + mw + ': pricier for ' + this.dev().short + ', light on the grid, clean air';
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
      'return': [dev.short + ' is back', 'A bigger campus this time: ' + o.halls + ' halls on ' + sitePlan(o.plan).acres + ' acres'],
      expansion: [dev.short + ' wants to expand', 'Two more halls, and new terms for the whole campus'],
      renegotiate: ['Court orders a new agreement', dev.short + ' wants to re-sign fast, in the open'],
      reopen: [dev.short + ' comes back to the table', 'New terms for the campus you already have']
    };
    var k = kinds[o.kind] || kinds.first;
    var asks = this.asksFor(o.terms);
    var self = this;
    var body = o.kind === 'first' ?
      dev.name + ', the data center arm of a St. Louis builder, wants about 370 acres between the west subdivisions and I-55. It won\'t name the tenant. Festus buys its water from the county water authority\'s collector wells on the Mississippi, one main well and an older backup, and its power from Ameren Missouri. At full build the campus wants 1 GW. ' +
      'The town packs the high school gym tonight to hear your answer.' :
      o.kind === 'expansion' ? 'The campus is full. ' + dev.short + ' wants two more halls on the site and offers to re-sign the whole agreement on these terms.' :
      o.kind === 'reopen' ? 'You asked, and ' + dev.short + ' would rather re-sign than fight. Same halls. Say no and the old agreement stands.' :
      o.kind === 'return' ? 'The deal across the river fell through. ' + dev.short + ' wants more this time: ' + o.halls + ' halls on about ' + sitePlan(o.plan).acres +
        ' acres' + (o.plan ? ', the old site plus the fields south of the state road along I-55' : '') + '. Better terms, a bigger footprint, more power and water. ' +
        'Leverage ' + Math.round(this.leverage() * 100) + '%.' :
      o.kind === 'renegotiate' ? 'The judge threw out the old agreement. ' + dev.short + ' has a new one, and this time the terms are public.' :
      (o.kind === 'better' && o.trades ? o.trades.join(' ') + ' ' : '') +
      'Leverage ' + Math.round(this.leverage() * 100) + '%: the longer you hold out and the more popular you are, the more they give.';
    this.showCard({
      type: 'offer', kicker: k[0], title: k[1], body: body, rows: this.termRows(o.terms, o.halls, o),
      options: [
        {id: 'accept', label: o.kind === 'expansion' ? 'Approve the expansion' : 'Accept', tone: 'good', preview: this.preview(this._reaction(o.terms, 'accept'))},
        {id: 'counter', label: 'Counter', tone: 'neutral', disabled: o.kind === 'firm' && s.dev.patience <= 0 || !asks.length,
         preview: this.preview(this._reaction(o.terms, 'counter', [])), note: 'Ask for 1 or 2 changes. ' + dev.short + ' answers in a couple of months.'},
        {id: 'reject', label: o.kind === 'expansion' ? 'Say no' : 'Reject', tone: 'bad', preview: this.preview(this._reaction(o.terms, 'reject'))}
      ],
      asks: asks.map(function(a) { return {id: a, label: askLabel(a), design: !!ASKS[a].design}; }), maxAsks: 2,
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
      if ((o.kind === 'reopen' || o.kind === 'renegotiate') && s.deal) {   // the same campus on new terms: people react to what changed
        var before = this._reaction(s.deal, 'accept');
        Object.keys(r).forEach(function(k) { r[k] = r[k] - before[k] + (k === 'res' ? 2 : k === 'school' ? 1 : 0); });
      }
      // terms the town fought for go down better than terms it was handed
      if (s.dev.counters > 0 && o.kind !== 'expansion') { r.res += 4; r.school += 3; r.farm += 2; r.work += 2; }
      this.bump(r, 'Accepted ' + dev.short + '\'s offer');
      this.signDeal(o);
    } else if (option === 'counter') {
      this.bump(this._reaction(o.terms, 'counter', asks), 'Countered ' + dev.short + ': ' + asks.map(function(a) { return askLabel(a).toLowerCase(); }).join('; '));
      s.dev.status = 'review';
      s.dev.asks = asks;
      s.dev.counters++;
      s.dev.due = mi + 2 + Random.getRandom(1);
      this.news('neutral', dev.short + '\'s lawyers are reviewing your counter: ' + asks.map(function(a) { return askLabel(a).toLowerCase(); }).join(' and ') + '.');
    } else {
      this.bump(o.kind === 'expansion' || o.kind === 'reopen' ? {res: 2, farm: 2, work: -3, biz: -3} : this._reaction(o.terms, 'reject'), 'Rejected ' + dev.short);
      if (o.kind === 'reopen') {
        s.dev.status = 'signed'; s.dev.offer = null;
        this.news('neutral', 'Talks end. The old agreement with ' + dev.short + ' stands.');
      } else if (o.kind === 'expansion') {
        s.dev.status = 'signed'; s.dev.offer = null; s.dev.nextExpansion = mi + 14;
        this.news('neutral', 'You turn down ' + dev.short + '\'s expansion. The halls already built keep running.');
      } else this.devWalks('rejected');
    }
  };

  P.devWalks = function(why) {
    var s = this.s, dev = this.dev(), mi = this.mi();
    if (s.deal) {         // talks on an expansion or new terms broke down; the campus that's built stays
      s.dev.status = 'signed'; s.dev.offer = null; s.dev.nextExpansion = mi + 14;
      this.news('neutral', 'Talks with ' + dev.short + ' break down. The agreement already signed stands.');
      return;
    }
    var left = this.sitePlan();
    s.dev.farmed = left.rects.map(function(r) { return {x: r.x, y: r.y, w: r.w, h: r.h}; });
    s.dev.plan = Math.min(PLANS.length - 1, (s.dev.plan || 0) + 1);   // next time it asks for more
    s.dev.walks++;
    s.dev.lastWalk = s.months;
    s.dev.status = 'away';
    s.dev.due = mi + 8 + Random.getRandom(4);
    s.dev.returnTier = Math.min(TIERS.length - 1, (s.dev.offer ? s.dev.offer.tier : 0) + 1);
    s.dev.offer = null;
    if (s.dev.walks >= 2 && (s.dependence || 0) < 2) s.dependence = (s.dependence || 0) + 1;   // walking away costs, but it doesn't compound forever
    this.bump({work: -5 / s.dev.walks, biz: -6 / s.dev.walks, res: 2, farm: 2}, dev.short + ' walked away');
    if (s.dev.walks >= GONE_AFTER) {   // the third time, it builds across the river for good
      s.dev.status = 'gone';
      this.news('bad', dev.short + ' breaks ground across the river. It won\'t be back: whatever Festus owns from now on, it builds itself.',
                {paper: true, tone: 'bad', headline: dev.short.toUpperCase() + ' BUILDS ACROSS THE RIVER, FOR GOOD',
                 body: 'After three rounds, ' + dev.short + ' signs with a neighboring town. Its campus will rise in sight of Festus, and the automation it powers will reach every job in the region either way.',
                 helps: 'Farmers keep their fields and neighbors keep their quiet. A co-op bond or a home-grown plan can still give the town a stake.',
                 strains: 'No developer money, no equity, and the jobs shock arrives anyway.'});
      this.drama();
      return;
    }
    this.news('bad', (why === 'rejected' ? 'You said no. ' : 'Talks collapse. ') + dev.short + ' takes its campus across the river to a neighboring town. The trades and the chamber are furious.',
              {paper: true, tone: 'bad', headline: dev.short.toUpperCase() + ' WALKS: CAMPUS HEADS ACROSS THE RIVER',
               body: 'Construction crews, and the money, go to a neighboring town. The survey stakes come out and the ' + left.acres + ' acres by I-55 go back to hay. ' +
                     dev.short + ' says it may be back, and that next time it will want more land: ' + sitePlan(s.dev.plan).acres + ' acres and ' + sitePlan(s.dev.plan).halls + ' halls.',
               helps: 'Neighbors and farmers are relieved. Your leverage grows: they know you\'ll say no.',
               strains: 'Workers and businesses lose the jobs they were counting on.'});
    this.drama();
  };

  P.signDeal = function(o) {
    var s = this.s, dev = this.dev(), budget = this._sim.budget;
    var prevHalls = s.deal ? s.deal.halls : 0;
    var pl = s.deal ? (s.deal.plan || 0) : (o.plan || 0);
    var halls = Math.min(sitePlan(pl).spots.length, prevHalls + o.halls);
    s.deal = copy(o.terms);
    s.deal.halls = halls;
    s.deal.plan = pl;
    s.dev.farmed = null;
    s.deal.month = s.months;
    s.dev.status = 'signed';
    s.dev.offer = null;
    s.dev.nextExpansion = this.mi() + 16;
    if (!o.halls) {
      s.dev.nextExpansion = this.mi() + 16;
      this.news('neutral', 'You re-sign with ' + dev.short + ' in public. Same halls, new terms.' + this._designNews(s.deal));
      return;
    }
    var bill = this.utilityBill(o.terms, o.halls);
    if (bill) budget.spend(Math.min(bill, budget.totalFunds));
    s.water.cap += HALL_WATER * WELL_UPGRADE * o.halls * (pl ? 0.85 : 1);   // the authority adds part of it; the bigger campus outruns it
    s.construction = {until: s.months + 4, from: prevHalls, to: halls};
    this.news('neutral', 'You sign with ' + dev.short + '. Graders roll onto the site; ' + (halls - prevHalls) + ' halls go up over the next four months.' + this._designNews(s.deal) +
              (bill ? ' The town pays ' + money(bill) + ' toward water and power upgrades.' : ''), {x: SITE.x + 5, y: SITE.y + 8, showable: true});
  };

  P._construction = function(simData) {
    var s = this.s, c = s.construction;
    if (!c || s.months < c.until) return;
    s.construction = null;
    var spots = this.sitePlan().spots;
    if (spots.slice(c.from, c.to).some(function(p) { return p.y >= 48; })) this._campusFeeder();
    for (var i = c.from; i < c.to; i++) {
      var spot = spots[i];
      var coop = s.deal.coop && i === 0 ? B.DC_COOP : B.DC_HELIX;
      this.placeBuilding(coop, spot.x, spot.y);
    }
    if (s.deal.coop && c.from > 0) this.placeBuilding(B.DC_COOP, spots[0].x, spots[0].y);
    s.hallsBuilt = c.to;
    this.news('good', 'The ' + this.dev().short + ' campus switches on: ' + c.to + ' halls humming by the interstate. Power demand jumps.',
              {x: SITE.x + 5, y: SITE.y + 8, showable: true});
    this.drama();
  };

  // A bigger campus spills south of the state road; a feeder line carries power down from the first halls
  // (x 48, from the hall row at y 36 across the road at y 47 to the south parcel at y 48)
  P._campusFeeder = function() {
    var map = this._map, flags = TF.BLBNCNBIT;
    for (var y = 37; y <= 46; y++) if (map.getTileValue(48, y) === TV.DIRT) map.setTile(48, y, TV.LVPOWER, flags);
    var r = map.getTileValue(48, 47);
    if (r >= TV.ROADBASE && r <= TV.LASTROAD) map.setTile(48, 47, TV.HROADPOWER, flags);
  };

  // Monthly money from the deal: abated property tax, PILOT (or the wealth fund), equity, kids' trust
  P._dealMoney = function(simData) {
    var s = this.s, d = s.deal, budget = this._sim.budget, festus = this.festus();
    if (!festus) s.fundDividend = 0;
    s.fundIn = 0;
    s.fundParts = {pilot: 0, equity: 0, coop: 0, bonded: 0};
    var hv = this.hallValue();
    if (festus) {   // co-op halls pay the Fund whether or not there is a deal: the deal's co-op hall in full, bonded ones after the bond
      var co = this.coopHalls();
      s.fundParts.coop = co.deal * hv;
      s.fundParts.bonded = co.bonded * hv * (1 - BOND_SHARE);
    }
    if (!d || !s.hallsBuilt) {
      s.dealIncome = 0;
      if (festus) { s.fundIn = s.fundParts.coop + s.fundParts.bonded; s.fund = (s.fund || 0) + s.fundIn; }
      return;
    }
    var online = this.devHalls().filter(function(h) { return h.powered; }).length;
    var abated = s.months - d.month < d.abateYears * 12 ? d.abatePct / 100 : 0;
    var tax = online * HALL_TAX * (1 - abated);
    var pilot = d.pilot / 12;
    var equity = online * hv * (d.equity || 0) / 100;
    if (festus) {   // Festus: Keystone's payments, the equity share and co-op revenue go to the Festus Fund; property tax still runs the city
      s.fundParts.pilot = pilot; s.fundParts.equity = equity;
      s.fundIn = pilot + equity + s.fundParts.coop + s.fundParts.bonded;
      s.fund = (s.fund || 0) + s.fundIn;
      if (d.kids) s.kidsTrust = (s.kidsTrust || 0) + online * hv * d.kids / 100;
      s.dealIncome = tax;
      if (Math.round(tax)) budget.spend(-Math.round(tax));
      return;
    }
    var income = tax + equity;
    if (d.fund) s.fund = (s.fund || 0) + pilot; else income += pilot;
    if (d.kids) s.kidsTrust = (s.kidsTrust || 0) + online * hv * d.kids / 100;
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
        var trades = [];
        asks.forEach(function(a) {
          var cost = ASKS[a].apply(o.terms);
          if (ASKS[a].design && cost) trades.push(dev.short + ' agrees to ' + DESIGN_DONE[a] + (a === 'gas' ? ' and adds ' : ', but to pay for it takes ') + cost + '.');
        });
        o.tier = Math.min(TIERS.length - 1, o.tier + (asks.length > 1 ? 1 : 0));
        o.kind = 'better';
        dv.status = 'offer';
        if (trades.length) { o.trades = trades; this.news('neutral', trades.join(' ')); } else o.trades = null;
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
      // a bigger campus comes with better terms: a tier up, and it carries more of the upgrade bill it causes
      var rt = dv.offer.terms;
      rt.utilities = UTIL_STEP[rt.utilities];
      rt.pilot += 200;
      this._offerCard();
      return;
    }
    if (dv.status === 'signed' && dv.nextExpansion >= 0 && mi >= dv.nextExpansion && s.deal.halls < this.maxHalls() && !s.construction && this.canCard()) {
      var tier = Math.min(TIERS.length - 1, this._dealTier() + 1);
      this.makeOffer(tier, 'expansion');
      this._offerCard();
    }
  };
  P._dealTier = function() {
    var d = this.s.deal;
    if (!d) return 0;
    // money traded for a cleaner design still counts toward how good the deal is; money taken for a dirtier one doesn't
    var pilot = d.pilot + (d.cooling === 'closed' ? CLOSED_COST : 0) + (d.power === 'clean' ? CLEAN_COST : 0) - (d.power === 'gas' ? GAS_SAVING : 0);
    for (var i = TIERS.length - 1; i >= 0; i--) if ((d.equity || 0) >= (TIERS[i].equity || 0) && pilot >= TIERS[i].pilot) return i;
    return 0;
  };

  // ---- the scripted opening (echoes Festus, spring 2026) and the court date ----
  P._scripted = function(mi) {
    var s = this.s, sc = s.mayor.scripted, dev = this.dev();
    if (!this.festus()) return;
    if (!sc.council && mi >= SPRING_POLL) {   // (the save key stays 'council' so old saves don't replay it)
      sc.council = true;
      if (s.deal) {
        this.bump({res: -5, school: -2}, 'The April poll turned against the deal');
        this.news('bad', 'APRIL POLL: THE TOWN TURNS ON THE DEAL. You signed in closed sessions; people want answers. Your own seat is on the ballot in April 2028.',
                  {paper: true, tone: 'bad', headline: 'TOWN TURNS ON THE DATA CENTER DEAL',
                   body: 'Weeks after you signed with ' + dev.short + ', the paper\'s spring poll has most voters against the deal and how it was made. Hundreds signed up to speak at the next town hall.',
                   helps: 'Nothing, for you. The message is clear.', strains: 'Residents and parents are angry. Your seat is up in April 2028; under 50% approval and you\'re out.'});
      } else {
        this.bump({res: 3, school: 2}, 'The April poll backed your hard line');
        this.news('good', 'The paper\'s April poll backs your hard line with ' + dev.short + '.',
                  {paper: true, tone: 'good', headline: 'TOWN BACKS MAYOR\'S HARD LINE ON DATA CENTER',
                   body: 'Most voters in the spring poll say the same thing: no deal without public terms.',
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
                     body: 'At the December 10 hearing, the residents\' lawsuit won: City Hall settled the deal in sessions the public couldn\'t attend.',
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
                       (s.deal ? ', and the ' + dev.short + ' deal hung over the race.' : '.') + (this.festus() ? ' ' + this.pathLine(true) : ''),
                 helps: 'You served ' + (m.electionsWon ? m.electionsWon + 1 : 1) + ' term' + (m.electionsWon ? 's' : '') + '.',
                 strains: 'Game over. Start again, or keep watching the town as a private citizen.'});
      return;
    }
    m.electionsWon++;
    var share = this.townShare();
    // the ownership win: the town owns a real share of its compute and pays a dividend people notice
    var paying = this.festus() ? (s.dividendPerRes || 0) >= MIN_DIVIDEND : (s.fundDividend > 0 || s.policies.dividend);
    var won = m.electionsWon >= WIN_TERMS || (share >= WIN_SHARE && paying);
    var pathLine = this.festus() ? ' ' + this.pathLine(true) : '';
    if (won) m.won = {year: year, vote: Math.round(vote), share: Math.round(share * 100)};
    var pct = Math.round(share * 100), owns = share >= WIN_SHARE;
    // the headline says which town the mayor won in, not only that they won
    var path = this.festus() ? s.path || 'early' : null;
    var THREE = {owners: 'THREE TERMS, AND A TOWN OF OWNERS', building: 'THREE TERMS AND A STAKE TO BUILD ON', enclosure: 'THREE TERMS, AND KEYSTONE OWNS THE REST',
                 checks: 'THREE TERMS, BUT THE DAYS FEEL EMPTY', strain: 'THREE TERMS IN A TOWN UNDER STRAIN', decline: 'THREE TERMS IN A SHRINKING TOWN'};
    var headline = !won ? 'MAYOR RE-ELECTED' : owns ? (path && path !== 'owners' ? 'THE TOWN TAKES A STAKE' : 'A TOWN THAT OWNS ITS FUTURE') :
                   (path && THREE[path]) || 'THREE TERMS AND DONE';
    this.news('good', 'MAYOR RE-ELECTED with ' + Math.round(vote) + '% of the vote.',
              {paper: true, tone: 'good', win: !!won, headline: headline,
               body: (!won ? 'The mayor won ' + Math.round(vote) + '% and a new term. Next election: April ' + (year + 2) + '.' :
                     owns ? 'Re-elected with ' + Math.round(vote) + '%. The town owns ' + pct + '% of the compute it hosts' +
                            (paying ? ' and its wealth fund pays every resident ' + usd(s.dividendPerRes || 0) + ' a year.' : '.') + ' You won.' :
                            'Re-elected with ' + Math.round(vote) + '% for a third term. You won the voters.') + pathLine,
               helps: won ? 'AfterSight complete. Keep playing as long as you like.' : 'Two more years to make the deals work.',
               strains: won ? (owns ? 'The deal still has to hold for the next mayor.' :
                               'The town owns ' + pct + '% of the compute it hosts. ' + dev.short + ' owns the rest, and the next mayor inherits that.') :
                        'Goal: ' + WIN_TERMS + ' wins, or a win with the town owning ' + Math.round(WIN_SHARE * 100) + '%+ of local compute and paying a dividend' +
                        (this.festus() ? ' of ' + usd(MIN_DIVIDEND) + '+ a resident' : '') + '. Wins so far: ' + m.electionsWon + '.'});
  };

  // ---- breakthroughs ----
  P.researchEstimate = function(id) {
    var r = RESEARCH[id], per = r.compute / r.months, own = this.researchCompute();
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
        ['Your compute', e.own + ' a month from the town\'s data center share' + (this.labCompute() ? ', after the lab\'s ' + this.labCompute() : ''), e.own >= e.per ? 'good' : e.own ? 'neutral' : 'bad'],
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
      R.next = (R.clock || 0) + 7;
    }
  };
  P._researchMonthly = function(simData) {
    var s = this.s, R = s.research, budget = this._sim.budget;
    // the labs: count the ones running, pay their upkeep and any compute the town can't cover, advance the clock
    var labs = simData.census.alLabOn || 0;
    if (labs) {
      var labBill = labs * LAB_UPKEEP + Math.round(Math.max(0, labs * LAB_COMPUTE - this.townCompute()) * this.computePrice());
      if (labBill > budget.totalFunds) {
        if (!R.labBroke) this.news('bad', 'The Research Lab goes dark: the town can\'t cover its ' + money(labBill) + ' monthly bill for upkeep and compute.', {alert: 'research'});
        R.labBroke = true; labs = 0;
      } else { budget.spend(labBill); R.labBroke = false; }
    }
    s.labsOn = labs;
    s.labsBuilt = simData.census.alLabCount || 0;
    s.labBill = labs ? labBill : 0;
    R.clock = (R.clock || 0) + this.labSpeed();
    if (!labs && !R.hinted && s.months >= 4 && this.nextResearch()) {
      R.hinted = true;
      this.news('neutral', 'Researchers at the state university say a town Research Lab would bring breakthroughs here first: cheap solar, AI services, new therapies. Build one from the Compute menu.', {alert: 'research'});
    }
    var a = R.active;
    if (a && !labs) {
      if (!a.paused) this.news('bad', 'Research on ' + RESEARCH[a.id].name.toLowerCase() + ' pauses: no Research Lab is running.', {alert: 'research'});
      a.paused = true;
      return;
    }
    if (a) {
      a.paused = false;
      var own = this.researchCompute(), short = Math.max(0, a.per - own), cost = Math.round(short * this.computePrice());
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
        R.next = (R.clock || 0) + 5;
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
  var optLabel = function(L, o) { return typeof o.label === 'function' ? o.label(L) : o.label; };
  var optCost = function(L, o) { return typeof o.cost === 'function' ? o.cost(L) : (o.cost || 0); };
  P._decideAsk = function(card, option) {
    var a = ASK_CARDS[card.id], pick = option === 'yes' ? a.yes : a.no, m = this.s.mayor;
    var log = m.askLog[card.id] = m.askLog[card.id] || {times: 0, declined: 0};
    log.times++;
    if (option === 'yes') log.declined = 0; else log.declined++;
    log.ignored = 0;
    log.last = this.s.months;
    var cost = optCost(this, pick);
    if (cost) this._sim.budget.spend(cost);
    if (pick.effect) pick.effect(this);
    this.bump(scale(pick.d, card.mult || 1), a.title + ': ' + optLabel(this, pick).toLowerCase());
  };
  // An ask can come back: a declined one returns louder after ASK_RETURN months (twice at most), an ignored one
  // returns as it was, and the yearly ones (surplus, tax rate, levy, bond, wells) come round again on their own schedule.
  var ASK_RETURN = 15, QUICK_GAP = 5, QUICK_EXPIRE = 3, QUICK_SCALE = 0.5, FURIOUS = 30;
  P._askReady = function(k) {
    var m = this.s.mayor, a = ASK_CARDS[k], log = m.askLog[k];
    if (this.s.quickAsk && this.s.quickAsk.id === k) return false;
    if (!a.when(this)) return false;
    if (!log) return true;
    var since = this.s.months - log.last;
    if (log.declined) return log.declined <= 2 && since >= ASK_RETURN;
    if (log.ignored) return log.ignored <= 2 && since >= ASK_RETURN;
    return !!a.repeat && since >= a.repeat;
  };
  // the ask that's due, unhappiest faction first (furious: only factions under FURIOUS)
  // kind: 'card' for the asks big enough to always get the floor (reopening the deal), 'quick' for the rest
  P._pickAsk = function(furiousOnly, kind) {
    var m = this.s.mayor, self = this;
    m.askLog = m.askLog || {};
    var ids = Object.keys(ASK_CARDS).filter(function(k) {
      var a = ASK_CARDS[k];
      return self._askReady(k) && (!furiousOnly || m.factions[a.faction].v < FURIOUS) &&
             (!kind || (kind === 'card' ? !!a.card : !a.card));
    });
    if (!ids.length) return null;
    ids.sort(function(a, b) { return m.factions[ASK_CARDS[a].faction].v - m.factions[ASK_CARDS[b].faction].v; });
    return ids[0];
  };
  P._askCardData = function(id, quick) {
    var m = this.s.mayor, a = ASK_CARDS[id], log = m.askLog[id];
    // a ticker ask is a smaller matter than one that gets the floor: its stakes are scaled down
    var again = log && log.declined ? log.declined : 0, mult = (1 + 0.5 * again) * (quick ? QUICK_SCALE : 1);
    var fname = FACTIONS.filter(function(f) { return f.id === a.faction; })[0].name;
    var funds = this._sim.budget.totalFunds;
    return {type: 'ask', id: id, mult: mult, kicker: 'Town hall · ' + fname + (again ? ' · back again' : ''),
      title: (again === 1 ? 'Again: ' : again > 1 ? 'Third time: ' : '') + a.title,
      body: a.body + (again ? ' You turned them down before. This time they packed the gym, and saying no will cost more.' : ''), rows: [],
      options: [{id: 'yes', label: optLabel(this, a.yes), tone: 'good', disabled: optCost(this, a.yes) > funds, preview: this.preview(scale(a.yes.d, mult))},
                {id: 'no', label: optLabel(this, a.no), tone: 'bad', preview: this.preview(scale(a.no.d, mult))}]};
  };
  P._askCard = function(furiousOnly, kind) {
    var id = this._pickAsk(furiousOnly, kind);
    if (!id) return false;
    this.s.mayor.asked[id] = this.s.months;
    this.showCard(this._askCardData(id));
    return true;
  };
  // Town hall asks that aren't urgent arrive in the ticker instead of as a card: the game keeps running, the mayor
  // decides when they like (tap the ticker or the Town hall line in City pulse), and an ask left alone for
  // QUICK_EXPIRE months lapses without effect and comes back later. They don't use up a card slot.
  P._quickAskLane = function() {
    var s = this.s, m = s.mayor;
    if (s.quickAsk) {
      if (s.months - s.quickAsk.month < QUICK_EXPIRE) return;
      var log = m.askLog[s.quickAsk.id] = m.askLog[s.quickAsk.id] || {times: 0, declined: 0};
      log.ignored = (log.ignored || 0) + 1; log.last = s.months;
      this.news('neutral', 'Town hall: ' + s.quickAsk.card.title.replace(/[.?!]$/, '') + ' goes unanswered. They\'ll be back.');
      s.quickAsk = null;
      return;
    }
    if (s.card || m.lastCard === s.months || s.months - (m.lastQuick === undefined ? -99 : m.lastQuick) < QUICK_GAP) return;
    var id = this._pickAsk(false, 'quick');
    if (!id) return;
    var card = this._askCardData(id, true);
    card.quick = true;
    card.date = this.dateString();
    s.quickAsk = {id: id, month: s.months, card: card};
    m.lastQuick = s.months;
    m.asked[id] = s.months;
    this.news('neutral', 'Town hall: ' + card.title + (/[.?!]$/.test(card.title) ? '' : '.') + ' Tap to decide.', {quickAsk: id});
    if (this.autoDecide) this.autoDecide(card);
  };
  P.decideQuick = function(option) {
    var q = this.s.quickAsk;
    if (!q) return false;
    var opt = q.card.options.filter(function(o) { return o.id === option; })[0];
    if (!opt) return false;
    if (option === 'yes' && optCost(this, ASK_CARDS[q.id].yes) > this._sim.budget.totalFunds) return false;
    this.s.quickAsk = null;
    this._decideAsk(q.card, option);
    return true;
  };
  // ---- context for a news line: what caused it, who it moved, and the numbers behind it ----
  // What the mayor can do about each kind of news: every alert ends with a lever
  var LEVERS = {
    water: 'Ask for closed-loop cooling in a deal, take the farmers\' water guarantee, or pay for a new river well when the farmers ask.',
    bills: 'Clean power or on-site generation in the deal keeps the campus off Ameren\'s grid, and making the developer pay for the upgrades keeps them off household bills.',
    health: 'Avoid gas turbines near homes. Research the Cure and build a Healing Clinic. The Fund\'s dividend replaces some of the income people lose with their jobs.',
    jobs: 'New shops and factories add jobs (zone commercial and industrial land with roads and power). A local-hiring ordinance and the apprenticeship guild help the people the machines replace; equity and co-op halls fill the Fund that replaces lost wages.',
    wealth: 'Equity, a co-op hall, a compute royalty and a bonded town hall all fill the Festus Fund. The payout slider in City pulse sets how much goes out each January.',
    fund: 'Equity, a co-op hall, a compute royalty and a bonded town hall all fill the Festus Fund. The payout slider in City pulse sets how much goes out each January.',
    mood: 'The angriest faction comes to City Hall first. Its ask, and the campaign card before each vote, move it most.',
    project: 'Neighbors + robots makes more Purpose than robots alone. When a project fades, give it another season.',
    purpose: 'Town projects built with neighbors, the apprenticeship guild, and owning part of the engine all raise Purpose.',
    path: 'More ownership (equity, co-op halls, the royalty) moves the town toward thriving owners; projects and the guild keep Purpose up; cleaner designs ease the strain.',
    election: 'The campaign card before each vote and the angriest factions\' asks move approval most.',
    deal: 'Counter with one or two asks. Leverage grows with time, with your approval, and each time you walk away.',
    research: 'Keep a Research Lab powered and paid. Town-owned compute makes breakthroughs cheaper and brings them sooner.'
  };
  var TOPIC_WORDS = [['water', /water|well|drought|cooling/i], ['bills', /bill|ameren|rate increase|grid/i], ['health', /health|asthma|clinic|therap/i],
                     ['jobs', /unemploy|jobs|layoff|hiring/i], ['fund', /festus fund|dividend/i], ['project', /garden|mural|riverfront|project/i],
                     ['election', /elect|vote|poll|campaign/i], ['purpose', /purpose|long afternoon|guild/i], ['path', /^path:/i],
                     ['deal', /keystone|campus|halls|offer|agreement|counter|bond/i], ['research', /research|breakthrough/i]];
  P.newsContext = function(tone, text, extra) {
    var s = this.s, m = s.mayor, now = this.dateString(), pct = function(v) { return Math.round(v * 100) + '%'; };
    var topic = extra.alert || null;
    if (!topic) for (var i = 0; i < TOPIC_WORDS.length; i++) if (TOPIC_WORDS[i][1].test(text)) { topic = TOPIC_WORDS[i][0]; break; }
    var h = m.history && m.history[0] && m.history[0].date === now ? m.history[0] : null;
    var d = s.deal, festus = this.festus(), dev = this.dev().short;
    var use = s.water ? s.water.use / Math.max(1, s.water.cap) : 0;
    var why = '';
    if (topic === 'water') why = 'Water use is ' + pct(use) + ' of what the town can supply' + (festus ? ' from the county water authority\'s river wells' : '') + '. ' +
      (d && festus ? dev + '\'s halls use ' + COOLING[d.cooling || 'evap'].name.toLowerCase() + (d.cooling === 'closed' ? ', which needs very little water.' : (d.cooling || 'evap') === 'evap' ? ', the thirstiest design.' : '.') : 'Most of it is homes and businesses.') +
      (use > 0.85 ? ' Above 85% of supply, farmers and residents start to lose patience.' : '');
    else if (topic === 'bills') why = 'Household power bills move with the campus\'s power source' + (d && festus ? ' (' + POWER[d.power || 'grid'].said + ')' : '') +
      (d ? ' and on who pays for the grid and water upgrades (' + UTIL_TEXT[d.utilities].toLowerCase() + ')' : '') +
      (this._sim._powerManager && this._sim._powerManager.lastShort ? ', and the grid running short at peak' : '') + '. Bills weigh most on residents, farmers and business.';
    else if (topic === 'health') why = (s.health && s.health.fumes ? dev + '\'s gas turbines are running near homes and schools. ' : '') +
      'Unemployment is ' + pct(s.unemployment) + '; people who lose jobs often lose insurance. Clinics in town: ' + (this._sim._census.alClinicOn || 0) + '.';
    else if (topic === 'jobs') why = 'Unemployment is ' + pct(s.unemployment) + ' and machines now do ' + pct(s.automation || 0) + ' of the work' +
      (festus ? ' across the region, campus or no campus. ' : '. ') + (d ? dev + ' promised ' + d.jobs + ' permanent jobs.' : 'No campus jobs.');
    else if (topic === 'wealth' || topic === 'fund') why = (festus ? 'The Festus Fund holds ' + money(s.fund || 0) + ' and pays out ' + Math.round(this.fundShare() * 100) +
      '% each January (the Reinvest / Pay out slider in City pulse). ' + this.fundSources() + ' Dividends replace ' + pct(s.cover || 0) + ' of the wages lost to automation.' :
      'Dividends replace ' + pct(s.cover || 0) + ' of lost wages.');
    else if (topic === 'mood') why = 'Each faction drifts toward how the town treats it: bills, water, noise, jobs, schools, secrecy, purpose and dividends. Big drifts show up here.';
    else if (topic === 'project') why = 'Town projects earn nothing; they raise Purpose (now ' + Math.round(s.purpose) + '), which feeds approval. Neighbors building alongside robots make more of it.';
    else if (topic === 'election') why = 'Elections come every two years. Under 50% approval and you\'re out. Your approval is ' + Math.round(m.approval) + '%.';
    else if (topic === 'purpose') why = 'Purpose is whether people feel needed. It falls as machines take the work and rises with projects people build together, the guild, and owning part of the engine. Now ' + Math.round(s.purpose) + '.';
    else if (topic === 'path' && festus) why = this.pathLine(true);
    if (h) why = (why ? why + ' ' : '') + 'It follows your decision: ' + h.why.charAt(0).toLowerCase() + h.why.slice(1) + '.';
    var ne = this.nextElection();
    var stats = [['Approval', Math.round(m.approval) + '%', m.approval >= 50 ? 'good' : 'bad'],
                 ['Purpose', Math.round(s.purpose), s.purpose >= 60 ? 'good' : s.purpose >= 45 ? 'neutral' : 'bad'],
                 ['Unemployment', pct(s.unemployment), s.unemployment > 0.12 ? 'bad' : 'neutral'],
                 ['Water use', pct(use) + ' of supply', use > 0.85 ? 'bad' : 'neutral'],
                 ['Bills pressure', (s.bills || 0) > 0.25 ? 'High' : (s.bills || 0) > 0.1 ? 'Rising' : 'Low', (s.bills || 0) > 0.25 ? 'bad' : 'neutral'],
                 ['City funds', money(this._sim.budget.totalFunds), 'neutral']];
    if (festus) {
      var mix = this.incomeMix();
      stats.push(['Festus Fund', money(s.fund || 0) + (s.dividendPerRes ? ' · last dividend ' + usd(s.dividendPerRes) + ' a resident' : ''), 'neutral']);
      stats.push(['Household income', usd(mix.wages) + ' wages, ' + usd(mix.own) + ' ownership, ' + usd(mix.transfers) + ' transfers a resident a year', mix.ownShare >= 0.12 ? 'good' : 'neutral']);
      stats.push(['Path', PATHS[s.path || 'early'].name, PATHS[s.path || 'early'].tone]);
    }
    if (ne >= 0) stats.push(['Next election', this.monthName(ne) + ' (' + (ne - this.mi()) + ' months)', 'neutral']);
    var factions = FACTIONS.map(function(f) { return {name: f.short, v: Math.round(m.factions[f.id].v), d: h && h.d[f.id] ? Math.round(h.d[f.id]) : 0}; });
    return {date: now, topic: topic, why: why, lever: festus ? LEVERS[topic] || null : null, decision: h ? h.why : null, stats: stats, factions: factions,
            quick: !!extra.quickAsk, quickId: extra.quickAsk || null};
  };

  // ---- the Festus Fund ----
  // Keystone's payments and the town's equity dividends flow in every month and the fund earns about 5% a year.
  // Each January it pays every resident a dividend: the payout slider sets how much of the fund goes out
  // (FUND_FLOOR at full reinvest, FUND_FLOOR + FUND_RANGE at full payout); the rest stays in and compounds.
  P.fundShare = function() { var p = this.s.fundPayout; return FUND_FLOOR + FUND_RANGE * (p === undefined ? 0.5 : p); };
  // where this year's money into the Fund comes from, in one sentence
  P.fundSources = function() {
    var f = this.s.fundParts || {}, parts = [], dev = this.dev().short;
    if (f.pilot) parts.push(money(f.pilot * 12) + ' from ' + dev + '\'s payments');
    if (f.equity) parts.push(money(f.equity * 12) + ' from the town\'s equity');
    if (f.coop) parts.push(money(f.coop * 12) + ' from the co-op hall');
    if (f.bonded) parts.push(money(f.bonded * 12) + ' from bonded town halls');
    return parts.length ? 'This year about ' + parts.join(', ') + ' flow in.' : 'Nothing flows in yet: no deal payments, equity or co-op halls.';
  };
  P.setFundPayout = function(v) { this.s.fundPayout = clamp(+v || 0, 0, 1); };
  P.dividendEstimate = function() {   // next January's dividend per resident, in dollars, at today's fund and slider
    var pop = Math.max(1000, this._sim.evaluation.cityPop || 0);
    return Math.round((this.s.fund || 0) * this.fundShare() * DOLLARS / pop);
  };
  P._fundMonthly = function() {
    var s = this.s, mi = this.mi();
    if (!this.festus()) return;
    s.fund = (s.fund || 0) * (1 + FUND_GROWTH);
    if (mi > 0 && mi % 12 === 0 && s.fundYear !== mi) {
      s.fundYear = mi;
      var pay = (s.fund || 0) * this.fundShare();
      var pop = Math.max(1000, this._sim.evaluation.cityPop || 0);
      s.fund -= pay;
      s.fundPaid = pay;
      s.dividendPerRes = Math.round(pay * DOLLARS / pop);
      s.netWorth = (s.netWorth || 0) + s.dividendPerRes;
      if (s.dividendPerRes >= 1)
        this.news('good', 'Festus Fund dividend: ' + usd(s.dividendPerRes) + ' to every resident this year. ' + Math.round(this.fundShare() * 100) +
                  '% of the fund went out; ' + money(s.fund) + ' stays invested.', {alert: 'fund'});
    }
    s.fundDividend = (s.fundPaid || 0) / 12;   // what households feel each month until the next payout
  };

  // ---- town projects: no revenue, built for purpose ----
  // Costs fall on the labor share as abundance rises; who builds it decides how much purpose it makes.
  P.abundance = function() {
    var s = this.s;
    return clamp(0.12 * Object.keys(s.discovered || {}).length + 0.5 * (s.automation || 0) + 0.4 * this.townShare(), 0, 0.9);
  };
  P.projectCost = function(id, who) {
    var p = PROJECTS[id], a = this.abundance();
    return Math.round(p.base * ((1 - p.labor) + p.labor * (1 - 0.9 * a)) * (who === 'neighbors' ? NEIGHBOR_COST : 1));
  };
  P.projectState = function(id) { var pr = (this.s.projects || {})[id]; return !pr ? 'open' : pr.built ? 'built' : 'building'; };
  // how much of a built project's Purpose is left (1 when it opens or starts a new season, down to the floor)
  P.projectFade = function(id) {
    var pr = (this.s.projects || {})[id];
    if (!pr || !pr.built) return 0;
    return Math.max(PROJECT_FLOOR, 1 - (this.s.months - (pr.season || pr.built)) / PROJECT_FADE);
  };
  P.projectBoost = function() {
    var s = this.s, b = 0;
    for (var id in (s.projects || {})) if (s.projects[id].built) b += s.projects[id].purpose * this.projectFade(id);
    return b;
  };
  P.projectAvailable = function(id) { var p = PROJECTS[id]; return !p.abundance || this.abundance() >= p.abundance; };
  P.canRenew = function(id) { return this.projectState(id) === 'built' && this.projectFade(id) <= RENEW_AT && !(this.s.projects[id].renewing); };
  P.renewCost = function(id, who) { return Math.round(this.projectCost(id, who) * RENEW_COST); };
  P.projectCard = function(id, suggested) {
    var s = this.s, p = PROJECTS[id], renew = this.canRenew(id);
    if (!p || s.card || !this.festus() || (!renew && (this.projectState(id) !== 'open' || !this.projectAvailable(id)))) return false;
    var funds = this._sim.budget.totalFunds, a = this.abundance();
    var rc = renew ? this.renewCost(id, 'robots') : this.projectCost(id, 'robots'), nc = renew ? this.renewCost(id, 'neighbors') : this.projectCost(id, 'neighbors');
    var pr = Math.round(p.purpose * ROBOT_PURPOSE), pn = Math.round(p.purpose * NEIGHBOR_PURPOSE);
    var mo = renew ? [1, 2] : p.months;
    s.mayor.projAsked = s.mayor.projAsked || {};
    s.mayor.projAsked[id] = s.months;
    this.showCard({type: 'project', id: id, renew: renew, kicker: 'Town project' + (renew ? ' · a new season' : '') + (suggested ? ' · residents are asking' : '') + ' · no revenue',
      title: renew ? 'Another season: ' + p.name.charAt(0).toLowerCase() + p.name.slice(1) : p.name,
      body: renew ? 'The ' + p.name.toLowerCase() + ' has gone quiet. A new season (repairs, programs, people to run them) costs a fraction of building it and brings it back to life.' : p.body,
      rows: [['Cost today', money(rc) + (renew ? ' for a season' : ' (' + money(p.base) + ' before robots and cheap compute; abundance ' + Math.round(a * 100) + '%)'), 'neutral'],
             ['Robots only', money(rc) + ', ready in ' + mo[0] + (mo[0] > 1 ? ' months' : ' month') + '. Purpose +' + pr, 'neutral'],
             ['Neighbors + robots', money(nc) + ', ready in ' + mo[1] + ' months. Purpose +' + pn + ': people value what they build', 'good'],
             ['Pays back', 'Nothing in dollars. Purpose fades over two years, then a new season brings it back; Purpose feeds approval', 'neutral']],
      options: [{id: 'robots', label: (renew ? 'Robots run it (' : 'Robots build it (') + money(rc) + ')', tone: 'neutral', cost: rc, disabled: rc > funds,
                 preview: this.preview(scale(p.d, renew ? 0.35 : 0.7)), note: 'Quick and cheap. Purpose +' + pr + '.'},
                {id: 'neighbors', label: 'Neighbors + robots (' + money(nc) + ')', tone: 'good', cost: nc, disabled: nc > funds,
                 preview: this.preview(scale(p.d, renew ? 0.6 : 1.2)), note: 'Slower and dearer. Purpose +' + pn + '.'},
                {id: 'later', label: 'Not now', tone: 'bad', preview: []}]
    });
    return true;
  };
  P._decideProject = function(card, option) {
    var s = this.s, p = PROJECTS[card.id];
    if (option !== 'robots' && option !== 'neighbors') return;
    var n = option === 'neighbors';
    if (card.renew) {
      var pr = s.projects[card.id], rcost = this.renewCost(card.id, option);
      if (!pr || rcost > this._sim.budget.totalFunds) return;
      this._sim.budget.spend(rcost);
      pr.renewing = {who: option, done: s.months + (n ? 2 : 1)};
      this.news('neutral', 'Another season for the ' + p.name.toLowerCase() + ': ' + (n ? 'neighbors sign up to run it' : 'the robots get it going again') + '. ' + money(rcost) + '.');
      return;
    }
    var cost = this.projectCost(card.id, option);
    if (cost > this._sim.budget.totalFunds) return;
    this._sim.budget.spend(cost);
    s.projects = s.projects || {};
    s.projects[card.id] = {who: option, cost: cost, start: s.months, done: s.months + p.months[n ? 1 : 0],
                           purpose: p.purpose * (n ? NEIGHBOR_PURPOSE : ROBOT_PURPOSE), d: scale(p.d, n ? 1.2 : 0.7)};
    this.news('neutral', p.name + ': ' + (n ? 'neighbors sign up for weekend shifts alongside the robots' : 'the robots start work') + '. ' + money(cost) + ', open in ' + p.months[n ? 1 : 0] + ' months.');
  };
  P._projectsMonthly = function() {
    var s = this.s;
    for (var id in (s.projects || {})) {
      var pr = s.projects[id];
      if (pr.renewing && s.months >= pr.renewing.done) {   // a new season starts: the boost comes back
        var n = pr.renewing.who === 'neighbors';
        pr.season = s.months; pr.who = pr.renewing.who; pr.renewing = null;
        pr.purpose = PROJECTS[id].purpose * (n ? NEIGHBOR_PURPOSE : ROBOT_PURPOSE);
        this.bump(scale(PROJECTS[id].d, n ? 0.6 : 0.35), 'A new season for the ' + PROJECTS[id].name.toLowerCase());
        this.news('good', 'A new season for the ' + PROJECTS[id].name.toLowerCase() + (n ? ': the volunteers are back, and they brought friends.' : ': it is busy again.'),
                  pr.at ? {x: pr.at.x, y: pr.at.y, showable: true} : null);
        continue;
      }
      if (pr.built || s.months < pr.done) continue;
      pr.built = s.months;
      pr.at = this._placeProject(id);
      this.bump(pr.d, PROJECTS[id].name + ' opened');
      this.news('good', PROJECTS[id].opened[pr.who === 'neighbors' ? 1 : 0], pr.at ? {x: pr.at.x, y: pr.at.y, showable: true} : null);
      this.drama();
    }
  };
  // A project shows up on the map: trees, paths and a fountain on a clear patch near Main Street, the river or the bluffs
  var SPOT_AT = {downtown: DOWNTOWN, river: {x: 95, y: 58}, edge: {x: 92, y: 20}};
  P._placeProject = function(id) {
    var where = PROJECT_SPOTS[id], n = PROJECT_SIZE[id] || 2, map = this._map, self = this;
    if (!where || !this.festus()) return null;
    var c = SPOT_AT[where], best = null;
    var reserved = function(x, y) {
      return PLANS.some(function(pl) { return pl.rects.some(function(r) { return x >= r.x - 1 && x < r.x + r.w + 1 && y >= r.y - 1 && y < r.y + r.h + 1; }); });
    };
    var clear = function(x0, y0) {
      for (var y = y0; y < y0 + n; y++)
        for (var x = x0; x < x0 + n; x++)
          if (!map.testBounds(x, y) || map.getTileValue(x, y) !== TV.DIRT || fieldAt(x, y) || reserved(x, y)) return false;
      return true;
    };
    for (var r = 0; r <= 30 && !best; r++)
      for (var dy = -r; dy <= r && !best; dy++)
        for (var dx = -r; dx <= r && !best; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (clear(c.x + dx, c.y + dy)) best = {x: c.x + dx, y: c.y + dy};
        }
    if (!best) return null;
    for (var y = best.y; y < best.y + n; y++)
      for (var x = best.x; x < best.x + n; x++) {
        var centre = x === best.x + (n >> 1) && y === best.y + (n >> 1);
        if (centre && n >= 3) map.setTile(x, y, TV.FOUNTAIN, TF.ANIMBIT | TF.BURNBIT | TF.BULLBIT);
        else map.setTile(x, y, TV.WOODS2 + Random.getRandom(3), TF.BURNBIT | TF.BULLBIT);
      }
    return {x: best.x + (n >> 1), y: best.y + (n >> 1)};
  };
  P._suggestProject = function() {
    var s = this.s, m = s.mayor, self = this, asked = m.projAsked || {}, funds = this._sim.budget.totalFunds;
    if (s.months < 4) return false;
    var fresh = function(id) { return asked[id] === undefined || s.months - asked[id] >= 12; };
    var ids = PROJECT_ORDER.filter(function(id) {
      return self.projectState(id) === 'open' && self.projectAvailable(id) && fresh(id) && self.projectCost(id, 'robots') <= funds;
    });
    if (ids.length) return this.projectCard(ids[0], true);
    // nothing new to build: a faded project gets another season
    var again = PROJECT_ORDER.filter(function(id) { return self.canRenew(id) && fresh(id) && self.renewCost(id, 'robots') <= funds; });
    return again.length ? this.projectCard(again[0], true) : false;
  };

  // ---- the director: research cards on a schedule, and something every few months, never two cards at once ----
  P._director = function(mi) {
    // Something to decide every few months: a breakthrough when one is due, otherwise a town project, otherwise
    // the developer comes back early. In Festus, everyday town hall asks arrive in the ticker (_quickAskLane) and
    // only a furious faction, or a long quiet spell, puts an ask on a card.
    var s = this.s, R = s.research, m = s.mayor, festus = this.festus();
    if (!this.canCard()) return;
    var quiet = s.months - m.lastDrama >= DRAMA_GAP;
    // breakthroughs only turn up while a Research Lab runs, on the lab clock (more labs and compute run it faster)
    var nextR = !R.active && this.labsOn() > 0 && this.nextResearch();
    var clock = R.clock || 0;
    // a faction that's furious gets the floor before the next breakthrough does
    var furious = FACTIONS.some(function(f) { return m.factions[f.id].v < FURIOUS; });
    if (furious && m.lastType !== 'ask' && this._askCard(festus)) return;
    if (nextR && clock >= R.next) { this._researchCard(nextR); return; }
    if (festus && m.lastType !== 'ask' && this._askCard(false, 'card')) return;   // reopening a bad deal gets a card, not the ticker
    if (festus && m.lastType !== 'project' && (m.lastType === 'ask' || s.purpose < 65) && this._suggestProject()) return;
    if (!festus && m.lastType !== 'ask' && this._askCard()) return;
    if (nextR && clock >= R.next - 2) { this._researchCard(nextR); return; }
    if (festus && s.dev.status === 'away') { s.dev.due = mi; return; }
    if (!festus || quiet) this._askCard();
  };
}
