// AfterSight Festus balance check (headless). Run `npm run build` first. Plays N games per offer strategy
// (negotiate, firm = counter then take a firm offer, yes = accept everything, no = reject everything), all with the
// same decent city management, at full speed, and prints win rates and the gaps between decision cards.
//   NODE_PATH=/path/to/playwright/node_modules N=10 node e2e/balance.cjs
// Headless Festus balance: N runs per offer strategy, all with the same decent city management
const { chromium } = require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const DIST=path.join(__dirname,'..','dist');
const srv=http.createServer((q,r)=>{const p=path.join(DIST,q.url.split('?')[0].replace(/\/$/,'/index.html'));if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});fs.createReadStream(p).pipe(r);}).listen(0);
const N=+(process.env.N||6), STRATS=(process.env.STRATS||'negotiate,firm,yes,no').split(',');
(async()=>{const b=await chromium.launch(); const summary={};
for (const strat of STRATS) for (let run=0; run<N; run++) {
const page=await b.newPage({viewport:{width:1000,height:700}});const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://localhost:'+srv.address().port+'/index.html');await page.click('#splashFestus');await page.click('#playit');
await page.waitForFunction(()=>window.__AL,null,{timeout:90000});
const out = await page.evaluate(async strat => {
  const g=__AL.game, L=__AL.layer; g.alNoPaper=true; ['Town','City','Capital','Metropolis','Megalopolis'].forEach(k=>g['_reached'+k]=true);
  const cards=[], rows=[], approvals=[];
  L.autoDecide = card => {
    const m=__AL.mayor(); const o=card.options.filter(x=>!x.disabled); const has=id=>o.find(x=>x.id===id); let pick, asks=[];
    if (card.type==='intro') pick='go';
    else if (card.type==='offer') {
      const tier = m.dev.offer ? m.dev.offer.tier : 0, firm=/Take it or leave/.test(card.title);
      if (strat==='yes') pick='accept';
      else if (strat==='no') pick='reject';
      // the negotiator holds out for closed-loop cooling and clean power, and takes a good firm offer rather than lose it
      else if (strat==='negotiate') { const t=m.dev.offer?m.dev.offer.terms:{}, green=t.cooling==='closed'&&t.power==='clean';
        pick = firm ? (tier>=2 ? 'accept' : 'reject') : tier>=2 && (green || !(card.asks||[]).some(a=>a.design)) ? 'accept' : 'counter'; }
      else pick = (tier>=2 || firm) ? 'accept' : 'counter';
      // design: the negotiator always demands closed-loop cooling (then clean power); the firm player asks for closed-loop once.
      // yes and no take whatever design is on the table.
      if (pick==='counter') { const ids=(card.asks||[]).map(a=>a.id), money=ids.filter(id=>!['cooling','clean','gas'].includes(id));
        const want = strat==='negotiate' ? ['cooling','clean'].filter(id=>ids.includes(id)).slice(0, tier>=2 ? 2 : 1) : strat==='firm' && m.dev.counters===0 ? ['cooling'] : [];
        asks = want.filter(id=>ids.includes(id)).concat(money).slice(0,2); }
      if (!has(pick)) pick=o[0].id;
    } else if (card.type==='research') pick = has('invest') && __AL.funds() > 2500 ? 'invest' : 'pass';
    else if (card.type==='campaign') pick = has('tour') ? 'tour' : 'freeze';
    // town projects: neighbors + robots when there's room in the budget, robots when it's tight
    else if (card.type==='project') { const f=__AL.funds(), n=has('neighbors'), r=has('robots');
      pick = n && f > n.cost + 2500 ? 'neighbors' : r && f > r.cost + 1500 ? 'robots' : 'later'; }
    else pick = has('yes') && (__AL.funds() > 1500 || !/\$/.test(has('yes').label)) ? 'yes' : (o.find(x=>x.id!=='yes')||o[0]).id;
    cards.push(m.mi+' '+card.type+':'+card.title.slice(0,34)+' -> '+pick);
    L.decide(pick, asks);
  };
  if (L.s.card) L.autoDecide(L.s.card);
  // every strategy builds one Research Lab early, when it can spare the money (breakthroughs need one)
  const buildLab = () => { if (L.labsOn() || L._labTried || __AL.funds() < 1500 + 2500) return; const s=__AL.findSite(); if (s) { L._labTried = __AL.build('lab', s.x+1, s.y+1); } };
  let result='timeout';
  for (let i=0;i<84;i++){ buildLab(); __AL.fastForward(1); const m=__AL.mayor(); approvals.push(Math.round(m.approval));
    if (i%6===0) rows.push([m.mi, Math.round(m.approval), Object.values(m.factions).map(f=>Math.round(f.v)).join('/'), __AL.funds(), g.simulation.evaluation.cityPop, m.halls, Math.round(m.townShare*100)+'%', m.dev.status, 'u'+__AL.state().unemployment.toFixed(2), 'a'+__AL.state().automation.toFixed(2), 'tier'+(L.s.deal?L._dealTier():'-'), L.s.deal?(L.s.deal.cooling+'/'+L.s.deal.power):'', 'w'+Math.round(100*L.s.water.use/L.s.water.cap), 'p'+Math.round(L.s.purpose), 'lab'+L.labsOn(), 'fund'+Math.round(L.s.fund||0), 'div$'+(L.s.dividendPerRes||0), 'nw$'+(L.s.netWorth||0), Object.keys(L.s.projects||{}).join('+')].join(' '));
    if (m.gameOver && !m.sandbox) { result='LOST '+m.gameOver.year+' '+m.gameOver.vote; break; }
    if (m.won) { result='WON '+m.won.year+' '+m.won.vote+' share'+m.won.share; break; } }
  result += L.s.deal ? ' '+L.s.deal.cooling+'/'+L.s.deal.power : ' nodeal';
  return {cards, rows, result, last: __AL.mayor().mi};
}, strat);
(summary[strat]=summary[strat]||[]).push(out);
const months=out.cards.map(c=>+c.split(' ')[0]); const gaps=months.slice(2).map((v,i)=>v-months[i+1]);
console.log(strat.padEnd(10), out.result.padEnd(28), 'cards', out.cards.length, 'maxgap', Math.max(...gaps,0), errs.length?'ERRS '+errs[0]:'');
if (process.env.VERBOSE) { console.log(' '+out.cards.join('\n ')); console.log(' '+out.rows.join('\n ')); }
await page.close(); }
console.log('---- win rates');
const all=[]; for (const s in summary) { const w=summary[s].filter(o=>/WON/.test(o.result)).length; console.log(s.padEnd(10), w+'/'+summary[s].length);
  summary[s].forEach(o=>{const m=o.cards.map(c=>+c.split(' ')[0]); for(let i=2;i<m.length;i++) all.push(m[i]-m[i-1]);}); }
all.sort((a,b)=>a-b); console.log('card gaps (months): n', all.length, 'median', all[all.length>>1], 'mean', (all.reduce((a,b)=>a+b,0)/all.length).toFixed(1), 'max', all[all.length-1]);
await b.close();srv.close();})();
