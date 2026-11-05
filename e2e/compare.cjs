// Afterlight ownership comparison: the same 2026 town played two ways for four game years.
//   hands-off : Helix builds freely, no policies
//   community : co-op data center, co-op robot depot and solar, plus dividend, community-first zoning and purpose programs
// Run `npm run build` first.   NODE_PATH=/path/to/playwright/node_modules RUNS=3 node e2e/compare.cjs

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'dist');
const RUNS = +(process.env.RUNS || 3);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

async function run(browser, url, strategy) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.click('#splashSandbox');
  await page.fill('#nameForm', 'Compare');
  await page.click('#playit');
  await page.waitForFunction(() => window.__AL);
  await page.evaluate(() => { __AL.game.alNoPaper = true; });
  if (strategy === 'community') {
    await page.evaluate(() => {
      ['dividend', 'communityFirst', 'purposeProgram'].forEach(p => __AL.setPolicy(p, true));
      for (const t of ['solar', 'dcCoop', 'depotCoop']) { const s = __AL.findSite(); if (s) __AL.build(t, s.x + 1, s.y + 1); }
    });
  }
  const samples = [];
  for (let m = 0; m < 48; m += 3) {
    await page.evaluate(() => __AL.fastForward(3));
    if (strategy === 'community' && m === 24)   // keep building co-op compute as the money comes in
      await page.evaluate(() => { for (const t of ['solar', 'dcCoop']) { const s = __AL.findSite(); if (s) __AL.build(t, s.x + 1, s.y + 1); } });
    samples.push(await page.evaluate(() => { const s = __AL.state(); return { u: s.unemployment, p: s.purpose, b: s.backlash, h: s.hope, hs: s.helixShare }; }));
  }
  const end = await page.evaluate(() => { const s = __AL.state(); return { pop: __AL.game.simulation.evaluation.cityPop,
    approval: __AL.game.simulation.evaluation.cityYes, funds: __AL.funds(), robots: Math.round(s.robots), compute: s.compute, log: s.log }; });
  await page.close();
  const avg = k => samples.reduce((a, x) => a + x[k], 0) / samples.length;
  const count = re => end.log.filter(e => re.test(e.text)).length;
  return { unemployment: avg('u'), purpose: avg('p'), backlash: avg('b'), hope: avg('h'), helixShare: samples[samples.length - 1].hs,
           protests: count(/^PROTEST/), riots: count(/^RIOTS/), strikes: count(/GENERAL STRIKE/), slump: count(/LONG AFTERNOON:/),
           pop: end.pop, approval: end.approval, funds: end.funds, robots: end.robots, compute: end.compute, errors: errors.length };
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const out = {};
  for (const strategy of ['hands-off', 'community']) {
    const rs = [];
    for (let i = 0; i < RUNS; i++) rs.push(await run(browser, url, strategy));
    const mean = {};
    for (const k of Object.keys(rs[0])) mean[k] = +(rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(2);
    out[strategy] = mean;
    console.log(strategy, JSON.stringify(mean));
  }
  await browser.close();
  srv.close();
})();
