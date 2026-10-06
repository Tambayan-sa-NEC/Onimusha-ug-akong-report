/**
 * The heads-up display: what is drawn over the game while you play.
 *
 * DOM only. It reads the state the rest of the game already owns — the session,
 * the running challenge, the character sheet — and never writes to it.
 */
import { ch } from '../challenges/system.js';
import { playerHP } from '../combat/battle.js';
import { session } from '../core/Session.js';
import { initCompass, updateCompass } from './compass.js';
import { ending } from './ending.js';
import { initTouch, updateTouch } from './touch.js';
import { $ } from '../utils/dom.js';

/** Seconds of play before the controls card bows out, having said its piece. */
const HINT_FADE_AFTER = 45;

const hud = { played: 0, drawn: '' };
const ui = {};

/**
 * The hearts to draw: what is left in the current fight, or a full row outside one.
 * A finished fight still shows what it cost until it is torn down — you do not heal
 * while the result banner is up.
 */
function currentHearts() {
  const max = playerHP();
  const c = ch.active;
  const now = c && typeof c.php === 'number' ? c.php : max;
  return { now: Math.max(0, Math.min(now, max)), max };
}

/**
 * Hearts, as one element each. Filled and spent hearts use different glyphs as
 * well as different colours, so the row still reads without colour vision.
 */
function paintVitals() {
  const up = session.started && !ending.active;
  ui.vitals.classList.toggle('show', up);
  if (!up) { hud.drawn = ''; return; }

  const { now, max } = currentHearts();
  const key = `${now}/${max}`;
  if (key === hud.drawn) return;          // only touch the DOM when it actually changed
  hud.drawn = key;

  ui.vitals.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const spent = i >= now;
    const h = document.createElement('span');
    h.className = spent ? 'heart spent' : 'heart';
    h.textContent = spent ? '♡' : '♥';
    ui.vitals.appendChild(h);
  }
  ui.vitals.title = `${now} of ${max} hearts`;
}

/** Per-frame HUD upkeep. Cheap: it repaints only when something changed. */
function updateHud(dt) {
  if (session.started) hud.played += dt; else hud.played = 0;
  ui.hint.classList.toggle('fade', hud.played > HINT_FADE_AFTER);
  // The cutscene wants the screen to itself.
  ui.seals.classList.toggle('away', ending.active);
  paintVitals();
  updateCompass();
  updateTouch();
}

/** Grab the elements once, before the first frame. */
function initHud() {
  ui.vitals = $('vitals');
  ui.hint = $('hint');
  ui.seals = $('seals');
  hud.played = 0;
  hud.drawn = '';
  initCompass();
  initTouch();
  paintVitals();
}

export { HINT_FADE_AFTER, hud, initHud, updateHud };
