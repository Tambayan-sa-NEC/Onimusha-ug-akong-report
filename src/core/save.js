/**
 * What outlives the tab: settings, key bindings, and how far a run has got.
 *
 * Storage is treated as something that may not be there and may refuse to be
 * written — private browsing denies it outright — so every path here is
 * survivable. A failure to save is never worth losing the game over.
 */
import { BINDS, DEFAULT_BINDS, rebind, resetBinds } from '../config/keys.js';
import { CHARACTERS } from '../config/characters.js';
import { CFG, DEFAULT_SETTINGS } from '../config/settings.js';

const SAVE_KEY = 'onimusha.prefs';
const SAVE_VERSION = 1;

/** localStorage, or null when it is missing or walled off. */
function store() {
  try {
    const s = globalThis.localStorage;
    return s && typeof s.getItem === 'function' ? s : null;
  } catch { return null; }   // some browsers throw on access alone
}

/** Write the current settings and bindings. Silent on failure, by design. */
function savePrefs() {
  const s = store();
  if (!s) return false;
  const settings = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) settings[key] = CFG[key];
  try {
    s.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, settings, binds: BINDS }));
    return true;
  } catch { return false; }
}

/**
 * Restore what was saved, ignoring anything that does not belong: a save from
 * another version, corrupt JSON, unknown settings, unknown actions.
 */
function loadPrefs() {
  const s = store();
  if (!s) return false;
  let data;
  try { data = JSON.parse(s.getItem(SAVE_KEY)); } catch { return false; }
  if (!data || data.v !== SAVE_VERSION) return false;

  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      // Only keys the game already knows, and only of the type it expects.
      if (!(key in DEFAULT_SETTINGS)) continue;
      if (typeof value !== typeof DEFAULT_SETTINGS[key]) continue;
      CFG[key] = value;
    }
  }
  if (data.binds) {
    for (const [action, codes] of Object.entries(data.binds)) {
      if (!(action in DEFAULT_BINDS) || !Array.isArray(codes) || !codes.length) continue;
      if (codes.some(c => typeof c !== 'string')) continue;
      rebind(action, codes);
    }
  }
  return true;
}

/* ------------------------------- run progress ------------------------------- */

/**
 * Progress is kept apart from preferences: clearing one must not clear the other,
 * and a run is only worth restoring while it is unfinished.
 */
function readSave() {
  const s = store();
  if (!s) return null;
  try {
    const data = JSON.parse(s.getItem(SAVE_KEY));
    return data && data.v === SAVE_VERSION ? data : null;
  } catch { return null; }
}
function writeSave(data) {
  const s = store();
  if (!s) return false;
  try { s.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

/** Remember a run in progress: who you are and what you have won. */
function saveProgress(progress) {
  const data = readSave() || { v: SAVE_VERSION };
  data.progress = {
    char: progress.char,
    won: [...progress.won],
    bossWon: [...progress.bossWon],
    slain: [...progress.slain],
    held: [...(progress.held || [])],
    opened: [...(progress.opened || [])],
    pet: progress.pet || null,
  };
  const settings = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) settings[key] = CFG[key];
  data.settings = settings;
  data.binds = BINDS;
  return writeSave(data);
}

/**
 * A run worth offering to continue, or null. Anything malformed is treated as
 * nothing rather than half-restored.
 */
function loadProgress() {
  const data = readSave();
  const p = data && data.progress;
  if (!p || typeof p.char !== 'string' || !CHARACTERS[p.char]) return null;
  const list = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
  const progress = {
    char: p.char, won: list(p.won), bossWon: list(p.bossWon), slain: list(p.slain),
    held: list(p.held), opened: list(p.opened),
    pet: typeof p.pet === 'string' ? p.pet : null,
  };
  // Nothing found and nothing won is not a run worth continuing.
  if (!progress.won.length && !progress.bossWon.length && !progress.held.length) return null;
  return progress;
}
const hasProgress = () => loadProgress() !== null;

/** Forget the run, but keep the settings and bindings. */
function clearProgress() {
  const data = readSave();
  if (!data) return false;
  delete data.progress;
  return writeSave(data);
}

/** Forget everything saved and go back to the defaults. */
function resetPrefs() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) CFG[key] = value;
  resetBinds();
  const s = store();
  if (s) { try { s.removeItem(SAVE_KEY); } catch { /* nothing worth doing */ } }
}

export { SAVE_KEY, SAVE_VERSION, clearProgress, hasProgress, loadPrefs, loadProgress, resetPrefs, savePrefs, saveProgress };
