const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const r = await p.goto(process.argv[2]); console.log('status', r.status(), 'robots', r.headers()['x-robots-tag']);
  await p.waitForSelector('#splashPlay:visible'); await p.click('#splashPlay');
  await p.fill('#nameForm', 'Afterlight'); await p.click('#playit');
  await p.waitForFunction(() => window.__AL, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  console.log('census', JSON.stringify(await p.evaluate(() => __AL.census())), 'date', JSON.stringify(await p.evaluate(() => __AL.date())));
  const panels = await p.evaluate(() => [...document.querySelectorAll('[id^="al"]')].filter(e => e.offsetParent).map(e => e.id));
  console.log('visible al* elements', panels.join(','));
  console.log('title', await p.title()); console.log('pulse', await p.evaluate(() => { const e=document.querySelector('.alTitleText'); return e && e.offsetParent ? e.textContent : 'NOT VISIBLE'; })); console.log('footer', await p.evaluate(() => (document.body.innerText.match(/GPL[^\n]*/)||[''])[0]));
  await p.screenshot({ path: process.env.OUT || 'live-check.png' });
  console.log('errors', JSON.stringify(errors)); await b.close();
})();
