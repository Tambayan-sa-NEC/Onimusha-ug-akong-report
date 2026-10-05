/**
 * The pause screen, and the settings and keymap pages behind it.
 *
 * DOM only, like everything else in ui/. It reads game state and calls into the
 * systems that own it; nothing here reaches into the world directly.
 */
import { abandonChallenge, ch, el, forfeitChallenge } from '../challenges/system.js';
import { BINDS, DEFAULT_BINDS, bindConflict, rebind, resetBinds } from '../config/keys.js';
import { CFG, DEFAULT_SETTINGS } from '../config/settings.js';
import { loadPrefs, savePrefs } from '../core/save.js';
import { session } from '../core/Session.js';
import { Sound } from '../systems/audio.js';
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
  sprint: 'Sprint', jump: 'Jump', interact: 'Talk / accept', dash: 'Shadow dash (kunoichi)',
  roll: 'Dodge roll (rōnin)', mute: 'Mute sound', pause: 'Pause',
};

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

  const vol = row(box, 'Volume');
  const slider = el('input', 'prange', undefined, vol);
  slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.05';
  slider.value = String(CFG.volume);
  slider.addEventListener('input', () => {
    CFG.volume = Number(slider.value);
    Sound.setVolume(CFG.volume);
    savePrefs();
  });

  checkbox(box, 'Mute', 'muted', v => Sound.setMuted(v));

  const sens = row(box, 'Look sensitivity');
  const ss = el('input', 'prange', undefined, sens);
  ss.type = 'range'; ss.min = '0.25'; ss.max = '3'; ss.step = '0.05';
  ss.value = String(CFG.lookSens);
  ss.addEventListener('input', () => { CFG.lookSens = Number(ss.value); savePrefs(); });

  checkbox(box, 'Invert look', 'invertLook');
  checkbox(box, 'Reduced motion', 'reducedMotion');

  const speed = row(box, 'Text speed');
  const ts = el('input', 'prange', undefined, speed);
  ts.type = 'range'; ts.min = '10'; ts.max = '120'; ts.step = '5';
  ts.value = String(CFG.textSpeed);
  ts.addEventListener('input', () => { CFG.textSpeed = Number(ts.value); savePrefs(); });

  button(box, 'Reset to defaults', 'pbtn', () => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) CFG[k] = v;
    Sound.setVolume(CFG.volume); Sound.setMuted(CFG.muted);
    savePrefs();
    show('settings');
  });
  button(box, 'Back', 'pbtn', back);
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
  el('p', 'phint', pause.listening
    ? `Press a key for "${ACTION_LABELS[pause.listening]}", or Escape to cancel.`
    : 'Click a binding to change it.', box);

  for (const action of Object.keys(DEFAULT_BINDS)) {
    const r = row(box, ACTION_LABELS[action] || action);
    const keys = el('div', 'pkeys', undefined, r);
    const listening = pause.listening === action;
    const text = listening ? 'press a key…' : (BINDS[action] || []).map(keyLabel).join('  /  ');
    button(keys, text, listening ? 'pkey listening' : 'pkey', () => {
      pause.listening = listening ? null : action;
      show('keys');
    });
  }
  button(box, 'Reset to defaults', 'pbtn', () => { resetBinds(); savePrefs(); show('keys'); });
  button(box, 'Back', 'pbtn', () => { pause.listening = null; back(); });
}

/** Draw whichever page is current. */
function show(page) {
  pause.page = page;
  const box = panel();
  box.innerHTML = '';
  const card = el('div', 'pcard', undefined, box);
  if (page === 'settings') renderSettings(card);
  else if (page === 'keys') renderKeys(card);
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
    if (code === 'Escape') pause.listening = null;          // cancel, do not bind Escape by accident
    else if (!bindConflict(code, pause.listening)) { rebind(pause.listening, [code]); pause.listening = null; savePrefs(); }
    else pause.listening = null;                            // taken: leave the old binding alone
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

/** Build the panel once, and restore whatever was saved last time. */
function initPause() {
  loadPrefs();
  Sound.setVolume(CFG.volume);
  Sound.setMuted(CFG.muted);
  panel().classList.remove('show');
}

export { closePause, initPause, keyLabel, openFromTitle, openPause, pause, pauseKey, quitToMenu, togglePause };
