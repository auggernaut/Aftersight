// ---------- interface ----------
const UI = { dialog: null, panel: null, nearby: null, offscreen: null, cutscene: false, breakfast: false, hudT: 0 };
const $ = sel => document.querySelector(sel);
function el(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function nameOf(s) { return s === 'you' ? S.player.name : s === 'bolt' ? S.bot.name : s === 'narr' ? '' : RES[s].short; }
function fill(t) { return t.replace(/\{name\}/g, S.player.name).replace(/\{bot\}/g, S.bot.name); }

const ICONS = {
  notebook: '<svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 3v18M9.5 8h6M9.5 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  ledger: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  projects: '<svg viewBox="0 0 24 24"><path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

function buildHUD() {
  $('#btn-notebook').innerHTML = ICONS.notebook + '<span>Notebook</span>';
  $('#btn-ledger').innerHTML = ICONS.ledger + '<span>Ledger</span>';
  $('#btn-projects').innerHTML = ICONS.projects + '<span>Projects</span>';
  $('#btn-menu').innerHTML = ICONS.menu + '<span>Menu</span>';
  $('#btn-morning').innerHTML = ICONS.moon + '<span>Next morning</span>';
  $('#btn-notebook').onclick = () => openPanel('notebook');
  $('#btn-ledger').onclick = () => openPanel('ledger');
  $('#btn-projects').onclick = () => openPanel('projects');
  $('#btn-menu').onclick = () => openPanel('menu');
  $('#btn-morning').onclick = () => nextMorning();
  document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
  $('#dialog').addEventListener('click', e => { if (!e.target.closest('button')) advanceDialog(); });
  $('#prompt').onclick = () => interact();
  $('#objective').onclick = () => openPanel('notebook');
  $('#panel-wrap').addEventListener('click', e => { if (e.target.id === 'panel-wrap') closePanel(); });
}
function setSpeed(v) {
  if (v === 0) S.paused = !S.paused; else { S.speed = v; S.paused = false; }
  hooks.sfx('click');
  updateHUD(true);
}

function weatherSvg(w) {
  const c = document.createElement('canvas'); c.width = 44; c.height = 44;
  const g = c.getContext('2d'); g.scale(2, 2); drawIcon(g, WEATHER[w].icon, 11, 11, 7);
  return c.toDataURL();
}
const _wcache = {};
function updateHUD(force) {
  UI.hudT -= 1;
  if (UI.hudT > 0 && !force) return;
  UI.hudT = 6;
  const m = S.minute % 1440;
  $('#clock').textContent = fmtClock(m);
  $('#day').textContent = `Day ${S.day} · ${WEEKDAYS[weekdayIdx(S.day)]}`;
  if (!_wcache[S.weather]) _wcache[S.weather] = weatherSvg(S.weather);
  const wi = $('#weather'); if (wi.dataset.w !== S.weather) { wi.src = _wcache[S.weather]; wi.dataset.w = S.weather; wi.alt = WEATHER[S.weather].name; wi.title = WEATHER[S.weather].name + (S.weather !== 'sunny' ? ` (solar at ${Math.round(WEATHER[S.weather].solar * 100)}%)` : ''); }
  document.querySelectorAll('[data-speed]').forEach(b => {
    const v = +b.dataset.speed;
    b.classList.toggle('on', v === 0 ? S.paused : (!S.paused && S.speed === v));
    if (v === 0) b.innerHTML = S.paused ? ICONS.play : ICONS.pause;
  });
  $('#parts').textContent = Math.floor(S.parts);
  $('#fund').textContent = fmtMoney(S.fund);
  $('#warmth-fill').style.width = Math.round(S.warmth * 100) + '%';
  $('#warmth-label').textContent = warmthWord();
  // objective
  const objs = objectives();
  const o = objs[0];
  const ob = $('#objective');
  if (o && !UI.dialog && !UI.cutscene) {
    ob.hidden = false;
    $('#obj-title').textContent = o.text;
    $('#obj-detail').textContent = o.detail;
    const side = objs.filter(x => x.side);
    $('#obj-side').innerHTML = side.map(s => `<div class="side">◇ ${escapeHtml(s.text)}</div>`).join('');
  } else ob.hidden = true;
  // prompt
  const pr = $('#prompt');
  if (UI.nearby && !UI.dialog && !UI.panel && !UI.cutscene) { pr.hidden = false; pr.innerHTML = `<kbd>E</kbd> ${escapeHtml(UI.nearby.label)}`; }
  else pr.hidden = true;
  // offscreen arrow
  const ar = $('#arrow');
  if (UI.offscreen && !UI.dialog && !UI.panel && !UI.cutscene) {
    // keep the arrow inside the area the HUD leaves free (taller HUD on phones)
    const top = VW <= 560 ? 150 : 80, bot = VH - 110;
    const cx = VW / 2, cy = (top + bot) / 2;
    const dx = UI.offscreen.x - cx, dy = UI.offscreen.y - cy;
    const a = Math.atan2(dy, dx);
    const k = Math.min((VW / 2 - 46) / Math.abs(Math.cos(a) || 1e-6), ((bot - top) / 2) / Math.abs(Math.sin(a) || 1e-6));
    ar.hidden = false;
    ar.style.transform = `translate(${cx + Math.cos(a) * k - 22}px, ${cy + Math.sin(a) * k - 22}px) rotate(${a}rad)`;
  } else ar.hidden = true;
}
function warmthWord() {
  const w = S.warmth;
  return w < 0.15 ? 'Weary' : w < 0.3 ? 'Stirring' : w < 0.5 ? 'Waking up' : w < 0.7 ? 'Lively' : w < 0.88 ? 'Warm' : 'Glowing';
}

// ----- toasts -----
function toast(text, kind = '') {
  const t = el('div', { class: 'toast ' + kind }, escapeHtml(fill(text)));
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4800);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function boltSay(text, t = 5) { BOT_FX.say = fill(text); BOT_FX.sayT = t; BOT_FX.mood = 'happy'; setTimeout(() => { BOT_FX.mood = 'normal'; }, 2500); }

// ----- dialogue -----
function startDialog(steps, who) {
  if (!steps || !steps.length) return;
  UI.dialog = { queue: steps.slice(), who, cur: null };
  $('#dialog').hidden = false;
  if (who && NPCS[who]) { const n = NPCS[who]; n.facing = S.player.x < n.x ? -1 : 1; S.player.facing = n.x > S.player.x ? 1 : -1; }
  advanceDialog();
}
function advanceDialog() {
  const d = UI.dialog;
  if (!d) return;
  if (d.cur && d.cur.choices) return; // must choose
  for (;;) {
    const s = d.queue.shift();
    if (!s) { endDialog(); return; }
    if (s.fx) { s.fx(); continue; }
    d.cur = s;
    renderDialogStep(s);
    return;
  }
}
function renderDialogStep(s) {
  const box = $('#dialog');
  const pc = $('#dlg-portrait');
  const nm = $('#dlg-name'), tx = $('#dlg-text'), ch = $('#dlg-choices');
  ch.innerHTML = '';
  if (s.choices) {
    const last = UI.dialog.lastSpeaker || UI.dialog.who;
    nm.textContent = S.player.name;
    nm.style.color = '#f2b955';
    pc.hidden = false;
    tx.textContent = '';
    pc.dataset.who = 'you'; drawPortrait(pc, 'you', 'happy');
    box.classList.add('choosing');
    s.choices.forEach((c, i) => {
      const b = el('button', { class: 'choice' }, `<kbd>${i + 1}</kbd> ${escapeHtml(fill(c.t))}`);
      b.onclick = () => choose(i);
      ch.appendChild(b);
    });
    return;
  }
  box.classList.remove('choosing');
  UI.dialog.lastSpeaker = s.s;
  nm.textContent = nameOf(s.s);
  nm.style.color = RES[s.s] ? RES[s.s].color : s.s === 'bolt' ? '#8ff4ff' : '#f2b955';
  tx.textContent = fill(s.t);
  pc.dataset.who = s.s;
  pc.hidden = s.s === 'narr';
  box.classList.toggle('narr', s.s === 'narr');
  if (s.s !== 'narr') drawPortrait(pc, s.s, s.mood);
  ch.innerHTML = '<span class="hint">Click or press E to continue</span>';
}
function choose(i) {
  const d = UI.dialog;
  if (!d || !d.cur || !d.cur.choices) return;
  const c = d.cur.choices[i];
  if (!c) return;
  hooks.sfx('click');
  const menu = d.cur;
  d.cur = null;
  const extra = [];
  extra.push(L('you', c.t, 'happy'));
  if (c.fx) extra.push(FX(c.fx));
  if (c.then) extra.push(...c.then);
  if (c.again && d.who && RES[d.who]) extra.push(menuStep(d.who));
  d.queue.unshift(...extra);
  advanceDialog();
}
function endDialog() {
  UI.dialog = null;
  $('#dialog').hidden = true;
  hooks.changed();
  saveGame();
}

// ----- panels -----
function openPanel(kind, arg) {
  if (UI.cutscene) return;
  if (UI.dialog) return;
  UI.panel = { kind, arg, tab: (UI.panel && UI.panel.kind === kind) ? UI.panel.tab : null };
  renderPanel();
  $('#panel-wrap').hidden = false;
  hooks.sfx('click');
  if (kind === 'ledger' && S.quest === 'ledger1') {
    S.flags.ledgerSeen = true;
    setQuest('van');
    setTimeout(() => toast("Teo didn't go to work today. Something about his van.", 'story'), 600);
    rebuildSchedules();
  }
}
function closePanel() {
  if (!UI.panel) return;
  const k = UI.panel.kind;
  UI.panel = null;
  $('#panel-wrap').hidden = true;
  $('#panel').innerHTML = '';
  saveGame();
  if (k === 'morning' && S.flags.afterlightPending) setTimeout(afterlightCutscene, 200);
}
function rerender() { if (UI.panel) renderPanel(); }
function renderPanel() {
  const p = $('#panel');
  const k = UI.panel.kind;
  p.innerHTML = '';
  p.className = 'panel panel-' + k;
  const head = el('div', { class: 'phead' });
  const titles = { ledger: 'Ledger', notebook: 'Notebook', projects: 'Projects', workbench: 'Workbench', meeting: 'Town meeting', site: '', creation: '', menu: 'Afterlight', morning: '', salvage: '' };
  head.appendChild(el('h2', {}, titles[k] || ''));
  const x = el('button', { class: 'close', 'aria-label': 'Close' }, '×'); x.onclick = closePanel;
  head.appendChild(x);
  p.appendChild(head);
  const body = el('div', { class: 'pbody' });
  p.appendChild(body);
  ({ ledger: panelLedger, notebook: panelNotebook, projects: panelProjects, workbench: panelWorkbench, meeting: panelMeeting, site: panelSite, creation: panelCreation, menu: panelMenu, morning: panelMorning })[k](body, head);
}
function tabs(body, names, def) {
  const cur = UI.panel.tab || def;
  const bar = el('div', { class: 'tabs', role: 'tablist' });
  for (const [id, label] of names) {
    const b = el('button', { class: 'tab' + (id === cur ? ' on' : ''), role: 'tab' }, label);
    b.onclick = () => { UI.panel.tab = id; renderPanel(); };
    bar.appendChild(b);
  }
  body.appendChild(bar);
  return cur;
}
function portraitEl(id, mood, size = 52) {
  const c = el('canvas', { class: 'portrait', width: size, height: size });
  c.style.width = size + 'px'; c.style.height = size + 'px';
  requestAnimationFrame(() => drawPortrait(c, id, mood));
  return c;
}
function spark(values, w = 120, h = 30, color = '#f2b955') {
  if (values.length < 2) values = [values[0] || 0, values[0] || 0];
  const max = Math.max(1, ...values), min = 0;
  const pts = values.map((v, i) => [i / (values.length - 1) * (w - 6) + 3, h - 4 - (v - min) / (max - min) * (h - 8)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d} L ${last[0]} ${h - 2} L 3 ${h - 2} Z" fill="${color}22"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}"/></svg>`;
}
function pie(owners, size = 76) {
  let a = -Math.PI / 2;
  const r = size / 2 - 2, cx = size / 2, cy = size / 2;
  let paths = '';
  const entries = Object.entries(owners || {}).filter(([, v]) => v > 0.001);
  if (entries.length === 1) return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${OWNER_COLORS[entries[0][0]]}"/></svg>`;
  for (const [k, v] of entries) {
    const a2 = a + v * TAU;
    const large = v > 0.5 ? 1 : 0;
    paths += `<path d="M${cx} ${cy} L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} A${r} ${r} 0 ${large} 1 ${cx + Math.cos(a2) * r} ${cy + Math.sin(a2) * r} Z" fill="${OWNER_COLORS[k]}" stroke="#182428" stroke-width="1.5"/>`;
    a = a2;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}
function ownerLegend(owners) {
  return '<ul class="legend">' + Object.entries(owners || {}).filter(([, v]) => v > 0.001).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><i style="background:${OWNER_COLORS[k]}"></i>${OWNER_NAMES[k]} <b>${Math.round(v * 100)}%</b></li>`).join('') + '</ul>';
}

// Ledger: households, projects, money flow
function panelLedger(body) {
  const tab = tabs(body, [['households', 'Households'], ['projects', 'Projects'], ['flow', 'Where the money goes']], 'households');
  if (tab === 'households') {
    body.appendChild(el('p', { class: 'lede' }, 'Each household needs to cover its essentials. Whatever ownership income doesn’t cover, they earn with paid work. Values are per day.'));
    const grid = el('div', { class: 'hh-grid' });
    for (const id of RES_IDS) {
      const h = H(id), r = RES[id], e = expensesOf(id), inc = incomeOf(id), sl = stageLabel(id);
      const card = el('div', { class: 'hh' });
      const top = el('div', { class: 'hh-top' });
      top.appendChild(portraitEl(id, npcMood(id, currentBlock(id), false)));
      top.appendChild(el('div', { class: 'hh-name' }, `<b>${r.name}</b><span>${r.job}</span><em class="chip ${sl.c}">${sl.t}</em>`));
      card.appendChild(top);
      const rows = [
        ['Housing', e.housing, r.base.housing], ['Food', e.food, r.base.food], ['Power', e.power, r.base.power], ['Transport & repairs', e.transport, r.base.transport],
      ];
      if (r.base.other) rows.push([r.otherLabel, e.other, r.base.other]);
      let bills = '<table class="bills"><tbody>';
      for (const [n, v, b0] of rows) bills += `<tr><td>${n}</td><td class="num">${Math.abs(v - b0) > 0.5 ? `<s>${fmtMoney(b0)}</s> ` : ''}${fmtMoney(v)}</td></tr>`;
      bills += `<tr class="tot"><td>Essentials</td><td class="num">${fmtMoney(e.total)}</td></tr>`;
      bills += `<tr class="inc"><td>Ownership income</td><td class="num">${inc.total > 0.5 ? '+' + fmtMoney(inc.total) : '$0'}</td></tr>`;
      for (const pid in inc.by) bills += `<tr class="sub"><td>· ${PROJECTS[pid].name} (${Math.round((S.projects[pid].owners[id] || 0) * 100)}%)</td><td class="num">${fmtMoney(inc.by[pid])}</td></tr>`;
      bills += '</tbody></table>';
      card.appendChild(el('div', {}, bills));
      const hist = h.history.map(x => x.work);
      const first = h.history[0] ? h.history[0].work : h.work;
      card.appendChild(el('div', { class: 'hh-stats' }, `
        <div><span class="lbl">Paid work needed</span><b class="big">${fmtHours(h.work)}<small>/day</small></b><span class="delta">${first - h.work > 0.4 ? '−' + fmtHours(first - h.work) + ' since day 1' : 'at the start: ' + fmtHours(first)}</span>${spark(hist, 110, 28, '#e8805a')}</div>
        <div><span class="lbl">Free time</span><b class="big">${fmtHours(freeTime(id))}<small>/day</small></b><span class="lbl">Energy</span><div class="bar"><i style="width:${Math.round(h.energy)}%;background:${h.energy < 35 ? '#e8805a' : h.energy < 65 ? '#f2b955' : '#9cc46a'}"></i></div></div>`));
      grid.appendChild(card);
    }
    body.appendChild(grid);
    body.appendChild(el('p', { class: 'fine' }, 'Paid work needed = (essentials − ownership income) ÷ hourly wage. People cut hours gradually; most can drop about three and a half hours a day at a time. Free time = 16 waking hours − work − commute − chores.'));
  } else if (tab === 'projects') {
    const any = Object.keys(PROJECTS).filter(pid => S.projects[pid].status === 'online' || S.projects[pid].status === 'building');
    if (!any.length) { body.appendChild(el('p', { class: 'empty' }, 'Nothing built yet. Projects you build show their output, costs and owners here.')); return; }
    for (const pid of any) body.appendChild(projectCard(pid, false));
    body.appendChild(el('p', { class: 'fine' }, 'Solar output depends on the weather; numbers here are a typical day. Yesterday’s actual figures are in the morning report.'));
  } else {
    body.appendChild(el('p', { class: 'lede' }, 'Every project earns money. Owners receive it in proportion to their shares. Wide bars are big earners; colors show who receives the money.'));
    let total = 0;
    const recv = {};
    for (const pid in PROJECTS) {
      if (!online(pid)) continue;
      const ec = projectEcon(pid), o = S.projects[pid].owners || {};
      const net = Math.max(0, ec.net); total += net;
      const row = el('div', { class: 'flow' });
      let segs = '';
      for (const [k, v] of Object.entries(o)) { if (v <= 0) continue; recv[k] = (recv[k] || 0) + v * net; segs += `<i style="flex:${v};background:${OWNER_COLORS[k]}" title="${OWNER_NAMES[k]}: ${fmtMoney(v * net)}"></i>`; }
      row.innerHTML = `<div class="flow-l"><b>${PROJECTS[pid].name}</b><span>${fmtMoney(ec.revenue)} revenue − ${fmtMoney(ec.op)} upkeep = <b>${fmtMoney(net)}/day</b></span></div><div class="flow-bar">${segs}</div>`;
      body.appendChild(row);
    }
    if (!total) { body.appendChild(el('p', { class: 'empty' }, 'Nothing is earning yet.')); return; }
    const t = el('table', { class: 'recv' });
    t.innerHTML = '<thead><tr><th>Receives</th><th class="num">Per day</th><th class="num">Share of all income</th></tr></thead><tbody>' + Object.entries(recv).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td><i class="dot" style="background:${OWNER_COLORS[k]}"></i>${OWNER_NAMES[k]}</td><td class="num">${fmtMoney(v)}</td><td class="num">${Math.round(v / total * 100)}%</td></tr>`).join('') + '</tbody>';
    body.appendChild(t);
    body.appendChild(el('p', { class: 'fine' }, `Community resources are separate from household money. Parts on hand: ${Math.floor(S.parts)} (salvage, pledges, and workshop fabrication). Commons Fund: ${fmtMoney(S.fund)}; it pays for missing parts at $4 each and for buying back shares.`));
  }
}
function projectCard(pid, withUpgrades) {
  const d = PROJECTS[pid], p = S.projects[pid];
  const card = el('div', { class: 'pcard' });
  const ec = projectEcon(pid);
  let h = `<div class="pc-head"><h3>${d.name}</h3><span class="chip ${p.status === 'online' ? 'good' : 'mid'}">${p.status === 'online' ? (p.damaged ? 'Damaged' : 'Running') : p.status === 'building' ? `Building · ${p.buildLeft} night${p.buildLeft === 1 ? '' : 's'} left` : p.status}</span></div>`;
  h += `<div class="pc-body"><div class="pc-pie">${pie(p.owners)}${ownerLegend(p.owners)}</div><div class="pc-nums">`;
  h += `<div><span class="lbl">Output</span>${d.output}</div><div><span class="lbl">Service</span>${p.option === 'brightline' ? 'Residents get 25% off their power bill.' : d.service}</div>`;
  if (p.status === 'online') h += `<table class="bills"><tbody><tr><td>Revenue</td><td class="num">${fmtMoney(ec.revenue)}</td></tr><tr><td>Operating cost</td><td class="num">−${fmtMoney(ec.op)}</td></tr><tr class="tot"><td>Net to owners</td><td class="num">${fmtMoney(ec.net)}/day</td></tr>${ec.fab ? `<tr><td>Parts made</td><td class="num">${ec.fab}/day</td></tr>` : ''}</tbody></table>`;
  h += '</div></div>';
  if (p.stories.length) h += `<ul class="stories">${p.stories.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
  card.innerHTML = h;
  if (withUpgrades && p.status === 'online') card.appendChild(upgradeList(pid));
  return card;
}
function costLine(n) {
  const a = affordable(n);
  if (a.fromFund === 0) return `${n} parts`;
  return `${n} parts (${a.fromStock} on hand + ${fmtMoney(a.fundCost)} from the Commons Fund)`;
}
function upgradeList(pid) {
  const d = PROJECTS[pid], p = S.projects[pid];
  const wrap = el('div', { class: 'ups' });
  wrap.appendChild(el('h4', {}, 'Upgrades'));
  for (const u of d.upgrades) {
    const row = el('div', { class: 'up' });
    const owned = p.upgrades[u.id], pend = p.pending === u.id;
    const a = affordable(u.parts);
    const locked = p.option === 'brightline';
    row.innerHTML = `<div><b>${u.name}</b>${u.idea ? ` <span class="idea" style="color:${RES[u.idea].color}">${RES[u.idea].short}'s idea</span>` : ''}<p>${u.desc}${u.revenue ? ` <em>+${fmtMoney(u.revenue)}/day revenue.</em>` : ''}</p></div>`;
    const b = el('button', { class: 'btn' + (owned || pend ? ' done' : '') }, owned ? 'Installed' : pend ? 'Installing tonight' : locked ? 'Brightline decides' : `Build · ${u.parts} parts`);
    if (!owned && !pend && !locked) {
      if (!a.ok || p.pending) { b.disabled = true; b.title = p.pending ? 'One upgrade at a time per project.' : `Needs ${u.parts} parts. You have ${Math.floor(S.parts)} and ${fmtMoney(S.fund)} in the Commons Fund.`; if (!a.ok) b.textContent = `Need ${u.parts} parts`; }
      b.onclick = () => {
        spendParts(u.parts); p.pending = u.id; hooks.sfx('build');
        toast(`${u.name}: the robots will install it tonight.`, 'good');
        logEvent(`Started building the ${u.name}.`, 'build');
        addStory(p, `Day ${S.day}: added the ${u.name}${u.idea ? `, ${RES[u.idea].short}'s idea` : ''}.`);
        rerender(); saveGame();
      };
    }
    row.appendChild(b);
    wrap.appendChild(row);
  }
  return wrap;
}

function panelNotebook(body) {
  const tab = tabs(body, [['goals', 'Goals'], ['people', 'People'], ['town', 'Town']], 'goals');
  if (tab === 'goals') {
    const objs = objectives();
    const ul = el('div', { class: 'goals' });
    objs.forEach((o, i) => ul.appendChild(el('div', { class: 'goal' + (o.side ? ' side' : '') }, `<b>${escapeHtml(o.text)}</b><p>${escapeHtml(o.detail)}</p>`)));
    body.appendChild(ul);
    const done = QUEST_ORDER.slice(0, questIndex()).map(q => QUEST_DONE[q]).filter(Boolean);
    if (done.length) body.appendChild(el('div', { class: 'done-list' }, '<h4>Done</h4><ul>' + done.map(t => `<li>✓ ${t}</li>`).join('') + '</ul>'));
    body.appendChild(el('div', { class: 'help' }, `<h4>How to play</h4><p>Move with WASD or the arrow keys, or click/tap where you want to go. Press <kbd>E</kbd> or <kbd>Space</kbd> (or tap someone) to talk and interact. <kbd>L</kbd> Ledger, <kbd>N</kbd> Notebook, <kbd>B</kbd> Projects, <kbd>P</kbd> pause, <kbd>1</kbd>–<kbd>3</kbd> speed, <kbd>Z</kbd> next morning, mouse wheel to zoom. The game saves itself.</p>`));
  } else if (tab === 'people') {
    for (const id of RES_IDS) {
      const h = H(id), r = RES[id];
      const card = el('div', { class: 'person' });
      card.appendChild(portraitEl(id, npcMood(id, currentBlock(id), false), 60));
      const hearts = Math.round(h.rel / 20);
      card.appendChild(el('div', {}, `<b>${h.met ? r.name : 'Someone you haven’t met'}</b> <span class="hearts" aria-label="${hearts} of 5">${'♥'.repeat(hearts)}<span>${'♥'.repeat(5 - hearts)}</span></span>
        ${h.met ? `<p class="muted">${r.age} · ${r.job}</p><p>${r.personality}</p>` : '<p class="muted">Lives on your street.</p>'}
        ${h.knowPressure ? `<p><span class="lbl">Pressure</span> ${r.pressure}</p>` : ''}
        ${h.knowInterest ? `<p><span class="lbl">Loves</span> ${r.interest}</p>` : ''}
        <p><span class="lbl">Now</span> ${stageLabel(id).t}. ${h.work > 0 ? fmtHours(h.work) + ' of paid work a day.' : 'No job needed for the essentials.'}</p>`));
      body.appendChild(card);
    }
  } else {
    const st = [];
    for (const pid in PROJECTS) for (const s of S.projects[pid].stories) st.push([PROJECTS[pid].name, s]);
    for (const cid in CREATIONS) for (const s of S.creations[cid].stories) st.push([CREATIONS[cid].name, s]);
    body.appendChild(el('div', { class: 'town' }, `<div class="meter"><span class="lbl">Town life</span><div class="bar wide"><i style="width:${Math.round(S.warmth * 100)}%"></i></div><b>${warmthWord()}</b></div>`));
    if (st.length) body.appendChild(el('div', {}, '<h4>Places and their stories</h4><ul class="stories">' + st.map(([n, s]) => `<li><b>${n}.</b> ${escapeHtml(s)}</li>`).join('') + '</ul>'));
    body.appendChild(el('div', {}, '<h4>Journal</h4><ul class="log">' + S.log.slice(0, 40).map(l => `<li><span>Day ${l.day}</span> ${escapeHtml(l.text)}</li>`).join('') + '</ul>'));
  }
}
const QUEST_DONE = {
  meet: 'Met your neighbors', idea_solar: 'Sketched Community Solar', plan_solar: 'Decided who owns the array', wait_solar: 'Built the array',
  ledger1: 'Read the ledger', van: 'Heard Teo out', idea_workshop: 'Drafted the Robot Workshop', plan_workshop: 'Decided who owns the workshop',
  wait_workshop: 'Opened the workshop', garden: 'Talked gardens with Teo', idea_greenhouse: 'Drafted the greenhouse', plan_greenhouse: 'Decided who owns the greenhouse',
  wait_greenhouse: 'Grew the first food', cover: 'Covered everyone’s essentials', freedom: 'Saw the first free days', kitchen: 'Planned the Shared Kitchen', wait_kitchen: 'Built the kitchen', breakfast: 'Hosted the first breakfast',
};

function panelProjects(body) {
  const any = [];
  for (const pid in PROJECTS) {
    const p = S.projects[pid];
    if (p.status === 'locked') continue;
    any.push(pid);
    if (p.status === 'online' || p.status === 'building') body.appendChild(projectCard(pid, true));
    else body.appendChild(el('div', { class: 'pcard dim' }, `<div class="pc-head"><h3>${PROJECTS[pid].name}</h3><span class="chip mid">${p.status === 'idea' ? 'Idea: draft it at your workbench' : 'Drafted: decide ownership at the notice board'}</span></div><p>${PROJECTS[pid].blurb}</p>`));
  }
  for (const cid in CREATIONS) {
    const c = S.creations[cid];
    if (c.status === 'locked' || c.status === 'teased') continue;
    any.push(cid);
    body.appendChild(el('div', { class: 'pcard' }, `<div class="pc-head"><h3>${CREATIONS[cid].name}</h3><span class="chip ${c.status === 'built' ? 'good' : 'mid'}">${c.status === 'built' ? 'Built' : c.status === 'building' ? 'Building' : 'Ready to plan on ' + LOTS[CREATIONS[cid].lot].name}</span></div><p>${CREATIONS[cid].blurb}</p>${c.stories.length ? `<ul class="stories">${c.stories.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}`));
  }
  if (!any.length) body.appendChild(el('p', { class: 'empty' }, 'No projects yet. Meet your neighbors; their troubles will suggest the first one.'));
  body.appendChild(el('p', { class: 'fine' }, `Parts on hand: ${Math.floor(S.parts)}. Commons Fund: ${fmtMoney(S.fund)}. Parts come from salvage, pledges, and the Robot Workshop. The Commons Fund covers any shortfall at $4 a part.`));
}

function panelWorkbench(body) {
  body.appendChild(el('p', { class: 'lede' }, 'Your bench, your sketches, and a mug of cold coffee. Draft an idea here, then take it to the notice board so the street can decide who owns it.'));
  let shown = 0;
  for (const pid in PROJECTS) {
    const d = PROJECTS[pid], p = S.projects[pid];
    const card = el('div', { class: 'pcard' + (p.status === 'locked' ? ' dim' : '') });
    if (p.status === 'locked') { card.innerHTML = `<div class="pc-head"><h3>${d.name}</h3><span class="chip">Not yet</span></div><p class="muted">Talk to your neighbors. Their troubles will point the way.</p>`; body.appendChild(card); continue; }
    shown++;
    let h = `<div class="pc-head"><h3>${d.name}</h3><span class="chip ${p.status === 'online' ? 'good' : 'mid'}">${{ idea: 'New idea', drafted: 'Drafted', building: 'Being built', online: 'Running' }[p.status]}</span></div><p>${d.blurb}</p>`;
    h += `<div class="specs"><span><b>Costs</b> ${d.parts} parts</span><span><b>Earns</b> about ${fmtMoney(d.revenue - d.op)}/day after upkeep</span><span><b>Service</b> ${d.service}</span></div>`;
    card.innerHTML = h;
    if (p.status === 'idea') {
      const styles = el('div', { class: 'styles' });
      const sel = UI.panel.sel = UI.panel.sel || {};
      const avail = d.styles.filter(s => !s.requires || S.flags[s.requires]);
      if (!sel[pid] || !avail.find(s => s.id === sel[pid])) sel[pid] = avail[avail.length - 1].id;
      for (const s of avail) {
        const b = el('button', { class: 'style' + (sel[pid] === s.id ? ' on' : '') }, `<b>${s.name}</b><span>${s.desc}</span>`);
        b.onclick = () => { sel[pid] = s.id; rerender(); };
        styles.appendChild(b);
      }
      const locked = d.styles.filter(s => s.requires && !S.flags[s.requires]);
      card.appendChild(el('h4', {}, 'Choose a look'));
      card.appendChild(styles);
      if (locked.length) card.appendChild(el('p', { class: 'fine' }, 'A neighbor might have their own design in mind.'));
      const go = el('button', { class: 'btn primary' }, 'Draft it');
      go.onclick = () => {
        p.style = sel[pid]; p.status = 'drafted'; hooks.sfx('quest');
        setQuest('plan_' + pid);
        logEvent(`Drafted the ${d.name} (${d.styles.find(s => s.id === p.style).name}).`, 'idea');
        if (p.style === 'leaf') addStory(p, 'Designed from a napkin sketch by Juno.');
        boltSay(pid === 'solar' ? 'Now the important part: who owns it? Let’s call a town meeting at the notice board.' : 'To the notice board! The street decides who owns it.');
        closePanel();
      };
      card.appendChild(go);
    }
    body.appendChild(card);
  }
  if (!shown) body.appendChild(el('p', { class: 'fine' }, 'Nothing to draft yet.'));
}

// Town meeting: ownership + build approach
function panelMeeting(body) {
  const pid = Object.keys(PROJECTS).find(k => S.projects[k].status === 'drafted');
  if (buybackAvailable()) {
    const price = buybackPrice();
    const box = el('div', { class: 'pcard' }, `<div class="pc-head"><h3>Buy back the array from Brightline</h3></div><p>Brightline will sell its stake for ${fmtMoney(price)}, about three days of its earnings. The array would then belong to the four households (20% each) and the Commons Fund (20%).</p><p class="muted">Commons Fund: ${fmtMoney(S.fund)}</p>`);
    const b = el('button', { class: 'btn primary' }, S.fund >= price ? `Buy it back · ${fmtMoney(price)}` : `Need ${fmtMoney(price - S.fund)} more`);
    b.disabled = S.fund < price;
    b.onclick = () => { if (doBuyback()) { hooks.sfx('quest'); toast('The array belongs to the street now.', 'good'); rerender(); saveGame(); } };
    box.appendChild(b);
    body.appendChild(box);
  }
  if (!pid) {
    if (!buybackAvailable()) body.appendChild(el('p', { class: 'empty' }, 'Nothing to decide right now. Draft a project at your workbench first.'));
    return;
  }
  const d = PROJECTS[pid];
  const sel = UI.panel.sel = UI.panel.sel || { option: d.options[0], approach: 'robots' };
  if (!d.options.includes(sel.option)) sel.option = d.options[0];
  body.appendChild(el('p', { class: 'lede' }, `The whole street squeezes around the notice board. On the agenda: the <b>${d.name}</b>. It needs ${d.parts} parts. Who pays, and who owns it?`));
  const opts = el('div', { class: 'options' });
  for (const o of d.options) {
    const O = OWNERSHIP[o];
    const cp = communityPartsFor(pid, o), pl = pledgesFor(pid, o);
    const need = Math.max(0, cp - pl);
    const a = affordable(need);
    const b = el('button', { class: 'option' + (sel.option === o ? ' on' : ''), role: 'radio', 'aria-checked': sel.option === o }, `<span class="tag">${O.tag}</span><b>${O.name}</b><span>${O.desc}</span><span class="cost">${o === 'brightline' ? 'Community pays: nothing' : `Community pays: ${cp} parts${pl ? ` (${pl} pledged by neighbors)` : ''}`}${need && !a.ok ? ' · <em>not enough yet</em>' : ''}</span>`);
    b.onclick = () => { sel.option = o; rerender(); };
    opts.appendChild(b);
  }
  body.appendChild(opts);
  const proj = projectWith(pid, sel.option);
  // what neighbors say
  body.appendChild(el('div', { class: 'quotes' }, meetingQuotes(pid, sel.option).map(([id, t]) => `<div class="q"><b style="color:${RES[id].color}">${RES[id].short}</b> ${escapeHtml(t)}</div>`).join('')));
  // projection table
  let t = '<table class="proj"><thead><tr><th>Household</th><th>Shares</th><th class="num">Income/day</th><th class="num">Essentials/day</th><th class="num">Paid work needed</th></tr></thead><tbody>';
  for (const id of RES_IDS) {
    const b = proj.before[id], a = proj.after[id];
    const sh = Math.round((proj.owners[id] || 0) * 100);
    t += `<tr><td><i class="dot" style="background:${OWNER_COLORS[id]}"></i>${RES[id].short}</td><td>${sh}%</td><td class="num">${fmtMoney(b.inc)} → <b>${fmtMoney(a.inc)}</b></td><td class="num">${fmtMoney(b.exp)} → <b>${fmtMoney(a.exp)}</b></td><td class="num">${fmtHours(b.work)} → <b class="${a.work <= 0 ? 'good' : a.work < b.work - 0.5 ? 'mid' : 'bad'}">${fmtHours(a.work)}</b></td></tr>`;
  }
  const net = Math.max(0, proj.econ.net);
  if (proj.owners.commons) t += `<tr class="sub"><td colspan="2"><i class="dot" style="background:${OWNER_COLORS.commons}"></i>Commons Fund</td><td class="num" colspan="3">+${fmtMoney(proj.owners.commons * net)}/day for upkeep and future projects</td></tr>`;
  if (proj.owners.brightline) t += `<tr class="sub"><td colspan="2"><i class="dot" style="background:${OWNER_COLORS.brightline}"></i>Brightline Co.</td><td class="num" colspan="3">+${fmtMoney(proj.owners.brightline * net)}/day leaves the neighborhood</td></tr>`;
  t += '</tbody></table>';
  body.appendChild(el('div', { class: 'scroll-x' }, `<h4>What changes on a typical day</h4>${t}`));
  // approach
  body.appendChild(el('h4', {}, 'How should it be built?'));
  const ap = el('div', { class: 'options two' });
  for (const k of ['robots', 'together']) {
    const A = APPROACHES[k];
    const b = el('button', { class: 'option' + (sel.approach === k ? ' on' : '') }, `<b>${A.name}</b><span>${A.desc}</span><span class="cost">${A.nights} night${A.nights > 1 ? 's' : ''}</span>`);
    b.onclick = () => { sel.approach = k; rerender(); };
    ap.appendChild(b);
  }
  body.appendChild(ap);
  const cp = communityPartsFor(pid, sel.option), pl = pledgesFor(pid, sel.option);
  const need = Math.max(0, cp - pl);
  const a = affordable(need);
  const foot = el('div', { class: 'pfoot' });
  foot.appendChild(el('span', { class: 'muted' }, need ? `From the community: ${costLine(need)}.` : sel.option === 'brightline' ? 'Brightline pays for everything.' : 'Pledges cover it.'));
  const go = el('button', { class: 'btn primary' }, a.ok ? 'Decide and start building' : `Need ${need - S.parts - Math.floor(S.fund / 4)} more parts`);
  if (!a.ok) { go.disabled = true; const sv = Object.keys(SALVAGE).filter(k => SALVAGE[k].unlock === pid && !S.salvage[k]); foot.appendChild(el('span', { class: 'warn' }, sv.length ? `Look for salvage: ${sv.map(k => SALVAGE[k].name).join(', ')}.` : 'Wait for more parts, or choose an option where someone else pays.')); }
  go.onclick = () => decideProject(pid, sel.option, sel.approach);
  foot.appendChild(go);
  body.appendChild(foot);
}
function meetingQuotes(pid, option) {
  const q = [];
  if (option === 'equal') q.push(['mara', 'Equal shares. Same for everyone. I like simple.'], ['teo', 'Twenty percent to the commons? Good. Things break. Somebody has to pay for fixing them.']);
  if (option === 'need') q.push(['juno', 'Bigger shares for whoever is still short? That’s... really kind. And smart, honestly.'], ['odile', 'I’d get less. I’m also the one who needs it least. Fine. Write it down before I change my mind.']);
  if (option === 'odile') q.push(['odile', 'Half the parts, half the shares. That’s a fair return on my savings.'], ['juno', 'So Odile gets half of everything it earns, forever? I mean... it is her money.']);
  if (option === 'brightline') q.push(['teo', 'Free is never free. They’ll keep the money and we’ll keep the bills.'], ['mara', 'A quarter off my power bill, today, for nothing? I can’t pretend that’s not tempting.']);
  return q;
}
function decideProject(pid, option, approach) {
  const d = PROJECTS[pid], p = S.projects[pid];
  const cp = communityPartsFor(pid, option), pl = pledgesFor(pid, option);
  const need = Math.max(0, cp - pl);
  if (!affordable(need).ok) return;
  spendParts(need);
  p.option = option; p.owners = ownersFor(option); p.approach = approach;
  p.status = 'building'; p.buildLeft = APPROACHES[approach].nights; p.buildTotal = p.buildLeft;
  if (approach === 'together') { for (const id of RES_IDS) befriend(id, 8); addStory(p, `Built by the neighbors after their shifts, with the robots holding the ladders.`); }
  else addStory(p, 'Built overnight by the robots.');
  addStory(p, `Owned by: ${Object.entries(p.owners).filter(([, v]) => v > 0).map(([k, v]) => `${OWNER_NAMES[k]} ${Math.round(v * 100)}%`).join(', ')}.`);
  logEvent(`The street chose "${OWNERSHIP[option].name}" for the ${d.name}.`, 'decision');
  if (pl) logEvent('Neighbors pledged 20 parts: Teo’s old tools, Mara’s shelving, Juno’s bike frame.', 'note');
  setQuest('wait_' + pid);
  rebuildColliders(S);
  hooks.sfx('build');
  toast(`The ${d.name} is going up. ${p.buildLeft === 1 ? 'Ready by morning.' : `Ready in ${p.buildLeft} nights.`}`, 'good');
  boltSay(p.buildLeft === 1 ? 'Robots are on it. We could explore, or press Next morning.' : 'Two evenings of building with the neighbors. I’ll bring snacks. I can’t eat them, but I’ll bring them.');
  closePanel();
  saveGame();
}

function panelSite(body, head) {
  const pid = UI.panel.arg;
  head.querySelector('h2').textContent = PROJECTS[pid].name;
  const p = S.projects[pid];
  if (p.damaged) {
    const box = el('div', { class: 'pcard warn' }, '<b>Storm damage.</b> A row of panels tore loose. The array is running at about half strength until it is fixed.');
    const a = affordable(8);
    const b = el('button', { class: 'btn primary' }, a.ok ? 'Repair it · 8 parts' : 'Need 8 parts');
    b.disabled = !a.ok;
    b.onclick = () => { spendParts(8); p.damaged = false; addStory(p, `Day ${S.day}: repaired after the windstorm. Teo held the ladder and complained.`); logEvent('Repaired the solar array after the storm.', 'build'); toast('The array is back at full strength.', 'good'); hooks.sfx('build'); rerender(); saveGame(); };
    box.appendChild(b);
    body.appendChild(box);
  }
  body.appendChild(projectCard(pid, true));
}

// creation planner with a live preview
function panelCreation(body, head) {
  const cid = UI.panel.arg, C = CREATIONS[cid], c = S.creations[cid];
  head.querySelector('h2').textContent = C.name;
  if (c.status === 'built' || c.status === 'building') {
    body.appendChild(el('p', { class: 'lede' }, c.status === 'built' ? `${C.blurb}` : `Being built. ${c.buildLeft} night${c.buildLeft === 1 ? '' : 's'} to go.`));
    if (c.stories.length) body.appendChild(el('ul', { class: 'stories' }, c.stories.map(s => `<li>${escapeHtml(s)}</li>`).join('')));
    return;
  }
  const sel = UI.panel.sel = UI.panel.sel || { style: 'villa', features: C.features.slice(0, 3).map(f => f.id), approach: 'assist' };
  body.appendChild(el('p', { class: 'lede' }, C.blurb + ' Pick a style and what it holds. The robots can do everything, or step back so people make it themselves.'));
  const wrap = el('div', { class: 'creator-grid' });
  const left = el('div');
  const prev = el('canvas', { class: 'preview', width: 360, height: 220 });
  left.appendChild(prev);
  wrap.appendChild(left);
  const right = el('div');
  right.appendChild(el('h4', {}, 'Style'));
  const st = el('div', { class: 'options' });
  for (const s of STYLES) { const b = el('button', { class: 'option' + (sel.style === s.id ? ' on' : '') }, `<b>${s.name}</b><span>${s.desc}</span>`); b.onclick = () => { sel.style = s.id; rerender(); }; st.appendChild(b); }
  right.appendChild(st);
  right.appendChild(el('h4', {}, 'What it holds'));
  const fs = el('div', { class: 'feats' });
  for (const f of C.features) {
    const on = sel.features.includes(f.id);
    const b = el('button', { class: 'feat' + (on ? ' on' : ''), 'aria-pressed': on }, `<b>${f.name}</b><span>${f.who ? `${RES[f.who].short} wants this` : 'For everyone'} · ${f.parts} parts</span>`);
    b.onclick = () => { if (on) sel.features = sel.features.filter(x => x !== f.id); else sel.features.push(f.id); rerender(); };
    fs.appendChild(b);
  }
  right.appendChild(fs);
  wrap.appendChild(right);
  body.appendChild(wrap);
  body.appendChild(el('h4', {}, 'Who builds it?'));
  const ap = el('div', { class: 'options three' });
  for (const k of ['robots', 'assist', 'hand']) { const A = APPROACHES[k]; const b = el('button', { class: 'option' + (sel.approach === k ? ' on' : '') }, `<b>${A.name}</b><span>${A.desc}</span><span class="cost">${A.nights} night${A.nights > 1 ? 's' : ''}</span>`); b.onclick = () => { sel.approach = k; rerender(); }; ap.appendChild(b); }
  body.appendChild(ap);
  const cost = C.base + C.features.filter(f => sel.features.includes(f.id)).reduce((a, f) => a + f.parts, 0);
  const a = affordable(cost);
  const foot = el('div', { class: 'pfoot' });
  foot.appendChild(el('span', { class: 'muted' }, `Cost: ${costLine(cost)}.`));
  const go = el('button', { class: 'btn primary' }, a.ok ? 'Build it' : `Need ${cost} parts`);
  go.disabled = !a.ok;
  go.onclick = () => startCreation(cid, sel.style, sel.features.slice(), sel.approach, cost);
  foot.appendChild(go);
  body.appendChild(foot);
  requestAnimationFrame(() => previewCreation(prev, cid, sel));
}
function previewCreation(canvas, cid, sel) {
  const L = LOTS[CREATIONS[cid].lot];
  const pc = canvas.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 360, h = canvas.clientHeight || 220;
  canvas.width = w * d; canvas.height = h * d;
  const fake = { status: 'built', style: sel.style, features: sel.features, stories: [] };
  const saved = ctx, savedC = S.creations[cid], savedG = GRADE;
  ctx = pc; S.creations[cid] = fake; GRADE = 20;
  try {
    const cx = L.x + L.w / 2, cy = L.y + L.d / 2 - 20;
    const sc = Math.min(w / (L.w + 120), h / (L.d + 170)) * d;
    pc.setTransform(sc, 0, 0, sc, w * d / 2 - cx * sc, h * d / 2 - cy * sc);
    pc.fillStyle = '#86b85c'; pc.fillRect(L.x - 200, L.y - 300, L.w + 400, L.d + 500);
    if (cid === 'kitchen') { drawLotsGround(); drawKitchenBack(fake); if (fake.features.includes('table')) drawKitchenTable(fake); if (fake.features.includes('herbs')) drawHerbs(fake); }
    if (cid === 'garden') drawGarden(fake);
    if (cid === 'pavilion') drawPavilion(fake);
  } finally { ctx = saved; S.creations[cid] = savedC; GRADE = savedG; LIGHTS.length = 0; }
}
function startCreation(cid, style, features, approach, cost) {
  const c = S.creations[cid], C = CREATIONS[cid];
  if (!affordable(cost).ok) return;
  spendParts(cost);
  Object.assign(c, { status: 'building', style, features, approach, buildLeft: APPROACHES[approach].nights });
  c.buildTotal = c.buildLeft;
  const styleName = STYLES.find(s => s.id === style).name;
  addStory(c, `Built in the ${styleName.toLowerCase()} style.`);
  for (const f of features) {
    const F = C.features.find(x => x.id === f);
    if (approach === 'hand' && F.who) addStory(c, { oven: 'Teo and Mara laid every brick of the bread oven by hand.', table: 'Odile sanded the long table herself and carved the date under it.', herbs: 'Teo planted the herbs and a lemon tree from a cutting of his own.', mural: 'Juno painted the mural over three evenings. Everyone on the street is in it.', bench: 'Juno shaped the sketching bench from a fallen olive branch.', meadow: 'Teo scattered the wildflower seed by hand.', stage: 'Odile built the little stage with the robots and insisted it be exactly knee-high.', racks: 'Teo welded the bike racks from old rail scrap.' }[f] || `${RES[F.who].short} made the ${F.name.toLowerCase()} by hand.`);
  }
  for (const id of RES_IDS) befriend(id, approach === 'robots' ? 2 : approach === 'assist' ? 6 : 9);
  if (approach !== 'robots') for (const id of RES_IDS) if (H(id).stage === 'thriving') H(id).energy = clamp(H(id).energy + 6, 0, 100);
  logEvent(`Started building the ${C.name} (${styleName}, ${APPROACHES[approach].name.toLowerCase()}).`, 'build');
  if (cid === 'kitchen') setQuest('wait_kitchen');
  rebuildColliders(S);
  hooks.sfx('build');
  toast(`The ${C.name} is underway.`, 'good');
  closePanel(); saveGame();
}

function panelMenu(body) {
  body.appendChild(el('p', { class: 'lede' }, `${escapeHtml(S.player.name)} and ${escapeHtml(S.bot.name)}, day ${S.day}. The game saves automatically.`));
  const row = el('div', { class: 'menu' });
  const resume = el('button', { class: 'btn primary' }, 'Resume'); resume.onclick = closePanel;
  const snd = el('button', { class: 'btn' }, S.sound ? 'Sound: on' : 'Sound: off'); snd.onclick = () => { S.sound = !S.sound; Audio2.enable(S.sound); rerender(); };
  const over = el('button', { class: 'btn danger' }, 'Start over…');
  over.onclick = () => {
    row.innerHTML = '';
    row.appendChild(el('p', {}, 'Start a new game? Your current town will be erased.'));
    const yes = el('button', { class: 'btn danger' }, 'Yes, start over'); yes.onclick = () => { wipeSave(); location.reload(); };
    const no = el('button', { class: 'btn' }, 'Keep playing'); no.onclick = () => rerender();
    row.appendChild(yes); row.appendChild(no);
  };
  row.append(resume, snd, over);
  body.appendChild(row);
  body.appendChild(el('div', { class: 'help' }, `<h4>Controls</h4><p>Move: WASD / arrow keys, or click or tap the ground. Talk and interact: <kbd>E</kbd>, <kbd>Space</kbd>, or tap a person or place. Panels: <kbd>L</kbd> Ledger, <kbd>N</kbd> Notebook, <kbd>B</kbd> Projects, <kbd>Esc</kbd> close. Time: <kbd>P</kbd> pause, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> speed, <kbd>Z</kbd> next morning. Zoom: mouse wheel or the +/− keys.</p>`));
}

function panelMorning(body, head) {
  const r = S.lastReport;
  head.querySelector('h2').textContent = `Morning, day ${S.day}`;
  const w = WEATHER[S.weather];
  body.appendChild(el('p', { class: 'lede' }, `${WEEKDAYS[weekdayIdx(S.day)]}. ${w.name}${S.weather !== 'sunny' ? `: solar output will be about ${Math.round(w.solar * 100)}% today` : ''}.`));
  if (r) {
    const evs = r.events.slice();
    if (evs.length) body.appendChild(el('ul', { class: 'events' }, evs.map(e => `<li>${escapeHtml(e)}</li>`).join('')));
    const pr = Object.entries(r.projects);
    if (pr.length) {
      let t = '<table class="bills"><tbody>';
      for (const [pid, e] of pr) t += `<tr><td>${PROJECTS[pid].name} earned</td><td class="num">${fmtMoney(e.net)} net</td></tr>`;
      if (r.fund > 0.5) t += `<tr><td>Commons Fund received</td><td class="num">+${fmtMoney(r.fund)}</td></tr>`;
      if (r.parts) t += `<tr><td>Workshop made parts</td><td class="num">+${r.parts}</td></tr>`;
      t += '</tbody></table>';
      body.appendChild(el('div', {}, `<h4>Yesterday</h4>${t}`));
    }
    if (!evs.length && !pr.length) body.appendChild(el('p', { class: 'muted' }, 'A quiet night. The town sleeps, then wakes.'));
  }
  const b = el('button', { class: 'btn primary' }, 'Start the day'); b.onclick = closePanel;
  body.appendChild(el('div', { class: 'pfoot' })).appendChild(b);
}

// ----- cutscenes -----
function afterlightCutscene() {
  S.flags.afterlightPending = false;
  UI.cutscene = true;
  const ov = $('#cutscene');
  ov.hidden = false;
  ov.className = 'cutscene afterlight';
  const total0 = RES_IDS.reduce((a, id) => a + (H(id).history[0] ? H(id).history[0].work : 0), 0);
  ov.innerHTML = `<div class="sweep"></div><div class="cs-inner">
    <p class="eyebrow">Day ${S.day}</p>
    <h1>Afterlight</h1>
    <p>For the first time, nobody on this street needs a job to cover the essentials.</p>
    <p>Rent, food, power and repairs are paid for by things the neighbors built and own together. That is ${fmtHours(total0)} of paid work a day the street no longer has to do.</p>
    <p class="q">So what do people do with a life they finally have time to live?</p>
    <button class="btn primary" id="cs-go">Find out</button></div>`;
  hooks.sfx('afterlight');
  for (let i = 0; i < 80; i++) setTimeout(() => spawn('confetti', S.player.x + (Math.random() - 0.5) * 500, S.player.y - 300, { vx: (Math.random() - 0.5) * 60, vy: 20, life: 4, c: ['#ffd36a', '#ff9a6a', '#9fe0ff', '#ffb0d0', '#9cc46a'][i % 5] }), i * 30);
  $('#cs-go').onclick = () => { ov.hidden = true; UI.cutscene = false; boltSay('Some of them will rest. Some will start things. Let’s go see.', 6); saveGame(); };
}

function startBreakfast() {
  UI.breakfast = true;
  const seats = { mara: { x: 1400, y: 684 }, teo: { x: 1470, y: 684 }, juno: { x: 1420, y: 700 }, odile: { x: 1490, y: 700 } };
  for (const id of RES_IDS) {
    const n = NPCS[id];
    n.override = { act: 'breakfast', at: seats[id], pose: 'sit', until: S.minute + 180 };
    n.x = seats[id].x; n.y = seats[id].y; n.visible = true; n.path = []; n.key = '';
    n.facing = seats[id].x < 1440 ? 1 : -1;
  }
  S.player.x = 1440; S.player.y = 724; S.player.path = null;
  S.bot.x = 1480; S.bot.y = 730;
  const k = S.creations.kitchen;
  const lines = [
    L('narr', 'One by one, they come up the terrace steps. Pip carries the jam like it’s a crown.', null),
    L('mara', k.features.includes('oven') ? 'First bread from the big oven. Careful, it’s still hot. Cardamom and orange, like my grandmother made.' : 'I baked at home and carried it over. Cardamom and orange, like my grandmother made.', 'happy'),
    L('teo', 'Mara. This bread. I would drive twelve hours for this bread. I would not, actually. Never again. But I would think about it.', 'happy'),
    L('odile', 'The good jam, as promised. Apricot. I closed the store for this. Nobody died.', 'happy'),
    L('juno', 'Nobody move. I’m drawing this. Okay, move, eat, I’ll draw you eating.', 'happy'),
    L('mara', `You know what I keep thinking? A month ago I didn’t know any of you. I knew your faces from the bus stop.`, 'calm'),
    CH(
      { t: 'To the street.', then: [L('teo', 'To the street. And to the robots, who don’t eat, which means more for us.', 'happy')] },
      { t: 'Same time next Sunday?', then: [L('odile', 'Every Sunday. Write it on the notice board. In ink.', 'happy')] },
      { t: 'What should we make next?', then: [L('juno', 'A garden by the waterfall. Somewhere to sit and draw.', 'happy'), L('odile', 'A little stage. For music. For me, specifically.', 'happy')] },
    ),
    L('narr', 'It is not a party, exactly. It is breakfast. People stay long after the bread is gone.', null),
    FX(finishBreakfast),
  ];
  startDialog(lines, null);
  hooks.sfx('chime');
}
function finishBreakfast() {
  S.flags.breakfastDone = true;
  const k = S.creations.kitchen;
  addStory(k, `Day ${S.day}: the first community breakfast. Pip carried the jam.`);
  addStory(k, 'Tradition: breakfast every Sunday. Everyone brings something.');
  logEvent('Hosted the first community breakfast on the terrace.', 'milestone');
  for (const id of RES_IDS) befriend(id, 10);
  S.creations.garden.status = 'available';
  S.creations.pavilion.status = 'available';
  setQuest('epilogue');
  updateWarmthTarget();
  for (let i = 0; i < 60; i++) setTimeout(() => spawn('heart', 1380 + Math.random() * 140, 640 + Math.random() * 40, { vy: -20, life: 2.4 }), i * 40);
  setTimeout(() => { UI.breakfast = false; epilogueCard(); }, 600);
}
function epilogueCard() {
  UI.cutscene = true;
  const ov = $('#cutscene');
  ov.hidden = false; ov.className = 'cutscene epilogue';
  const total0 = RES_IDS.reduce((a, id) => a + (H(id).history[0] ? H(id).history[0].work : 0), 0);
  const inc = RES_IDS.reduce((a, id) => a + incomeOf(id).total, 0);
  ov.innerHTML = `<div class="cs-inner">
    <p class="eyebrow">First neighborhood complete</p>
    <h1>We made room</h1>
    <p>We made enough room in our lives to discover what we actually want to do. And now we get to make a beautiful world together.</p>
    <div class="stats"><div><b>${fmtHours(total0)}</b><span>paid work a day the street no longer needs</span></div><div><b>${fmtMoney(inc)}</b><span>ownership income a day, shared among four households</span></div><div><b>${S.day}</b><span>days in town</span></div></div>
    <p class="muted">Keep playing: build the Waterfall Garden and the Music Pavilion, try different styles, or just watch the town live. Riverside, across the bridge, is waiting for a future update.</p>
    <button class="btn primary" id="cs-go">Keep playing</button></div>`;
  $('#cs-go').onclick = () => { ov.hidden = true; UI.cutscene = false; saveGame(); };
}
