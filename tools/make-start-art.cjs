// Renders the start screen's backdrop from the game itself: Festus in January 2026 (the proposed data center site,
// Main Street, I-55), drawn by the iso renderer with the interface hidden. Run after the Festus map or the renderer
// changes. Writes assets/brand/start-wide.webp (desktop, the town on the right of the frame, behind which the start
// screen's text sits on the left) and assets/brand/start-phone.webp (phones held upright, the town in a band at the top).
//
//   npm run build && NODE_PATH=<playwright>/node_modules node tools/make-start-art.cjs
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), DIST = process.env.DIST || path.join(ROOT, 'dist'), OUT = path.join(ROOT, 'assets', 'brand');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'};
const srv = http.createServer((q, r) => { const p = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'Content-Type': types[path.extname(p)] || 'application/octet-stream'}); fs.createReadStream(p).pipe(r); }).listen(0);
// zoom is an index into the iso canvas's LEVELS; (cx, cy) is the tile at the centre of the frame
const SHOTS = [
  {file: 'start-wide.webp', w: 1920, h: 1080, dsf: 1.5, zoom: 3, cx: 59.4, cy: 47.6, q: 0.8},
  {file: 'start-phone.webp', w: 680, h: 460, dsf: 1.6, zoom: 1, cx: 69, cy: 40, q: 0.8}
];
(async () => { const b = await chromium.launch();
  for (const s of SHOTS) {
    const page = await b.newPage({viewport: {width: s.w, height: s.h}, deviceScaleFactor: s.dsf});
    await page.route(/fonts\.(googleapis|gstatic)/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
    await page.goto(process.env.BASE_URL || ('http://localhost:' + srv.address().port + '/index.html'));
    await page.click('#splashFestus');
    await page.waitForFunction(() => window.__AL && __AL.layer.s.card, null, {timeout: 90000});
    await page.evaluate(() => { const L = __AL.layer, g = __AL.game; g.alNoPaper = true; L.decide('go'); L.s.card = null; g.alUI.setSpeed(0); });
    await page.addStyleTag({content: 'header, #controls, #alPanel, #notifications, footer, #footer, #zoomButtons, #hint, #alCard, #opaque, #alPaper, #tooltip, #alTicker { display: none !important; } #wrapper { top: 0 !important; } main#canvasContainer { bottom: 0 !important; }'});
    await page.evaluate((s) => { window.dispatchEvent(new Event('resize')); const c = __AL.game.gameCanvas; c.setZoomNow(s.zoom); c.centreOn(s.cx, s.cy); }, s);
    await page.waitForTimeout(2000);
    // the map canvas is the biggest canvas on the page; encode it in the browser
    const data = await page.evaluate((q) => { const cs = Array.from(document.querySelectorAll('#canvasContainer canvas')).sort((a, b) => b.width * b.height - a.width * a.height);
      return cs[0].toDataURL('image/webp', q); }, s.q);
    const buf = Buffer.from(data.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, s.file), buf);
    console.log(s.file, Math.round(buf.length / 1024) + ' KB'); await page.close();
  }
  await b.close(); srv.close(); })();
