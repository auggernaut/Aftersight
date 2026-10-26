// Afterlight browser smoke test.
// Builds nothing itself: run `npm run build` first. Serves dist/, starts a game with the 2026 starter town,
// fast-forwards about four game years, exercises policies and new buildings, and checks that at least one
// negative and one positive Afterlight event fire with no console errors. Screenshots go to $OUT.
//
//   NODE_PATH=/path/to/playwright/node_modules OUT=/tmp/shots node e2e/smoke.cjs

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = process.env.OUT || path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const NEGATIVE = /PROTEST|RIOTS|GENERAL STRIKE|LONG AFTERNOON/;
const POSITIVE = /SOLAR NOW CHEAPER|FRONTIER MODEL|ROBOTS NOW BUILD|THE CURE|FUSION IGNITES|ABUNDANCE|POST-SCARCITY/;

(async () => {
  const srv = await serve();
  const url = `http://localhost:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const fail = msg => { console.error('FAIL: ' + msg); process.exitCode = 1; };
  const shot = async (name, opts) => { const f = path.join(OUT, name); await page.screenshot({ path: f, ...opts }); console.log('screenshot', f); };

  await page.goto(url);
  await page.waitForSelector('#splashPlay:visible');
  await page.click('#splashPlay');
  await page.fill('#nameForm', 'Afterlight');
  await page.click('#playit');
  await page.waitForFunction(() => window.__AL, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const c0 = await page.evaluate(() => __AL.census());
  console.log('start', JSON.stringify(c0), JSON.stringify(await page.evaluate(() => __AL.date())));
  if (c0.dc < 1) fail('starter town has no data center');
  await shot('01-city-2026.png');

  // Close any Micropolis dialog (e.g. "now a city!") that fast-forwarding popped up
  const closeDialogs = async () => {
    for (const sel of ['#congratsOK', '#budgetOK', '#alPaperOK']) if (await page.isVisible(sel)) await page.click(sel);
  };

  // Papers would pause the game on every discovery during fast-forward; we look at one on purpose below
  await page.evaluate(() => { __AL.game.alNoPaper = true; });

  // Year 1: the player builds a co-op data center and a solar farm next to the grid
  for (const tool of ['solar', 'dcCoop', 'depotCoop']) {
    const site = await page.evaluate(() => __AL.findSite());
    if (!site) { fail('no site for ' + tool); continue; }
    const r = await page.evaluate(([t, s]) => __AL.build(t, s.x + 1, s.y + 1), [tool, site]);
    console.log('build', tool, 'at', site.x, site.y, r);
    if (r !== 'ok') fail('could not build ' + tool + ': ' + r);
  }

  const timeline = [];
  for (let m = 0; m < 48; m += 6) {
    if (m === 18) {   // mid-game the mayor passes a dividend and community-first zoning, through the real UI
      await page.click('#alPol_dividend');
      await page.click('#alPol_communityFirst');
    }
    await page.evaluate(n => __AL.fastForward(n), 6);
    await closeDialogs();
    const row = await page.evaluate(() => { const s = __AL.state(); return {
      date: __AL.date(), pop: __AL.game.simulation.evaluation.cityPop, unemp: +s.unemployment.toFixed(2), auto: +s.automation.toFixed(2),
      purpose: Math.round(s.purpose), backlash: Math.round(s.backlash), hope: Math.round(s.hope), compute: s.compute,
      robots: Math.round(s.robots), helix: +s.helixShare.toFixed(2), cover: +s.cover.toFixed(2), protest: !!s.protest,
      funds: __AL.funds(), found: Object.keys(s.discovered) }; });
    timeline.push(row);
    console.log(JSON.stringify(row));
  }

  const log = await page.evaluate(() => __AL.state().log);
  const neg = log.filter(e => NEGATIVE.test(e.text));
  const pos = log.filter(e => POSITIVE.test(e.text));
  console.log('negative events:', neg.map(e => e.date + ' ' + e.text.slice(0, 50)));
  console.log('positive events:', pos.map(e => e.date + ' ' + e.text.slice(0, 50)));
  if (!neg.length) fail('no negative event fired in four years');
  if (!pos.length) fail('no positive event fired in four years');

  // Data center protest on screen (force one if none is active right now)
  let protest = await page.evaluate(() => __AL.state().protest);
  if (!protest) { await page.evaluate(() => __AL.protest()); protest = await page.evaluate(() => __AL.state().protest); }
  if (!protest) fail('could not start a protest');
  else {
    await page.evaluate(p => __AL.centreOn(p.x, p.y), protest);
    await page.waitForTimeout(900);
    await page.evaluate(() => { const n = document.querySelector('#notifications'); if (n) n.style.display = 'block'; });
    await shot('02-datacenter-protest.png');
    const pos = await page.evaluate(p => { const g = __AL.game.gameCanvas; const c = g.tileToCanvasCoordinate(p.x, p.y);
      const r = g._canvas.getBoundingClientRect(); return c && { x: r.left + c.x, y: r.top + c.y }; }, protest);
    if (pos) await shot('02b-protest-closeup.png', { clip: { x: Math.max(0, pos.x - 140), y: Math.max(0, pos.y - 110), width: 300, height: 230 } });
  }

  // Indicators panel
  await page.locator('#alPanel').screenshot({ path: path.join(OUT, '03-indicators-panel.png') });
  console.log('screenshot', path.join(OUT, '03-indicators-panel.png'));

  // A discovery in Valley Ledger style. Fresh game state may have found everything already, so re-show the Cure page
  await page.evaluate(() => { __AL.game.alNoPaper = false; const l = __AL.layer; delete l.s.discovered.the_cure; __AL.discover('the_cure'); });
  await page.waitForSelector('#alPaper:not(.hidden)');
  await page.waitForTimeout(300);
  await shot('04-discovery-newspaper.png');
  await page.click('#alPaperOK');
  if (await page.isVisible('#alPaper')) fail('newspaper did not close');

  // Riots spread like fire around the protest site
  const before = await page.evaluate(() => __AL.game.simulation._census.firePop);
  console.log('protest before riot', JSON.stringify(await page.evaluate(() => __AL.state().protest)));
  const rioted = await page.evaluate(() => __AL.riot());
  await page.evaluate(() => __AL.fastForward(1));
  await closeDialogs();
  if (!rioted) fail('riot did not start');
  console.log('riot', rioted, 'fire tiles before/after', before, await page.evaluate(() => __AL.game.simulation._census.firePop));
  await shot('05-riot.png');

  // Unlocked tier: fusion plant
  await page.evaluate(() => __AL.discover('fusion'));
  await closeDialogs();
  const site = await page.evaluate(() => __AL.findSite());
  if (site) console.log('fusion', await page.evaluate(s => __AL.build('fusion', s.x + 1, s.y + 1), site));

  // Save and reload keeps the Afterlight state
  const saved = await page.evaluate(() => { __AL.game.save(); const raw = localStorage.getItem('micropolisJSGame'); return raw ? JSON.parse(raw).afterlight : null; });
  if (!saved || saved.months < 40) fail('save did not include afterlight state');

  await page.evaluate(() => { const t = __AL.game.starterTown; __AL.centreOn(t.x + 13, t.y + 11); });
  await page.waitForTimeout(500);
  await shot('06-city-late.png');

  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ timeline, log }, null, 2));
  if (errors.length) fail('console errors:\n' + errors.join('\n'));
  console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
