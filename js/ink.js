// Ink layer: pointer input, palm rejection and pressure-aware drawing on a <canvas>.
//
// Ink is stored in stage units (the 1000 x 1000 box), so it can be redrawn exactly
// after the iPad rotates. The owner supplies:
//   map(clientX, clientY) -> [x, y] stage units     unmap(x, y) -> [px, py] canvas px
//   scale() -> canvas px per stage unit             point(x, y) -> ink colour
//   begin() / end() / cancel()                      stroke lifecycle hooks

const PEN_HOLD_MS = 4000;   // after the Pencil was last used, finger touches count as a resting palm
const PALM_PX = 60;         // touches reported wider than this are palms
const WIDTH = 16;           // base ink width in stage units

export class Ink {
  constructor(canvas, owner) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.o = owner;
    this.strokes = [];      // [{ pts: [[x, y, width, colour], ...] }]
    this.active = null;     // { id, type, stroke }
    this.penAt = -Infinity;
    this.fingers = false;   // finger mode: touches always draw, even right after the Pencil

    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.cancelled(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // Stop iOS turning a Pencil or finger drag into scrolling, selection or the loupe.
    for (const t of ['touchstart', 'touchmove']) canvas.addEventListener(t, e => e.preventDefault(), { passive: false });
  }

  down(e) {
    e.preventDefault();
    const now = performance.now();
    if (e.pointerType === 'pen') {
      this.penAt = now;
      if (this.active && this.active.type !== 'pen') this.abort();
      if (this.active) return;
    } else {
      if (this.active) return;
      const palmSized = Math.max(e.width || 0, e.height || 0) > PALM_PX;
      const penInHand = !this.fingers && now - this.penAt < PEN_HOLD_MS;
      if (e.pointerType === 'touch' && (penInHand || palmSized)) return;
    }
    try { this.c.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
    this.active = { id: e.pointerId, type: e.pointerType, stroke: { pts: [] } };
    this.strokes.push(this.active.stroke);
    this.o.begin();
    this.add(e);
  }

  move(e) {
    // A hovering Pencil (newer iPads) also counts as "pen in hand" for palm rejection.
    if (e.pointerType === 'pen') this.penAt = performance.now();
    if (!this.active || e.pointerId !== this.active.id) return;
    const batch = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of batch.length ? batch : [e]) this.add(ev);
  }

  up(e) {
    if (!this.active || e.pointerId !== this.active.id) return;
    if (this.active.type === 'pen') this.penAt = performance.now();
    const s = this.active.stroke;
    this.active = null;
    this.finish(s);
    this.o.end();
  }

  // iPadOS cancels a touch it decides was a palm: take that stroke back. A cancelled
  // Pencil stroke (rare: a system gesture) keeps its ink, like lifting the pen.
  cancelled(e) {
    if (!this.active || e.pointerId !== this.active.id) return;
    if (this.active.type === 'pen') this.up(e); else this.abort();
  }

  // A finger or palm stroke was running when the Pencil touched down: take it back.
  abort() {
    const s = this.active.stroke;
    this.active = null;
    this.strokes = this.strokes.filter(x => x !== s);
    this.o.cancel();
    this.redraw();
  }

  add(ev) {
    const [x, y] = this.o.map(ev.clientX, ev.clientY);
    const colour = this.o.point(x, y);
    const p = ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 0.5;
    const s = this.active.stroke;
    const last = s.pts[s.pts.length - 1];
    if (last && Math.abs(last[0] - x) < 0.5 && Math.abs(last[1] - y) < 0.5) return;
    s.pts.push([x, y, WIDTH * (0.55 + 0.9 * p), colour]);
    this.tail(s, s.pts.length - 1);
  }

  // Draw the newest piece of a stroke: quadratic curves through midpoints keep it smooth.
  tail(s, i) {
    const g = this.g, P = s.pts, k = this.o.scale();
    const px = q => this.o.unmap(q[0], q[1]);
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    g.lineCap = g.lineJoin = 'round';
    if (i === 0) {
      const [x, y] = px(P[0]);
      g.fillStyle = P[0][3];
      g.beginPath();
      g.arc(x, y, P[0][2] * k / 2, 0, Math.PI * 2);
      g.fill();
      return;
    }
    const b = P[i - 1], c = P[i];
    const from = i === 1 ? b : mid(P[i - 2], b), to = mid(b, c);
    const [fx, fy] = px(from), [bx, by] = px(b), [tx, ty] = px(to);
    g.strokeStyle = c[3];
    g.lineWidth = (b[2] + c[2]) / 2 * k;
    g.beginPath();
    g.moveTo(fx, fy);
    g.quadraticCurveTo(bx, by, tx, ty);
    g.stroke();
  }

  // Close the last half-segment the midpoint curves leave open.
  finish(s) {
    const P = s.pts, n = P.length;
    if (n < 2) return;
    const [ax, ay] = this.o.unmap((P[n - 2][0] + P[n - 1][0]) / 2, (P[n - 2][1] + P[n - 1][1]) / 2);
    const [bx, by] = this.o.unmap(P[n - 1][0], P[n - 1][1]);
    this.g.strokeStyle = P[n - 1][3];
    this.g.lineWidth = P[n - 1][2] * this.o.scale();
    this.g.beginPath();
    this.g.moveTo(ax, ay);
    this.g.lineTo(bx, by);
    this.g.stroke();
  }

  resize() {
    const r = this.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.c.width = Math.round(r.width * dpr);
    this.c.height = Math.round(r.height * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  redraw() {
    this.g.clearRect(0, 0, this.c.width, this.c.height);
    for (const s of this.strokes) {
      for (let i = 0; i < s.pts.length; i++) this.tail(s, i);
      if (s !== this.active?.stroke) this.finish(s);
    }
  }

  clear() {
    this.strokes = [];
    this.active = null;
    this.redraw();
  }
}
