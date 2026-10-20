// The player's actions. Each one walks your character somewhere, then changes the world.
function order(label, site, hours, done, target) {
  const you = S.player;
  you.brain.clearSubgoals();
  you.brain.addSubgoal(new ActivityGoal(you, 'order', site, hours, a => { done(a); a.locked = false; }, target));
  you.locked = true; you.kind = 'order';
  you.thought = label;
  return true;
}
function markAction(text) { S.actions.push({ day: S.day, text }); log('YOU: ' + text, 'you'); }
function youHH() { return S.player.home; }

const ACTIONS = {
  propose(type) {
    if (S.coops.some(c => c.open)) return 'A co-op drive is already open.';
    order(`Walking to the Town Hall to propose a ${ASSET_LABEL[type]} co-op.`, siteOf('hall'), 1, () => {
      const c = openCoop(type, 'you', 'Valley');
      S.lastCoopDay = S.day;
      markAction(`Proposed the ${c.name}`);
      // proposing in public nudges the people in the room toward community
      S.people.filter(p => p.dest === siteOf('hall') && !p.isPlayer).forEach(p => { p.w.community += 0.04; normalize(p.w); p.trust = clamp(p.trust + 0.04, 0, 1); });
    });
    return null;
  },
  persuade(agentId, topic) {
    const t = S.people.find(p => p.id === agentId);
    if (!t || t.isPlayer) return 'Pick a resident first.';
    order(`Going to talk to ${t.first} about ${topic === 'community' ? 'owning it together' : topic === 'nation' ? 'the national push' : 'looking after family'}.`, t.dest || null, 1, () => {
      const before = t.w[topic];
      const moved = 0.04 + 0.14 * t.trust * (t.w[topic] < 0.5 ? 1 : 0.4);
      t.w[topic] += moved; normalize(t.w);
      t.trust = clamp(t.trust + 0.07, 0, 1);
      if (topic === 'community') t.advocate = S.day + 45; // they'll carry the argument to the people they meet
      const gained = t.w[topic] - before;
      const line = Mind.say(t, 'persuade', { topic, moved: gained });
      t.remember(`You talked to me about ${topic}. ${line}`);
      t.thought = line;
      // ripple: their household hears about it over dinner
      t.home.members.filter(m => m !== t).forEach(m => { m.w[topic] += moved * 0.35; normalize(m.w); m.trust = clamp(m.trust + 0.02, 0, 1); });
      t.locked = true; t.brain.clearSubgoals(); t.brain.addSubgoal(new ActivityGoal(t, 'listen', null, 0.75, a => { a.locked = false; }));
      markAction(`Talked ${t.first} toward ${topic} (+${Math.round(gained * 100)} pts): "${line}"`);
      if (typeof onSpeech === 'function') onSpeech(t, line);
    }, { x: t.position.x + 0.6, y: t.position.y });
    return null;
  },
  invest(where, amount) {
    const h = youHH();
    amount = Math.min(amount, Math.max(0, h.cash));
    if (amount < 100) return 'Not enough cash.';
    if (where === 'coop' && !S.coops.some(c => c.open)) return 'No co-op drive is open.';
    order(`Walking to the Town Hall to invest ${money(amount)}.`, siteOf('hall'), 0.75, () => {
      if (where === 'coop') { const c = S.coops.find(x => x.open); if (c) { const got = pledge(h, c, amount); markAction(`Put ${money(got)} into the ${c.name}`); S.people.forEach(p => { if (p.w.community > 0.3) p.trust = clamp(p.trust + 0.01, 0, 1); }); } }
      else if (where === 'commons') { h.cash -= amount; S.town.cash += amount; markAction(`Gave ${money(amount)} to the town commons fund`); }
      else if (where === 'buyout') {
        const a = S.assets.filter(x => (x.shares.helix || 0) > 0.01 && x.cap > 0).sort((x, y) => annualReturn(y.type) - annualReturn(x.type))[0];
        if (!a) return;
        const got = transferShare(a, 'helix', h.id, amount / assetValue(a));
        const price = got * assetValue(a);
        h.cash -= price; S.helix.cash += price;
        markAction(`Bought ${pct(got)} of ${a.name} from Helix for ${money(price)}`);
      }
    });
    return null;
  },
  share(agentId) {
    const t = S.people.find(p => p.id === agentId);
    if (!t || t.isPlayer) return 'Pick a resident first.';
    const mine = holdingsOf(youHH().id).sort((a, b) => b.value - a.value)[0];
    if (!mine) return 'You don\'t own a stake in anything yet. Invest or build first.';
    order(`Walking to the ${t.home.name} home to share half your ${mine.a.name} stake.`, t.home.site, 0.5, () => {
      const f = transferShare(mine.a, youHH().id, t.home.id, mine.share / 2);
      t.home.members.forEach(m => { m.trust = clamp(m.trust + 0.15, 0, 1); m.w.community += 0.05; normalize(m.w); m.remember(`You gave our family part of ${mine.a.name}.`); });
      markAction(`Gave the ${t.home.name} household ${pct(f)} of ${mine.a.name}`);
    });
    return null;
  },
  build(kind) {
    const h = youHH();
    if (kind === 'rooftop') {
      const cost = 0.04 * S.P.solarCost;
      if (h.cash < cost) return `Rooftop solar costs ${money(cost)}.`;
      order('Putting panels on your roof.', h.site, 3, () => {
        h.cash -= cost;
        let a = S.assets.find(x => x.site === h.site && x.type === 'solar');
        if (!a) { a = placeAsset('solar', 'Your rooftop', h.id, 0.04, { site: h.site, immediate: true }); a.rooftop = true; }
        else addShares(a, h.id, 0.04);
        if (h.house && !h.house.roof) { h.house.roof = true; S.bakeVersion++; }
        markAction(`Built ${money(cost)} of rooftop solar`);
      });
    } else if (kind === 'robot') {
      const cost = S.P.robotCost;
      if (h.cash < cost) return `A robot costs ${money(cost)}.`;
      order('Ordering a robot at Okafor Fabrication.', S.sites.find(s => s.name === 'Okafor Manufacturing'), 1, () => {
        h.cash -= cost;
        let fleet = S.assets.find(x => x.type === 'fleet' && x.yours);
        if (!fleet) { fleet = placeAsset('fleet', 'Your Robot Bay', h.id, 0, { immediate: true }); if (fleet) fleet.yours = true; }
        if (fleet) orderRobots(h.id, 1, fleet);
        markAction(`Ordered a robot (${money(cost)}). It joins the queue at the factory.`);
      });
    }
    return null;
  },
  council(motion) {
    if (S.council) return 'A council meeting is already scheduled.';
    const titles = { buyback: 'Town buys out Helix\'s in-town stakes', refusal: 'Local right of first refusal on share and land sales', dividend: 'Raise the commons dividend tax', zoning: 'Community-first zoning: vacant lots go to co-ops and the town first' };
    order('Filing a motion at the Town Hall.', siteOf('hall'), 0.5, () => {
      S.council = { day: S.day + 2, motion, title: titles[motion] };
      markAction(`Filed a council motion: ${titles[motion]} (vote in 2 days, 18:00)`);
    });
    return null;
  },
};

function resolveCouncil() {
  const c = S.council; S.council = null;
  const voters = S.people.filter(p => p.age !== 'kid' && !p.isPlayer);
  let yes = 0, no = 0;
  for (const v of voters) {
    let s = 0.2 + 0.7 * v.w.community + 0.35 * v.trust - 0.45 * v.w.self + (c.motion === 'dividend' ? 0.3 * financialNeed(v.home) : 0) + (c.motion === 'buyback' ? 0.2 * v.w.nation : 0) + (c.motion === 'zoning' ? 0.15 * v.w.family - 0.1 : 0);
    const attended = v.kind === 'council';
    if (rand() < clamp(s, 0.02, 0.98)) yes += attended ? 1.5 : 1; else no += attended ? 1.5 : 1;
  }
  const pass = yes > no;
  log(`Council vote on "${c.title}": ${pass ? 'PASSED' : 'FAILED'} (${Math.round(yes)}–${Math.round(no)}).`, pass ? 'town' : 'helix');
  S.actions.push({ day: S.day, text: `Vote ${pass ? 'passed' : 'failed'}: ${c.title}` });
  if (!pass) { voters.forEach(v => { v.trust = clamp(v.trust - 0.02, 0, 1); }); return; }
  if (c.motion === 'buyback') {
    const targets = S.assets.filter(a => (a.shares.helix || 0) > 0 && a.cap > 0 && inTown(a.site.cx, a.site.cy));
    let spent = 0;
    for (const a of targets) { const v = assetValue(a) * a.shares.helix * 1.1; transferShare(a, 'helix', 'town', a.shares.helix); spent += v; }
    S.town.cash -= spent; S.helix.cash += spent;
    log(`The town bought out Helix's in-town stakes for ${money(spent)}, financed with a commons bond.`, 'town');
  } else if (c.motion === 'refusal') { S.policy.firstRefusal = true; S.town.cash += 0; }
  else if (c.motion === 'zoning') { S.policy.zoning = true; log('Community-first zoning is law: outside capital can no longer buy vacant lots in town.', 'town'); }
  else if (c.motion === 'dividend') { S.P.tax = Math.min(0.25, S.P.tax + 0.06); S.P.propTax = Math.min(0.3, S.P.propTax + 0.1); }
  voters.forEach(v => { v.trust = clamp(v.trust + 0.03, 0, 1); });
}
