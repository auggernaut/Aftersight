// Aftersight Festus scenario test. Run `npm run build` first. Serves dist/ and plays the Festus, MO scenario on a
// desktop browser through the real UI: the intro card, the developer's first offer, a counter with two asks, the
// better offer, accepting it, the campus going up, a breakthrough card, investing, placing the unlocked building,
// and both election outcomes (win and loss); then a third game where the developer walks (the site clears and goes
// back to hay) and returns with a bigger campus, the one-time town-to-city milestone, and the sparse status alerts.
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
  await page.evaluate(() => { const L = __AL.layer, R = L.s.research; R.passed.frontier_model = 1; R.passed.robots_build_robots = 1; R.next = 0; L.s.mayor.lastCard = -99; L.s.mayor.lastType = 'ask';   // no town-hall ask jumps the queue
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

  await browser.close();
  srv.close();
  console.log(failed ? 'FESTUS FAILED' : 'FESTUS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
