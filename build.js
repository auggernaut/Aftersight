// Concatenate src/*.js (in name order) into one self-contained page, with Yuka inlined.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const yuka = fs.readFileSync(path.join(__dirname, 'vendor', 'yuka.min.js'), 'utf8');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const body = tpl
  .replace('/*__YUKA__*/', () => `/* Yuka 0.7.8, MIT License, https://github.com/Mugen87/yuka */\n${yuka}`)
  .replace('/*__GAME__*/', () => `(() => {\n'use strict';\n${js}\n})();`);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const page = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n${body.replace('<canvas id="world"', '</head><body>\n<canvas id="world"')}\n</body></html>\n`;
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), page);
console.log('built', files.length, 'files,', Math.round(page.length / 1024), 'KB');
