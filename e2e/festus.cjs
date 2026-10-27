// Aftersight Festus scenario test. Run `npm run build` first. Serves dist/ and plays the Festus, MO scenario on a
// desktop browser through the real UI: the intro card, the developer's first offer, a counter with two asks, the
// better offer, accepting it, the campus going up, a breakthrough card, investing, placing the unlocked building,
// and both election outcomes (win and loss). Fails on console errors. Screenshots go to $OUT.
//
//   NODE_PATH=/path/to/playwright/node_modules OUT=/tmp/shots node e2e/festus.cjs

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = process.env.OUT || path.join(__dirname, '..', 'shots-festus');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
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

let failed = false;
const fail = msg => { console.error('FAIL: ' + msg); failed = true; };

async function startFestus(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.waitForSelector('#splashFestus:visible', { timeout: 20000 });
  await page.click('#splashFestus');
  await page.waitForSelector('#start:visible');
  if (!(await page.isChecked('#alScenFestus'))) fail('Festus button did not pick the Festus scenario');
  await page.click('#playit');
  await page.waitForFunction(() => window.__AL, null, { timeout: 90000 });
  await page.evaluate(() => { ['Town', 'City', 'Capital', 'Metropolis', 'Megalopolis'].forEach(k => { __AL.game['_reached' + k] = true; }); });
  return { page, errors };
}
const mayor = page => page.evaluate(() => __AL.mayor());
// Run the sim for n months with pop-ups held back, then let the UI show whatever card is waiting
const months = async (page, n) => {
  await page.evaluate(n => { __AL.game.alNoPaper = true; __AL.fastForward(n); }, n);
  await page.evaluate(() => { __AL.game.alNoPaper = false; __AL.game.alUI.frame(true); });
  await page.waitForTimeout(200);
  // news papers queued by the month come first; read and dismiss them so the next card can show
  for (let i = 0; i < 6 && await page.isVisible('#alPaper'); i++) {
    console.log('  paper:', (await page.textContent('#alPaperHeadline')).trim());
    await page.click('#alPaperOK');
    await page.evaluate(() => __AL.game.alUI.frame(true));
    await page.waitForTimeout(150);
  }
};

(async () => {
  const srv = await serve();
  const url = `http://localhost:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const { page, errors } = await startFestus(browser, url);
  const shot = async (name, opts) => { const f = path.join(OUT, name); await page.screenshot({ path: f, ...opts }); console.log('screenshot', f); };

  // ---- the town ----
  const town = await page.evaluate(() => { const m = __AL.game.gameMap; let water = 0, roads = 0, zones = 0;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) { const v = m.getTileValue(x, y); if (v >= 2 && v <= 20 && x > 95) water++; if (v >= 64 && v <= 206) roads++; if (m.getTile(x, y).isZone()) zones++; }
    const i55 = [0, 30, 60, 99].every(y => { const v = m.getTileValue(55, y); return v >= 64 && v <= 206; });
    const site = __AL.game.starterTown.site; let clear = true;
    for (let y = site.y; y < site.y + site.h; y++) for (let x = site.x; x < site.x + site.w; x++) if (m.getTileValue(x, y) !== 0) clear = false;
    return { water, roads, zones, i55, clear, pop: __AL.game.simulation.evaluation.cityPop, name: __AL.game.name, scenario: __AL.layer.s.scenario }; });
  console.log('town', JSON.stringify(town));
  if (town.scenario !== 'festus') fail('scenario is ' + town.scenario);
  if (town.water < 500) fail('no river on the east side');
  if (!town.i55) fail('I-55 does not run the length of the map');
  if (!town.clear) fail('the data center site is not empty at the start');
  if (town.pop < 1500) fail('Festus did not grow into a town (pop ' + town.pop + ')');

  // ---- intro card, then the opening map with the card held back ----
  await page.waitForSelector('#alCard:not(.hidden)', { timeout: 5000 });
  if (!/mayor/i.test(await page.textContent('#alCard'))) fail('intro card missing');
  await page.evaluate(() => { document.getElementById('alCard').style.visibility = 'hidden'; document.getElementById('opaque').style.visibility = 'hidden';
    const g = __AL.game.gameCanvas; g.setZoomNow(1); g.centreOn(62, 46); });
  await page.waitForTimeout(1500);
  await shot('01-opening-map.png');
  await page.evaluate(() => { document.getElementById('alCard').style.visibility = ''; document.getElementById('opaque').style.visibility = ''; });
  await page.click('#alCard .cardOption[data-option="go"]');
  await page.waitForTimeout(300);

  // ---- the first offer: bad for citizens ----
  await page.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
  const first = await page.evaluate(() => __AL.card());
  console.log('first offer', JSON.stringify(first.rows.map(r => r[0] + ': ' + r[1])));
  if (!/Offer from Keystone/.test(first.kicker)) fail('first offer card has the wrong kicker: ' + first.kicker);
  if (!first.rows.some(r => /Secrecy/.test(r[0]) && /NDA/.test(r[1]))) fail('first offer should carry an NDA');
  if (!first.rows.some(r => /abatement/i.test(r[0]) && /100%/.test(r[1]))) fail('first offer should be a 100% abatement');
  await page.mouse.move(10, 10);
  await shot('02-offer-card.png');

  // ---- counter with two asks ----
  const m0 = await mayor(page);
  await page.click('#alCard .cardOption[data-option="counter"]');
  await page.check('#alCard .askBox[value="school"]');
  await page.check('#alCard .askBox[value="utilities"]');
  if (!(await page.isDisabled('#alCard .askBox[value="nda"]'))) fail('a third ask should be disabled');
  await page.click('#alSendCounter');
  const m1 = await mayor(page);
  console.log('counter: approval', m0.approval.toFixed(1), '->', m1.approval.toFixed(1), 'status', m1.dev.status);
  if (m1.dev.status !== 'review') fail('counter did not go to review');
  if (Math.abs(m1.factions.res.v - m0.factions.res.v) < 1 || Math.abs(m1.factions.work.v - m0.factions.work.v) < 1) fail('counter did not move factions right away');

  // the developer answers a couple of months later with a better offer
  await page.evaluate(() => __AL.force('Counter', true));
  await months(page, 3);
  await page.waitForSelector('#alCard[data-type="offer"]:not(.hidden)', { timeout: 5000 });
  const better = await page.evaluate(() => __AL.card());
  console.log('better offer', better.title, JSON.stringify(better.rows.map(r => r[0] + ': ' + r[1])));
  if (!/comes back/.test(better.kicker)) fail('expected a better offer, got ' + better.kicker);
  if (!better.rows.some(r => /School fund/.test(r[0]) && /\$200/.test(r[1]))) fail('school fund ask was not granted');
  if (!better.rows.some(r => /upgrades/.test(r[0]) && /Split/.test(r[1]))) fail('utilities ask was not granted');

  // ---- accept ----
  const m2 = await mayor(page);
  await page.click('#alCard .cardOption[data-option="accept"]');
  const m3 = await mayor(page);
  console.log('accept: approval', m2.approval.toFixed(1), '->', m3.approval.toFixed(1), 'work', m2.factions.work.v.toFixed(0), '->', m3.factions.work.v.toFixed(0),
              'res', m2.factions.res.v.toFixed(0), '->', m3.factions.res.v.toFixed(0));
  if (!m3.deal || !m3.construction) fail('accepting did not sign a deal and start construction');
  if (!(m3.factions.work.v > m2.factions.work.v)) fail('workers should like the accepted deal');
  if (!(m3.factions.res.v < m2.factions.res.v)) fail('residents should dislike the accepted deal (NDA, split bills)');

  // ---- the campus goes up and switches on ----
  await months(page, 5);
  const m4 = await mayor(page);
  await months(page, 1);
  const dcs = await page.evaluate(() => { const m = __AL.game.gameMap; let n = 0;
    for (let y = 26; y < 48; y++) for (let x = 42; x < 56; x++) { const v = m.getTileValue(x, y); if (v === 960 || v === 969) n++; }
    return n; });
  console.log('campus: halls', m4.halls, 'dc tiles', dcs, 'water', JSON.stringify(m4.water));
  if (m4.halls < 2 || dcs < 2) fail('the data center halls were not built on the site');
  const lv = await page.evaluate(() => { const b = __AL.game.simulation.blockMaps; return { site: b.pollutionDensityMap.worldGet(45, 35), far: b.pollutionDensityMap.worldGet(20, 80) }; });
  console.log('pollution near the campus vs far away', JSON.stringify(lv));

  // ---- a breakthrough card: invest ----
  let card = await page.evaluate(() => __AL.card());
  for (let i = 0; i < 6 && !(card && card.type === 'research'); i++) {
    if (card) { console.log('clearing', card.type, card.title); await page.evaluate(c => __AL.decide(c.options[c.options.length - 1].id), card); }
    await months(page, 1);
    card = await page.evaluate(() => __AL.card());
  }
  if (!card || card.type !== 'research') fail('no breakthrough card arrived');
  else {
    await page.waitForSelector('#alCard[data-type="research"]:not(.hidden)', { timeout: 5000 });
    console.log('breakthrough', card.title, JSON.stringify(card.rows.map(r => r[0] + ': ' + r[1])));
    if (!card.rows.some(r => r[0] === 'Compute') || !card.rows.some(r => r[0] === 'Unlocks')) fail('breakthrough card is missing cost or unlocks');
    await page.mouse.move(10, 10);
    await shot('03-breakthrough-card.png');
    const f0 = await page.evaluate(() => __AL.funds());
    await page.click('#alCard .cardOption[data-option="invest"]');
    const r = (await mayor(page)).research;
    console.log('invested: funds', f0, '->', await page.evaluate(() => __AL.funds()), 'active', JSON.stringify(r.active));
    if (!r.active) fail('investing did not start research');
    await months(page, 4);
    if (!(await page.evaluate(() => __AL.layer.has('cheap_solar')))) fail('research did not finish');
    await page.evaluate(() => { if (__AL.card()) __AL.decide(__AL.card().options[__AL.card().options.length - 1].id); });
  }

  // ---- jump the research ladder to the cure: invest, finish, place a Healing Clinic with the toolbar ----
  await page.evaluate(() => { const L = __AL.layer, R = L.s.research; R.passed.frontier_model = 1; R.passed.robots_build_robots = 1; R.next = 0; L.s.mayor.lastCard = -99;
    __AL.game.simulation.budget.setFunds(30000); });
  if (await page.evaluate(() => __AL.build('clinic', 10, 10)) !== 'locked') fail('clinic should be locked before the research');
  await months(page, 1);
  card = await page.evaluate(() => __AL.card());
  if (!card || card.id !== 'the_cure') fail('expected the cure card, got ' + JSON.stringify(card && card.title));
  else {
    await page.waitForSelector('#alCard[data-type="research"]:not(.hidden)');
    await page.click('#alCard .cardOption[data-option="invest"]');
    await months(page, 7);
    await page.evaluate(() => { if (__AL.card()) __AL.decide(__AL.card().options[__AL.card().options.length - 1].id); });
    if (!(await page.evaluate(() => __AL.layer.isUnlocked('clinic')))) fail('the cure did not unlock the clinic');
    const spot = await page.evaluate(() => __AL.findSite());
    await page.evaluate(s => { const g = __AL.game.gameCanvas; g.setZoomNow(3); g.centreOn(s.x + 1, s.y + 1); }, spot);
    await page.waitForTimeout(200);
    await page.click('#clinicButton');
    const p = await page.evaluate(s => { const g = __AL.game.gameCanvas; const c = g.tileToCanvasCoordinate(s.x + 1, s.y + 1); const r = g._canvas.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, spot);
    await page.mouse.move(p.x, p.y - 40, { steps: 2 }); await page.mouse.move(p.x, p.y, { steps: 2 }); await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(100);
    const v = await page.evaluate(s => __AL.game.gameMap.getTileValue(s.x + 1, s.y + 1), spot);
    console.log('clinic placed at', JSON.stringify(spot), 'tile', v);
    if (v !== 1014) fail('clicking with the clinic tool did not build a Healing Clinic (tile ' + v + ')');
    await page.evaluate(() => __AL.game.inputStatus.clearTool());
  }

  // ---- approval and factions ----
  await page.evaluate(() => { const g = __AL.game.gameCanvas; g.setZoomNow(2); g.centreOn(48, 38); });
  await page.waitForTimeout(800);
  await shot('04-approval-factions.png');
  await page.locator('#alPanel').screenshot({ path: path.join(OUT, '04b-mayor-panel.png') });
  const hud = await page.textContent('#alApproval');
  if (!/^\d+%$/.test(hud.trim())) fail('approval not in the top bar: ' + hud);

  // ---- win path: three elections won ----
  for (const i of [0, 1, 2]) {
    await page.evaluate(i => { __AL.game.alNoPaper = false; __AL.election(i, 62); }, i);
    await page.waitForSelector('#alPaper:not(.hidden)', { timeout: 5000 });
    const head = await page.textContent('#alPaperHeadline');
    console.log('election', i, head);
    if (i === 2) { await page.waitForTimeout(400); await shot('05-election-won.png'); }
    await page.click('#alPaperOK');
  }
  const won = await mayor(page);
  if (!won.won || won.electionsWon !== 3) fail('three wins did not win the game: ' + JSON.stringify(won.won));
  if (errors.length) fail('console errors:\n' + errors.join('\n'));
  await page.close();

  // ---- loss path: a fresh Festus game, a town that hates the mayor, the April 2028 vote ----
  const run2 = await startFestus(browser, url);
  const p2 = run2.page;
  await p2.waitForSelector('#alCard:not(.hidden)', { timeout: 5000 });
  await p2.click('#alCard .cardOption[data-option="go"]');
  await p2.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
  await p2.click('#alCard .cardOption[data-option="accept"]');       // sign the bad first deal
  await p2.evaluate(() => __AL.bump({ res: -40, farm: -40, school: -40, work: -20, biz: -20 }));
  const before = await mayor(p2);
  console.log('approval before the vote', before.approval.toFixed(1));
  await p2.evaluate(() => { __AL.game.alNoPaper = false; __AL.election(0); });
  await p2.waitForSelector('#alPaper:not(.hidden)', { timeout: 5000 });
  const head = await p2.textContent('#alPaperHeadline');
  console.log('loss path:', head);
  if (!/VOTERS OUST MAYOR/.test(head)) fail('low approval did not lose the election: ' + head);
  if (!(await p2.isVisible('#alPaperRestart'))) fail('game-over paper has no Start over button');
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: path.join(OUT, '06-election-lost.png') });
  console.log('screenshot', path.join(OUT, '06-election-lost.png'));
  await p2.click('#alPaperOK');
  const lost = await mayor(p2);
  if (!lost.gameOver) fail('no game over after losing');
  if (run2.errors.length) fail('console errors (loss run):\n' + run2.errors.join('\n'));

  await browser.close();
  srv.close();
  console.log(failed ? 'FESTUS FAILED' : 'FESTUS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
