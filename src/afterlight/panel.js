/* Afterlight layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * The indicators/policy panel, the Valley Ledger newspaper window, and map overlays (protest camps).
 */

import $ from "jquery";

var bar = function(id, label, colour) {
  return '<div class="alRow"><span class="alLabel">' + label + '</span>' +
         '<span class="alBar"><span id="' + id + 'Bar" class="alFill" style="background:' + colour + '"></span></span>' +
         '<span id="' + id + 'Val" class="alVal"></span></div>';
};

var policy = function(id, label, title) {
  return '<label class="alPolicy" title="' + title + '"><input type="checkbox" id="alPol_' + id + '" data-policy="' + id + '"> ' +
         label + '</label>';
};

function AfterlightPanel(game) {
  this.game = game;
  this.layer = game.simulation.afterlight;
  this._last = 0;

  var html =
    '<div id="alPanel" class="controlShadow mintcream z1 rightedge open">' +
      '<div class="alTitle">Afterlight <span id="alEra"></span></div>' +
      '<div class="alSection">' +
        bar('alUnemp', 'Unemployment', '#d9534f') +
        bar('alPurpose', 'Purpose', '#5b8def') +
        bar('alBacklash', 'Backlash', '#e08a1e') +
        bar('alHope', 'Hope', '#2fbf4a') +
      '</div>' +
      '<div class="alSection alStats">' +
        '<div>Power <b id="alPower"></b></div>' +
        '<div>Compute <b id="alCompute"></b></div>' +
        '<div>Robots <b id="alRobots"></b></div>' +
        '<div>Automation <b id="alAuto"></b></div>' +
        '<div>Helix owns <b id="alHelix"></b></div>' +
        '<div>Dividend <b id="alDividend"></b></div>' +
      '</div>' +
      '<div class="alSection">' +
        policy('helixExpansion', 'Let Helix build', 'Helix may build data centers and robot depots on its own wherever there is power.') +
        policy('dividend', 'Citizen dividend', '20% of Helix automation income and half of co-op profits go to residents.') +
        policy('communityFirst', 'Community-first zoning', 'Every Helix site gives the town a 25% stake; Helix builds half as often.') +
        policy('purposeProgram', 'Purpose programs', 'City-funded guilds, apprenticeships and civic projects. Costs money each month.') +
      '</div>' +
      '<div class="alSection"><div class="alNewsTitle">Valley news</div><ul id="alNews"></ul></div>' +
    '</div>' +
    '<div class="hidden modal shadow" id="alPaper">' +
      '<header class="padding10 chunk alignCenter alPaperHead">THE VALLEY LEDGER <span id="alPaperDate"></span></header>' +
      '<div class="padding10 open">' +
        '<h2 id="alPaperHeadline" class="alignCenter"></h2>' +
        '<p id="alPaperBody"></p>' +
        '<p><b>Helps:</b> <span id="alPaperHelps"></span></p>' +
        '<p><b>Strains:</b> <span id="alPaperStrains"></span></p>' +
        '<form id="alPaperForm" class="alignCenter margin10"><input type="submit" id="alPaperOK" class="dialogOK" value="OK"></form>' +
      '</div>' +
    '</div>';
  $('#canvasContainer').append(html);

  var self = this;
  $('#alPanel input[data-policy]').each(function() {
    var name = $(this).attr('data-policy');
    $(this).prop('checked', !!self.layer.s.policies[name]);
    $(this).on('change', function() { self.layer.setPolicy(name, $(this).is(':checked')); self.refresh(true); });
  });
  $('#alPaperForm').on('submit', function(e) { e.preventDefault(); self.paperWindow.close(); });

  this.paperWindow = {
    open: function(data) {
      $('#alPaperDate').text('· ' + self.layer.dateString());
      $('#alPaperHeadline').text(data.headline || data.text);
      $('#alPaperBody').text(data.body || '');
      $('#alPaperHelps').text(data.helps || '');
      $('#alPaperStrains').text(data.strains || '');
      $('#alPaper').toggleClass('alBad', data.tone === 'bad');
      $('#opaque').removeClass('hidden');
      $('#alPaper').removeClass('hidden');
    },
    close: function() {
      $('#alPaper').addClass('hidden');
      $('#opaque').addClass('hidden');
      game.dialogOpen = false;
      game._openWindow = null;
    }
  };
  this.refresh(true);
}

var pct = function(v) { return Math.round(v * 100) + '%'; };
var fmt = function(n) { n = Math.round(n); return n >= 10000 ? Math.round(n / 1000) + 'k' : '' + n; };

AfterlightPanel.prototype.refresh = function(force) {
  var now = Date.now();
  if (!force && now - this._last < 400) return;
  this._last = now;
  var s = this.layer.s;
  var setBar = function(id, v) {
    $('#' + id + 'Bar').css('width', Math.round(Math.max(0, Math.min(100, v))) + '%');
    $('#' + id + 'Val').text(Math.round(v));
  };
  setBar('alUnemp', s.unemployment * 100);
  $('#alUnempVal').text(pct(s.unemployment));
  setBar('alPurpose', s.purpose);
  setBar('alBacklash', s.backlash);
  setBar('alHope', s.hope);
  var pm = this.game.simulation._powerManager;
  // Demand includes what data centers, depots and clinics pull; supply is everything the plants generate
  if (pm.lastMaxPower !== undefined) {
    var draw = pm.extraDraw || 0;
    var supply = pm.lastMaxPower + draw, demand = pm.lastConsumption + draw;
    $('#alPower').text((pm.lastShort ? 'SHORT ' : '') + fmt(demand) + ' / ' + fmt(supply)).css('color', pm.lastShort ? '#b0201a' : '');
  }
  $('#alCompute').text(fmt(s.compute));
  $('#alRobots').text(fmt(s.robots));
  $('#alAuto').text(pct(s.automation));
  $('#alHelix').text(s.compute + s.robots > 0 ? pct(s.helixShare) : '-');
  $('#alDividend').text(s.policies.dividend ? '$' + fmt(s.dividendPool) + '/mo' : 'off');
  var known = Object.keys(s.discovered).length;
  $('#alEra').text(['· The Before', '· Cheap Power', '· Thinking Machines', '· Self-Building', '· The Cure', '· Abundance'][Math.min(5, known)]);
  var items = s.log.slice(0, 5).map(function(e) {
    return '<li class="al_' + e.tone + '"><span class="alDate">' + e.date + '</span> ' + $('<div>').text(e.text).html() + '</li>';
  });
  $('#alNews').html(items.join(''));
  for (var name in s.policies) $('#alPol_' + name).prop('checked', !!s.policies[name]);
  $('#clinicButton').toggleClass('alLocked', !this.layer.isUnlocked('clinic'));
  $('#fusionButton').toggleClass('alLocked', !this.layer.isUnlocked('fusion'));
  $('#solarButton').text(this.layer.toolCostMultiplier('solar') < 1 ? 'Solar Farm $750' : 'Solar Farm $1500');
};

// Protest camps drawn over the map: a pulsing ring of red placards around the blockaded data center
AfterlightPanel.prototype.overlays = function() {
  var s = this.layer.s;
  var list = [];
  if (s.protest) list.push({x: s.protest.x - 2, y: s.protest.y - 2, w: 5, h: 5, kind: 'protest'});
  return list;
};

AfterlightPanel.drawOverlay = function(ctx, item, px, py, tw, t) {
  if (item.kind !== 'protest') return;
  var cx = px + item.w * tw / 2, cy = py + item.h * tw / 2;
  var r = tw * 2.4 + Math.sin(t / 250) * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(255,40,30,0.18)';
  ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(230,30,30,0.9)';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  for (var i = 0; i < 16; i++) {
    var a = i / 16 * Math.PI * 2 + t / 4000;
    var x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    ctx.fillStyle = '#222'; ctx.fillRect(x - 1, y - 1, 3, 4);           // protester
    ctx.fillStyle = (i + Math.floor(t / 400)) % 2 ? '#ff3b30' : '#ffffff'; // placard
    ctx.fillRect(x - 3, y - 7, 7, 5);
  }
  ctx.fillStyle = '#ff3b30';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillRect(cx - 34, cy - r - 26, 68, 17);
  ctx.fillStyle = '#fff';
  ctx.fillText('PROTEST', cx - 29, cy - r - 13);
  ctx.restore();
};

export { AfterlightPanel };
