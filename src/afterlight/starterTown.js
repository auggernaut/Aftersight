/* Afterlight layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * Lays out an ordinary present-day small town (roads, homes, shops, a factory district, a coal plant, police, fire,
 * and one Helix data center) on a freshly generated map, then lets Micropolis grow it for a few years so play starts
 * in Jan 2026 with a lived-in town rather than an empty valley.
 */

import { GameTools } from '../gameTools.js';
import * as TV from '../tileValues.ts';
import * as B from './buildings.js';

var W = 27, H = 22, LEFT = 6;

function waterIn(map, ox, oy) {
  var n = 0;
  for (var y = oy - 1; y <= oy + H; y++)
    for (var x = ox - LEFT; x <= ox + W; x++) {
      if (!map.testBounds(x, y)) return 1e9;
      var v = map.getTileValue(x, y);
      if (v >= TV.WATER_LOW && v <= TV.WATER_HIGH) n++;
    }
  return n;
}

function chooseOrigin(map) {
  var best = null, bestScore = 1e12;
  var cx = map.width / 2, cy = map.height / 2;
  for (var oy = 2; oy + H + 2 < map.height; oy += 2)
    for (var ox = LEFT + 2; ox + W + 2 < map.width; ox += 2) {
      var score = waterIn(map, ox, oy) * 1000 + Math.abs(ox + W / 2 - cx) + Math.abs(oy + H / 2 - cy);
      if (score < bestScore) { bestScore = score; best = {x: ox, y: oy}; }
    }
  return best;
}

export function buildStarterTown(simulation, map) {
  var tools = new GameTools(map);
  var budget = simulation.budget;
  var blockMaps = simulation.blockMaps;
  budget.setFunds(1000000);

  var use = function(name, x, y) {
    var tool = tools[name];
    tool.doTool(x, y, blockMaps);
    tool.modifyIfEnoughFunding(budget);
  };

  var o = chooseOrigin(map);
  var ox = o.x, oy = o.y, x, y, i;

  // Roads: four east-west streets and two north-south ones
  [0, 7, 14, 21].forEach(function(ry) { for (x = 0; x < W; x++) use('road', ox + x, oy + ry); });
  [0, W - 1].forEach(function(rx) { for (y = 0; y < H; y++) use('road', ox + rx, oy + y); });

  // Zones: 3x3, eight per row (four each side of a power line at column 13)
  var colX = function(c) { return c < 4 ? 1 + c * 3 : 14 + (c - 4) * 3; };
  var rows = [
    {y: 1, types: 'RRRRRRRR'},
    {y: 4, types: 'RRRRRRRR'},
    {y: 8, types: 'FCCCCCCC'},
    {y: 11, types: 'RRRRCCCC'},
    {y: 15, types: 'PRRRIIII'},
    {y: 18, types: 'RRDHIIII'}
  ];
  var names = {R: 'residential', C: 'commercial', I: 'industrial', F: 'fire', P: 'police'};
  var dcSpot = null, depotSpot = null;
  rows.forEach(function(row) {
    for (i = 0; i < 8; i++) {
      var t = row.types[i];
      var lx = ox + colX(i), ty = oy + row.y;
      if (t === 'D') { dcSpot = {x: lx, y: ty}; continue; }
      if (t === 'H') { depotSpot = {x: lx, y: ty}; continue; }
      use(names[t], lx + 1, ty + 1);          // building tools take the centre tile
    }
  });

  // One Helix data center already hums at the edge of the factory district (it's 2026)
  if (dcSpot) simulation.afterlight.placeBuilding(B.DC_HELIX, dcSpot.x, dcSpot.y);
  // ...and a Helix fulfillment warehouse with its first robot fleet
  if (depotSpot) simulation.afterlight.placeBuilding(B.DEPOT_HELIX, depotSpot.x, depotSpot.y);

  // Power: a coal plant west of town, a line into the grid, and a spine at column 13
  use('coal', ox - 4, oy + 9);                // 4x4 tool: centre is offset (1,1) from top-left
  simulation.afterlight.placeBuilding(B.SOLAR, ox - 5, oy + 12);   // two small solar farms beside it
  simulation.afterlight.placeBuilding(B.SOLAR, ox - 5, oy + 15);
  // ...and a small university Research Lab past them, so breakthroughs can turn up here
  simulation.afterlight.placeBuilding(B.LAB, ox - 5, oy + 18);
  use('wire', ox - 1, oy + 9);
  use('wire', ox, oy + 9);
  for (y = 0; y < H; y++) use('wire', ox + 13, oy + y);

  // A few parks along the streets
  for (i = 2; i < W - 2; i += 6) use('park', ox + i, oy + H);

  return {x: ox, y: oy, w: W, h: H};
}

// Run the simulation quietly so the town grows into something lived-in, then reset the clock to Jan 2026
export function prewarm(simulation, years) {
  var layer = simulation.afterlight;
  var sim = simulation;
  layer.paused = true;
  var phases = years * 48 * 16;
  for (var i = 0; i < phases; i++) {
    sim._simulate(sim._constructSimData());
  }
  layer.paused = false;
  layer.reset();
  sim._cityTime = 0;
  sim._cityYearLast = -1;
  sim._cityMonthLast = -1;
  sim.budget.setFunds(20000);
}
