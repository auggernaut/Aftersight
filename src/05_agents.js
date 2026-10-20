// Agents: Yuka vehicles for movement, Yuka Think + GoalEvaluators for decisions.
const { Vehicle, Think, Goal, CompositeGoal, GoalEvaluator, FollowPathBehavior, Path, Vector3 } = YUKA;
const hourOf = () => S.t % 24;
const isWeekday = () => (S.day % 7) < 5;
const between = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;

// ---------- movement shared by people and robots ----------
function setupMover(ent, speed) {
  ent.updateOrientation = false;
  ent.maxSpeed = speed;
  ent.maxForce = speed * 30;
  ent.follow = new FollowPathBehavior(new Path(), 0.7);
  ent.follow._arrive.deceleration = 0.04;
  ent.follow.active = false;
  ent.steering.add(ent.follow);
  ent.wp = null; ent.moving = false;
}
function startPath(ent, pts) {
  const path = new Path();
  for (const p of pts) path.add(new Vector3(p.x, p.y, 0));
  ent.follow.path = path;
  ent.follow.active = true;
  ent.wp = pts.map(p => ({ x: p.x, y: p.y })); ent.wpi = 0;
  ent.moving = true;
}
function stopMoving(ent) { ent.moving = false; ent.follow.active = false; ent.velocity.set(0, 0, 0); }
function stepMover(ent, dt) {
  if (!ent.moving) return;
  const last = ent.wp[ent.wp.length - 1];
  if (dt <= 0.05) {
    ent.update(dt); // Yuka steering: FollowPath (seek through waypoints, arrive at the end)
    while (ent.wpi < ent.wp.length - 1 && Math.hypot(ent.wp[ent.wpi].x - ent.position.x, ent.wp[ent.wpi].y - ent.position.y) < 0.8) ent.wpi++;
  } else {
    // at high time compression, walk the same path kinematically (steering would overshoot)
    let budget = ent.maxSpeed * dt;
    while (budget > 0 && ent.wpi < ent.wp.length) {
      const w = ent.wp[ent.wpi], dx = w.x - ent.position.x, dy = w.y - ent.position.y, d = Math.hypot(dx, dy);
      if (d <= budget) { ent.position.x = w.x; ent.position.y = w.y; budget -= d; ent.wpi++; }
      else { ent.position.x += dx / d * budget; ent.position.y += dy / d * budget; budget = 0; }
    }
    if (ent.follow.path) while (!ent.follow.path.finished() && ent.follow.path.current().squaredDistanceTo(ent.position) < 1) ent.follow.path.advance();
  }
  if (Math.hypot(last.x - ent.position.x, last.y - ent.position.y) < 0.35) { ent.position.x = last.x; ent.position.y = last.y; stopMoving(ent); }
}

// ---------- goals ----------
class MoveGoal extends Goal {
  constructor(owner, site, target) { super(owner); this.site = site; this.target = target; }
  activate() {
    const o = this.owner;
    if (!this.target) { this.status = Goal.STATUS.COMPLETED; return; }
    startPath(o, this.site ? route({ x: o.position.x, y: o.position.y }, this.site, this.target) : [this.target]);
  }
  execute() { if (!this.owner.moving) this.status = Goal.STATUS.COMPLETED; }
  terminate() { if (this.status !== Goal.STATUS.COMPLETED) stopMoving(this.owner); }
}
class DwellGoal extends Goal {
  constructor(owner, kind, hours) { super(owner); this.kind = kind; this.hours = hours; }
  activate() { this.left = this.hours; this.owner.activity = this.kind; }
  execute() { this.left -= SIM.dt; if (this.left <= 0) this.status = Goal.STATUS.COMPLETED; }
  terminate() { this.owner.activity = null; }
}
// "Go to <site> and do <kind> for <hours>", then run onDone.
class ActivityGoal extends CompositeGoal {
  constructor(owner, kind, site, hours, onDone, target) { super(owner); this.kind = kind; this.site = site; this.hours = hours; this.onDone = onDone; this.target = target; }
  activate() {
    this.clearSubgoals();
    const target = this.target || (this.site ? spotIn(this.site) : null);
    this.owner.dest = this.site;
    this.addSubgoal(new DwellGoal(this.owner, this.kind, this.hours));
    this.addSubgoal(new MoveGoal(this.owner, this.site, target)); // subgoals are LIFO: move first
    this.owner.traveling = this.kind;
  }
  execute() {
    this.activateIfInactive();
    this.status = this.executeSubgoals();
    if (this.status === Goal.STATUS.COMPLETED && this.onDone) { const f = this.onDone; this.onDone = null; f(this.owner); }
  }
  terminate() { this.clearSubgoals(); this.owner.activity = null; this.owner.traveling = null; }
}

// ---------- evaluators: desirability (0..1) × characterBias (from the agent's loyalties) ----------
class Eval extends GoalEvaluator {
  constructor(kind, bias, score, plan, why) { super(1); this.kind = kind; this.biasF = bias; this.score = score; this.plan = plan; this.why = why; }
  calculateDesirability(o) {
    this.characterBias = this.biasF(o.w, o);
    const d = clamp(this.score(o), 0, 1.2);
    return d + (o.kind === this.kind && d > 0 ? 0.08 : 0); // a little stickiness avoids dithering
  }
  setGoal(o) {
    const brain = o.brain, cur = brain.currentSubgoal();
    if (cur && cur.kind === this.kind && !cur.completed() && !cur.failed()) return;
    const p = this.plan(o);
    if (!p) return;
    brain.clearSubgoals();
    brain.addSubgoal(new ActivityGoal(o, this.kind, p.site, p.hours, p.done));
    o.kind = this.kind;
    o.thought = this.why(o);
  }
}

function cashDays(h) { return h.cash / Math.max(1, h.members.length * S.P.essential * S.P.essentialIdx); }
function financialNeed(h) { return clamp(1 - cashDays(h) / 60, 0, 1); }
function siteOf(kind) { return S.sites.find(s => s.kind === kind); }
function pendingSiteInTown() {
  const a = S.assets.find(x => x.pending.length && x.site.x > TOWN.x0 - 2 && x.site.x < TOWN.x1 && x.site.y > TOWN.y0 - 2 && x.site.y < TOWN.y1);
  return a ? a.site : null;
}

const EVALS = {
  sleep: new Eval('sleep', () => 1,
    o => between(hourOf(), 22, 6) ? 0.85 + (1 - o.energy) * 0.3 : Math.pow(1 - o.energy, 2) * 0.9,
    o => ({ site: o.home.site, hours: between(hourOf(), 22, 6) ? ((6 - hourOf() + 24) % 24) + 0.25 : 1.5 }),
    o => between(hourOf(), 22, 6) ? 'Night. Home to sleep.' : 'Worn out. A nap first.'),
  work: new Eval('work', w => 0.35 + 0.9 * w.self + 0.9 * w.family,
    o => {
      if (o.age !== 'adult' || !o.job || !isWeekday() || !between(hourOf(), 7.5, 17) || o.workedToday >= 9) return 0;
      return (0.3 + financialNeed(o.home) * 0.55) * clamp(S.market.jobOpen, 0.08, 1) + o.purposeFromWork;
    },
    o => ({ site: o.job, hours: Math.max(1, Math.min(4, 17 - hourOf())) }),
    o => S.market.jobOpen < 0.6 ? `Hours at ${o.job.name} are scarce; robots cover most of it. Going anyway.` : financialNeed(o.home) > 0.5 ? `Savings are thin. Need the shift at ${o.job.name}.` : `Shift at ${o.job.name}.`),
  family: new Eval('family', w => 0.3 + 1.5 * w.family,
    o => (between(hourOf(), 17, 22) || !isWeekday()) && !between(hourOf(), 22, 7) ? 0.42 + (o.home.members.some(m => m.wellbeing < 0.4) ? 0.25 : 0) : 0.05,
    o => ({ site: o.home.site, hours: 2 }),
    o => o.home.members.some(m => m.wellbeing < 0.4) ? 'Someone at home is struggling. Heading back.' : 'Time with the family.'),
  social: new Eval('social', w => 0.35 + 0.6 * w.self + 0.6 * w.community,
    o => between(hourOf(), 7, 22) ? (1 - o.social) * 0.8 : 0,
    o => ({ site: pick([siteOf('plaza'), siteOf('cafe'), siteOf('park'), siteOf('diner')]), hours: 1.5 }),
    o => 'Feeling cooped up. Out to see people.'),
  volunteer: new Eval('volunteer', w => 0.12 + 1.7 * w.community,
    o => o.age === 'kid' || !between(hourOf(), 8, 20) ? 0 : 0.32 + (pendingSiteInTown() ? 0.15 : 0) + (1 - o.purpose) * 0.2,
    o => ({ site: pendingSiteInTown() || pick([siteOf('hall'), siteOf('learn'), siteOf('park')]), hours: 2.5 }),
    o => pendingSiteInTown() ? 'Helping raise the new build. It belongs to all of us.' : 'Volunteering at the commons.'),
  civic: new Eval('civic', w => 0.12 + 1.7 * w.nation,
    o => o.age === 'kid' || !between(hourOf(), 8, 18) ? 0 : 0.32 + (1 - o.purpose) * 0.2,
    o => ({ site: siteOf('station'), hours: 3 }),
    o => 'Off to the Federal Works office. The national research push needs hands.'),
  learn: new Eval('learn', w => 0.3 + 0.5 * w.self + 0.5 * w.family,
    o => o.age !== 'adult' || !between(hourOf(), 8, 20) ? 0 : (1 - o.skill) * S.P.autoFrac * 0.9 * (S.market.jobOpen < 0.8 ? 1.3 : 0.7),
    o => ({ site: siteOf('learn'), hours: 2 }),
    o => 'Robots keep taking more of the work. Retraining at the Learning Hub.'),
  pledge: new Eval('pledge', w => 0.1 + 1.6 * w.community,
    o => {
      const c = S.coops.find(x => x.open);
      if (!c || o.age !== 'adult' || o.home.isPlayer || !between(hourOf(), 8, 20) || (c.pledges[o.home.id] && c.pledges[o.home.id] > 0) || o.home.cash < householdBuffer(o.home) * 0.5) return 0;
      return 0.45 + 0.6 * o.trust;
    },
    o => ({ site: siteOf('hall'), hours: 0.75, done: a => { const c = S.coops.find(x => x.open); if (!c) return; const amt = pledge(a.home, c, Math.max(0, a.home.cash - householdBuffer(a.home) * 0.5) * (0.3 + a.w.community)); if (amt > 0) { log(`${a.name} pledged ${money(amt)} to the ${c.name}.`, 'coop'); a.thought = `Put ${money(amt)} into the co-op. I want a piece of it.`; } } }),
    o => `Going to pledge to the ${(S.coops.find(x => x.open) || {}).name}.`),
  council: new Eval('council', w => 0.5 + w.community + w.nation * 0.5,
    o => S.council && o.age !== 'kid' && S.day === S.council.day && between(hourOf(), 17.5, 21) ? 1.1 : 0,
    o => ({ site: siteOf('hall'), hours: Math.max(0.5, 21 - hourOf()) }),
    o => `Council meeting tonight: ${S.council.title}.`),
  propose: new Eval('propose', w => 0.1 + 1.6 * w.community,
    o => o.age === 'adult' && !o.home.isPlayer && !S.coops.some(c => c.open) && o.w.community > 0.4 && o.trust > 0.45 && S.day - (S.lastCoopDay || -999) > 45 && between(hourOf(), 9, 18) && o.home.cash > householdBuffer(o.home) ? 0.95 : 0,
    o => ({ site: siteOf('hall'), hours: 1, done: a => { if (S.coops.some(c => c.open)) return; const t = S.market.shortC > S.market.shortE ? 'compute' : rand() < 0.5 ? 'solar' : 'fleet'; openCoop(t, a.id, a.home.name); S.lastCoopDay = S.day; a.thought = 'Started a co-op drive myself. If we don\'t own it, Helix will.'; } }),
    o => 'If we don\'t build it together, Helix will. Going to start a co-op drive.'),
  school: new Eval('school', () => 1,
    o => o.age === 'kid' && isWeekday() && between(hourOf(), 8, 15) ? 0.95 : 0,
    o => ({ site: siteOf('school'), hours: Math.max(1, 15 - hourOf()) }),
    o => 'School.'),
  play: new Eval('play', () => 1,
    o => o.age === 'kid' && between(hourOf(), 8, 20) ? 0.3 + (1 - o.social) * 0.5 : 0,
    o => ({ site: pick([siteOf('park'), siteOf('plaza')]), hours: 1.5 }),
    o => 'Playing in the park.'),
};
const EVAL_ORDER = ['sleep', 'work', 'family', 'social', 'volunteer', 'civic', 'learn', 'pledge', 'council', 'propose', 'school', 'play'];

// Think, with arbitration opened up so the scores are visible and a Mind provider can override.
class AgentBrain extends Think {
  arbitrate() {
    const o = this.owner;
    const scored = this.evaluators.map(e => ({ e, kind: e.kind, d: e.calculateDesirability(o) * e.characterBias }));
    scored.sort((a, b) => b.d - a.d);
    o.scores = scored.slice(0, 4).map(s => ({ kind: s.kind, d: s.d }));
    const override = Mind.choose(o, scored.map(s => ({ kind: s.kind, d: s.d })));
    const chosen = (override && scored.find(s => s.kind === override)) || scored[0];
    if (chosen) chosen.e.setGoal(o);
    return this;
  }
}

let AGENT_ID = 0;
class Agent extends Vehicle {
  constructor(spec) {
    super();
    Object.assign(this, { id: 'p' + (++AGENT_ID), energy: rr(0.6, 1), social: rr(0.3, 0.8), purpose: rr(0.3, 0.7), wellbeing: 0.6, trust: rr(0.15, 0.4),
      workedToday: 0, paidHoursWeek: 0, activity: null, kind: null, thought: '', memory: [], purposeFromWork: 0, nextThink: rand() }, spec);
    setupMover(this, S.P.walkSpeed * (this.age === 'elder' ? 0.7 : this.age === 'kid' ? 1.1 : 1) * rr(0.9, 1.1));
    this.brain = new AgentBrain(this);
    const kinds = this.isPlayer ? ['sleep', 'work', 'family', 'social'] : EVAL_ORDER;
    kinds.forEach(k => this.brain.addEvaluator(EVALS[k]));
  }
  remember(text) { this.memory.unshift({ t: S.t, text }); if (this.memory.length > 8) this.memory.pop(); }
  tick(dt) {
    const a = this.activity;
    // needs drift
    if (a !== 'sleep') this.energy -= 0.035 * dt;
    this.social -= 0.014 * dt; this.purpose -= 0.007 * dt;
    if (a === 'sleep') this.energy += 0.13 * dt;
    else if (a === 'work') { this.workedToday += dt; this.energy -= 0.03 * dt; this.purpose += 0.025 * dt; }
    else if (a === 'family') { this.social += 0.07 * dt; this.energy += 0.02 * dt; }
    else if (a === 'social' || a === 'play') { this.social += 0.12 * dt; this.mingle(dt); }
    else if (a === 'volunteer') { this.purpose += 0.06 * dt; this.social += 0.04 * dt; S.volHours += dt; this.mingle(dt * 0.6); speedBuild(this.dest, dt); }
    else if (a === 'civic') { this.purpose += 0.06 * dt; S.nation.research += this.skill * 0.03 * dt; this.mingle(dt * 0.4); }
    else if (a === 'learn' || a === 'school') { this.skill += 0.004 * dt * (1 - this.skill); this.purpose += 0.02 * dt; }
    else if (a === 'council') { this.social += 0.05 * dt; this.mingle(dt * 0.8); }
    this.energy = clamp(this.energy, 0, 1); this.social = clamp(this.social, 0, 1); this.purpose = clamp(this.purpose, 0, 1);
    this.purposeFromWork = this.w.self * 0.05;

    // decisions: Yuka's Think runs every step; re-arbitrate about hourly unless locked into an order
    if (this.locked) {
      if (!this.brain.subgoals.length) this.locked = false;
    } else {
      this.nextThink -= dt;
      if (this.nextThink <= 0) { this.nextThink = 1; this.brain.arbitrate(); }
    }
    this.brain.execute();
    stepMover(this, dt);
  }
  // people who spend time together drift toward each other's loyalties (and opinion of you)
  mingle(dt) {
    if (rand() > dt) return;
    const others = S.people.filter(p => p !== this && p.activity && p.dest === this.dest && !p.isPlayer);
    if (!others.length) return;
    const o = pick(others);
    const k = 0.03;
    SPHERES.forEach(s => { const m = (this.w[s] + o.w[s]) / 2; this.w[s] = lerp(this.w[s], m, k); o.w[s] = lerp(o.w[s], m, k); });
    const tm = (this.trust + o.trust) / 2; this.trust = lerp(this.trust, tm, k); o.trust = lerp(o.trust, tm, k);
  }
  daily() {
    const h = this.home;
    const security = clamp(cashDays(h) / 30, 0, 1);
    const over = this.paidHoursWeek > 45 ? 0.12 : 0;
    this.wellbeing = lerp(this.wellbeing, clamp(0.3 * security + 0.2 * this.social + 0.2 * this.purpose + 0.15 * this.energy + 0.15 * (h.aiMet ?? 1) - over, 0, 1), 0.35);
  }
}

function speedBuild(site, dt) {
  if (!site || !site.assets) return;
  for (const a of site.assets) for (const p of a.pending) { p.done -= dt * 0.03; return; }
}

// ---------- robots: visible workers, simple loop between their depot and job sites ----------
class Robot extends Vehicle {
  constructor(fleet) { super(); this.isRobot = true; this.fleet = fleet; setupMover(this, S.P.walkSpeed * 1.2); const p = spotIn(fleet.site); this.position.set(p.x, p.y, 0); this.state = 'idle'; this.wait = rand() * 3; }
  tick(dt) {
    if (this.moving) { stepMover(this, dt); return; }
    this.wait -= dt;
    if (this.wait > 0) return;
    if (this.state !== 'out') {
      const s = pick(S.jobSites);
      startPath(this, route({ x: this.position.x, y: this.position.y }, s, spotIn(s)));
      this.state = 'out'; this.at = s; this.wait = rr(2, 6);
    } else {
      const s = this.fleet.site;
      startPath(this, route({ x: this.position.x, y: this.position.y }, s, spotIn(s)));
      this.state = 'home'; this.at = s; this.wait = rr(0.5, 2);
    }
  }
}
const MAX_ROBOT_DOTS = 160;
function syncRobots() {
  const fleets = S.assets.filter(a => a.type === 'fleet' && a.cap > 0);
  const total = sum(fleets, f => f.cap);
  const show = Math.min(MAX_ROBOT_DOTS, Math.round(total));
  for (const f of fleets) {
    const want = total > 0 ? Math.round(show * f.cap / total) : 0;
    const have = S.robots.filter(r => r.fleet === f);
    for (let i = have.length; i < want; i++) S.robots.push(new Robot(f));
    if (have.length > want) { const drop = new Set(have.slice(want)); S.robots = S.robots.filter(r => !drop.has(r)); }
  }
  S.robots = S.robots.filter(r => fleets.includes(r.fleet));
}
