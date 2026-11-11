// Sounds made with Web Audio (no audio files) and spoken prompts via speechSynthesis.
// iOS only allows audio after a tap, so unlock() runs on the first tap of each screen.

let ctx = null;
let enabled = true;

export function setEnabled(on) {
  enabled = on;
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}

export function unlock() {
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) ctx = new C();
    }
    // iOS can leave the context 'suspended' or 'interrupted' (calls, Siri, backgrounding).
    if (ctx && ctx.state !== 'running') ctx.resume()?.catch?.(() => {});
  } catch { ctx = null; }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) unlock(); });

function tone(freq, at, dur, type = 'sine', gain = 0.16) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function chime() {
  tone(784, 0, 0.18, 'triangle');
  tone(1175, 0.09, 0.3, 'triangle');
}

export function fanfare() {
  [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.11, k === 3 ? 0.5 : 0.16, 'square', 0.08));
}

export function boop() {
  tone(196, 0, 0.12, 'triangle', 0.07);
}

export function say(text) {
  if (!enabled || !text || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.15;
    speechSynthesis.speak(u);
  } catch { /* speech is a bonus, never a blocker */ }
}
