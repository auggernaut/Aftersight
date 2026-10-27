/* Afterlight isometric map view for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 *
 * A drop-in replacement for GameCanvas: same public methods, but draws the Micropolis tile map as a 2:1 dimetric
 * city. The simulation is untouched; this only reads the map, the sprite list and the mouse box.
 *
 * Rendering: ground is cached in 16x16-tile chunks per zoom level and only repainted when the tiles in it change
 * shape (traffic changes do not count). Buildings are cached sprites (plus shadow sprites) per kind/variant/zoom,
 * sorted back to front each frame and culled to the view. Cars, smoke, lights, fires and protests are drawn live.
 */

import $ from "jquery";

import { AnimationManager } from '../../animationManager.js';
import * as ALB from '../buildings.js';
import { makeP, collectShadows, drawShadows, hash, box, poly, line, cylinder } from './art.js';
import * as B from './buildings.js';
import { paintGroundTile, paintCars, groundSig, trafficLevel, LOT, fieldsKey } from './ground.js';

export const LEVELS = [0.25, 0.35, 0.5, 0.7, 1.0, 1.4];
var CHUNK = 16, PADTOP = 64;

// ---- what stands on a zone centre ----
var T = {};
T[409] = {k: 'hospital', n: 3, own: 4, h: 6};
T[418] = {k: 'church', n: 3, own: 4, h: 6};
T[698] = {k: 'port', n: 4, own: 4, h: 6};
T[716] = {k: 'airport', n: 6, own: 7, h: 7};
T[750] = {k: 'coal', n: 4, own: 5, h: 14, tall: true};
T[765] = {k: 'fire', n: 3, own: 4, h: 5};
T[774] = {k: 'police', n: 3, own: 4, h: 4};
T[784] = {k: 'stadium', n: 4, own: 4, h: 3};
T[800] = {k: 'stadium', n: 4, own: 4, h: 3};
T[816] = {k: 'nuclear', n: 4, own: 6, h: 9, tall: true};
T[ALB.DC_HELIX] = {k: 'dc', owner: 'helix', n: 3, own: 8, h: 3.3};
T[ALB.DC_COOP] = {k: 'dc', owner: 'coop', n: 3, own: 8, h: 3.3};
T[ALB.SOLAR] = {k: 'solar', n: 3, own: 8, h: 1, plant: true};
T[ALB.DEPOT_HELIX] = {k: 'depot', owner: 'helix', n: 3, own: 8, h: 2.9};
T[ALB.DEPOT_COOP] = {k: 'depot', owner: 'coop', n: 3, own: 8, h: 2.9};
T[ALB.FUSION] = {k: 'fusion', n: 3, own: 8, h: 3, plant: true};
T[ALB.CLINIC] = {k: 'clinic', n: 3, own: 1, h: 3.6};
T[750].plant = T[816].plant = true;

var RES_H = [0, 3.4, 4.6, 8.6, 16.2], COM_H = [0, 1.6, 3.7, 9, 14.2, 24], IND_H = [0, 2.9, 7, 8, 10];

export const classify = function(v) {
  if (T[v]) return T[v];
  if (v >= 265 && v < 405) {
    var i = Math.floor((v - 265) / 9);
    var pop = i % 4 + 1;
    return {k: 'res', n: 3, own: 1, pop: pop, lp: Math.min(3, Math.floor(i / 4)), h: RES_H[pop], tall: pop >= 3};
  }
  if (v >= 436 && v <= 609) {
    i = Math.floor((v - 436) / 9);
    pop = i % 5 + 1;
    return {k: 'com', n: 3, own: 2, pop: pop, lp: Math.min(3, Math.floor(i / 5)), h: COM_H[pop], tall: pop >= 3};
  }
  if (v >= 625 && v <= 692) {
    i = Math.floor((v - 625) / 9);
    pop = i % 4 + 1;
    return {k: 'ind', n: 3, own: 3, pop: pop, lp: Math.min(1, Math.floor(i / 4)), h: IND_H[pop], tall: pop >= 2};
  }
  return null;
};

function IsoCanvas(parentId) {
  var parentNode = typeof parentId === 'string' ? document.getElementById(parentId.replace(/^#/, '')) : parentId;
  if (!parentNode) throw new Error('Node ' + parentId + ' not found');
  this._parent = parentNode;
  this._canvas = document.createElement('canvas');
  this._canvas.id = IsoCanvas.DEFAULT_ID;
  this._canvas.style.margin = '0';
  this._canvas.style.padding = '0';
  this._canvas.style.display = 'block';
  var current = document.getElementById(IsoCanvas.DEFAULT_ID);
  if (current) current.parentNode.replaceChild(this._canvas, current);
  else parentNode.appendChild(this._canvas);
  this._shadowCanvas = document.createElement('canvas');
  this.ready = false;
  this.toolActive = function() { return false; };
  this._resize();
}

IsoCanvas.DEFAULT_ID = 'MicropolisCanvas';

IsoCanvas.prototype._resize = function() {
  var rect = this._parent.getBoundingClientRect();
  this._dpr = Math.min(2, window.devicePixelRatio || 1);
  this._w = Math.max(64, Math.floor(rect.width));
  this._h = Math.max(64, Math.floor(rect.height));
  this._canvas.width = this._w * this._dpr;
  this._canvas.height = this._h * this._dpr;
  this._canvas.style.width = this._w + 'px';
  this._canvas.style.height = this._h + 'px';
  this._shadowCanvas.width = this._canvas.width;
  this._shadowCanvas.height = this._canvas.height;
  this._chunks = new Map();     // cached chunk images (resolution depends on dpr)
  this._sprites = new Map();
};

IsoCanvas.prototype.init = function(map, tileSet, spriteSheet) {
  this._map = map;
  this._tileSet = tileSet;
  this._spriteSheet = spriteSheet;
  this.animationManager = new AnimationManager(map);
  var n = map.width * map.height;
  this._raw = new Int32Array(n).fill(-9);
  this._sig = new Int32Array(n).fill(-9);
  this._own = new Uint8Array(n);
  this._cw = Math.ceil(map.width / CHUNK);
  this._chh = Math.ceil(map.height / CHUNK);
  this._chunkVer = new Int32Array(this._cw * this._chh);
  this._objects = [];
  this._roads = [];
  this._lastScan = 0;
  this._zoomIdx = 3;
  this._zoom = LEVELS[3];
  this._zoomTarget = LEVELS[3];
  this._zoomAnchor = null;
  this._shake = 0;
  this._chunkBudget = 0;
  // exposed like GameCanvas so getSpritesInView returns every sprite on the map
  this.canvasWidth = map.width * 16;
  this.canvasHeight = map.height * 16;
  this.ready = true;
  this._scan(true);
  this.centreOn(Math.floor(map.width / 2), Math.floor(map.height / 2));
  this._bindInput();
  var self = this;
  window.addEventListener('resize', function() { self._pendingResize = true; }, false);
  this.paint(null, null);
};

// ---- camera ----
IsoCanvas.prototype.worldOf = function(u, v) { return {X: (u - v) * 32, Y: (u + v) * 16}; };

IsoCanvas.prototype._clampCam = function() {
  var W = this._map.width, H = this._map.height;
  this._camX = Math.max(-H * 32, Math.min(W * 32, this._camX));
  this._camY = Math.max(0, Math.min((W + H) * 16, this._camY));
};

IsoCanvas.prototype.centreOn = function(x, y) {
  if (y === undefined) { y = x.y; x = x.x; }
  var w = this.worldOf(x + 0.5, y + 0.5);
  this._camX = w.X; this._camY = w.Y;
  this._clampCam();
};

IsoCanvas.prototype.moveTo = function(x, y) { this.centreOn(x, y); };
var STEP = 18;
IsoCanvas.prototype.moveNorth = function() { this._camY -= STEP / this._zoom; this._clampCam(); };
IsoCanvas.prototype.moveSouth = function() { this._camY += STEP / this._zoom; this._clampCam(); };
IsoCanvas.prototype.moveWest = function() { this._camX -= STEP / this._zoom; this._clampCam(); };
IsoCanvas.prototype.moveEast = function() { this._camX += STEP / this._zoom; this._clampCam(); };
IsoCanvas.prototype.disallowOffMap = function() {};

IsoCanvas.prototype.setZoomLevel = function(idx, anchorX, anchorY) {
  idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
  this._zoomIdx = idx;
  this._zoomTarget = LEVELS[idx];
  this._zoomAnchor = anchorX === undefined ? null : {x: anchorX, y: anchorY};
};
IsoCanvas.prototype.zoomIn = function() { this.setZoomLevel(this._zoomIdx + 1); };
IsoCanvas.prototype.zoomOut = function() { this.setZoomLevel(this._zoomIdx - 1); };
IsoCanvas.prototype.setZoomNow = function(idx) { this.setZoomLevel(idx); this._zoom = this._zoomTarget; };

IsoCanvas.prototype._screenToWorld = function(sx, sy, L) {
  L = L || this._zoom;
  return {X: (sx - this._w / 2) / L + this._camX, Y: (sy - this._h / 2) / L + this._camY};
};

IsoCanvas.prototype.screenToTile = function(sx, sy) {
  var w = this._screenToWorld(sx, sy);
  var u = (w.X / 32 + w.Y / 16) / 2, v = (w.Y / 16 - w.X / 32) / 2;
  return {x: Math.floor(u), y: Math.floor(v)};
};

IsoCanvas.prototype.getTileOrigin = function() { return {x: 0, y: 0}; };
IsoCanvas.prototype.getMaxTile = function() { return {x: this._map.width - 1, y: this._map.height - 1}; };

IsoCanvas.prototype.canvasCoordinateToTileOffset = function(x, y) {
  var t = this.screenToTile(x, y);
  if (t.x < -3 || t.y < -3 || t.x >= this._map.width + 3 || t.y >= this._map.height + 3) return null;
  return t;
};
IsoCanvas.prototype.canvasCoordinateToTileCoordinate = function(x, y) {
  var t = this.screenToTile(x, y);
  if (t.x < 0 || t.y < 0 || t.x >= this._map.width || t.y >= this._map.height) return null;
  return t;
};
IsoCanvas.prototype.canvasCoordinateToPosition = IsoCanvas.prototype.canvasCoordinateToTileCoordinate;

// Screen position (CSS px, relative to the canvas) of the centre of tile x,y
IsoCanvas.prototype.tileToCanvasCoordinate = function(x, y) {
  if (y === undefined) { y = x.y; x = x.x; }
  var w = this.worldOf(x + 0.5, y + 0.5);
  var sx = (w.X - this._camX) * this._zoom + this._w / 2, sy = (w.Y - this._camY) * this._zoom + this._h / 2;
  if (sx < 0 || sy < 0 || sx >= this._w || sy >= this._h) return null;
  return {x: sx, y: sy};
};
IsoCanvas.prototype.positionToCanvasCoordinate = IsoCanvas.prototype.tileToCanvasCoordinate;

IsoCanvas.prototype.changeTileSet = function(tileSet) { this._tileSet = tileSet; };
IsoCanvas.prototype.shoogle = function() { this._shake = Date.now() + 1200; };

// ---- input: wheel zoom, drag pan ----
IsoCanvas.prototype._bindInput = function() {
  var self = this, c = this._canvas;
  c.addEventListener('wheel', function(e) {
    e.preventDefault();
    var r = c.getBoundingClientRect();
    if (self._wheelLock && Date.now() < self._wheelLock) return;
    self._wheelLock = Date.now() + 120;
    self.setZoomLevel(self._zoomIdx + (e.deltaY < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top);
  }, {passive: false});
  c.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  var drag = null;
  c.addEventListener('mousedown', function(e) {
    var pan = e.button === 1 || e.button === 2 || (e.button === 0 && !self.toolActive());
    if (!pan) return;
    drag = {x: e.clientX, y: e.clientY, cx: self._camX, cy: self._camY, moved: false};
    c.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', function(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    self._camX = drag.cx - dx / self._zoom;
    self._camY = drag.cy - dy / self._zoom;
    self._clampCam();
  });
  window.addEventListener('mouseup', function() { if (drag) { drag = null; c.style.cursor = ''; } });
  this._bindTouch();
};

// ---- touch: one finger pans, two fingers pinch-zoom (and pan), a tap acts as a click for the current tool ----
// Only pointerType 'touch' is handled here, so mouse and pen keep the desktop paths above. The browser's
// compatibility mouse events that follow a touch are swallowed in the capture phase so a tap never counts twice.
IsoCanvas.prototype._bindTouch = function() {
  var self = this, c = this._canvas, pts = new Map(), gesture = null, lastTouch = 0;
  c.style.touchAction = 'none';
  var rel = function(e) { var r = c.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
  var startGesture = function() {
    var list = Array.from(pts.values());
    if (list.length === 1) {
      var p = list[0];
      gesture = {kind: 'pan', sx: p.x, sy: p.y, cx: self._camX, cy: self._camY, t: Date.now(), moved: false, tap: true};
    } else if (list.length >= 2) {
      var a = list[0], b = list[1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      gesture = {kind: 'pinch', d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), z: self._zoom,
                 world: self._screenToWorld(mx, my, self._zoom), tap: false};
    }
  };
  c.addEventListener('pointerdown', function(e) {
    if (e.pointerType !== 'touch') return;
    lastTouch = Date.now();
    e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
    pts.set(e.pointerId, rel(e));
    var wasPinch = gesture && gesture.kind === 'pinch';
    startGesture();
    if (wasPinch && gesture) gesture.tap = false;
  });
  c.addEventListener('pointermove', function(e) {
    if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
    lastTouch = Date.now();
    e.preventDefault();
    pts.set(e.pointerId, rel(e));
    if (!gesture) return;
    var list = Array.from(pts.values());
    if (gesture.kind === 'pan' && list.length === 1) {
      var dx = list[0].x - gesture.sx, dy = list[0].y - gesture.sy;
      if (!gesture.moved && Math.hypot(dx, dy) > 9) { gesture.moved = true; gesture.tap = false; }
      if (gesture.moved) {
        self._camX = gesture.cx - dx / self._zoom;
        self._camY = gesture.cy - dy / self._zoom;
        self._clampCam();
      }
    } else if (gesture.kind === 'pinch' && list.length >= 2) {
      var a = list[0], b = list[1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      var z = Math.max(LEVELS[0], Math.min(LEVELS[LEVELS.length - 1], gesture.z * d / gesture.d));
      self._zoom = self._zoomTarget = z;
      self._zoomAnchor = null;
      // cache level: the nearest level at or above the live zoom keeps sprites crisp
      var idx = 0;
      while (idx < LEVELS.length - 1 && LEVELS[idx] < z - 0.001) idx++;
      self._zoomIdx = idx;
      // keep the world point under the fingers' midpoint fixed (this also pans with two fingers)
      self._camX = gesture.world.X - (mx - self._w / 2) / z;
      self._camY = gesture.world.Y - (my - self._h / 2) / z;
      self._clampCam();
    }
  });
  var end = function(e) {
    if (e.pointerType !== 'touch' || !pts.has(e.pointerId)) return;
    lastTouch = Date.now();
    e.preventDefault();
    var p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    var g = gesture;
    if (g && g.kind === 'pan' && g.tap && e.type === 'pointerup' && Date.now() - g.t < 600 && self.onTap) self.onTap(p.x, p.y);
    if (g && g.kind === 'pinch' && pts.size < 2) {
      // settle on the nearest zoom level, anchored where the fingers were
      var best = 0;
      for (var i = 1; i < LEVELS.length; i++) if (Math.abs(Math.log(LEVELS[i] / self._zoom)) < Math.abs(Math.log(LEVELS[best] / self._zoom))) best = i;
      var m = self._worldToScreen(g.world.X, g.world.Y);
      self.setZoomLevel(best, m.x, m.y);
    }
    gesture = null;
    if (pts.size) { startGesture(); if (gesture) gesture.tap = false; }
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  // swallow compatibility mouse events and clicks generated by touches
  ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick'].forEach(function(type) {
    self._parent.addEventListener(type, function(e) {
      if (e.target === c && Date.now() - lastTouch < 800) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  });
  this.lastTouchTime = function() { return lastTouch; };
};

IsoCanvas.prototype._worldToScreen = function(X, Y) {
  return {x: (X - this._camX) * this._zoom + this._w / 2, y: (Y - this._camY) * this._zoom + this._h / 2};
};

// ---- map scan: find buildings and dirty chunks ----
IsoCanvas.prototype._markDirty = function(x, y) {
  var cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  if (cx < 0 || cy < 0 || cx >= this._cw || cy >= this._chh) return;
  this._chunkVer[cy * this._cw + cx]++;
};

IsoCanvas.prototype._scan = function(force) {
  var map = this._map, W = map.width, H = map.height, data = map._data, raw = this._raw;
  var changed = !!force, i, x, y, v;
  for (i = 0; i < W * H; i++) {
    v = data[i].getValue();
    if (v !== raw[i]) { raw[i] = v; changed = true; }
  }
  var fk = fieldsKey();
  if (fk !== this._fieldsKey) {      // farm fields changed: repaint every ground chunk
    this._fieldsKey = fk;
    for (i = 0; i < this._chunkVer.length; i++) this._chunkVer[i]++;
  }
  if (!changed) return;
  var own = this._own;
  own.fill(0);
  var objs = [], roads = [];
  for (y = 0; y < H; y++) {
    for (x = 0; x < W; x++) {
      i = y * W + x; v = raw[i];
      var c = null;
      if (data[i].isZone() || T[v]) c = classify(v);
      if (c) {
        var x0 = x - 1, y0 = y - 1, n = c.n;
        for (var dy = 0; dy < n; dy++)
          for (var dx = 0; dx < n; dx++) {
            var xx = x0 + dx, yy = y0 + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H) own[yy * W + xx] = c.own;
          }
        objs.push({c: c, x0: x0, y0: y0, n: n, cx: x, cy: y, seed: hash(x, y, 9), powered: data[i].isPowered(),
                   depth: x0 + y0 + 2 * n, key: c.k + (c.owner || '') + (c.pop || '') + (c.lp || 0)});
      } else if (v >= 249 && v <= 260) {
        var hv = v - 249;
        objs.push({c: {k: 'house', n: 1, lp: Math.floor(hv / 3), variant: hv % 3, h: 2.5}, x0: x, y0: y, n: 1, cx: x, cy: y,
                   seed: hash(x, y, 9), powered: true, depth: x + y + 2, key: 'house' + hv + (hash(x, y, 9) > 0.5 ? 'a' : 'b')});
      } else if (v >= 56 && v <= 63) {
        objs.push({c: {k: 'flames', n: 1}, x0: x, y0: y, n: 1, cx: x, cy: y, seed: hash(x, y, 9), depth: x + y + 2, live: true});
      }
      if (trafficLevel(v)) roads.push(i);
    }
  }
  objs.sort(function(a, b) { return a.depth - b.depth || a.x0 - b.x0; });
  this._objects = objs;
  this._roads = roads;
  var sig = this._sig;
  for (y = 0; y < H; y++)
    for (x = 0; x < W; x++) {
      i = y * W + x;
      var s = groundSig(raw[i], own[i]);
      if (s !== sig[i]) {
        sig[i] = s;
        this._markDirty(x, y); this._markDirty(x - 1, y); this._markDirty(x + 1, y);
        this._markDirty(x, y - 1); this._markDirty(x, y + 1);
      }
    }
};

IsoCanvas.prototype._val = function(x, y) {
  if (x < 0 || y < 0 || x >= this._map.width || y >= this._map.height) return -1;
  return this._raw[y * this._map.width + x];
};

// ---- ground chunks ----
IsoCanvas.prototype._chunk = function(cx, cy, idx, allowRender) {
  var key = idx + ':' + cx + ':' + cy, ver = this._chunkVer[cy * this._cw + cx];
  var e = this._chunks.get(key);
  if (e && e.ver === ver) { e.used = this._frame; return e; }
  if (!allowRender) return e || null;
  var Lr = LEVELS[idx] * this._dpr;
  var X0 = (cx * CHUNK - cy * CHUNK - CHUNK) * 32, Y0 = (cx * CHUNK + cy * CHUNK) * 16 - PADTOP;
  var cv = e ? e.img : document.createElement('canvas');
  cv.width = Math.ceil(CHUNK * 64 * Lr);
  cv.height = Math.ceil((CHUNK * 32 + PADTOP) * Lr);
  var ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  var P = makeP(-X0 * Lr, -Y0 * Lr, Lr);
  var self = this, W = this._map.width;
  var u0 = cx * CHUNK, v0 = cy * CHUNK;
  var u1 = Math.min(this._map.width, u0 + CHUNK), v1 = Math.min(this._map.height, v0 + CHUNK);
  for (var s = u0 + v0; s <= u1 + v1 - 2; s++) {
    for (var u = Math.max(u0, s - v1 + 1); u <= Math.min(u1 - 1, s - v0); u++) {
      var v = s - u;
      var i = v * W + u;
      paintGroundTile(ctx, P, u, v, this._raw[i], this._own[i], function(dx, dy) { return self._val(u + dx, v + dy); }, Lr);
    }
  }
  e = {img: cv, ver: ver, X0: X0, Y0: Y0, Lr: Lr, used: this._frame};
  this._chunks.set(key, e);
  this._chunkBudget--;
  // keep the cache bounded
  if (this._chunks.size > 140) {
    var oldest = null;
    this._chunks.forEach(function(val, k) { if (!oldest || val.used < oldest[1].used) oldest = [k, val]; });
    if (oldest) this._chunks.delete(oldest[0]);
  }
  return e;
};

// ---- building sprites ----
var SPRITE_PAD = 8, SHADOW_PAD = 110;
IsoCanvas.prototype._sprite = function(o, idx) {
  var key = idx + ':' + o.key + ':' + Math.floor(o.seed * 4);
  var e = this._sprites.get(key);
  if (e) return e;
  var c = o.c, n = o.n, Lr = LEVELS[idx] * this._dpr;
  var top = ((c.h || 4) + 8) * 9 + 20;
  var w = Math.ceil((n * 64 + SPRITE_PAD * 2 + SHADOW_PAD) * Lr), h = Math.ceil((n * 32 + top + SPRITE_PAD) * Lr);
  var ox = (n * 32 + SPRITE_PAD) * Lr, oy = top * Lr;
  var img = document.createElement('canvas'); img.width = w; img.height = h;
  var sh = document.createElement('canvas'); sh.width = w; sh.height = h;
  var ctx = img.getContext('2d'), P = makeP(ox, oy, Lr);
  var boxes = [];
  collectShadows(boxes);
  var seed = Math.floor(o.seed * 4) / 4;
  try {
    switch (c.k) {
      case 'house': B.house(ctx, P, c.lp, c.variant, seed); break;
      case 'res': B.residential(ctx, P, c.pop, c.lp, seed); break;
      case 'com': B.commercial(ctx, P, c.pop, c.lp, seed); break;
      case 'ind': B.industrial(ctx, P, c.pop, c.lp, seed); break;
      case 'coal': B.coal(ctx, P); break;
      case 'nuclear': B.nuclear(ctx, P); break;
      case 'fire': case 'police': case 'hospital': case 'church': B.civic(ctx, P, c.k); break;
      case 'stadium': B.stadium(ctx, P); break;
      case 'port': B.port(ctx, P); break;
      case 'airport': B.airport(ctx, P); break;
      case 'dc': B.dataCenter(ctx, P, c.owner); break;
      case 'depot': B.depot(ctx, P, c.owner); break;
      case 'solar': B.solar(ctx, P); break;
      case 'fusion': B.fusion(ctx, P); break;
      case 'clinic': B.clinic(ctx, P); break;
    }
  } finally { collectShadows(null); }
  drawShadows(sh.getContext('2d'), P, boxes);
  e = {img: img, shadow: sh, ox: ox, oy: oy, Lr: Lr};
  this._sprites.set(key, e);
  return e;
};

// ---- painting ----
IsoCanvas.prototype.paint = function(mouse, sprites, isPaused) {
  if (!this.ready) throw new Error('Not ready!');
  if (this._pendingResize) { this._pendingResize = false; this._resize(); }
  var now = Date.now();
  if (now - this._lastScan > 250) { this._lastScan = now; this._scan(false); }
  // ease the zoom, keeping the anchor point fixed
  if (this._zoom !== this._zoomTarget) {
    var old = this._zoom;
    var nz = old + (this._zoomTarget - old) * 0.25;
    if (Math.abs(nz - this._zoomTarget) < 0.004) nz = this._zoomTarget;
    if (this._zoomAnchor) {
      var a = this._zoomAnchor;
      var before = this._screenToWorld(a.x, a.y, old);
      this._zoom = nz;
      var after = this._screenToWorld(a.x, a.y, nz);
      this._camX += before.X - after.X; this._camY += before.Y - after.Y;
      this._clampCam();
    } else this._zoom = nz;
  }
  this._frame = (this._frame || 0) + 1;
  this._chunkBudget = 10;
  var ctx = this._canvas.getContext('2d');
  var shake = this._shake > now ? Math.sin(now / 30) * 4 : 0;
  this._render(ctx, this._w, this._h, this._camX + shake, this._camY, this._zoom, this._zoomIdx, mouse, sprites, now, this._shadowCanvas);
};

IsoCanvas.prototype._render = function(ctx, W, H, camX, camY, L, idx, mouse, sprites, t, shadowCanvas) {
  var dpr = this._dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a7d8c'); g.addColorStop(1, '#3d5a66');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  var ox = W / 2 - camX * L, oy = H / 2 - camY * L;
  var P = makeP(ox, oy, L);
  var vx0 = camX - W / 2 / L, vx1 = camX + W / 2 / L, vy0 = camY - H / 2 / L, vy1 = camY + H / 2 / L;
  var self = this, map = this._map;

  // map base slab so the edge of the world reads as land, not void
  var Wm = map.width, Hm = map.height;
  poly(ctx, P, [[0, 0, 0], [Wm, 0, 0], [Wm, Hm, 0], [0, Hm, 0]], '#7fa94f');
  poly(ctx, P, [[0, Hm, 0], [Wm, Hm, 0], [Wm, Hm, -4], [0, Hm, -4]], '#6b5a44');
  poly(ctx, P, [[Wm, 0, 0], [Wm, Hm, 0], [Wm, Hm, -4], [Wm, 0, -4]], '#4f4232');

  // ground chunks, back to front
  var order = [];
  for (var cy = 0; cy < this._chh; cy++)
    for (var cx = 0; cx < this._cw; cx++) {
      var X0 = (cx * CHUNK - cy * CHUNK - CHUNK) * 32, Y0 = (cx * CHUNK + cy * CHUNK) * 16 - PADTOP;
      if (X0 > vx1 || X0 + CHUNK * 64 < vx0 || Y0 > vy1 || Y0 + CHUNK * 32 + PADTOP < vy0) continue;
      order.push([cx, cy]);
    }
  order.sort(function(a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
  for (var k = 0; k < order.length; k++) {
    var e = this._chunk(order[k][0], order[k][1], idx, this._chunkBudget > 0);
    if (!e) {
      // fall back to any zoom level we already have for this chunk
      for (var j = 0; j < LEVELS.length && !e; j++) e = this._chunks.get(j + ':' + order[k][0] + ':' + order[k][1]) || null;
      if (!e) continue;
    }
    var f = L / e.Lr;
    ctx.drawImage(e.img, ox + e.X0 * L, oy + e.Y0 * L, e.img.width * f, e.img.height * f);
  }

  // live traffic on busy roads
  if (L >= 0.34) {
    var Wd = map.width;
    for (k = 0; k < this._roads.length; k++) {
      var i = this._roads[k], u = i % Wd, v = (i - u) / Wd;
      var X = (u - v) * 32, Y = (u + v) * 16;
      if (X < vx0 - 64 || X > vx1 + 64 || Y < vy0 - 32 || Y > vy1 + 32) continue;
      var val = this._raw[i];
      paintCars(ctx, P, u, v, val, function(dx, dy) { return self._val(u + dx, v + dy); }, trafficLevel(val), t);
    }
  }

  // visible buildings
  var vis = [];
  for (k = 0; k < this._objects.length; k++) {
    var o = this._objects[k];
    var tx = (o.x0 - o.y0) * 32, ty = (o.x0 + o.y0) * 16;
    if (tx - o.n * 32 > vx1 || tx + o.n * 32 + 120 < vx0 || ty > vy1 || ty + o.n * 32 < vy0 - 260) continue;
    vis.push(o);
  }

  // soft shadows, composited once so overlaps don't double up
  if (shadowCanvas) {
    var sctx = shadowCanvas.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (k = 0; k < vis.length; k++) {
      o = vis[k];
      if (o.live) continue;
      var sp = this._sprite(o, idx), q = P(o.x0, o.y0, 0), ff = L / sp.Lr;
      sctx.drawImage(sp.shadow, q[0] - sp.ox * ff, q[1] - sp.oy * ff, sp.shadow.width * ff, sp.shadow.height * ff);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(shadowCanvas, 0, 0);
    ctx.restore();
  }

  // ground-level sprites (trains, ships) go under buildings
  var air = [];
  if (sprites) sprites.forEach(function(s) {
    if (s.type === 1 || s.type === 4) self._paintSprite(ctx, P, s, t, L);
    else air.push(s);
  });

  for (k = 0; k < vis.length; k++) {
    o = vis[k];
    q = P(o.x0, o.y0, 0);
    if (!o.live) {
      sp = this._sprite(o, idx); ff = L / sp.Lr;
      ctx.drawImage(sp.img, q[0] - sp.ox * ff, q[1] - sp.oy * ff, sp.img.width * ff, sp.img.height * ff);
    }
    this._animate(ctx, makeP(q[0], q[1], L), o, t, L);
  }

  air.forEach(function(s) { self._paintSprite(ctx, P, s, t, L); });

  // afternoon light: warm from the upper left, a touch cooler and darker toward the lower right, soft vignette
  var gl = ctx.createLinearGradient(0, 0, W, H);
  gl.addColorStop(0, 'rgba(255,214,150,0.10)'); gl.addColorStop(0.55, 'rgba(255,240,210,0)'); gl.addColorStop(1, 'rgba(40,60,110,0.10)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,20,30,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  if (mouse) this._paintMouse(ctx, P, mouse);
  if (this._overlays) this._paintProtests(ctx, P, this._overlays, t, L);
  this._lastP = P;
};

// Per-frame details on top of a building sprite: lights, smoke, flames, warnings
IsoCanvas.prototype._animate = function(ctx, P, o, t, L) {
  var c = o.c;
  if (c.k === 'flames') {
    var g0 = P(0.5, 0.5, 0), gr = 40 * L;
    var glow = ctx.createRadialGradient(g0[0], g0[1], 0, g0[0], g0[1], gr);
    glow.addColorStop(0, 'rgba(255,150,40,0.55)'); glow.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(g0[0], g0[1], gr, gr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    for (var i = 0; i < 5; i++) {                       // smoke column
      var ph = ((t / 2200) + i / 5 + o.seed) % 1;
      var sp = P(0.5 + ph * 0.8, 0.5 - ph * 0.3, 2 + ph * 9);
      var sr = (5 + ph * 12) * L;
      ctx.fillStyle = 'rgba(60,55,50,' + (0.45 * (1 - ph)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sp[0], sp[1], sr, 0, Math.PI * 2); ctx.fill();
    }
    var spots = [[0.3, 0.35], [0.65, 0.3], [0.5, 0.6], [0.25, 0.7], [0.75, 0.68]];
    for (i = 0; i < spots.length; i++) {               // flickering tongues
      var fl = 0.6 + 0.4 * Math.sin(t / 90 + i * 2.1 + o.seed * 9);
      var b0 = P(spots[i][0], spots[i][1], 0), tip = P(spots[i][0], spots[i][1], (1.6 + i % 3 * 0.5) * fl + 0.6);
      var w = (6 + (i % 2) * 2) * L;
      var fg = ctx.createLinearGradient(0, b0[1], 0, tip[1]);
      fg.addColorStop(0, '#ffe27a'); fg.addColorStop(0.45, '#ff9a2a'); fg.addColorStop(1, 'rgba(220,60,20,0.2)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(b0[0] - w, b0[1]);
      ctx.quadraticCurveTo(b0[0] - w * 0.9, (b0[1] + tip[1]) / 2, tip[0] + Math.sin(t / 120 + i) * 2 * L, tip[1]);
      ctx.quadraticCurveTo(b0[0] + w * 0.9, (b0[1] + tip[1]) / 2, b0[0] + w, b0[1]);
      ctx.closePath(); ctx.fill();
    }
    return;
  }
  var stacks = null;
  if (c.k === 'coal') stacks = [[3.0, 0.7, 14], [3.3, 1.6, 12]];
  else if (c.k === 'ind' && c.pop >= 2) stacks = c.pop === 2 ? [[2.55, 0.6, 7]] : c.pop === 3 ? [[2.4, 2.5, 8]] : [[2.4, 0.5, 10], [2.45, 1.4, 9]];
  if (stacks && o.powered !== false) {
    stacks.forEach(function(s, si) {
      for (var k = 0; k < 4; k++) {
        var ph = ((t / 2600) + k / 4 + o.seed + si * 0.13) % 1;
        var p = P(s[0] + ph * 0.9, s[1] - ph * 0.35, s[2] + 0.4 + ph * 6);
        var rr = (3 + ph * 8) * L, al = 0.42 * (1 - ph) * Math.min(1, ph * 6);
        var sg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr);
        sg.addColorStop(0, 'rgba(236,234,228,' + al.toFixed(3) + ')'); sg.addColorStop(1, 'rgba(236,234,228,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  if (c.k === 'dc' && o.powered) {
    var col = c.owner === 'helix' ? '#e7a6ff' : '#9dffb0';
    for (i = 0; i < 9; i++) {
      var on = hash(i, Math.floor(t / 260), o.cx) > 0.45;
      if (!on) continue;
      var q = P(0.35 + i * 0.28, 2.601, 1.0 + (i % 3) * 0.45);
      ctx.fillStyle = i % 3 ? '#7fe3ff' : col;
      ctx.fillRect(q[0] - 1.5 * L, q[1] - 1.5 * L, Math.max(1.5, 3 * L), Math.max(1.5, 3 * L));
    }
    var beacon = P(2.7, 0.3, 3.6);
    if (Math.floor(t / 700) % 2) { ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(beacon[0], beacon[1], Math.max(1.5, 3 * L), 0, Math.PI * 2); ctx.fill(); }
  }
  if (c.k === 'depot' && o.powered) {     // robots shuttling in the yard
    for (i = 0; i < 3; i++) {
      var ph2 = ((t / 3000) + i / 3 + o.seed) % 1;
      var uu = 0.4 + Math.abs(ph2 * 2 - 1) * 2.1;
      box(ctx, P, uu, 2.2 + i * 0.2, uu + 0.2, 2.35 + i * 0.2, 0, 0.6, '#e7e3da', {noShadow: true});
      var eye = P(uu + 0.1, 2.35 + i * 0.2, 0.45);
      ctx.fillStyle = c.owner === 'helix' ? '#c86bff' : '#5dff7a';
      ctx.fillRect(eye[0] - 1, eye[1] - 1, 2, 2);
    }
  }
  if (c.k === 'fusion') {
    var pulse = 0.5 + 0.5 * Math.sin(t / 400);
    var cp = P(1.5, 1.5, 1.3);
    ctx.fillStyle = 'rgba(127,232,255,' + (0.15 + 0.2 * pulse).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(cp[0], cp[1] - 6 * L, 40 * L, 20 * L, 0, 0, Math.PI * 2); ctx.fill();
  }
  // unpowered zones flash a lightning bolt
  if (o.powered === false && !c.plant && c.k !== 'house' && Math.floor(t / 500) % 2) {
    var b = P(o.n / 2, o.n / 2, (c.h || 3) + 2.5), s = Math.max(0.6, L);
    ctx.fillStyle = '#ffd21f'; ctx.strokeStyle = '#4a3a00'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b[0] + 2 * s, b[1] - 12 * s); ctx.lineTo(b[0] - 5 * s, b[1] + 1 * s); ctx.lineTo(b[0], b[1] + 1 * s);
    ctx.lineTo(b[0] - 3 * s, b[1] + 11 * s); ctx.lineTo(b[0] + 6 * s, b[1] - 3 * s); ctx.lineTo(b[0] + 1 * s, b[1] - 3 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
};

// Micropolis sprites (train, helicopter, plane, ship, monster, tornado, explosion) as simple iso shapes
IsoCanvas.prototype._paintSprite = function(ctx, P, s, t, L) {
  var u = s.x / 16, v = s.y / 16;
  switch (s.type) {
    case 1: box(ctx, P, u - 0.3, v - 0.12, u + 0.3, v + 0.12, 0, 0.9, '#b8432f', {noShadow: true}); break;
    case 4: box(ctx, P, u - 0.5, v - 0.2, u + 0.5, v + 0.2, 0, 0.6, '#f2f0ea', {noShadow: true});
      box(ctx, P, u - 0.1, v - 0.12, u + 0.25, v + 0.12, 0.6, 1.4, '#c4473a', {noShadow: true}); break;
    case 2:
      var p = P(u, v, 0), q = P(u, v, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 8 * L, 4 * L, 0, 0, 7); ctx.fill();
      box(ctx, P, u - 0.2, v - 0.1, u + 0.2, v + 0.1, 6.5, 7.4, '#e2b23b', {noShadow: true});
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      var a = t / 40;
      ctx.beginPath(); ctx.moveTo(q[0] - Math.cos(a) * 14 * L, q[1] - 8 * L - Math.sin(a) * 4 * L); ctx.lineTo(q[0] + Math.cos(a) * 14 * L, q[1] - 8 * L + Math.sin(a) * 4 * L); ctx.stroke();
      break;
    case 3:
      p = P(u, v, 0); q = P(u, v, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(p[0] + 20 * L, p[1], 18 * L, 6 * L, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f4f4f0'; ctx.strokeStyle = '#7a7a7a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(q[0], q[1], 18 * L, 4 * L, -0.45, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(q[0], q[1], 4 * L, 16 * L, -0.45, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 5:
      box(ctx, P, u - 0.6, v - 0.6, u + 0.6, v + 0.6, 0, 6, '#4f8f3a', {noShadow: true});
      p = P(u, v, 6.5); ctx.fillStyle = '#ff3b30'; ctx.fillRect(p[0] - 6 * L, p[1] - 3 * L, 4 * L, 3 * L); ctx.fillRect(p[0] + 2 * L, p[1] - 3 * L, 4 * L, 3 * L);
      break;
    case 6:
      for (var i = 0; i < 6; i++) {
        p = P(u + Math.sin(t / 120 + i) * 0.1 * i, v, i * 2);
        ctx.fillStyle = 'rgba(120,120,120,0.45)';
        ctx.beginPath(); ctx.ellipse(p[0], p[1], (5 + i * 4) * L, (2 + i * 1.5) * L, 0, 0, 7); ctx.fill();
      }
      break;
    case 7:
      p = P(u, v, 1);
      var r = (8 + (s.frame || 1) * 4) * L;
      ctx.fillStyle = 'rgba(255,160,40,0.85)'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,150,0.9)'; ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.5, 0, 7); ctx.fill();
      break;
  }
};

IsoCanvas.prototype._paintMouse = function(ctx, P, mouse) {
  if (!mouse.width) return;
  var x = mouse.x, y = mouse.y, w = mouse.width, h = mouse.height;
  if (w > 2) x -= 1;
  if (h > 2) y -= 1;
  var col = mouse.colour || 'yellow';
  ctx.save();
  ctx.globalAlpha = 0.28;
  poly(ctx, P, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col);
  ctx.globalAlpha = 1;
  poly(ctx, P, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], null, col, 2);
  ctx.restore();
};

// Afterlight overlays: protest camps as an iso ring of people with placards around the blockaded building
IsoCanvas.prototype.paintOverlays = function(list) {
  this._overlays = list && list.length ? list : null;
  if (!this._overlays || !this._lastP) return;
  var ctx = this._canvas.getContext('2d');
  ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  this._paintProtests(ctx, this._lastP, this._overlays, Date.now(), this._zoom);
  this._paintMarks(ctx, this._lastP, this._overlays, Date.now(), this._zoom);
  this._overlays = null;
};

// Aftersight: map labels (I-55, the river, Main Street) and the proposed data center site, in world space
IsoCanvas.prototype._paintMarks = function(ctx, P, list, t, L) {
  list.forEach(function(item) {
    if (item.kind === 'site' || item.kind === 'build') {
      var c = [[item.x, item.y], [item.x + item.w, item.y], [item.x + item.w, item.y + item.h], [item.x, item.y + item.h]].map(function(q) { return P(q[0], q[1], 0); });
      ctx.save();
      ctx.beginPath(); c.forEach(function(p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath();
      ctx.fillStyle = item.kind === 'build' ? 'rgba(160,120,70,0.35)' : 'rgba(255,214,90,0.10)'; ctx.fill();
      ctx.strokeStyle = item.kind === 'build' ? 'rgba(240,150,40,0.95)' : 'rgba(255,214,90,0.9)';
      ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t / 80; ctx.stroke(); ctx.setLineDash([]);
      if (item.kind === 'build') {          // tower cranes over the graded site
        [[item.x + item.w * 0.3, item.y + item.h * 0.4], [item.x + item.w * 0.7, item.y + item.h * 0.6]].forEach(function(q, k) {
          var b = P(q[0], q[1], 0), top = P(q[0], q[1], 9);
          ctx.strokeStyle = '#e8b52c'; ctx.lineWidth = Math.max(1.5, 3 * L);
          ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
          var sw = Math.sin(t / 2400 + k) * 0.6, arm = P(q[0] + 3 * Math.cos(sw), q[1] + 3 * Math.sin(sw), 9);
          ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(arm[0], arm[1]); ctx.stroke();
        });
      }
      ctx.restore();
      return;
    }
    if (item.kind !== 'label' && item.kind !== 'sitelabel') return;
    var p = P(item.x, item.y, 0);
    var fs = Math.round(Math.max(11, Math.min(18, 15 * Math.sqrt(L / 0.7))));
    ctx.save();
    ctx.font = (item.kind === 'sitelabel' ? '700 ' : '600 ') + fs + 'px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(item.text).width + 16, h = fs + 10;
    ctx.fillStyle = item.kind === 'sitelabel' ? 'rgba(40,30,10,0.78)' : 'rgba(14,20,26,0.55)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(p[0] - w / 2, p[1] - h / 2, w, h, h / 2); ctx.fill(); }
    else ctx.fillRect(p[0] - w / 2, p[1] - h / 2, w, h);
    ctx.fillStyle = item.kind === 'sitelabel' ? '#ffd65a' : 'rgba(255,255,255,0.92)';
    ctx.fillText(item.text, p[0], p[1] + 0.5);
    ctx.restore();
  });
};

IsoCanvas.prototype._paintProtests = function(ctx, P, list, t, L) {
  list.forEach(function(item) {
    if (item.kind !== 'protest') return;
    var cu = item.x + item.w / 2, cv = item.y + item.h / 2, R = 2.3 + Math.sin(t / 300) * 0.05;
    ctx.save();
    ctx.beginPath();
    for (var k = 0; k <= 40; k++) {
      var a = k / 40 * Math.PI * 2, p = P(cu + Math.cos(a) * (R + 0.4), cv + Math.sin(a) * (R + 0.4), 0);
      if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.fillStyle = 'rgba(255,60,40,0.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(230,40,30,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    var people = [];
    for (k = 0; k < 22; k++) {
      var ang = k / 22 * Math.PI * 2 + t / 9000;
      people.push([cu + Math.cos(ang) * R, cv + Math.sin(ang) * R, k]);
    }
    people.sort(function(a, b) { return (a[0] + a[1]) - (b[0] + b[1]); });
    var s = Math.max(0.5, L);
    people.forEach(function(pp) {
      var bob = Math.abs(Math.sin(t / 200 + pp[2])) * 2 * s;
      var f = P(pp[0], pp[1], 0);
      ctx.fillStyle = ['#2d3a5a', '#5a2d2d', '#2d5a3a', '#4a4a4a'][pp[2] % 4];
      ctx.fillRect(f[0] - 2 * s, f[1] - 9 * s - bob, 4 * s, 9 * s);
      ctx.fillStyle = '#e8c4a0';
      ctx.beginPath(); ctx.arc(f[0], f[1] - 11 * s - bob, 2.2 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(f[0] + 2 * s, f[1] - 8 * s - bob); ctx.lineTo(f[0] + 2 * s, f[1] - 18 * s - bob); ctx.stroke();
      ctx.fillStyle = (pp[2] + Math.floor(t / 600)) % 3 ? '#ffffff' : '#ff3b30';
      ctx.fillRect(f[0] - 3 * s, f[1] - 24 * s - bob, 10 * s, 6 * s);
    });
    var top = P(cu, cv, 9);
    ctx.font = 'bold ' + Math.round(Math.max(11, 14 * L)) + 'px system-ui, sans-serif';
    var label = 'PROTEST', tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = '#e0342a';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(top[0] - tw / 2, top[1] - 12, tw, 22, 11) : ctx.rect(top[0] - tw / 2, top[1] - 12, tw, 22); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, top[0], top[1]);
    ctx.restore();
  });
};

// Render a still of the city around tile x,y into a canvas (the newspaper photo)
IsoCanvas.prototype.renderPhoto = function(canvas, x, y, idx) {
  idx = idx === undefined ? 3 : idx;
  var w = this.worldOf(x + 0.5, y + 0.5), dpr = this._dpr;
  this._dpr = 2;                       // the photo canvas is drawn at 2x its CSS size
  var sc = document.createElement('canvas');
  sc.width = canvas.width; sc.height = canvas.height;
  this._chunkBudget = 999;
  var cw = canvas.width / this._dpr, ch = canvas.height / this._dpr;
  var saved = this._chunks, savedS = this._sprites;
  if (this._dpr !== dpr) { this._chunks = new Map(); this._sprites = new Map(); }
  this._render(canvas.getContext('2d'), cw, ch, w.X, w.Y - 20, LEVELS[idx], idx, null, null, Date.now(), sc);
  if (this._dpr !== dpr) { this._chunks = saved; this._sprites = savedS; }
  this._dpr = dpr;
};

// ---- screenshots ----
IsoCanvas.prototype.screenshotVisible = function() { return this._canvas.toDataURL(); };
IsoCanvas.prototype.screenshotMap = function() {
  var W = this._map.width, H = this._map.height, L = LEVELS[0];
  var cw = Math.ceil((W + H) * 32 * L), ch = Math.ceil((W + H) * 16 * L + 80);
  var c = document.createElement('canvas'), sc = document.createElement('canvas');
  var dpr = this._dpr; this._dpr = 1;
  c.width = sc.width = cw; c.height = sc.height = ch;
  var camX = (W - H) * 16, camY = (W + H) * 8 - 20;
  this._chunkBudget = 999;
  this._render(c.getContext('2d'), cw, ch, camX, camY, L, 0, null, null, Date.now(), sc);
  this._dpr = dpr;
  this._chunks = new Map(); this._sprites = new Map();
  return c.toDataURL();
};

export { IsoCanvas };
