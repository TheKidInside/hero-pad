// The level plan: three worlds, six levels each (18 in all). Pure data plus unlock rules.
// Each world teaches one family of strokes, then the capital letters built from them.
//
// A level is one mission. Shape: maze, drill(s), letter(s), maze. Level 6 of each world is
// a boss: a longer mission that reviews the world's letters. `stroke` entries are ids from
// letters.js; `letters` are single characters.
//
// `tol` is the corridor half-width in stage units (wide 80, medium 60, tight 45).

export const WORLDS = {
  web: {
    name: 'Web City', hero: 'zip', blurb: "Zip's world. Straight lines and stick letters.",
    skills: 'Straight lines: down, across, boxes.',
    letters: ['L', 'T', 'I', 'H', 'E', 'F'],
    levels: [
      { name: 'Rooftop Run', maze: [4, 4], strokes: ['zip-lines', 'swing-across'], letters: ['L'], tol: 'wide',
        puzzle: 'Zip down the web lines from the roof. Each line you trace lowers Zip.',
        skill: 'Top-to-bottom lines, the first stroke of L.' },
      { name: 'Web Ladder', maze: [5, 5], strokes: ['swing-across', 'zip-lines'], letters: ['T'], tol: 'wide',
        puzzle: 'Build a ladder. Trace each rung from left to right.',
        skill: 'Left-to-right lines, the top of T.' },
      { name: 'Window Wash', maze: [5, 5], strokes: ['short-downs', 'zip-lines'], letters: ['I'], tol: 'wide',
        puzzle: 'Light up the tower. A short line down in each window switches its light on.',
        skill: 'Short, careful lines, the stick of I.' },
      { name: 'Three Friends', maze: [5, 5], strokes: ['zip-lines', 'short-downs'], letters: ['H'], tol: 'wide',
        puzzle: 'Three friends are stuck at the bottom. Zip down each web line to scoop them up.',
        skill: 'Top-to-bottom lines, the first stroke of L, T, I, H, E and F.' },
      { name: 'Balloon Net', maze: [6, 6], strokes: ['web-box'], letters: ['E', 'F'], tol: 'wide',
        puzzle: 'A balloon floats off the roof. Trace the four sides of a web box to catch it.',
        skill: 'Down, across, down, across: how E and F are built.' },
      { name: 'Boss: Tower Top', boss: true, maze: [6, 6], tol: 'wide',
        puzzle: 'A runaway robot is on the roof. Trace its control letters to switch every light off.',
        skill: 'Review: L T I H E F.' },
    ],
  },
  hq: {
    name: 'Hero HQ', hero: 'bolt', blurb: "Bolt's team base. Circles, curves and round letters.",
    skills: 'Curves: circles, arcs and zigzags.',
    letters: ['O', 'C', 'U', 'J', 'D', 'P', 'S', 'G'],
    levels: [
      { name: 'Shield Power', maze: [4, 4], strokes: ['shield', 'zip-lines'], letters: ['O'], tol: 'wide',
        puzzle: 'Start at the top and go all the way round. Every bit you trace charges the shield with gold power.',
        skill: 'The anticlockwise circle, the base of O, C, a, d, g and q.' },
      { name: 'Bolt Charge', maze: [5, 5], strokes: ['zigzag', 'shield'], letters: ['C'], tol: 'wide',
        puzzle: 'Charge the battery. Zig and zag all the way down.',
        skill: 'Changing direction without lifting the pencil.' },
      { name: 'Signal Beam', maze: [5, 5], strokes: ['cups'], letters: ['U', 'J'], tol: 'wide',
        puzzle: 'Make three arcs to beam the signal over the city.',
        skill: 'Cup curves, the bottom of U and J.' },
      { name: 'Gadget Lab', maze: [5, 5], strokes: ['bump'], letters: ['D', 'P'], tol: 'medium',
        puzzle: 'Fix the jet-pack. Trace down, then the big bump for its handle.',
        skill: 'A line down and a bump: the start of D and P.' },
      { name: 'Team Call', maze: [6, 6], strokes: ['snake'], letters: ['S', 'G'], tol: 'medium',
        puzzle: 'Slither like a snake to call the whole team.',
        skill: 'The S-curve, and a circle with a bar.' },
      { name: 'Boss: Storm Over HQ', boss: true, maze: [6, 6], tol: 'medium',
        puzzle: 'A storm cloud sits over HQ. Each letter you trace shrinks it until the sun comes out.',
        skill: 'Review: O C U J D P S G.' },
    ],
  },
  jump: {
    name: 'Jump Land', hero: 'hop', blurb: "Hop's world. Slants, bounces and zigzag letters.",
    skills: 'Slants and humps: \\ / and zigzags.',
    letters: ['V', 'W', 'M', 'N', 'A', 'K', 'X', 'Y', 'Z'],
    levels: [
      { name: 'Hill Hop', maze: [5, 5], strokes: ['hill-hop', 'double-slant'], letters: ['V'], tol: 'medium',
        puzzle: 'Hop over the gap. Run down one hill and up the next.',
        skill: 'Slanting lines down and up.' },
      { name: 'Coin Maze', maze: [5, 5], strokes: ['double-slant', 'hill-hop'], letters: ['W'], tol: 'medium',
        puzzle: 'Grab the coins and reach the flag.',
        skill: 'Slants, and turning corners without lifting the pencil.' },
      { name: 'Bounce Blocks', maze: [5, 5], strokes: ['humps'], letters: ['M', 'N'], tol: 'medium',
        puzzle: 'A row of blocks overhead. Each hump you trace bonks one.',
        skill: 'Humps, the tops of M and N.' },
      { name: 'Zigzag Mountain', maze: [6, 6], strokes: ['switchback'], letters: ['Z', 'A'], tol: 'tight',
        puzzle: 'Climb to the summit. The path switches back and forth.',
        skill: 'Zigzags, the heart of Z and A.' },
      { name: 'Treasure Island', maze: [6, 6], strokes: ['x-marks'], letters: ['X', 'K', 'Y'], tol: 'tight',
        puzzle: 'X marks the spot. Two lines cross to dig up the chest.',
        skill: 'Crossing lines: X, K and Y.' },
      { name: 'Boss: Castle Gate', boss: true, maze: [7, 7], tol: 'tight',
        puzzle: 'The gate has letter-shaped keyholes. Each letter you trace turns a key.',
        skill: 'Review: V W M N A K X Y Z.' },
    ],
  },
};

export const WORLD_ORDER = ['web', 'hq', 'jump'];
export const LEVELS_PER_WORLD = 6;
export const STARS_TO_UNLOCK = 3;      // stars on a level that open the next one
export const OPEN_NEXT_WORLD_AT = 4;   // reaching this level in a world opens the next world

export const levelKey = (world, n) => `${world}-${n}`;

export function levelSpec(world, n) {
  return WORLDS[world]?.levels[n - 1] || null;
}

// Stars (items finished) the best attempt at a level earned.
export const starsOf = (data, world, n) => data.levels?.[levelKey(world, n)]?.stars || 0;

// Is level n of a world playable? Level 1 of a world needs the world open; any other level
// needs 3 stars on the one before it.
export function levelOpen(data, world, n) {
  if (!levelSpec(world, n)) return false;
  if (n === 1) return worldOpen(data, world);
  return starsOf(data, world, n - 1) >= STARS_TO_UNLOCK;
}

// A world opens when the previous world's level OPEN_NEXT_WORLD_AT is playable.
export function worldOpen(data, world) {
  const i = WORLD_ORDER.indexOf(world);
  if (i <= 0) return i === 0;
  return levelOpen(data, WORLD_ORDER[i - 1], OPEN_NEXT_WORLD_AT);
}

// The level a world's Play button should start: the first open level with fewer than
// 3 stars, or the boss once everything before it is cleared.
export function currentLevel(data, world) {
  for (let n = 1; n <= LEVELS_PER_WORLD; n++) {
    if (levelOpen(data, world, n) && starsOf(data, world, n) < STARS_TO_UNLOCK) return n;
  }
  return LEVELS_PER_WORLD;
}

export function totalStars(data) {
  return Object.values(data.levels || {}).reduce((n, l) => n + (l.stars || 0), 0);
}

// What the next level is, for the "Next level" button on the finish screen.
export function nextLevel(data, world, n) {
  if (n < LEVELS_PER_WORLD && levelOpen(data, world, n + 1)) return { world, n: n + 1 };
  const i = WORLD_ORDER.indexOf(world);
  if (n === LEVELS_PER_WORLD && i < WORLD_ORDER.length - 1 && worldOpen(data, WORLD_ORDER[i + 1])) return { world: WORLD_ORDER[i + 1], n: 1 };
  return null;
}
