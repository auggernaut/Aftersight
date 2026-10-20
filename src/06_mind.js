// The Mind seam: where a local language model (e.g. Muse's Glimmer) can plug in later.
//
// Today every decision comes from Yuka's Think (goal evaluators weighted by each agent's
// self / family / community / nation loyalties), and speech comes from templates below.
// A provider may implement any of:
//   choose(agent, scored, snapshot) -> kind | null   pick a different top-level goal from the scored list
//   say(agent, topic, ctx)          -> string | null  a line of dialogue
// Providers must answer synchronously from a cache; if a model is slow, run it in the
// background (worker / fetch to a local server), store its latest answer, and return
// null until one is ready. The simulation never waits on a model.
const SIM = { dt: 0 };
const Mind = {
  provider: null,
  use(p) { this.provider = p; },
  choose(agent, scored) {
    if (!this.provider || !this.provider.choose) return null;
    try { return this.provider.choose(agent, scored, snapshot(agent)); } catch (e) { return null; }
  },
  say(agent, topic, ctx = {}) {
    let line = null;
    if (this.provider && this.provider.say) { try { line = this.provider.say(agent, topic, ctx, snapshot(agent)); } catch (e) { line = null; } }
    return line || templateSay(agent, topic, ctx);
  },
};

// Plain-data view of an agent and its world, the same shape a model prompt would get.
function snapshot(a) {
  const h = a.home;
  return {
    name: a.name, age: a.age, loyalties: { ...a.w }, skill: a.skill, trustInPlayer: a.trust,
    needs: { energy: a.energy, social: a.social, purpose: a.purpose, wellbeing: a.wellbeing },
    household: { name: h.name, cash: h.cash, members: h.members.map(m => m.name), stakes: holdingsOf(h.id).map(x => ({ asset: x.a.name, share: x.share })) },
    job: a.job ? a.job.name : null, current: a.kind, memory: a.memory.map(m => m.text),
    world: { day: S.day, energyShort: S.market.shortE, computeShort: S.market.shortC, jobOpenness: S.market.jobOpen, outsideOwned: metrics().outside, lastDiscovery: S.discoveries.length ? S.discoveries[S.discoveries.length - 1].title : null },
  };
}

function holdingsOf(ownerId) {
  return S.assets.filter(a => (a.shares[ownerId] || 0) > 0.0005).map(a => ({ a, share: a.shares[ownerId], value: a.shares[ownerId] * assetValue(a) }));
}

function templateSay(a, topic, ctx) {
  const d = dominant(a.w);
  if (topic === 'persuade') {
    const moved = ctx.moved > 0.03;
    const lines = {
      community: moved ? ['Own it together, yeah. Helix will never cut us in on their racks.', 'If the whole street put in a little, we\'d own the thing that replaces our jobs.'] : ['I hear you. I just don\'t have money to spare.', 'Maybe. Show me a co-op that actually pays.'],
      nation: moved ? ['You\'re right, this is bigger than one valley.', 'If the country gets there first, we all do.'] : ['The capital never did anything for us.', 'I\'ll think about it.'],
      family: moved ? ['My kids come first. That\'s what I keep coming back to.', 'Fine. Look after our own, then.'] : ['We\'re fine. Others need it more.', 'Hm.'],
      self: moved ? ['Fair. Nobody else is going to look after me.', 'Get yours while you can, right?'] : ['That\'s not how I want to live.', 'No.'],
    };
    return pick(lines[ctx.topic] || lines.community);
  }
  if (topic === 'greet') {
    return { self: 'Busy. What do you need?', family: 'Can\'t stay long, the kids are waiting.', community: 'Good to see you. Did you hear about the co-op?', nation: 'Big news from the capital again.' }[d];
  }
  return '…';
}
