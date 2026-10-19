// Quick smoke test: title -> creator -> first minutes in town, with screenshots.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/shots';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/01_title.png' });
  await page.click('#t-new');
  await page.waitForTimeout(300);
  await page.fill('#cc-name', 'Ren');
  await page.screenshot({ path: OUT + '/02_creator.png' });
  await page.click('#cc-go');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/03_arrive.png' });
  for (let i = 0; i < 3; i++) { await page.keyboard.press('e'); await page.waitForTimeout(150); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/04_town.png' });
  console.log(JSON.stringify(await page.evaluate(() => ({ quest: __AL.S.quest, minute: __AL.S.minute, econ: __AL.econ(), npcs: Object.values(__AL.NPCS).map(n => [n.id, Math.round(n.x), Math.round(n.y), n.visible]) })), null, 0));
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  await browser.close();
})();
