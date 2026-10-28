/* Afterlight layer for micropolisJS. Modified version of micropolisJS; GPL-3.0 (see LICENSE, COPYING).
 * The indicators/policy panel, the Valley Ledger newspaper window, and map overlays (protest camps).
 * The iso build restyles these (css/afterlight-iso.css) and draws protests itself (iso/isoCanvas.js).
 */

import $ from "jquery";

import { FACTIONS, ELECTIONS, WIN_TERMS, WIN_SHARE, RESEARCH, UTIL_TEXT, PROJECTS, PROJECT_ORDER, PATHS } from './mayor.js';
import { LABELS } from './festus.js';
import { money, usd, moneyText, buildScale, buildText, zoneScale } from './money.js';

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
        '<button class="alPath" id="alPath" data-tip="Which way the town is heading. It comes from household income, Purpose, and the strain on water, bills and air."></button>' +
        '<button class="alPath alHomes" id="alHomes" data-tip="Homes and rents. Every block holds eight houses; when every home is taken and people still want to move in, rents climb until the town zones more."></button>' +
        '<button class="alTownHall hidden" id="alTownHall"></button>' +
        FACTIONS.map(function(f) { return bar('alF_' + f.id, f.short, '#d9b44a'); }).join('') +
        '<div class="alGoal" id="alGoal"></div>' +
        '<div class="alDeal" id="alDeal"></div>' +
        '<div class="alDeal" id="alResearch"></div>' +
      '</div>' +
      // Festus only: the three numbers the game is about: approval (above), household income, and Purpose
      '<div class="alSection alIncome" id="alIncomeBox"><div class="alSectionTitle">Household income <span id="alIncomeOwn"></span></div>' +
        '<div class="alIncBar" data-tip="Where a resident\'s income comes from each year: wages, ownership (the Festus Fund\'s dividend) and transfers (unemployment pay, food aid). As machines take more of the work, the wage part shrinks; what the town owns decides whether ownership fills the gap.">' +
          '<i class="incW" id="alIncW"></i><i class="incO" id="alIncO"></i><i class="incT" id="alIncT"></i></div>' +
        '<div class="alIncLegend"><span><b class="kW"></b>Wages <em id="alIncWv"></em></span><span><b class="kO"></b>Ownership <em id="alIncOv"></em></span>' +
          '<span><b class="kT"></b>Transfers <em id="alIncTv"></em></span></div>' +
        '<div class="alRow alPurposeRow"><span class="alLabel">Purpose</span><span class="alBar"><span id="alPurpose2Bar" class="alFill" style="background:#5b8def"></span></span>' +
          '<span id="alPurpose2Val" class="alVal"></span></div>' +
        '<div class="alIncNote" id="alIncNote"></div>' +
      '</div>' +
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
      '<div class="alSection alNewsBox"><div class="alSectionTitle" id="alNewsTitle">Valley news</div><ul id="alNews"></ul></div>' +
      '<button class="alMoreToggle" id="alMoreToggle" aria-expanded="false">More: mood, power, policies</button>' +
      '<div class="alMore" id="alMore">' +
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
      '</div>' +
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
  $('#alFundBox, #alProjBox, #alIncomeBox, #alPath, #alHomes, #alMoreToggle').toggle(festus);
  $('#alMore').toggleClass('open', !festus);
  $('#alMoreToggle').on('click', function(e) {
    e.preventDefault();
    var open = !$('#alMore').hasClass('open');
    $('#alMore').toggleClass('open', open); $(this).attr('aria-expanded', open ? 'true' : 'false');
  });
  // a town hall ask waiting in the ticker: open it from here too
  $('#alTownHall').on('click', function(e) {
    e.preventDefault();
    var q = self.layer.s.quickAsk;
    if (q && game.alAlert) game.alAlert.open({tone: 'neutral', text: 'Town hall: ' + q.card.title, ctx: {topic: 'townhall', quick: true, date: q.card.date}});
  });
  $('#alPath').on('click', function(e) {
    e.preventDefault();
    if (game.alAlert) game.alAlert.open({tone: PATHS[self.layer.s.path || 'early'].tone, text: 'Path: ' + PATHS[self.layer.s.path || 'early'].name,
      ctx: {topic: 'path', why: self.layer.pathLine(true), lever: self.layer.newsContext('neutral', 'Path:', {alert: 'path'}).lever,
            stats: self.layer.newsContext('neutral', 'Path:', {alert: 'path'}).stats, date: self.layer.dateString()}});
  });
  $('#alHomes').on('click', function(e) {
    e.preventDefault();
    var ctx = self.layer.newsContext('neutral', 'Homes:', {alert: 'homes'});
    if (game.alAlert) game.alAlert.open({tone: (self.layer.s.rent || 1) >= 1.08 ? 'bad' : 'neutral', text: 'Homes: ' + self.layer.homesLine(),
      ctx: {topic: 'homes', why: ctx.why, lever: ctx.lever, stats: ctx.stats, date: self.layer.dateString()}});
  });
  $('#alFundPayout').on('input change', function() { self.layer.setFundPayout($(this).val() / 100); self.refresh(true); });
  $('#alPanel').on('click', '.alProj', function(e) {
    e.preventDefault();
    if (self.layer.projectCard($(this).attr('data-proj'))) { self.refresh(true); if (game.alUI) game.alUI.frame(true); }
  });
  if (festus) {
    $('#alPaperHead').text('The River Ledger');
    $('#alNewsTitle').text('River news');
    // Festus runs on the deal, the Festus Fund and the guild: the starter town's Helix and dividend switches stay out of it
    $('#alPol_helixExpansion, #alPol_communityFirst, #alPol_dividend').closest('.alPolicy').hide();
    $('#alPol_purposeProgram').next('span').text('Apprenticeship guild');
    $('#alPol_purposeProgram').closest('.alPolicy').attr('data-tip', 'Paid apprenticeships, repair crews and civic work for people whose jobs went to machines. Raises Purpose and takes some of the sting out of a lost job. Costs money each month.');
    $('#alBacklashBar, #alHopeBar').closest('.alRow').hide();
    $('#alDividend').parent().hide();
  }
  $('#alHelixLabel').text(this.layer.dev().short + ' owns');
  // a news line opens the same detail window as the ticker
  $('#alPanel').on('click', '#alNews li', function() {
    var e = self.layer.s.log[+$(this).attr('data-log')];
    if (e && game.alAlert) game.alAlert.open({tone: e.tone, text: e.text, x: e.x, y: e.y, ctx: e.ctx, date: e.date});
  });

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
                    Math.round(WIN_SHARE * 100) + '%+ of local compute (now ' + Math.round(L.townShare() * 100) + '%) and paying a dividend' +
                    (L.festus() ? ' of $1,000+ a resident (last: ' + usd(s.dividendPerRes || 0) + ').' : '.'));
  if (L.festus()) {
    var path = PATHS[s.path || 'early'];
    $('#alPath').html('<span class="alPathK">Path</span> ' + $('<div>').text(path.name).html()).attr('data-tone', path.tone);
    var rent = s.rent || 1;
    $('#alHomes').toggle(!!s.homes).html('<span class="alPathK">Homes</span> ' + $('<div>').text(L.homesLine(true)).html())
      .attr('data-tone', rent >= 1.08 ? 'bad' : rent <= 0.99 ? 'good' : 'neutral');
    var q = s.quickAsk;
    $('#alTownHall').toggleClass('hidden', !q).html(q ? '<span class="alPathK">Town hall</span> ' + $('<div>').text(q.card.title).html() + ' <b>Decide \u203a</b>' : '');
  }
  var d = s.deal, dev = L.dev();
  var dealText = '';
  if (d) dealText = dev.short + ': ' + d.halls + ' halls' + (s.construction ? ' (building)' : '') + ' · abatement ' + d.abatePct + '% · PILOT ' + money(d.pilot) + '/yr' +
                    ' · equity ' + (d.equity || 0) + '%' + (d.coop ? ' · co-op hall' : '') + (d.nda ? ' · NDA' : '') + (L.festus() ? ' · ' + {evap: 'evaporative', hybrid: 'hybrid', closed: 'closed-loop'}[d.cooling || 'evap'] + ' · ' + {grid: 'grid power', gas: 'gas power', clean: 'clean power'}[d.power || 'grid'] : '');
  else if (s.dev.status === 'review') dealText = dev.short + ' is reviewing your counter.';
  else if (s.dev.status === 'away') dealText = dev.short + ' walked away. It may be back.';
  else if (s.dev.status === 'gone') dealText = dev.short + ' built across the river. It won\'t be back.';
  if (L.festus() && L.bondedBuilt() + L.bondPermits() > 0)
    dealText += (dealText ? ' · ' : '') + 'Town-owned halls: ' + L.bondedBuilt() + (L.bondPermits() ? ' (' + L.bondPermits() + ' more bonded: build from the Compute menu)' : '');
  else if (s.dev.status === 'offer') dealText = dev.short + '\'s offer is on the table.';
  $('#alDeal').text(dealText).toggle(!!dealText);
  var ra = s.research.active;
  var rText = ra ? 'Researching ' + RESEARCH[ra.id].name.toLowerCase() + ': ' + ra.left + ' mo left' + (ra.stalled ? ' (stalled)' : '') : '';
  var labs = L.labsOn(), soon = L.nextBreakthroughIn();
  rText += (rText ? ' · ' : '') + (labs ? labs + (labs > 1 ? ' labs' : ' lab') + ' running' + (!ra && L.nextResearch() ? (soon ? ', next breakthrough in about ' + soon + ' mo' : ', a breakthrough is due') : '') :
                                          (s.labsBuilt ? 'Research Lab idle (no power or money): no breakthroughs' : 'No Research Lab: no breakthroughs (build one from the Compute menu)'));
  rText += ' · Town compute ' + L.townCompute() + '/mo';
  $('#alResearch').text(rText);
  if (L.festus()) {
    // household income per resident a year: wages, ownership, transfers
    var mix = L.incomeMix(), tot = Math.max(1, mix.total);
    $('#alIncW').css('width', (mix.wages / tot * 100).toFixed(1) + '%');
    $('#alIncO').css('width', (mix.own / tot * 100).toFixed(1) + '%');
    $('#alIncT').css('width', (mix.transfers / tot * 100).toFixed(1) + '%');
    $('#alIncWv').text(usd(mix.wages)); $('#alIncOv').text(usd(mix.own)); $('#alIncTv').text(usd(mix.transfers));
    $('#alIncomeOwn').text('· ' + Math.round(mix.ownShare * 100) + '% from ownership');
    setBar('alPurpose2', s.purpose);
    $('#alIncNote').text('Machines do ' + pct(s.automation) + ' of the region\'s work; ' + pct(s.unemployment) + ' of residents are out of work. ' +
                         (mix.lost > 1 ? 'Dividends replace ' + pct(mix.cover) + ' of the lost wages.' : ''));
    $('#alFundBal').text(money(s.fund || 0));
    $('#alFundDiv').text(s.dividendPerRes ? usd(s.dividendPerRes) + ' a resident' : 'none yet');
    $('#alFundNext').text(usd(L.dividendEstimate()) + ' a resident');
    $('#alNetWorth').text('+' + usd(s.netWorth || 0));
    if (!$('#alFundPayout').is(':focus')) $('#alFundPayout').val(Math.round((s.fundPayout === undefined ? 0.5 : s.fundPayout) * 100));
    $('#alFundNote').text('Pays out ' + Math.round(L.fundShare() * 100) + '% of the fund each January. ' + L.fundSources());
    $('#alAbund').text('· abundance ' + Math.round(L.abundance() * 100) + '%');
    // built and building projects, then the next few the town could start (the catalog unlocks as abundance grows)
    var shown = 0;
    PROJECT_ORDER.forEach(function(id) {
      var st = L.projectState(id), pr = (s.projects || {})[id], renew = L.canRenew(id), open = st === 'open' && L.projectAvailable(id);
      var show = st !== 'open' || (open && shown < 3);
      if (open && show) shown++;
      $('#alProj_' + id).text(st === 'built' ? (pr.renewing ? 'New season in ' + Math.max(0, pr.renewing.done - s.months) + ' mo' :
                                                renew ? 'Fading · another season from ' + money(L.renewCost(id, 'robots')) :
                                                'Open · ' + (pr.who === 'neighbors' ? 'neighbors + robots' : 'robots')) :
                              st === 'building' ? 'Building · ' + Math.max(0, pr.done - s.months) + ' mo left' :
                              'from ' + money(L.projectCost(id, 'robots')));
      $('.alProj[data-proj="' + id + '"]').toggle(show).toggleClass('done', st !== 'open' && !renew).prop('disabled', !(open || renew));
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
  var items = s.log.slice(0, 5).map(function(e, i) {
    return '<li class="al_' + e.tone + '" data-log="' + i + '" role="button" tabindex="0"><span class="alDate">' + e.date + '</span> ' + $('<div>').text(e.text).html() + '</li>';
  });
  // only rebuild the news list when it changes, so a line stays put long enough to click
  var newsHtml = items.join('');
  if (newsHtml !== this._newsHtml) { this._newsHtml = newsHtml; $('#alNews').html(newsHtml); }
  for (var name in s.policies) $('#alPol_' + name).prop('checked', !!s.policies[name]);
  $('#alComputeChip').text(L.townCompute() + '/mo · ' + Math.round(L.townShare() * 100) + '% own');
  $('#labButton').toggleClass('alLabIdle', !labs).attr('data-tip', 'Research Lab · ' + money(1500 * buildScale()) + '. ' + (labs ? labs + ' running' + (s.labBill ? ', ' + money(s.labBill) + '/mo for upkeep and compute' : '') + '. ' :
    'None running: breakthroughs only turn up while a lab runs. ') + 'Each uses 10 town compute a month plus ' + money(10) + ' upkeep; more labs and more town compute bring breakthroughs sooner.');
  $('#clinicButton').toggleClass('alLocked', !this.layer.isUnlocked('clinic'));
  $('#fusionButton').toggleClass('alLocked', !this.layer.isUnlocked('fusion'));
  if (L.festus()) $('#dcCoopButton').toggleClass('alLocked', !L.isUnlocked('dcCoop')).attr('data-tip', 'Town-owned data center · ' + money(4000) + ' down. ' +
    (L.bondPermits() ? L.bondPermits() + ' bonded and ready to build: its revenue pays the bond first, the rest goes to the Festus Fund.' :
                       'Needs a co-op bond first: back one when the trades bring it to City Hall.'));
  var bs = buildScale(), crews = bs < 1 ? ' (robot crews: ' + Math.round((1 - bs) * 100) + '% off)' : '';
  $('#solarButton').attr('data-tip', (this.layer.toolCostMultiplier('solar') < 1 ? 'Solar farm · ' + money(750 * bs) + ' (cheap solar)' : 'Solar farm · ' + money(1500 * bs)) + crews);
  // build prices follow the robot crews (tool tips written in the engine's dollars are kept in data-tip0)
  if (bs !== this._buildScale) {
    this._buildScale = bs;
    $('#controls .toolButton[data-tip0]').not('#solarButton, #labButton').each(function() {
      $(this).attr('data-tip', buildText($(this).attr('data-tip0'), /^(residential|commercial|industrial)$/.test($(this).attr('data-tool')) ? zoneScale() : 1)); });
  }
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
