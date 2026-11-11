// Builds a mission: a short mixed run so nothing repeats long enough to get boring.
// Pattern: maze -> stroke -> letter -> stroke -> maze. Mazes open and close every mission
// because they are Judah's favourite.

import { ITEMS } from './letters.js';
import { rng } from './maze.js';

const STROKES = ['zip-lines', 'swing-across', 'shield'];
const LETTERS = ['letter-L'];

const MAZE_SAY = 'Help your hero through the maze to the star!';

function maze(cols, rows, world, seed) {
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
    maze(3, 3, 'jump', Math.floor(rand() * 1e9)),
    item(s1),
    item(pick(LETTERS)),
    item(s2),
    maze(4, 4, 'web', Math.floor(rand() * 1e9)),
  ];
}
