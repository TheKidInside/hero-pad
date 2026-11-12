// Hero Pad: screens and the play loop. Map -> level (one mission of 5+ items) -> level complete.

import { makeStroke, newTrace, copyTrace, feed } from './trace.js';
import { makeMaze, layout, newWalk, copyWalk, walk, cellCenter, wallPath } from './maze.js';
import { buildLevel } from './curriculum.js';
import { WORLDS, WORLD_ORDER, LEVELS_PER_WORLD, STARS_TO_UNLOCK, OPEN_NEXT_WORLD_AT, levelSpec, levelKey, levelOpen, worldOpen, currentLevel, starsOf, totalStars, nextLevel } from './levels.js';
import { HEROES, heroSVG, goalStar, backdrop, worldScene, WORLD_THEME } from './art.js';
import { Ink } from './ink.js';
import * as sfx from './audio.js';
import { load, save } from './storage.js';

const VERSION = 'v4';

const TOL = { wide: 80, medium: 60, tight: 45 };   // corridor half-width, stage units
const OFF_INK = '#b8bdc9';                          // ink colour while off the road
const STEP = 4;                                     // pen points are densified to this spacing
const HERO_LIFT = 100;                              // stage units the hero stands above the road

const $ = s => document.querySelector(s);
const screens = { home: $('#home'), play: $('#play'), done: $('#done') };
const stage = $('#stage'), area = $('#area'), canvas = $('#ink');

const data = load();
sfx.setEnabled(data.sound);
const params = new URLSearchParams(location.search);

let lvl = { world: 'web', n: 1 };                   // the level being played
let mission = [], at = 0, item = null, busy = false, openBefore = new Set();
let snap = null, lastFed = null, wobbleAt = 0, nextTimer = null;
let rect = { stage: null, canvas: null };

const spec = () => levelSpec(lvl.world, lvl.n);
const hero = () => HEROES[WORLDS[lvl.world].hero] || HEROES.zip;
const tol = () => TOL[item?.tol] || TOL.wide;

// A world's colours become custom properties on the screen that shows it.
function applyTheme(el, world) {
  const t = WORLD_THEME[world], h = HEROES[WORLDS[world].hero];
  const vars = { page: t.page, tile: t.tile, txt: t.text, sub: t.sub, panel: t.panel, glow: t.glow, edge: t.edge, 'star-off': t.starOff, suit: h.suit };
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(`--${k}`, v);
}

// ---------- screens ----------

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  if (name === 'play') fit();
}

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';

function worldCard(id) {
  const w = WORLDS[id], t = WORLD_THEME[id], open = worldOpen(data, id), cur = currentLevel(data, id);
  const cleared = starsOf(data, id, LEVELS_PER_WORLD) >= STARS_TO_UNLOCK;
  let bubbles = '';
  for (let n = 1; n <= LEVELS_PER_WORLD; n++) {
    const name = levelSpec(id, n).name;
    if (!levelOpen(data, id, n)) { bubbles += `<li aria-label="Level ${n}, locked">${n}</li>`; continue; }
    const cls = starsOf(data, id, n) >= STARS_TO_UNLOCK ? 'done' : n === cur ? 'now' : 'open';
    bubbles += `<li><button class="${cls}" data-world="${id}" data-n="${n}" aria-label="Level ${n}: ${name}">${n}</button></li>`;
  }
  const prev = WORLDS[WORLD_ORDER[WORLD_ORDER.indexOf(id) - 1]];
  const action = open
    ? `<button class="play" data-world="${id}" data-n="${cur}">${cleared ? 'Play the boss again' : `Play level ${cur}`}</button>`
    : `<button class="play locked" disabled>${LOCK} Reach ${prev.name} level ${OPEN_NEXT_WORLD_AT}</button>`;
  return `
    <section class="world" style="--accent:${t.accent};--deep:${t.deep};--pale:${t.pale};--paleText:${t.paleText}">
      <svg class="scene" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${w.name}">${worldScene(id)}</svg>
      <div class="info">
        <div><h2>${w.name}</h2><p>${w.blurb}</p></div>
        <ol class="levels" aria-label="${w.name} levels">${bubbles}</ol>
        ${action}
      </div>
    </section>`;
}

function renderHome() {
  $('#worlds').innerHTML = WORLD_ORDER.map(worldCard).join('');
  $('#star-count').textContent = totalStars(data);
  for (const b of document.querySelectorAll('[data-input]')) {
    const on = b.dataset.input === data.input;
    b.classList.toggle('picked', on);
    b.setAttribute('aria-checked', String(on));
  }
  ink.fingers = data.input === 'finger';
}

$('#worlds').addEventListener('click', e => {
  const b = e.target.closest('[data-world]');
  if (!b || b.disabled) return;
  sfx.unlock();
  startLevel(b.dataset.world, Number(b.dataset.n));
});

$('#input-pick').addEventListener('click', e => {
  const b = e.target.closest('[data-input]');
  if (!b) return;
  sfx.unlock();
  data.input = b.dataset.input;
  save(data);
  renderHome();
  sfx.say(data.input === 'finger' ? 'Finger power!' : 'Pencil power!');
});

function goHome() { leaveMission(); renderHome(); show('home'); }

$('#again').addEventListener('click', () => { sfx.unlock(); startLevel(lvl.world, lvl.n); });
$('#next').addEventListener('click', () => {
  sfx.unlock();
  const nx = nextLevel(data, lvl.world, lvl.n);
  if (nx) startLevel(nx.world, nx.n); else goHome();
});
$('#home-btn').addEventListener('click', goHome);
$('#speak').addEventListener('click', () => { sfx.unlock(); sfx.say(item?.say); });

// Hold the exit button for a moment so a stray tap doesn't end the mission.
(() => {
  const btn = $('#exit');
  let timer = null;
  const stop = () => { clearTimeout(timer); timer = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    clearTimeout(timer);
    btn.classList.add('holding');
    timer = setTimeout(() => { stop(); goHome(); }, 900);
  });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, stop);
})();

// ---------- mission ----------

// Stop anything the old mission still has queued (the pause before the next item).
function leaveMission() {
  clearTimeout(nextTimer);
  nextTimer = null;
  busy = false;
  item = null;
  window.speechSynthesis?.cancel();
}

function startLevel(world, n) {
  leaveMission();
  lvl = { world, n };
  openBefore = openLevels();                  // so the finish screen can say what this level opened
  const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
  mission = buildLevel(world, n, seed);
  at = 0;
  applyTheme(screens.play, world);
  $('#stars').innerHTML = mission.map(() => '<i></i>').join('');
  $('#puzzle').textContent = spec().puzzle;
  $('#skill').textContent = `Skill: ${spec().skill}`;
  show('play');
  startItem();
}

function startItem() {
  const s = mission[at];
  busy = false;
  item = { ...s };
  if (s.kind === 'maze') {
    item.maze = makeMaze(s.cols, s.rows, s.seed);
    item.L = layout(item.maze);
    item.walk = newWalk(item.maze);
  } else {
    item.paths = s.strokes.map(x => makeStroke(x));
    item.trace = newTrace();
    item.total = item.paths.reduce((sum, p) => sum + p.len, 0);
  }
  $('#where').textContent = `${WORLDS[lvl.world].name.toUpperCase()} · LEVEL ${lvl.n} · ${at + 1} OF ${mission.length}`;
  $('#prompt').textContent = s.title;
  ink.clear();
  render();
  updateMeter();
  sfx.say(s.say);
}

// Level progress: finished items plus how far along the current one is.
function updateMeter() {
  let part = 0;
  if (busy) part = 1;
  else if (item?.kind === 'trace') {
    const t = item.trace;
    const before = item.paths.slice(0, t.s).reduce((sum, p) => sum + p.len, 0);
    part = t.done ? 1 : (before + item.paths[t.s].cum[t.idx]) / item.total;
  }
  const pct = Math.round(Math.min(1, (at + part) / mission.length) * 100);
  $('#meter-fill').style.width = `${pct}%`;
  $('#meter').setAttribute('aria-label', `Level progress ${pct} percent`);
  $('#meter-text').textContent = pct >= 100 ? 'All done!' : `${pct}% - keep going!`;
}

function openLevels() {
  const s = new Set();
  for (const w of WORLD_ORDER) for (let i = 1; i <= LEVELS_PER_WORLD; i++) if (levelOpen(data, w, i)) s.add(levelKey(w, i));
  return s;
}

function itemDone() {
  busy = true;
  const rec = data.items[item.id] || (data.items[item.id] = { stars: 0 });
  rec.stars += 1;
  // A level remembers its best attempt: how many items were finished.
  const key = levelKey(lvl.world, lvl.n), lrec = data.levels[key] || (data.levels[key] = { stars: 0 });
  lrec.stars = Math.max(lrec.stars, at + 1);
  save(data);
  updateMeter();
  $('#stars').children[at]?.classList.add('on');
  stage.querySelector('#hero .bob')?.classList.add('cheer');
  sfx.fanfare();
  nextTimer = setTimeout(() => {
    nextTimer = null;
    at += 1;
    if (at < mission.length) startItem();
    else missionDone();
  }, 1600);
}

function missionDone() {
  data.missions += 1;
  const before = openBefore;
  save(data);
  applyTheme(screens.done, lvl.world);
  $('#done-hero').innerHTML = heroSVG(WORLDS[lvl.world].hero);
  $('#done-stars').innerHTML = mission.map(() => '<i class="on"></i>').join('');
  const boss = spec().boss, nx = nextLevel(data, lvl.world, lvl.n);
  $('#done-title').textContent = boss ? 'Boss beaten!' : 'Level complete!';
  const fresh = [];
  for (const w of WORLD_ORDER) for (let i = 1; i <= LEVELS_PER_WORLD; i++) {
    if (levelOpen(data, w, i) && !before.has(levelKey(w, i))) fresh.push(i === 1 ? `${WORLDS[w].name} is open` : `Level ${i} is open`);
  }
  $('#done-sub').textContent = `${WORLDS[lvl.world].name}, level ${lvl.n}: ${spec().name.replace(/^Boss: /, '')}${fresh.length ? '. ' + fresh.join('. ') + '!' : ''}`;
  $('#next').hidden = !nx;
  $('#next').textContent = nx && nx.world !== lvl.world ? `Go to ${WORLDS[nx.world].name}` : 'Next level';
  show('done');
  sfx.fanfare();
  sfx.say(`${boss ? 'Boss beaten' : 'Level complete'}! Great job, ${hero().name}!`);
}

// ---------- drawing the stage ----------

function pathD(pts, every = 3) {
  let d = '';
  for (let i = 0; i < pts.length; i += every) d += `${i ? 'L' : 'M'}${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  const last = pts[pts.length - 1];
  return d + `L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

function arrows(st) {
  let s = '';
  for (let d = 70; d < st.len - 60; d += 150) {
    const i = st.cum.findIndex(c => c >= d), j = Math.min(i + 3, st.pts.length - 1);
    const [x, y] = st.pts[i], [x2, y2] = st.pts[j];
    const a = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
    s += `<path class="arrow" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})" d="M-12 -16 L8 0 L-12 16"/>`;
  }
  return s;
}

function heroAt(x, y, size) {
  return `<g id="hero" style="transform: translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(size / 100).toFixed(3)})"><g class="bob">${heroSVG(WORLDS[lvl.world].hero)}</g></g>`;
}

function render() {
  if (item.kind === 'maze') renderMaze(); else renderTrace();
}

function renderTrace() {
  const t = item.trace, w = tol() * 1.6;
  let s = backdrop(item.world);
  item.paths.forEach((st, k) => {
    const state = t.done || k < t.s ? 'done' : k === t.s ? 'now' : 'later';
    s += `<path class="road road-${state}" d="${pathD(st.pts)}" stroke-width="${w}"/>`;
    if (state === 'now') s += `<path class="lane" d="${pathD(st.pts)}"/>`;
  });
  if (!t.done) {
    const st = item.paths[t.s];
    s += `<path id="fill" class="fill" stroke-width="${w * 0.8}" d=""/>`;
    s += arrows(st);
    const [ex, ey] = st.pts[st.pts.length - 1];
    s += goalStar(ex, ey, 42);
    const [sx, sy] = st.pts[0];
    s += `<g class="start"><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="34"/>`;
    if (item.paths.length > 1) s += `<text x="${sx.toFixed(1)}" y="${(sy + 13).toFixed(1)}">${t.s + 1}</text>`;
    s += '</g>';
  }
  const [hx, hy] = heroSpot();
  s += heroAt(hx, hy - HERO_LIFT, 130);
  stage.innerHTML = s;
  updateTrace();
}

function heroSpot() {
  const t = item.trace;
  if (t.done) {
    const st = item.paths[item.paths.length - 1];
    return st.pts[st.pts.length - 1];
  }
  return item.paths[t.s].pts[t.idx];
}

// Cheap per-point update: grow the fill along the road and move the hero.
function updateTrace() {
  const t = item.trace;
  const fill = stage.querySelector('#fill');
  if (fill && !t.done) fill.setAttribute('d', t.idx > 0 ? pathD(item.paths[t.s].pts.slice(0, t.idx + 1), 2) : '');
  moveHero(...heroSpot(), 130, HERO_LIFT);
  updateMeter();
}

function renderMaze() {
  const { maze: m, L, walk: w } = item;
  let s = backdrop(item.world);
  s += `<rect class="maze-floor" x="${L.x0}" y="${L.y0}" width="${L.cs * m.cols}" height="${L.cs * m.rows}" rx="18"/>`;
  s += `<polyline id="trail" class="trail" stroke-width="${(L.cs * 0.34).toFixed(1)}" points=""/>`;
  s += `<path class="walls" stroke-width="${(L.cs * 0.11).toFixed(1)}" d="${wallPath(m, L)}"/>`;
  s += goalStar(...cellCenter(L, m.goal), L.cs * 0.3);
  s += heroAt(...cellCenter(L, w.cell), L.cs * 0.78);
  stage.innerHTML = s;
  updateMaze();
}

function updateMaze() {
  const { L, walk: w } = item;
  stage.querySelector('#trail')?.setAttribute('points', w.trail.map(c => cellCenter(L, c).map(v => v.toFixed(1)).join(',')).join(' '));
  moveHero(...cellCenter(L, w.cell), L.cs * 0.78);
}

// On a road the hero stands just above the pen point, so the start dot and the
// line under the pen stay visible; in a maze he stands in the middle of his cell.
function moveHero(x, y, size, lift = 0) {
  const h = stage.querySelector('#hero');
  if (h) h.style.transform = `translate(${x.toFixed(1)}px, ${(y - lift).toFixed(1)}px) scale(${(size / 100).toFixed(3)})`;
}

function wobble(sound) {
  const now = performance.now();
  if (now - wobbleAt < 700) return;
  wobbleAt = now;
  const h = stage.querySelector('#hero .bob');
  if (!h) return;
  h.classList.remove('wobble');
  void h.getBoundingClientRect();
  h.classList.add('wobble');
  h.addEventListener('animationend', () => h.classList.remove('wobble'), { once: true });
  if (sound) sfx.boop();
}

// ---------- pen input ----------

function feedOne(x, y) {
  if (item.kind === 'maze') {
    const r = walk(item.walk, item.maze, item.L, x, y);
    if (r.bonk) wobble(true);
    if (r.moved) updateMaze();
    if (r.done && !busy) itemDone();
    return r.onPath;
  }
  const r = feed(item.trace, item.paths, x, y, tol());
  if (r.strokeDone) {
    sfx.chime();
    if (!r.done) renderTrace();
  } else if (r.advanced) {
    updateTrace();
  }
  if (r.done && !busy) { renderTrace(); itemDone(); }
  return r.onPath;
}

const ink = new Ink(canvas, {
  map: (cx, cy) => {
    const r = rect.stage;
    return [(cx - r.left) * 1000 / r.width, (cy - r.top) * 1000 / r.height];
  },
  unmap: (x, y) => {
    const r = rect.stage, c = rect.canvas;
    return [r.left - c.left + x * r.width / 1000, r.top - c.top + y * r.height / 1000];
  },
  scale: () => rect.stage.width / 1000,
  begin() {
    sfx.unlock();
    lastFed = null;
    snap = item && (item.kind === 'maze' ? copyWalk(item.walk) : copyTrace(item.trace));
  },
  point(x, y) {
    if (!item || busy) return hero().ink;
    let on = false;
    const steps = lastFed ? Math.max(1, Math.ceil(Math.hypot(x - lastFed[0], y - lastFed[1]) / STEP)) : 1;
    for (let k = 1; k <= steps; k++) {
      const f = lastFed ? k / steps : 1;
      on = feedOne(lastFed ? lastFed[0] + (x - lastFed[0]) * f : x, lastFed ? lastFed[1] + (y - lastFed[1]) * f : y);
      if (busy) break;
    }
    lastFed = [x, y];
    if (!on && !busy) wobble(false);
    return on || busy ? hero().ink : OFF_INK;
  },
  end() { lastFed = null; sfx.unlock(); },
  cancel() {
    if (!item || busy || !snap) return;
    if (item.kind === 'maze') item.walk = snap; else item.trace = snap;
    render();
    updateMeter();
  },
});

// ---------- layout ----------

function fit() {
  const a = area.getBoundingClientRect();
  const size = Math.min(a.width, a.height) * 0.97;
  Object.assign(stage.style, {
    width: `${size}px`, height: `${size}px`,
    left: `${(a.width - size) / 2}px`, top: `${(a.height - size) / 2}px`,
  });
  rect.stage = stage.getBoundingClientRect();
  rect.canvas = canvas.getBoundingClientRect();
  ink.resize();
}

new ResizeObserver(() => { if (!screens.play.hidden) fit(); }).observe(area);

// ---------- test hooks (read-only views of live state) ----------

window.__heroPad = {
  state: () => ({
    screen: Object.keys(screens).find(k => !screens[k].hidden), at, busy, level: { ...lvl }, missionLength: mission.length,
    kind: item?.kind, id: item?.id, trace: item?.trace && { ...item.trace },
    cell: item?.walk?.cell, inkStrokes: ink.strokes.length, data,
  }),
  // Client-pixel points along what still has to be traced (or the maze solution).
  route: (cells) => {
    const r = rect.stage, px = ([x, y]) => [r.left + x * r.width / 1000, r.top + y * r.height / 1000];
    if (item.kind === 'maze') return cells.map(c => px(cellCenter(item.L, c)));
    return item.paths.slice(item.trace.s).map(st => st.pts.map(px));
  },
  maze: () => item?.maze && { cols: item.maze.cols, rows: item.maze.rows, open: [...item.maze.open], start: item.maze.start, goal: item.maze.goal },
};

$('#ver').textContent = VERSION;
renderHome();
show('home');
