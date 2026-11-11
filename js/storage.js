// Progress lives in this iPad's browser only. Every read and write is guarded so the
// app still runs when storage is blocked (private mode, cleared site data).

const KEY = 'heropad.v1';

const defaults = () => ({ hero: 'zip', tol: 'wide', sound: true, items: {}, missions: 0 });

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = { ...defaults(), ...JSON.parse(raw) };
      if (!d.items || typeof d.items !== 'object' || Array.isArray(d.items)) d.items = {};
      if (!Number.isFinite(d.missions)) d.missions = 0;
      return d;
    }
  } catch { /* fall through to defaults */ }
  return defaults();
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* not saved, still playable */ }
}
