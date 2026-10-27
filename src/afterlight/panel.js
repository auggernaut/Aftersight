/* Afterlight layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * The indicators/policy panel, the Valley Ledger newspaper window, and map overlays (protest camps).
 * The iso build restyles these (css/afterlight-iso.css) and draws protests itself (iso/isoCanvas.js).
 */

import $ from "jquery";

import { FACTIONS, ELECTIONS, WIN_TERMS, WIN_SHARE, RESEARCH, UTIL_TEXT, PROJECTS, PROJECT_ORDER } from './mayor.js';
import { LABELS } from './festus.js';

var bar = function(id, label, colour) {
  return '<div class="alRow"><span class="alLabel">' + label + '</span>' +
         '<span class="alBar"><span id="' + id + 'Bar" class="alFill" style="background:' + colour + '"></span></span>' +
         '<span id="' + id + 'Val" class="alVal"></span></div>';
};

var policy = function(id, label, title) {
  return '<label class="alPolicy" data-tip="' + title + '"><input type="checkbox" class="alSwitch" id="alPol_' + id + '" data-policy="' + id + '">' +
         '<span>' + label + '</span></label>';
};

function AfterlightPanel(game) {
  this.game = game;
  this.layer = game.simulation.afterlight;
  this._last = 0;

  var html =
    '<div id="alPanel">' +
      '<div class="alTitle"><span class="alTitleText">City pulse</span> <span id="alEra"></span><span id="alMini"></span>' +
        '<button id="alCollapse" class="alCollapse" data-tip="Hide or show the panel">&#x2013;</button></div>' +
      '<div class="alBody">' +
      '<div class="alSection alMayor"><div class="alSectionTitle">Mayor</div>' +
        '<div class="alApprovalRow"><span class="alApprovalBig" id="alApprovalBig"></span><span class="alApprovalSub" id="alElection"></span></div>' +
        FACTIONS.map(function(f) { return bar('alF_' + f.id, f.short, '#d9b44a'); }).join('') +
        '<div class="alGoal" id="alGoal"></div>' +
        '<div class="alDeal" id="alDeal"></div>' +
        '<div class="alDeal" id="alResearch"></div>' +
      '</div>' +
      // Festus only: the town fund and its dividend, and the purpose projects
      '<div class="alSection alFund" id="alFundBox"><div class="alSectionTitle">Festus Fund</div>' +
        '<div class="alFundGrid"><div><span>In the fund</span><b id="alFundBal"></b></div>' +
        '<div><span>Last dividend</span><b id="alFundDiv"></b></div>' +
        '<div><span>Next January</span><b id="alFundNext"></b></div>' +
        '<div><span>Net worth from it</span><b id="alNetWorth"></b></div></div>' +
        '<label class="alSlider" data-tip="How much of the fund goes out as a dividend each January. The rest stays in and compounds.">' +
          '<span>Reinvest</span><input type="range" id="alFundPayout" min="0" max="100" step="10" aria-label="Fund payout"><span>Pay out</span></label>' +
        '<div class="alFundNote" id="alFundNote"></div>' +
      '</div>' +
      '<div class="alSection alProjects" id="alProjBox"><div class="alSectionTitle">Town projects <span class="alAbund" id="alAbund"></span></div>' +
        PROJECT_ORDER.map(function(id) { return '<button class="alProj" data-proj="' + id + '"><span class="alProjName">' + PROJECTS[id].name +
          '</span><span class="alProjInfo" id="alProj_' + id + '"></span></button>'; }).join('') +
      '</div>' +
      '<div class="alSection alDemand"><div class="alSectionTitle">Demand</div><div id="alRCI"></div></div>' +
      '<div class="alSection alMood"><div class="alSectionTitle">Mood</div>' +
        bar('alUnemp', 'Unemployment', '#e0574f') +
        bar('alPurpose', 'Purpose', '#5b8def') +
        bar('alBacklash', 'Backlash', '#f0962e') +
        bar('alHope', 'Hope', '#35c45a') +
      '</div>' +
      '<div class="alSection alStats">' +
        '<div><span>Power</span><b id="alPower"></b></div>' +
        '<div><span>Compute</span><b id="alCompute"></b></div>' +
        '<div><span>Robots</span><b id="alRobots"></b></div>' +
        '<div><span>Automation</span><b id="alAuto"></b></div>' +
        '<div><span id="alHelixLabel">Helix owns</span><b id="alHelix"></b></div>' +
        '<div><span>Dividend</span><b id="alDividend"></b></div>' +
      '</div>' +
      '<div class="alSection alPolicies"><div class="alSectionTitle">Policies</div>' +
        policy('helixExpansion', 'Let Helix build', 'Helix may build data centers and robot depots on its own wherever there is power.') +
        policy('dividend', 'Citizen dividend', '20% of Helix automation income and half of co-op profits go to residents.') +
        policy('communityFirst', 'Community-first zoning', 'Every Helix site gives the town a 25% stake; Helix builds half as often.') +
        policy('purposeProgram', 'Purpose programs', 'City-funded guilds, apprenticeships and civic projects. Costs money each month.') +
      '</div>' +
      '<div class="alSection alNewsBox"><div class="alSectionTitle" id="alNewsTitle">Valley news</div><ul id="alNews"></ul></div>' +
      '</div>' +
    '</div>' +
    '<div class="hidden modal shadow" id="alPaper">' +
      '<div class="paperMast"><div class="paperEdition"><span>Vol. XXVI</span><span id="alPaperDate"></span><span>One dollar</span></div>' +
        '<div class="alPaperHead" id="alPaperHead">The Valley Ledger</div>' +
        '<div class="paperRule"></div></div>' +
      '<div class="paperBody open">' +
        '<div class="paperKicker" id="alPaperKicker">Breaking</div>' +
        '<h2 id="alPaperHeadline"></h2>' +
        '<div class="paperPhoto"><canvas id="alPaperPhoto" width="1120" height="440"></canvas><div class="paperCaption" id="alPaperCaption"></div></div>' +
        '<div class="paperCols"><p id="alPaperBody"></p>' +
          '<div class="paperFacts"><div class="paperHelps"><b>Helps</b><span id="alPaperHelps"></span></div>' +
          '<div class="paperStrains"><b>Strains</b><span id="alPaperStrains"></span></div></div></div>' +
        '<form id="alPaperForm" class="alignCenter"><button type="button" id="alPaperRestart" class="dialogOK hidden">Start over</button>' +
        '<input type="submit" id="alPaperOK" class="dialogOK" value="Back to the city"></form>' +
      '</div>' +
    '</div>';
  $('#canvasContainer').append(html);

  var self = this;
  $('#alPanel input[data-policy]').each(function() {
    var name = $(this).attr('data-policy');
    $(this).prop('checked', !!self.layer.s.policies[name]);
    $(this).on('change', function() { self.layer.setPolicy(name, $(this).is(':checked')); self.refresh(true); });
  });
  $('#alPaperForm').on('submit', function(e) {
    e.preventDefault();
    if (self._paperData && self._paperData.gameOver) self.layer.s.mayor.sandbox = true;   // keep watching as a citizen
    self.paperWindow.close();
  });
  $('#alPaperRestart').on('click', function(e) { e.preventDefault(); window.location.reload(); });
  var festus = this.layer.s.scenario === 'festus';
  $('#alFundBox, #alProjBox').toggle(festus);
  $('#alFundPayout').on('input change', function() { self.layer.setFundPayout($(this).val() / 100); self.refresh(true); });
  $('#alPanel').on('click', '.alProj', function(e) {
    e.preventDefault();
    if (self.layer.projectCard($(this).attr('data-proj'))) { self.refresh(true); if (game.alUI) game.alUI.frame(true); }
  });
  if (festus) {
    $('#alPaperHead').text('The River Ledger');
    $('#alNewsTitle').text('River news');
    $('#alPol_helixExpansion, #alPol_communityFirst').closest('.alPolicy').hide();
  }
  $('#alHelixLabel').text(this.layer.dev().short + ' owns');

  this.paperWindow = {
    open: function(data) {
      self._paperData = data;
      $('#alPaperRestart').toggleClass('hidden', !data.gameOver);
      $('#alPaperOK').val(data.gameOver ? 'Keep watching' : data.win ? 'Keep playing' : 'Back to the city');
      $('#alPaper').toggleClass('alWin', !!data.win).toggleClass('alGameOver', !!data.gameOver);
      $('#alPaperDate').text('· ' + self.layer.dateString());
      $('#alPaperHeadline').text(data.headline || data.text);
      $('#alPaperBody').text(data.body || '');
      $('#alPaperHelps').text(data.helps || '');
      $('#alPaperStrains').text(data.strains || '');
      $('#alPaper').toggleClass('alBad', data.tone === 'bad');
      var place = self.layer.s.scenario === 'festus' ? 'Festus' : 'the Valley';
      $('#alPaperKicker').text(data.gameOver ? 'Election night' : data.win ? 'Election night' : data.tone === 'bad' ? 'Trouble in ' + place : data.tone === 'good' ? 'Good news' : 'Breaking');
      if (self.onPaperOpen) self.onPaperOpen(data);
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
  // mayor
  var m = s.mayor, L = this.layer;
  var col = function(v) { return v >= 60 ? '#35c45a' : v >= 50 ? '#e9c84a' : v >= 40 ? '#f0962e' : '#e0574f'; };
  $('#alApprovalBig').text(Math.round(m.approval) + '%').css('color', col(m.approval));
  var next = L.nextElection(), mi = L.mi();
  $('#alElection').text(m.gameOver ? 'Voted out in ' + m.gameOver.year : m.won ? 'You won · ' + m.won.year :
                        next >= 0 ? 'Election ' + L.monthName(next) + ' · ' + (next - mi) + ' mo · need 50%' : 'Final term');
  FACTIONS.forEach(function(f) {
    var v = m.factions[f.id].v;
    setBar('alF_' + f.id, v);
    $('#alF_' + f.id + 'Bar').css('background', col(v));
  });
  $('#alGoal').text('Goal: win ' + WIN_TERMS + ' elections (' + m.electionsWon + ' so far), or win one with the town owning ' +
                    Math.round(WIN_SHARE * 100) + '%+ of local compute (now ' + Math.round(L.townShare() * 100) + '%) and paying a dividend.');
  var d = s.deal, dev = L.dev();
  var dealText = '';
  if (d) dealText = dev.short + ': ' + d.halls + ' halls' + (s.construction ? ' (building)' : '') + ' · abatement ' + d.abatePct + '% · PILOT $' + fmt(d.pilot) + '/yr' +
                    ' · equity ' + (d.equity || 0) + '%' + (d.nda ? ' · NDA' : '') + (L.festus() ? ' · ' + {evap: 'evaporative', hybrid: 'hybrid', closed: 'closed-loop'}[d.cooling || 'evap'] + ' · ' + {grid: 'grid power', gas: 'gas power', clean: 'clean power'}[d.power || 'grid'] : '') + (s.fund ? ' · fund $' + fmt(s.fund) : '');
  else if (s.dev.status === 'review') dealText = dev.short + ' is reviewing your counter.';
  else if (s.dev.status === 'away') dealText = dev.short + ' walked away. It may be back.';
  else if (s.dev.status === 'offer') dealText = dev.short + '\'s offer is on the table.';
  $('#alDeal').text(dealText).toggle(!!dealText);
  var ra = s.research.active;
  var rText = ra ? 'Researching ' + RESEARCH[ra.id].name.toLowerCase() + ': ' + ra.left + ' mo left' + (ra.stalled ? ' (stalled)' : '') : '';
  rText += (rText ? ' · ' : '') + 'Town compute ' + L.townCompute() + '/mo';
  $('#alResearch').text(rText);
  if (L.festus()) {
    var money = function(n) { return '$' + Math.round(n).toLocaleString('en-US'); };
    $('#alFundBal').text(money(s.fund || 0));
    $('#alFundDiv').text(s.dividendPerRes ? money(s.dividendPerRes) + '/person' : 'none yet');
    $('#alFundNext').text(money(L.dividendEstimate()) + '/person');
    $('#alNetWorth').text('+' + money(s.netWorth || 0));
    if (!$('#alFundPayout').is(':focus')) $('#alFundPayout').val(Math.round((s.fundPayout === undefined ? 0.5 : s.fundPayout) * 100));
    $('#alFundNote').text('Pays out ' + Math.round(L.fundShare() * 100) + '% of the fund each January' +
                          (s.fundIn ? '; ' + L.dev().short + ' and equity add ' + money(s.fundIn * 12) + ' a year.' : '. Keystone payments and equity dividends flow in.'));
    $('#alAbund').text('· abundance ' + Math.round(L.abundance() * 100) + '%');
    PROJECT_ORDER.forEach(function(id) {
      var st = L.projectState(id), pr = (s.projects || {})[id];
      $('#alProj_' + id).text(st === 'built' ? 'Open · built by ' + (pr.who === 'neighbors' ? 'neighbors + robots' : 'robots') :
                              st === 'building' ? 'Building · ' + Math.max(0, pr.done - s.months) + ' mo left' :
                              'from ' + money(L.projectCost(id, 'robots')));
      $('.alProj[data-proj="' + id + '"]').toggleClass('done', st !== 'open').prop('disabled', st !== 'open');
    });
  }
  $('#alCompute').text(fmt(s.compute));
  $('#alRobots').text(fmt(s.robots));
  $('#alAuto').text(pct(s.automation));
  $('#alHelix').text(s.compute + s.robots > 0 ? pct(s.helixShare) : '-');
  $('#alDividend').text(s.policies.dividend ? '$' + fmt(s.dividendPool) + '/mo' : 'off');
  var known = Object.keys(s.discovered).length;
  $('#alMini').text('Approval ' + Math.round(m.approval) + '% · Jobless ' + pct(s.unemployment));
  $('#alEra').text(['· The Before', '· Cheap Power', '· Thinking Machines', '· Self-Building', '· The Cure', '· Abundance'][Math.min(5, known)]);
  var items = s.log.slice(0, 5).map(function(e) {
    return '<li class="al_' + e.tone + '"><span class="alDate">' + e.date + '</span> ' + $('<div>').text(e.text).html() + '</li>';
  });
  $('#alNews').html(items.join(''));
  for (var name in s.policies) $('#alPol_' + name).prop('checked', !!s.policies[name]);
  $('#clinicButton').toggleClass('alLocked', !this.layer.isUnlocked('clinic'));
  $('#fusionButton').toggleClass('alLocked', !this.layer.isUnlocked('fusion'));
  $('#solarButton').attr('data-tip', this.layer.toolCostMultiplier('solar') < 1 ? 'Solar farm · $750 (cheap solar)' : 'Solar farm · $1,500');
};

// Protest camps drawn over the map: a pulsing ring of red placards around the blockaded data center
AfterlightPanel.prototype.overlays = function() {
  var s = this.layer.s;
  var list = [];
  if (s.protest) list.push({x: s.protest.x - 2, y: s.protest.y - 2, w: 5, h: 5, kind: 'protest'});
  if (s.scenario === 'festus') {
    var L = this.layer, shown = L.siteShown(), pl = L.sitePlan();
    var site = shown && (!s.hallsBuilt || s.construction);   // gone while the developer is away, and once it's built
    LABELS.forEach(function(l) {
      if (l.kind === 'site' && !site) return;
      list.push({kind: l.kind === 'site' ? 'sitelabel' : 'label', x: l.x, y: l.y,
                 text: l.kind !== 'site' ? l.text : s.construction ? 'Under construction' : l.text + ' \u00b7 ' + pl.acres + ' acres'});
    });
    if (site) pl.rects.forEach(function(r) { list.push({kind: s.construction ? 'build' : 'site', x: r.x, y: r.y, w: r.w, h: r.h}); });
  }
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
