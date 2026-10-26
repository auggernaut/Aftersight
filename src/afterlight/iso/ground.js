/* Afterlight isometric ground painter for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * Paints one map tile's ground (terrain, water, trees, roads, rail, power lines, lots) into a cached chunk.
 */

import { poly, line, quad, tree, shade, hash, box } from './art.js';

// ---- tile classification ----
export const isWater = function(v) { return v >= 2 && v <= 20; };
export const isRoad = function(v) { return (v >= 64 && v <= 206) || v === 237 || v === 238; };
export const roadShape = function(v) { return (v >= 64 && v <= 207) ? (v & 15) + 64 : v; };
export const isBridge = function(v) {
  if (!(v >= 64 && v <= 206)) return false;
  var s = roadShape(v);
  return s === 64 || s === 65 || s === 79;
};
export const isRail = function(v) { return v >= 221 && v <= 238; };
export const isPower = function(v) { return (v >= 208 && v <= 222) || v === 77 || v === 78 || v === 239; };
export const overWater = function(v) {
  return isWater(v) || isBridge(v) || v === 208 || v === 209 || v === 224 || v === 225 || (v >= 48 && v <= 51);
};
export const trafficLevel = function(v) {
  if (!(v >= 64 && v <= 206) || v === 95) return 0;
  return v >= 144 ? 2 : v >= 80 ? 1 : 0;
};
var roadLike = function(v) { return isRoad(v); };
var railLike = function(v) { return isRail(v) && v !== 77 && v !== 78; };
var wireLike = function(v) { return isPower(v) || (v >= 240 && v <= 1018 && !(v >= 828 && v <= 955)); };
var isTree = function(v) { return v >= 21 && v <= 43; };

// Ground signature: tiles with equal signatures look the same, so traffic changes don't repaint chunks
export const groundSig = function(v, own) {
  if (own) return 2000 + own;
  if (isWater(v)) return 2;
  if (v >= 64 && v <= 206) return isBridge(v) ? 64 : 66;
  if (v >= 828 && v <= 955 && v !== 840) return 0;
  if (v >= 56 && v <= 63) return 56;
  if (v >= 44 && v <= 47) return 44;
  if (v >= 48 && v <= 51) return 48;
  return v;
};

// Lot colours for tiles owned by a building
export const LOT = [null, '#93b46a', '#b8b3a7', '#8f897c', '#bdb8ab', '#7d776c', '#a9a59b', '#8fb46a', '#9d9b95'];

// Smooth value noise so grass varies in soft patches instead of a per-tile checkerboard
function smooth(u, v, s, k) {
  var x = u / s, y = v / s, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  var a = hash(x0, y0, k), b = hash(x0 + 1, y0, k), c = hash(x0, y0 + 1, k), d = hash(x0 + 1, y0 + 1, k);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function grassColour(u, v) {
  var n = smooth(u, v, 6, 3) * 0.7 + smooth(u, v, 2.5, 4) * 0.3;
  var r = Math.round(118 + n * 26), g = Math.round(168 + n * 18), b = Math.round(72 + n * 14);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];   // west (u-), east (u+), north (v-), south (v+)

// Edge strip inside tile (u,v) on side d, width w
function edgeQuad(ctx, P, u, v, d, w, col) {
  if (d === 0) quad(ctx, P, u, v, u + w, v + 1, col);
  else if (d === 1) quad(ctx, P, u + 1 - w, v, u + 1, v + 1, col);
  else if (d === 2) quad(ctx, P, u, v, u + 1, v + w, col);
  else quad(ctx, P, u, v + 1 - w, u + 1, v + 1, col);
}

var E = 0.012;   // overdraw so neighbouring diamonds don't leave hairline seams
function grass(ctx, P, u, v, L) {
  quad(ctx, P, u - E, v - E, u + 1 + E, v + 1 + E, grassColour(u + 0.5, v + 0.5));
  if (L >= 0.6) {
    for (var i = 0; i < 4; i++) {
      var a = hash(u, v, 10 + i), b = hash(u, v, 20 + i);
      quad(ctx, P, u + a * 0.85, v + b * 0.85, u + a * 0.85 + 0.1, v + b * 0.85 + 0.07, i % 2 ? 'rgba(60,100,30,0.25)' : 'rgba(200,230,150,0.25)');
    }
  }
}

function water(ctx, P, u, v, nb, t) {
  quad(ctx, P, u - E, v - E, u + 1 + E, v + 1 + E, '#3d7fae');
  var h = hash(u, v, 2);
  if (h > 0.5) quad(ctx, P, u + h * 0.5, v + 0.3, u + h * 0.5 + 0.35, v + 0.38, 'rgba(255,255,255,0.12)');
  for (var d = 0; d < 4; d++) {
    var n = nb(dirs[d][0], dirs[d][1]);
    if (n >= 0 && !overWater(n)) {
      edgeQuad(ctx, P, u, v, d, 0.32, '#5fa3c4');
      edgeQuad(ctx, P, u, v, d, 0.12, '#9fd0df');
    }
  }
}

function shore(ctx, P, u, v, nb) {
  for (var d = 0; d < 4; d++) {
    var n = nb(dirs[d][0], dirs[d][1]);
    if (n >= 0 && overWater(n)) edgeQuad(ctx, P, u, v, d, 0.28, '#d9c99a');
  }
}

function roadTile(ctx, P, u, v, val, nb, L) {
  var bridge = isBridge(val);
  var m = [];
  for (var d = 0; d < 4; d++) m.push(roadLike(nb(dirs[d][0], dirs[d][1])));
  if (!m[0] && !m[1] && !m[2] && !m[3]) {
    var s = roadShape(val);
    if (s === 64 || s === 66 || s === 77) { m[0] = m[1] = true; } else { m[2] = m[3] = true; }
  }
  var A = '#55565b', S = bridge ? '#9a958b' : '#cbc6bb', a0 = 0.24, a1 = 0.76, s0 = 0.12, s1 = 0.88;
  if (bridge) {
    var z = 0.5;
    // deck and side girders
    if (m[0] || m[1]) {
      box(ctx, P, u, v + s0, u + 1, v + s1, 0, z, '#8c8579', {edge: null});
      quad(ctx, P, u, v + a0, u + 1, v + a1, A, z);
      line(ctx, P, [u, v + s0, z + 0.4], [u + 1, v + s0, z + 0.4], '#b9b2a4', 1.2 * L);
      line(ctx, P, [u, v + s1, z + 0.4], [u + 1, v + s1, z + 0.4], '#b9b2a4', 1.2 * L);
    } else {
      box(ctx, P, u + s0, v, u + s1, v + 1, 0, z, '#8c8579', {edge: null});
      quad(ctx, P, u + a0, v, u + a1, v + 1, A, z);
      line(ctx, P, [u + s0, v, z + 0.4], [u + s0, v + 1, z + 0.4], '#b9b2a4', 1.2 * L);
      line(ctx, P, [u + s1, v, z + 0.4], [u + s1, v + 1, z + 0.4], '#b9b2a4', 1.2 * L);
    }
    return;
  }
  // sidewalk and asphalt: centre square plus one arm per connection
  quad(ctx, P, u + s0, v + s0, u + s1, v + s1, S);
  if (m[0]) quad(ctx, P, u, v + s0, u + 0.5, v + s1, S);
  if (m[1]) quad(ctx, P, u + 0.5, v + s0, u + 1, v + s1, S);
  if (m[2]) quad(ctx, P, u + s0, v, u + s1, v + 0.5, S);
  if (m[3]) quad(ctx, P, u + s0, v + 0.5, u + s1, v + 1, S);
  quad(ctx, P, u + a0, v + a0, u + a1, v + a1, A);
  if (m[0]) quad(ctx, P, u, v + a0, u + 0.5, v + a1, A);
  if (m[1]) quad(ctx, P, u + 0.5, v + a0, u + 1, v + a1, A);
  if (m[2]) quad(ctx, P, u + a0, v, u + a1, v + 0.5, A);
  if (m[3]) quad(ctx, P, u + a0, v + 0.5, u + a1, v + 1, A);
  var n = m.filter(Boolean).length;
  if (L >= 0.45) {
    if (n === 2 && m[0] && m[1]) {
      quad(ctx, P, u + 0.1, v + 0.485, u + 0.4, v + 0.515, '#e9d27a');
      quad(ctx, P, u + 0.6, v + 0.485, u + 0.9, v + 0.515, '#e9d27a');
    } else if (n === 2 && m[2] && m[3]) {
      quad(ctx, P, u + 0.485, v + 0.1, u + 0.515, v + 0.4, '#e9d27a');
      quad(ctx, P, u + 0.485, v + 0.6, u + 0.515, v + 0.9, '#e9d27a');
    } else if (n >= 3 && L >= 0.6) {
      for (var i = 0; i < 4; i++) {        // crosswalk stripes
        var c = a0 + 0.04 + i * 0.13;
        if (m[1]) quad(ctx, P, u + 0.78, v + c, u + 0.88, v + c + 0.06, '#e8e6df');
        if (m[3]) quad(ctx, P, u + c, v + 0.78, u + c + 0.06, v + 0.88, '#e8e6df');
      }
    }
  }
}

function railTile(ctx, P, u, v, val, nb, L) {
  var m = [];
  for (var d = 0; d < 4; d++) m.push(railLike(nb(dirs[d][0], dirs[d][1])));
  if (!m[0] && !m[1] && !m[2] && !m[3]) {
    if (val === 224 || val === 226 || val === 221 || val === 238) { m[0] = m[1] = true; } else { m[2] = m[3] = true; }
  }
  var bed = '#9c8f7c', z = (val === 224 || val === 225) ? 0.5 : 0;
  if (z) box(ctx, P, u + 0.2, v + 0.2, u + 0.8, v + 0.8, 0, z, '#7a7268', {edge: null});
  var arm = function(d, f) {
    if (d === 0) f(u, v + 0.5, u + 0.5, v + 0.5, 'u');
    if (d === 1) f(u + 0.5, v + 0.5, u + 1, v + 0.5, 'u');
    if (d === 2) f(u + 0.5, v, u + 0.5, v + 0.5, 'v');
    if (d === 3) f(u + 0.5, v + 0.5, u + 0.5, v + 1, 'v');
  };
  var i;
  for (i = 0; i < 4; i++) if (m[i]) arm(i, function(a, b, c, e, ax) {
    if (ax === 'u') quad(ctx, P, a, b - 0.26, c, e + 0.26, bed, z); else quad(ctx, P, a - 0.26, b, c + 0.26, e, bed, z);
  });
  quad(ctx, P, u + 0.24, v + 0.24, u + 0.76, v + 0.76, bed, z);
  for (i = 0; i < 4; i++) if (m[i]) arm(i, function(a, b, c, e, ax) {
    for (var k = 0; k < 3; k++) {
      var f = (k + 0.5) / 3;
      if (ax === 'u') { var tu = a + (c - a) * f; quad(ctx, P, tu - 0.04, b - 0.2, tu + 0.04, b + 0.2, '#6b4b33', z); }
      else { var tv = b + (e - b) * f; quad(ctx, P, a - 0.2, tv - 0.04, a + 0.2, tv + 0.04, '#6b4b33', z); }
    }
    var off = [-0.11, 0.11];
    off.forEach(function(o) {
      if (ax === 'u') line(ctx, P, [a, b + o, z], [c, e + o, z], '#d6d4d0', Math.max(1, 1.4 * L));
      else line(ctx, P, [a + o, b, z], [c + o, e, z], '#d6d4d0', Math.max(1, 1.4 * L));
    });
  });
}

function powerTile(ctx, P, u, v, val, nb, L) {
  var m = [];
  for (var d = 0; d < 4; d++) m.push(wireLike(nb(dirs[d][0], dirs[d][1])));
  if (!m[0] && !m[1] && !m[2] && !m[3]) {
    if (val === 208 || val === 210 || val === 222 || val === 77) { m[0] = m[1] = true; } else { m[2] = m[3] = true; }
  }
  var cu = u + 0.5, cv = v + 0.5, H = 3.4, col = '#6e6a63';
  var lw = Math.max(1, 1.3 * L);
  // pylon: two tapered legs and a cross arm
  line(ctx, P, [cu - 0.12, cv, 0], [cu, cv, H], col, lw);
  line(ctx, P, [cu + 0.12, cv, 0], [cu, cv, H], col, lw);
  line(ctx, P, [cu, cv - 0.12, 0], [cu, cv, H], shade(col, 0.8), lw);
  var horiz = m[0] || m[1];
  if (horiz) line(ctx, P, [cu, cv - 0.2, H - 0.3], [cu, cv + 0.2, H - 0.3], col, lw);
  else line(ctx, P, [cu - 0.2, cv, H - 0.3], [cu + 0.2, cv, H - 0.3], col, lw);
  var ends = [[u, cv], [u + 1, cv], [cu, v], [cu, v + 1]];
  for (d = 0; d < 4; d++) {
    if (!m[d]) continue;
    var e = ends[d];
    [-0.2, 0.2].forEach(function(o) {
      var a = horiz || d < 2 ? [cu, cv + (d < 2 ? o : 0), H - 0.3] : [cu + o, cv, H - 0.3];
      if (d >= 2) a = [cu + o, cv, H - 0.3];
      var b = d < 2 ? [e[0], e[1] + o, H - 0.55] : [e[0] + o, e[1], H - 0.55];
      var p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]), mid = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] - 0.35);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(mid[0], mid[1], q[0], q[1]);
      ctx.strokeStyle = 'rgba(40,40,40,0.75)'; ctx.lineWidth = Math.max(0.6, 0.8 * L); ctx.stroke();
    });
  }
}

var ZT = {res: ['#a9d987', '#5f9a3e'], com: ['#9fc3e4', '#4a7fb5'], ind: ['#e3cf86', '#b08c2e']};
function emptyZoneTile(ctx, P, u, v, kind, nb, sameKind) {
  var c = ZT[kind];
  quad(ctx, P, u, v, u + 1, v + 1, c[0]);
  for (var d = 0; d < 4; d++) {
    if (sameKind(nb(dirs[d][0], dirs[d][1]))) continue;
    var a, b;
    if (d === 0) { a = [u + 0.06, v + 0.06]; b = [u + 0.06, v + 0.94]; }
    if (d === 1) { a = [u + 0.94, v + 0.06]; b = [u + 0.94, v + 0.94]; }
    if (d === 2) { a = [u + 0.06, v + 0.06]; b = [u + 0.94, v + 0.06]; }
    if (d === 3) { a = [u + 0.06, v + 0.94]; b = [u + 0.94, v + 0.94]; }
    ctx.setLineDash([4, 3]);
    line(ctx, P, a, b, c[1], 1.5);
    ctx.setLineDash([]);
  }
}
var zoneOf = function(v) {
  if (v >= 240 && v <= 260) return 'res';
  if (v >= 423 && v <= 431) return 'com';
  if (v >= 612 && v <= 620) return 'ind';
  return null;
};

export const paintGroundTile = function(ctx, P, u, v, val, own, nb, L) {
  if (own) {
    quad(ctx, P, u - E, v - E, u + 1 + E, v + 1 + E, LOT[own] || '#b8b3a7');
    return;
  }
  if (isWater(val)) { water(ctx, P, u, v, nb); return; }
  if (overWater(val) && !(val >= 48 && val <= 51)) {
    water(ctx, P, u, v, nb);
    if (isBridge(val)) roadTile(ctx, P, u, v, val, nb, L);
    else if (val === 224 || val === 225) railTile(ctx, P, u, v, val, nb, L);
    else powerTile(ctx, P, u, v, val, nb, L);
    return;
  }
  grass(ctx, P, u, v, L);
  shore(ctx, P, u, v, nb);
  if (isTree(val)) {
    var dense = val >= 37 ? 3 : val >= 29 ? 2 : 1;
    var pine = hash(u >> 3, v >> 3, 5) > 0.55;
    quad(ctx, P, u + 0.05, v + 0.05, u + 0.95, v + 0.95, 'rgba(70,110,40,0.35)');
    var spots = [[0.3, 0.35], [0.72, 0.5], [0.42, 0.78], [0.78, 0.84]];
    for (var i = 0; i < dense + 1 && i < 4; i++) {
      var h = hash(u, v, 30 + i);
      tree(ctx, P, u + spots[i][0] + (h - 0.5) * 0.15, v + spots[i][1] + (hash(u, v, 40 + i) - 0.5) * 0.15, 0.75 + h * 0.35, h, pine ^ (h > 0.85) ? 'pine' : 'round');
    }
    return;
  }
  if (val >= 44 && val <= 47) {      // rubble
    quad(ctx, P, u, v, u + 1, v + 1, '#9b8c76');
    for (i = 0; i < 6; i++) {
      var a = hash(u, v, 50 + i), b = hash(u, v, 60 + i);
      box(ctx, P, u + a * 0.8, v + b * 0.8, u + a * 0.8 + 0.14, v + b * 0.8 + 0.12, 0, 0.3, i % 2 ? '#8a8278' : '#a39a8f', {edge: null});
    }
    return;
  }
  if (val >= 48 && val <= 51) { quad(ctx, P, u, v, u + 1, v + 1, '#6d97a8'); return; }
  if (val === 52) {
    quad(ctx, P, u, v, u + 1, v + 1, '#b9b45a');
    quad(ctx, P, u + 0.35, v + 0.35, u + 0.65, v + 0.65, '#d9c22a');
    return;
  }
  if (val >= 56 && val <= 63) { quad(ctx, P, u, v, u + 1, v + 1, '#4a3b30'); return; }
  if (val >= 860 && val <= 883) { quad(ctx, P, u, v, u + 1, v + 1, '#5a4a3a'); return; }
  if (val === 840) {                 // fountain plaza
    quad(ctx, P, u + 0.1, v + 0.1, u + 0.9, v + 0.9, '#d8d2c4');
    box(ctx, P, u + 0.3, v + 0.3, u + 0.7, v + 0.7, 0, 0.3, '#bdb6a8');
    quad(ctx, P, u + 0.36, v + 0.36, u + 0.64, v + 0.64, '#5fb0d6', 0.3);
    return;
  }
  if (isRoad(val) && !isRail(val)) { roadTile(ctx, P, u, v, val, nb, L); return; }
  if (val === 237 || val === 238) { roadTile(ctx, P, u, v, val, nb, L); railTile(ctx, P, u, v, val, nb, L); return; }
  if (isRail(val) && val !== 221 && val !== 222) { railTile(ctx, P, u, v, val, nb, L); return; }
  if (val === 221 || val === 222) { railTile(ctx, P, u, v, val, nb, L); powerTile(ctx, P, u, v, val, nb, L); return; }
  if (val === 77 || val === 78 || val === 239) { roadTile(ctx, P, u, v, val, nb, L); powerTile(ctx, P, u, v, val, nb, L); return; }
  if (isPower(val)) { powerTile(ctx, P, u, v, val, nb, L); return; }
  var z = zoneOf(val);
  if (z) {
    if (val >= 249 && val <= 260) { quad(ctx, P, u, v, u + 1, v + 1, '#8fbf5e'); return; }
    emptyZoneTile(ctx, P, u, v, z, nb, function(n) { return zoneOf(n) === z; });
  }
};

// Animated cars on a road tile with traffic, drawn per frame in screen space
var CARS = ['#d6402f', '#f2f0ea', '#2f5fa8', '#e2b23b', '#3a3a3a', '#5aa05a', '#8a8f96'];
export const paintCars = function(ctx, P, u, v, val, nb, level, t) {
  var hz = roadLike(nb(-1, 0)) || roadLike(nb(1, 0));
  var vt = roadLike(nb(0, -1)) || roadLike(nb(0, 1));
  if (!hz && !vt) { var s = roadShape(val); hz = s === 64 || s === 66; vt = !hz; }
  var z = isBridge(val) ? 0.5 : 0;
  var n = level === 2 ? 3 : 1;
  for (var i = 0; i < n; i++) {
    var h = hash(u, v, 70 + i);
    var useH = hz && (!vt || h > 0.5);
    var dir = (i + Math.floor(h * 2)) % 2;            // which lane
    var speed = 2200 + h * 1500;
    var p = ((t / speed) + h) % 1;
    if (dir) p = 1 - p;
    var lane = dir ? 0.36 : 0.64;
    var col = CARS[Math.floor(hash(u, v, 80 + i) * CARS.length)];
    if (useH) box(ctx, P, u + p - 0.09, v + lane - 0.05, u + p + 0.09, v + lane + 0.05, z, z + 0.55, col, {edge: 'rgba(0,0,0,0.4)', noShadow: true});
    else box(ctx, P, u + lane - 0.05, v + p - 0.09, u + lane + 0.05, v + p + 0.09, z, z + 0.55, col, {edge: 'rgba(0,0,0,0.4)', noShadow: true});
  }
};
