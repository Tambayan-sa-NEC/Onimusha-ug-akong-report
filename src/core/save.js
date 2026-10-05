/**
 * Preferences that outlive the tab: settings and key bindings.
 *
 * Storage is treated as something that may not be there and may refuse to be
 * written — private browsing denies it outright — so every path here is
 * survivable. A failure to save is never worth losing the game over.
 */
import { BINDS, DEFAULT_BINDS, rebind, resetBinds } from '../config/keys.js';
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

/** Forget everything saved and go back to the defaults. */
function resetPrefs() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) CFG[key] = value;
  resetBinds();
  const s = store();
  if (s) { try { s.removeItem(SAVE_KEY); } catch { /* nothing worth doing */ } }
}

export { SAVE_KEY, SAVE_VERSION, loadPrefs, resetPrefs, savePrefs };
