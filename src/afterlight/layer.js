/* Afterlight layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * Adds compute and robots alongside power, an automation "jobs shock", a mood model (unemployment, purpose,
 * backlash, hope), ownership policies (Helix vs co-op), and a stream of events: protests, riots, strikes, slumps
 * and discoveries. The Micropolis core (zoning, growth, traffic, power, land value) is left in charge; this layer
 * reads its census once a month and nudges a few hooks (valves, power capacity, evaluation, budget).
 */

import { FRONT_END_MESSAGE } from '../messages.ts';
import { Position } from '../position.ts';
import { Random } from '../random.ts';
import { BNCNBIT, ZONEBIT } from '../tileFlags.ts';
import { TileUtils } from '../tileUtils.js';
import * as TV from '../tileValues.ts';
import * as B from './buildings.js';
import { installMayor, freshMayor, freshDev, freshResearch, RESEARCH } from './mayor.js';
import { setRealDollars, setBuildScale, setZoneScale, money } from './money.js';
import { HOMES_PER_BLOCK } from './festus.js';

export const AL_NEWS = 'Afterlight news';

// Base numbers (tuned for a 120x100 Micropolis map)
var DC_DRAW = 150;          // power units a data center pulls (a coal plant makes 700)
var DEPOT_DRAW = 60;
var CLINIC_DRAW = 40;
var LAB_DRAW = 30;
var SOLAR_STRENGTH = 300;
var FUSION_STRENGTH = 6000;
var VALVE_LEAK = 0.8;       // Festus: demand valves forget 20% a step, so population grows instead of cycling
var DC_COMPUTE = 100;       // compute units per powered data center
var DEPOT_CAPACITY = 150;   // robots a depot can house and maintain
// Festus homes and demand (_homesMonthly). Job units are Micropolis's zone-population units.
var COMMUTE = 10;           // jobs Festus residents hold elsewhere in the region (the tide reaches them too)
var DRAW = 0.015;           // newcomers a dividend draws, per real dollar a resident a year (per step)
var DRAW_MAX = 50;
var RENT_UP = 0.45;         // how far rents climb when every home is taken and people still want in...
var RENT_FULL = 800;        // ...this much (on the R bar's -2000..2000 scale)
var RENT_DOWN = 0.1;        // how far they ease when people want out
var CREW_OUT = 40;          // how hard finished crews pull out (per demand step, per job unit leaving)
var TRADES = 3;             // trades jobs (worker units) for each new home going up a month
var RENT_DAMP = 400;        // high rents price some newcomers out (per demand step, per 100% rise in rent)
var SHOP_PUSH = 400;        // shops follow household income (per demand step, per 100% of a normal income)
var ZONE_PRICE = 0.25;      // Festus: zoning a block costs a quarter of the engine's $100 ($25k): the builders build the homes
var FACTORY_PUSH = [-130, -250];   // factories stop growing as the tide rises, and slowly fade: base, and per unit of tide

export const DISCOVERIES = {
  cheap_solar: {
    month: 10, headline: 'SOLAR NOW CHEAPER THAN DIRT',
    body: 'Perovskite tandem panels come off the line at a tenth of last year\'s price. Every roof and parking lot is a power plant now.',
    helps: 'Solar farms cost half and make three times the power.',
    strains: 'The coal plant\'s jobs are stranded, and Helix wants more land for compute.'
  },
  frontier_model: {
    month: 22, headline: 'FRONTIER MODEL DOES A YEAR OF OFFICE WORK IN AN AFTERNOON',
    body: 'A new AI model can run whole departments. Every data center is suddenly worth three times as much, and pulls twice the power.',
    helps: 'Compute output and value triple.',
    strains: 'Data centers draw double power; office jobs start to vanish.'
  },
  robots_build_robots: {
    month: 34, headline: 'ROBOTS NOW BUILD ROBOTS',
    body: 'The first fully automated robot factory goes live. Depots can house three times as many machines, and they multiply on their own.',
    helps: 'Robot capacity triples and fleets grow fast.',
    strains: 'Automation spikes: factory and shop jobs fall away almost overnight.'
  },
  the_cure: {
    month: 46, headline: 'THE CURE: AGING SLOWED, MOST CANCERS BEATEN',
    body: 'AI-designed therapies reach the valley. Healing clinics can now be built, and people expect to live decades longer.',
    helps: 'Unlocks Healing Clinics. Hope soars; sickness and crime fall.',
    strains: 'A housing crunch as nobody leaves, and the old question gets louder: what do we do with all that time?'
  },
  fusion: {
    month: 58, headline: 'FUSION IGNITES: ENERGY TOO CHEAP TO METER',
    body: 'A compact fusion design is approved for towns. Power stops being the limit.',
    helps: 'Unlocks the Fusion Plant (6,000 power).',
    strains: 'Helix\'s appetite for land and compute has no ceiling now.'
  }
};
var DISCOVERY_ORDER = ['cheap_solar', 'frontier_model', 'robots_build_robots', 'the_cure', 'fusion'];

var clamp = function(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
var approach = function(v, target, rate) { return v + (target - v) * rate; };

function freshState() {
  return {
    months: 0, scenario: 'starter',
    compute: 0, computeHelix: 0, computeCoop: 0,
    robots: 0, robotsHelix: 0,
    automation: 0, unemployment: 0.05, purpose: 70, backlash: 10, hope: 50,
    cover: 0, helixShare: 1, dividendPool: 0, cityRevenue: 0, helixRevenue: 0, coopRevenue: 0,
    policies: {helixExpansion: true, dividend: false, communityFirst: false, purposeProgram: false},
    discovered: {},
    protest: null, strike: 0, slump: false, riots: 0, riotMonth: -99,
    cooldowns: {protest: 6, strike: 8, riot: 12},
    milestones: {},
    helixBuilt: 0,
    log: [],
    // Aftersight mayor layer (mayor.js)
    mayor: freshMayor(), dev: freshDev(), research: freshResearch(), card: null, deal: null, construction: null,
    hallsBuilt: 0, water: {cap: 100, use: 0}, fund: 0, fundDividend: 0, kidsTrust: 0, dependence: 0, dealIncome: 0,
    // Festus Fund and town projects (mayor.js)
    fundPayout: 0.5, fundPaid: 0, dividendPerRes: 0, netWorth: 0, projects: {}, projBoost: 0
  };
}

function AfterlightLayer(map, sim) {
  this._map = map;
  this._sim = sim;
  this.s = freshState();
  this.sites = [];
  this._scanSites = [];
}

AfterlightLayer.prototype.reset = function() {
  var scen = this.s.scenario;
  this.s = freshState();
  this.s.scenario = scen;
};

AfterlightLayer.prototype.setScenario = function(name) {
  var s = this.s;
  s.scenario = name;
  setRealDollars(name === 'festus');
  setBuildScale(1);
  setZoneScale(name === 'festus' ? ZONE_PRICE : 1);
  this._map.alHousesOnly = name === 'festus';
  if (name === 'festus') {
    B.NAMES[B.DC_HELIX] = 'Keystone Data Center';
    B.NAMES[B.DC_COOP] = 'Festus Co-op Data Center';
    s.policies.helixExpansion = false;
    s.research.next = 5;      // lab-months: a lab built in the first month brings the first breakthrough around month 6
    this.makeOffer(0, 'first');
    s.card = {type: 'intro', kicker: 'Festus, Missouri · January 2026', title: 'You are the mayor',
      body: 'Festus is a river town of about 12,000 people, thirty minutes south of St. Louis. A developer wants to build a $6 billion data center campus on farmland by I-55, between homes. ' +
            'The decision is yours alone, and the town wants an answer tonight. Your seat is up in April 2028: the voters are the only check on you.',
      rows: [['Approval', 'Built from five factions: residents, farmers, workers, business, and schools. Each choice moves them.', 'neutral'],
             ['The tide', 'Machines will take more of the region\'s work every year, campus or no campus. What Festus owns decides whether dividends replace the wages.', 'neutral'],
             ['Build', 'The old town is full. Streets are laid on the north side, the north-west and the south side, but the lots are empty: zone homes and shops there when the R and C bars rise, or rents climb.', 'neutral'],
             ['Elections', 'Every two years, from April 2028. Under 50% approval, you\'re out.', 'neutral'],
             ['Goal', 'Win 3 elections, or win one with the town owning 25%+ of local compute and paying a real dividend ($1,000+ a resident a year).', 'good']],
      options: [{id: 'go', label: 'Open the meeting', tone: 'good'}]};
  } else {
    s.research.next = 5;
  }
};

AfterlightLayer.prototype.save = function(saveData) {
  saveData.afterlight = JSON.parse(JSON.stringify(this.s));
};

AfterlightLayer.prototype.load = function(saveData) {
  var fresh = freshState();
  if (saveData.afterlight) {
    var loaded = saveData.afterlight;
    for (var k in loaded) fresh[k] = loaded[k];
  }
  this.s = fresh;
  setRealDollars(this.s.scenario === 'festus');
  this._map.alHousesOnly = this.s.scenario === 'festus';
  setBuildScale(this.s.crews || 1);
  setZoneScale(this.s.scenario === 'festus' ? ZONE_PRICE : 1);
  if (this.s.scenario === 'festus') { B.NAMES[B.DC_HELIX] = 'Keystone Data Center'; B.NAMES[B.DC_COOP] = 'Festus Co-op Data Center'; }
};

// ---- Discovery-driven multipliers ----
AfterlightLayer.prototype.has = function(id) { return this.s.discovered[id] !== undefined; };
AfterlightLayer.prototype.solarStrength = function() { return SOLAR_STRENGTH * (this.has('cheap_solar') ? 3 : 1); };
AfterlightLayer.prototype.dcDraw = function() { return DC_DRAW * (this.has('frontier_model') || this.s.research.passed.frontier_model !== undefined ? 2 : 1); };
AfterlightLayer.prototype.dcCompute = function() { return DC_COMPUTE * (this.has('frontier_model') ? 3 : 1); };
AfterlightLayer.prototype.depotCapacity = function() { return DEPOT_CAPACITY * (this.has('robots_build_robots') ? 3 : 1); };
AfterlightLayer.prototype.isUnlocked = function(toolName) {
  if (toolName === 'fusion') return this.has('fusion');
  if (toolName === 'clinic') return this.has('the_cure');
  // Festus: the town builds a data center of its own only after voters back a co-op bond for it
  if (toolName === 'dcCoop' && this.s.scenario === 'festus') return this.bondPermits() > 0;
  return true;
};
AfterlightLayer.prototype.toolCostMultiplier = function(toolName) {
  return toolName === 'solar' && this.has('cheap_solar') ? 0.5 : 1;
};

// ---- Map scanner handlers: these run during Micropolis's normal map scan ----
AfterlightLayer.prototype.beginScan = function() {
  this.sites = this._scanSites;
  this._scanSites = [];
};

AfterlightLayer.prototype.registerHandlers = function(mapScanner, powerManager) {
  var self = this;
  var site = function(kind, owner, map, x, y, census) {
    var powered = map.getTile(x, y).isPowered();
    self._scanSites.push({kind: kind, owner: owner, x: x, y: y, powered: powered});
    return powered;
  };

  var dc = function(owner) {
    return function(map, x, y, simData) {
      var c = simData.census;
      c.alDCCount++;
      if (site('dc', owner, map, x, y, c)) {
        if (owner === 'helix') c.alDCHelixOn++; else c.alDCCoopOn++;
        // the developer's halls can run on their own gas turbines or solar and batteries instead of the town grid
        c.alPowerDraw += self.dcDraw() * (owner === 'helix' && self.gridShare ? self.gridShare() : 1);
      }
    };
  };
  var depot = function(owner) {
    return function(map, x, y, simData) {
      var c = simData.census;
      if (site('depot', owner, map, x, y, c)) {
        if (owner === 'helix') c.alDepotHelixOn++; else c.alDepotCoopOn++;
        c.alPowerDraw += DEPOT_DRAW;
      }
    };
  };

  mapScanner.addAction(B.DC_HELIX, dc('helix'));
  mapScanner.addAction(B.DC_COOP, dc('coop'));
  mapScanner.addAction(B.DEPOT_HELIX, depot('helix'));
  mapScanner.addAction(B.DEPOT_COOP, depot('coop'));
  mapScanner.addAction(B.SOLAR, function(map, x, y, simData) {
    simData.census.alSolarPop++;
    site('solar', 'coop', map, x, y, simData.census);
    powerManager._powerStack.push(new Position(x, y));
  });
  mapScanner.addAction(B.FUSION, function(map, x, y, simData) {
    simData.census.alFusionPop++;
    site('fusion', 'coop', map, x, y, simData.census);
    powerManager._powerStack.push(new Position(x, y));
  });
  // 888 is also an old smoke frame inside some saved industrial zones: only a zone centre counts as a lab
  mapScanner.addAction(function(tile) { return tile.getValue() === B.LAB && tile.isZone(); }, function(map, x, y, simData) {
    var c = simData.census;
    c.alLabCount++;
    if (site('lab', 'coop', map, x, y, c)) {
      c.alLabOn++;
      c.alPowerDraw += LAB_DRAW;
    }
  });
  mapScanner.addAction(B.CLINIC, function(map, x, y, simData) {
    var c = simData.census;
    if (site('clinic', 'coop', map, x, y, c)) {
      c.alClinicOn++;
      c.alPowerDraw += CLINIC_DRAW;
    }
  });
};

// Extra generating capacity and demand, consumed by PowerManager.doPowerScan
AfterlightLayer.prototype.extraPower = function(census) {
  return (census.alSolarPop || 0) * this.solarStrength() + (census.alFusionPop || 0) * FUSION_STRENGTH -
         (census.alPowerDraw || 0);
};

// ---- Helpers ----
AfterlightLayer.prototype.dateString = function() {
  var d = this._sim.getDate();
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.month] + ' ' + d.year;
};

AfterlightLayer.prototype.news = function(tone, text, extra) {
  var data = {tone: tone, text: text};
  if (extra) for (var k in extra) data[k] = extra[k];
  // the context behind the headline (why, who it moved, the numbers now), for the alert detail window
  try { data.ctx = this.newsContext ? this.newsContext(tone, text, extra || {}) : null; } catch (e) { data.ctx = null; }
  this.s.log.unshift({date: this.dateString(), tone: tone, text: text, ctx: data.ctx, x: data.x, y: data.y});
  if (this.s.log.length > 40) this.s.log.length = 40;
  this._sim._emitEvent(FRONT_END_MESSAGE, {subject: AL_NEWS, data: data});
};

AfterlightLayer.prototype._residentialNear = function(x, y, r) {
  var n = 0;
  for (var yy = y - r; yy <= y + r; yy += 1)
    for (var xx = x - r; xx <= x + r; xx += 1) {
      if (!this._map.testBounds(xx, yy)) continue;
      var t = this._map.getTile(xx, yy);
      if (t.isZone() && TileUtils.isResidential(t.getValue())) n++;
    }
  return n;
};

AfterlightLayer.prototype.dataCenters = function() {
  return this.sites.filter(function(s) { return s.kind === 'dc'; });
};

// Score how much a data center bothers its neighbours (0.5 .. 1.5)
AfterlightLayer.prototype.exposure = function(site) {
  return 0.5 + Math.min(1, this._residentialNear(site.x, site.y, 8) / 6);
};

// Look for a clear 3x3 plot touching the powered grid; used by Helix when it expands on its own (and by tests)
AfterlightLayer.prototype.findSite = function() {
  var map = this._map;
  var clear = function(v) { return v === TV.DIRT || (v >= TV.WOODS_LOW && v <= TV.WOODS5); };
  var candidates = [];
  for (var ty = 1; ty < map.height - 4; ty++)
    for (var lx = 1; lx < map.width - 4; lx++) {
      var ok = true, conductive = false;
      for (var dy = -1; dy <= 3 && ok; dy++)
        for (var dx = -1; dx <= 3; dx++) {
          var t = map.getTile(lx + dx, ty + dy);
          var inside = dx >= 0 && dx < 3 && dy >= 0 && dy < 3;
          if (inside) {
            if (!clear(t.getValue())) { ok = false; break; }
          } else if (t.isConductive() && !((dx === -1 || dx === 3) && (dy === -1 || dy === 3))) {
            conductive = true;     // touches the grid along an edge, so power will flow in
          }
        }
      if (ok && conductive) candidates.push({x: lx, y: ty});
    }
  if (!candidates.length) return null;
  return candidates[Random.getRandom(candidates.length - 1)];
};

AfterlightLayer.prototype.placeBuilding = function(centre, lx, ty) {
  var base = centre - 4;
  for (var dy = 0; dy < 3; dy++)
    for (var dx = 0; dx < 3; dx++) {
      var flags = BNCNBIT | (dx === 1 && dy === 1 ? ZONEBIT : 0);
      this._map.setTile(lx + dx, ty + dy, base + dy * 3 + dx, flags);
    }
};

// ---- Policies (mayor decisions) ----
AfterlightLayer.prototype.setPolicy = function(name, value) {
  if (!(name in this.s.policies)) return;
  this.s.policies[name] = !!value;
  var labels = {
    helixExpansion: value ? 'City Hall lets Helix build data centers and depots wherever it can get power.' :
                            'City Hall blocks new Helix construction. Only public and co-op projects may build.',
    dividend: value ? 'Citizen dividend passed: 20% of Helix\'s automation income and half of co-op profits go to every resident.' :
                      'Citizen dividend repealed. Co-op profits return to the city treasury.',
    communityFirst: value ? 'Community-first zoning: every Helix site must give the town a 25% stake, and Helix builds more slowly.' :
                            'Community-first zoning repealed.',
    purposeProgram: value ? 'The city funds guilds, apprenticeships and civic projects for people whose jobs went away.' :
                            'Purpose programs defunded.'
  };
  this.news('neutral', labels[name]);
};

// ---- Monthly update, called from the simulation when a census completes ----
AfterlightLayer.prototype.monthly = function(simData) {
  if (this.paused) return;
  var s = this.s, c = simData.census, p = s.policies, festus = s.scenario === 'festus';
  s.months++;
  if (festus) p.dividend = false;   // Festus pays its dividend from the Festus Fund, not the old citizen-dividend policy

  // Compute: powered data centers, except one under protest blockade
  var protestKey = s.protest ? s.protest.x + ',' + s.protest.y : '';
  var helixDC = 0, coopDC = 0;
  this.dataCenters().forEach(function(d) {
    if (!d.powered || d.x + ',' + d.y === protestKey) return;
    if (d.owner === 'helix') helixDC++; else coopDC++;
  });
  var per = this.dcCompute();
  s.computeHelix = helixDC * per;
  s.computeCoop = coopDC * per;
  s.compute = s.computeHelix + s.computeCoop;

  // Robots: housed by depots, run on compute, grow toward capacity
  var depots = c.alDepotHelixOn + c.alDepotCoopOn;
  var cap = depots * this.depotCapacity();
  var target = Math.min(cap, s.compute * 2 + depots * 20);
  var rate = this.has('robots_build_robots') ? 0.3 : 0.1;
  if (s.strike > 0) rate = 0;
  if (s.robots > target) s.robots = approach(s.robots, target, 0.3);
  else s.robots = approach(s.robots, target, rate);
  var helixDepotShare = depots > 0 ? c.alDepotHelixOn / depots : 1;
  s.robotsHelix = s.robots * helixDepotShare;

  // Ownership: Helix's share of the engine; community-first zoning hands the town a quarter of Helix sites
  var cv = this.has('frontier_model') ? 2 : 1, rv = 0.6;
  var helixGross = s.computeHelix * cv + s.robotsHelix * rv;
  var coopGross = s.computeCoop * cv + (s.robots - s.robotsHelix) * rv;
  var stake = p.communityFirst ? 0.25 : 0;
  s.helixRevenue = helixGross * (1 - stake);
  s.coopRevenue = coopGross + helixGross * stake;
  var total = s.helixRevenue + s.coopRevenue;
  s.helixShare = total > 0 ? s.helixRevenue / total : (c.alDCCount > 0 ? 1 : 0.5);

  // Jobs shock: robots and compute take over a growing share of the work in commercial/industrial zones
  // (Festus: plus the jobs its commuters hold elsewhere in the region, which the tide reaches too)
  var jobs = (c.comPop + c.indPop + (festus ? COMMUTE : 0)) * 8;   // same job units Micropolis uses in its evaluation
  var workers = Math.max(1, c.resPop);
  if (festus) {
    // Festus: automation is a regional tide that reaches the town whatever it hosts; only its own robot depots add to it
    var local = jobs > 0 ? 1 - Math.exp(-(s.robots * 0.5) / Math.max(jobs, 1)) : 0;
    var tide = this.tideTarget();
    s.tide = s.tide === undefined ? tide : approach(s.tide, tide, 0.15);
    s.automation = clamp(1 - (1 - s.tide) * (1 - local), 0, 0.95);
  } else {
    var labour = s.robots * 0.5 + s.compute * 0.15 + (this.has('cheap_solar') ? jobs * 0.05 : 0);
    s.automation = jobs > 0 ? clamp(1 - Math.exp(-labour / Math.max(jobs, 1)), 0, 0.95) : 0;
  }
  // Aftersight: the developer's promised jobs (and construction crews while the campus goes up; in Festus the crews
  // stay on through the fit-out, and need homes while they're here: _homesMonthly)
  var crews = festus ? this.crewHomes() : 0;
  var crewJobs = s.construction || crews ? Math.max(25, crews) : 0;
  var opsJobs = s.deal && s.hallsBuilt ? s.deal.jobs * 0.4 * (s.mayor.localHire ? 1.3 : 1) : 0;
  // Festus: the home-grown plan (community solar, Main Street grants, training) and the town's own halls employ people too
  if (festus) opsJobs += (!s.deal ? Math.min(2, s.mayor.homegrown || 0) * 6 : 0) + this.bondedBuilt() * 5;
  // ...and the local trades hire people already here while new homes go up (_homesMonthly; they don't draw newcomers)
  var dealJobs = crewJobs + opsJobs + (festus ? s.trades || 0 : 0);
  var employed = Math.min(workers, jobs * (1 - s.automation) + dealJobs);
  var unempTarget = clamp(1 - employed / workers, 0, 1);
  if (s.strike > 0) unempTarget = Math.min(1, unempTarget + 0.05);
  s.unemployment = approach(s.unemployment, unempTarget, 0.35);

  // Money: Helix pays a small local fee; co-op profits go to the city or into the dividend pool
  var helixFee = s.scenario === 'festus' ? 0 : (c.alDCHelixOn + c.alDepotHelixOn) * 15;   // Festus: the deal's terms pay instead
  var dividendPool = 0, cityIncome = helixFee;
  if (p.dividend) {
    dividendPool = s.helixRevenue * 0.2 + s.coopRevenue * 0.5;
    cityIncome += s.coopRevenue * 0.5;
  } else if (!festus) {
    cityIncome += s.coopRevenue;     // Festus: co-op halls pay into the Festus Fund instead (mayor.js _dealMoney)
  }
  var programCost = p.purposeProgram ? (festus ? this.guildCost() : Math.round(30 + c.resPop * 0.3)) : 0;
  cityIncome -= programCost;
  dividendPool += s.fundDividend || 0;
  // Upkeep for buildings that breakthroughs unlock
  cityIncome -= (c.alClinicOn || 0) * 15 + (c.alFusionPop || 0) * 40;
  s.dividendPool = dividendPool;
  s.cityRevenue = cityIncome;
  if (Math.round(cityIncome) !== 0) simData.budget.spend(-Math.round(cityIncome));

  // How much of the lost wage income the dividend replaces (0..1); Festus measures it in real household dollars
  var lostWages = workers * s.unemployment * 0.4 + 1;
  s.cover = festus ? this.incomeMix().cover : clamp(dividendPool / lostWages, 0, 1);

  // Feed the jobs shock back into Micropolis's demand valves (see valves.js)
  c.alJobFactor = 1 - s.automation;
  c.alValveLeak = s.scenario === 'festus' ? VALVE_LEAK : 1;   // damp the census boom-and-bust (see valves.js)
  c.alBirthRate = festus ? 0 : undefined;                      // Festus grows when people move in for work
  c.alIncomeSupport = (c.comPop + c.indPop + (festus ? COMMUTE : 0)) * s.automation * s.cover;
  if (festus) this._homesMonthly(c, crewJobs, opsJobs);
  var coopShare = 1 - s.helixShare;

  // Mood
  var dcPressure = 0, self = this;
  this.dataCenters().forEach(function(d) {
    var w = d.owner === 'helix' ? (p.communityFirst ? 3 : 6) : 2;
    dcPressure += w * self.exposure(d);
  });
  var shortage = c.unpoweredZoneCount + c.poweredZoneCount > 0 ?
                 c.unpoweredZoneCount / (c.unpoweredZoneCount + c.poweredZoneCount) : 0;
  var backlashTarget = Math.min(dcPressure, 40) + Math.max(0, s.unemployment - 0.05) * 90 * (1 - s.cover) +
                       s.helixShare * 40 * s.automation + shortage * 25 + (s.slump ? 8 : 0) - s.hope * 0.1;
  // Owning a piece of the engine and having civic work to do both keep meaning alive when jobs go
  var meaning = 1 - 0.5 * coopShare - (p.purposeProgram ? 0.35 : 0);
  var purposeTarget = 80 - s.unemployment * 100 * Math.max(0.1, meaning) + (p.purposeProgram ? 5 : 0) +
                      c.alClinicOn * 2 - (s.slump ? 10 : 0) - (this.has('the_cure') ? 8 : 0);
  // Festus: automation layoffs drain it even when the dividend pays the bills; projects and ownership build it back
  // Festus: a lost job stings less when a dividend replaces the wage, and less again with the guild; machines doing the
  // work drain it a little on their own; projects, owning the engine and clinics build it back
  if (festus) {
    var sting = (1 - 0.6 * s.cover) * (p.purposeProgram ? 0.6 : 1);
    purposeTarget = 70 - s.unemployment * 90 * sting - s.automation * 15 + (p.purposeProgram ? 6 : 0) + this.projectBoost() +
                    this.incomeMix().ownShare * 40 + c.alClinicOn * 2 - (s.slump ? 8 : 0) - (this.has('the_cure') ? 6 : 0) +
                    // with no campus coming, young people leave for work elsewhere, unless the town grows its own
                    (!s.deal && s.dev.walks > 0 ? -6 + Math.min(2, s.mayor.homegrown || 0) * 2 : 0);
  }
  var recentRiot = s.months - s.riotMonth < 6 ? 15 : 0;
  var hopeTarget = 45 + s.cover * 25 + c.alClinicOn * 4 + (s.milestones.basics_free ? 15 : 0) -
                   s.unemployment * 35 * (1 - s.cover) - recentRiot - s.backlash * 0.15 + coopShare * 10 -
                   Math.max(0, 50 - s.purpose) * 0.3;
  s.backlash = clamp(approach(s.backlash, backlashTarget, 0.2), 0, 100);
  s.purpose = clamp(approach(s.purpose, purposeTarget, 0.15), 0, 100);
  s.hope = clamp(approach(s.hope, hopeTarget, 0.12), 0, 100);

  c.alOpinionShift = Math.round((s.hope - s.backlash) / 5);
  c.alUnemployment = s.unemployment;

  for (var k in s.cooldowns) if (s.cooldowns[k] > 0) s.cooldowns[k]--;

  // Aftersight: breakthroughs are decision cards now (mayor.js), not a fixed schedule
  this.mayorMonthly(simData);
  if (this.s.scenario !== 'festus') this._helixExpansion(simData);
  this._events(simData);
  this._milestones(simData);
};

AfterlightLayer.prototype._discoveries = function(simData) {
  for (var i = 0; i < DISCOVERY_ORDER.length; i++) {
    var id = DISCOVERY_ORDER[i];
    if (this.has(id)) continue;
    if (this.s.months >= DISCOVERIES[id].month) {
      this.discover(id, simData);
      return; // at most one a month
    }
  }
};

AfterlightLayer.prototype.discover = function(id, simData) {
  if (this.has(id) || !DISCOVERIES[id]) return;
  var d = DISCOVERIES[id];
  var s = this.s;
  s.discovered[id] = s.months;
  s.hope = clamp(s.hope + 12, 0, 100);
  var valves = simData.valves;

  // Every discovery helps and strains
  if (id === 'cheap_solar') {
    s.backlash = clamp(s.backlash + 3, 0, 100);
  } else if (id === 'frontier_model') {
    s.backlash = clamp(s.backlash + 10, 0, 100);
  } else if (id === 'robots_build_robots') {
    s.backlash = clamp(s.backlash + 8, 0, 100);
    s.purpose = clamp(s.purpose - 8, 0, 100);
  } else if (id === 'the_cure') {
    s.hope = clamp(s.hope + 15, 0, 100);
    s.purpose = clamp(s.purpose - 6, 0, 100);
    valves.resValve = Math.min(2000, valves.resValve + 800);  // nobody's leaving: housing crunch
  } else if (id === 'fusion') {
    s.hope = clamp(s.hope + 8, 0, 100);
  }

  // the developer in the story is whoever is courting this town (Keystone in Festus)
  var who = this.dev().short, name = function(t) { return t.replace(/Helix/g, who); };
  this.news('good', d.headline, {paper: true, headline: d.headline, body: name(d.body), helps: name(d.helps), strains: name(d.strains),
                                 discovery: id});
};

AfterlightLayer.prototype._helixExpansion = function(simData) {
  var s = this.s, p = s.policies;
  if (!p.helixExpansion || s.months % 6 !== 3) return;
  var appetite = 0.35 + (this.has('frontier_model') ? 0.25 : 0) + (this.has('fusion') ? 0.3 : 0);
  if (p.communityFirst) appetite *= 0.5;
  if (simData.census.totalPop < 20 || Random.getRandom(100) >= appetite * 100) return;
  var site = this.findSite();
  if (!site) return;
  var depotTurn = this.has('robots_build_robots') ? s.helixBuilt % 2 === 1 : s.helixBuilt % 3 === 2;
  var kind = depotTurn ? B.DEPOT_HELIX : B.DC_HELIX;
  this.placeBuilding(kind, site.x, site.y);
  s.helixBuilt++;
  this.news('neutral', this.dev().short + ' opens a new ' + (depotTurn ? 'robot depot' : 'data center') + ' on the edge of town.',
            {x: site.x + 1, y: site.y + 1});
};

AfterlightLayer.prototype._events = function(simData) {
  var s = this.s, p = s.policies, cd = s.cooldowns;
  if (s.scenario === 'festus') { this._festusProtest(); this._slump(simData); return; }

  // Protest: ongoing
  if (s.protest) {
    var pr = s.protest;
    pr.months++;
    var stillThere = this.dataCenters().some(function(d) { return d.x === pr.x && d.y === pr.y; });
    if (!stillThere) {
      this.news('neutral', 'The protest camp packs up: the data center it targeted is gone.');
      s.protest = null;
    } else if (s.backlash > 70 && pr.months >= 2 && cd.riot === 0) {
      this.riot(simData, pr.x, pr.y);
      s.protest = null;
    } else if (s.backlash < 30 || pr.months > 8) {
      this.news('good', 'Protesters leave the data center gates. Servers spin back up.');
      s.protest = null;
      cd.protest = 6;
    }
  } else if (cd.protest === 0 && s.backlash > 45) {
    var dcs = this.dataCenters();
    if (dcs.length && Random.getRandom(100) < 35) this.startProtest(dcs);
  }

  // Standalone riot when joblessness goes unanswered
  if (!s.protest && cd.riot === 0 && s.unemployment > 0.35 && s.cover < 0.3 && s.backlash > 60 && Random.getRandom(100) < 25)
    this.riot(simData);

  // Strike against automation
  if (s.strike > 0) {
    s.strike--;
    simData.valves.comValve = Math.max(-1500, simData.valves.comValve - 250);
    simData.valves.indValve = Math.max(-1500, simData.valves.indValve - 250);
    if (s.strike === 0) this.news('neutral', 'The general strike ends. Robots return to the loading docks.');
  } else if (cd.strike === 0 && s.unemployment > 0.2 && s.robots > 40 && !p.dividend && Random.getRandom(100) < 20) {
    this.strike();
  }

  this._slump(simData);
};

// Festus: no riots or general strikes. Neighbors who are fed up with the campus blockade its gates instead; the
// Residents faction decides it (shown in City pulse), and the blockade lifts when they calm down.
AfterlightLayer.prototype._festusProtest = function() {
  var s = this.s, cd = s.cooldowns, res = s.mayor.factions.res.v, dev = this.dev().short;
  if (s.protest) {
    var pr = s.protest;
    pr.months++;
    var stillThere = this.dataCenters().some(function(d) { return d.x === pr.x && d.y === pr.y; });
    if (!stillThere || res >= 45 || pr.months > 6) {
      this.news('good', 'Neighbors end the blockade at ' + dev + '\'s gates. The hall spins back up.', {x: pr.x, y: pr.y});
      s.protest = null;
      cd.protest = 12;
    }
    return;
  }
  var halls = this.devHalls().filter(function(d) { return d.powered; });
  if (cd.protest > 0 || !halls.length || res >= 35 || Random.getRandom(100) >= 30) return;
  this.startProtest(halls);
  s.cooldowns.protest = 12;
};

// Festus: homes, rents and what the town wants built. People want to move in when there are jobs (shops and
// factories in town, commuting jobs in the region, the campus and its construction crews) and when the Fund pays a
// dividend; they want out when the jobs go. A block holds eight houses, so once the homes are taken and people still
// want in, rents climb until the town zones more. Shops follow what households have to spend; factories fade with
// the tide. These feed Micropolis's demand valves (valves.js), which the R, C and I bars show.
AfterlightLayer.prototype._homesMonthly = function(c, crewJobs, opsJobs) {
  var s = this.s, v = this._sim._valves;
  var cap = Math.max(1, (c.alResPowered || 0) * HOMES_PER_BLOCK), occ = clamp(c.resPop / cap, 0, 1);   // blocks with power
  // jobs the zones don't show, which bring people who need homes: commuters' jobs in the region (the tide reaches
  // them too), the campus's construction crews and staff, and the town's own employers. A dividend that replaces lost
  // wages keeps people from leaving, but it doesn't bring jobless newcomers: it only fills the gap up to the residents
  // already here (newcomers it draws come through `pull.dividend` below).
  // Crews that have finished move on over a few months: they don't count as residents a dividend keeps here.
  var leaving = this.crewsLeaving() / 8;
  var normRes = Math.max(1, c.resPop / 8 - leaving), jobUnits = (c.comPop + c.indPop + COMMUTE) * (1 - s.automation) + (crewJobs + opsJobs) / 8;
  var stay = Math.min((c.comPop + c.indPop + COMMUTE) * s.automation * s.cover, Math.max(0, normRes * 0.98 - jobUnits));
  c.alIncomeSupport = COMMUTE * (1 - s.automation) + (crewJobs + opsJobs) / 8 + stay;
  // and newcomers a dividend draws; high rents price some of them out
  var pull = {crews: crewJobs, jobs: opsJobs, dividend: Math.min(DRAW_MAX, (s.dividendPerRes || 0) * DRAW)};
  var rv = v ? v.resValve : 0, pressure = clamp(rv / RENT_FULL, -1, 1.25), tight = clamp((occ - 0.88) / 0.1, 0, 1);
  var target = pressure > 0 ? 1 + RENT_UP * pressure * tight : 1 + RENT_DOWN * pressure;
  s.rent = s.rent === undefined ? target : approach(s.rent, target, target > s.rent ? 0.15 : 0.05);   // up fast, down slowly
  // new homes going up employ the local trades; robot crews do part of that work once they exist (crews: 1, 0.75, 0.5)
  var newHomes = s.homes ? Math.max(0, c.resPop - s.homes.built) : 0;
  s.trades = approach(s.trades || 0, newHomes * TRADES * (s.crews || 1), 0.3);
  s.homesHist = (s.homesHist || []).concat([c.resPop]).slice(-13);   // a year of homes, for business's sense of growth
  s.homes = {occ: occ, cap: cap, built: c.resPop, blocks: c.alResPowered || 0, dark: Math.max(0, (c.resZonePop || 0) - (c.alResPowered || 0)),
             pull: pull};
  c.alResPush = pull.dividend - Math.max(0, s.rent - 1) * RENT_DAMP - leaving * CREW_OUT;
  c.alComPush = (this.incomeIndex() - 1) * SHOP_PUSH;
  c.alIndPush = FACTORY_PUSH[0] + FACTORY_PUSH[1] * (s.tide || 0);
};

// Festus: the warm-up years before January 2026 run with the layer paused, so set the hooks the valves read (the
// commuters' jobs, the damped valves, factories that have stopped growing) before them
AfterlightLayer.prototype.warmupHooks = function() {
  var c = this._sim._census;
  c.alJobFactor = 1; c.alValveLeak = VALVE_LEAK; c.alIncomeSupport = COMMUTE;
  c.alResPush = 0; c.alComPush = 0; c.alIndPush = FACTORY_PUSH[0]; c.alBirthRate = 0;
};

// The purposelessness slump
AfterlightLayer.prototype._slump = function(simData) {
  var s = this.s;
  if (!s.slump && s.purpose < 35) {
    s.slump = true;
    this.news('bad', 'THE LONG AFTERNOON: with little work left, a malaise settles over the valley. People are leaving.',
              {paper: true, headline: 'THE LONG AFTERNOON', tone: 'bad',
               body: 'Surveys find most residents no longer know what their days are for. Bars are full at noon; volunteer rolls are empty.',
               helps: 'Nothing, yet.', strains: 'People move away, crime rises, and hope sinks. ' +
                 (s.scenario === 'festus' ? 'Town projects built with neighbors, the apprenticeship guild and owning part of the engine can lift it.' :
                                            'Purpose programs or co-op ownership can lift it.')});
  } else if (s.slump && s.purpose > 45) {
    s.slump = false;
    this.news('good', 'The Long Afternoon lifts: people are finding new things worth doing.');
  }
  if (s.slump) simData.valves.resValve = Math.max(-2000, simData.valves.resValve - 150);
};

AfterlightLayer.prototype.startProtest = function(dcs) {
  var self = this;
  dcs = dcs || this.dataCenters();
  if (!dcs.length) return false;
  var best = dcs[0], bestScore = -1;
  dcs.forEach(function(d) {
    var score = self.exposure(d) * (d.owner === 'helix' ? 2 : 1);
    if (score > bestScore) { bestScore = score; best = d; }
  });
  this.s.protest = {x: best.x, y: best.y, months: 0, owner: best.owner};
  this.s.cooldowns.protest = 6;
  var whose = best.owner === 'helix' ? this.dev().short : 'the co-op';
  this.news('bad', 'PROTEST at ' + whose + '\'s data center! Residents blockade the gates over noise, power bills and lost jobs.',
            {x: best.x, y: best.y, showable: true});
  return true;
};

// Unrest spreads like fire: literally lights fires in the neighbourhood, which Micropolis's fire code then spreads
AfterlightLayer.prototype.riot = function(simData, cx, cy) {
  var map = this._map, s = this.s;
  var where = cx === undefined ? 'through the poorest streets' : 'out from the data center protest';
  if (cx === undefined) {
    // Unrest starts in the poorest neighbourhood
    var best = null, bestLV = 1e9;
    for (var y = 0; y < map.height; y++)
      for (var x = 0; x < map.width; x++) {
        var t = map.getTile(x, y);
        if (!t.isZone() || !TileUtils.isResidential(t.getValue())) continue;
        var lv = simData.blockMaps.landValueMap.worldGet(x, y);
        if (lv < bestLV) { bestLV = lv; best = {x: x, y: y}; }
      }
    if (!best) return false;
    cx = best.x; cy = best.y;
  }
  var fires = 0;
  for (var i = 0; i < 80 && fires < 6; i++) {
    var fx = cx - 6 + Random.getRandom(12), fy = cy - 6 + Random.getRandom(12);
    if (!map.testBounds(fx, fy)) continue;
    var tile = map.getTile(fx, fy);
    var v = tile.getValue();
    if (!tile.isZone() && tile.isCombustible() && v > TV.LASTFIRE && !TileUtils.isRoad(v)) {
      map.setTo(fx, fy, TileUtils.randomFire());
      fires++;
    }
  }
  s.riots++;
  s.riotMonth = s.months;
  s.cooldowns.riot = 12;
  s.hope = clamp(s.hope - 15, 0, 100);
  this.news('bad', 'RIOTS! Unrest spreads ' + where + '. Fires reported.', {x: cx, y: cy, showable: true});
  return true;
};

AfterlightLayer.prototype.strike = function() {
  this.s.strike = 4;
  this.s.cooldowns.strike = 14;
  this.news('bad', 'GENERAL STRIKE: workers walk out against automation. Shops and factories stall; robot output halts.');
};

AfterlightLayer.prototype._milestones = function(simData) {
  var s = this.s, m = s.milestones;
  if (!m.first_compute && s.compute > 0) {
    m.first_compute = true;
    this.news('neutral', 'The valley\'s first data center hums to life. Compute is now something this town has.');
  }
  if (!m.basics_free && s.robots >= 400 && s.compute >= 300 && s.cover >= 0.8) {
    m.basics_free = true;
    this.news('good', 'ABUNDANCE: food, power and transit are now free for every resident.',
              {paper: true, headline: 'BASICS ARE FREE', body: 'Robot-run farms, solar and the dividend mean no one in the valley pays for food, power or transit any more.',
               helps: 'Hope rises, and nobody goes hungry.', strains: 'The old economy of jobs and wages is mostly gone. What do people do now?'});
    s.purpose = clamp(s.purpose - 5, 0, 100);
  }
  if (!m.post_scarcity && m.basics_free && this.has('fusion') && s.robots >= 800 && s.cover >= 0.9) {
    m.post_scarcity = true;
    this.news('good', 'POST-SCARCITY: the valley produces more than it can use.',
              {paper: true, headline: 'THE VALLEY CROSSES OVER', body: 'For the first time, anything anyone needs can be made on demand.',
               helps: 'Material want is over.', strains: 'Meaning, status and power are what people fight over now.'});
  }
};

installMayor(AfterlightLayer);

export { AfterlightLayer };
