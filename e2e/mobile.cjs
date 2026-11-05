// Aftersight phone test. Run `npm run build` first. Serves dist/ and plays on emulated phones (iPhone 14 portrait,
// Pixel 7 landscape) with touch: starts a game through the splash and new-game cards by tapping, one-finger pans,
// pinch-zooms, picks the road and residential tools from the toolbar and places them by tap, opens and closes the
// City pulse sheet, opens and closes the newspaper, and fails on console errors. Screenshots go to $OUT.
//
//   NODE_PATH=/path/to/playwright/node_modules OUT=/tmp/shots node e2e/mobile.cjs

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
const OUT = process.env.OUT || path.join(__dirname, '..', 'shots-mobile');
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

const PHONES = [
  { name: 'iphone14-portrait', dev: devices['iPhone 14'], landscape: false },
  { name: 'pixel7-landscape', dev: devices['Pixel 7'], landscape: true },
];

let failed = false;
const fail = (who, msg) => { console.error('FAIL [' + who + ']: ' + msg); failed = true; };

async function play(browser, url, phone) {
  const who = phone.name;
  const vp = phone.landscape ? { width: phone.dev.viewport.height, height: phone.dev.viewport.width } : phone.dev.viewport;
  const ctx = await browser.newContext({ ...phone.dev, viewport: vp, screen: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const shot = async (n) => { const f = path.join(OUT, who + '-' + n + '.png'); await page.screenshot({ path: f }); console.log('screenshot', f); };
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const cam = () => page.evaluate(() => { const g = __AL.game.gameCanvas; return { x: g._camX, y: g._camY, z: g._zoom, idx: g._zoomIdx }; });
  const canvasBox = () => page.evaluate(() => { const r = document.getElementById('MicropolisCanvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

  // the sim can pop a window of its own (a disaster, a milestone) at any time: close it by tapping its button
  const closeDialogs = async () => {
    for (let i = 0; i < 3 && await page.evaluate(() => __AL.game.dialogOpen); i++) {
      const sel = await page.evaluate(() => {
        const w = [...document.querySelectorAll('[id$=Window], #alPaper')].find(n => n.offsetParent !== null);
        if (!w) return null;
        const b = [...w.querySelectorAll('button, input[type=submit]')].filter(n => n.offsetParent !== null).pop();
        if (!b) return null;
        if (!b.id) b.id = 'mobileTestClose';
        return { win: w.id, btn: '#' + b.id };
      });
      if (!sel) break;
      console.log(who, 'closing a window the sim opened:', sel.win);
      await page.locator(sel.btn).scrollIntoViewIfNeeded();
      await page.tap(sel.btn);
      await page.waitForTimeout(300);
    }
  };

  await page.goto(url);
  await page.waitForSelector('#splashSandbox:visible', { timeout: 20000 });
  if (await page.isVisible('#tooSmall')) fail(who, 'the "screen too small" blocker is showing');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (sw > 1) fail(who, 'page is ' + sw + 'px wider than the screen');
  await shot('1-splash');
  await page.tap('#splashSandbox');
  await page.waitForSelector('#nameForm:visible', { timeout: 15000 });
  await page.fill('#nameForm', 'Pocket');
  await page.tap('#playit');
  await page.waitForFunction(() => window.__AL, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { __AL.game.alNoPaper = true; });

  // layout: canvas fills the stage at device resolution, nothing hangs off the screen, the game is running
  const lay = await page.evaluate(() => {
    const c = document.getElementById('MicropolisCanvas'), r = c.getBoundingClientRect();
    const box = id => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    return { css: [r.width, r.height], px: [c.width, c.height], dpr: Math.min(2, devicePixelRatio), w: innerWidth, h: innerHeight,
      header: box('header'), controls: box('controls'), panel: box('alPanel'), scroll: document.documentElement.scrollWidth,
      headerOverflow: Math.max(document.getElementById('header').scrollWidth - document.getElementById('header').clientWidth, document.getElementById('hud').scrollWidth - document.getElementById('hud').clientWidth),
      paused: __AL.game.simulation.isPaused(), collapsed: document.getElementById('alPanel').classList.contains('collapsed') };
  });
  console.log(who, 'layout', JSON.stringify(lay));
  if (Math.abs(lay.css[0] - lay.w) > 1) fail(who, 'canvas is not full width');
  if (Math.abs(lay.px[0] - lay.css[0] * lay.dpr) > 2) fail(who, 'canvas backing store ignores devicePixelRatio');
  if (lay.controls[0] < -1 || lay.controls[2] > lay.w + 1) fail(who, 'toolbar runs off the screen');
  if (lay.headerOverflow > 1) fail(who, 'top bar overflows by ' + lay.headerOverflow + 'px');
  if (lay.scroll > lay.w + 1) fail(who, 'page scrolls sideways');
  if (lay.paused) fail(who, 'game is paused on load');
  if (!lay.collapsed) fail(who, 'City pulse sheet should start collapsed on a phone');
  if (await page.isVisible('#touchWarnWindow')) fail(who, 'touch warning dialog popped up');
  await shot('2-game');

  // one-finger pan
  const cb = await canvasBox();
  const cx = cb.x + cb.w / 2, cy = cb.y + cb.h * 0.4;
  const c0 = await cam();
  await touch('touchStart', [[cx, cy]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - i * 12, cy - i * 6]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const c1 = await cam();
  console.log(who, 'pan', JSON.stringify(c0), '->', JSON.stringify(c1));
  if (Math.abs(c1.x - c0.x) < 40 || Math.abs(c1.y - c0.y) < 20) fail(who, 'one-finger drag did not pan');
  if (Math.abs(c1.z - c0.z) > 1e-6) fail(who, 'pan changed the zoom');

  // two-finger pinch out (zoom in), then settle
  await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 30 - i * 10, cy], [cx + 30 + i * 10, cy]]);
  const mid = await cam();
  await touch('touchEnd', []);
  await page.waitForTimeout(700);
  const c2 = await cam();
  console.log(who, 'pinch', JSON.stringify(c1), '-> live', mid.z.toFixed(3), '-> settled', JSON.stringify(c2));
  if (!(mid.z > c1.z * 1.5)) fail(who, 'pinch did not zoom in live');
  if (!(c2.idx > c1.idx)) fail(who, 'pinch did not settle on a closer zoom level');
  // pinch back out a bit so there's room to build
  await touch('touchStart', [[cx - 120, cy], [cx + 120, cy]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 120 + i * 10, cy], [cx + 120 - i * 10, cy]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(700);

  // tap to build: pick the tool in the toolbar, centre on open ground, tap the tile
  const open = await page.evaluate(() => {
    const m = __AL.game.gameMap, t = __AL.game.starterTown;
    for (let r = 3; r < 40; r++)
      for (let y = Math.max(2, t.y - r); y < Math.min(m.height - 3, t.y + t.h + r); y++)
        for (let x = Math.max(2, t.x - r); x < Math.min(m.width - 3, t.x + t.w + r); x++) {
          let ok = true;
          for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) if (m.getTileValue(x + dx, y + dy) !== 0) ok = false;
          if (ok) return { x, y };
        }
    return null;
  });
  if (!open) fail(who, 'no open ground found');
  else {
    const tapTile = async (tool, x, y) => {
      await page.evaluate(([x, y]) => __AL.game.gameCanvas.centreOn(x, y), [x, y]);
      await page.waitForTimeout(150);
      await closeDialogs();
      await page.locator('#' + tool + 'Button').scrollIntoViewIfNeeded();
      await page.tap('#' + tool + 'Button', { timeout: 8000 }).catch(async e => {
        const over = await page.evaluate(id => { const b = document.getElementById(id).getBoundingClientRect(); const n = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { rect: [b.left, b.top, b.width, b.height], top: n && (n.id || n.className || n.tagName), dialog: __AL.game.dialogOpen, open: [...document.querySelectorAll('[id$=Window], #alPaper')].filter(n => n.offsetParent !== null).map(n => n.id + ': ' + n.textContent.trim().slice(0, 80)) }; }, tool + 'Button');
        throw new Error('could not tap the ' + tool + ' button: ' + JSON.stringify(over) + '\n' + e.message.split('\n').slice(0, 8).join('\n'));
      });
      const sel = await page.evaluate(() => __AL.game.inputStatus.toolName);
      if (sel !== tool) fail(who, 'tapping the ' + tool + ' button selected ' + sel);
      const p = await page.evaluate(([x, y]) => { const g = __AL.game.gameCanvas; const c = g.tileToCanvasCoordinate(x, y); const r = g._canvas.getBoundingClientRect(); return c && { x: r.left + c.x, y: r.top + c.y }; }, [x, y]);
      if (!p) { fail(who, 'tile not on screen'); return -1; }
      const funds0 = await page.evaluate(() => __AL.funds());
      await page.evaluate(() => { const g = __AL.game.gameCanvas; if (!g._tapWrapped) { const o = g.onTap; g._taps = []; g.onTap = function(x, y) { g._taps.push([x, y, !!__AL.game.inputStatus.currentTool, !!__AL.game.dialogOpen]); return o.apply(this, arguments); }; g._tapWrapped = true; } });
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(250);
      const v = await page.evaluate(([x, y]) => __AL.game.gameMap.getTileValue(x, y), [x, y]);
      const funds1 = await page.evaluate(() => __AL.funds());
      const taps = await page.evaluate(() => __AL.game.gameCanvas._taps.splice(0));
      console.log(who, 'tap', tool, 'at', x, y, 'screen', Math.round(p.x), Math.round(p.y), '-> tile', v, 'funds', funds0, '->', funds1, 'onTap', JSON.stringify(taps));
      return { v, spent: funds0 - funds1 };
    };
    const road = await tapTile('road', open.x - 2, open.y);
    if (!(road.v >= 64 && road.v <= 206)) fail(who, 'tap with the road tool did not lay a road');
    const nb = await page.evaluate(([x, y]) => [__AL.game.gameMap.getTileValue(x - 1, y), __AL.game.gameMap.getTileValue(x + 1, y)], [open.x - 2, open.y]);
    if (nb[1] !== 0) fail(who, 'one tap should lay exactly one road tile, neighbours are ' + nb);
    const res = await tapTile('residential', open.x + 1, open.y);
    if (res.v !== 244) fail(who, 'tap with the residential tool did not zone (tile ' + res.v + ')');
    await shot('3-built');
  }

  // City pulse sheet: open, look, close
  await page.tap('#alCollapse');
  await page.waitForTimeout(300);
  const openSheet = await page.evaluate(() => { const p = document.getElementById('alPanel'); const r = p.getBoundingClientRect(); return { collapsed: p.classList.contains('collapsed'), top: r.top, bottom: r.bottom, h: innerHeight }; });
  if (openSheet.collapsed) fail(who, 'sheet did not open');
  if (openSheet.bottom > openSheet.h + 1 || openSheet.top < 40) fail(who, 'sheet does not fit: ' + JSON.stringify(openSheet));
  await shot('4-pulse-sheet');
  await page.tap('#alCollapse');
  await page.waitForTimeout(200);
  if (!(await page.evaluate(() => document.getElementById('alPanel').classList.contains('collapsed')))) fail(who, 'sheet did not close');

  // menu and newspaper
  await page.tap('#menuToggle');
  if (!(await page.isVisible('#budgetRequest')) || !(await page.isVisible('#saveRequest')) || !(await page.isVisible('#feedbackLink'))) fail(who, 'menu did not open with every item');
  await page.tap('#menuToggle');
  await page.evaluate(() => { __AL.game.alNoPaper = false; const l = __AL.layer; delete l.s.discovered.the_cure; __AL.discover('the_cure'); });
  await page.waitForSelector('#alPaper:not(.hidden)', { timeout: 10000 }).catch(async e => { throw new Error('newspaper never opened: ' + JSON.stringify(await page.evaluate(() => ({ cls: document.getElementById('alPaper') && document.getElementById('alPaper').className, dialog: __AL.game.dialogOpen, vis: [...document.querySelectorAll('.open, [style*="display: block"]')].map(n => n.id).filter(Boolean) })))); });
  await page.waitForTimeout(400);
  const paper = await page.evaluate(() => { const r = document.getElementById('alPaper').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  if (paper.l < 0 || paper.r > paper.w) fail(who, 'newspaper wider than the screen');
  await shot('5-newspaper');
  await page.locator('#alPaperOK').scrollIntoViewIfNeeded();
  await page.tap('#alPaperOK');
  await page.waitForTimeout(200);
  if (await page.isVisible('#alPaper')) fail(who, 'newspaper did not close');

  if (errors.length) fail(who, 'console errors:\n' + errors.join('\n'));
  await ctx.close();
}

// Festus on a phone: the mayor's cards fit the screen and work by touch
async function festus(browser, url, phone) {
  const who = phone.name + '-festus';
  const vp = phone.landscape ? { width: phone.dev.viewport.height, height: phone.dev.viewport.width } : phone.dev.viewport;
  const ctx = await browser.newContext({ ...phone.dev, viewport: vp, screen: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const shot = async (n) => { const f = path.join(OUT, who + '-' + n + '.png'); await page.screenshot({ path: f }); console.log('screenshot', f); };
  const fits = async () => { const r = await page.evaluate(() => { const b = document.getElementById('alCard').getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: innerWidth, h: innerHeight }; });
    if (r.l < 0 || r.r > r.w + 1 || r.t < 0 || r.b > r.h + 1) fail(who, 'card does not fit the screen: ' + JSON.stringify(r)); };
  const tapIn = async sel => { await page.locator(sel).scrollIntoViewIfNeeded(); await page.tap(sel); await page.waitForTimeout(200); };

  await page.goto(url);
  await page.waitForSelector('#splashFestus:visible', { timeout: 20000 });
  await page.tap('#splashFestus');
  await page.waitForFunction(() => window.__AL, null, { timeout: 90000 });
  await page.waitForSelector('#alCard:not(.hidden)', { timeout: 10000 });
  await fits();
  if (!(await page.isVisible('#alApproval'))) fail(who, 'approval is not in the top bar');
  await tapIn('#alCard .cardOption[data-option="go"]');
  await page.waitForSelector('#alCard[data-type="offer"]:not(.hidden)');
  await fits();
  await shot('1-offer');
  await tapIn('#alCard .cardOption[data-option="counter"]');
  await tapIn('#alCard .cardAsks > .askRow:nth-child(2)');
  await tapIn('#alCard .cardAsks > .askRow:nth-child(4)');
  await tapIn('#alSendCounter');
  const st = await page.evaluate(() => ({ status: __AL.mayor().dev.status, asks: __AL.mayor().dev.asks, open: __AL.game.dialogOpen }));
  console.log(who, 'counter', JSON.stringify(st));
  if (st.status !== 'review' || st.asks.length !== 2) fail(who, 'counter by touch did not go through');
  if (st.open) fail(who, 'card did not close after the counter');
  await shot('2-after-counter');
  // the build menu: Compute (with the town's compute and equity) and AfterSight sections both show a label on a phone
  const sec = await page.evaluate(() => [...document.querySelectorAll('.alGroupCompute .toolGroupLabel, .alGroupAfter .toolGroupLabel')].map(e => ({ t: e.textContent, vis: getComputedStyle(e).display !== 'none' })));
  if (sec.length !== 2 || !sec.every(x => x.vis) || !/Compute.*\/mo/.test(sec[0].t) || !/AfterSight/.test(sec[1].t)) fail(who, 'build menu sections missing on the phone: ' + JSON.stringify(sec));
  // the news ticker: readable, and a tap opens the full story
  await page.evaluate(() => { __AL.layer.news('bad', 'Water: test alert with enough words to need two lines on a phone screen, so the clamp and the More link show.', {alert: 'water'}); });
  await page.waitForTimeout(300);
  const bubble = await page.evaluate(() => { const e = document.getElementById('notifications'), r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return { color: c.color, bg: c.backgroundColor, left: r.left, right: r.right, w: innerWidth }; });
  if (bubble.color !== 'rgb(244, 247, 249)' || bubble.left < 0 || bubble.right > bubble.w) fail(who, 'ticker unreadable or off screen: ' + JSON.stringify(bubble));
  await page.tap('#notifications');
  await page.waitForSelector('#alAlert:not(.hidden)', { timeout: 3000 });
  const am = await page.evaluate(() => { const r = document.getElementById('alAlert').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, why: !!document.querySelector('#alAlert .alAlertWhy'), paused: __AL.game.dialogOpen }; });
  if (!am.why || !am.paused || am.top < 0 || am.bottom > am.h + 1) fail(who, 'alert window wrong: ' + JSON.stringify(am));
  await shot('3-alert-modal');
  await page.tap('#alAlertClose');
  await page.waitForTimeout(200);
  if (await page.isVisible('#alAlert')) fail(who, 'alert window did not close on X');
  if (errors.length) fail(who, 'console errors:\n' + errors.join('\n'));
  await ctx.close();
}

(async () => {
  const srv = await serve();
  const url = process.env.BASE_URL || `http://localhost:${srv.address().port}/index.html`;   // BASE_URL tests a deployed build
  const browser = await chromium.launch();
  for (const phone of PHONES) {
    try { await play(browser, url, phone); } catch (e) { fail(phone.name, e.stack || e.message); }
    try { await festus(browser, url, phone); } catch (e) { fail(phone.name + '-festus', e.stack || e.message); }
  }
  await browser.close();
  srv.close();
  console.log(failed ? 'MOBILE FAILED' : 'MOBILE PASSED');
  process.exit(failed ? 1 : 0);
})();
