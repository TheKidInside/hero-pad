// What Judah traces. Each item is a list of strokes in stroke order; each stroke is a
// polyline in the 1000 x 1000 stage box, drawn in the direction the pen should travel.
// Letters are ball-and-stick print: straight lines and circles, top to bottom, left to right.
// `world` here is only a default; a level overrides it so the backdrop matches the world.

import { arc } from './trace.js';

const join = (...parts) => parts.flat(1);
const line = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];

const drill = (title, say, strokes, world = 'web') => ({ kind: 'trace', world, title, say, strokes });

// Letter factory. `word` is the "X is for ..." picture word spoken aloud.
const letter = (ch, word, strokes) => ({
  kind: 'trace', world: 'web', letter: ch, title: `Trace the letter ${ch}`,
  say: `Trace the letter ${ch}. Start at the green dot. ${ch} is for ${word}!`,
  strokes,
});

// Bumps and bowls shared by D, P, B, R.
const bump = (cx, cy, r) => arc(cx, cy, r, 90, -90);

export const ITEMS = {
  // ---------- Pre-writing strokes: Web City (straight lines) ----------
  'zip-lines': drill('Zip down the web lines!', 'Zip down the web lines! Start at the green dot and go down.',
    [line(250, 180, 250, 820), line(500, 180, 500, 820), line(750, 180, 750, 820)]),
  'swing-across': drill('Swing across the rooftops!', 'Swing across the rooftops! Start at the green dot and go across.',
    [line(180, 250, 820, 250), line(180, 500, 820, 500), line(180, 750, 820, 750)]),
  'short-downs': drill('Light up the windows!', 'Light up the windows! Draw a short line down in each one.',
    [250, 500, 750].flatMap(x => [line(x, 220, x, 400), line(x, 600, x, 780)])),
  'web-box': drill('Catch the balloon!', 'Catch the balloon! Make a web box. Down, across, down, across.',
    [line(300, 300, 300, 700), line(300, 300, 700, 300), line(700, 300, 700, 700), line(300, 700, 700, 700)]),

  // ---------- Pre-writing strokes: Hero HQ (curves) ----------
  'shield': drill('Make a round shield!', 'Make a big round shield! Start at the top and go around.',
    [arc(500, 520, 300, 90, 450)], 'hq'),
  'zigzag': drill('Charge the battery!', 'Charge the battery! Zig and zag all the way down.',
    [[[200, 200], [800, 340], [200, 500], [800, 660], [200, 800]]], 'hq'),
  'cups': drill('Beam the signal!', 'Beam the signal! Make three little cups.',
    [arc(230, 450, 100, 180, 360), arc(500, 450, 100, 180, 360), arc(770, 450, 100, 180, 360)], 'hq'),
  'bump': drill('Fix the jet-pack!', 'Fix the jet-pack! Line down, then a big bump.',
    [line(300, 200, 300, 800), join([[300, 200]], arc(300, 500, 300, 90, -90))], 'hq'),
  'snake': drill('Call the team!', 'Call the team! Slither like a snake.',
    [join(arc(500, 330, 170, 30, 270), arc(500, 670, 170, 90, -150))], 'hq'),

  // ---------- Pre-writing strokes: Jump Land (slants and bounces) ----------
  'hill-hop': drill('Hop over the gap!', 'Hop over the gap! Run down the hill, then up the next one.',
    [line(200, 250, 450, 750), line(550, 750, 800, 250)], 'jump'),
  'double-slant': drill('Slide down twice!', 'Slide down twice! Two big slants.',
    [line(250, 250, 420, 750), line(580, 250, 750, 750)], 'jump'),
  'humps': drill('Bonk the blocks!', 'Bonk the blocks! Make three jumping humps.',
    [arc(230, 600, 110, 180, 0), arc(500, 600, 110, 180, 0), arc(770, 600, 110, 180, 0)], 'jump'),
  'switchback': drill('Climb the mountain!', 'Climb the mountain! Zig and zag up the slope.',
    [[[150, 820], [850, 680], [150, 540], [850, 400], [150, 260]]], 'jump'),
  'x-marks': drill('X marks the spot!', 'X marks the spot! Two lines cross.',
    [line(250, 250, 750, 750), line(750, 250, 250, 750)], 'jump'),

  // ---------- Letters: Web City (straight lines) ----------
  'letter-L': letter('L', 'lion', [line(360, 150, 360, 850), line(360, 850, 700, 850)]),
  'letter-T': letter('T', 'tiger', [line(200, 150, 800, 150), line(500, 150, 500, 850)]),
  'letter-I': letter('I', 'igloo', [line(500, 150, 500, 850)]),
  'letter-H': letter('H', 'hat', [line(300, 150, 300, 850), line(700, 150, 700, 850), line(300, 500, 700, 500)]),
  'letter-E': letter('E', 'elephant', [line(300, 150, 300, 850), line(300, 150, 700, 150), line(300, 500, 650, 500), line(300, 850, 700, 850)]),
  'letter-F': letter('F', 'fish', [line(300, 150, 300, 850), line(300, 150, 700, 150), line(300, 500, 650, 500)]),

  // ---------- Letters: Hero HQ (curves) ----------
  'letter-O': letter('O', 'octopus', [arc(500, 500, 340, 90, 450)]),
  'letter-C': letter('C', 'cat', [arc(500, 500, 340, 45, 315)]),
  'letter-U': letter('U', 'umbrella', [join(line(280, 150, 280, 650), arc(500, 650, 220, 180, 360), [[720, 150]])]),
  'letter-J': letter('J', 'jelly', [join(line(650, 150, 650, 650), arc(450, 650, 200, 0, -180))]),
  'letter-D': letter('D', 'dog', [line(300, 150, 300, 850), join([[300, 150]], arc(300, 500, 350, 90, -90))]),
  'letter-P': letter('P', 'pig', [line(300, 150, 300, 850), join([[300, 150]], bump(300, 325, 175))]),
  'letter-B': letter('B', 'bear', [line(300, 150, 300, 850), join([[300, 150]], bump(300, 325, 175)), bump(300, 675, 175)]),
  'letter-R': letter('R', 'rabbit', [line(300, 150, 300, 850), join([[300, 150]], bump(300, 325, 175)), line(300, 500, 700, 850)]),
  'letter-S': letter('S', 'snake', [join(arc(500, 325, 175, 30, 270), arc(500, 675, 175, 90, -150))]),
  'letter-G': letter('G', 'goat', [arc(500, 500, 340, 45, 315), line(740, 500, 540, 500)]),

  // ---------- Letters: Jump Land (slants) ----------
  'letter-V': letter('V', 'van', [line(250, 150, 500, 850), line(500, 850, 750, 150)]),
  'letter-W': letter('W', 'whale', [line(150, 150, 300, 850), line(300, 850, 500, 350), line(500, 350, 700, 850), line(700, 850, 850, 150)]),
  'letter-M': letter('M', 'monkey', [line(200, 850, 200, 150), line(200, 150, 500, 600), line(500, 600, 800, 150), line(800, 150, 800, 850)]),
  'letter-N': letter('N', 'nest', [line(250, 850, 250, 150), line(250, 150, 750, 850), line(750, 850, 750, 150)]),
  'letter-A': letter('A', 'apple', [line(500, 150, 250, 850), line(500, 150, 750, 850), line(350, 620, 650, 620)]),
  'letter-K': letter('K', 'kite', [line(300, 150, 300, 850), line(700, 150, 300, 520), line(420, 430, 700, 850)]),
  'letter-X': letter('X', 'x-ray', [line(250, 150, 750, 850), line(750, 150, 250, 850)]),
  'letter-Y': letter('Y', 'yo-yo', [line(250, 150, 500, 500), line(750, 150, 500, 500), line(500, 500, 500, 850)]),
  'letter-Z': letter('Z', 'zebra', [line(250, 150, 750, 150), line(750, 150, 250, 850), line(250, 850, 750, 850)]),
};

// Letters keep their ids as `letter-<X>` so levels can name them by character.
export const letterId = ch => `letter-${ch}`;
