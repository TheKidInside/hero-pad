// What Judah traces. Each item is a list of strokes in stroke order; each stroke is a
// polyline in the 1000 x 1000 stage box, drawn in the direction the pen should travel.
// Letters are ball-and-stick print: straight lines and circles, top to bottom, left to right.

import { arc } from './trace.js';

export const ITEMS = {
  // Pre-writing strokes
  'zip-lines': {
    kind: 'trace', world: 'web', title: 'Zip down the web lines!',
    say: 'Zip down the web lines! Start at the green dot and go down.',
    strokes: [[[250, 180], [250, 820]], [[500, 180], [500, 820]], [[750, 180], [750, 820]]],
  },
  'swing-across': {
    kind: 'trace', world: 'web', title: 'Swing across the rooftops!',
    say: 'Swing across the rooftops! Start at the green dot and go across.',
    strokes: [[[180, 250], [820, 250]], [[180, 500], [820, 500]], [[180, 750], [820, 750]]],
  },
  'shield': {
    kind: 'trace', world: 'hq', title: 'Make a round shield!',
    say: 'Make a big round shield! Start at the top and go around.',
    strokes: [arc(500, 520, 300, 90, 450)],
  },

  // Letters
  'letter-L': {
    kind: 'trace', world: 'jump', letter: 'L', title: 'Trace the letter L',
    say: 'Trace the letter L. Big line down, then little line across. L is for lion!',
    strokes: [[[360, 150], [360, 850]], [[360, 850], [700, 850]]],
  },
};
