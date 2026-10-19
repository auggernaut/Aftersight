// ---------- small math + color helpers ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const round1 = v => Math.round(v * 10) / 10;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function hash(n) { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function mixHex(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function shade(hex, amt) {
  return amt >= 0 ? mixHex(hex, '#fff8ee', amt) : mixHex(hex, '#1c1622', -amt);
}

// The whole town is color-graded by "warmth": muted and hazy at first,
// saturated and golden as community life returns. GRADE is 0..20.
let GRADE = 0;
const _colCache = new Map();
function gradeRGB(hex, k) {
  const key = hex + '|' + GRADE + '|' + k;
  let c = _colCache.get(key);
  if (c) return c;
  const [r, g, b] = hex2rgb(hex);
  const w = GRADE / 20;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  // goes negative near full warmth: pushes colors past their base saturation
  const ds = ((1 - w) * 0.6 - w * w * 0.12) * k;
  let R = lerp(r, l, ds), G = lerp(g, l, ds), B = lerp(b, l, ds);
  const hz = (1 - w) * 0.16 * k;
  R = lerp(R, 122, hz); G = lerp(G, 130, hz); B = lerp(B, 146, hz);
  // golden-hour cast: lift reds and greens, pull blue down a little
  const wb = w * 0.09;
  R = R * (1 + wb); G = G * (1 + wb * 0.5); B = B * (1 - w * 0.06);
  // a touch more contrast as the town comes alive, like gouache
  const ct = 1 + w * 0.14;
  R = 128 + (R - 128) * ct; G = 128 + (G - 128) * ct; B = 128 + (B - 128) * ct;
  c = [clamp(R, 0, 255) | 0, clamp(G, 0, 255) | 0, clamp(B, 0, 255) | 0];
  _colCache.set(key, c);
  return c;
}
function col(hex, a, k = 1) {
  const c = gradeRGB(hex, k);
  return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }

function fmtMoney(v) { const s = Math.round(Math.abs(v)).toLocaleString('en-US'); return (v < 0 ? '−$' : '$') + s; }
function fmtHours(h) { return (Math.round(h * 10) / 10).toFixed(h >= 10 || Number.isInteger(Math.round(h * 10) / 10) ? 0 : 1) + ' h'; }
function fmtClock(min) {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
