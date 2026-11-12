// Builds a mission for one level. Shape: maze -> drill(s) -> letter(s) -> maze. Mazes open
// and close every mission because they are Judah's favourite. The level plan itself
// (which drills and letters, which maze sizes) lives in levels.js.

import { ITEMS, letterId } from './letters.js';
import { rng, makeMaze, solution } from './maze.js';
import { WORLDS, levelSpec } from './levels.js';

const MAZE_SAY = 'Help your hero through the maze to the star!';

export const BOSS_LETTERS = 5;   // letters a boss mission reviews, drawn from its world

// Keep only mazes whose route visits at least half the cells, so it winds and has
// real dead ends, not a near-straight run to the corner.
export const MIN_ROUTE = 0.5;

function windingSeed(cols, rows, rand) {
  const need = Math.ceil(cols * rows * MIN_ROUTE);
  let best = 0, bestLen = -1;
  for (let k = 0; k < 200; k++) {
    const seed = Math.floor(rand() * 1e9), len = solution(makeMaze(cols, rows, seed)).length;
    if (len >= need) return seed;
    if (len > bestLen) { best = seed; bestLen = len; }
  }
  return best;
}

function maze([cols, rows], world, rand) {
  const seed = windingSeed(cols, rows, rand);
  return { kind: 'maze', id: `maze-${cols}`, cols, rows, world, seed, title: 'Maze! Get to the star', say: MAZE_SAY };
}

// Fisher-Yates with the seeded rng, so a seed always picks the same boss letters.
function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildLevel(world, n, seed = Math.floor(Math.random() * 1e9)) {
  const spec = levelSpec(world, n);
  if (!spec) throw new Error(`no such level: ${world} ${n}`);
  const rand = rng(seed);
  const item = id => ({ ...ITEMS[id], id, world, tol: spec.tol });

  const mid = [];
  if (spec.boss) {
    for (const ch of shuffled(WORLDS[world].letters, rand).slice(0, BOSS_LETTERS)) mid.push(item(letterId(ch)));
  } else {
    const [first, ...rest] = spec.strokes;
    mid.push(item(first));
    for (const ch of spec.letters) mid.push(item(letterId(ch)));
    for (const id of rest) mid.push(item(id));
  }
  return [maze(spec.maze, world, rand), ...mid, maze(spec.maze, world, rand)];
}
