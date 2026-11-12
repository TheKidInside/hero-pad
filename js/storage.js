// Progress lives in this iPad's browser only. Every read and write is guarded so the
// app still runs when storage is blocked (private mode, cleared site data).

const KEY = 'heropad.v1';

// `levels` maps "<world>-<n>" to { stars } (the best attempt), see levels.js.
const defaults = () => ({ hero: 'zip', input: 'pencil', tol: 'wide', sound: true, items: {}, levels: {}, missions: 0 });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = { ...defaults(), ...JSON.parse(raw) };
      if (!d.items || typeof d.items !== 'object' || Array.isArray(d.items)) d.items = {};
      if (!d.levels || typeof d.levels !== 'object' || Array.isArray(d.levels)) d.levels = {};
      if (!Number.isFinite(d.missions)) d.missions = 0;
      return d;
    }
  } catch { /* fall through to defaults */ }
  return defaults();
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* not saved, still playable */ }
}
