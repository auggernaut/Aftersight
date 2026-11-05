// Fund/purpose/projects screenshots. PREFIX=before|after
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const DIST=process.env.DIST||require('path').join(__dirname,'..','..','dist'), OUT=process.env.OUT||'shots', P=process.env.PREFIX||'before';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const p=path.join(DIST,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(0);
(async()=>{fs.mkdirSync(OUT,{recursive:true});const b=await chromium.launch();
for (const [tag,vp] of [['desktop',{width:1400,height:900}],['mobile',{width:390,height:844}]]) {
const page=await b.newPage({viewport:vp});
await page.goto('http://localhost:'+srv.address().port+'/index.html');
await page.click('#splashFestus');
await page.waitForFunction(()=>window.__AL,null,{timeout:90000});
await page.evaluate(()=>{const g=__AL.game,L=__AL.layer;['Town','City','Capital','Metropolis','Megalopolis'].forEach(k=>g['_reached'+k]=true);
  g.alNoPaper=true; L.autoDecide=c=>{const o=c.options.filter(x=>!x.disabled); const pick=o.find(x=>x.id==='accept')||o.find(x=>x.id==='neighbors')||o[0]; L.decide(pick.id);};
  if (L.s.card) L.autoDecide(L.s.card); L.s.deal; __AL.fastForward(26); L.autoDecide=null; g.alNoPaper=false;});
await page.evaluate(()=>{const L=__AL.layer; L.s.card=null; if(__AL.game._openWindow==='alCard') __AL.game.alCards.close(); __AL.game.alUI.frame(true);});
await page.waitForTimeout(300);
for (let i=0;i<5 && await page.isVisible('#alPaper');i++){await page.click('#alPaperOK');await page.waitForTimeout(150);}
if (await page.evaluate(()=>document.getElementById('alPanel').classList.contains('collapsed'))) await page.click('#alCollapse');
await page.waitForTimeout(300);
await page.screenshot({path:`${OUT}/fund-${P}-${tag}-game.png`});
const pn=await page.$('#alPanel'); if (pn && await pn.isVisible()) await pn.screenshot({path:`${OUT}/fund-${P}-${tag}-panel.png`});
if (P==='after') { const ok=await page.evaluate(()=>__AL.layer.projectCard && __AL.layer.projectCard('park'));
  if (ok) { await page.evaluate(()=>__AL.game.alUI.frame(true)); await page.waitForSelector('#alCard[data-type=project]:visible'); await page.waitForTimeout(300);
    await page.locator('#alCard').screenshot({path:`${OUT}/fund-${P}-${tag}-project-card.png`}); } }
await page.close();}
await b.close();srv.close();console.log('ok');})();
