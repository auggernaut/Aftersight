// Small helpers shared by every file. All src files are concatenated into one scope.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sum = (arr, f = x => x) => arr.reduce((s, x) => s + f(x), 0);

// Seeded RNG so a run is reproducible (mulberry32).
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = makeRng(7);
const rr = (a, b) => a + rand() * (b - a);
const pick = arr => arr[Math.floor(rand() * arr.length)];

function money(v) {
  const s = v < 0 ? '-' : '';
  v = Math.abs(v);
  if (v >= 1e9) return s + '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return s + '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e4) return s + '$' + Math.round(v / 1e3) + 'k';
  if (v >= 1e3) return s + '$' + (v / 1e3).toFixed(1) + 'k';
  return s + '$' + Math.round(v);
}
const pct = v => Math.round(v * 100) + '%';
const num = v => v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2);

// Gini coefficient of a list of non-negative values.
function gini(vals) {
  const v = vals.map(x => Math.max(0, x)).sort((a, b) => a - b);
  const n = v.length, tot = sum(v);
  if (!n || tot <= 0) return 0;
  let acc = 0;
  v.forEach((x, i) => { acc += (2 * (i + 1) - n - 1) * x; });
  return acc / (n * tot);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Calendar: 30-day months, 360-day years keep the arithmetic readable.
function dateLabel(hours) {
  const d = Math.floor(hours / 24), y = Math.floor(d / 360) + 1, m = Math.floor((d % 360) / 30), dd = d % 30 + 1;
  const h = Math.floor(hours % 24), mi = Math.floor((hours % 1) * 60);
  return { y, m, dd, text: `Year ${y} · ${MONTHS[m]} ${dd}`, clock: `${String(h).padStart(2, '0')}:${String(mi - mi % 15).padStart(2, '0')}` };
}

// Weighted random choice: items [{w, v}]
function weighted(items) {
  const tot = sum(items, i => Math.max(0, i.w));
  if (tot <= 0) return null;
  let r = rand() * tot;
  for (const i of items) { r -= Math.max(0, i.w); if (r <= 0) return i.v; }
  return items[items.length - 1].v;
}

// Loyalty spheres and their colors (used for agent dots and charts).
const SPHERES = ['self', 'family', 'community', 'nation'];
const SPHERE_COLOR = { self: '#f2b955', family: '#e8805a', community: '#7fd36b', nation: '#6fb7ff' };
function dominant(w) { return SPHERES.reduce((b, k) => w[k] > w[b] ? k : b, 'self'); }
function normalize(w) { const t = sum(SPHERES, k => w[k]); SPHERES.forEach(k => w[k] /= t); return w; }
