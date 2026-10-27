/* Afterlight interface for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * The modern shell around the iso view: toolbar icons and tooltips, speed controls, the RCI demand meter, zoom
 * buttons, the About panel and the newspaper photo. It only drives existing game hooks; the engine is untouched.
 */

import $ from "jquery";

import { TOOL_CLICKED } from '../messages.ts';

import { makeP, box, quad, line, tree, poly, cylinder } from './iso/art.js';
import { money, moneyText } from './money.js';
import * as B from './iso/buildings.js';

// ---- toolbar icons: tiny iso renders of what each tool builds ----
function iconCanvas(draw, n, lift) {
  var S = 88, c = document.createElement('canvas');
  c.width = S; c.height = S;
  var ctx = c.getContext('2d');
  var L = 70 / (64 * n);
  var P = makeP(S / 2, S - 10 - n * 32 * L - (lift || 0), L);
  draw(ctx, P, L);
  return c.toDataURL();
}

function roadIcon(ctx, P) {
  quad(ctx, P, 0, 0, 1, 1, '#86b257');
  quad(ctx, P, 0, 0.12, 1, 0.88, '#cbc6bb');
  quad(ctx, P, 0, 0.24, 1, 0.76, '#55565b');
  quad(ctx, P, 0.1, 0.485, 0.4, 0.515, '#e9d27a'); quad(ctx, P, 0.6, 0.485, 0.9, 0.515, '#e9d27a');
  box(ctx, P, 0.5, 0.56, 0.72, 0.7, 0, 0.6, '#d6402f', {noShadow: true});
}

var ICONS = {
  query: function(ctx) {
    ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(38, 38, 18, 0, 7); ctx.stroke();
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(52, 52); ctx.lineTo(70, 70); ctx.stroke();
    ctx.fillStyle = '#f4f1ea'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 38, 39);
  },
  bulldozer: [1, function(ctx, P) {
    box(ctx, P, 0.1, 0.25, 0.75, 0.8, 0, 1.4, '#e8b52c', {noShadow: true});
    box(ctx, P, 0.3, 0.35, 0.65, 0.7, 1.4, 2.6, '#f2c94c', {noShadow: true});
    box(ctx, P, 0.78, 0.15, 0.92, 0.9, 0, 1.2, '#8f8a82', {noShadow: true});
    box(ctx, P, 0.05, 0.2, 0.75, 0.32, 0, 0.6, '#3a3a3a', {noShadow: true});
    box(ctx, P, 0.05, 0.72, 0.75, 0.85, 0, 0.6, '#3a3a3a', {noShadow: true});
  }],
  road: [1, roadIcon],
  rail: [1, function(ctx, P) {
    quad(ctx, P, 0, 0, 1, 1, '#86b257'); quad(ctx, P, 0, 0.24, 1, 0.76, '#9c8f7c');
    for (var i = 0; i < 4; i++) quad(ctx, P, 0.1 + i * 0.25, 0.3, 0.16 + i * 0.25, 0.7, '#6b4b33');
    line(ctx, P, [0, 0.39], [1, 0.39], '#e6e4e0', 2); line(ctx, P, [0, 0.61], [1, 0.61], '#e6e4e0', 2);
  }],
  wire: [1, function(ctx, P) {
    quad(ctx, P, 0, 0, 1, 1, '#86b257');
    line(ctx, P, [0.38, 0.5, 0], [0.5, 0.5, 3.4], '#ddd', 2.2); line(ctx, P, [0.62, 0.5, 0], [0.5, 0.5, 3.4], '#ddd', 2.2);
    line(ctx, P, [0.5, 0.2, 3.0], [0.5, 0.8, 3.0], '#ddd', 2.2);
    line(ctx, P, [0, 0.25, 2.6], [1, 0.25, 2.6], '#333', 1); line(ctx, P, [0, 0.75, 2.6], [1, 0.75, 2.6], '#333', 1);
  }, 14],
  park: [1, function(ctx, P) {
    quad(ctx, P, 0, 0, 1, 1, '#79a347');
    tree(ctx, P, 0.35, 0.45, 1.2, 0.3, 'round'); tree(ctx, P, 0.7, 0.75, 1.0, 0.7, 'pine');
  }, 10],
  residential: [3, function(ctx, P) { B.residential(ctx, P, 2, 1, 0.3); }, 6],
  commercial: [3, function(ctx, P) { B.commercial(ctx, P, 3, 2, 0.5); }, 4],
  industrial: [3, function(ctx, P) { B.industrial(ctx, P, 2, 0, 0.2); }, 6],
  police: [3, function(ctx, P) { B.civic(ctx, P, 'police'); }, 6],
  fire: [3, function(ctx, P) { B.civic(ctx, P, 'fire'); }, 6],
  stadium: [4, function(ctx, P) { B.stadium(ctx, P); }, 6],
  port: [4, function(ctx, P) { B.port(ctx, P); }, 6],
  airport: [6, function(ctx, P) { B.airport(ctx, P); }, 6],
  coal: [4, function(ctx, P) { B.coal(ctx, P); }, 2],
  nuclear: [4, function(ctx, P) { B.nuclear(ctx, P); }, 4],
  solar: [3, function(ctx, P) { B.solar(ctx, P); }, 8],
  fusion: [3, function(ctx, P) { B.fusion(ctx, P); }, 8],
  dcHelix: [3, function(ctx, P) { B.dataCenter(ctx, P, 'helix'); }, 8],
  dcCoop: [3, function(ctx, P) { B.dataCenter(ctx, P, 'coop'); }, 8],
  depotHelix: [3, function(ctx, P) { B.depot(ctx, P, 'helix'); }, 8],
  depotCoop: [3, function(ctx, P) { B.depot(ctx, P, 'coop'); }, 8],
  clinic: [3, function(ctx, P) { B.clinic(ctx, P); }, 8],
  lab: [3, function(ctx, P) { B.lab(ctx, P); }, 8]
};

function renderIcons() {
  $('.tbIcon').each(function() {
    var name = $(this).attr('data-icon'), spec = ICONS[name], url;
    if (!spec) return;
    if (typeof spec === 'function') {
      var c = document.createElement('canvas'); c.width = c.height = 88;
      spec(c.getContext('2d'));
      url = c.toDataURL();
    } else url = iconCanvas(spec[1], spec[0], spec[2]);
    $(this).css('background-image', 'url(' + url + ')');
  });
}

var commas = function(n) { return ('' + Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

function AfterlightUI(game) {
  this.game = game;
  this._last = 0;
  var self = this;
  renderIcons();

  // tooltips for anything with data-tip
  var tip = $('#tooltip');
  $(document).on('mouseenter', '[data-tip]', function() {
    if (game.gameCanvas.lastTouchTime && Date.now() - game.gameCanvas.lastTouchTime() < 800) return;
    if ($('body').hasClass('touchUI')) return;
    var r = this.getBoundingClientRect();
    tip.text($(this).attr('data-tip')).removeClass('hidden');
    var tw = tip.outerWidth(), th = tip.outerHeight();
    var x = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2));
    var y = r.top - th - 8;
    if (y < 4) y = r.bottom + 8;
    tip.css({left: x + 'px', top: y + 'px'});
  });
  $(document).on('mouseleave', '[data-tip]', function() { tip.addClass('hidden'); });
  $(document).on('mousedown', function() { tip.addClass('hidden'); });

  // speed controls drive the existing pause toggle and the sim speed
  $('.speedButton').on('click', function(e) {
    e.preventDefault();
    self.setSpeed(+$(this).attr('data-speed'));
  });

  // touch: a tap on the map is a click for the selected tool (pans and pinches are handled by the iso view)
  game.gameCanvas.onTap = function(x, y) {
    var input = game.inputStatus;
    if (!input.currentTool || game.dialogOpen) return;
    input.mouseX = x; input.mouseY = y;          // show the footprint where the tap landed
    input._emitEvent(TOOL_CLICKED, {x: x, y: y});
  };
  var touchUI = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (touchUI) $('body').addClass('touchUI');
  $('body').addClass('inGame');
  // Festus: the top bar shows household income instead of the engine's score, and every price is in real dollars
  var festus = game.simulation.afterlight.s.scenario === 'festus';
  $('body').toggleClass('alFestus', festus);
  if (festus) $('[data-tip]').each(function() { $(this).attr('data-tip', moneyText($(this).attr('data-tip'))); });
  var compact = window.matchMedia && window.matchMedia('(max-width: 760px), (max-height: 500px)');
  if (compact && compact.matches) $('#alPanel').addClass('collapsed');
  // stop iOS page pinch and double-tap zoom over the game; the map has its own pinch
  ['gesturestart', 'gesturechange'].forEach(function(t) { document.addEventListener(t, function(e) { e.preventDefault(); }, {passive: false}); });
  $('#menuToggle').on('click', function(e) { e.preventDefault(); $('#menuButtons').toggleClass('open'); });
  $('#menuButtons').on('click', '.miscButton', function() { $('#menuButtons').removeClass('open'); });

  // zoom buttons
  $('#canvasContainer').append(
    '<div id="zoomButtons" class="initialHiddenNo"><button id="zoomIn" data-tip="Zoom in (mouse wheel)">+</button>' +
    '<button id="zoomOut" data-tip="Zoom out (mouse wheel)">&#x2212;</button></div>' +
    '<div id="hint">' + (touchUI ? 'Drag to pan · pinch to zoom · pick a tool, then tap to build' :
      'Drag to pan · wheel to zoom · right-drag pans while building') + '</div>');
  $('#zoomIn').on('click', function() { game.gameCanvas.zoomIn(); });
  $('#zoomOut').on('click', function() { game.gameCanvas.zoomOut(); });
  setTimeout(function() { $('#hint').addClass('fade'); }, 9000);

  // About panel (credits and licenses)
  game.aboutWindow = {
    open: function() { $('#opaque').removeClass('hidden'); $('#aboutWindow').removeClass('hidden'); },
    close: function() { $('#aboutWindow').addClass('hidden'); $('#opaque').addClass('hidden'); game.dialogOpen = false; game._openWindow = null; }
  };
  $('#aboutRequest').on('click', function(e) {
    e.preventDefault();
    if (game.dialogOpen) return;
    game.dialogOpen = true; game._openWindow = 'aboutWindow'; game.aboutWindow.open();
  });
  $('#aboutForm').on('submit', function(e) { e.preventDefault(); game.aboutWindow.close(); });

  // panel collapse
  var syncCollapse = function() { $('#alCollapse').html($('#alPanel').hasClass('collapsed') ? '+' : '&#x2013;'); };
  $('#alCollapse').on('click', function(e) { e.stopPropagation(); $('#alPanel').toggleClass('collapsed'); syncCollapse(); });
  syncCollapse();
  $('#alPanel .alTitle').on('click', function() { if (compact && compact.matches) $('#alPanel').toggleClass('collapsed'); syncCollapse(); });

  // RCI demand meter
  $('#alRCI').html(['res', 'com', 'ind'].map(function(k, i) {
    return '<div class="rciCol rci_' + k + '" data-tip="' + ['Residential', 'Commercial', 'Industrial'][i] + ' demand">' +
      '<div class="rciTrack"><div class="rciUp"><span id="rci_' + k + 'Up"></span></div><div class="rciDown"><span id="rci_' + k + 'Down"></span></div></div>' +
      '<div class="rciLetter">' + 'RCI'[i] + '</div></div>';
  }).join(''));
  // newspaper photo: a still of the place the story is about
  game.alPanel.onPaperOpen = function(data) {
    var c = document.getElementById('alPaperPhoto');
    var x = data.x, y = data.y;
    if (x === undefined) {
      var st = game.starterTown;
      x = st ? st.x + 13 : game.gameMap.width / 2; y = st ? st.y + 11 : game.gameMap.height / 2;
    }
    try { game.gameCanvas.renderPhoto(c, x, y, 3); } catch (e) { console.warn('photo failed', e); }
    $('#alPaperCaption').text(data.x !== undefined ? 'The scene this week. Ledger photo' : 'Downtown this week. Ledger photo');
  };

  this.frame();
}

AfterlightUI.prototype.setSpeed = function(s) {
  var game = this.game;
  if (s === 0) {
    if (!game.isPaused) $('#pauseRequest').click();
  } else {
    game.defaultSpeed = s;
    if (game.isPaused) $('#pauseRequest').click();
    game.simulation.setSpeed(s);
  }
  this.frame(true);
};

AfterlightUI.prototype.frame = function(force) {
  var now = Date.now();
  if (!force && now - this._last < 400) return;
  this._last = now;
  var game = this.game;
  var speed = game.isPaused ? 0 : game.defaultSpeed;
  $('.speedButton').each(function() { $(this).toggleClass('active', +$(this).attr('data-speed') === speed); });
  $('#fundsShown').text(money(game.simulation.budget.totalFunds));
  var v = game.simulation._valves;
  if (v) [['res', v.resValve, 2000], ['com', v.comValve, 1500], ['ind', v.indValve, 1500]].forEach(function(p) {
    var f = Math.max(-1, Math.min(1, p[1] / p[2]));
    $('#rci_' + p[0] + 'Up').css('height', Math.round(Math.max(0, f) * 100) + '%');
    $('#rci_' + p[0] + 'Down').css('height', Math.round(Math.max(0, -f) * 100) + '%');
  });
  // Aftersight: approval in the top bar, and any decision card waiting for the mayor
  var L = game.simulation.afterlight, m = L.s.mayor;
  var a = Math.round(m.approval);
  $('#alApproval').text(a + '%').css('color', a >= 60 ? '#5ee07a' : a >= 50 ? '#f2d36b' : a >= 40 ? '#f5a54a' : '#ff6b5e');
  var pu = Math.round(L.s.purpose);
  $('#alPurposeHud').text(pu).css('color', pu >= 60 ? '#8fb6ff' : pu >= 45 ? '#f2d36b' : '#ff6b5e');
  if (L.festus()) {
    var mix = L.incomeMix(), tot = Math.max(1, mix.total);
    $('#hudIncW').css('width', (mix.wages / tot * 100).toFixed(1) + '%');
    $('#hudIncO').css('width', (mix.own / tot * 100).toFixed(1) + '%');
    $('#hudIncT').css('width', (mix.transfers / tot * 100).toFixed(1) + '%');
    $('#hudOwn').text(Math.round(mix.ownShare * 100) + '% own');
  }
  var ne = L.nextElection();
  $('.hudApproval').attr('data-tip', m.gameOver ? 'You lost the ' + m.gameOver.year + ' election' :
    'Your approval. ' + (ne >= 0 ? 'Next election ' + L.monthName(ne) + ' (' + (ne - L.mi()) + ' months); under 50% and you\'re out.' : ''));
  if (L.s.card && !game.dialogOpen && !game.alNoPaper && game.alCards) game.alCards.open(L.s.card);
  var pop = $('#population').text().replace(/,/g, '');
  if (/^\d+$/.test(pop)) $('#population').text(commas(+pop));
};

export { AfterlightUI };
