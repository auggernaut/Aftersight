/* Aftersight scenario for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * Festus, Missouri (2026), simplified: the Mississippi along the east edge under wooded bluffs, I-55 running
 * north-south as a divided highway with a strip of shops at the interchange, a small historic Main Street
 * downtown, residential streets around it, farmland and low wooded hills at the edges, and the empty 370-acre
 * site by the interstate where a developer wants a data center campus. Built with the normal Micropolis tools
 * on a fixed (seeded) map, so every Festus game starts from the same town.
 *
 * Aftersight: the old town (around Main Street, and the subdivision by the site) starts built out, every block full
 * of houses. The newer subdivisions to the north and north-west and the south side were platted (streets and power
 * laid) but never built: their empty lots are where the player zones new homes and shops. Festus is zoned for
 * houses, so a block holds eight homes and never turns into apartments (see residential.js).
 */

import { GameMap } from '../gameMap.js';
import { GameTools } from '../gameTools.js';
import { BLBNBIT, BLBNCNBIT, BULLBIT } from '../tileFlags.ts';
import * as TV from '../tileValues.ts';
import * as B from './buildings.js';

export const W = 120, H = 100;

// The proposed data center site (top-left and size), between the west subdivisions and the interstate
export const SITE = {x: 44, y: 28, w: 10, h: 18};
// Where the developer's halls go, in order (top-left of each 3x3). The first touches the feeder line at (43,35)
export const HALL_SPOTS = [{x: 44, y: 34}, {x: 47, y: 34}, {x: 44, y: 37}, {x: 47, y: 37}, {x: 50, y: 34}, {x: 50, y: 37}];
// The fields south of the state road along I-55, which a bigger campus takes too. Halls there pick up power from
// the interchange strip next door (x 52) and from each other.
var SOUTH = [{x: 49, y: 48}, {x: 46, y: 48}, {x: 49, y: 51}, {x: 46, y: 51}, {x: 43, y: 48}, {x: 43, y: 51}];
// Each time the developer walks and comes back, it asks for more: more land, more halls, more power and water.
// plan 0 is the first offer; the return offers use plans 1 and 2. `spots` is the order halls go up in.
export const PLANS = [
  {acres: 370, halls: 2, rects: [SITE], spots: HALL_SPOTS},
  {acres: 520, halls: 4, rects: [SITE, {x: 42, y: 48, w: 10, h: 7}],
   spots: [HALL_SPOTS[0], HALL_SPOTS[1], SOUTH[0], SOUTH[1], HALL_SPOTS[2], HALL_SPOTS[3], SOUTH[2], SOUTH[3]]},
  {acres: 700, halls: 6, rects: [SITE, {x: 36, y: 48, w: 16, h: 14}],
   spots: [HALL_SPOTS[0], HALL_SPOTS[1], SOUTH[0], SOUTH[1], SOUTH[2], SOUTH[3], HALL_SPOTS[2], HALL_SPOTS[3], HALL_SPOTS[4], HALL_SPOTS[5], SOUTH[4], SOUTH[5]]}
];
export const plan = function(i) { return PLANS[Math.max(0, Math.min(PLANS.length - 1, i || 0))]; };
export const DOWNTOWN = {x: 83, y: 47};
export const HOMES_PER_BLOCK = 8;   // a residential block in Festus holds eight houses

// The neighbourhoods: a block grid of n zone columns with roads every 7 rows and a power spine down the middle.
// `built(c, i)` says which residential blocks were built before 2026; the rest are empty platted lots.
var NEIGHBOURHOODS = [
  // the corner of the north-west subdivision that got built carries power from I-55 to its spine and on to the west
  {name: 'North-west subdivision', ox: 30, oy: 12, rows: ['RRRRRR', 'RRRRRR', 'RRRRRR', 'RRRKRR'], built: function(c, i) { return i >= 2 && c >= 3; }},
  {name: 'West subdivision', ox: 22, oy: 33, rows: ['RRRRRR', 'RRRRRR', 'RRKRRR', 'RRRRRR'], built: function(c) { return c >= 3; }},  // the half by the site
  {name: 'North side', ox: 62, oy: 12, rows: ['RRRRRRRR', 'RRRRRRRR', 'RRRRKRRR', 'RRRRRRRR', 'RRRRRRRR', 'CRRRRRRR'], built: function() { return false; }},
  {name: 'Downtown', ox: 70, oy: 40, rows: ['RRRRRRRR', 'CCCCCCCC', 'CCCPCCCF', 'RRRRRRRR', 'RRRKRRRR', 'RRRRRRRR'], built: function() { return true; }, downtown: true},
  {name: 'South side', ox: 62, oy: 61, rows: ['RRRRRR', 'RRRRRR'], built: function() { return false; }},
  {name: 'Riverside industry', ox: 89, oy: 68, rows: ['II', 'II'], built: function() { return true; }}
];
// Every block of a neighbourhood: its type, centre tile and whether it was built before 2026
var blocks = function(nb) {
  var n = nb.rows[0].length, half = Math.floor(n / 2), out = [];
  var colX = function(c) { return c < half ? 1 + c * 3 : 2 + c * 3; };
  nb.rows.forEach(function(types, i) {
    var ty = nb.oy + Math.floor(i / 2) * 7 + (i % 2 ? 4 : 1);
    for (var c = 0; c < n; c++) {
      var t = types[c];
      if (t === '.') continue;
      out.push({type: t, x: nb.ox + colX(c) + 1, y: ty + 1, built: t === 'K' || nb.built(c, i), where: nb.name});   // a platted neighbourhood's corner shop is an empty lot too
    }
  });
  return out;
};
// The empty platted lots (centre tiles), nearest the old town first
export const PLATS = (function() {
  var out = [];
  NEIGHBOURHOODS.forEach(function(nb) { blocks(nb).forEach(function(b) { if (!b.built && b.type !== 'K') out.push({x: b.x, y: b.y, where: b.where}); }); });
  return out.sort(function(a, b) { return Math.hypot(a.x - DOWNTOWN.x, a.y - DOWNTOWN.y) - Math.hypot(b.x - DOWNTOWN.x, b.y - DOWNTOWN.y); });
})();

// Small seeded PRNG so the map is identical every game
function rng(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

var riverX = function(y) { return Math.round(104 + 3 * Math.sin(y / 11) + 2 * Math.sin(y / 5.3 + 1)); };

// Rectangles kept free of trees and crops: the town, the interstate corridor, the site
var BUILT = [
  [20, 10, 34, 46],   // west + north subdivisions and the site
  [50, 0, 12, 100],   // I-55 corridor and its strip
  [60, 10, 40, 68],   // north neighbourhood, downtown, south neighbourhood, industry
  [8, 45, 92, 4],     // the state road
  [86, 66, 14, 22]    // industry and the power plant
];
var inRect = function(x, y, r) { return x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]; };
var built = function(x, y) { return BUILT.some(function(r) { return inRect(x, y, r); }); };

// Farm fields: rectangles of crops drawn on open ground by the iso renderer (see ground.js setFields)
var FIELDS = [];
(function() {
  var r = rng(67);
  var areas = [[1, 1, 19, 98], [20, 1, 30, 9], [20, 56, 30, 43], [62, 79, 24, 20], [1, 86, 60, 13]];
  areas.forEach(function(a) {
    for (var y = a[1]; y < a[1] + a[3]; ) {
      var h = 6 + Math.floor(r() * 6);
      for (var x = a[0]; x < a[0] + a[2]; ) {
        var w = 6 + Math.floor(r() * 8);
        FIELDS.push({x: x, y: y, w: Math.min(w, a[0] + a[2] - x) - 1, h: Math.min(h, a[1] + a[3] - y) - 1, crop: Math.floor(r() * 4)});
        x += w;
      }
      y += h;
    }
  });
})();
export const fieldAt = function(x, y) {
  for (var i = 0; i < FIELDS.length; i++) {
    var f = FIELDS[i];
    if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) return f;
  }
  return null;
};
// A parcel the developer gave up goes back to hay (drawn as fields; the land itself was never built on)
export const farmedFieldAt = function(rects, x, y) {
  for (var i = 0; rects && i < rects.length; i++) {
    var r = rects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return {x: r.x, y: r.y, w: r.w, h: r.h, crop: i % 2 ? 2 : 0};
  }
  return null;
};
export const fieldTileCount = function() { return FIELDS.reduce(function(n, f) { return n + Math.max(0, f.w) * Math.max(0, f.h); }, 0); };

// Map labels drawn over the iso view
export const LABELS = [
  {x: 56.5, y: 6, text: 'I-55'}, {x: 56.5, y: 66, text: 'I-55'},
  {x: 111, y: 24, text: 'Mississippi River'}, {x: 111, y: 76, text: 'Mississippi River'},
  {x: 83, y: 44, text: 'Main Street'}, {x: 10, y: 30, text: 'Farmland'},
  {x: SITE.x + SITE.w / 2, y: SITE.y + 2, text: 'Proposed data center site', kind: 'site'}
];

function smoothTrees(map) {
  var table = [0, 0, 0, 34, 0, 0, 36, 35, 0, 32, 0, 33, 30, 31, 29, 37];
  var tree = function(x, y) { var v = map.getTileValue(x, y); return v >= TV.WOODS_LOW && v <= TV.WOODS_HIGH; };
  for (var x = 0; x < map.width; x++)
    for (var y = 0; y < map.height; y++) {
      if (!tree(x, y)) continue;
      var bits = 0;
      [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(function(d) {
        bits = bits << 1;
        if (map.testBounds(x + d[0], y + d[1]) && tree(x + d[0], y + d[1])) bits++;
      });
      var t = table[bits];
      if (t) map.setTile(x, y, t !== TV.WOODS && ((x + y) & 1) ? t - 8 : t, BLBNBIT);
      else map.setTile(x, y, TV.DIRT, 0);
    }
}

// The terrain: river, bluffs, hedgerows and wooded hills on open ground
export function festusTerrain() {
  var map = new GameMap(W, H);
  var r = rng(1803), x, y;
  for (y = 0; y < H; y++)
    for (x = 0; x < W; x++) map.setTile(x, y, TV.DIRT, 0);

  // The Mississippi, with a wooded bluff line above it
  for (y = 0; y < H; y++) {
    var rx = riverX(y);
    for (x = rx; x < W; x++) map.setTile(x, y, TV.RIVER, 0);
    for (x = rx - 8; x < rx; x++) {
      if (built(x, y)) continue;
      var near = (x - (rx - 8)) / 8;                 // denser right above the water
      if (r() < 0.45 + near * 0.5) map.setTile(x, y, TV.WOODS, BLBNBIT);
    }
  }
  // Water edges: shoreline tiles are bulldozable river edge, like the map generator makes
  for (y = 0; y < H; y++)
    for (x = 0; x < W; x++) {
      if (map.getTileValue(x, y) !== TV.RIVER) continue;
      var edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(function(d) {
        return map.testBounds(x + d[0], y + d[1]) && map.getTileValue(x + d[0], y + d[1]) !== TV.RIVER &&
               map.getTileValue(x + d[0], y + d[1]) !== TV.REDGE;
      });
      if (edge) map.setTile(x, y, TV.REDGE, BULLBIT);
    }

  // Low hills: wooded knobs scattered over the countryside
  for (var k = 0; k < 26; k++) {
    var cx = Math.floor(r() * 100), cy = Math.floor(r() * H), rad = 2 + r() * 3;
    for (y = cy - 5; y <= cy + 5; y++)
      for (x = cx - 5; x <= cx + 5; x++) {
        if (!map.testBounds(x, y) || built(x, y) || map.getTileValue(x, y) !== TV.DIRT) continue;
        var d = Math.hypot(x - cx, y - cy);
        if (d < rad + r() * 1.2) map.setTile(x, y, TV.WOODS, BLBNBIT);
      }
  }
  // Hedgerows along some field edges
  FIELDS.forEach(function(f) {
    if (r() < 0.45) for (x = f.x; x <= f.x + f.w; x++) if (map.testBounds(x, f.y + f.h) && !built(x, f.y + f.h) && map.getTileValue(x, f.y + f.h) === TV.DIRT) map.setTile(x, f.y + f.h, TV.WOODS, BLBNBIT);
  });
  smoothTrees(map);
  map.cityCentreX = DOWNTOWN.x; map.cityCentreY = DOWNTOWN.y;   // land value peaks on Main Street
  map.alScenario = 'festus';
  map.alHousesOnly = true;     // Festus is zoned for houses: a block never turns into apartments (residential.js)
  return map;
}

// The town, laid out with the ordinary Micropolis tools
export function buildFestus(simulation, map) {
  var tools = new GameTools(map);
  var budget = simulation.budget, blockMaps = simulation.blockMaps;
  budget.setFunds(1000000);
  var use = function(name, x, y) {
    var tool = tools[name];
    tool.doTool(x, y, blockMaps);
    tool.modifyIfEnoughFunding(budget);
  };
  var x, y;
  var roadH = function(y, x0, x1) { for (var x = x0; x <= x1; x++) use('road', x, y); };
  var roadV = function(x, y0, y1) { for (var y = y0; y <= y1; y++) use('road', x, y); };
  var wireH = function(y, x0, x1) { for (var x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) use('wire', x, y); };
  var wireV = function(x, y0, y1) { for (var y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) use('wire', x, y); };
  var names = {R: 'residential', C: 'commercial', I: 'industrial', F: 'fire', P: 'police', K: 'park'};

  // A block grid: roads every 7 rows, n zone columns, a power spine down the middle. Blocks built before 2026 are
  // zoned (homes filled in below); platted lots get streets and power but stay empty.
  var houses = rng(2026), homeBlocks = [];
  var grid = function(nb) {
    var ox = nb.ox, oy = nb.oy, rows = nb.rows;
    var n = rows[0].length, half = Math.floor(n / 2), w = 3 * n + 2;
    var bands = Math.ceil(rows.length / 2);
    for (var b = 0; b <= bands; b++) roadH(oy + b * 7, ox, ox + w);
    roadV(ox, oy, oy + bands * 7); roadV(ox + w, oy, oy + bands * 7);
    blocks(nb).forEach(function(k) {
      if (k.type === 'K') { for (var py = -1; py <= 1; py++) for (var px = -1; px <= 1; px++) use('park', k.x + px, k.y + py); return; }
      if (!k.built) return;
      use(names[k.type], k.x, k.y);
      if (k.type === 'R') homeBlocks.push(k);
    });
    wireV(ox + 1 + half * 3, oy, oy + bands * 7);
    return {x: ox, y: oy, w: w, h: bands * 7};
  };

  // I-55: a divided highway the full height of the map
  roadV(55, 0, H - 1); roadV(58, 0, H - 1);
  // The state road west from the interchange; it becomes Main Street downtown
  roadH(47, 8, 54); roadH(47, 59, 70);
  // A country road and lane through the farms
  roadV(12, 8, 92); roadH(88, 12, 54);

  // Neighbourhoods (Main Street runs through downtown at y=47)
  var downtown = null;
  NEIGHBOURHOODS.forEach(function(nb) { var g = grid(nb); if (nb.downtown) downtown = g; });
  // The old town's blocks are full of houses (six to eight each; the census settles them in the warm-up years)
  homeBlocks.forEach(function(k) {
    var lots = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    var n = 6 + Math.floor(houses() * 3);
    for (var i = 0; i < lots.length && n > 0; i++) {
      if (houses() < (lots.length - i - n) / (lots.length - i)) continue;   // pick n of the 8 lots at random
      map.setTile(k.x + lots[i][0], k.y + lots[i][1], TV.HOUSE + Math.floor(houses() * 3) + 3 * (1 + Math.floor(houses() * 2)), BLBNCNBIT);
      n--;
    }
  });

  // Streets that tie the neighbourhoods into one network
  roadV(30, 27, 32);                // north-west subdivision down to the west one
  roadV(88, 34, 39);                // north side down to downtown
  roadV(62, 34, 46);                // north side down to the state road
  roadV(89, 62, 67);                // downtown to the riverside industry

  // The interchange strip: shops and gas stations along the highway
  [48, 51, 54, 57].forEach(function(ty) { use('commercial', 60, ty + 1); use('commercial', 53, ty + 1); });

  // Power: a plant by the river, a trunk line up the east side of the highway, branches into each neighbourhood
  use('coal', 93, 80); use('coal', 93, 84); use('coal', 97, 80); use('coal', 97, 84);   // the riverside plant
  [[84, 80], [87, 80], [84, 83], [87, 83]].forEach(function(p) { simulation.afterlight.placeBuilding(B.SOLAR, p[0], p[1]); });  // and a solar field
  wireV(93, 75, 78);                // into the industrial grid
  wireH(79, 60, 91);                // west along the south edge
  wireV(60, 60, 79);                // north to the strip (its shops carry power to the interchange)
  wireV(60, 13, 47);                // and on past the state road
  wireH(14, 61, 62);                // north side
  wireV(75, 34, 40);                // the north side's spine down to downtown, so its empty lots have power
  wireH(42, 61, 70);                // downtown
  wireH(63, 61, 62);                // south side
  wireH(24, 50, 59);                // across I-55 to the north-west subdivision
  wireV(40, 26, 33);                // down to the west subdivision
  wireH(35, 42, 43);                // feeder to the site's west edge
  wireH(49, 55, 58);                // under I-55 to the shops on the west side of the interchange

  simulation.afterlight.warmupHooks();   // commuters' jobs and damped demand for the warm-up years (layer.js)
  return {x: downtown.x, y: downtown.y, w: downtown.w, h: downtown.h, site: SITE, festus: true};
}
