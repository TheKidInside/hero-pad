// Builds a mission: a short mixed run so nothing repeats long enough to get boring.
// Pattern: maze -> stroke -> letter -> stroke -> maze. Mazes open and close every mission
// because they are Judah's favourite.

import { ITEMS } from './letters.js';
import { rng, makeMaze, solution } from './maze.js';

const STROKES = ['zip-lines', 'swing-across', 'shield'];
const LETTERS = ['letter-L'];

const MAZE_SAY = 'Help your hero through the maze to the star!';

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

function maze(cols, rows, world, rand) {
  const seed = windingSeed(cols, rows, rand);
  return { kind: 'maze', id: `maze-${cols}`, cols, rows, world, seed, title: 'Maze! Get to the star', say: MAZE_SAY };
}

export function buildMission(seed = Math.floor(Math.random() * 1e9)) {
  const rand = rng(seed);
  const pick = (list, not) => {
    const pool = list.filter(x => x !== not);
    return pool[Math.floor(rand() * pool.length)];
  };
  const s1 = pick(STROKES);
  const s2 = pick(STROKES, s1);
  const item = id => ({ ...ITEMS[id], id });
  return [
    maze(5, 5, 'jump', rand),
    item(s1),
    item(pick(LETTERS)),
    item(s2),
    maze(6, 6, 'web', rand),
  ];
}
