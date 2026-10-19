// Concatenate src/*.js into one self-contained page.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const body = tpl.replace('/*__GAME__*/', () => `(() => {\n'use strict';\n${js}\n})();`);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'afterlight.html'), body);
// a standalone copy that opens directly from disk
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${body.replace('<canvas id="game"', '</head><body>\n<canvas id="game"')}\n</body></html>\n`);
console.log('built', files.length, 'files,', Math.round(body.length / 1024), 'KB');
