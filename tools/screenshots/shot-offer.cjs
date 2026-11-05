// Screenshot the first Keystone offer card (and its counter list). PREFIX=before|after
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
await page.waitForSelector('#alCard:visible');
await page.click('#alCard .cardOption[data-option=go]');
await page.waitForSelector('#alCard[data-type=offer]:visible');await page.waitForTimeout(400);
await page.screenshot({path:`${OUT}/design-${P}-${tag}-offer.png`, fullPage:false});
await page.locator('#alCard').screenshot({path:`${OUT}/design-${P}-${tag}-offer-card.png`});
await page.click('#alCard .cardOption[data-option=counter]');await page.waitForTimeout(200);await page.evaluate(()=>{const c=document.querySelector('#alCard');c.scrollTop=c.scrollHeight;});await page.waitForTimeout(150);
await page.screenshot({path:`${OUT}/design-${P}-${tag}-counter.png`});
await page.close();}
await b.close();srv.close();console.log('ok');})();
