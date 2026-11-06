// Builds the favicon and app icons from the game's own art: the blue tower on Main Street, cut from the start screen's
// map (assets/brand/start-wide.webp, made by make-start-art.cjs). The town's buildings vary from game to game, so the
// icons are cut from that committed image rather than rendered fresh. If the start art is remade, check that the
// crops (in start-wide.webp's pixels) still frame a building, and rerun this.
//
//   NODE_PATH=<playwright>/node_modules node tools/make-brand-icons.cjs
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const DIR = path.join(__dirname, '..', 'assets', 'brand');
const ART = 'data:image/webp;base64,' + fs.readFileSync(path.join(DIR, 'start-wide.webp')).toString('base64');
const WIDE = {x: 2253, y: 1150, s: 200};   // the tower with a little of the street and houses around it
const TIGHT = {x: 2283, y: 1160, s: 150};  // just the tower, for the small favicons
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  await page.setContent('<html><body></body></html>');
  // draws a crop of the art into a size x size PNG, on a rounded tile unless square
  const png = (size, crop, square) => page.evaluate(async ({ART, size, crop, square}) => {
    const img = new Image(); img.src = ART; await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    if (!square) { const r = size * 0.22; g.beginPath(); g.roundRect(0, 0, size, size, r); g.clip(); }
    g.imageSmoothingQuality = 'high'; g.drawImage(img, crop.x, crop.y, crop.s, crop.s, 0, 0, size, size);
    return c.toDataURL('image/png').split(',')[1];
  }, {ART, size, crop, square}).then(d => Buffer.from(d, 'base64'));
  const out = {'si-32.png': [32, TIGHT], 'si-192.png': [192, WIDE], 'si-512.png': [512, WIDE], 'apple-touch-icon.png': [180, WIDE, true]};
  for (const f in out) { fs.writeFileSync(path.join(DIR, f), await png.apply(null, out[f])); console.log(f); }
  // favicon.ico: PNG-compressed entries at 16, 32 and 48
  const sizes = [16, 32, 48], ico = []; for (const s of sizes) ico.push(await png(s, TIGHT));
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4);
  let offset = 6 + 16 * ico.length; const dir = [];
  sizes.forEach((s, i) => { const e = Buffer.alloc(16); e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(ico[i].length, 8); e.writeUInt32LE(offset, 12); offset += ico[i].length; dir.push(e); });
  fs.writeFileSync(path.join(DIR, 'favicon.ico'), Buffer.concat([head].concat(dir, ico))); console.log('favicon.ico');
  await b.close();
})();
