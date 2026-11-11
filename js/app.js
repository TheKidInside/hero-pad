// Hero Pad: screens and the play loop. Home -> mission (5 items) -> mission complete.

import { makeStroke, newTrace, copyTrace, feed } from './trace.js';
import { makeMaze, layout, newWalk, copyWalk, walk, cellCenter, wallPath } from './maze.js';
import { buildMission } from './curriculum.js';
import { HEROES, heroSVG, goalStar, backdrop, WORLD_BG } from './art.js';
import { Ink } from './ink.js';
import * as sfx from './audio.js';
import { load, save } from './storage.js';

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

let mission = [], at = 0, item = null, busy = false;
let snap = null, lastFed = null, wobbleAt = 0, nextTimer = null;
let rect = { stage: null, canvas: null };

const hero = () => HEROES[data.hero] || HEROES.zip;
const tol = () => TOL[data.tol] || TOL.wide;

// ---------- screens ----------

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  if (name === 'play') fit();
}

function renderHome() {
  const box = $('#heroes');
  box.innerHTML = Object.entries(HEROES).map(([id, h]) => `
    <button class="hero-card${id === data.hero ? ' picked' : ''}" data-hero="${id}" style="--suit:${h.suit}">
      <svg viewBox="-50 -50 100 100" aria-hidden="true">${heroSVG(id)}</svg>
      <span>${h.name}</span>
    </button>`).join('');
  $('#go').style.setProperty('--suit', hero().suit);
}

$('#heroes').addEventListener('click', e => {
  const b = e.target.closest('[data-hero]');
  if (!b) return;
  sfx.unlock();
  data.hero = b.dataset.hero;
  save(data);
  renderHome();
  sfx.say(`${hero().name}, the ${hero().power}!`);
});

$('#go').addEventListener('click', () => {
  sfx.unlock();
  startMission();
});

$('#again').addEventListener('click', () => { sfx.unlock(); startMission(); });
$('#home-btn').addEventListener('click', () => { renderHome(); show('home'); });
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
    timer = setTimeout(() => { stop(); leaveMission(); renderHome(); show('home'); }, 900);
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

function startMission() {
  leaveMission();
  const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
  mission = buildMission(seed);
  at = 0;
  $('#stars').innerHTML = mission.map(() => '<i></i>').join('');
  show('play');
  startItem();
}

function startItem() {
  const spec = mission[at];
  busy = false;
  item = { ...spec };
  if (spec.kind === 'maze') {
    item.maze = makeMaze(spec.cols, spec.rows, spec.seed);
    item.L = layout(item.maze);
    item.walk = newWalk(item.maze);
  } else {
    item.paths = spec.strokes.map(s => makeStroke(s));
    item.trace = newTrace();
  }
  $('#prompt').textContent = spec.title;
  screens.play.style.setProperty('--bg', WORLD_BG[spec.world] || '#eef');
  screens.play.style.setProperty('--suit', hero().suit);
  ink.clear();
  render();
  sfx.say(spec.say);
}

function itemDone() {
  busy = true;
  const rec = data.items[item.id] || (data.items[item.id] = { stars: 0 });
  rec.stars += 1;
  save(data);
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
  save(data);
  $('#done-hero').innerHTML = heroSVG(data.hero);
  $('#done-stars').innerHTML = mission.map(() => '<i class="on"></i>').join('');
  show('done');
  sfx.fanfare();
  sfx.say(`Mission complete! Great job, ${hero().name}!`);
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
  return `<g id="hero" style="transform: translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(size / 100).toFixed(3)})"><g class="bob">${heroSVG(data.hero)}</g></g>`;
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
    screen: Object.keys(screens).find(k => !screens[k].hidden), at, busy,
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

renderHome();
show('home');
