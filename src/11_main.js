// Main loop, input, and test hooks.
// Speeds: sim-hours advanced per real second. 1x = one hour every 10 s, slow enough to watch people walk.
const SPEEDS = [0, 0.1, 12, 120, 600];
const SPEED_LABEL = ['paused', '1 h / 10 s', '1 day / 2 s', '1 month / 6 s', '1 year / 15 s'];
let speed = 1, lastFrame = 0, uiClock = 0;

function setSpeed(i) {
  speed = clamp(i, 0, SPEEDS.length - 1);
  document.querySelectorAll('#speeds button').forEach(b => b.classList.toggle('on', +b.dataset.s === speed));
  $('speedlbl').textContent = SPEED_LABEL[speed];
}
function advance(hours) {
  // fine steps at low speed keep Yuka's steering smooth; coarser steps at high speed keep it fast
  const step = speed <= 1 ? 0.002 : speed === 2 ? 0.05 : speed === 3 ? 0.25 : 0.5;
  let left = hours, n = 0;
  while (left > 1e-9 && n < 60) { const dt = Math.min(step, left); simStep(dt); left -= dt; n++; }
}

function frame(now) {
  const dtMs = Math.min(100, now - (lastFrame || now));
  lastFrame = now;
  if (speed > 0) { const hrs = SPEEDS[speed] * dtMs / 1000; advance(hrs); stepCars(Math.min(hrs, 0.1)); }
  draw(now);
  tickBanners(dtMs);
  uiClock -= dtMs;
  if (uiClock <= 0) { uiClock = 250; refreshUI(); }
  requestAnimationFrame(frame);
}
function refreshUI() {
  const d = dateLabel(S.t);
  $('date').textContent = d.text; $('clock').textContent = d.clock;
  renderStats(); renderFeed(); renderYou(); drawChart(); syncCars();
  $('era').textContent = eraName();
  const st = $('stats'), top = st.offsetTop + st.offsetHeight + 8;
  for (const id of ['feed', 'inspect']) { const el = $(id); el.style.top = top + 'px'; el.style.maxHeight = `calc(100vh - ${top}px - 184px)`; }
  if (!document.activeElement || !$('inspect').contains(document.activeElement)) renderInspect();
}

function zoomPreset(which) {
  cam.follow = null;
  if (which === 'region') { cam.tx = MAP_W / 2; cam.ty = MAP_H / 2; cam.tz = minZoom(); }
  if (which === 'town') { cam.tx = 560; cam.ty = 360; cam.tz = Math.max(minZoom(), Math.min(W / 520, H / 380)); }
  if (which === 'you') { cam.follow = S.player; cam.tz = 30; }
}

function pickAt(sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  const r = Math.max(0.6, 7 / cam.z);
  let best = null, bd = r;
  for (const p of S.people) { const d = Math.hypot(p.position.x - wx, p.position.y - wy); if (d < bd) { bd = d; best = p; } }
  if (best) return { agent: best };
  const site = S.sites.slice().reverse().find(s => s.kind !== 'roofs' && wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h);
  if (site) return { site };
  const lot = S.lots.find(l => !l.site && wx >= l.x && wx <= l.x + l.w && wy >= l.y && wy <= l.y + l.h);
  return lot ? { lot } : {};
}

function setupInput() {
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: cam.tx, cy: cam.ty, moved: false }; canvas.setPointerCapture(e.pointerId); hideMenu(); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { cam.follow = null; cam.tx = drag.cx - dx / cam.z; cam.ty = drag.cy - dy / cam.z; cam.x = cam.tx; cam.y = cam.ty; }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && !drag.moved) {
      const hit = pickAt(e.clientX, e.clientY);
      view.selected = hit.agent || null; view.selSite = hit.site || null; view.selLot = hit.lot || null;
      renderInspect();
    }
    drag = null;
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const [wx, wy] = s2w(e.clientX, e.clientY);
    const nz = clamp(cam.tz * Math.pow(1.0018, -e.deltaY), minZoom(), 80);
    // keep the point under the cursor fixed
    cam.follow = null;
    cam.tx = wx - (e.clientX - W / 2) / nz; cam.ty = wy - (e.clientY - H / 2) / nz; cam.tz = nz;
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); }
    if (e.key >= '0' && e.key <= '4') setSpeed(+e.key);
    if (e.key === '+' || e.key === '=') cam.tz = clamp(cam.tz * 1.25, minZoom(), 80);
    if (e.key === '-') cam.tz = clamp(cam.tz / 1.25, minZoom(), 80);
    if (e.key === 'Escape') { view.selected = null; view.selSite = null; view.selLot = null; hideMenu(); renderInspect(); $('help').hidden = true; }
  });
  document.querySelectorAll('#speeds button').forEach(b => b.onclick = () => setSpeed(+b.dataset.s));
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { view.colorBy = b.dataset.c; document.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
  document.querySelectorAll('[data-z]').forEach(b => b.onclick = () => zoomPreset(b.dataset.z));
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (!$('menu').hidden && $('menu').dataset.a === b.dataset.a) { hideMenu(); return; } $('menu').dataset.a = b.dataset.a; showMenu(b.dataset.a, b); });
  $('btn-help').onclick = () => { $('help').hidden = false; };
  $('help-close').onclick = () => { $('help').hidden = true; try { localStorage.setItem('al-sim-help', '1'); } catch (e) { } };
  window.addEventListener('resize', resize);
}

function boot() {
  canvas = $('world'); ctx = canvas.getContext('2d');
  newWorld(+(new URLSearchParams(location.search).get('seed') || 7));
  resize(); bakeTerrain(); setupInput(); buildLegend();
  zoomPreset('town'); cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz;
  setSpeed(1);
  let seen = false; try { seen = !!localStorage.getItem('al-sim-help'); } catch (e) { }
  if (!seen && !/test/.test(location.search)) $('help').hidden = false;
  refreshUI();
  requestAnimationFrame(frame);
}

// Hooks for automated tests and for poking at the sim from the console.
window.__SIM = {
  get S() { return S; }, metrics, Mind,
  step(days, dt = 0.5) { const n = Math.round(days * 24 / dt); for (let i = 0; i < n; i++) simStep(dt); refreshUI(); },
  setSpeed, zoomPreset, discover: id => discover(id),
  zoomTo(x, y, z) { cam.follow = null; cam.tx = cam.x = x; cam.ty = cam.y = y; cam.tz = cam.z = z; },
  follow(id) { const p = S.people.find(q => q.id === id) || S.player; cam.follow = p; cam.x = p.position.x; cam.y = p.position.y; },
  selectLot(i) { view.selected = null; view.selSite = null; view.selLot = __SIM.S.lots[i]; renderInspect(); },
  select(id) { if (id == null) { view.selected = null; view.selSite = null; view.selLot = null; renderInspect(); return; } view.selected = S.people.find(q => q.id === id) || null; view.selSite = view.selected ? null : S.sites.find(s => s.id === id || s.name === id) || null; view.selLot = null; renderInspect(); },
  act: (name, ...args) => ACTIONS[name](...args), refreshUI,
};
boot();
