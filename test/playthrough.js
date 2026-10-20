// End-to-end playthrough: drives the real UI (dialogue, workbench, meetings, panels,
// next-morning) and uses a teleport hook only to skip walking between places.
// Usage: OPTION=equal|need|odile|brightline node test/playthrough.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OPTION = process.env.OPTION || 'equal';
const OUT = process.env.OUT || `/tmp/claude-0/play-${OPTION}`;
const W = +(process.env.VW || 1280), Hh = +(process.env.VH || 800);
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: Hh } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html'));
  await page.waitForTimeout(800);
  let shot = 0;
  const snap = async name => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, '0')}_${name}.png` }); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const state = () => ev(() => ({ day: __AL.S.day, minute: Math.round(__AL.S.minute), quest: __AL.S.quest, parts: __AL.S.parts, fund: Math.round(__AL.S.fund), warmth: +__AL.S.warmth.toFixed(2) }));
  const visible = sel => page.$eval(sel, e => !e.hidden).catch(() => false);

  let menuTurns = 0;
  async function finishDialog(pickFn) {
    for (let i = 0; i < 80; i++) {
      if (!(await visible('#dialog'))) return;
      const choices = await page.$$('.choice');
      if (choices.length) {
        const texts = await Promise.all(choices.map(c => c.innerText()));
        const bye = texts.findIndex(x => x.includes('See you around'));
        let idx = pickFn ? pickFn(texts) : 0;
        if (bye >= 0) { idx = menuTurns++ % 2 === 0 ? (menuTurns % 3) : bye; }
        if (idx < 0 || idx >= choices.length) idx = 0;
        await choices[idx].click();
      } else await page.keyboard.press('e');
      await page.waitForTimeout(40);
    }
    throw new Error('dialog did not finish');
  }
  async function settle() {
    for (let i = 0; i < 6; i++) {
      if (await visible('#cutscene')) { await snap('cutscene'); await page.click('#cs-go'); await page.waitForTimeout(200); continue; }
      const kind = await ev(() => __AL.UI.panel && __AL.UI.panel.kind);
      if (kind === 'morning') { await page.click('#panel .pfoot .btn.primary'); await page.waitForTimeout(250); continue; }
      if (kind) { await page.click('#panel .close'); await page.waitForTimeout(100); continue; }
      if (await visible('#dialog')) { await finishDialog(); continue; }
      return;
    }
  }
  async function useAt(type, id) {
    await settle();
    const it = await ev(([t, i]) => { const x = __AL.near(t, i); return x ? x.label : null; }, [type, id]);
    if (!it) throw new Error(`nothing to interact with: ${type} ${id}`);
    await page.waitForTimeout(80);
    const label = await ev(() => __AL.UI.nearby && __AL.UI.nearby.label);
    await page.keyboard.press('e');
    await page.waitForTimeout(200);
    return label;
  }
  async function waitVisible(id, maxGameMin = 900) {
    for (let i = 0; i < 400; i++) {
      if (await ev(i => __AL.NPCS[i].visible, id)) return true;
      // try knocking first
      const door = await ev(i => __AL.interactables().find(x => x.type === 'door' && x.id === i), id);
      if (door) { try { await useAt('door', id); } catch (e) { continue; } await page.waitForTimeout(700); if (await visible('#dialog')) return 'dialog'; }
      await ev(() => { __AL.S.speed = 3; __AL.S.paused = false; });
      await page.waitForTimeout(300);
    }
    return false;
  }
  async function talk(id, pickFn) {
    await settle();
    for (let attempt = 0; attempt < 4; attempt++) {
      const v = await waitVisible(id);
      if (v === 'dialog') break;
      if (!v) throw new Error(id + ' never appeared');
      try { await useAt('npc', id); } catch (e) { continue; }
      if (await visible('#dialog')) break;
    }
    const first = await page.$eval('#dlg-text', e => e.innerText).catch(() => '');
    await finishDialog(pickFn);
    return first;
  }
  async function nextMorning() {
    await settle();
    await page.click('#btn-morning');
    await page.waitForTimeout(700);
    await settle();
  }
  async function workbenchDraft(styleIdx) {
    await useAt('workbench');
    if (styleIdx !== undefined) { const st = await page.$$('#panel .style'); if (st[styleIdx]) await st[styleIdx].click(); await page.waitForTimeout(80); }
    await snap('workbench');
    await page.click('#panel .btn.primary');
    await page.waitForTimeout(150);
  }
  async function meeting(option, approach = 'robots') {
    await useAt('notice');
    const opts = await page.$$('#panel .options:not(.two) .option');
    const names = await Promise.all(opts.map(o => o.innerText()));
    const want = { equal: 'Neighborhood co-op', need: 'weighted by need', odile: "Odile's investment", brightline: 'Brightline' }[option];
    const idx = names.findIndex(n => n.includes(want));
    await opts[idx >= 0 ? idx : 0].click();
    await page.waitForTimeout(80);
    const ap = await page.$$('#panel .options.two .option');
    await ap[approach === 'robots' ? 0 : 1].click();
    await page.waitForTimeout(80);
    await snap('meeting-' + option);
    const btn = await page.$('#panel .pfoot .btn.primary');
    const disabled = await btn.isDisabled();
    if (disabled) { const t = await btn.innerText(); await page.click('#panel .close'); return 'blocked: ' + t; }
    await btn.click();
    await page.waitForTimeout(150);
    return 'ok';
  }
  async function salvage(key) { await useAt('salvage', key); await finishDialog(); }
  async function buyUpgrades() {
    const bought = [];
    for (const pid of ['solar', 'workshop', 'greenhouse']) {
      const on = await ev(p => __AL.S.projects[p].status === 'online', pid);
      if (!on) continue;
      await useAt('site', pid);
      const rep = await page.$('#panel .pcard.warn .btn.primary');
      if (rep && !(await rep.isDisabled())) { await rep.click(); bought.push('repair'); await page.waitForTimeout(100); }
      for (;;) {
        const btns = await page.$$('#panel .ups .btn');
        let clicked = false;
        for (const b of btns) { const t = await b.innerText(); if (t.startsWith('Build') && !(await b.isDisabled())) { await b.click(); bought.push(pid + ':' + t); clicked = true; await page.waitForTimeout(100); break; } }
        if (!clicked) break;
      }
      await page.click('#panel .close');
      await page.waitForTimeout(80);
    }
    return bought;
  }
  const econ = () => ev(() => __AL.econ());
  const fmtE = e => e.map(x => `${x.id}:${x.work}h(${x.stage[0]}) inc$${x.inc} exp$${x.exp} E${x.energy}`).join(' | ');

  // ---------- play ----------
  await page.click('#t-new');
  await page.fill('#cc-name', 'Ren');
  await page.click('.chips [data-v="curly"]');
  await page.click('#cc-go');
  await page.waitForTimeout(900);
  await snap('arrival');
  await finishDialog();
  // meet everyone
  await page.waitForTimeout(2500);
  await snap('dusk-commute');
  for (const id of ['mara', 'teo', 'juno', 'odile']) { const t = await talk(id); log('met', id, '-', t.slice(0, 70)); }
  log('after meeting:', JSON.stringify(await state()));
  if ((await state()).quest !== 'idea_solar') throw new Error('expected idea_solar');
  // Juno's leaf design
  const jl = await talk('juno');
  log('juno 2nd talk:', jl.slice(0, 60));
  await workbenchDraft(OPTION === 'equal' ? 2 : 0);
  log('drafted:', JSON.stringify(await state()), await ev(() => __AL.S.projects.solar.style));
  // meeting before salvage should be blocked for co-op
  let r = await meeting(OPTION);
  log('meeting attempt 1:', r);
  if (r !== 'ok') { await salvage('depot'); log('salvaged depot', JSON.stringify(await state())); r = await meeting(OPTION, OPTION === 'need' ? 'together' : 'robots'); log('meeting attempt 2:', r); }
  if (r !== 'ok') throw new Error('could not decide solar');
  await snap('solar-building');
  await nextMorning();
  if (OPTION === 'need') await nextMorning();
  log('day', (await state()).day, 'solar', await ev(() => __AL.S.projects.solar.status), JSON.stringify(await state()));
  await snap('solar-online');
  await ev(() => __AL.teleport(1520, 1400));
  await snap('solar-view');
  // ledger
  await page.keyboard.press('l'); await page.waitForTimeout(300); await snap('ledger-households');
  await page.click('#panel .tab:nth-child(3)'); await page.waitForTimeout(200); await snap('ledger-flow');
  await page.click('#panel .close');
  log('after ledger:', JSON.stringify(await state()), fmtE(await econ()));
  // reactions + Teo's van
  for (const id of ['mara', 'odile']) log(id, 'says:', (await talk(id)).slice(0, 80));
  const tv = await talk('teo'); log('teo van:', tv.slice(0, 60), (await state()).quest);
  if ((await state()).quest !== 'idea_workshop') throw new Error('expected idea_workshop');
  await workbenchDraft(0);
  for (const k of ['garage', 'tower', 'river']) await salvage(k);
  log('parts before workshop', JSON.stringify(await state()));
  r = await meeting(OPTION === 'brightline' ? 'equal' : OPTION);
  log('workshop meeting:', r);
  if (r !== 'ok') { await nextMorning(); r = await meeting(OPTION === 'brightline' ? 'equal' : OPTION); log('retry', r); }
  await nextMorning();
  log('workshop:', await ev(() => __AL.S.projects.workshop.status), JSON.stringify(await state()), fmtE(await econ()));
  await ev(() => __AL.teleport(1720, 1080)); await snap('workshop');
  // greenhouse
  const tg = await talk('teo'); log('teo garden:', tg.slice(0, 60), (await state()).quest);
  await workbenchDraft(0);
  await salvage('frames');
  for (let d = 0; d < 6; d++) {
    r = await meeting(OPTION === 'odile' ? 'equal' : OPTION === 'need' ? 'need' : 'equal');
    log('greenhouse meeting day', (await state()).day, r, 'parts', (await state()).parts);
    if (r === 'ok') break;
    await nextMorning();
  }
  await nextMorning();
  log('greenhouse:', await ev(() => __AL.S.projects.greenhouse.status), JSON.stringify(await state()), fmtE(await econ()));
  await ev(() => __AL.teleport(960, 1460)); await snap('greenhouse');
  // talk to people for ideas (battery, bikes, aqua, bay) and cover essentials
  for (const id of ['mara', 'teo', 'juno', 'odile']) log(id, ':', (await talk(id)).slice(0, 70));
  for (let d = 0; d < 14; d++) {
    const b = await buyUpgrades();
    // optional side project: Community Compute (Juno's idea)
    const cst = await ev(() => __AL.S.projects.compute.status);
    if (cst === 'locked') await talk('juno');
    else if (cst === 'idea') { await workbenchDraft(); log('compute drafted'); }
    if ((await ev(() => __AL.S.projects.compute.status)) === 'drafted') log('compute meeting:', await meeting(OPTION));
    if (await ev(() => __AL.objectives().some(o => o.text.startsWith('Odile wants')))) { log('odile share beat:', (await talk('odile')).slice(0, 60)); }
    if (await ev(() => __AL.objectives().some(o => o.text.startsWith('Buy back')))) {
      await useAt('notice');
      const bb = await page.$('#panel .pcard .btn.primary');
      if (bb && !(await bb.isDisabled())) { await bb.click(); log('bought back', await ev(() => Object.keys(__AL.S.flags).filter(k => k.startsWith('bought_')).join(','))); }
      await settle();
    }
    log(`day ${(await state()).day} upgrades:`, b.join(', ') || '-', '|', fmtE(await econ()), '| parts', (await state()).parts, 'fund', (await state()).fund);
    if ((await state()).quest !== 'cover') break;
    await nextMorning();
  }
  log('quest now', (await state()).quest, 'day', (await state()).day);
  if ((await state()).quest !== 'freedom') throw new Error('never covered everyone');
  await snap('after-afterlight');
  // first free days
  const picks = { mara: t => t.findIndex(x => x.includes('baking')), teo: t => t.findIndex(x => x.includes('artichokes')), juno: t => t.findIndex(x => x.includes('waterfall')), odile: () => 0 };
  for (let d = 0; d < 6; d++) {
    for (const id of ['mara', 'teo', 'juno', 'odile']) {
      const need = await ev(i => !__AL.S.seen['free_' + i], id);
      if (need) log(' free talk', id, (await talk(id, picks[id])).slice(0, 60));
    }
    if (await ev(() => __AL.S.creations.kitchen.status === 'teased')) { log(' mara kitchen:', (await talk('mara')).slice(0, 60)); }
    log(`day ${(await state()).day}`, fmtE(await econ()), 'kitchen', await ev(() => __AL.S.creations.kitchen.status), 'quest', (await state()).quest);
    if ((await state()).quest === 'kitchen') break;
    await nextMorning();
    await ev(() => __AL.teleport(1150, 900)); await page.waitForTimeout(400);
  }
  await snap('town-free-days');
  if ((await state()).quest !== 'kitchen') throw new Error('kitchen never proposed');
  // plan the kitchen
  await useAt('creation', 'kitchen');
  await page.click('#panel .creator-grid .options .option:nth-child(1)');
  const feats = await page.$$('#panel .feat');
  for (const f of feats) { if (!(await f.getAttribute('class')).includes('on')) await f.click(); }
  const aps = await page.$$('#panel .options.three .option');
  await aps[2].click();
  await page.waitForTimeout(300);
  await snap('kitchen-planner');
  const kbDisabled = async () => { const b = await page.$('#panel .pfoot .btn.primary'); return !b || await b.isDisabled(); };
  for (let d = 0; d < 6 && await kbDisabled(); d++) { await page.click('#panel .close'); await nextMorning(); await useAt('creation', 'kitchen'); }
  await page.click('#panel .pfoot .btn.primary');
  log('kitchen building', JSON.stringify(await state()));
  for (let d = 0; d < 4 && (await state()).quest !== 'breakfast'; d++) await nextMorning();
  await ev(() => __AL.teleport(1440, 760)); await snap('kitchen-built');
  log('breakfast objective:', JSON.stringify(await ev(() => __AL.objectives()[0])));
  await useAt('breakfast');
  await page.waitForTimeout(300);
  await snap('breakfast');
  await finishDialog(t => t.findIndex(x => x.includes('next Sunday')));
  await page.waitForTimeout(900);
  await snap('epilogue');
  log('ENDING:', await page.$eval('#cutscene h1', e => e.innerText).catch(() => '?'), '|', await page.$eval('#cutscene .cs-inner', e => e.innerText.split('\n').slice(1,8).join(' / ')).catch(() => ''));
  await settle();
  log('final', JSON.stringify(await state()), fmtE(await econ()));
  // save + reload restores
  const before = await state();
  await page.reload(); await page.waitForTimeout(900);
  const cont = await page.$('#t-continue');
  log('continue button:', cont ? await cont.innerText() : 'missing');
  await page.click('#t-continue'); await page.waitForTimeout(500);
  const after = await state();
  log('reload restored day/quest:', before.day === after.day && before.quest === after.quest, JSON.stringify(after));
  await ev(() => __AL.teleport(1150, 880)); await ev(() => { __AL.S.minute = 18 * 60 + 30; }); await page.waitForTimeout(1500); await snap('final-evening');
  await ev(() => { __AL.S.minute = 10 * 60; }); await page.waitForTimeout(800); await snap('final-day');
  log(errors.length ? 'ERRORS:\n' + errors.slice(0, 10).join('\n') : 'NO ERRORS');
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
