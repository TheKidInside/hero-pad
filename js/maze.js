// Maze generator and maze walking: pure functions, no DOM. 1000 x 1000 stage box.
//
// The maze is "perfect" (recursive backtracker): every cell is reachable and there is
// exactly one route between any two cells. The hero starts top-left and the goal is
// bottom-right. The hero follows the pen one cell at a time, and only through openings,
// so a line drawn across a wall leaves him where he is.

export const N = 1, E = 2, S = 4, W = 8;
const DIRS = [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]];

// Small seeded RNG (mulberry32) so a seed always builds the same maze.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeMaze(cols, rows, seed = 1) {
  const rand = rng(seed);
  const open = new Uint8Array(cols * rows);   // bit set = passage open on that side
  const seen = new Uint8Array(cols * rows);
  const stack = [[0, 0]];
  seen[0] = 1;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const next = DIRS.filter(([, dc, dr]) => {
      const nc = c + dc, nr = r + dr;
      return nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen[nr * cols + nc];
    });
    if (!next.length) { stack.pop(); continue; }
    const [bit, dc, dr, back] = next[Math.floor(rand() * next.length)];
    const nc = c + dc, nr = r + dr;
    open[r * cols + c] |= bit;
    open[nr * cols + nc] |= back;
    seen[nr * cols + nc] = 1;
    stack.push([nc, nr]);
  }
  return { cols, rows, open, start: [0, 0], goal: [cols - 1, rows - 1] };
}

export function canMove(m, [ac, ar], [bc, br]) {
  const d = DIRS.find(([, dc, dr]) => ac + dc === bc && ar + dr === br);
  return !!d && (m.open[ar * m.cols + ac] & d[0]) !== 0;
}

// Cells reachable from the start (a perfect maze reaches all of them).
export function reachable(m) {
  return bfs(m).seen.reduce((n, v) => n + v, 0);
}

// Cell route from start to goal.
export function solution(m) {
  const { prev } = bfs(m);
  const key = ([c, r]) => r * m.cols + c;
  const path = [m.goal];
  let k = key(m.goal);
  while (k !== key(m.start)) {
    k = prev[k];
    if (k < 0) return null;
    path.unshift([k % m.cols, Math.floor(k / m.cols)]);
  }
  return path;
}

function bfs(m) {
  const seen = new Uint8Array(m.cols * m.rows);
  const prev = new Int32Array(m.cols * m.rows).fill(-1);
  const q = [m.start];
  seen[0] = 1;
  while (q.length) {
    const [c, r] = q.shift();
    for (const [bit, dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr, k = nr * m.cols + nc;
      if ((m.open[r * m.cols + c] & bit) && !seen[k]) {
        seen[k] = 1;
        prev[k] = r * m.cols + c;
        q.push([nc, nr]);
      }
    }
  }
  return { seen, prev };
}

export function layout(m, box = 1000, margin = 70) {
  const cs = (box - 2 * margin) / Math.max(m.cols, m.rows);
  return { cs, x0: (box - cs * m.cols) / 2, y0: (box - cs * m.rows) / 2 };
}

export function cellAt(L, m, x, y) {
  const c = Math.floor((x - L.x0) / L.cs), r = Math.floor((y - L.y0) / L.cs);
  return c >= 0 && r >= 0 && c < m.cols && r < m.rows ? [c, r] : null;
}

export function cellCenter(L, [c, r]) {
  return [L.x0 + (c + 0.5) * L.cs, L.y0 + (r + 0.5) * L.cs];
}

export function newWalk(m) {
  return { cell: m.start.slice(), trail: [m.start.slice()], done: false };
}

export function copyWalk(w) {
  return { cell: w.cell.slice(), trail: w.trail.map(c => c.slice()), done: w.done };
}

// Feed one pen point. Mutates w; returns what happened. bonk = the pen crossed a wall.
export function walk(w, m, L, x, y) {
  const out = { onPath: false, moved: false, bonk: false, done: w.done };
  const cell = cellAt(L, m, x, y);
  if (!cell) return out;
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  if (same(cell, w.cell)) { out.onPath = true; return out; }
  if (w.done) return out;
  const dc = Math.abs(cell[0] - w.cell[0]), dr = Math.abs(cell[1] - w.cell[1]);
  if (dc + dr === 2 && dc === 1) {
    // The pen cut across a corner: go through whichever side cell connects.
    for (const mid of [[cell[0], w.cell[1]], [w.cell[0], cell[1]]]) {
      if (canMove(m, w.cell, mid) && canMove(m, mid, cell)) {
        step(w, m, mid);
        step(w, m, cell);
        out.onPath = out.moved = true;
        out.done = w.done;
        return out;
      }
    }
    return out;
  }
  if (dc + dr !== 1) return out;
  if (!canMove(m, w.cell, cell)) { out.bonk = true; return out; }
  step(w, m, cell);
  out.onPath = out.moved = true;
  out.done = w.done;
  return out;
}

function step(w, m, cell) {
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const back = w.trail.length > 1 && same(cell, w.trail[w.trail.length - 2]);
  if (back) w.trail.pop(); else w.trail.push(cell.slice());
  w.cell = cell.slice();
  if (same(cell, m.goal)) w.done = true;
}

// Wall segments as an SVG path string.
export function wallPath(m, L) {
  const { cs, x0, y0 } = L;
  let d = '';
  const seg = (ax, ay, bx, by) => { d += `M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`; };
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const o = m.open[r * m.cols + c], x = x0 + c * cs, y = y0 + r * cs;
      if (!(o & N)) seg(x, y, x + cs, y);
      if (!(o & W)) seg(x, y, x, y + cs);
      if (c === m.cols - 1 && !(o & E)) seg(x + cs, y, x + cs, y + cs);
      if (r === m.rows - 1 && !(o & S)) seg(x, y + cs, x + cs, y + cs);
    }
  }
  return d;
}
