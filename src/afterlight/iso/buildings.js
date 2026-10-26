/* Afterlight isometric buildings for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * Each painter draws one building in local tile coordinates (0..n on both axes) through the projector P.
 */

import { box, windows, bands, gable, hip, cylinder, coolingTower, quad, poly, line, tree, shade, hash } from './art.js';

var BRICK = ['#a65a43', '#b87055', '#c99a72', '#e4ddcf'];
var WALLS = ['#e8dcc4', '#f1e9d8', '#d9c7a8', '#c9d3dc', '#e9d2bd', '#f4f1ea'];
var ROOFS = ['#8e3b2e', '#5b5f66', '#a8552f', '#4a4f57', '#7a4a32', '#6b3a3a'];
var GLASS = ['#6d8495', '#5f87a6', '#4f8fb3', '#3f9ab8'];
var CONCRETE = ['#a9a397', '#bdb7aa', '#cfcabe', '#dedad2'];

// Small detached house on a 1x1 lot
export function house(ctx, P, lp, variant, seed) {
  var wall = WALLS[(variant * 2 + lp + Math.floor(seed * 3)) % WALLS.length];
  var roof = ROOFS[(variant + lp * 2 + Math.floor(seed * 2)) % ROOFS.length];
  var big = 0.1 * lp;
  quad(ctx, P, 0.1, 0.1, 0.9, 0.9, '#8fbf5e');                       // yard
  quad(ctx, P, 0.42, 0.78, 0.58, 1, '#cfc8b6');                       // path
  var u0 = 0.2 - big * 0.4, u1 = 0.78 + big * 0.2, v0 = 0.22, v1 = 0.7 + big * 0.2;
  var h = 1.4 + (lp >= 2 ? 1.1 : 0);
  box(ctx, P, u0, v0, u1, v1, 0, h, wall, {noTop: true});
  poly(ctx, P, [[u0 + 0.28, v1 + 0.002, 0], [u0 + 0.38, v1 + 0.002, 0], [u0 + 0.38, v1 + 0.002, 1.0], [u0 + 0.28, v1 + 0.002, 1.0]], '#6b4a34');
  windows(ctx, P, u0, v0, u1, v1, 0, h, {floor: 1.2, spacing: 0.22, glass: '#7f9bb0', seed: seed * 100, wf: 0.5, hf: 0.45});
  if (variant !== 1) box(ctx, P, u1 - 0.22, v0 + 0.08, u1 - 0.1, v0 + 0.2, h, h + 1.3, '#8a5a48', {noShadow: true});
  if (variant === 2) hip(ctx, P, u0 - 0.04, v0 - 0.04, u1 + 0.04, v1 + 0.04, h, 1.2, roof);
  else gable(ctx, P, u0 - 0.04, v0 - 0.04, u1 + 0.04, v1 + 0.04, h, 1.3, roof, wall, variant === 1 ? 'v' : 'u');
  if (lp >= 1) tree(ctx, P, 0.86, 0.3, 0.6, seed, 'round');
  if (lp >= 3) quad(ctx, P, 0.12, 0.74, 0.34, 0.92, '#7fc4dc');       // pool
}

// Flat-roof clutter: AC units, vents and a water tank so roofs don't read as blank slabs
function roofKit(ctx, P, u0, v0, u1, v1, z, seed, tank) {
  var n = 2 + Math.floor(hash(seed * 97, 1, 2) * 3);
  for (var i = 0; i < n; i++) {
    var a = hash(i, seed * 31, 3), b = hash(i, seed * 17, 4);
    var cu = u0 + 0.15 + a * (u1 - u0 - 0.5), cv = v0 + 0.15 + b * (v1 - v0 - 0.5);
    box(ctx, P, cu, cv, cu + 0.22, cv + 0.18, z, z + 0.45, '#b9b6af', {noShadow: true});
    poly(ctx, P, [[cu + 0.05, cv + 0.04, z + 0.46], [cu + 0.17, cv + 0.04, z + 0.46], [cu + 0.17, cv + 0.14, z + 0.46], [cu + 0.05, cv + 0.14, z + 0.46]], '#55534f');
  }
  if (tank) {
    var tu = u1 - 0.45, tv = v0 + 0.3;
    line(ctx, P, [tu - 0.1, tv, z], [tu - 0.1, tv, z + 0.8], '#5a4632', 1); line(ctx, P, [tu + 0.1, tv, z], [tu + 0.1, tv, z + 0.8], '#5a4632', 1);
    cylinder(ctx, P, tu, tv, 0.16, z + 0.8, z + 1.8, '#8a6a4a', {top: '#6b5038'});
  }
}

// Ground-floor shopfronts: a tall glass band and an awning on the lit face
function shopfront(ctx, P, u0, v1, u1, z, col) {
  poly(ctx, P, [[u0 + 0.05, v1 + 0.002, 0.1], [u1 - 0.05, v1 + 0.002, 0.1], [u1 - 0.05, v1 + 0.002, z * 0.75], [u0 + 0.05, v1 + 0.002, z * 0.75]], '#8fb4c8');
  poly(ctx, P, [[u0, v1, z * 0.85], [u1, v1, z * 0.85], [u1, v1 + 0.14, z * 0.62], [u0, v1 + 0.14, z * 0.62]], col);
}

function trees(ctx, P, list, seed) {
  list.forEach(function(t, i) { tree(ctx, P, t[0], t[1], t[2] || 0.7, hash(i, 3, seed), t[3] || 'round'); });
}

// Residential zone, density 1..4, land value 0..3 (3x3)
export function residential(ctx, P, pop, lp, seed) {
  quad(ctx, P, 0, 0, 3, 3, lp >= 2 ? '#8dbb5c' : '#93b46a');
  var wall = lp >= 3 ? '#f2efe8' : BRICK[(lp + Math.floor(seed * 2)) % 4];
  var roof = ROOFS[Math.floor(seed * ROOFS.length)];
  if (pop === 1) {           // townhouse rows
    quad(ctx, P, 0.1, 2.55, 2.9, 2.9, '#c9c3b5');
    for (var r = 0; r < 2; r++) {
      var v0 = 0.25 + r * 1.2;
      box(ctx, P, 0.25, v0, 2.75, v0 + 0.8, 0, 2.2, wall, {noTop: true});
      windows(ctx, P, 0.25, v0, 2.75, v0 + 0.8, 0, 2.2, {floor: 1.1, spacing: 0.25, seed: seed * 50 + r});
      gable(ctx, P, 0.2, v0 - 0.03, 2.8, v0 + 0.83, 2.2, 1.2, roof, wall, 'u');
    }
    trees(ctx, P, [[2.85, 2.7, 0.6]], seed);
  } else if (pop === 2) {    // walk-up apartment blocks
    quad(ctx, P, 0.2, 2.3, 2.8, 2.9, '#c9c3b5');
    box(ctx, P, 0.25, 0.25, 1.35, 2.1, 0, 4, wall);
    windows(ctx, P, 0.25, 0.25, 1.35, 2.1, 0, 4, {spacing: 0.24, seed: seed * 70});
    box(ctx, P, 1.65, 0.25, 2.75, 2.1, 0, 4.4, shade(wall, 0.95));
    windows(ctx, P, 1.65, 0.25, 2.75, 2.1, 0, 4.4, {spacing: 0.24, seed: seed * 71});
    roofKit(ctx, P, 0.25, 0.25, 1.35, 2.1, 4, seed, false);
    roofKit(ctx, P, 1.65, 0.25, 2.75, 2.1, 4.4, seed + 0.3, false);
    trees(ctx, P, [[0.4, 2.65, 0.6], [2.6, 2.6, 0.7]], seed);
  } else if (pop === 3) {    // mid-rise
    quad(ctx, P, 0.15, 0.15, 2.85, 2.85, '#b9b4a8');
    box(ctx, P, 0.35, 0.35, 2.3, 2.3, 0, 7.5, wall);
    windows(ctx, P, 0.35, 0.35, 2.3, 2.3, 0, 7.5, {spacing: 0.22, seed: seed * 90, glass: lp >= 2 ? '#7f9fb8' : '#6f8598'});
    box(ctx, P, 0.35, 0.35, 2.3, 2.3, 7.5, 7.8, shade(wall, 0.85));
    roofKit(ctx, P, 0.35, 0.35, 2.3, 2.3, 7.8, seed, true);
    trees(ctx, P, [[2.65, 0.6, 0.7], [2.65, 1.6, 0.7], [2.6, 2.6, 0.8]], seed);
  } else {                   // residential tower
    quad(ctx, P, 0.1, 0.1, 2.9, 2.9, '#c2bdb1');
    box(ctx, P, 0.3, 0.3, 2.7, 2.7, 0, 1.6, shade(wall, 0.9));
    box(ctx, P, 0.7, 0.7, 2.2, 2.2, 1.6, 15, lp >= 2 ? '#e9e6df' : wall);
    windows(ctx, P, 0.7, 0.7, 2.2, 2.2, 1.6, 15, {spacing: 0.2, seed: seed * 33, glass: GLASS[lp]});
    roofKit(ctx, P, 0.7, 0.7, 2.2, 2.2, 15, seed, true);
  }
}

export function commercial(ctx, P, pop, lp, seed) {
  quad(ctx, P, 0, 0, 3, 3, '#b8b3a7');
  var glass = GLASS[lp], conc = CONCRETE[lp];
  if (pop === 1) {           // corner shops with awnings and a car park
    quad(ctx, P, 0.15, 1.6, 2.85, 2.85, '#6c6c70');
    for (var i = 0; i < 5; i++) line(ctx, P, [0.4 + i * 0.5, 1.75, 0], [0.4 + i * 0.5, 2.15, 0], '#e8e4d8', 1);
    var colours = ['#d0563f', '#3d8fc4', '#e2a43b'];
    for (i = 0; i < 3; i++) {
      var u0 = 0.2 + i * 0.9;
      box(ctx, P, u0, 0.3, u0 + 0.8, 1.3, 0, 1.6, WALLS[(i + Math.floor(seed * 4)) % WALLS.length]);
      poly(ctx, P, [[u0, 1.3, 1.0], [u0 + 0.8, 1.3, 1.0], [u0 + 0.8, 1.45, 0.75], [u0, 1.45, 0.75]], colours[(i + Math.floor(seed * 3)) % 3]);
      poly(ctx, P, [[u0 + 0.1, 1.301, 0.1], [u0 + 0.7, 1.301, 0.1], [u0 + 0.7, 1.301, 0.7], [u0 + 0.1, 1.301, 0.7]], '#7fa7c0');
    }
  } else if (pop === 2) {    // two-storey offices / strip
    box(ctx, P, 0.25, 0.25, 2.75, 1.9, 0, 3.2, conc);
    bands(ctx, P, 0.25, 0.25, 2.75, 1.9, 1.6, 3.2, 1.6, glass);
    shopfront(ctx, P, 0.25, 1.9, 1.45, 1.6, '#c4473a');
    shopfront(ctx, P, 1.55, 1.9, 2.75, 1.6, '#3d8fc4');
    roofKit(ctx, P, 0.25, 0.25, 2.75, 1.9, 3.2, seed, false);
    quad(ctx, P, 0.25, 2.1, 2.75, 2.85, '#6c6c70');
  } else if (pop === 3) {    // office block
    box(ctx, P, 0.3, 0.3, 2.7, 2.7, 0, 1.4, shade(conc, 0.9));
    shopfront(ctx, P, 0.3, 2.7, 2.7, 1.4, '#2f5f8a');
    box(ctx, P, 0.5, 0.5, 2.5, 2.5, 1.4, 8, conc);
    bands(ctx, P, 0.5, 0.5, 2.5, 2.5, 1.4, 8, 1.1, glass);
    roofKit(ctx, P, 0.5, 0.5, 2.5, 2.5, 8, seed, false);
  } else if (pop === 4) {    // office tower
    box(ctx, P, 0.25, 0.25, 2.75, 2.75, 0, 1.8, conc);
    shopfront(ctx, P, 0.25, 2.75, 2.75, 1.8, '#8a6a3a');
    box(ctx, P, 0.6, 0.6, 2.4, 2.4, 1.8, 13, lp >= 2 ? glass : conc, lp >= 2 ? {top: shade(glass, 1.2)} : {});
    if (lp >= 2) bands(ctx, P, 0.6, 0.6, 2.4, 2.4, 1.8, 13, 0.9, shade(glass, 0.8));
    else windows(ctx, P, 0.6, 0.6, 2.4, 2.4, 1.8, 13, {spacing: 0.2, glass: glass, seed: seed * 9});
    box(ctx, P, 1.1, 1.1, 1.9, 1.9, 13, 14.2, '#8e8b86');
  } else {                   // skyscraper with setbacks and a spire
    box(ctx, P, 0.2, 0.2, 2.8, 2.8, 0, 2, conc);
    shopfront(ctx, P, 0.2, 2.8, 2.8, 2, '#3a3a3a');
    box(ctx, P, 0.45, 0.45, 2.55, 2.55, 2, 14, glass, {top: shade(glass, 1.25)});
    bands(ctx, P, 0.45, 0.45, 2.55, 2.55, 2, 14, 0.8, shade(glass, 0.78));
    box(ctx, P, 0.8, 0.8, 2.2, 2.2, 14, 19, shade(glass, 1.05));
    bands(ctx, P, 0.8, 0.8, 2.2, 2.2, 14, 19, 0.8, shade(glass, 0.8));
    box(ctx, P, 1.2, 1.2, 1.8, 1.8, 19, 20.5, '#c9c5bb');
    line(ctx, P, [1.5, 1.5, 20.5], [1.5, 1.5, 24], '#9a968e', 2);
  }
}

export function industrial(ctx, P, pop, lp, seed) {
  quad(ctx, P, 0, 0, 3, 3, '#8f897c');
  var shed = lp ? '#8fa3ad' : '#a49a88';
  var sawtooth = function(u0, v0, u1, v1, h, col) {
    box(ctx, P, u0, v0, u1, v1, 0, h, col, {noTop: true});
    var n = Math.max(2, Math.round((u1 - u0) / 0.45)), w = (u1 - u0) / n;
    for (var i = 0; i < n; i++) {
      var a = u0 + i * w;
      poly(ctx, P, [[a, v0, h], [a + w, v0, h], [a + w, v1, h], [a, v1, h]], shade(col, 0.85));
      poly(ctx, P, [[a, v0, h], [a, v1, h], [a + w * 0.3, v1, h + 0.9], [a + w * 0.3, v0, h + 0.9]], '#9fc0d4');
      poly(ctx, P, [[a + w * 0.3, v0, h + 0.9], [a + w, v0, h], [a + w, v1, h], [a + w * 0.3, v1, h + 0.9]], shade(col, 1.1));
    }
    if (shadowLater) shadowLater.push([u0, v0, u1, v1, h + 0.6]);
  };
  var shadowLater = null;
  if (pop === 1) {
    sawtooth(0.3, 0.3, 2.4, 1.8, 2, shed);
    quad(ctx, P, 0.3, 2.0, 2.7, 2.8, '#7b766c');
    box(ctx, P, 0.4, 2.2, 1.0, 2.6, 0, 0.8, '#b8763a');
    box(ctx, P, 1.3, 2.2, 1.9, 2.6, 0, 0.8, '#3f6f9a');
  } else if (pop === 2) {
    sawtooth(0.2, 0.2, 2.2, 2.0, 2.4, shed);
    cylinder(ctx, P, 2.55, 0.6, 0.18, 0, 7, '#b0aaa0', {bands: [[6, 6.6, '#c4473a']]});
    box(ctx, P, 0.3, 2.25, 2.7, 2.8, 0, 1.0, '#c9a24a');
  } else if (pop === 3) {
    box(ctx, P, 0.2, 0.2, 1.8, 2.6, 0, 3.4, shed);
    windows(ctx, P, 0.2, 0.2, 1.8, 2.6, 0, 3.4, {floor: 1.7, spacing: 0.4, glass: '#7590a0', seed: seed});
    cylinder(ctx, P, 2.3, 0.7, 0.35, 0, 2.8, '#d8d4cc');
    cylinder(ctx, P, 2.3, 1.6, 0.35, 0, 2.8, '#d8d4cc');
    cylinder(ctx, P, 2.4, 2.5, 0.16, 0, 8, '#a7a199', {bands: [[7, 7.6, '#c4473a']]});
  } else {
    box(ctx, P, 0.2, 0.2, 2.0, 1.6, 0, 4.2, shade(shed, 0.9));
    box(ctx, P, 0.2, 1.7, 2.0, 2.8, 0, 2.6, shed);
    windows(ctx, P, 0.2, 0.2, 2.0, 1.6, 0, 4.2, {floor: 1.4, spacing: 0.35, glass: '#6f8796', seed: seed});
    cylinder(ctx, P, 2.4, 0.5, 0.18, 0, 10, '#a7a199', {bands: [[9, 9.6, '#c4473a'], [7, 7.4, '#f2f0ea']]});
    cylinder(ctx, P, 2.45, 1.4, 0.18, 0, 9, '#a7a199', {bands: [[8, 8.6, '#c4473a']]});
    cylinder(ctx, P, 2.4, 2.4, 0.4, 0, 2.4, '#cfc9be');
  }
}

export function coal(ctx, P) {
  quad(ctx, P, 0, 0, 4, 4, '#7d776c');
  quad(ctx, P, 2.6, 2.5, 3.8, 3.8, '#2c2a28');                         // coal pile
  poly(ctx, P, [[2.7, 2.6, 0], [3.7, 2.6, 0], [3.2, 3.2, 1.0]], '#3b3835');
  box(ctx, P, 0.3, 0.6, 2.4, 3.6, 0, 4.2, '#9c8e7a');
  windows(ctx, P, 0.3, 0.6, 2.4, 3.6, 0, 4.2, {floor: 2.1, spacing: 0.5, glass: '#5f7280'});
  box(ctx, P, 0.6, 1.0, 2.0, 2.0, 4.2, 5.4, '#887b69');
  cylinder(ctx, P, 3.0, 0.7, 0.25, 0, 14, '#d9d4cb', {bands: [[12, 13, '#c4473a'], [10, 11, '#c4473a']]});
  cylinder(ctx, P, 3.3, 1.6, 0.25, 0, 12, '#d9d4cb', {bands: [[10, 11, '#c4473a']]});
}

export function nuclear(ctx, P) {
  quad(ctx, P, 0, 0, 4, 4, '#a9a59b');
  coolingTower(ctx, P, 1.0, 1.0, 0.85, 9);
  coolingTower(ctx, P, 2.9, 1.0, 0.85, 9);
  cylinder(ctx, P, 1.6, 2.9, 0.65, 0, 3.5, '#e6e2da');
  var top = P(1.6, 2.9, 3.5);
  ctx.fillStyle = '#efece6';
  var L = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / 32;
  ctx.beginPath(); ctx.ellipse(top[0], top[1], 0.65 * 45 * L, 0.65 * 45 * L * 0.7, 0, Math.PI, 0); ctx.fill();
  box(ctx, P, 2.6, 2.4, 3.7, 3.6, 0, 2.6, '#b9b4aa');
}

export function civic(ctx, P, kind) {
  quad(ctx, P, 0, 0, 3, 3, '#bdb8ab');
  if (kind === 'fire') {
    box(ctx, P, 0.3, 0.4, 2.6, 2.2, 0, 2.6, '#b4513f');
    for (var i = 0; i < 3; i++) poly(ctx, P, [[0.5 + i * 0.7, 2.201, 0], [1.0 + i * 0.7, 2.201, 0], [1.0 + i * 0.7, 2.201, 1.6], [0.5 + i * 0.7, 2.201, 1.6]], '#e3ddd0');
    box(ctx, P, 2.0, 0.4, 2.6, 1.0, 2.6, 5.2, '#a64a39');
    box(ctx, P, 0.6, 2.4, 1.2, 2.7, 0, 0.7, '#d23a2c');
  } else if (kind === 'police') {
    box(ctx, P, 0.3, 0.3, 2.6, 2.3, 0, 3.4, '#c9ccd2');
    windows(ctx, P, 0.3, 0.3, 2.6, 2.3, 0, 3.4, {floor: 1.1, spacing: 0.3, glass: '#4e6b88'});
    box(ctx, P, 0.3, 0.3, 2.6, 2.3, 3.4, 3.6, '#2f4f7a');
    line(ctx, P, [0.4, 2.7, 0], [0.4, 2.7, 4.5], '#ddd', 1.5);
    poly(ctx, P, [[0.4, 2.7, 4.5], [0.9, 2.7, 4.5], [0.9, 2.7, 3.9], [0.4, 2.7, 3.9]], '#3b5fa8');
    box(ctx, P, 1.6, 2.5, 2.1, 2.8, 0, 0.6, '#ffffff');
  } else if (kind === 'hospital') {
    box(ctx, P, 0.2, 0.2, 2.8, 1.6, 0, 6, '#f0efea');
    windows(ctx, P, 0.2, 0.2, 2.8, 1.6, 0, 6, {spacing: 0.24, glass: '#7fa2bd'});
    box(ctx, P, 0.2, 1.7, 1.6, 2.8, 0, 3, '#e8e6df');
    poly(ctx, P, [[1.3, 0.75, 6.01], [1.7, 0.75, 6.01], [1.7, 1.05, 6.01], [1.3, 1.05, 6.01]], '#d8362b');
    poly(ctx, P, [[1.42, 0.55, 6.01], [1.58, 0.55, 6.01], [1.58, 1.25, 6.01], [1.42, 1.25, 6.01]], '#d8362b');
  } else if (kind === 'church') {
    box(ctx, P, 0.6, 0.6, 2.4, 2.2, 0, 2.8, '#e4dccb', {noTop: true});
    gable(ctx, P, 0.55, 0.55, 2.45, 2.25, 2.8, 1.8, '#6b4a3a', '#e4dccb', 'u');
    box(ctx, P, 2.0, 0.9, 2.6, 1.5, 0, 6, '#ddd4c2');
  }
}

export function stadium(ctx, P) {
  quad(ctx, P, 0, 0, 4, 4, '#b5b0a4');
  box(ctx, P, 0.3, 0.3, 3.7, 3.7, 0, 2.4, '#c8c3b8', {noTop: true});
  poly(ctx, P, [[0.3, 0.3, 2.4], [3.7, 0.3, 2.4], [3.7, 3.7, 2.4], [0.3, 3.7, 2.4]], '#8a8478');
  quad(ctx, P, 0.8, 0.8, 3.2, 3.2, '#4f9a3c', 1.0);
  line(ctx, P, [2, 0.8, 1.0], [2, 3.2, 1.0], '#e9f2e1', 1);
}

export function port(ctx, P) {
  quad(ctx, P, 0, 0, 4, 4, '#a39d90');
  box(ctx, P, 0.3, 0.3, 2.0, 1.6, 0, 2.2, '#b97a4b');
  box(ctx, P, 0.3, 2.0, 2.0, 3.6, 0, 2.2, '#4f7fa3');
  for (var i = 0; i < 4; i++) box(ctx, P, 2.4, 0.4 + i * 0.8, 3.0, 0.9 + i * 0.8, 0, 0.6, ['#c4473a', '#3d8fc4', '#e2a43b', '#4c9a5a'][i]);
  line(ctx, P, [3.5, 1, 0], [3.5, 1, 6], '#d9a53b', 2);
  line(ctx, P, [3.5, 1, 6], [2.2, 1, 6], '#d9a53b', 2);
}

export function airport(ctx, P) {
  quad(ctx, P, 0, 0, 6, 6, '#8fb46a');
  quad(ctx, P, 0.3, 4.3, 5.7, 5.3, '#4f4f53');
  for (var i = 0; i < 9; i++) quad(ctx, P, 0.6 + i * 0.6, 4.76, 0.9 + i * 0.6, 4.84, '#f0f0e8');
  quad(ctx, P, 4.3, 0.3, 5.3, 4.3, '#4f4f53');
  box(ctx, P, 0.5, 0.6, 3.2, 2.0, 0, 2.2, '#e1ddd3');
  bands(ctx, P, 0.5, 0.6, 3.2, 2.0, 0, 2.2, 1.1, '#5f87a6');
  box(ctx, P, 3.4, 2.6, 3.8, 3.0, 0, 6, '#d6d1c6');
  box(ctx, P, 3.25, 2.45, 3.95, 3.15, 6, 7, '#5f87a6');
}

// ---- Afterlight buildings ----
export function dataCenter(ctx, P, owner) {
  var stripe = owner === 'helix' ? '#a23bd6' : '#2fbf4a';
  quad(ctx, P, 0, 0, 3, 3, '#9d9b95');
  box(ctx, P, 0.15, 0.25, 2.85, 2.6, 0, 2.9, '#5b6067', {top: '#6c727a'});
  bands(ctx, P, 0.15, 0.25, 2.85, 2.6, 2.2, 2.75, 1, stripe);
  poly(ctx, P, [[0.15, 0.25, 2.9], [2.85, 0.25, 2.9], [2.85, 0.4, 2.9], [0.15, 0.4, 2.9]], stripe);
  for (var r = 0; r < 3; r++)
    for (var c = 0; c < 4; c++) {
      var u = 0.35 + c * 0.62, v = 0.45 + r * 0.66;
      box(ctx, P, u, v, u + 0.42, v + 0.42, 2.9, 3.3, '#8b9096', {noShadow: true});
      var t = P(u + 0.21, v + 0.21, 3.31);
      var L = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / 32;
      ctx.fillStyle = '#2b2e33'; ctx.beginPath(); ctx.ellipse(t[0], t[1], 7 * L, 3.5 * L, 0, 0, Math.PI * 2); ctx.fill();
    }
  quad(ctx, P, 0.2, 2.7, 2.8, 2.95, '#6c6c70');
}

export function depot(ctx, P, owner) {
  var stripe = owner === 'helix' ? '#a23bd6' : '#2fbf4a';
  quad(ctx, P, 0, 0, 3, 3, '#a19c92');
  box(ctx, P, 0.2, 0.2, 2.8, 1.8, 0, 2.85, '#d39a52', {top: '#b9b3a6'});
  bands(ctx, P, 0.2, 0.2, 2.8, 1.8, 2.2, 2.7, 1, stripe);
  for (var k = 0; k < 3; k++) box(ctx, P, 0.5 + k * 0.8, 0.6, 0.9 + k * 0.8, 1.0, 2.85, 3.1, '#8d8a85', {noShadow: true});
  for (var i = 0; i < 4; i++) poly(ctx, P, [[0.4 + i * 0.6, 1.801, 0], [0.8 + i * 0.6, 1.801, 0], [0.8 + i * 0.6, 1.801, 1.5], [0.4 + i * 0.6, 1.801, 1.5]], '#5a4632');
  quad(ctx, P, 0.2, 2.0, 2.8, 2.85, '#77736a');
}

export function solar(ctx, P) {
  quad(ctx, P, 0, 0, 3, 3, '#b9b39b');
  for (var r = 0; r < 5; r++) {
    var v = 0.2 + r * 0.55;
    poly(ctx, P, [[0.15, v, 0.9], [2.85, v, 0.9], [2.85, v + 0.4, 0.15], [0.15, v + 0.4, 0.15]], '#2a4f8f', 'rgba(150,180,230,0.6)', 0.6);
    poly(ctx, P, [[0.15, v + 0.4, 0.15], [2.85, v + 0.4, 0.15], [2.85, v + 0.42, 0], [0.15, v + 0.42, 0]], '#444');
    for (var k = 1; k < 6; k++) line(ctx, P, [0.15 + k * 0.45, v, 0.9], [0.15 + k * 0.45, v + 0.4, 0.15], 'rgba(160,190,240,0.5)', 0.6);
  }
}

export function fusion(ctx, P) {
  quad(ctx, P, 0, 0, 3, 3, '#c9c6be');
  box(ctx, P, 0.2, 0.2, 2.8, 2.8, 0, 1.2, '#e2e6ea');
  var c = P(1.5, 1.5, 1.21);
  var L = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / 32;
  ctx.strokeStyle = '#7fe8ff'; ctx.lineWidth = 6 * L;
  ctx.beginPath(); ctx.ellipse(c[0], c[1] - 6 * L, 30 * L, 15 * L, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f2fbff';
  ctx.beginPath(); ctx.ellipse(c[0], c[1] - 10 * L, 16 * L, 14 * L, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#d7f7ff';
  ctx.beginPath(); ctx.ellipse(c[0], c[1] - 10 * L, 16 * L, 6 * L, 0, 0, Math.PI); ctx.fill();
}

export function clinic(ctx, P) {
  quad(ctx, P, 0, 0, 3, 3, '#86bb5a');
  box(ctx, P, 0.3, 0.3, 2.4, 1.9, 0, 3.6, '#f6f6f2');
  bands(ctx, P, 0.3, 0.3, 2.4, 1.9, 0, 3.6, 1.2, '#79c3c9');
  poly(ctx, P, [[1.15, 0.9, 3.61], [1.55, 0.9, 3.61], [1.55, 1.25, 3.61], [1.15, 1.25, 3.61]], '#2fbf4a');
  poly(ctx, P, [[1.27, 0.7, 3.61], [1.43, 0.7, 3.61], [1.43, 1.45, 3.61], [1.27, 1.45, 3.61]], '#2fbf4a');
  trees(ctx, P, [[0.5, 2.5, 0.7], [1.3, 2.6, 0.6], [2.2, 2.4, 0.7], [2.7, 1.1, 0.6]], 7);
}

export function emptyZone(ctx, P, n, col) {
  for (var u = 0; u < n; u++)
    for (var v = 0; v < n; v++)
      poly(ctx, P, [[u + 0.06, v + 0.06], [u + 0.94, v + 0.06], [u + 0.94, v + 0.94], [u + 0.06, v + 0.94]], col, shade(col, 0.7), 1);
}
