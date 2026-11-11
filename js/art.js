// Original heroes and world backdrops, drawn as inline SVG. Heroes live in a
// 100 x 100 box centred on 0,0 (feet at y = 46); backdrops fill the 1000 x 1000 stage.

const SKIN = '#e8b48a', HAIR = '#2b1d14';

const EMBLEMS = {
  zigzag: '<path d="M-10 -3 L-4 5 L2 -3 L8 5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt: '<path d="M3 -10 L-7 2 L-1 2 L-4 11 L7 -2 L1 -2 Z" fill="#ffd84a" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>',
  star: `<polygon points="${starPoints(0, 0, 9, 4)}" fill="#fff"/>`,
};

export const HEROES = {
  zip: { name: 'Zip', power: 'web swinger', suit: '#7b3fe4', trim: '#13b3a8', ink: '#6a2fd6', emblem: 'zigzag' },
  bolt: { name: 'Bolt', power: 'lightning hero', suit: '#1f6fe0', trim: '#ffb81a', ink: '#1a5fd0', emblem: 'bolt' },
  hop: { name: 'Hop', power: 'super jumper', suit: '#22a845', trim: '#ff7a1a', ink: '#178f38', emblem: 'star' },
};

export function starPoints(cx, cy, R, r, n = 5) {
  const pts = [];
  for (let k = 0; k < n * 2; k++) {
    const a = -Math.PI / 2 + k * Math.PI / n, rad = k % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function heroSVG(id) {
  const h = HEROES[id] || HEROES.zip;
  return `
  <path d="M-23 2 C-33 22 -31 40 -25 46 L25 46 C31 40 33 22 23 2 Z" fill="${h.trim}"/>
  <rect x="-13" y="33" width="10" height="13" rx="3" fill="${h.suit}"/>
  <rect x="3" y="33" width="10" height="13" rx="3" fill="${h.suit}"/>
  <rect x="-14" y="41" width="12" height="6" rx="3" fill="${h.trim}"/>
  <rect x="2" y="41" width="12" height="6" rx="3" fill="${h.trim}"/>
  <rect x="-26" y="5" width="9" height="22" rx="4.5" fill="${h.suit}"/>
  <rect x="17" y="5" width="9" height="22" rx="4.5" fill="${h.suit}"/>
  <circle cx="-21.5" cy="28" r="5.5" fill="${h.trim}"/>
  <circle cx="21.5" cy="28" r="5.5" fill="${h.trim}"/>
  <rect x="-17" y="1" width="34" height="37" rx="13" fill="${h.suit}"/>
  <g transform="translate(0 19)">${EMBLEMS[h.emblem]}</g>
  <circle cx="0" cy="-18" r="21" fill="${SKIN}"/>
  <path d="M-21 -19 C-23 -38 -8 -42 0 -42 C11 -42 23 -37 21 -19 C15 -28 6 -30 -4 -28 C-11 -26 -17 -24 -21 -19 Z" fill="${HAIR}"/>
  <path d="M-20 -23 C-8 -28 8 -28 20 -23 L19 -12 C8 -15 -8 -15 -19 -12 Z" fill="${h.trim}"/>
  <ellipse cx="-7.5" cy="-18.5" rx="3.8" ry="4.3" fill="#fff"/>
  <ellipse cx="7.5" cy="-18.5" rx="3.8" ry="4.3" fill="#fff"/>
  <circle cx="-7" cy="-18" r="2.2" fill="#1d1d2b"/>
  <circle cx="7" cy="-18" r="2.2" fill="#1d1d2b"/>
  <circle cx="-12" cy="-7" r="3" fill="#f39a8a" opacity=".6"/>
  <circle cx="12" cy="-7" r="3" fill="#f39a8a" opacity=".6"/>
  <path d="M-7 -6 Q0 1 7 -6" stroke="#7a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
}

export function goalStar(x, y, size = 60) {
  return `<g class="goal" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <polygon points="${starPoints(0, 0, size, size * 0.45)}" fill="#ffd23f" stroke="#f08a00" stroke-width="${size * 0.1}" stroke-linejoin="round"/>
  </g>`;
}

function webCity() {
  let s = '<g opacity=".5">';
  const towers = [[0, 260, 120], [120, 380, 100], [220, 200, 130], [350, 330, 90], [440, 240, 120],
    [560, 420, 110], [670, 280, 100], [770, 360, 120], [890, 230, 110]];
  for (const [x, h, w] of towers) {
    s += `<rect x="${x}" y="${1000 - h}" width="${w - 8}" height="${h}" fill="#cfc8f4"/>`;
    for (let wy = 1000 - h + 24; wy < 980; wy += 42) {
      for (let wx = x + 14; wx < x + w - 26; wx += 30) s += `<rect x="${wx}" y="${wy}" width="14" height="20" rx="2" fill="#fff"/>`;
    }
  }
  // a web strung across the top-left corner
  s += '<g stroke="#c3baee" stroke-width="5" fill="none">';
  const spokes = [0, 22.5, 45, 67.5, 90];
  for (const a of spokes) {
    const r = a * Math.PI / 180;
    s += `<line x1="0" y1="0" x2="${(290 * Math.cos(r)).toFixed(0)}" y2="${(290 * Math.sin(r)).toFixed(0)}"/>`;
  }
  for (const rad of [90, 170, 250]) {
    s += `<polyline points="${spokes.map(a => `${(rad * Math.cos(a * Math.PI / 180)).toFixed(0)},${(rad * Math.sin(a * Math.PI / 180)).toFixed(0)}`).join(' ')}"/>`;
  }
  return s + '</g></g>';
}

function jumpLand() {
  let s = '<g opacity=".6">';
  for (const [x, y, k] of [[150, 120, 1], [620, 90, 1.3], [880, 220, 0.8]]) {
    s += `<g transform="translate(${x} ${y}) scale(${k})" fill="#fff"><ellipse cx="0" cy="0" rx="70" ry="34"/><ellipse cx="-45" cy="10" rx="40" ry="24"/><ellipse cx="45" cy="10" rx="44" ry="26"/></g>`;
  }
  s += '<path d="M0 900 Q160 820 320 900 T640 900 T1000 890 L1000 1000 L0 1000 Z" fill="#9fdc8a"/>';
  for (const [x, y] of [[90, 560], [820, 470]]) {
    s += `<rect x="${x}" y="${y}" width="120" height="34" rx="10" fill="#c98a4b"/><rect x="${x}" y="${y}" width="120" height="14" rx="7" fill="#7ccf5c"/>`;
    for (let k = 0; k < 3; k++) s += `<circle cx="${x + 22 + k * 38}" cy="${y - 34}" r="13" fill="#ffd23f" stroke="#f0a800" stroke-width="4"/>`;
  }
  return s + '</g>';
}

function heroHQ() {
  let s = '<g opacity=".45" fill="none" stroke="#bcd3f7" stroke-width="10">';
  for (const r of [420, 330, 240]) s += `<circle cx="500" cy="520" r="${r}"/>`;
  s += '</g><g opacity=".55">';
  for (const [x, y, k] of [[110, 140, 22], [880, 120, 30], [90, 860, 26], [900, 860, 20], [500, 70, 18]]) {
    s += `<polygon points="${starPoints(x, y, k, k * 0.45)}" fill="#ffe08a"/>`;
  }
  return s + '</g>';
}

export function backdrop(world) {
  if (world === 'web') return webCity();
  if (world === 'jump') return jumpLand();
  return heroHQ();
}

export const WORLD_BG = { web: '#efeafd', jump: '#e3f4ff', hq: '#eaf2ff' };
