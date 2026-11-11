// Trace checker: pure functions, no DOM. Everything lives in a 1000 x 1000 stage box.
//
// A stroke is a polyline resampled into evenly spaced points. Progress along it is the
// furthest point the pen has reached in order: the pen may only claim points a short
// distance ahead of where it already is, so starting at the far end, tracing backwards
// or jumping ahead earns nothing. Leaving the corridor never fails the stroke; it just
// stops progress until the pen comes back.

export const SPACING = 6;     // stage units between resampled points
const LOOK_AHEAD = 90;        // how far ahead (stage units) the pen may claim progress

export function makeStroke(points, spacing = SPACING) {
  const pts = [points[0].slice()];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / spacing));
    for (let k = 1; k <= n; k++) pts.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}

// Points on a circle arc. Angles in degrees, counter-clockwise as seen on screen,
// 0 = 3 o'clock, 90 = 12 o'clock. arc(500, 500, 300, 90, 450) = full circle from the top.
export function arc(cx, cy, r, from, to, step = 4) {
  const out = [];
  const n = Math.max(2, Math.ceil(Math.abs(to - from) / step));
  for (let k = 0; k <= n; k++) {
    const a = (from + (to - from) * k / n) * Math.PI / 180;
    out.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
  }
  return out;
}

export function newTrace() {
  return { s: 0, idx: 0, done: false };
}

export function copyTrace(t) {
  return { ...t };
}

function endSlack(st, tol) {
  return Math.min(tol * 0.8, st.len * 0.1);
}

function nearStroke(st, x, y, tol) {
  const t2 = tol * tol;
  for (const [px, py] of st.pts) {
    const dx = px - x, dy = py - y;
    if (dx * dx + dy * dy <= t2) return true;
  }
  return false;
}

// Feed one pen point. Mutates t; returns what happened.
export function feed(t, strokes, x, y, tol) {
  const out = { onPath: false, advanced: false, strokeDone: false, done: t.done };
  const upto = t.done ? strokes.length : t.s + 1;
  for (let k = 0; k < upto && !out.onPath; k++) out.onPath = nearStroke(strokes[k], x, y, tol);
  if (t.done) return out;

  // Find the road point nearest the pen a little beyond the look-ahead, then only
  // accept it if it is inside the look-ahead. Without the wider search, a pen
  // approaching from further along the road (tracing backwards) would be pulled
  // forward by the corridor width each step.
  const st = strokes[t.s];
  const base = st.cum[t.idx];
  let best = -1, bestD = tol;
  for (let j = t.idx; j < st.pts.length && st.cum[j] <= base + LOOK_AHEAD + tol; j++) {
    const d = Math.hypot(st.pts[j][0] - x, st.pts[j][1] - y);
    if (d <= bestD) { bestD = d; best = j; }
  }
  if (best > t.idx && st.cum[best] <= base + LOOK_AHEAD) { t.idx = best; out.advanced = true; }

  if (st.len - st.cum[t.idx] <= endSlack(st, tol)) {
    out.strokeDone = true;
    t.s += 1;
    t.idx = 0;
    if (t.s >= strokes.length) { t.done = true; out.done = true; }
  }
  return out;
}
