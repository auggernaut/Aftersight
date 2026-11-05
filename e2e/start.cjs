// AfterSight start screen and sharing test. Run `npm run build` first. Serves dist/ (or BASE_URL) and checks what a
// new player meets: the start screen (Festus first, the sandbox behind a link, the disclaimer), one click into
// Festus, the top bar fitting a 1280px laptop, the More menu, the counter's buttons in view, the first tips, autosave,
// Continue, asking before a new game replaces the save (?play=festus, Play Festus, the sandbox; not Play again), the
// sandbox form, and the phone menu, with no console errors.
//
//   NODE_PATH=/path/to/playwright/node_modules OUT=shots node e2e/start.cjs
const { chromium, devices } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist'), OUT = path.join(process.env.OUT || path.join(__dirname, '..', 'shots'), 'start'); fs.mkdirSync(OUT, {recursive: true});
const srv = http.createServer((q, r) => { const p = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); r.end(); return; } const ext = path.extname(p); r.writeHead(200, {'Content-Type': {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}[ext] || 'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0);
const URL = process.env.BASE_URL || ('http://localhost:' + srv.address().port + '/index.html');
const fails = []; const fail = m => { fails.push(m); console.log('FAIL: ' + m); };
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 1440, height: 900}}); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('#splashFestus', {state: 'visible'}); await page.waitForTimeout(500);
  await page.screenshot({path: OUT + '/1-splash.png'});
  const sp = await page.evaluate(() => ({cont: !document.getElementById('continueBox').classList.contains('hidden'), sandbox: !!document.getElementById('splashSandbox').offsetParent, note: document.querySelector('.townNote').textContent}));
  console.log('splash', JSON.stringify(sp)); if (sp.cont) fail('Continue should not show without a save');
  // sandbox form and back
  await page.click('#splashSandbox'); await page.waitForTimeout(300); await page.screenshot({path: OUT + '/2-sandbox.png'});
  const sb = await page.evaluate(() => ({start: !!document.getElementById('start').offsetParent, festusHidden: !document.getElementById('alScenFestus').closest('label').offsetParent, checked: (document.querySelector('input[name=alScenario]:checked') || {}).value}));
  console.log('sandbox', JSON.stringify(sb)); if (!sb.start || !sb.festusHidden || sb.checked !== 'starter') fail('sandbox form');
  await page.click('#splashBack'); await page.waitForTimeout(200);
  if (!(await page.isVisible('#splashFestus'))) fail('Back should return to the start screen');
  // one click into Festus
  await page.click('#splashFestus');
  await page.waitForSelector('#alCard', {state: 'visible', timeout: 90000}); await page.waitForTimeout(400);
  if (await page.isVisible('#start')) fail('the new-game form should not show for Festus');
  await page.screenshot({path: OUT + '/3-intro.png'});
  const intro = await page.evaluate(() => ({h: document.getElementById('alCard').scrollHeight, ch: document.getElementById('alCard').clientHeight, text: document.getElementById('alCard').innerText}));
  console.log('intro height', intro.h, intro.ch); if (!/fictional/.test(intro.text)) fail('intro should carry the disclaimer');
  // header fits
  for (const w of [1920, 1440, 1366, 1280]) {
    await page.setViewportSize({width: w, height: 800}); await page.waitForTimeout(250);
    const r = await page.evaluate(() => { const vis = [...document.querySelectorAll('#header button, #header a, #hud .hudItem')].filter(e => e.offsetParent && !e.closest('#menuMore'));
      return {off: vis.filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.textContent.trim()), shown: vis.filter(e => e.matches('.miscButton')).map(e => e.textContent.trim())}; });
    console.log('header', w, JSON.stringify(r)); if (r.off.length) fail('header overflows at ' + w + ': ' + r.off.join(', '));
  }
  await page.setViewportSize({width: 1440, height: 900});
  // the intro, then the offer and a counter
  await page.click('#alCard .cardOption[data-option="go"]'); await page.waitForTimeout(400);
  await page.screenshot({path: OUT + '/4-offer.png'});
  const offer = await page.evaluate(() => ({lev: (document.querySelector('.cardLev') || {}).getAttribute ? document.querySelector('.cardLev').getAttribute('data-tip') : null, body: document.querySelector('#alCard .cardBody').textContent}));
  console.log('offer', JSON.stringify(offer)); if (!offer.lev) fail('leverage should explain itself');
  await page.click('#alCard .cardOption[data-option="counter"]'); await page.waitForTimeout(300);
  await page.click('#alCard .askRow >> nth=0'); await page.waitForTimeout(200);
  const send = await page.evaluate(() => { const r = document.getElementById('alSendCounter').getBoundingClientRect(); return {bottom: Math.round(r.bottom), top: Math.round(r.top), vh: innerHeight}; });
  console.log('send button', JSON.stringify(send)); if (send.bottom > send.vh || send.top < 0) fail('the Send counter button should be in view');
  await page.screenshot({path: OUT + '/5-counter.png'});
  await page.click('#alSendCounter'); await page.waitForTimeout(300);
  // More menu
  await page.evaluate(() => { if (document.getElementById('alPaper') && document.getElementById('alPaper').offsetParent) document.getElementById('alPaperOK').click(); });
  await page.click('#moreRequest'); await page.waitForTimeout(200);
  const more = await page.evaluate(() => [...document.querySelectorAll('#menuMore .miscButton')].filter(e => e.offsetParent).map(e => e.textContent.trim()));
  console.log('more', JSON.stringify(more)); if (more.join() !== 'Settings,Photo,Feedback,About,New game') fail('More menu: ' + more.join());
  await page.screenshot({path: OUT + '/6-more.png'});
  await page.mouse.click(700, 500); await page.waitForTimeout(200);
  if (await page.isVisible('#menuMore')) fail('More should close on an outside click');
  // play a few months; tips; autosave
  await page.evaluate(() => { const L = __AL.layer, g = __AL.game; g.alNoPaper = true; L.autoDecide = c => L.decide(c.options.filter(o => !o.disabled).slice(-1)[0].id); if (L.s.card) L.autoDecide(L.s.card); for (let i = 0; i < 4; i++) __AL.fastForward(1); g.alNoPaper = false; g.alUI.setSpeed(0); });   // paused: the date holds while autosave catches up
  await page.waitForTimeout(11000);
  const st = await page.evaluate(() => { const raw = localStorage.getItem('micropolisJSGame'); const j = raw ? JSON.parse(raw) : null;
    return {saved: !!j, kb: raw ? Math.round(raw.length / 1024) : 0, meta: j && j.alMeta, date: __AL.layer.dateString(), tips: __AL.layer.s.log.filter(e => /^Tip:/.test(e.text)).map(e => e.text.slice(0, 40))}; });
  console.log('autosave', JSON.stringify(st)); if (!st.saved || !st.meta || st.meta.date !== st.date) fail('autosave should keep up with the game');
  if (st.tips.length < 2) fail('first tips should show');
  // reload: Continue
  await page.evaluate(() => __AL.game.alUI.setSpeed(2));
  await page.reload(); await page.waitForSelector('#splashFestus', {state: 'visible'}); await page.waitForTimeout(400);
  const c = await page.evaluate(() => ({shown: !document.getElementById('continueBox').classList.contains('hidden'), text: document.getElementById('continueBox').innerText.replace(/\s+/g, ' ')}));
  console.log('continue', JSON.stringify(c)); if (!c.shown || c.text.indexOf(st.date) < 0) fail('Continue should show the saved town and date');
  await page.screenshot({path: OUT + '/7-continue.png'});
  await page.click('#splashLoad'); await page.waitForFunction(() => window.__AL && __AL.layer, null, {timeout: 90000}); await page.waitForTimeout(800);
  const loaded = await page.evaluate(() => ({date: __AL.layer.dateString(), scen: __AL.layer.s.scenario, town: document.getElementById('name').textContent}));
  console.log('loaded', JSON.stringify(loaded)); if (loaded.date !== st.date || loaded.scen !== 'festus') fail('Continue should load the saved game');
  // a shared ?play=festus link over a saved game asks first; Keep my save leaves the save alone
  const savedDate = () => page.evaluate(() => { const j = JSON.parse(localStorage.getItem('micropolisJSGame') || 'null'); return j && j.alMeta && j.alMeta.date; });
  await page.evaluate(() => __AL.game.alUI.setSpeed(0));
  await page.goto(URL + '?play=festus'); await page.waitForSelector('#replaceWindow', {state: 'visible', timeout: 30000}); await page.waitForTimeout(300);
  await page.screenshot({path: OUT + '/8-replace.png'});
  const before = await savedDate(); const rq = await page.evaluate(() => ({text: document.getElementById('replaceWindow').innerText.replace(/\s+/g, ' '), game: !!window.__AL, url: location.search}));
  console.log('replace asks', JSON.stringify(rq), before); if (rq.game || rq.url || rq.text.indexOf(before) < 0) fail('?play=festus over a save should ask first, naming the save');
  await page.click('#replaceCancel'); await page.waitForTimeout(5000);
  const kept = {date: await savedDate(), game: await page.evaluate(() => !!window.__AL), cont: await page.isVisible('#splashLoad'), dialog: await page.isVisible('#replaceWindow')};
  console.log('keep save', JSON.stringify(kept)); if (kept.date !== before || kept.game || !kept.cont || kept.dialog) fail('Keep my save should leave the save and show Continue');
  // Play Festus over a saved game asks too; Start new game starts it
  await page.click('#splashFestus'); await page.waitForSelector('#replaceWindow', {state: 'visible'});
  await page.click('#replaceOK'); await page.waitForSelector('#alCard', {state: 'visible', timeout: 90000});
  const pf = await page.evaluate(() => ({date: __AL.layer.dateString(), kind: __AL.layer.s.card && __AL.layer.s.card.type}));
  console.log('start new', JSON.stringify(pf)); if (pf.date !== 'Jan 2026' || pf.kind !== 'intro') fail('Start new game should start a fresh Festus game');
  // Play again on the final paper starts a new game without asking
  await page.evaluate(() => { __AL.game.alUI.setSpeed(0); __AL.game.alPanel.paperWindow.open({gameOver: true, tone: 'bad', headline: 'VOTERS OUST MAYOR', text: 'VOTERS OUST MAYOR', body: 'The mayor won 41% of the vote.', helps: '', strains: 'Game over.'}); });
  await page.click('#alPaperRestart'); await page.waitForFunction(() => window.__AL && __AL.layer && __AL.layer.s.card && __AL.layer.s.card.type === 'intro', null, {timeout: 90000});
  const pa = await page.evaluate(() => ({date: __AL.layer.dateString(), url: location.search, asked: !document.getElementById('replaceWindow').classList.contains('hidden')}));
  console.log('play again', JSON.stringify(pa)); if (pa.date !== 'Jan 2026' || pa.url || pa.asked) fail('Play again should start a fresh game without asking');
  // the sandbox still starts (confirming over the save)
  await page.goto(URL); await page.waitForSelector('#splashSandbox', {state: 'visible'}); await page.click('#splashSandbox'); await page.fill('#nameForm', 'Testville'); await page.click('#playit');
  await page.waitForSelector('#replaceWindow', {state: 'visible'}); await page.click('#replaceOK');
  await page.waitForFunction(() => window.__AL && __AL.layer && __AL.layer.s.scenario, null, {timeout: 90000}); await page.waitForTimeout(500);
  console.log('sandbox started', await page.evaluate(() => __AL.layer.s.scenario));
  console.log('errors', JSON.stringify(errs)); if (errs.length) fail('console errors');
  // phone
  const ph = await b.newContext(devices['iPhone 14']); const pp = await ph.newPage(); const perr = []; pp.on('pageerror', e => perr.push(e.message));
  await pp.goto(URL); await pp.waitForSelector('#splashFestus', {state: 'visible'}); await pp.waitForTimeout(400); await pp.screenshot({path: OUT + '/p1-splash.png'});
  await pp.click('#splashFestus'); await pp.waitForSelector('#alCard', {state: 'visible', timeout: 90000}); await pp.waitForTimeout(400); await pp.screenshot({path: OUT + '/p2-intro.png'});
  const pin = await pp.evaluate(() => ({h: document.getElementById('alCard').scrollHeight, ch: document.getElementById('alCard').clientHeight}));
  console.log('phone intro', JSON.stringify(pin));
  await pp.click('#alCard .cardOption[data-option="go"]'); await pp.waitForTimeout(300); await pp.click('#alCard .cardOption[data-option="reject"]'); await pp.waitForTimeout(400);
  await pp.evaluate(() => { if (document.getElementById('alPaper').offsetParent) document.getElementById('alPaperOK').click(); });
  await pp.click('#menuToggle'); await pp.waitForTimeout(300); await pp.screenshot({path: OUT + '/p3-menu.png'});
  const pm = await pp.evaluate(() => [...document.querySelectorAll('#menuButtons .miscButton')].filter(e => e.offsetParent).map(e => e.textContent.trim()));
  console.log('phone menu', JSON.stringify(pm)); if (pm.indexOf('Save') < 0 || pm.indexOf('Feedback') < 0 || pm.indexOf('More ▾') >= 0) fail('phone menu: ' + pm.join());
  console.log('phone errors', JSON.stringify(perr)); if (perr.length) fail('phone errors');
  console.log(fails.length ? 'START FAILED' : 'START PASSED');
  await b.close(); srv.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
