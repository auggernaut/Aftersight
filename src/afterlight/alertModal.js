/* Aftersight alert detail window for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * The ticker under the top bar (and each line of River news) opens this: the full text, why it happened, which
 * factions it moved, the numbers behind it, and a way to see it on the map or in City pulse. The sim waits while
 * it's open. Close with the X, Esc, or a click or tap outside.
 */

import $ from "jquery";

var esc = function(t) { return $('<div>').text(t == null ? '' : '' + t).html(); };
var TOPIC_NAMES = {water: 'Water', bills: 'Power bills', health: 'Health', jobs: 'Jobs', wealth: 'Household wealth', fund: 'Festus Fund',
                   mood: 'Mood', project: 'Town projects', election: 'Elections', deal: 'The data center', research: 'Breakthroughs'};

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
  if (c.why) html += '<h3>Why</h3><p class="alAlertWhy">' + esc(c.why) + '</p>';
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
