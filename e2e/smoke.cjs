// Afterlight browser smoke test (isometric build).
// Builds nothing itself: run `npm run build` first. Serves dist/, starts a game with the 2026 starter town and
// plays it through the new interface: picks tools from the toolbar and clicks/drags on iso tiles (so screen-to-tile
// picking is exercised), bulldozes, queries, zooms with the wheel, pans, changes speed and opens the About panel.
// Then it fast-forwards about four game years, flips policies through the panel, and checks that at least one
// negative and one positive Afterlight event fire, with no console errors. Screenshots go to $OUT.
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
  await page.waitForSelector('#splashSandbox:visible');
  await page.click('#splashSandbox');
  await page.fill('#nameForm', 'Afterlight');
  await page.click('#playit');
  await page.waitForFunction(() => window.__AL, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const c0 = await page.evaluate(() => __AL.census());
  console.log('start', JSON.stringify(c0), JSON.stringify(await page.evaluate(() => __AL.date())));
  if (c0.dc < 1) fail('starter town has no data center');
  if (c0.labs < 1) fail('starter town has no running Research Lab');

  // Close any Micropolis dialog (e.g. "now a city!") that fast-forwarding popped up
  const closeDialogs = async () => {
    for (const sel of ['#congratsOK', '#budgetOK', '#alPaperOK', '#queryOK', '#aboutOK']) if (await page.isVisible(sel)) await page.click(sel);
  };
  // Papers would pause the game on every discovery during fast-forward; we look at one on purpose below
  await page.evaluate(() => { __AL.game.alNoPaper = true;
    // the upstream "X is now a town!" window can pop mid-drag and steal clicks; this test isn't about it
    ['Town', 'City', 'Capital', 'Metropolis', 'Megalopolis'].forEach(k => { __AL.game['_reached' + k] = true; });
    // Breakthroughs are decision cards now. This test plays a mayor who funds every one and says no to asks, and
    // keeps winning elections, so the long run reaches every breakthrough (e2e/festus.cjs covers the cards themselves).
    __AL.force('Vote', 70);
    __AL.layer.autoDecide = card => {
      if (card.type === 'research') { const b = __AL.game.simulation.budget; if (b.totalFunds < 20000) b.setFunds(20000); }
      const o = card.options.filter(o => !o.disabled);
      const pick = o.find(x => x.id === 'invest') || o.find(x => x.id === 'accept') || o[o.length - 1];
      __AL.layer.decide(pick.id, []);
    }; });

  const tileValue = (x, y) => page.evaluate(([x, y]) => __AL.game.gameMap.getTileValue(x, y), [x, y]);
  const view = (x, y, zoom) => page.evaluate(([x, y, z]) => { const g = __AL.game.gameCanvas; if (z !== undefined) g.setZoomNow(z); g.centreOn(x, y); }, [x, y, zoom]);
  // Page coordinates of the centre of map tile x,y in the iso view
  const tilePos = async (x, y) => {
    const p = await page.evaluate(([x, y]) => { const g = __AL.game.gameCanvas; const c = g.tileToCanvasCoordinate(x, y);
      const r = g._canvas.getBoundingClientRect(); return c && { x: r.left + c.x, y: r.top + c.y }; }, [x, y]);
    if (!p) throw new Error('tile ' + x + ',' + y + ' is off screen');
    // round-trip through the picker the game uses
    const back = await page.evaluate(([px, py]) => { const g = __AL.game.gameCanvas; const r = g._canvas.getBoundingClientRect();
      return g.canvasCoordinateToTileCoordinate(px - r.left, py - r.top); }, [p.x, p.y]);
    if (!back || back.x !== x || back.y !== y) fail('picking mismatch at ' + x + ',' + y + ': got ' + JSON.stringify(back));
    return p;
  };
  const pickTool = async (tool) => { await page.click('#' + tool + 'Button'); };
  const clickTile = async (x, y) => {
    const p = await tilePos(x, y);
    await page.mouse.move(p.x, p.y - 40, { steps: 2 });   // entering the canvas arms the tool
    await page.mouse.move(p.x, p.y, { steps: 2 });
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(80);
  };
  const dragTiles = async (tiles) => {
    const pts = [];
    for (const [x, y] of tiles) pts.push(await tilePos(x, y));
    await page.mouse.move(pts[0].x, pts[0].y - 40);
    await page.mouse.move(pts[0].x, pts[0].y, { steps: 2 });
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(80);
  };

  // ---- 01: the 2026 town, overview ----
  const town = await page.evaluate(() => __AL.game.starterTown);
  await view(town.x + 13, town.y + 11, 2);
  await page.waitForTimeout(1200);
  await shot('01-overview-2026.png');

  // ---- build through the UI: toolbar button, then click the iso tile ----
  for (const tool of ['solar', 'dcCoop', 'depotCoop']) {
    const site = await page.evaluate(() => __AL.findSite());
    if (!site) { fail('no site for ' + tool); continue; }
    const cx = site.x + 1, cy = site.y + 1;
    await view(cx, cy, 3);
    await page.waitForTimeout(150);
    const funds0 = await page.evaluate(() => __AL.funds());
    await pickTool(tool);
    await clickTile(cx, cy);
    const v = await tileValue(cx, cy);
    const ok = await page.evaluate(([t, v]) => { const m = {solar: 978, dcCoop: 969, depotCoop: 996}; return v === m[t]; }, [tool, v]);
    console.log('built', tool, 'at', cx, cy, 'tile', v, 'funds', funds0, '->', await page.evaluate(() => __AL.funds()));
    if (!ok) fail('clicking with ' + tool + ' did not build it (tile ' + v + ')');
  }

  // A road dragged across open ground, then bulldozed at one end
  const run = await page.evaluate(() => {
    const m = __AL.game.gameMap, t = __AL.game.starterTown;
    for (let r = 2; r < 40; r++)
      for (let y = Math.max(1, t.y - r); y < Math.min(m.height - 1, t.y + t.h + r); y++)
        for (let x = Math.max(1, t.x - r); x < Math.min(m.width - 7, t.x + t.w + r); x++) {
          let ok = true;
          for (let i = 0; i < 6 && ok; i++) for (let dy = -1; dy <= 1 && ok; dy++) if (m.getTileValue(x + i, y + dy) !== 0) ok = false;
          if (ok) return { x, y };
        }
    return null;
  });
  if (!run) fail('no open ground for a road');
  else {
    await view(run.x + 3, run.y, 4);
    await page.waitForTimeout(150);
    await pickTool('road');
    const tiles = [0, 1, 2, 3, 4, 5].map(i => [run.x + i, run.y]);
    await dragTiles(tiles);
    const vals = [];
    for (const [x, y] of tiles) vals.push(await tileValue(x, y));
    console.log('road drag', JSON.stringify(run), vals.join(','));
    if (!vals.every(v => v >= 64 && v <= 206)) fail('dragging the road tool did not lay a road: ' + vals);
    await pickTool('bulldozer');
    await clickTile(run.x + 5, run.y);
    const after = await tileValue(run.x + 5, run.y);
    console.log('bulldozed tile ->', after);
    if (after !== 0) fail('bulldozer did not clear the road end (tile ' + after + ')');
  }

  // Query a building
  await view(town.x + 13, town.y + 11, 3);
  await page.waitForTimeout(150);
  await pickTool('query');
  await clickTile(town.x + 13, town.y + 11);
  await page.waitForTimeout(200);
  if (!(await page.isVisible('#queryWindow'))) fail('query window did not open');
  await closeDialogs();
  await page.keyboard.press('Escape');

  // Wheel zoom and right-drag pan
  await view(town.x + 13, town.y + 11, 2);
  const cam0 = await page.evaluate(() => { const g = __AL.game.gameCanvas; return { z: g._zoomIdx, x: g._camX, y: g._camY }; });
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(400);
  await page.mouse.move(700, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(560, 380, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  const cam1 = await page.evaluate(() => { const g = __AL.game.gameCanvas; return { z: g._zoomIdx, x: g._camX, y: g._camY }; });
  console.log('camera', JSON.stringify(cam0), '->', JSON.stringify(cam1));
  if (cam1.z <= cam0.z) fail('mouse wheel did not zoom in');
  if (Math.abs(cam1.x - cam0.x) < 20) fail('drag did not pan');

  // Speed controls and the About panel (credits and licenses)
  await page.click('.speedButton[data-speed="3"]');
  if ((await page.evaluate(() => __AL.game.simulation._speed)) !== 3) fail('fast speed button did not work');
  await page.click('.speedButton[data-speed="0"]');
  if (!(await page.evaluate(() => __AL.game.isPaused))) fail('pause button did not pause');
  await page.click('.speedButton[data-speed="2"]');
  if (await page.evaluate(() => __AL.game.isPaused)) fail('play button did not resume');
  await page.click('#moreRequest');   // About sits under More
  await page.click('#aboutRequest');
  const about = await page.textContent('#aboutWindow');
  if (!(await page.isVisible('#aboutWindow')) || !/GNU General Public License/.test(about) || !/Micropolis Public Name License/.test(about)) fail('About panel missing license text');
  await page.click('#aboutOK');
  const foot = await page.textContent('#footer');
  if (!/micropolisJS/.test(foot) || !/Micropolis Public Name License/.test(foot) || !(await page.isVisible('#footer'))) fail('footer attribution missing');

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

  await page.evaluate(() => __AL.game.inputStatus.clearTool());
  // ---- 02: downtown, zoomed in ----
  const downtown = await page.evaluate(() => {
    const m = __AL.game.gameMap; let best = null;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      const v = m.getTileValue(x, y);
      if (v >= 436 && v <= 609 && m.getTile(x, y).isZone()) { const pop = Math.floor((v - 436) / 9) % 5; if (!best || pop > best.pop) best = { x, y, pop }; }
    }
    return best;
  });
  if (downtown) { await view(downtown.x, downtown.y + 1, 5); await page.waitForTimeout(1200); await shot('02-downtown-zoom.png'); }
  else fail('no commercial zone to frame downtown');

  // ---- 04: the interface with the mood panel, a tooltip showing ----
  await view(town.x + 13, town.y + 11, 3);
  await page.hover('#dcHelixButton');
  await page.waitForTimeout(900);
  await shot('04-ui-mood-panel.png');
  await page.locator('#alPanel').screenshot({ path: path.join(OUT, '04b-mood-panel.png') });
  console.log('screenshot', path.join(OUT, '04b-mood-panel.png'));

  // ---- 03: a data center with a protest ----
  // pause so the camp is still there when the picture is taken
  await page.click('.speedButton[data-speed="0"]');
  await page.mouse.move(700, 300);
  let protest = await page.evaluate(() => __AL.state().protest);
  if (!protest) { await page.evaluate(() => __AL.protest()); protest = await page.evaluate(() => __AL.state().protest); }
  if (!protest) fail('could not start a protest');
  else {
    await view(protest.x, protest.y, 4);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const n = document.querySelector('#notifications'); if (n) n.style.display = 'block'; });
    await shot('03-datacenter-protest.png');
  }

  // ---- 05: the Valley Ledger. Fresh game state may have found everything already, so re-show the Cure page ----
  await page.mouse.move(700, 300);
  await page.evaluate(() => { __AL.game.alNoPaper = false; const l = __AL.layer; delete l.s.discovered.the_cure; __AL.discover('the_cure'); });
  await page.waitForSelector('#alPaper:not(.hidden)');
  await page.waitForTimeout(400);
  await shot('05-newspaper.png');
  await page.click('#alPaperOK');
  if (await page.isVisible('#alPaper')) fail('newspaper did not close');
  await page.evaluate(() => { __AL.game.alNoPaper = true; });

  // Riots spread like fire around the protest site: picture them while paused, then let a month pass
  const before = await page.evaluate(() => __AL.game.simulation._census.firePop);
  if (!(await page.evaluate(() => __AL.state().protest))) await page.evaluate(() => __AL.protest());
  const rioted = await page.evaluate(() => __AL.riot());
  if (!rioted) fail('riot did not start');
  const fire = await page.evaluate(() => { const m = __AL.game.gameMap; const f = [];
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) { const v = m.getTileValue(x, y); if (v >= 56 && v <= 63) f.push([x, y]); }
    return f; });
  console.log('riot fires', fire.length);
  if (!fire.length) fail('riot set no fires');
  else {
    const fx = Math.round(fire.reduce((a, f) => a + f[0], 0) / fire.length), fy = Math.round(fire.reduce((a, f) => a + f[1], 0) / fire.length);
    await view(fx, fy, 4);
    await page.waitForTimeout(900);
    await shot('06-riot.png');
  }
  await page.click('.speedButton[data-speed="2"]');
  await page.evaluate(() => __AL.fastForward(1));
  await closeDialogs();
  console.log('fire tiles before/after a month', before, await page.evaluate(() => __AL.game.simulation._census.firePop));

  // Unlocked tier: fusion plant
  await page.evaluate(() => __AL.discover('fusion'));
  await closeDialogs();
  const site = await page.evaluate(() => __AL.findSite());
  if (site) console.log('fusion', await page.evaluate(s => __AL.build('fusion', s.x + 1, s.y + 1), site));

  // Save and reload keeps the Afterlight state
  const saved = await page.evaluate(() => { __AL.game.save(); const raw = localStorage.getItem('micropolisJSGame'); return raw ? JSON.parse(raw).afterlight : null; });
  if (!saved || saved.months < 40) fail('save did not include afterlight state');

  await view(town.x + 13, town.y + 11, 2);
  await page.waitForTimeout(1200);
  await shot('07-city-late.png');
  // performance: frames per second over two seconds at the default zoom
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now();
    (function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round(n / 2)); })(); }));
  console.log('fps', fps);

  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ timeline, log }, null, 2));
  if (errors.length) fail('console errors:\n' + errors.join('\n'));
  console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
