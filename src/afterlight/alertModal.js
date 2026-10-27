/* Aftersight alert detail window for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * The ticker under the top bar (and each line of River news) opens this: the full text, why it happened, which
 * factions it moved, the numbers behind it, and a way to see it on the map or in City pulse. The sim waits while
 * it's open. Close with the X, Esc, or a click or tap outside.
 */

import $ from "jquery";

var esc = function(t) { return $('<div>').text(t == null ? '' : '' + t).html(); };
var TOPIC_NAMES = {water: 'Water', bills: 'Power bills', health: 'Health', jobs: 'Jobs', wealth: 'Household wealth', fund: 'Festus Fund',
                   mood: 'Mood', project: 'Town projects', election: 'Elections', deal: 'The data center', research: 'Breakthroughs',
                   purpose: 'Purpose', path: 'Which way the town is heading', townhall: 'Town hall'};
var signed = function(n) { return (n > 0 ? '+' : n < 0 ? '\u2212' : '\u00b1') + Math.abs(n); };

function AlertWindow(game) {
  this.game = game;
  this.data = null;
  $('#canvasContainer').append('<div id="alAlertBack" class="hidden"></div>' +
    '<div id="alAlert" class="hidden" role="dialog" aria-modal="true" aria-labelledby="alAlertText">' +
    '<button id="alAlertClose" aria-label="Close">&times;</button><div id="alAlertBody"></div></div>');
  var self = this;
  $('#alAlertClose, #alAlertBack').on('click', function(e) { e.preventDefault(); self.close(); });
  $('#alAlert').on('click', '#alAlertMap', function(e) {
    e.preventDefault();
    var d = self.data; self.close();
    if (d && d.x !== undefined) game.gameCanvas.centreOn(d.x, d.y);
  });
  // a town hall ask from the ticker: decide it here
  $('#alAlert').on('click', '.alQuickOpt', function(e) {
    e.preventDefault();
    if ($(this).hasClass('disabled')) return;
    var layer = game.simulation.afterlight, opt = $(this).attr('data-option');
    self.close();
    layer.decideQuick(opt);
    if (game.alPanel) game.alPanel.refresh(true);
    if (game.alUI) game.alUI.frame(true);
  });
  $('#alAlert').on('click', '#alAlertPanel', function(e) {
    e.preventDefault(); self.close();
    var p = $('#alPanel');
    if (p.hasClass('collapsed')) $('#alCollapse').click();
  });
  $(document).on('keydown', function(e) { if (e.key === 'Escape' && self.isOpen()) { e.preventDefault(); self.close(); } });
}

AlertWindow.prototype.isOpen = function() { return !$('#alAlert').hasClass('hidden'); };

AlertWindow.prototype.open = function(d) {
  var game = this.game;
  if (!d || !d.text) return;
  if (game.dialogOpen && game._openWindow !== 'alAlert') return;   // a decision card or paper is up: it comes first
  this.data = d;
  var c = d.ctx || {};
  var tone = d.tone === 'good' ? 'good' : d.tone === 'bad' ? 'bad' : 'neutral';
  var kicker = (TOPIC_NAMES[c.topic] || (tone === 'bad' ? 'Trouble' : tone === 'good' ? 'Good news' : 'News')) + (c.date || d.date ? ' · ' + (c.date || d.date) : '');
  var html = '<div class="alAlertKicker t-' + tone + '">' + esc(kicker) + '</div>' +
    '<p id="alAlertText" class="alAlertText">' + esc(d.text) + '</p>';
  // a pending town hall ask: its body and the two answers, with how each faction would take them
  var pending = game.simulation.afterlight.s.quickAsk;
  var q = c.quick && pending && (!c.quickId || c.quickId === pending.id) ? pending : null;
  if (q) {
    var qc = q.card;
    html += '<p class="alAlertWhy">' + esc(qc.body) + '</p><div class="alQuick">' + qc.options.map(function(o) {
      return '<div class="cardOptWrap"><button class="cardOption alQuickOpt tone-' + o.tone + (o.disabled ? ' disabled' : '') + '" data-option="' + o.id + '">' + esc(o.label) + '</button>' +
        '<div class="cardChips">' + (o.preview || []).filter(function(p) { return p.d; }).map(function(p) {
          return '<span class="chip ' + (p.d > 0 ? 'up' : 'down') + '">' + esc(p.name) + ' ' + signed(p.d) + '</span>'; }).join('') + '</div></div>';
    }).join('') + '</div><p class="alQuickNote">No rush: the game keeps running. Left alone for three months, the ask lapses and comes back later.</p>';
  } else if (c.quick) html += '<p class="alAlertWhy">This town hall ask has been answered or has lapsed.</p>';
  if (c.why) html += '<h3>Why</h3><p class="alAlertWhy">' + esc(c.why) + '</p>';
  if (c.lever) html += '<h3>What you can do</h3><p class="alAlertWhy alAlertLever">' + esc(c.lever) + '</p>';
  if (c.factions) html += '<h3>Factions' + (c.decision ? ' (change from that decision)' : '') + '</h3><div class="alAlertFactions">' +
    c.factions.map(function(f) {
      return '<span class="alAF"><b>' + esc(f.name) + '</b> ' + f.v + (f.d ? ' <i class="' + (f.d > 0 ? 'up' : 'down') + '">' + (f.d > 0 ? '+' : '\u2212') + Math.abs(f.d) + '</i>' : '') + '</span>';
    }).join('') + '</div>';
  if (c.stats) html += '<h3>The numbers now</h3><table class="alAlertStats">' + c.stats.map(function(r) {
    return '<tr class="t-' + (r[2] || 'neutral') + '"><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
  }).join('') + '</table>';
  html += '<div class="alAlertActions">' + (d.x !== undefined && d.y !== undefined ? '<button id="alAlertMap" class="cardOption tone-good">Show on map</button>' : '') +
    '<button id="alAlertPanel" class="cardOption">Open City pulse</button></div>';
  $('#alAlertBody').html(html);
  $('#alAlert').attr('data-tone', tone);
  $('#alAlert').toggleClass('alQuickAsk', !!q);
  game.dialogOpen = true;           // the sim waits while you read
  game._openWindow = 'alAlert';
  $('#alAlertBack, #alAlert').removeClass('hidden');
  $('#alAlert').scrollTop(0);
};

AlertWindow.prototype.close = function() {
  $('#alAlertBack, #alAlert').addClass('hidden');
  if (this.game._openWindow === 'alAlert') { this.game.dialogOpen = false; this.game._openWindow = null; }
  this.data = null;
};

export { AlertWindow };
