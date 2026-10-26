/* Afterlight isometric art for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * Everything here is drawn procedurally with canvas paths: no external or copyrighted art. Coordinates are tile
 * units (u = map x, v = map y, z = floors) pushed through a projector P(u, v, z) -> [screenX, screenY].
 * Tiles are 2:1 dimetric diamonds, 64x32 px at zoom 1; one floor is FL px tall.
 */

export const TW = 64, TH = 32, FL = 9;

export function makeP(ox, oy, L) {
  return function(u, v, z) {
    return [ox + (u - v) * 32 * L, oy + (u + v) * 16 * L - (z || 0) * FL * L];
  };
}

// ---- colour helpers ----
function hexToRgb(h) {
  if (h.charAt(0) === 'r') return h.replace(/[^\d,.]/g, '').split(',').slice(0, 3).map(Number);
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
var shadeCache = {};
export function shade(hex, f) {
  var k = hex + f;
  if (shadeCache[k]) return shadeCache[k];
  var c = hexToRgb(hex);
  var r = f >= 1 ? c.map(function(x) { return Math.round(x + (255 - x) * (f - 1)); })
                 : c.map(function(x) { return Math.round(x * f); });
  return (shadeCache[k] = 'rgb(' + r.join(',') + ')');
}
export function hash(a, b, c) {
  var h = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- primitives ----
export function poly(ctx, P, pts, fill, stroke, lw) {
  ctx.beginPath();
  for (var i = 0; i < pts.length; i++) {
    var q = P(pts[i][0], pts[i][1], pts[i][2] || 0);
    if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

export function line(ctx, P, a, b, col, lw) {
  var p = P(a[0], a[1], a[2] || 0), q = P(b[0], b[1], b[2] || 0);
  ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
  ctx.strokeStyle = col; ctx.lineWidth = lw || 1; ctx.stroke();
}

// Flat quad on the ground (or at height z)
export function quad(ctx, P, u0, v0, u1, v1, col, z) {
  z = z || 0;
  poly(ctx, P, [[u0, v0, z], [u1, v0, z], [u1, v1, z], [u0, v1, z]], col);
}

// The shadow collector: boxes drawn while a collector is active also add their ground shadow
var shadowSink = null;
export function collectShadows(list) { shadowSink = list; }

// Sun from the upper left: south faces (screen lower-left) lit, east faces (lower-right) in shade
export function box(ctx, P, u0, v0, u1, v1, z0, z1, col, o) {
  o = o || {};
  if (shadowSink && !o.noShadow) shadowSink.push([u0, v0, u1, v1, z1]);
  var edge = o.edge === undefined ? 'rgba(30,25,20,0.35)' : o.edge;
  var lw = o.lw || 1;
  poly(ctx, P, [[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], o.south || shade(col, 0.96), edge, lw);
  poly(ctx, P, [[u1, v0, z0], [u1, v1, z0], [u1, v1, z1], [u1, v0, z1]], o.east || shade(col, 0.72), edge, lw);
  if (!o.noTop) poly(ctx, P, [[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], o.top || shade(col, 1.14), edge, lw);
}

// Windows on the two visible faces of a box
export function windows(ctx, P, u0, v0, u1, v1, z0, z1, o) {
  o = o || {};
  var floors = Math.max(1, Math.round((z1 - z0) / (o.floor || 1)));
  var fh = (z1 - z0) / floors;
  var glass = o.glass || '#6f8fa8', glassE = shade(glass, 0.72);
  var lit = o.lit || '#cfe3f0';
  var wf = o.wf || 0.55, hf = o.hf || 0.5;
  var cols = function(len) { return Math.max(1, Math.round(len / (o.spacing || 0.3))); };
  var seed = o.seed || 0;
  for (var f = (o.skipGround ? 1 : 0); f < floors; f++) {
    var za = z0 + f * fh + fh * (1 - hf) * 0.6, zb = za + fh * hf;
    var n = cols(u1 - u0), w = (u1 - u0) / n;
    for (var i = 0; i < n; i++) {
      var ua = u0 + i * w + w * (1 - wf) / 2, ub = ua + w * wf;
      var c = hash(i, f, seed) > 0.82 ? lit : glass;
      poly(ctx, P, [[ua, v1 + 0.001, za], [ub, v1 + 0.001, za], [ub, v1 + 0.001, zb], [ua, v1 + 0.001, zb]], c);
    }
    n = cols(v1 - v0); w = (v1 - v0) / n;
    for (i = 0; i < n; i++) {
      var va = v0 + i * w + w * (1 - wf) / 2, vb = va + w * wf;
      c = hash(i + 50, f, seed) > 0.85 ? shade(lit, 0.8) : glassE;
      poly(ctx, P, [[u1 + 0.001, va, za], [u1 + 0.001, vb, za], [u1 + 0.001, vb, zb], [u1 + 0.001, va, zb]], c);
    }
  }
}

// Continuous glass bands (curtain wall look)
export function bands(ctx, P, u0, v0, u1, v1, z0, z1, every, col) {
  for (var z = z0 + every * 0.35; z < z1 - 0.1; z += every) {
    var zb = Math.min(z1, z + every * 0.55);
    poly(ctx, P, [[u0, v1 + 0.001, z], [u1, v1 + 0.001, z], [u1, v1 + 0.001, zb], [u0, v1 + 0.001, zb]], col);
    poly(ctx, P, [[u1 + 0.001, v0, z], [u1 + 0.001, v1, z], [u1 + 0.001, v1, zb], [u1 + 0.001, v0, zb]], shade(col, 0.75));
  }
}

// Pitched roof with the ridge along u (axis 'u') or v
export function gable(ctx, P, u0, v0, u1, v1, z, rise, roof, wall, axis) {
  if (shadowSink) shadowSink.push([u0, v0, u1, v1, z + rise * 0.7]);
  var e = 'rgba(30,20,15,0.35)';
  if (axis === 'v') {
    var um = (u0 + u1) / 2;
    poly(ctx, P, [[u0, v0, z], [um, v0, z + rise], [um, v1, z + rise], [u0, v1, z]], shade(roof, 1.08), e);
    poly(ctx, P, [[u0, v1, z], [um, v1, z + rise], [u1, v1, z]], shade(wall, 0.96), e);
    poly(ctx, P, [[um, v0, z + rise], [u1, v0, z], [u1, v1, z], [um, v1, z + rise]], shade(roof, 0.78), e);
  } else {
    var vm = (v0 + v1) / 2;
    poly(ctx, P, [[u0, v0, z], [u1, v0, z], [u1, vm, z + rise], [u0, vm, z + rise]], shade(roof, 0.8), e);
    poly(ctx, P, [[u1, v0, z], [u1, v1, z], [u1, vm, z + rise]], shade(wall, 0.72), e);
    poly(ctx, P, [[u0, vm, z + rise], [u1, vm, z + rise], [u1, v1, z], [u0, v1, z]], shade(roof, 1.04), e);
  }
}

export function hip(ctx, P, u0, v0, u1, v1, z, rise, roof) {
  if (shadowSink) shadowSink.push([u0, v0, u1, v1, z + rise * 0.6]);
  var cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, e = 'rgba(30,20,15,0.35)';
  poly(ctx, P, [[u0, v0, z], [u1, v0, z], [cu, cv, z + rise]], shade(roof, 0.82), e);
  poly(ctx, P, [[u0, v0, z], [cu, cv, z + rise], [u0, v1, z]], shade(roof, 0.9), e);
  poly(ctx, P, [[u1, v0, z], [u1, v1, z], [cu, cv, z + rise]], shade(roof, 0.74), e);
  poly(ctx, P, [[u0, v1, z], [cu, cv, z + rise], [u1, v1, z]], shade(roof, 1.06), e);
}

// Vertical cylinder (stacks, tanks); r in tiles
export function cylinder(ctx, P, cu, cv, r, z0, z1, col, o) {
  o = o || {};
  if (shadowSink) shadowSink.push([cu - r, cv - r, cu + r, cv + r, z1]);
  var a = P(cu, cv, z0), b = P(cu, cv, z1);
  var L = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / 32;
  var rx = r * 64 * 0.7071 * L, ry = r * 32 * 0.7071 * L;
  var g = ctx.createLinearGradient(a[0] - rx, 0, a[0] + rx, 0);
  g.addColorStop(0, shade(col, 1.1)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, 0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(a[0], a[1], rx, ry, 0, 0, Math.PI);
  ctx.lineTo(b[0] - rx, b[1]);
  ctx.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true);
  ctx.closePath(); ctx.fill();
  if (o.bands) {
    o.bands.forEach(function(bz) {
      var p = P(cu, cv, bz[0]), q = P(cu, cv, bz[1]);
      ctx.fillStyle = bz[2];
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI);
      ctx.lineTo(q[0] - rx, q[1]);
      ctx.ellipse(q[0], q[1], rx, ry, 0, Math.PI, 0, true);
      ctx.closePath(); ctx.fill();
    });
  }
  ctx.fillStyle = o.top || shade(col, 0.55);
  ctx.beginPath(); ctx.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

// Hyperboloid cooling tower
export function coolingTower(ctx, P, cu, cv, r, h) {
  if (shadowSink) shadowSink.push([cu - r, cv - r, cu + r, cv + r, h]);
  var L = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / 32;
  var base = P(cu, cv, 0), top = P(cu, cv, h);
  var rx = r * 45.25 * L, ry = r * 22.6 * L;
  var waist = 0.68, topr = 0.78;
  var g = ctx.createLinearGradient(base[0] - rx, 0, base[0] + rx, 0);
  g.addColorStop(0, '#e9e6df'); g.addColorStop(0.5, '#cfcac0'); g.addColorStop(1, '#8f8a82');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(base[0], base[1], rx, ry, 0, 0, Math.PI);
  var midY = base[1] + (top[1] - base[1]) * 0.65;
  ctx.quadraticCurveTo(base[0] - rx * waist * 0.9, midY, top[0] - rx * topr, top[1]);
  ctx.lineTo(top[0] + rx * topr, top[1]);
  ctx.quadraticCurveTo(base[0] + rx * waist * 0.9, midY, base[0] + rx, base[1]);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5d5953';
  ctx.beginPath(); ctx.ellipse(top[0], top[1], rx * topr, ry * topr, 0, 0, Math.PI * 2); ctx.fill();
}

export function tree(ctx, P, u, v, s, seed, kind) {
  var base = P(u, v, 0);
  var L = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / 32;
  var h = (13 + seed * 8) * s * L;
  // ground shadow
  ctx.fillStyle = 'rgba(20,40,10,0.25)';
  ctx.beginPath(); ctx.ellipse(base[0] + 4 * s * L, base[1] + 1 * L, 8 * s * L, 3.5 * s * L, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3f26';
  ctx.fillRect(base[0] - 1 * L, base[1] - h * 0.45, 2 * L, h * 0.45);
  if (kind === 'pine') {
    var greens = ['#2f5a2c', '#3c6e35', '#4d8442'];
    for (var i = 0; i < 3; i++) {
      var yb = base[1] - h * (0.25 + i * 0.22), w = (8 - i * 2) * s * L;
      ctx.fillStyle = greens[i];
      ctx.beginPath(); ctx.moveTo(base[0] - w, yb); ctx.lineTo(base[0] + w * 0.9, yb); ctx.lineTo(base[0], yb - h * 0.38); ctx.closePath(); ctx.fill();
    }
  } else {
    var r = (6.5 + seed * 3) * s * L, cy = base[1] - h * 0.7;
    var hue = seed > 0.6 ? ['#3e6b2a', '#52863a', '#7aac52'] : ['#3a6626', '#4f8436', '#6da047'];
    ctx.fillStyle = hue[0]; ctx.beginPath(); ctx.arc(base[0] + r * 0.15, cy + r * 0.1, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hue[1]; ctx.beginPath(); ctx.arc(base[0] - r * 0.12, cy - r * 0.08, r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hue[2]; ctx.beginPath(); ctx.arc(base[0] - r * 0.35, cy - r * 0.35, r * 0.38, 0, Math.PI * 2); ctx.fill();
  }
}

// Shadow sprite from collected boxes: sun from upper left, shadows fall to the lower right
export function drawShadows(ctx, P, boxes) {
  ctx.fillStyle = '#000';
  boxes.forEach(function(b) {
    var u0 = b[0], v0 = b[1], u1 = b[2], v1 = b[3], h = b[4];
    var du = h * 0.11, dv = -h * 0.035;
    var a = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    var o = a.map(function(p) { return [p[0] + du, p[1] + dv]; });
    poly(ctx, P, a, '#000');
    poly(ctx, P, o, '#000');
    for (var i = 0; i < 4; i++) {
      var j = (i + 1) % 4;
      poly(ctx, P, [a[i], a[j], o[j], o[i]], '#000');
    }
  });
}
