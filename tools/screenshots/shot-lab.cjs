// Research Lab + split build menu screenshots and a logic probe. BASE_URL optional
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const DIST=process.env.DIST||require('path').join(__dirname,'..','..','dist'), OUT=process.env.OUT||'shots', P=process.env.PREFIX||'lab';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const p=path.join(DIST,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(0);
(async()=>{fs.mkdirSync(OUT,{recursive:true});const b=await chromium.launch();
for (const [tag,vp,touch] of [['desktop',{width:1400,height:900},false],['mobile',{width:390,height:844},true]]) {
const page=await b.newPage({viewport:vp, hasTouch:touch, isMobile:touch}); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto(process.env.BASE_URL||('http://localhost:'+srv.address().port+'/index.html'));
await page.click('#splashFestus');await page.click('#playit');
await page.waitForFunction(()=>window.__AL,null,{timeout:90000});
const before=await page.evaluate(()=>{const g=__AL.game,L=__AL.layer;['Town','City','Capital','Metropolis','Megalopolis'].forEach(k=>g['_reached'+k]=true);
  g.alNoPaper=true; const types=[]; L.autoDecide=c=>{types.push(L.mi()+':'+c.type); const o=c.options.filter(x=>!x.disabled); const pick=o.find(x=>x.id==='accept')||o.find(x=>x.id==='invest')||o[o.length-1]; L.decide(pick.id);};
  if (L.s.card) L.autoDecide(L.s.card); __AL.fastForward(12);
  return {types, hint: L.s.log.some(e=>/Research Lab/.test(e.text)), labs: L.labsOn(), clock: L.s.research.clock};});
console.log(tag,'no lab, 12 months:', JSON.stringify(before));
// build a lab next to the grid, then look for a breakthrough
const site=await page.evaluate(()=>{const s=__AL.findSite(); const f0=__AL.funds(); const r=__AL.build('lab', s.x+1, s.y+1); return {s, r, cost: f0-__AL.funds()};});
console.log(tag,'built lab', JSON.stringify(site));
const after=await page.evaluate(()=>{const L=__AL.layer; const types=[]; L.autoDecide=c=>{types.push(L.mi()+':'+c.type+':'+c.title); const o=c.options.filter(x=>!x.disabled); L.decide((o.find(x=>x.id==='invest')||o[o.length-1]).id);};
  let first=null; for (let i=0;i<14;i++){__AL.fastForward(1); if(!first && types.some(t=>/research/.test(t))) first=i+1;}
  return {labs:L.labsOn(), bill:L.s.labBill, clock:+L.s.research.clock.toFixed(1), speed:+L.labSpeed().toFixed(2), firstBreakthroughAfter: first, types};});
console.log(tag,'with lab:', JSON.stringify(after));
await page.evaluate(()=>{const g=__AL.game,L=__AL.layer; L.autoDecide=null; if(L.s.card){L.s.card=null;} if(g._openWindow==='alCard') g.alCards.close(); g.alNoPaper=false; g.alPanel.refresh(true);});
await page.evaluate(s=>{const g=__AL.game.gameCanvas; g.setZoomNow(3); g.centreOn(s.x+1,s.y+1);}, site.s);
await page.waitForTimeout(1200);
for (let i=0;i<5 && await page.isVisible('#alPaper');i++){await page.click('#alPaperOK');await page.waitForTimeout(150);}
if (await page.isVisible('#alAlert')) await page.keyboard.press('Escape');
await page.screenshot({path:`${OUT}/${P}-${tag}.png`});
const menu=await page.$('#controls'); if (menu) await menu.screenshot({path:`${OUT}/${P}-${tag}-menu.png`});
if (touch) { await page.evaluate(()=>document.querySelector('.alGroupCompute').scrollIntoView({inline:'start'})); await page.waitForTimeout(300); await menu.screenshot({path:`${OUT}/${P}-${tag}-menu-compute.png`});
  await page.evaluate(()=>document.querySelector('.alGroupAfter').scrollIntoView({inline:'start'})); await page.waitForTimeout(300); await menu.screenshot({path:`${OUT}/${P}-${tag}-menu-aftersight.png`}); }
console.log(tag,'chip', await page.textContent('#alComputeChip'), '| research line:', await page.textContent('#alResearch'), errs.length?'ERRS '+errs.join(' | '):'');
await page.close();}
await b.close();srv.close();console.log('ok');})();
