// Aftersight Festus scenario test. Run `npm run build` first. Serves dist/ and plays the Festus, MO scenario on a
// desktop browser through the real UI: the intro card, the developer's first offer, a counter with two asks, the
// better offer, accepting it, the campus going up, a breakthrough card, investing, placing the unlocked building,
// and both election outcomes (win and loss); then a third game where the developer walks (the site clears and goes
// back to hay) and returns with a bigger campus, the one-time town-to-city milestone, and the sparse status alerts;
// then real dollars on screen, the automation tide in a town that says no, the developer leaving for good after three
// walks, a town hall ask decided from the ticker, a co-op bond paying into the Festus Fund, and a project on the map.
// Fails on console errors. Screenshots go to $OUT. BASE_URL=https://... tests a deployed build instead of dist/.
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
  const url = process.env.BASE_URL || `http://localhost:${srv.address().port}/index.html`;
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
  // the old town is built out (houses only); the platted streets around it have empty lots to zone
  const homes = await page.evaluate(() => { const L = __AL.layer, m = __AL.game.gameMap; let houses = 0, apts = 0;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) { const v = m.getTileValue(x, y); if (v >= 249 && v <= 260) houses++; if (v >= 265 && v < 405 && m.getTile(x, y).isZone()) apts++; }
    return { houses, apts, lots: L.openLots(false).length, powered: L.openLots(true).length, homesOnly: !!m.alHousesOnly, rci: !!document.querySelector('#controls #alRCI .rci_res') }; });
  console.log('homes', JSON.stringify(homes));
  if (homes.houses < 250 || homes.apts) fail('the old town should be full of houses, and no apartments (' + homes.houses + ' houses, ' + homes.apts + ' apartment blocks)');
  if (homes.lots < 60 || homes.powered < 15 || !homes.homesOnly) fail('Festus should start with empty platted lots, many with power (' + homes.lots + ', ' + homes.powered + ')');
  if (!homes.rci) fail('the R, C and I demand bars should sit with the zone tools');

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

  // ---- no Research Lab, no breakthroughs: a news hint points at the Compute menu; build a lab with the toolbar ----
  const noLab = await page.evaluate(() => ({ labs: __AL.layer.labsOn(), clock: __AL.layer.s.research.clock, done: Object.keys(__AL.layer.s.research.done).length,
    hint: __AL.layer.s.log.some(e => /Research Lab/.test(e.text)), chip: document.getElementById('alComputeChip').textContent,
    compute: [...document.querySelectorAll('.alGroupCompute .toolButton')].map(b => b.id), after: [...document.querySelectorAll('.alGroupAfter .toolButton')].map(b => b.id) }));
  console.log('before a lab', JSON.stringify(noLab));
  if (noLab.labs || noLab.clock || noLab.done) fail('breakthrough work happened with no Research Lab');
  if (!noLab.hint) fail('no news hint to build a Research Lab');
  if (!/\/mo/.test(noLab.chip)) fail('the Compute section does not show town compute');
  if (noLab.compute.join() !== 'dcHelixButton,dcCoopButton,labButton' || !['depotCoopButton', 'clinicButton', 'fusionButton'].every(id => noLab.after.includes(id)))
    fail('build menu sections are wrong: ' + JSON.stringify(noLab));
  {
    for (let i = 0; i < 4; i++) {   // clear whatever is open (a card, a paper) so the toolbar can be clicked
      await page.evaluate(() => { if (__AL.card()) __AL.decide(__AL.card().options[__AL.card().options.length - 1].id); });
      for (const sel of ['#alPaperOK', '#congratsOK', '#alAlertClose']) if (await page.isVisible(sel)) await page.click(sel);
      await page.waitForTimeout(150);
    }
    const spot = await page.evaluate(() => __AL.findSite());
    await page.evaluate(s => { const g = __AL.game.gameCanvas; g.setZoomNow(3); g.centreOn(s.x + 1, s.y + 1); }, spot);
    await page.waitForTimeout(200);
    await page.click('#labButton');
    const p = await page.evaluate(s => { const g = __AL.game.gameCanvas; const c = g.tileToCanvasCoordinate(s.x + 1, s.y + 1); const r = g._canvas.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, spot);
    const f0 = await page.evaluate(() => __AL.funds());
    await page.mouse.move(p.x, p.y - 40, { steps: 2 }); await page.mouse.move(p.x, p.y, { steps: 2 }); await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(100);
    const v = await page.evaluate(s => __AL.game.gameMap.getTileValue(s.x + 1, s.y + 1), spot);
    console.log('lab placed at', JSON.stringify(spot), 'tile', v, 'cost', f0 - await page.evaluate(() => __AL.funds()));
    if (v !== 888) fail('the Research Lab was not placed');
    await page.click('#queryButton');
    await months(page, 2);
    const lab = await page.evaluate(() => ({ labs: __AL.layer.labsOn(), bill: __AL.layer.s.labBill, clock: __AL.layer.s.research.clock,
      site: __AL.sites().filter(x => x.kind === 'lab'), census: __AL.census() }));
    console.log('lab running', JSON.stringify(lab));
    if (lab.labs !== 1 || !(lab.clock > 0)) fail('the Research Lab is not running');
    await page.evaluate(() => { __AL.layer.s.research.clock = Math.max(__AL.layer.s.research.clock, __AL.layer.s.research.next); });   // skip the wait
  }

  // ---- a breakthrough card: invest ----
  let card = await page.evaluate(() => __AL.card());
  for (let i = 0; i < 10 && !(card && card.type === 'research'); i++) {
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
  await page.evaluate(() => { const L = __AL.layer, R = L.s.research; R.passed.frontier_model = 1; R.passed.robots_build_robots = 1; R.next = 0; L.s.mayor.lastCard = -99; L.s.mayor.lastType = 'ask'; L.s.dev.nextExpansion = 9999;   // no town-hall ask jumps the queue
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

  // ---- Keystone walks: the site clears and goes back to hay; it comes back bigger ----
  const run3 = await startFestus(browser, url);
  const p3 = run3.page;
  const shot3 = async name => { await p3.evaluate(() => { ['alCard', 'opaque'].forEach(i => { const e = document.getElementById(i); if (e) e.style.visibility = 'hidden'; });
    const g = __AL.game.gameCanvas; g.setZoomNow(1); g.centreOn(46, 44); });
    await p3.waitForTimeout(700); const f = path.join(OUT, name); await p3.screenshot({ path: f }); console.log('screenshot', f);
    await p3.evaluate(() => { ['alCard', 'opaque'].forEach(i => { const e = document.getElementById(i); if (e) e.style.visibility = ''; }); }); };
  const siteMarks = () => p3.evaluate(() => __AL.game.alPanel.overlays().filter(o => o.kind === 'site' || o.kind === 'sitelabel' || o.kind === 'build'));
  await p3.waitForSelector('#alCard:not(.hidden)', { timeout: 5000 });
  await p3.click('#alCard .cardOption[data-option="go"]');
  await p3.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
  const firstRows = (await p3.evaluate(() => __AL.card())).rows;
  if (!firstRows.some(r => r[0] === 'Campus' && /370 acres/.test(r[1]))) fail('first offer does not state its acreage');
  if (!firstRows.some(r => r[0] === 'Power' && /300 MW/.test(r[1]))) fail('first offer does not state its MW');
  const marks0 = await siteMarks();
  if (!marks0.some(o => o.kind === 'site') || !marks0.some(o => o.kind === 'sitelabel')) fail('the proposed site is not marked at the start');
  await p3.click('#alCard .cardOption[data-option="reject"]');
  await p3.waitForSelector('#alPaper:not(.hidden)', { timeout: 5000 });
  const walkHead = await p3.textContent('#alPaperHeadline'), walkBody = await p3.textContent('#alPaperBody');
  console.log('walk paper:', walkHead, '|', walkBody);
  if (!/WALKS/.test(walkHead) || !/back to hay/.test(walkBody) || !/520 acres/.test(walkBody)) fail('walk paper should say the land goes back to hay and the next plan is bigger');
  await p3.click('#alPaperOK');
  const marks1 = await siteMarks();
  const hay = await p3.evaluate(() => __AL.layer.farmedRects());
  console.log('after the walk: site marks', marks1.length, 'farmed', JSON.stringify(hay));
  if (marks1.length) fail('the site marker and label stay on the map after Keystone walks');
  if (!hay || !hay.length) fail('the site did not go back to farmland');
  await shot3('07-walk-site-cleared.png');
  // fast-forward to the return offer, clearing anything else
  let ret = null;
  for (let i = 0; i < 30 && !ret; i++) ret = await p3.evaluate(() => { __AL.game.alNoPaper = true; __AL.fastForward(1); __AL.game.alNoPaper = false;
    const c = __AL.card(); if (!c) return null; if (c.type === 'offer') return c; __AL.decide(c.options[c.options.length - 1].id); return null; });
  if (!ret) fail('Keystone never came back');
  else {
    console.log('return offer', ret.title, JSON.stringify(ret.rows.slice(0, 1).concat(ret.rows.filter(r => r[0] === 'Power'))));
    if (!/is back/.test(ret.kicker) || !ret.rows.some(r => r[0] === 'Campus' && /4 halls on about 520 acres/.test(r[1]))) fail('return offer is not the bigger campus');
    if (!ret.rows.some(r => r[0] === 'Power' && /600 MW/.test(r[1]))) fail('return offer does not state 600 MW');
    const marks2 = await siteMarks();
    const area = marks2.filter(o => o.kind === 'site').reduce((n, o) => n + o.w * o.h, 0);
    console.log('return site rects', JSON.stringify(marks2.filter(o => o.kind === 'site')), 'area', area, 'label', (marks2.find(o => o.kind === 'sitelabel') || {}).text);
    if (area <= 180 || !marks2.some(o => o.kind === 'site' && o.y >= 48)) fail('the returning site is not visibly larger');
    if (await p3.evaluate(() => __AL.layer.farmedRects())) fail('the farmland overlay should clear when the site returns');
    await p3.evaluate(() => __AL.game.alUI.frame(true));
    await p3.waitForSelector('#alCard[data-type="offer"]:not(.hidden)', { timeout: 5000 });
    await p3.mouse.move(10, 10);
    await p3.screenshot({ path: path.join(OUT, '08-return-offer.png') });
    await shot3('09-return-bigger-site.png');
    await p3.click('#alCard .cardOption[data-option="accept"]');
    await p3.evaluate(() => { __AL.game.alNoPaper = true; __AL.fastForward(6); __AL.game.alNoPaper = false; });
    const built = await p3.evaluate(() => { const m = __AL.game.gameMap; let north = 0, south = 0;
      for (let y = 26; y < 62; y++) for (let x = 34; x < 56; x++) { const v = m.getTileValue(x, y); if (v === 960 || v === 969) { if (y >= 48) south++; else north++; } }
      return { north, south, halls: __AL.layer.s.hallsBuilt, online: __AL.layer.hallsOnline() }; });
    console.log('bigger campus built', JSON.stringify(built));
    if (built.halls !== 4 || !built.south || !built.north) fail('the bigger campus did not build 4 halls across both parcels');
    if (built.online < 4) fail('not every hall on the bigger campus is powered (' + built.online + ')');
  }

  // ---- town to city: once, after sustained growth, never announced the other way ----
  const ms = await p3.evaluate(() => {
    const g = __AL.game, L = __AL.layer, ev = g.simulation.evaluation;
    ['Town', 'City', 'Capital', 'Metropolis', 'Megalopolis'].forEach(k => { g['_reached' + k] = false; });   // let the engine try
    // start from a town: the real Festus may already have grown into a city by now (it starts near 11,000 and grows)
    L.s.cityStatus = undefined; L.s.mayor.cityMonths = 0; L.s.log = L.s.log.filter(e => !/is now a/i.test(e.text));
    document.getElementById('cclass').textContent = 'TOWN';
    L.autoDecide = function(c) { this.decide(c.options[c.options.length - 1].id); };
    if (L.s.card) L.autoDecide(L.s.card);
    g.alNoPaper = true;
    const real = ev.getPopulation.bind(ev); let fake = 0;
    ev.getPopulation = function(c) { real(c); if (fake) this.cityPop = fake; return this.cityPop; };
    const cls = () => document.getElementById('cclass').textContent.trim();
    const out = { start: cls() };
    const run = (pop, n) => { fake = pop; g.simulation._cityPopLast = 0; __AL.fastForward(n); };
    run(15000, 3); run(9000, 1); out.afterBlip = L.s.cityStatus || 'town';
    run(15000, 7); out.afterGrowth = L.s.cityStatus; out.badgeCity = cls();
    run(4000, 6); run(15000, 2); run(4000, 3);
    out.end = L.s.cityStatus; out.badgeEnd = cls();
    out.cityMonths = L.s.mayor.cityMonths; out.pop = ev.cityPop;
    out.cityNews = L.s.log.filter(e => /is now a/i.test(e.text)).map(e => e.text);
    const cw = document.getElementById('congratsWindow'); out.congrats = g._openWindow === 'congratsWindow' || !!(cw && cw.offsetParent);
    fake = 0;
    return out;
  });
  console.log('city milestone', JSON.stringify(ms));
  if (ms.start !== 'TOWN') fail('the badge should start at TOWN, got ' + ms.start);
  if (ms.afterBlip === 'city') fail('a short spike made Festus a city');
  if (ms.afterGrowth !== 'city' || ms.badgeCity !== 'CITY') fail('sustained growth did not make Festus a city');
  if (ms.end !== 'city' || ms.badgeEnd !== 'CITY') fail('the city status went back down');
  if (ms.cityNews.length !== 1) fail('the city milestone should fire exactly once, got ' + ms.cityNews.length);
  if (ms.congrats) fail('an engine milestone window opened');

  // ---- status alerts: sparse, one per topic a year, never on a card's month ----
  const al = await p3.evaluate(() => {
    const L = __AL.layer, cardMonths = [];
    const show = L.showCard; L.showCard = function(c) { cardMonths.push(this.s.months); return show.call(this, c); };
    __AL.fastForward(40);
    __AL.game.alNoPaper = false;
    return { log: (L.s.mayor.alertLog || []).map(a => ({ type: a.type, month: a.month })), cardMonths, months: L.s.months };
  });
  console.log('alerts', JSON.stringify(al.log));
  if (!al.log.length) fail('no status alerts in 40 months');
  const byType = {};
  al.log.forEach((a, i) => {
    if (byType[a.type] !== undefined && a.month - byType[a.type] < 12) fail('two ' + a.type + ' alerts within a year');
    byType[a.type] = a.month;
    if (al.cardMonths.includes(a.month)) fail('an alert landed in the same month as a decision card (' + a.month + ')');
    if (i && a.month - al.log[i - 1].month < 4) fail('alerts closer than 4 months apart');
  });
  if (run3.errors.length) fail('console errors (walk run):\n' + run3.errors.join('\n'));

  // ---- facility design: cooling and power are part of the offer, and stricter designs cost other benefits ----
  // Two fresh games through the UI: closed-loop + gas (off the town grid, dirtier air), and an evaporative/grid control.
  const design = async (asks) => {
    const run = await startFestus(browser, url);
    const pg = run.page;
    await pg.click('#alCard .cardOption[data-option="go"]');
    await pg.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
    const card = await pg.evaluate(() => __AL.card());
    const out = { rows: card.rows.filter(r => r[0] === 'Cooling' || r[0] === 'Power').map(r => r[0] + ': ' + r[1]),
                  designAsks: card.asks.filter(a => a.design).map(a => a.id), body: card.body };
    if (asks.length) {
      await pg.click('#alCard .cardOption[data-option="counter"]');
      if (!(await pg.isVisible('#alCard .cardAsksDesign'))) fail('counter list has no facility design group');
      for (const a of asks) await pg.check('#alCard .askBox[value="' + a + '"]');
      await pg.click('#alSendCounter');
      await pg.evaluate(() => __AL.force('Counter', true));
      await months(pg, 3);
      await pg.waitForSelector('#alCard[data-type="offer"]:not(.hidden)', { timeout: 5000 });
      const better = await pg.evaluate(() => __AL.card());
      out.better = better.rows.filter(r => /Cooling|Power|lieu/.test(r[0])).map(r => r[0] + ': ' + r[1]);
      out.trade = better.body;
    }
    await pg.click('#alCard .cardOption[data-option="accept"]');
    Object.assign(out, await pg.evaluate(() => {
      const L = __AL.layer; L.autoDecide = function(c) { this.decide(c.options[c.options.length - 1].id); };
      if (L.s.card) L.autoDecide(L.s.card);
      __AL.game.alNoPaper = true; __AL.fastForward(14);
      return { deal: L.s.deal.cooling + '/' + L.s.deal.power, pilot: L.s.deal.pilot, online: L.hallsOnline(), gridShare: L.gridShare(),
               fumes: (L.s.health || {}).fumes || 0, water: Math.round(100 * L.s.water.use / L.s.water.cap), bills: +(L.s.bills || 0).toFixed(3),
               signNews: L.s.log.filter(e => /^You sign with/.test(e.text)).map(e => e.text)[0] || '' };
    }));
    if (run.errors.length) fail('console errors (design run):\n' + run.errors.join('\n'));
    await pg.close();
    return out;
  };
  const green = await design(['cooling', 'gas']);
  const cheap = await design([]);
  console.log('design closed+gas', JSON.stringify(green));
  console.log('design evap+grid', JSON.stringify(cheap));
  if (!green.rows.some(r => /^Cooling: Evaporative/.test(r)) || !green.rows.some(r => /^Power: Ameren grid: about 300 MW/.test(r))) fail('first offer should state evaporative cooling and grid power');
  if (!/collector wells on the Mississippi/.test(green.body)) fail('first offer should name the river collector wells');
  if (['cooling', 'clean', 'gas'].some(a => !green.designAsks.includes(a))) fail('design asks missing from the counter: ' + green.designAsks);
  if (green.deal !== 'closed/gas') fail('counter did not win closed-loop cooling and gas power: ' + green.deal);
  if (!/closed-loop cooling, but to pay for it takes/.test(green.trade)) fail('the better offer should say what closed-loop cost');
  if (!(green.water < cheap.water)) fail('closed-loop should use less water than evaporative (' + green.water + ' vs ' + cheap.water + ')');
  if (green.gridShare !== 0 || cheap.gridShare !== 1) fail('gas halls should be off the town grid');
  if (!(green.fumes > 0) || cheap.fumes) fail('gas power should hurt health, grid should not');
  if (!(cheap.bills > green.bills)) fail('grid power should raise bills more than on-site gas');
  if (!/Cooling: closed-loop/.test(green.signNews)) fail('signing news should name the design');

  // ---- Festus Fund, Purpose, town projects ----
  {
    const run = await startFestus(browser, url);
    const pg = run.page;
    await pg.click('#alCard .cardOption[data-option="go"]');
    await pg.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
    if (!(await pg.isVisible('#alPurposeHud'))) fail('Purpose is not in the top bar');
    if (!(await pg.isVisible('#alFundBox')) || !(await pg.isVisible('#alProjBox'))) fail('Festus Fund or projects missing from the panel');
    await pg.click('#alCard .cardOption[data-option="accept"]');
    // the payout slider sets how much of the fund goes out each January
    const sl = await pg.evaluate(() => { const L = __AL.layer, el = document.getElementById('alFundPayout');
      const share = v => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return L.fundShare(); };
      const r = { low: share(0), high: share(100) }; share(50); return r; });
    console.log('fund slider shares', JSON.stringify(sl));
    if (!(sl.high > sl.low)) fail('the payout slider does not change the payout');
    const fund = await pg.evaluate(() => {
      const L = __AL.layer; L.autoDecide = function(c) { this.decide(c.options[c.options.length - 1].id); };
      if (L.s.card) L.autoDecide(L.s.card);
      __AL.game.alNoPaper = true; __AL.fastForward(26);
      return { fund: Math.round(L.s.fund), paid: Math.round(L.s.fundPaid), perRes: L.s.dividendPerRes, netWorth: L.s.netWorth, budgetIncome: Math.round(L.s.dealIncome),
               news: L.s.log.filter(e => /Festus Fund dividend/.test(e.text)).map(e => e.text) };
    });
    console.log('festus fund', JSON.stringify(fund));
    if (!(fund.fund > 0) || !(fund.perRes > 0) || !(fund.netWorth >= fund.perRes) || !fund.news.length) fail('the Festus Fund did not collect and pay a dividend');
    // projects: open one from the panel, compare who builds it, let neighbors build it, watch purpose
    await pg.evaluate(() => { const L = __AL.layer; L.autoDecide = null; L.s.card = null; if (__AL.game._openWindow === 'alCard') __AL.game.alCards.close();
      __AL.game.simulation.budget.setFunds(20000); __AL.game.alNoPaper = false; __AL.game.alPanel.refresh(true); });
    if (await pg.evaluate(() => document.getElementById('alPanel').classList.contains('collapsed'))) await pg.click('#alCollapse');
    const before = await pg.evaluate(() => ({ purpose: __AL.layer.s.purpose, boost: __AL.layer.projectBoost(), cheap: __AL.layer.projectCost('park', 'robots') }));
    await pg.click('.alProj[data-proj="garden"]');
    await pg.waitForSelector('#alCard[data-type="project"]:not(.hidden)', { timeout: 5000 });
    const pc = await pg.evaluate(() => __AL.card());
    console.log('project card', pc.title, JSON.stringify(pc.options.map(o => o.label)));
    const rob = pc.options.find(o => o.id === 'robots'), nb = pc.options.find(o => o.id === 'neighbors');
    if (!rob || !nb || !(nb.cost > rob.cost)) fail('project card should offer robots (cheaper) and neighbors + robots (dearer)');
    await pg.click('#alCard .cardOption[data-option="neighbors"]');
    const after = await pg.evaluate(() => { const L = __AL.layer; L.autoDecide = function(c) { this.decide(c.options[c.options.length - 1].id); };
      __AL.game.alNoPaper = true; __AL.fastForward(5);
      const pr = L.s.projects.garden; const a0 = L.projectCost('park', 'robots'); L.s.automation = 0.9; const a1 = L.projectCost('park', 'robots');
      return { built: pr.built !== undefined, who: pr.who, boost: L.projectBoost(), purpose: L.s.purpose, state: L.projectState('garden'), costNow: a0, costAbundant: a1,
               info: document.getElementById('alProj_garden').textContent }; });
    console.log('project after', JSON.stringify(after));
    if (!after.built || after.who !== 'neighbors' || !(after.boost > before.boost)) fail('the neighbor-built garden did not open and lift purpose');
    if (!(after.costAbundant < after.costNow)) fail('project costs should fall as abundance rises');
    // ---- the news ticker opens a detail window; the sim waits while it's open; Esc and a click outside close it ----
    await pg.evaluate(() => { const g = __AL.game; g.alNoPaper = false; __AL.layer.autoDecide = null; __AL.layer.s.card = null; if (g._openWindow === 'alCard') g.alCards.close();
      __AL.game.alUI.setSpeed(3); __AL.layer.news('bad', 'Power bills: households are paying noticeably more than last year.', {alert: 'bills'}); });
    await pg.waitForTimeout(300);
    const tick = await pg.evaluate(() => { const c = getComputedStyle(document.getElementById('notifications')); return { color: c.color, bg: c.backgroundColor, fs: c.fontSize }; });
    if (tick.color !== 'rgb(244, 247, 249)' || !/rgb\(17, 26, 34\)/.test(tick.bg)) fail('ticker is not light-on-solid: ' + JSON.stringify(tick));
    await pg.click('#notifications');
    await pg.waitForSelector('#alAlert:not(.hidden)', { timeout: 3000 });
    const modal = await pg.evaluate(() => ({ text: document.getElementById('alAlertText').textContent, why: document.querySelector('#alAlert .alAlertWhy').textContent,
      stats: document.querySelectorAll('#alAlert .alAlertStats tr').length, factions: document.querySelectorAll('#alAlert .alAF').length, t0: __AL.game.simulation._cityTime }));
    console.log('alert modal', JSON.stringify(modal));
    if (!/Power bills/.test(modal.text) || !/power source/.test(modal.why) || modal.stats < 5 || modal.factions !== 5) fail('alert window is missing its context');
    await pg.waitForTimeout(1500);
    if (await pg.evaluate(() => __AL.game.simulation._cityTime) !== modal.t0) fail('the sim kept running behind the alert window');
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(200);
    if (await pg.isVisible('#alAlert')) fail('Esc did not close the alert window');
    await pg.click('#alNews li');
    await pg.waitForSelector('#alAlert:not(.hidden)', { timeout: 3000 });
    await pg.mouse.click(15, 450);
    await pg.waitForTimeout(200);
    if (await pg.isVisible('#alAlert')) fail('a click outside did not close the alert window');
    if (run.errors.length) fail('console errors (fund run):\n' + run.errors.join('\n'));
    await pg.close();
  }

  // ---- real dollars, the automation tide, the developer leaving for good, ticker asks, co-op bonds, paths, projects on the map ----
  {
    const run = await startFestus(browser, url);
    const pg = run.page;
    await pg.click('#alCard .cardOption[data-option="go"]');
    await pg.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
    const top = await pg.evaluate(() => ({ funds: document.getElementById('fundsShown').textContent, income: getComputedStyle(document.querySelector('.hudIncome')).display,
      score: getComputedStyle(document.querySelector('.hudScore')).display,
      hidden: [...document.querySelectorAll('#alCard .cardTerms tr')].filter(r => getComputedStyle(r).display === 'none').length,
      first: __AL.card().rows[0][0] + ': ' + __AL.card().rows[0][1] }));
    console.log('top bar and offer', JSON.stringify(top));
    if (!/^\$\d+(\.\d)?M$/.test(top.funds)) fail('Festus funds should read in real dollars: ' + top.funds);
    if (top.income === 'none' || top.score !== 'none') fail('the top bar should show household income, not the score, in Festus');
    if (!(top.hidden > 0) || !/^Money to the town: \$\d+k a year/.test(top.first)) fail('the offer should lead with money to the town, in real dollars, and fold the minor terms');
    await pg.click('#alAllTerms');
    if (await pg.evaluate(() => [...document.querySelectorAll('#alCard .cardTerms tr')].some(r => getComputedStyle(r).display === 'none'))) fail('All terms did not open every term');
    // say no three times: the developer leaves for good, and the tide reaches the town anyway
    await pg.click('#alCard .cardOption[data-option="reject"]');
    const no = await pg.evaluate(() => { const L = __AL.layer, g = __AL.game; g.alNoPaper = true;
      L.autoDecide = c => { if (!c.quick) L.decide(c.type === 'offer' ? 'reject' : c.options[c.options.length - 1].id); };
      const a0 = L.s.automation;
      L._forceVote = 60;   // keep this mayor in office: the test is about the developer and the tide, not the vote
      for (let i = 0; i < 84 && L.s.dev.status !== 'gone'; i++) __AL.fastForward(1);
      __AL.fastForward(12);
      while (L.mi() < 42) __AL.fastForward(1);   // far enough along that the tide has risen
      L._forceVote = undefined;
      return { status: L.s.dev.status, walks: L.s.dev.walks, due: L.s.dev.due, mi: L.mi(), card: L.s.card && L.s.card.type, last: L.s.mayor.lastCard, a0: a0, auto: +L.s.automation.toFixed(3), path: L.s.path, gone: L.s.log.some(e => /won't be back/.test(e.text)),
               income: L.incomeMix() }; });
    console.log('no deal', JSON.stringify(no));
    if (no.status !== 'gone' || !no.gone) fail('Keystone should leave for good after three walks');
    if (!(no.auto > no.a0 + 0.15)) fail('the automation tide should reach a town with no campus (' + no.a0 + ' -> ' + no.auto + ')');
    if (!(no.income.transfers > 0) || !(no.income.wages > 0)) fail('household income should split into wages and transfers');
    // a town hall ask arrives in the ticker and is decided in the alert window, without a card
    const qid = await pg.evaluate(() => { const L = __AL.layer, g = __AL.game; L.autoDecide = null; L.s.card = null;
      if (g._openWindow === 'alCard') g.alCards.close(); if (g._openWindow === 'alPaperWindow') g.alPaperWindow.close();
      g.alNoPaper = true; g.alUI.setSpeed(0);
      L.s.mayor.askLog = {}; L.s.mayor.lastQuick = -99; L.s.quickAsk = null; L.s.mayor.lastCard = L.s.months - 1;
      g.simulation.budget.setFunds(20000); L._quickAskLane(); g.alPanel.refresh(true); return L.s.quickAsk && L.s.quickAsk.id; });
    if (!qid) fail('no town hall ask reached the ticker');
    else {
      await pg.click('#notifications');
      await pg.waitForSelector('#alAlert.alQuickAsk:not(.hidden)', { timeout: 3000 });
      const opts = await pg.evaluate(() => [...document.querySelectorAll('#alAlert .alQuickOpt')].map(b => b.getAttribute('data-option')));
      if (opts.join() !== 'yes,no') fail('the ticker ask should offer two answers: ' + opts);
      await pg.click('#alAlert .alQuickOpt[data-option="yes"]');
      const done = await pg.evaluate(id => ({ pending: !!__AL.layer.s.quickAsk, log: (__AL.layer.s.mayor.askLog[id] || {}).times || 0, card: !!__AL.card() }), qid);
      console.log('ticker ask', qid, JSON.stringify(done));
      if (done.pending || done.log !== 1 || done.card) fail('the ticker ask was not decided in place');
    }
    // a co-op bond unlocks a town-owned hall; its revenue (after the bond) goes into the Festus Fund
    const bond = await pg.evaluate(() => { const L = __AL.layer, g = __AL.game; g.alNoPaper = true; g.alUI.setSpeed(2);
      const locked = L.isUnlocked('dcCoop'); L.s.mayor.coopBonds = (L.s.mayor.coopBonds || 0) + 1;
      let site = null; for (let k = 0; k < 40 && !site; k++) { const s = __AL.findSite(); if (s && !(s.x >= 33 && s.x <= 55 && s.y >= 25 && s.y <= 63)) site = s; }
      const built = site ? __AL.build('dcCoop', site.x + 1, site.y + 1) : 'no site';
      __AL.fastForward(14);
      return { locked: locked, built: built, bonded: L.bondedBuilt(), fundIn: Math.round((L.s.fundParts || {}).bonded || 0), share: +L.townShare().toFixed(2), div: L.s.dividendPerRes, path: L.s.path,
               after: L.isUnlocked('dcCoop') }; });
    console.log('co-op bond', JSON.stringify(bond));
    if (bond.built !== 'ok' || bond.bonded !== 1 || !(bond.fundIn > 0)) fail('a bonded town hall should build and pay into the Festus Fund');
    if (bond.after) fail('one bond should allow one hall');
    if (!(bond.share > 0.9) || bond.path === 'early') fail('a town owning its only hall should be building a stake, not ' + bond.path);
    // a project opens on the map, then fades and can get another season
    const proj = await pg.evaluate(() => { const L = __AL.layer, g = __AL.game; L.autoDecide = c => L.decide(c.options[c.options.length - 1].id);
      L.s.projects = L.s.projects || {}; L.s.projects.park = {who: 'neighbors', cost: 1, start: L.s.months, done: L.s.months, purpose: 15, d: {res: 1}};
      __AL.fastForward(1);
      const pr = L.s.projects.park, tile = pr.at ? g.gameMap.getTileValue(pr.at.x, pr.at.y) : -1;
      pr.built -= 30; const fade = L.projectFade('park'), renew = L.canRenew('park');
      L.autoDecide = null; L.s.card = null; const opened = L.projectCard('park'); const card = __AL.card();
      return { at: pr.at, tile: tile, fade: fade, renew: renew, opened: opened, title: card && card.title }; });
    console.log('project on the map', JSON.stringify(proj));
    if (!proj.at || !(proj.tile === 840 || (proj.tile >= 40 && proj.tile <= 43))) fail('an opened project should appear on the map');
    if (!proj.renew || !proj.opened || !/^Another season/.test(proj.title || '')) fail('a faded project should offer another season');
    // city building: a lot zoned for homes fills with houses (never apartments) while construction crews want in;
    // rents climb when every home is taken; the Homes chip and the R bar say so; robot crews cut building prices
    const city = await pg.evaluate(() => { const L = __AL.layer, g = __AL.game, m = g.gameMap; g.alNoPaper = true; L.s.card = null;
      L.autoDecide = c => L.decide(c.options[c.options.length - 1].id); g.simulation.budget.setFunds(20000);
      const crews0 = L.s.crews || 1, lot = L.openLots(true)[0]; const f0 = __AL.funds(); const zoned = lot ? __AL.build('residential', lot.x, lot.y) : 'no lot';
      const zoneCost = f0 - __AL.funds();
      L.s.mayor.crews = {until: L.s.months + 10, size: 200};   // a big campus phase: far more workers than homes
      let houses = 0, apartments = false, rentMax = 1, rvMax = -9999;
      for (let i = 0; i < 9; i++) { __AL.fastForward(1); rentMax = Math.max(rentMax, L.s.rent || 1); rvMax = Math.max(rvMax, g.simulation._valves.resValve);
        let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = m.getTileValue(lot.x + dx, lot.y + dy); if (t >= 249 && t <= 260) n++; }
        houses = Math.max(houses, n); if (m.getTileValue(lot.x, lot.y) !== 244) apartments = true; }
      g.alPanel.refresh(true); g.alUI.frame(true);
      const chip = document.getElementById('alHomes').textContent, tip = document.querySelector('#alRCI .rci_res').getAttribute('data-tip');
      // robot crews: once robots build robots, building costs half for a town that owns them
      L.s.discovered.robots_build_robots = L.s.months; __AL.fastForward(1); g.alPanel.refresh(true);
      const road = L.openLots(true)[0]; const f1 = __AL.funds(); const roadOk = __AL.build('road', road.x, road.y); const roadCost = f1 - __AL.funds();
      return { zoned, zoneCost, crews0, houses, apartments, rentMax: +rentMax.toFixed(3), rvMax, chip, tip, crews: L.s.crews, roadOk, roadCost,
               roadTip: document.getElementById('roadButton').getAttribute('data-tip'), news: L.s.log.some(e => /Robot construction crews/.test(e.text)) }; });
    console.log('city building', JSON.stringify(city));
    if (city.zoned !== 'ok' || city.zoneCost !== Math.round(25 * city.crews0)) fail('zoning an empty lot should work and cost $25k (less with robot crews): ' + city.zoneCost);
    if (city.houses < 4 || city.apartments) fail('a new block should fill with houses while people want in, and stay houses (' + city.houses + ')');
    if (!(city.rvMax > 0) || !(city.rentMax > 1.01)) fail('crews with nowhere to live should push the R bar and rents up (R ' + city.rvMax + ', rent ' + city.rentMax + ')');
    if (!/% taken/.test(city.chip) || !/^Homes \(R\)/.test(city.tip)) fail('the Homes chip and the R bar should explain homes: ' + city.chip + ' / ' + city.tip);
    if (city.crews !== 0.5 || city.roadOk !== 'ok' || city.roadCost !== 5 || !/50% off/.test(city.roadTip) || !city.news) fail('robot crews should halve building prices, in the tool tips too');
    if (run.errors.length) fail('console errors (tide run):\n' + run.errors.join('\n'));
    await pg.close();
  }

  await browser.close();
  srv.close();
  console.log(failed ? 'FESTUS FAILED' : 'FESTUS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
