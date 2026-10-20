// Playwright smoke test: runs ~3 in-game years at speed, exercises every player action,
// fails on any console/page error, and saves screenshots (zoomed out, zoomed in, inspector, discovery).
// NODE_PATH=/workspace/pw/node_modules OUT=/workspace/sim-shots node test/smoke.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, '../shots');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, name) }); console.log('shot', name); };
  const ev = (f, ...a) => page.evaluate(f, ...a);

  await page.goto('file://' + path.resolve(__dirname, '../dist/index.html') + '?test=1');
  await page.waitForTimeout(1500);
  await shot('01_town_start.png');
  await page.click('[data-z="region"]'); await page.waitForTimeout(900);
  await shot('02_region_start.png');

  // real-time at 1x for a few seconds: people should walk
  await page.click('[data-z="town"]');
  const before = await ev(() => __SIM.S.people.map(p => [p.position.x, p.position.y]));
  await page.waitForTimeout(4000);
  const after = await ev(() => __SIM.S.people.map(p => [p.position.x, p.position.y]));
  const moved = before.filter((b, i) => Math.hypot(b[0] - after[i][0], b[1] - after[i][1]) > 0.5).length;
  console.log('people who moved in 4s at 1x:', moved, '/', before.length);

  // player actions through the UI
  await page.click('[data-a="propose"]'); await page.waitForTimeout(200);
  await page.click('#menu button:nth-child(1)');
  const targets = await ev(() => __SIM.S.people.filter(p => !p.isPlayer && p.age === 'adult').slice(0, 6).map(p => p.id));
  await ev(() => __SIM.step(1));
  for (const id of targets.slice(0, 3)) { await ev(id => { __SIM.act('persuade', id, 'community'); __SIM.step(0.3, 0.05); }, id); }
  await ev(() => __SIM.step(2));
  await ev(() => __SIM.act('invest', 'coop', 4000));
  await ev(() => __SIM.step(3));

  // zoomed-in: follow a resident mid-walk, with the inspector open
  await ev(() => { __SIM.setSpeed(1); const p = __SIM.S.people.find(q => !q.isPlayer && q.age === 'adult' && q.moving) || __SIM.S.people[2]; __SIM.select(p.id); __SIM.follow(p.id); __SIM.zoomTo(p.position.x, p.position.y, 34); __SIM.follow(p.id); });
  await page.waitForTimeout(2500);
  await shot('03_zoomed_in_person.png');
  await ev(() => { const s = __SIM.S.sites.find(x => x.name === 'Valley Compute'); __SIM.select(s.id); __SIM.zoomTo(s.cx, s.cy + 2, 16); });
  await shot('04_inspect_site.png');

  // real loop at the fastest speed for a while
  const d0 = await ev(() => __SIM.S.day);
  await ev(() => { __SIM.zoomPreset('town'); __SIM.setSpeed(4); });
  await page.waitForTimeout(8000);
  const d1 = await ev(() => __SIM.S.day);
  console.log('days advanced in 8s at YEAR speed:', d1 - d0);
  await ev(() => __SIM.setSpeed(0));

  // run to ~3 years with a mix of actions
  const plan = [
    () => __SIM.act('council', 'refusal'),
    () => __SIM.act('build', 'rooftop'),
    () => { const t = __SIM.S.people.filter(p => !p.isPlayer && p.age === 'adult'); __SIM.act('persuade', t[5].id, 'nation'); },
    () => __SIM.act('propose', 'compute'),
    () => __SIM.act('invest', 'coop', __SIM.S.player.home.cash * 0.5),
    () => __SIM.act('build', 'robot'),
    () => { const t = __SIM.S.people.filter(p => !p.isPlayer && p.age === 'adult'); __SIM.act('share', t[1].id); },
    () => __SIM.act('council', 'buyback'),
    () => __SIM.act('propose', 'fleet'),
    () => __SIM.act('invest', 'buyout', __SIM.S.player.home.cash * 0.3),
    () => __SIM.act('council', 'dividend'),
  ];
  let i = 0;
  while ((await ev(() => __SIM.S.day)) < 3 * 360) {
    const f = plan[i % plan.length]; i++;
    await page.evaluate(`(${f.toString()})()`);
    await ev(() => __SIM.step(30));
    if (i === 6) {
      await ev(() => __SIM.zoomPreset('region')); await page.waitForTimeout(900);
      await shot('05_region_midgame.png');
    }
  }
  // a discovery, as the player sees it
  await ev(() => { __SIM.zoomPreset('town'); __SIM.setSpeed(1); __SIM.discover(); });
  await shot('06_discovery_banner.png');
  await ev(() => { document.querySelector('[data-c="stake"]').click(); });
  await shot('07_town_year3_stake_colors.png');
  await ev(() => { document.querySelector('[data-c="loyalty"]').click(); const p = __SIM.S.people.find(q => q.kind === 'work' || q.kind === 'volunteer') || __SIM.S.people[0]; __SIM.select(p.id); __SIM.zoomTo(p.position.x, p.position.y, 24); __SIM.follow(p.id); });
  await page.waitForTimeout(1500);
  await shot('08_inspect_person_year3.png');

  const summary = await ev(() => {
    const S = __SIM.S, m = __SIM.metrics();
    return { day: S.day, people: S.people.length, robots: Math.round(S.market.nRobots), robotDots: S.robots.length, assets: S.assets.length,
      discoveries: S.discoveries.map(d => d.title), coops: S.coops.map(c => c.name + (c.open ? ' (open)' : c.asset ? ' (built)' : ' (failed)')),
      outside: +m.outside.toFixed(3), gini: +m.gini.toFixed(3), workHrs: +m.work.toFixed(1), shortE: +m.shortE.toFixed(2), shortC: +m.shortC.toFixed(2),
      yourActions: S.actions.length, log: S.log.slice(0, 8).map(l => l.text) };
  });
  console.log(JSON.stringify(summary, null, 1));
  const fails = [];
  if (errors.length) fails.push('errors:\n' + errors.join('\n'));
  if (summary.day < 1080) fails.push('did not reach 3 years');
  if (summary.discoveries.length < 6) fails.push('too few discoveries');
  if (moved < 5) fails.push('people are not moving');
  if (d1 - d0 < 20) fails.push('fast speed too slow');
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS: no console errors');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
