/* Afterlight layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * The original Micropolis tile set reserves seven 3x3 "church" buildings (tiles 956-1018) that micropolisJS never
 * places. Afterlight reuses those seven slots for its own buildings and paints new pixel art over them at load time,
 * so the core engine's tile maths (zone size, bulldozing, fire, power conduction) keeps working unchanged.
 */

import * as TV from '../tileValues.ts';

// Centre tile of each Afterlight building (base = centre - 4)
export const DC_HELIX = TV.CHURCH1;      // Helix-owned data center
export const DC_COOP = TV.CHURCH2;       // public / co-op data center
export const SOLAR = TV.CHURCH3;         // solar farm (a power plant)
export const DEPOT_HELIX = TV.CHURCH4;   // Helix robot depot
export const DEPOT_COOP = TV.CHURCH5;    // co-op robot depot
export const FUSION = TV.CHURCH6;        // fusion plant (unlocked by discovery)
export const CLINIC = TV.CHURCH7;        // healing / longevity clinic (unlocked by discovery)

// The Research Lab takes the nine tiles after the explosion frames (884-892). Upstream used them for industrial smoke
// frames, which the isometric view never shows; animationManager.js no longer cycles those three stacks into them.
export const LAB_BASE = 884;
export const LAB = LAB_BASE + 4;

export const ALL = [DC_HELIX, DC_COOP, SOLAR, DEPOT_HELIX, DEPOT_COOP, FUSION, CLINIC, LAB];

export const NAMES = {};
NAMES[DC_HELIX] = 'Helix Data Center';
NAMES[DC_COOP] = 'Co-op Data Center';
NAMES[SOLAR] = 'Solar Farm';
NAMES[DEPOT_HELIX] = 'Helix Robot Depot';
NAMES[DEPOT_COOP] = 'Co-op Robot Depot';
NAMES[FUSION] = 'Fusion Plant';
NAMES[CLINIC] = 'Healing Clinic';
NAMES[LAB] = 'Research Lab';

export const isALTile = function(v) {
  return (v >= TV.CHURCH1BASE && v <= TV.CHURCH7LAST) || (v >= LAB_BASE && v < LAB_BASE + 9);
};

export const centreOf = function(v) {
  if (!isALTile(v)) return -1;
  if (v < TV.CHURCH1BASE) return LAB;
  return TV.CHURCH1BASE + Math.floor((v - TV.CHURCH1BASE) / 9) * 9 + 4;
};

var HELIX = '#a23bd6';
var COOP = '#2fbf4a';

// ---- Pixel art, painted on a 48x48 canvas then cut into nine 16x16 tiles ----
function rect(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }

function ground(c, col) { rect(c, col || '#8a7a5a', 0, 0, 48, 48); }

function dataCenter(c, stripe) {
  ground(c, '#7d7d7d');
  rect(c, '#2b2f36', 3, 4, 42, 40);           // hall
  rect(c, '#3c424c', 3, 4, 42, 3);
  rect(c, stripe, 3, 8, 42, 4);               // owner stripe on the roof
  for (var row = 0; row < 3; row++)           // rooftop cooling fans
    for (var col = 0; col < 5; col++) {
      var fx = 6 + col * 8, fy = 15 + row * 9;
      rect(c, '#1b1e23', fx, fy, 6, 6);
      rect(c, '#596270', fx + 1, fy + 1, 4, 4);
      rect(c, '#1b1e23', fx + 2, fy + 2, 2, 2);
    }
  for (var i = 0; i < 10; i++) rect(c, i % 2 ? '#5ad1ff' : stripe, 5 + i * 4, 42, 2, 1); // status LEDs
}

function solar(c) {
  ground(c, '#6f9a4b');
  for (var r = 0; r < 4; r++)
    for (var k = 0; k < 2; k++) {
      var x = 3 + k * 22, y = 3 + r * 11;
      rect(c, '#1f2f63', x, y, 20, 8);
      rect(c, '#3c59a8', x, y, 20, 1);
      for (var g = 1; g < 5; g++) rect(c, '#5f7fd0', x + g * 4, y + 1, 1, 7);
    }
}

function depot(c, stripe) {
  ground(c, '#8f8f8f');
  rect(c, '#c98a3b', 2, 3, 44, 26);           // warehouse
  rect(c, stripe, 2, 3, 44, 4);
  for (var d = 0; d < 4; d++) rect(c, '#4a3a2a', 5 + d * 10, 19, 7, 10); // bay doors
  for (var b = 0; b < 6; b++) {               // little robots on the apron
    var bx = 4 + b * 7, by = 34 + (b % 2) * 6;
    rect(c, '#f2d24b', bx, by, 5, 5);
    rect(c, '#222', bx + 1, by + 1, 1, 1);
    rect(c, '#222', bx + 3, by + 1, 1, 1);
  }
}

function fusion(c) {
  ground(c, '#b9b9b9');
  rect(c, '#d9e4ea', 6, 6, 36, 36);
  c.fillStyle = '#5fe3ff';
  c.beginPath(); c.arc(24, 24, 15, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d9e4ea';
  c.beginPath(); c.arc(24, 24, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(24, 24, 4, 0, Math.PI * 2); c.fill();
  rect(c, '#6a6a6a', 2, 2, 6, 6); rect(c, '#6a6a6a', 40, 40, 6, 6);
}

function clinic(c) {
  ground(c, '#7fb85a');
  rect(c, '#f4f4f0', 6, 6, 36, 28);
  rect(c, '#d6d6cf', 6, 30, 36, 4);
  rect(c, '#2fbf4a', 21, 10, 6, 18);          // green cross
  rect(c, '#2fbf4a', 15, 16, 18, 6);
  for (var t = 0; t < 4; t++) { rect(c, '#2e6b2a', 6 + t * 11, 38, 6, 6); rect(c, '#3f8f39', 7 + t * 11, 39, 4, 4); }
}

var painters = {};
painters[DC_HELIX] = function(c) { dataCenter(c, HELIX); };
painters[DC_COOP] = function(c) { dataCenter(c, COOP); };
painters[SOLAR] = solar;
painters[DEPOT_HELIX] = function(c) { depot(c, HELIX); };
painters[DEPOT_COOP] = function(c) { depot(c, COOP); };
painters[FUSION] = fusion;
painters[CLINIC] = clinic;
painters[LAB] = function(c) {
  ground(c, '#7fb85a');
  rect(c, '#c9b48f', 4, 10, 40, 26);          // brick and glass
  rect(c, '#5f87a6', 6, 16, 36, 4); rect(c, '#5f87a6', 6, 26, 36, 4);
  c.fillStyle = '#f4f4f0'; c.beginPath(); c.arc(32, 12, 8, Math.PI, 0); c.fill();   // dome
  rect(c, '#3a7bd5', 30, 4, 4, 8);
};

// Replace the seven reserved 3x3 tile slots in a loaded TileSet with Afterlight art.
export const patchTileSet = function(tileSet) {
  if (!tileSet || typeof document === 'undefined') return;
  var big = document.createElement('canvas');
  big.width = big.height = 48;
  var bc = big.getContext('2d');
  var small = document.createElement('canvas');
  small.width = small.height = 16;
  var sc = small.getContext('2d');

  ALL.forEach(function(centre) {
    bc.clearRect(0, 0, 48, 48);
    painters[centre](bc);
    var base = centre - 4;
    for (var i = 0; i < 9; i++) {
      sc.clearRect(0, 0, 16, 16);
      sc.drawImage(big, (i % 3) * 16, Math.floor(i / 3) * 16, 16, 16, 0, 0, 16, 16);
      var img = new Image();
      img.src = small.toDataURL();
      tileSet[base + i] = img;
    }
  });
};
