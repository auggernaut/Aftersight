const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const DIST=path.join(__dirname,'..','dist');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((q,r)=>{const p=path.join(DIST,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(0);
(async()=>{const b=await chromium.launch();const page=await b.newPage({viewport:{width:1400,height:900}});
await page.goto(process.env.BASE_URL||('http://localhost:'+srv.address().port+'/index.html'));await page.click('#splashFestus');
await page.waitForFunction(()=>window.__AL,null,{timeout:90000});
await page.evaluate(()=>{const g=__AL.game,L=__AL.layer;['Town','City','Capital','Metropolis','Megalopolis'].forEach(k=>g['_reached'+k]=true);g.alNoPaper=true;
 L.autoDecide=c=>L.decide(c.options.filter(x=>!x.disabled)[0].id); if(L.s.card) L.autoDecide(L.s.card); if(g._openWindow==='alCard') g.alCards.close(); L.s.card=null;});
console.log('default speed', await page.evaluate(()=>__AL.game.defaultSpeed));
for (const sp of [1,2,3]) {
  await page.evaluate(sp=>__AL.game.alUI.setSpeed(sp), sp);
  const t=await page.evaluate(async ()=>{const sim=__AL.game.simulation; const t0=sim._cityTime, s0=performance.now(); await new Promise(r=>setTimeout(r, 15000)); return {ticks: sim._cityTime-t0, ms: performance.now()-s0};});
  console.log('speed', sp, 'sec/month', (t.ms/1000/(t.ticks/4)).toFixed(1), JSON.stringify(t));
}
await b.close();srv.close();})();
