/* Aftersight decision cards for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * One modal for every decision the mayor makes: developer offers (accept, counter with 1-2 asks, reject),
 * breakthroughs (invest or pass) and town hall asks. The layer builds the card as plain data (mayor.js);
 * this draws it, shows how each faction would react, and hands the choice back.
 */

import $ from "jquery";

var esc = function(t) { return $('<div>').text(t == null ? '' : '' + t).html(); };
var signed = function(n) { return (n > 0 ? '+' : n < 0 ? '\u2212' : '\u00b1') + Math.abs(n); };

function chips(preview) {
  if (!preview) return '';
  return '<div class="cardChips">' + preview.filter(function(p) { return p.d; }).map(function(p) {
    return '<span class="chip ' + (p.d > 0 ? 'up' : 'down') + '">' + esc(p.name) + ' ' + signed(p.d) + '</span>';
  }).join('') + '</div>';
}

function CardWindow(game) {
  this.game = game;
  this.layer = game.simulation.afterlight;
  this.card = null;
  $('#canvasContainer').append('<div id="alCard" class="hidden modal alCard" role="dialog" aria-modal="true"></div>');
  var self = this;
  $('#alCard').on('click', '.cardOption', function(e) {
    e.preventDefault();
    var id = $(this).attr('data-option');
    if (!id || $(this).hasClass('disabled')) return;
    if (id === 'counter') { self.showAsks(); return; }
    self.choose(id, []);
  });
  $('#alCard').on('change', '.askBox', function() {
    var n = $('#alCard .askBox:checked').length, max = self.card.maxAsks || 2;
    $('#alCard .askBox:not(:checked)').prop('disabled', n >= max);
    $('#alSendCounter').prop('disabled', n === 0).text(n ? 'Send counter (' + n + ')' : 'Pick 1 or 2 asks');
  });
  $('#alCard').on('click', '#alSendCounter', function(e) {
    e.preventDefault();
    var asks = $('#alCard .askBox:checked').map(function() { return $(this).val(); }).get();
    if (asks.length) self.choose('counter', asks);
  });
  $('#alCard').on('click', '#alCounterBack', function(e) { e.preventDefault(); self.render(); });
  // offers lead with the terms that matter most; the rest open on request
  $('#alCard').on('click', '#alAllTerms', function(e) {
    e.preventDefault();
    self.allTerms = !self.allTerms;
    $('#alCard .cardTerms').toggleClass('showAll', self.allTerms);
    $(this).text(self.allTerms ? 'Fewer terms' : 'All ' + $('#alCard .cardTerms tr').length + ' terms');
  });
}

CardWindow.prototype.open = function(card) {
  var game = this.game;
  this.card = card;
  game.dialogOpen = true;
  game._openWindow = 'alCard';
  this.render();
  $('#opaque').removeClass('hidden');
  $('#alCard').removeClass('hidden').scrollTop(0);
};

CardWindow.prototype.render = function() {
  var c = this.card;
  // rows flagged as key (a fourth element) lead; when a card has some, the others fold under "All terms"
  var keyed = (c.rows || []).some(function(r) { return r[3]; });
  var rows = (c.rows || []).map(function(r) {
    return '<tr class="t-' + (r[2] || 'neutral') + (keyed && !r[3] ? ' minor' : '') + '"><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
  }).join('');
  var more = keyed ? '<button id="alAllTerms" class="cardMore">' + (this.allTerms ? 'Fewer terms' : 'All ' + c.rows.length + ' terms') + '</button>' : '';
  var opts = c.options.map(function(o) {
    return '<div class="cardOptWrap"><button class="cardOption tone-' + (o.tone || 'neutral') + (o.disabled ? ' disabled' : '') + '" data-option="' + o.id + '"' +
           (o.disabled ? ' aria-disabled="true"' : '') + '>' + esc(o.label) + '</button>' + chips(o.preview) +
           (o.note ? '<div class="cardNote">' + esc(o.note) + '</div>' : '') + '</div>';
  }).join('');
  $('#alCard').attr('data-type', c.type).html(
    '<div class="cardKicker">' + esc(c.kicker) + (c.leverage !== undefined ? '<span class="cardLev">Leverage ' + c.leverage + '%</span>' : '') + '</div>' +
    '<h2 class="cardTitle">' + esc(c.title) + '</h2>' +
    (c.body ? '<p class="cardBody">' + esc(c.body) + '</p>' : '') +
    (rows ? '<table class="cardTerms' + (this.allTerms ? ' showAll' : '') + '">' + rows + '</table>' + more : '') +
    '<div class="cardOptions">' + opts + '</div>');
};

CardWindow.prototype.showAsks = function() {
  var c = this.card;
  var row = function(a) {
    return '<label class="askRow' + (a.design ? ' askDesign' : '') + '"><input type="checkbox" class="askBox" value="' + a.id + '"><span>' + esc(a.label) + '</span></label>';
  };
  var asks = c.asks || [];
  var list = asks.filter(function(a) { return !a.design; }).map(row).join('');
  var design = asks.filter(function(a) { return a.design; }).map(row).join('');
  $('#alCard .cardOptions').html(
    '<div class="cardAsks"><div class="cardAsksTitle">What do you ask for? (1 or 2)</div>' + list +
    (design ? '<div class="cardAsksDesign"><div class="cardAsksSub">Facility design: how it\'s cooled and powered</div>' + design + '</div>' : '') +
    '<div class="cardAskButtons"><button id="alCounterBack" class="cardOption">Back</button>' +
    '<button id="alSendCounter" class="cardOption tone-good" disabled>Pick 1 or 2 asks</button></div></div>');
};

CardWindow.prototype.choose = function(option, asks) {
  var game = this.game;
  this.close();
  this.layer.decide(option, asks);
  game.alPanel.refresh(true);
  if (game.alUI) game.alUI.frame(true);
};

CardWindow.prototype.close = function() {
  $('#alCard').addClass('hidden');
  $('#opaque').addClass('hidden');
  this.game.dialogOpen = false;
  this.game._openWindow = null;
  this.card = null;
};

export { CardWindow };
