// Builds the link preview (assets/brand/og-1200x630.jpg): the name and the headline on a pale panel at the left, the
// start screen's map of Festus (assets/brand/start-wide.webp, from make-start-art.cjs) on the right. Run it after
// changing either. Uses Inter from Google Fonts, or a local Inter when offline.
//
//   NODE_PATH=<playwright>/node_modules node tools/make-og.cjs
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const DIR = path.join(__dirname, '..', 'assets', 'brand');
const map = 'data:image/webp;base64,' + fs.readFileSync(path.join(DIR, 'start-wide.webp')).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=block">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: Inter, sans-serif; color: #1d2a36; }
  .map { position: absolute; inset: 0; background: #86b84f url(${map}) no-repeat; background-size: 1276px auto; background-position: -76px -62px; }
  .wash { position: absolute; inset: 0; background: linear-gradient(90deg, #f4f8fc 0, #f4f8fc 500px, rgba(244, 248, 252, 0.6) 560px, rgba(244, 248, 252, 0) 640px); }
  .words { position: absolute; left: 60px; top: 0; bottom: 0; width: 440px; display: flex; flex-direction: column; justify-content: center; }
  h1 { margin: 0; font-size: 76px; font-weight: 800; letter-spacing: -2px; line-height: 1; }
  h2 { margin: 30px 0 0; font-size: 31px; font-weight: 600; line-height: 1.25; letter-spacing: -0.3px; }
  p { margin: 34px 0 0; font-size: 21px; line-height: 1.45; color: #4f5f6d; }
</style></head><body>
  <div class="map"></div><div class="wash"></div>
  <div class="words"><h1>AfterSight</h1><h2>Run a real town through the arrival of AI and robots.</h2>
  <p>Festus, Missouri, 2026<br>A free city builder in your browser</p></div>
</body></html>`;
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({viewport: {width: 1200, height: 630}});
  await page.route(/fonts\.(googleapis|gstatic)/, r => process.env.OFFLINE ? r.fulfill({status: 200, contentType: 'text/css', body: ''}) : r.continue());
  await page.setContent(html, {waitUntil: 'load'}); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  await page.screenshot({path: path.join(DIR, 'og-1200x630.jpg'), type: 'jpeg', quality: 88});
  await b.close(); console.log('og-1200x630.jpg');
})();
