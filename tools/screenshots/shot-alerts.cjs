// Alert bubble screenshots + style probe. PREFIX=before|after; BASE_URL optional
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const DIST=process.env.DIST||require('path').join(__dirname,'..','..','dist'), OUT=process.env.OUT||'shots', P=process.env.PREFIX||'before';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const p=path.join(DIST,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));if(!fs.existsSync(p)){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(0);
(async()=>{fs.mkdirSync(OUT,{recursive:true});const b=await chromium.launch();
for (const [tag,vp,touch] of [['desktop',{width:1400,height:900},false],['mobile',{width:390,height:844},true]]) {
const page=await b.newPage({viewport:vp, hasTouch:touch, isMobile:touch});
await page.goto(process.env.BASE_URL||('http://localhost:'+srv.address().port+'/index.html'));
await page.click('#splashFestus');await page.click('#playit');
await page.waitForFunction(()=>window.__AL,null,{timeout:90000});
await page.evaluate(()=>{const g=__AL.game,L=__AL.layer;['Town','City','Capital','Metropolis','Megalopolis'].forEach(k=>g['_reached'+k]=true);
  g.alNoPaper=true; L.autoDecide=c=>{const o=c.options.filter(x=>!x.disabled); const pick=o.find(x=>x.id==='accept')||o[0]; L.decide(pick.id);};
  if (L.s.card) L.autoDecide(L.s.card); __AL.fastForward(14); L.autoDecide=null; L.s.card=null; if(g._openWindow==='alCard') g.alCards.close(); g.alNoPaper=false;
  L.news('bad', 'Water: the town is drawing 91% of what the water authority\'s river wells can supply. Lawn watering is banned. The campus cooling towers are the biggest user.', {alert:'water'});
  g.alUI.frame(true);});
await page.waitForTimeout(1500);
for (let i=0;i<5 && await page.isVisible('#alPaper');i++){await page.click('#alPaperOK');await page.waitForTimeout(150);}
const probe=await page.evaluate(()=>{const cs=s=>{const e=document.querySelector(s); if(!e) return null; const c=getComputedStyle(e); return {text:e.textContent.slice(0,60), color:c.color, op:c.opacity, bg:c.backgroundColor, fs:c.fontSize, vis:c.visibility, filter:c.filter, ws:c.whiteSpace};};
  return {notif:cs('#notifications'), date:cs('#date'), stat:cs('#alPower'), val:cs('#alF_resVal'), fund:cs('#alFundBal')};});
console.log(tag, JSON.stringify(probe));
await page.screenshot({path:`${OUT}/alerts-${P}-${tag}.png`});
const n=await page.$('#notifications'); if (n && await n.isVisible()) { await n.screenshot({path:`${OUT}/alerts-${P}-${tag}-bubble.png`}); 
  if (P==='after') { if (touch) await n.tap(); else await n.click(); await page.waitForTimeout(400); await page.screenshot({path:`${OUT}/alerts-${P}-${tag}-modal.png`}); } }
await page.close();}
await b.close();srv.close();console.log('ok');})();
