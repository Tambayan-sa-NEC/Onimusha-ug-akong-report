/**
 * The pause screen, and the settings and keymap pages behind it.
 *
 * DOM only, like everything else in ui/. It reads game state and calls into the
 * systems that own it; nothing here reaches into the world directly.
 */
import {
  SEALS_FOR_GATE, abandonChallenge, bossWon, ch, el, forfeitChallenge, won,
} from '../challenges/system.js';
import { GAMES, GAME_ORDER } from '../challenges/games/index.js';
import { hostNameFor } from '../challenges/seals.js';
import { BOSS_ORDER } from '../data/bossDefs.js';
import { leaveRoom } from '../world/houses.js';
import {
  DEFAULT_BINDS, bindConflict, codesFor, removeBinding, resetBinds, setBinding,
} from '../config/keys.js';
import { CHARACTERS } from '../config/characters.js';
import { CFG, DEFAULT_SETTINGS } from '../config/settings.js';
import { collection } from '../core/keepsakes.js';
import { loadPrefs, savePrefs } from '../core/save.js';
import { session } from '../core/Session.js';
import { Sound } from '../systems/audio.js';
import { applyDaylight } from '../systems/daylight.js';
import { toMenu } from './characterSelect.js';
import { $ } from '../utils/dom.js';

/** Which page is showing, and whether the panel is up at all. */
const pause = { open: false, page: 'root', listening: null, fromTitle: false };

/** How a key code reads to a person: 'KeyW' -> 'W', 'ArrowUp' -> '↑'. */
const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
function keyLabel(code) {
  if (ARROWS[code]) return ARROWS[code];
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Numpad/, 'Num ')
    .replace(/^(Shift|Alt|Control|Meta)(Left|Right)$/, '$1 $2');
}
const ACTION_LABELS = {
  forward: 'Walk forward', back: 'Walk back', left: 'Turn left', right: 'Turn right',
  sprint: 'Sprint', jump: 'Jump', interact: 'Talk / accept', dash: 'Shadow dash',
  roll: 'Dodge roll', mute: 'Mute sound', pause: 'Pause',
};
/**
 * The controls read better grouped than as one flat column, and the two characters
 * have moves the other does not — so whose is whose is a heading rather than a
 * parenthesis after the label.
 */
const ACTION_GROUPS = [
  { title: 'Walking', actions: ['forward', 'back', 'left', 'right', 'sprint', 'jump'] },
  { title: 'Doing things', actions: ['interact', 'mute', 'pause'] },
  { title: CHARACTERS.samurai.name, actions: ['roll'] },
  { title: CHARACTERS.shinobi.name, actions: ['dash'] },
];

/* --------------------------------- the panel -------------------------------- */

function panel() { return $('pause'); }

/** A labelled row holding one control. */
function row(parent, label) {
  const r = el('div', 'prow', undefined, parent);
  el('div', 'plabel', label, r);
  return r;
}
function button(parent, label, cls, onClick) {
  const b = el('button', cls || 'pbtn', label, parent);
  b.addEventListener('click', onClick);
  return b;
}

function renderRoot(box) {
  el('h2', undefined, 'Paused', box);
  button(box, 'Resume', 'pbtn primary', closePause);
  button(box, 'Settings', 'pbtn', () => show('settings'));
  button(box, 'Controls', 'pbtn', () => show('keys'));
  button(box, 'Seals', 'pbtn', () => show('seals'));
  button(box, 'Keepsakes', 'pbtn', () => show('items'));
  // Only offered when there is something to bow out of.
  if (ch.active && !ch.active.done) {
    button(box, 'Forfeit challenge', 'pbtn', () => { forfeitChallenge(); closePause(); });
  }
  button(box, 'Quit to menu', 'pbtn danger', () => show('quit'));
}

/** Quitting throws the run away, so it is asked about rather than assumed. */
function renderQuit(box) {
  el('h2', undefined, 'Quit to menu?', box);
  el('p', 'phint', ch.active && !ch.active.done
    ? 'The challenge you are in will be given up, and your seals are not saved.'
    : 'Your seals are not saved, and the planet starts over.', box);
  button(box, 'Keep playing', 'pbtn primary', () => show('root'));
  button(box, 'Quit to menu', 'pbtn danger', quitToMenu);
}

function renderSettings(box) {
  el('h2', undefined, 'Settings', box);

  slider(box, 'Volume', 'volume', 0, 1, 0.05, v => Sound.setVolume(v));

  slider(box, 'Music', 'musicVolume', 0, 1, 0.05, v => Sound.setMusicVolume(v));
  slider(box, 'Effects', 'sfxVolume', 0, 1, 0.05, v => Sound.setSfxVolume(v));
  checkbox(box, 'Mute', 'muted', v => Sound.setMuted(v));

  slider(box, 'Look sensitivity', 'lookSens', 0.25, 3, 0.05);
  checkbox(box, 'Invert look', 'invertLook');
  slider(box, 'Camera distance', 'camDistance', 4.5, 13, 0.1, v => { CFG.camDist = v; });

  checkbox(box, 'Reduced motion', 'reducedMotion');
  slider(box, 'Text speed', 'textSpeed', 10, 120, 5);
  checkbox(box, 'Larger text', 'largeText', v => applyLargeText(v));
  checkbox(box, 'Day and night', 'dayNight', () => applyDaylight());
  checkbox(box, 'Compass', 'compass');

  button(box, 'Reset to defaults', 'pbtn', () => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) CFG[k] = v;
    applySettings();
    savePrefs();
    show('settings');
  });
  button(box, 'Back', 'pbtn', back);
}

/** A labelled range bound to one tunable. */
function slider(box, label, key, min, max, step, after) {
  const r = row(box, label);
  const i = el('input', 'prange', undefined, r);
  i.type = 'range'; i.min = String(min); i.max = String(max); i.step = String(step);
  i.value = String(CFG[key]);
  i.addEventListener('input', () => {
    CFG[key] = Number(i.value);
    if (after) after(CFG[key]);
    savePrefs();
  });
  return i;
}
function checkbox(box, label, key, after) {
  const r = row(box, label);
  const c = el('input', 'pcheck', undefined, r);
  c.type = 'checkbox';
  c.checked = !!CFG[key];
  c.addEventListener('change', () => {
    CFG[key] = !!c.checked;
    if (after) after(CFG[key]);
    savePrefs();
  });
  return c;
}

function renderKeys(box) {
  el('h2', undefined, 'Controls', box);
  const waiting = pause.listening;
  el('p', 'phint', waiting
    ? `Press a key for "${ACTION_LABELS[waiting.action]}", or Escape to cancel.`
    : 'Click a key to change it, + to add another, × to drop one.', box);

  for (const grp of ACTION_GROUPS) {
    el('div', 'pgroup', grp.title, box);
    for (const action of grp.actions) {
      if (!(action in DEFAULT_BINDS)) continue;
      const r = row(box, ACTION_LABELS[action] || action);
      const keys = el('div', 'pkeys', undefined, r);
      const codes = codesFor(action);
      codes.forEach((code, i) => {
        const live = waiting && waiting.action === action && waiting.slot === i;
        button(keys, live ? 'press a key…' : keyLabel(code),
          live ? 'pkey listening' : 'pkey',
          () => { pause.listening = live ? null : { action, slot: i }; show('keys'); });
        // Only offer to drop one while the action would still have a key left.
        if (codes.length > 1 && !live) {
          button(keys, '×', 'pkey drop',
            () => { removeBinding(action, i); savePrefs(); show('keys'); });
        }
      });
      const adding = waiting && waiting.action === action && waiting.slot === -1;
      button(keys, adding ? 'press a key…' : '+', adding ? 'pkey listening' : 'pkey add',
        () => { pause.listening = adding ? null : { action, slot: -1 }; show('keys'); });
    }
  }
  button(box, 'Reset to defaults', 'pbtn', () => { resetBinds(); savePrefs(); show('keys'); });
  button(box, 'Back', 'pbtn', () => { pause.listening = null; back(); });
}

/** The seal book in full: which yokai, which game, and whether it is yours. */
function renderSeals(box) {
  el('h2', undefined, 'Seals', box);
  el('p', 'phint',
    `${won.size} of ${GAME_ORDER.length} won — ${SEALS_FOR_GATE} of them open the gate on the far hill.`, box);
  const list = el('div', 'pseals', undefined, box);
  for (const key of GAME_ORDER) {
    const w = won.has(key);
    const r = el('div', w ? 'pseal won' : 'pseal', undefined, list);
    el('div', 'psseal', GAMES[key].seal, r);
    const text = el('div', 'pstext', undefined, r);
    el('div', 'psname', hostNameFor(key), text);
    el('div', 'psgame', GAMES[key].title, text);
    el('div', 'psmark', w ? '✓' : '', r);
    r.title = w ? 'Won' : 'Not yet';
  }
  // The two great yokai behind the gate.
  el('div', 'pgroup', 'Behind the gate', box);
  const greats = el('div', 'pseals', undefined, box);
  for (const b of BOSS_ORDER) {
    const w = bossWon.has(b.id);
    const r = el('div', w ? 'pseal won' : 'pseal', undefined, greats);
    el('div', 'psseal', b.seal, r);
    const text = el('div', 'pstext', undefined, r);
    el('div', 'psname', b.name, text);
    el('div', 'psgame', w ? 'felled' : 'waiting', text);
    el('div', 'psmark', w ? '✓' : '', r);
  }
  button(box, 'Back', 'pbtn', back);
}

/** What has been found, and the shape of what has not. */
function renderItems(box) {
  const all = collection();
  const have = all.filter(i => i.held).length;
  el('h2', undefined, 'Keepsakes', box);
  el('p', 'phint', `${have} of ${all.length} found — left in chests around the planet.`, box);
  const grid = el('div', 'pitems', undefined, box);
  for (const item of all) {
    const cell = el('div', item.held ? 'pitem found' : 'pitem', undefined, grid);
    el('div', 'piseal', item.held ? item.seal : '?', cell);
    el('div', 'piname', item.held ? item.name : '— — —', cell);
    if (item.held) el('div', 'piline', item.line, cell);
    cell.title = item.held ? item.line : 'Not found yet';
  }
  button(box, 'Back', 'pbtn', back);
}

/** Draw whichever page is current. */
function show(page) {
  pause.page = page;
  const box = panel();
  box.innerHTML = '';
  const card = el('div', 'pcard', undefined, box);
  if (page === 'settings') renderSettings(card);
  else if (page === 'keys') renderKeys(card);
  else if (page === 'seals') renderSeals(card);
  else if (page === 'items') renderItems(card);
  else if (page === 'quit') renderQuit(card);
  else renderRoot(card);
}

/* ------------------------------- open and close ------------------------------ */

/** Back out of a settings or controls page: to the pause root, or off the title. */
function back() { if (pause.fromTitle) closePause(); else show('root'); }

/** The same settings and controls pages, reached from the title screen. */
function openFromTitle(page) {
  if (session.started) return;
  pause.open = true;
  pause.fromTitle = true;
  pause.listening = null;
  show(page);
  panel().classList.add('show');
}

function openPause() {
  if (!session.started || pause.open) return;
  pause.open = true;
  pause.fromTitle = false;
  session.paused = true;
  pause.listening = null;
  show('root');
  panel().classList.add('show');
}
function closePause() {
  if (!pause.open) return;
  pause.open = false;
  pause.fromTitle = false;
  session.paused = false;
  pause.listening = null;
  panel().classList.remove('show');
}
const togglePause = () => (pause.open ? closePause() : openPause());

/** Leave the run entirely. Anything still running is torn down first. */
function quitToMenu() {
  abandonChallenge();     // toMenu refuses while a challenge is live
  leaveRoom();            // and the planet has to be back before the menu is
  closePause();
  toMenu();
}

/**
 * Keys while the panel is up. Returns true when the press was consumed, so the
 * rest of the game never sees it.
 */
function pauseKey(code) {
  if (!pause.open) return false;
  if (pause.listening) {
    const { action, slot } = pause.listening;
    // Escape cancels rather than binding itself, or there would be no way back out.
    if (code !== 'Escape' && !bindConflict(code, action)) { setBinding(action, slot, code); savePrefs(); }
    pause.listening = null;
    show('keys');
    return true;
  }
  if (code === 'Escape') {
    if (pause.page === 'root' || pause.fromTitle) closePause();
    else show('root');
    return true;
  }
  return true;   // paused: nothing else gets a look in
}

/** Bigger dialogue and prompts, for anyone who wants them. */
function applyLargeText(on) {
  const b = document.body;
  if (b && b.classList) b.classList.toggle('bigtext', !!on);
}

/** Push every setting out to whatever actually obeys it. */
function applySettings() {
  Sound.setVolume(CFG.volume);
  Sound.setMusicVolume(CFG.musicVolume);
  Sound.setSfxVolume(CFG.sfxVolume);
  Sound.setMuted(CFG.muted);
  CFG.camDist = CFG.camDistance;
  applyLargeText(CFG.largeText);
  applyDaylight();
}

/** Build the panel once, and restore whatever was saved last time. */
function initPause() {
  loadPrefs();
  applySettings();
  panel().classList.remove('show');
}

export { applyLargeText, applySettings, closePause, initPause, keyLabel, openFromTitle, openPause, pause, pauseKey, quitToMenu, togglePause };
