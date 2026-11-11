// Unit checks for the pure modules. Run: node tests/unit.mjs
import { makeStroke, newTrace, feed, arc } from '../js/trace.js';
import { makeMaze, reachable, solution, layout, newWalk, walk, cellCenter } from '../js/maze.js';
import { ITEMS } from '../js/letters.js';
import { buildMission, MIN_ROUTE } from '../js/curriculum.js';

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

// --- mission ---
const a = buildMission(42), b = buildMission(42);
check(JSON.stringify(a) === JSON.stringify(b), 'mission: same seed, same mission');
check(a[0].kind === 'maze' && a[a.length - 1].kind === 'maze', 'mission: opens and closes with a maze');
let winding = true;
for (let s = 1; s <= 60; s++) {
  for (const it of buildMission(s).filter(x => x.kind === 'maze')) {
    if (solution(makeMaze(it.cols, it.rows, it.seed)).length < Math.ceil(it.cols * it.rows * MIN_ROUTE)) winding = false;
  }
}
check(winding, 'mission: every maze route winds through at least half the cells');
check(a[0].cols === 5 && a[a.length - 1].cols === 6, 'mission: mazes are 5x5 then 6x6');
let repeat = false;
for (let s = 1; s < 200; s++) { const ms = buildMission(s); if (ms[1].id === ms[3].id) repeat = true; }
check(!repeat, 'mission: the two stroke drills are never the same');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
