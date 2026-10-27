// AfterSight Festus balance check (headless). Run `npm run build` first. Plays N games per offer strategy
// (negotiate, firm = counter then take a firm offer, yes = accept everything, no = reject everything), all with the
// same decent city management, at full speed, and prints win rates, the gaps between decision cards, and where each
// town ends up in April 2032: unemployment, Purpose, ownership's share of household income, the dividend and the path.
//   NODE_PATH=/path/to/playwright/node_modules N=30 node e2e/balance.cjs
// Every strategy builds one Research Lab early, invests in breakthroughs when funds are over $2,500, funds projects
// when it can afford them, says yes to affordable town hall asks (cards and ticker asks alike), and builds a
// town-owned data center whenever voters have backed a co-op bond and there's money and power for it. The game
// keeps going after a loss (as a private citizen) so every town is measured in April 2032.
const { chromium } = require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const DIST=path.join(__dirname,'..','dist');
const srv=http.createServer((q,r)=>{const p=path.join(DIST,q.url.split('?')[0].replace(/\/$/,'/index.html'));if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});fs.createReadStream(p).pipe(r);}).listen(0);
const N=+(process.env.N||6), STRATS=(process.env.STRATS||'negotiate,firm,yes,no').split(',');
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s.length?s[s.length>>1]:0;};
(async()=>{const b=await chromium.launch(); const summary={};
for (const strat of STRATS) for (let run=0; run<N; run++) {
const page=await b.newPage({viewport:{width:1000,height:700}});const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
await page.goto('http://localhost:'+srv.address().port+'/index.html');await page.click('#splashFestus');await page.click('#playit');
await page.waitForFunction(()=>window.__AL,null,{timeout:90000});
const out = await page.evaluate(async strat => {
  const g=__AL.game, L=__AL.layer; g.alNoPaper=true; ['Town','City','Capital','Metropolis','Megalopolis'].forEach(k=>g['_reached'+k]=true);
  const cards=[], rows=[];
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
    cards.push(m.mi+' '+card.type+(card.quick?'(ticker)':'')+':'+card.title.slice(0,34)+' -> '+pick);
    L.decide(pick, asks);
  };
  if (L.s.card) L.autoDecide(L.s.card);
  // a free 3x3 plot by the grid, away from the campus parcels (anything built there would be in the halls' way)
  const plot = () => { for (let k=0;k<40;k++) { const s=__AL.findSite(); if (!s) return null; if (!(s.x>=33&&s.x<=55&&s.y>=25&&s.y<=63)) return s; } return null; };
  // every strategy builds one Research Lab early, when it can spare the money (breakthroughs need one)
  const buildLab = () => { if (L.labsOn() || L._labTried || __AL.funds() < 1500 + 2500) return; const s=plot(); if (s) { L._labTried = __AL.build('lab', s.x+1, s.y+1); } };
  // and a town-owned hall whenever the voters have backed a bond and there's money and power for it
  const buildCoop = () => { if (!L.isUnlocked('dcCoop') || __AL.funds() < 4000 + 2500 || g.simulation._powerManager.lastShort) return; const s=plot(); if (s) __AL.build('dcCoop', s.x+1, s.y+1); };
  let result='timeout', end=null;
  for (let i=0;i<84;i++){ buildLab(); buildCoop(); __AL.fastForward(1); const m=__AL.mayor(), s=L.s;
    if (i%6===0) rows.push([m.mi, Math.round(m.approval), Object.values(m.factions).map(f=>Math.round(f.v)).join('/'), __AL.funds(), g.simulation.evaluation.cityPop, m.halls, Math.round(m.townShare*100)+'%', m.dev.status, 'u'+s.unemployment.toFixed(2), 'a'+s.automation.toFixed(2), 'tier'+(s.deal?L._dealTier():'-'), s.deal?(s.deal.cooling+'/'+s.deal.power):'', 'w'+Math.round(100*s.water.use/s.water.cap), 'p'+Math.round(s.purpose), 'own'+Math.round(L.incomeMix().ownShare*100)+'%', 'div$'+(s.dividendPerRes||0), s.path, Object.keys(s.projects||{}).join('+')].join(' '));
    if (m.gameOver && !s.mayor.sandbox && result==='timeout') { result='LOST '+m.gameOver.year+' '+m.gameOver.vote; s.mayor.sandbox=true; }
    if (m.won && result==='timeout') result='WON '+m.won.year+' '+m.won.vote+' share'+m.won.share;
    if (m.mi===75) { const mix=L.incomeMix(); end={unemp:s.unemployment, purpose:s.purpose, own:mix.ownShare, div:s.dividendPerRes||0, path:s.path, slump:!!s.slump}; }
    if (m.mi>=75) break; }
  result += L.s.deal ? ' '+L.s.deal.cooling+'/'+L.s.deal.power : ' nodeal';
  return {cards, rows, result, end, last: __AL.mayor().mi};
}, strat);
(summary[strat]=summary[strat]||[]).push(out);
const months=out.cards.map(c=>+c.split(' ')[0]); const gaps=months.slice(2).map((v,i)=>v-months[i+1]);
console.log(strat.padEnd(10), out.result.padEnd(28), 'cards', out.cards.length, 'maxgap', Math.max(...gaps,0), out.end?('path '+out.end.path+' own '+Math.round(out.end.own*100)+'% purpose '+Math.round(out.end.purpose)):'', errs.length?'ERRS '+errs[0]:'');
if (process.env.VERBOSE) { console.log(' '+out.cards.join('\n ')); console.log(' '+out.rows.join('\n ')); }
await page.close(); }
console.log('---- win rates');
const all=[]; for (const s in summary) { const w=summary[s].filter(o=>/WON/.test(o.result)).length; console.log(s.padEnd(10), w+'/'+summary[s].length);
  summary[s].forEach(o=>{const m=o.cards.filter(c=>!/\(ticker\)/.test(c)).map(c=>+c.split(' ')[0]); for(let i=2;i<m.length;i++) all.push(m[i]-m[i-1]);}); }
all.sort((a,b)=>a-b); console.log('card gaps (months, ticker asks excluded): n', all.length, 'median', all[all.length>>1], 'mean', (all.reduce((a,b)=>a+b,0)/Math.max(1,all.length)).toFixed(1), 'max', all[all.length-1]);
console.log('---- where the towns are in April 2032 (medians; paths are counts)');
for (const s in summary) { const e=summary[s].map(o=>o.end).filter(Boolean); const paths={}; e.forEach(x=>paths[x.path]=(paths[x.path]||0)+1);
  console.log(s.padEnd(10), 'unemployment', Math.round(med(e.map(x=>x.unemp))*100)+'%', 'Purpose', Math.round(med(e.map(x=>x.purpose))), 'ownership', Math.round(med(e.map(x=>x.own))*100)+'% of income',
              'dividend $'+med(e.map(x=>x.div)), 'slump', e.filter(x=>x.slump).length+'/'+e.length, JSON.stringify(paths)); }
await b.close();srv.close();})();
