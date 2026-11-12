// Unit checks for the pure modules. Run: node tests/unit.mjs
import { makeStroke, newTrace, feed, arc } from '../js/trace.js';
import { makeMaze, reachable, solution, layout, newWalk, walk, cellCenter } from '../js/maze.js';
import { ITEMS, letterId } from '../js/letters.js';
import { buildLevel, MIN_ROUTE, BOSS_LETTERS } from '../js/curriculum.js';
import { WORLDS, WORLD_ORDER, LEVELS_PER_WORLD, levelSpec, levelOpen, worldOpen, currentLevel, totalStars, nextLevel } from '../js/levels.js';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok' : 'FAIL'} - ${msg}`); if (!ok) fails++; };

// Feed a polyline into a trace, densified like the app does.
function run(t, strokes, line, tol = 80) {
  let r = {};
  for (let i = 0; i < line.length; i++) {
    const [x, y] = line[i], prev = line[i - 1];
    const n = prev ? Math.max(1, Math.ceil(Math.hypot(x - prev[0], y - prev[1]) / 4)) : 1;
    for (let k = 1; k <= n; k++) {
      const f = prev ? k / n : 1;
      r = feed(t, strokes, prev ? prev[0] + (x - prev[0]) * f : x, prev ? prev[1] + (y - prev[1]) * f : y, tol);
    }
  }
  return r;
}

// --- trace ---
const L = ITEMS['letter-L'].strokes.map(s => makeStroke(s));

let t = newTrace();
run(t, L, [[360, 150], [360, 850]]);
check(t.s === 1 && !t.done, 'L: first stroke traced top to bottom completes stroke 1');
run(t, L, [[360, 850], [700, 850]]);
check(t.done, 'L: second stroke completes the letter');

t = newTrace();
run(t, L, [[360, 850], [360, 150]]);
check(t.s === 0 && L[0].cum[t.idx] <= 100, 'L: tracing the down-stroke bottom to top earns no more than the first bit');

t = newTrace();
run(t, L, [[360, 600], [360, 850]]);
check(t.s === 0 && t.idx === 0, 'L: starting halfway down earns nothing (no skipping ahead)');

t = newTrace();
run(t, L, [[360, 150], [360, 400], [100, 400], [100, 800], [600, 800]]);
check(t.s === 0 && L[0].cum[t.idx] < 300, 'L: wandering off the road and back in further down earns nothing extra');
run(t, L, [[360, 400], [360, 850]]);
check(t.s === 1, 'L: coming back to the road resumes and finishes the stroke');

t = newTrace();
run(t, L, [[360, 150], [440, 500], [360, 850]], 45);
check(t.s === 0, 'tight tolerance: a line 80 units off the road does not count');

t = newTrace();
const shield = ITEMS.shield.strokes.map(s => makeStroke(s));
run(t, shield, arc(500, 520, 300, 90, 450));
check(t.done, 'shield: a counter-clockwise circle from the top completes');
t = newTrace();
run(t, shield, arc(500, 520, 300, 90, -270));
check(!t.done && shield[0].cum[t.idx] <= 100, 'shield: a clockwise circle does not');

t = newTrace();
run(t, shield, [[500, 220], [500, 520]]);
check(!t.done, 'shield: a short cut across the middle does not complete');

for (const [id, it] of Object.entries(ITEMS)) {
  const s = it.strokes.map(x => makeStroke(x));
  const tt = newTrace();
  for (const st of it.strokes) run(tt, s, st);
  check(tt.done, `${id}: tracing every stroke exactly completes the item`);
}

// --- maze ---
for (const [c, r] of [[3, 3], [4, 4], [6, 6], [5, 3]]) {
  for (let seed = 1; seed <= 40; seed++) {
    const m = makeMaze(c, r, seed);
    if (reachable(m) !== c * r || !solution(m)) { check(false, `maze ${c}x${r} seed ${seed} not fully connected`); break; }
  }
  check(true, `maze ${c}x${r}: 40 seeds all connected and solvable`);
}
const m = makeMaze(4, 4, 7);
check(JSON.stringify(m.open) === JSON.stringify(makeMaze(4, 4, 7).open), 'maze: same seed builds the same maze');

const Lay = layout(m);
let w = newWalk(m);
for (const cell of solution(m)) walk(w, m, Lay, ...cellCenter(Lay, cell));
check(w.done, 'maze: walking the solution reaches the goal');

w = newWalk(m);
const [gx, gy] = cellCenter(Lay, m.goal), [sx, sy] = cellCenter(Lay, m.start);
let bonks = 0;
for (let k = 0; k <= 100; k++) {
  const r = walk(w, m, Lay, sx + (gx - sx) * k / 100, sy + (gy - sy) * k / 100);
  if (r.bonk) bonks++;
}
check(!w.done, 'maze: a straight line through the walls does not reach the goal');

// corner cut: find a cell with an L-shaped two-step route and jump straight to the diagonal
{
  let tested = false;
  for (let seed = 1; seed < 50 && !tested; seed++) {
    const mm = makeMaze(4, 4, seed), LL = layout(mm), sol = solution(mm);
    for (let i = 0; i + 2 < sol.length && !tested; i++) {
      const [a, , c] = [sol[i], sol[i + 1], sol[i + 2]];
      if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1) {
        const ww = newWalk(mm);
        for (const cell of sol.slice(0, i + 1)) walk(ww, mm, LL, ...cellCenter(LL, cell));
        walk(ww, mm, LL, ...cellCenter(LL, c));
        check(ww.cell[0] === c[0] && ww.cell[1] === c[1] && ww.trail.length === i + 3, 'maze: cutting a corner goes through the connecting cell');
        tested = true;
      }
    }
  }
  check(tested, 'maze: found a corner to test');
}

// --- letters and drills ---
for (const [id, it] of Object.entries(ITEMS)) {
  const pts = it.strokes.flat(), inBox = pts.every(([x, y]) => x >= 80 && x <= 920 && y >= 80 && y <= 920);
  if (!inBox) check(false, `${id}: every point sits inside the stage with a margin`);
}
check(true, 'items: every stroke point sits inside the stage with a margin');
for (const ch of 'LTIHEFOCUJDPBRSGVWMNAKXYZ') check(!!ITEMS[letterId(ch)], `letters: ${ch} exists`);

// A pen that cuts the corner of a one-stroke zigzag must not finish it.
{
  const z = ITEMS.zigzag.strokes.map(s => makeStroke(s));
  const tt = newTrace();
  run(tt, z, [[200, 200], [200, 800]]);
  check(!tt.done, 'zigzag: a straight line down the left edge does not finish it');
}

// --- levels ---
let allWinding = true;
for (const world of WORLD_ORDER) {
  check(WORLDS[world].levels.length === LEVELS_PER_WORLD, `${world}: has ${LEVELS_PER_WORLD} levels`);
  check(WORLDS[world].levels[LEVELS_PER_WORLD - 1].boss === true, `${world}: level ${LEVELS_PER_WORLD} is the boss`);
  for (let n = 1; n <= LEVELS_PER_WORLD; n++) {
    const sp = levelSpec(world, n), ms = buildLevel(world, n, 42 + n);
    check(JSON.stringify(ms) === JSON.stringify(buildLevel(world, n, 42 + n)), `${world} ${n}: same seed, same mission`);
    check(ms[0].kind === 'maze' && ms.at(-1).kind === 'maze', `${world} ${n}: opens and closes with a maze`);
    check(ms.every(i => i.world === world), `${world} ${n}: every item uses the world's backdrop`);
    check(ms.slice(1, -1).every(i => i.kind === 'trace' && it_ok(i)), `${world} ${n}: middle items are real trace items`);
    check(sp.boss ? ms.length === BOSS_LETTERS + 2 : ms.length >= 5 && ms.length <= 6, `${world} ${n}: mission length ${ms.length} is sensible`);
    if (!sp.boss) for (const ch of sp.letters) check(ms.some(i => i.letter === ch), `${world} ${n}: teaches ${ch}`);
    for (const i of ms.filter(x => x.kind === 'maze')) {
      if (solution(makeMaze(i.cols, i.rows, i.seed)).length < Math.ceil(i.cols * i.rows * MIN_ROUTE)) allWinding = false;
    }
  }
  const taught = new Set(WORLDS[world].levels.flatMap(l => l.letters || []));
  check(WORLDS[world].letters.every(c => taught.has(c)), `${world}: every letter on its list is taught by a level`);
}
check(allWinding, 'levels: every maze route winds through at least half the cells');
function it_ok(i) { return makeStroke(i.strokes[0]).len > 0; }

const boss = [buildLevel('web', 6, 1), buildLevel('web', 6, 2)].map(ms => ms.slice(1, -1).map(i => i.letter).join(''));
check(boss[0].length === BOSS_LETTERS, "boss: reviews five letters");
check(buildLevel('jump', 6, 5).slice(1, -1).every(i => WORLDS.jump.letters.includes(i.letter)), 'boss: only reviews its own world\'s letters');
check(new Set(buildLevel('hq', 6, 9).slice(1, -1).map(i => i.letter)).size === BOSS_LETTERS, 'boss: no letter twice');
check(buildLevel('jump', 6, 3)[0].cols === 7, 'jump boss: 7x7 maze');

// --- progress and unlocking ---
{
  const d = { levels: {} };
  check(worldOpen(d, 'web') && !worldOpen(d, 'hq') && !worldOpen(d, 'jump'), 'unlock: a fresh game opens only Web City');
  check(levelOpen(d, 'web', 1) && !levelOpen(d, 'web', 2), 'unlock: only level 1 is playable at the start');
  check(currentLevel(d, 'web') === 1, 'unlock: current level starts at 1');
  d.levels['web-1'] = { stars: 2 };
  check(!levelOpen(d, 'web', 2), 'unlock: 2 stars does not open the next level');
  d.levels['web-1'] = { stars: 3 };
  check(levelOpen(d, 'web', 2) && currentLevel(d, 'web') === 2, 'unlock: 3 stars opens the next level');
  d.levels['web-2'] = { stars: 5 };
  check(!worldOpen(d, 'hq'), 'unlock: Hero HQ stays shut until Web City level 4 is open');
  d.levels['web-3'] = { stars: 3 };
  check(worldOpen(d, 'hq') && !worldOpen(d, 'jump'), 'unlock: reaching Web City level 4 opens Hero HQ');
  check(totalStars(d) === 11, 'stars: total adds every level');
  check(nextLevel(d, 'web', 3).n === 4 && nextLevel(d, 'web', 4) === null, 'next: points at the next open level, or nothing');
  for (let n = 1; n <= 3; n++) d.levels[`hq-${n}`] = { stars: 3 };
  check(worldOpen(d, 'jump'), 'unlock: reaching Hero HQ level 4 opens Jump Land');
  d.levels['web-4'] = { stars: 5 }; d.levels['web-5'] = { stars: 5 }; d.levels['web-6'] = { stars: 4 };
  const nx = nextLevel(d, 'web', 6);
  check(nx && nx.world === 'hq' && nx.n === 1, 'next: after the boss, go on to the next world');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
