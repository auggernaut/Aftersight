/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import $ from "jquery";

import { MiscUtils } from './miscUtils.js';

/*
 *
 * The SplashCanvas handles painting a canvas with the minimap that is shown to the player when selecting a map to
 * play on (in fact it also handles the creation of said canvas). It is a far lighter cousin of GameCanvas, as the
 * map only needs to be painted once (although new maps may be painted if the player generates a new map). We let
 * the canvas handle the scaling of the tiles.
 *
 */


// Takes the DOM id of the container in which the new canvas should be placed, and the tileset that should be used
// for painting. Additionally, this function can also take an optional ID for the new canvas; SplashScreen.DEFAULT_ID
// will be used if this isn't supplied.
//
// Handles canvas creation, throwing an error if the canvas' ID exists anywhere other than the specified parent node,
// or if the given parent node is absent, or if the tileset isn't valid. This function does not paint the canvas: you
// must explicitly call paint with a map.
function SplashCanvas(parentID, tileSet, id) {
  id = id || SplashCanvas.DEFAULT_ID;

  if (!(this instanceof SplashCanvas))
    return new SplashCanvas(parentNode, tileSet, id);

  if (parentID === undefined)
    throw new Error('No container specified');
  else if (tileSet === undefined)
    throw new Error('No tileset specified');
  else if (!tileSet.isValid)
    throw new Error('Tileset is not valid!');

  this._tileSet = tileSet;

  // Check the parent container exists
  var parentNode = $(MiscUtils.normaliseDOMid(parentID));
  parentNode = parentNode.length === 0 ? null : parentNode[0];
  if (parentNode === null)
    throw new Error('SplashCanvas container ID ' + parentID + ' not found');

  var height = SplashCanvas.DEFAULT_HEIGHT;
  var width = SplashCanvas.DEFAULT_WIDTH;

  // Create the canvas
  this._canvas = document.createElement('canvas');
  this._canvas.id = id;
  this._canvas.width = width;
  this._canvas.height = height;

  // Remove any existing element with the same id
  var existing = document.getElementById(id);
  if (existing !== null) {
    if (existing.parentNode === parentNode) {
      console.warn('There was already an object with the same ID as SplashCanvas - replacing it!');
      parentNode.replaceChild(this._canvas, existing);
    } else {
      console.warn('SplashCanvas id ' + id + ' already exists somewhere in document');
      throw new Error('ID ' + id + ' already exists in document!');
    }
  } else {
    parentNode.appendChild(this._canvas);
  }
}


// Aftersight: the minimap is painted in the iso view's palette (grass, woods, water) instead of the 1989 tiles
var SPLASH_COLOURS = {water: '#62b6ea', shore: '#8fd0f2', woods: '#4f9a52', woodsLight: '#68b064', land: '#a8d68a', other: '#d9d3c3'};
SplashCanvas.prototype._paintTile = function(tileVal, x, y, ctx) {
  var c = SPLASH_COLOURS;
  var col = tileVal === 0 ? c.land :
            tileVal >= 2 && tileVal <= 4 ? c.water :
            tileVal >= 5 && tileVal <= 20 ? c.shore :
            tileVal >= 21 && tileVal <= 43 ? ((x * 7 + y * 13) % 5 ? c.woods : c.woodsLight) : c.other;
  ctx.fillStyle = col;
  ctx.fillRect(x * 3, y * 3, 3, 3);
};


// Loop through the given map, painting each tile scaled down
SplashCanvas.prototype.paint = function(map) {
  var ctx = this._canvas.getContext('2d');
  ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

  for (var y = 0; y < map.height; y++) {
    for (var x = 0; x < map.width; x++) {
      this._paintTile(map.getTileValue(x, y), x, y, ctx);
    }
  }
};


SplashCanvas.DEFAULT_WIDTH = 360;
SplashCanvas.DEFAULT_HEIGHT = 300;
SplashCanvas.DEFAULT_ID = 'SplashCanvas';


export { SplashCanvas };
