// HTML panels: indicators, happenings feed, inspector, action menus, chart, banners.
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function bar(v, color, max = 1) { return `<div class="bar"><i style="width:${clamp(v / max, 0, 1) * 100}%;background:${color}"></i></div>`; }

function renderStats() {
  const M = S.market, m = metrics();
  const rows = [
    ['Energy', `${num(M.dE)} MWh/day wanted`, bar(1 - M.shortE, '#ffd23f'), `${pct(M.localGen || 0)} local solar · grid ${num(M.imp)} · short ${pct(M.shortE)} · $${Math.round(M.pe)}/MWh`],
    ['Compute', `${num(M.sC)} made · ${num(M.dCL)} local + ${num(M.dCX)} outside want`, bar(1 - M.shortC, '#5dff8f'), `local short ${pct(M.shortC)} · $${Math.round(M.pc)}/unit`],
    ['Robots', `${Math.round(M.nRobots)} (${pct(M.robotWork / Math.max(1, M.L))} of the work)`, bar(M.robotWork / Math.max(1, M.L), '#9fe7ff'), ''],
    ['Paid work', `${m.work.toFixed(1)} h/week per adult`, bar(m.work, '#e8805a', 50), ''],
    ['Outside owns', pct(m.outside), bar(m.outside, '#d062e6'), `town ${pct(m.townShare)} · gini ${m.gini.toFixed(2)}`],
    ['Dividend', `${money(M.ubi)} / person / day`, '', `basics cost ${money(S.P.essential * S.P.essentialIdx)}`],
  ];
  $('statrows').innerHTML = rows.map(([k, v, b, sub]) => `<div class="stat"><span class="k">${k}</span><span>${v}</span></div>${b ? `<div class="stat"><span></span>${b}</div>` : ''}${sub ? `<div class="stat"><span></span><span class="muted">${sub}</span></div>` : ''}`).join('');
}

let feedSig = '';
function renderFeed() {
  const sig = S.log.length + ':' + (S.log[0] && S.log[0].t);
  if (sig === feedSig) return; feedSig = sig;
  $('feedrows').innerHTML = S.log.slice(0, 14).map(l => `<div class="${l.kind}"><span class="muted">${dateLabel(l.t).text.replace('Year ', 'Y')}</span> ${esc(l.text)}</div>`).join('');
}

function renderYou() {
  const h = S.player.home;
  const stakes = holdingsOf(h.id);
  $('youline').innerHTML = `cash ${money(h.cash)} · stakes ${stakes.length ? money(sum(stakes, s => s.value)) : 'none'} · ${esc(S.player.thought || 'at home')}`;
  const c = S.coops.find(x => x.open);
  $('coopline').innerHTML = c ? `<div class="sec"><b style="color:var(--coop)">${esc(c.name)}</b> ${money(c.raised)} / ${money(c.target)} · ${Object.keys(c.pledges).length} households · closes day ${c.deadline + 1}${bar(c.raised / c.target, '#6fdc6f')}</div>` : (S.council ? `<div class="sec">Council vote day ${S.council.day + 1}, 18:00: ${esc(S.council.title)}</div>` : '');
}

// ---------- inspector ----------
function renderInspect() {
  const el = $('inspect');
  const p = view.selected, s = view.selSite, lot = view.selLot;
  if (!p && !s && lot) { renderLotInspect(el, lot); return; }
  if (!p && !s) { el.hidden = true; $('feed').hidden = false; return; }
  el.hidden = false; $('feed').hidden = true;
  let html = `<button class="close" id="ins-close">×</button>`;
  if (p) {
    const h = p.home, li = h.lastIncome || {};
    html += `<h3>${esc(p.isPlayer ? 'You' : p.name)}</h3><div class="muted">${p.age}${p.job ? ' · works at ' + esc(p.job.name) : ''} · ${esc(h.isPlayer ? 'your household' : h.name + ' household')} (${h.members.length})</div>`;
    html += `<div class="thought">${esc(p.activity ? 'Now: ' + p.activity + '. ' : p.moving ? 'Walking. ' : '')}${esc(p.thought || '')}</div>`;
    if (p.scores && !p.isPlayer) html += `<div class="muted">Yuka goal scores (desirability × loyalty bias)</div>` + p.scores.map(sc => `<div class="stat"><span>${sc.kind}</span>${bar(sc.d, '#ffe066', p.scores[0].d || 1)}</div>`).join('');
    html += `<div class="sec"><div class="muted">Loyalties</div>` + SPHERES.map(k => `<div class="stat"><span style="color:${SPHERE_COLOR[k]}">${k}</span>${bar(p.w[k], SPHERE_COLOR[k], 0.7)}</div>`).join('') + `</div>`;
    html += `<div class="sec"><div class="muted">Needs</div>` + [['energy', p.energy], ['social', p.social], ['purpose', p.purpose], ['wellbeing', p.wellbeing], ['skill', p.skill], ['trusts you', p.trust]].map(([k, v]) => `<div class="stat"><span>${k}</span>${bar(v, '#8fd0e0')}</div>`).join('') + `</div>`;
    html += `<div class="sec"><div class="kv"><span>household cash</span><span>${money(h.cash)}</span><span>paid work</span><span>${p.paidHoursWeek.toFixed(1)} h/week</span>` +
      `<span>yesterday in</span><span>wages ${money(li.wages || 0)} · stakes ${money(li.div || 0)} · dividend ${money(li.ubi || 0)}</span><span>yesterday out</span><span>basics ${money(li.essentials || 0)} · power ${money(li.energy || 0)} · AI ${money(li.ai || 0)}</span></div>`;
    const st = holdingsOf(h.id);
    html += `<div class="muted">Stakes</div>` + (st.length ? st.map(x => `<div>${pct(x.share)} of ${esc(x.a.name)} <span class="muted">(${money(x.value)})</span></div>`).join('') : '<div class="muted">none</div>') + `</div>`;
    if (p.memory.length) html += `<div class="sec"><div class="muted">Remembers</div>${p.memory.slice(0, 4).map(m => `<div>“${esc(m.text)}”</div>`).join('')}</div>`;
    if (!p.isPlayer) html += `<div class="sec"><div class="muted">Talk to ${esc(p.first)} about…</div><div class="row"><button data-p="community">owning it together</button><button data-p="nation">the national push</button><button data-p="family">looking after family</button></div><div class="row" style="margin-top:4px"><button id="ins-share">share half my biggest stake</button><button id="ins-follow">follow</button></div></div>`;
    else html += `<div class="row sec"><button id="ins-follow">follow</button></div>`;
  } else {
    html += `<h3>${esc(s.name)}</h3>`;
    if (s.lot) html += lotHistoryHtml(s.lot);
    const assets = (s.assets || []);
    if (s.household) html += `<div class="muted">home of ${esc(s.household.isPlayer ? 'you' : 'the ' + s.household.name + ' household')}: ${s.household.members.map(m => esc(m.first)).join(', ')} · cash ${money(s.household.cash)}</div>`;
    for (const a of assets) {
      html += `<div class="sec"><b>${esc(a.name)}</b> <span class="muted">${ASSET_LABEL[a.type]}</span><div class="kv"><span>capacity</span><span>${num(a.cap)} ${UNIT_NAME[a.type]}</span><span>value</span><span>${money(assetValue(a))}</span><span>output/day</span><span>${num(a.out || 0)}</span><span>profit/day</span><span>${money(a.profit || 0)}</span></div>`;
      html += `<div class="muted">Owners</div>` + Object.entries(a.shares).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => { const kind = ownerKind(k); const col = OWNER_COLOR[kind === 'resident' && isCoop(a) ? 'coop' : kind]; return `<div class="stat"><span>${pct(v)}</span><span style="color:${col}">${esc(ownerName(k))}</span></div>`; }).join('');
      if (a.pending.length) html += `<div class="muted">Under construction: ${a.pending.map(pp => num(pp.units) + ' ' + UNIT_NAME[a.type] + ' for ' + esc(ownerName(pp.owner)) + ', ready ~day ' + Math.ceil(pp.done + 1)).slice(0, 4).join('; ')}</div>`;
      html += `</div>`;
    }
    if (s.jobWeight) html += `<div class="sec muted">Workplace. ${S.people.filter(q => q.job === s).length} residents work here.</div>`;
    const here = S.people.filter(q => q.dest === s && q.activity);
    html += `<div class="sec muted">Here now: ${here.length ? here.map(q => esc(q.first) + ' (' + q.activity + ')').join(', ') : 'nobody'}</div>`;
  }
  el.innerHTML = html;
  $('ins-close').onclick = () => { view.selected = null; view.selSite = null; view.selLot = null; renderInspect(); };
  el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => doAction('persuade', p.id, b.dataset.p));
  if ($('ins-share')) $('ins-share').onclick = () => doAction('share', p.id);
  if ($('ins-follow')) $('ins-follow').onclick = () => { cam.follow = p; cam.tz = Math.max(cam.tz, 24); };
}

function doAction(name, ...args) {
  const err = ACTIONS[name](...args);
  if (err) toast(err); else toast(S.player.thought);
  hideMenu();
  renderYou();
}

// ---------- action menus ----------
function menuItems(a) {
  const h = S.player.home, c = S.coops.find(x => x.open);
  if (a === 'propose') return [['solar', 'Solar co-op', `everyone chips in for panels (goal ${money(S.P.solarCost * 0.8)})`], ['compute', 'Compute co-op', `racks that serve the valley first (goal ${money(S.P.rackCost * 12)})`], ['fleet', 'Robot co-op', `a shared robot fleet (goal ${money(S.P.robotCost * 10)})`]].map(([k, t, d]) => ({ t, d, f: () => doAction('propose', k), dis: !!c }));
  if (a === 'invest') return [
    { t: `Put ${money(h.cash * 0.5)} in the open co-op`, d: c ? c.name : 'no drive open', f: () => doAction('invest', 'coop', h.cash * 0.5), dis: !c },
    { t: `Give ${money(h.cash * 0.25)} to the commons fund`, d: 'the council builds town-owned assets with it', f: () => doAction('invest', 'commons', h.cash * 0.25) },
    { t: `Buy ${money(h.cash * 0.5)} of a Helix stake`, d: 'brings part of the engine back into the valley', f: () => doAction('invest', 'buyout', h.cash * 0.5) },
  ];
  if (a === 'build') return [
    { t: `Rooftop solar (${money(0.04 * S.P.solarCost)})`, d: 'panels on your own house', f: () => doAction('build', 'rooftop') },
    { t: `Order a robot (${money(S.P.robotCost)})`, d: 'joins your robot bay; you can share it later', f: () => doAction('build', 'robot') },
  ];
  if (a === 'council') return [
    { t: 'Town buys out Helix in town', d: 'commons bond buys every Helix stake inside the town grid', f: () => doAction('council', 'buyback') },
    { t: 'Local right of first refusal', d: 'when a family must sell a stake, the town buys it, not Helix', f: () => doAction('council', 'refusal') },
    { t: 'Raise the commons dividend', d: 'higher tax on income and outside profits, paid out per person', f: () => doAction('council', 'dividend') },
  ].map(i => ({ ...i, dis: !!S.council }));
  return [];
}
function showMenu(a, btn) {
  const m = $('menu');
  m.innerHTML = menuItems(a).map((i, k) => `<button data-k="${k}" ${i.dis ? 'disabled' : ''}><b>${esc(i.t)}</b><br><span class="muted">${esc(i.d)}</span></button>`).join('');
  const items = menuItems(a);
  m.querySelectorAll('button').forEach(b => b.onclick = () => items[+b.dataset.k].f());
  m.hidden = false;
  const r = btn.getBoundingClientRect();
  m.style.left = r.left + 'px'; m.style.top = 'auto'; m.style.bottom = (window.innerHeight - r.top + 6) + 'px';
}
function hideMenu() { $('menu').hidden = true; }

// ---------- chart ----------
const SERIES = [
  { k: 'outside', name: 'outside-owned', color: '#d062e6', f: h => h.outside },
  { k: 'gini', name: 'ownership gini', color: '#f2c14e', f: h => h.gini },
  { k: 'work', name: 'paid work (0–50 h/wk)', color: '#e8805a', f: h => h.work / 50 },
  { k: 'shortE', name: 'energy shortfall', color: '#ffd23f', f: h => h.shortE },
  { k: 'shortC', name: 'compute shortfall', color: '#5dff8f', f: h => h.shortC },
  { k: 'wellbeing', name: 'wellbeing', color: '#8fd0e0', f: h => h.wellbeing },
];
const seriesOn = new Set(SERIES.map(s => s.k));
function buildLegend() {
  $('legend').innerHTML = SERIES.map(s => `<span data-k="${s.k}" class="${seriesOn.has(s.k) ? '' : 'off'}"><i style="background:${s.color}"></i>${s.name}</span>`).join('') + `<span class="muted"><i style="background:#6fb7ff;width:2px"></i>discovery</span><span class="muted"><i style="background:#fff;width:2px"></i>your action</span>`;
  $('legend').querySelectorAll('[data-k]').forEach(el => el.onclick = () => { const k = el.dataset.k; seriesOn.has(k) ? seriesOn.delete(k) : seriesOn.add(k); buildLegend(); drawChart(); });
}
function drawChart() {
  const c = $('chart'), r = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = r.width, h = r.height, padL = 28, padB = 14;
  g.fillStyle = '#0a0f1d'; g.fillRect(0, 0, w, h);
  const hist = S.history;
  const span = Math.max(360, S.day + 1);
  const X = d => padL + (w - padL - 6) * d / span, Y = v => 4 + (h - padB - 8) * (1 - clamp(v, 0, 1));
  g.strokeStyle = '#1e2a4a'; g.lineWidth = 1; g.font = '9px ui-monospace, Menlo, monospace'; g.fillStyle = '#5d6b92'; g.textAlign = 'right';
  for (const v of [0, 0.5, 1]) { g.beginPath(); g.moveTo(padL, Y(v)); g.lineTo(w - 6, Y(v)); g.stroke(); g.fillText(Math.round(v * 100) + '%', padL - 3, Y(v) + 3); }
  g.textAlign = 'center';
  for (let y = 0; y * 360 <= span; y++) { g.fillText('Y' + (y + 1), X(y * 360 + 4), h - 3); g.beginPath(); g.moveTo(X(y * 360), 4); g.lineTo(X(y * 360), h - padB); g.stroke(); }
  for (const d of S.discoveries) { g.fillStyle = '#6fb7ff'; g.fillRect(X(d.day), 4, 1.5, h - padB - 4); }
  for (const a of S.actions) { g.fillStyle = '#ffffff'; g.fillRect(X(a.day), h - padB - 8, 1.5, 8); }
  for (const s of SERIES) {
    if (!seriesOn.has(s.k) || hist.length < 2) continue;
    g.strokeStyle = s.color; g.lineWidth = 1.5; g.beginPath();
    hist.forEach((p, i) => { const x = X(p.day), y = Y(s.f(p)); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  const last = S.discoveries[S.discoveries.length - 1];
  if (last) { g.fillStyle = '#6fb7ff'; g.textAlign = 'left'; g.fillText(last.title, Math.min(X(last.day) + 3, w - 160), 12); }
}

// ---------- banners ----------
let bannerTimer = 0, toastTimer = 0;
function onDiscovery(d) {
  const b = $('banner');
  b.innerHTML = `<div class="tag">DISCOVERY · ${dateLabel(S.t).text}</div><b>${esc(d.title)}</b><div>${esc(d.blurb)}</div><ul>${d.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
  b.hidden = false; bannerTimer = 7000;
}
function onSpeech(agent, line) { toast(`${agent.first}: “${line}”`, 5000); }
function toast(text, ms = 3200) { const t = $('toast'); t.textContent = text; t.hidden = !text; toastTimer = ms; }
function tickBanners(dtMs) {
  if (bannerTimer > 0) { bannerTimer -= dtMs; if (bannerTimer <= 0) $('banner').hidden = true; }
  if (toastTimer > 0) { toastTimer -= dtMs; if (toastTimer <= 0) $('toast').hidden = true; }
}

function lotHistoryHtml(l) {
  return `<div class="muted">Lot history</div>` + l.history.map(hh => `<div>${dateLabel(hh.day * 24).text.replace('Year ', 'Y')}: ${esc((LOT_USE[hh.use] || { label: hh.use }).label)} <span class="muted">(${esc(ownerName(hh.owner))})</span></div>`).join('');
}
function renderLotInspect(el, l) {
  el.hidden = false; $('feed').hidden = true;
  const u = LOT_USE[l.use] || LOT_USE.vacant;
  el.innerHTML = `<button class="close" id="ins-close">×</button><h3>${esc(u.label)}</h3><div class="muted">owned by ${esc(ownerName(l.owner))} · ${l.w}×${l.h} tiles · land value ${money(lotValue(l))}</div>` +
    (VIABILITY[l.use] ? `<div class="sec"><div class="stat"><span>occupancy</span>${bar(1 - l.vac, '#8fd0e0')}</div><div class="muted">${l.vac > 0.5 ? 'Mostly empty. Its owner is looking at other uses.' : 'Still earning its keep.'}</div></div>` : '') +
    (l.roof ? '<div class="sec">Rooftop solar installed.</div>' : '') + `<div class="sec">${lotHistoryHtml(l)}</div>`;
  $('ins-close').onclick = () => { view.selLot = null; renderInspect(); };
}
