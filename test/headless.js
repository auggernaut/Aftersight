// Runs the simulation core in Node (no browser) for balance checks: node test/headless.js [years] [seed]
global.YUKA = require(require('path').join(__dirname, '../vendor/yuka.min.js'));
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f < '09').sort();
const code = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + '\n;return { newWorld, simStep, metrics, ACTIONS, get S() { return S; } };';
const api = new Function(code)();
const years = +(process.argv[2] || 3), seed = +(process.argv[3] || 7);
const S = api.newWorld(seed);
const t0 = Date.now();
const days = years * 360;
const MOTIONS = ['refusal', 'zoning', 'dividend', 'buyback'].filter(m => m !== 'zoning' || /zoning/.test(api.ACTIONS.council.toString() + (typeof S.policy.zoning)));
for (let d = 0; d < days; d++) {
  for (let i = 0; i < 48; i++) api.simStep(0.5);
  if (process.env.STRAT === 'coop' && d % 4 === 1) {
    const ppl = S.people.filter(p => !p.isPlayer && p.age !== 'kid');
    const r = d % 16;
    if (r === 1) api.ACTIONS.persuade(ppl[(d / 4) % ppl.length | 0].id, 'community');
    else if (r === 5) api.ACTIONS.propose(['solar', 'compute', 'fleet'][(d / 16 | 0) % 3]);
    else if (r === 9) api.ACTIONS.invest(S.coops.some(c => c.open) ? 'coop' : 'commons', S.player.home.cash * 0.5);
    else if (r === 13 && S.day % 90 < 16 && !S.council) api.ACTIONS.council(MOTIONS[(S.day / 90 | 0) % MOTIONS.length]); // about one vote a quarter
  }
  if (d % 60 === 59) {
    const m = api.metrics(), M = S.market;
    console.log(`d${S.day} outside ${(m.outside * 100).toFixed(0)}% gini ${m.gini.toFixed(2)} work ${m.work.toFixed(1)}h E ${M.solarOut.toFixed(1)}/${M.dE.toFixed(1)} short ${(M.shortE * 100).toFixed(0)}% C ${M.sC.toFixed(0)}/${(M.dCL).toFixed(0)}+${M.dCX.toFixed(0)} shortC ${(M.shortC * 100).toFixed(0)}% robots ${M.nRobots.toFixed(0)} jobOpen ${M.jobOpen.toFixed(2)} pe ${M.pe.toFixed(0)} pc ${M.pc.toFixed(0)} ubi ${M.ubi.toFixed(0)} town ${Math.round(S.town.cash)} wb ${(S.history[S.history.length-1].wellbeing).toFixed(2)} hhcash ${Math.round(S.households.reduce((s,h)=>s+h.cash,0)/S.households.length)} assets ${S.assets.length} coops ${S.coops.length}`);
  }
}
console.log('coops', S.coops.map(c => c.name + ' ' + Math.round(c.raised) + '/' + Math.round(c.target) + (c.open ? ' open' : '')).join(' | '));
console.log('player cash', Math.round(S.player.home.cash), 'avg trust', (S.people.reduce((s,p)=>s+p.trust,0)/S.people.length).toFixed(2), 'avg community', (S.people.reduce((s,p)=>s+p.w.community,0)/S.people.length).toFixed(2));
const uses = {}; S.lots.forEach(l => uses[l.use] = (uses[l.use] || 0) + 1); console.log('lot uses', JSON.stringify(uses));
const own = {}; S.lots.forEach(l => { const k = /^h\d+$/.test(l.owner) ? 'household' : l.owner; own[k] = (own[k] || 0) + 1; }); console.log('lot owners', JSON.stringify(own));
console.log('discoveries', S.discoveries.map(d => d.day + ':' + d.id).join(' '));
console.log('log tail'); S.log.slice(0, 25).forEach(l => console.log('  ', Math.floor(l.t / 24), l.text));
const kinds = {}; S.people.forEach(p => kinds[p.kind] = (kinds[p.kind] || 0) + 1); console.log('kinds now', kinds);
console.log('elapsed', Date.now() - t0, 'ms');
