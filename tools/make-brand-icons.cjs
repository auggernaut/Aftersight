// Builds the favicon and app icons from the AfterSight mark (assets/brand/mark.svg): the "Si" of the wordmark with the
// i's dot as a circuit node. The 16px favicon drops the node's trace, which turns to noise at that size; the Apple
// touch icon is square because iOS rounds the corners itself. The header uses mark.svg directly.
//
//   NODE_PATH=<playwright>/node_modules node tools/make-brand-icons.cjs
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const DIR = path.join(__dirname, '..', 'assets', 'brand');
const SVG = fs.readFileSync(path.join(DIR, 'mark.svg'), 'utf8');
const variant = (o) => {
  let s = SVG;
  if (o.plain) s = s.replace(/<g id="asTraces">[\s\S]*?<\/g>/, '');
  if (o.square) s = s.replace('rx="112"', 'rx="0"');
  return s.replace('<svg ', '<svg width="' + o.size + '" height="' + o.size + '" ');
};
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  const png = async (o) => {
    await page.setViewportSize({width: o.size, height: o.size});
    await page.setContent('<html><body style="margin:0;background:transparent">' + variant(o) + '</body></html>');
    return page.screenshot({omitBackground: true, clip: {x: 0, y: 0, width: o.size, height: o.size}});
  };
  const out = {'si-32.png': {size: 32}, 'si-192.png': {size: 192}, 'si-512.png': {size: 512}, 'apple-touch-icon.png': {size: 180, square: true}};
  for (const f in out) { fs.writeFileSync(path.join(DIR, f), await png(out[f])); console.log(f); }
  // favicon.ico: PNG-compressed entries at 16 (plain), 32 and 48
  const ico = [await png({size: 16, plain: true}), await png({size: 32}), await png({size: 48})];
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4);
  let offset = 6 + 16 * ico.length; const dir = [];
  [16, 32, 48].forEach((s, i) => { const e = Buffer.alloc(16); e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(ico[i].length, 8); e.writeUInt32LE(offset, 12); offset += ico[i].length; dir.push(e); });
  fs.writeFileSync(path.join(DIR, 'favicon.ico'), Buffer.concat([head].concat(dir, ico))); console.log('favicon.ico');
  await b.close();
})();
