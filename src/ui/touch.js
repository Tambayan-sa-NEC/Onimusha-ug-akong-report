/**
 * The on-screen controls, for playing with thumbs.
 *
 * A floating stick under the left thumb, an action cluster under the right, and the
 * rest of the screen given over to looking around. The buttons have no idea of their
 * own about what anything means: they call the same `pressKey` the keyboard calls, so
 * the menu, the pause screen, the ending and all ten mini-games answer a thumb
 * without knowing one is there.
 *
 * Owns its own elements' pointer events, the way `pause.js` and the mini-games own
 * theirs, and writes no input state directly — `systems/input.js` still keeps that.
 */
import { ch } from '../challenges/system.js';
import { codesFor } from '../config/keys.js';
import { CFG } from '../config/settings.js';
import { session } from '../core/Session.js';
import { player } from '../entities/Player.js';
import { lookBy, pressAttack, pressKey, releaseKey, setMove } from '../systems/input.js';
import { ending } from './ending.js';
import { $, coarse } from '../utils/dom.js';

/** How far from where your thumb landed the knob travels, in CSS pixels. */
const STICK_R = 52;
/** Pushed more than this much of the way out, you are running. */
const SPRINT_AT = 0.85;

const touch = {
  coarse: false, built: false, els: {},
  stick: { id: null, x0: 0, y0: 0 },
  look: { id: null, x: 0 },
};

/** Whether the controls are up: only on a touch device, and only while playing. */
const touchOn = () => !!(touch.coarse && CFG.touchControls && session.started && !ending.active);

/* --------------------------------- the stick --------------------------------- */

/** Place the knob and report the push, clamped to the rim. */
function pushStick(dx, dy) {
  const len = Math.hypot(dx, dy);
  const k = len > STICK_R ? STICK_R / len : 1;
  const x = dx * k, y = dy * k;
  touch.els.knob.style.left = `${x}px`;
  touch.els.knob.style.top = `${y}px`;
  // Up the screen is forward, so the y axis turns over on the way out.
  const mx = x / STICK_R, mz = -y / STICK_R;
  setMove(mx, mz, Math.hypot(mx, mz) > SPRINT_AT);
}
/** Drop whatever was being held, for when the controls go away mid-push. */
function releaseAll() {
  touch.stick.id = null;
  touch.look.id = null;
  if (touch.els.stick) touch.els.stick.classList.remove('show');
  setMove(0, 0, false);
}

/* -------------------------------- building them -------------------------------- */

function make(cls, text, parent) {
  const e = document.createElement('div');
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

/** A button that holds a key down for as long as a thumb is on it. */
function holdsKey(el, code) {
  el.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    el.classList.add('on');
    pressKey(code());
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) {
    el.addEventListener(t, () => { el.classList.remove('on'); releaseKey(code()); });
  }
}
/** Which of the two characters' moves the single special button stands for. */
const specialAction = () => (player.char && player.char.art === 'kunai' ? 'dash' : 'roll');

function build() {
  const e = touch.els, wrap = e.wrap;
  wrap.innerHTML = '';
  e.move = make('tzone tmove', undefined, wrap);
  e.look = make('tzone tlook', undefined, wrap);
  e.stick = make('tstick', undefined, wrap);
  e.knob = make('tknob', undefined, e.stick);
  e.pause = make('tbtn tpause', '❙❙', wrap);
  e.e = make('tbtn te', 'E', wrap);
  e.atk = make('tbtn tatk', '⚔', wrap);
  e.jump = make('tbtn tjump', '↑', wrap);
  e.special = make('tbtn tsp', '転', wrap);

  // The stick appears wherever the left thumb lands, rather than asking a thumb to
  // find a fixed spot it cannot see underneath itself.
  e.move.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    touch.stick.id = ev.pointerId;
    touch.stick.x0 = ev.clientX;
    touch.stick.y0 = ev.clientY;
    if (e.move.setPointerCapture) e.move.setPointerCapture(ev.pointerId);
    e.stick.classList.add('show');
    e.stick.style.left = `${ev.clientX}px`;
    e.stick.style.top = `${ev.clientY}px`;
    pushStick(0, 0);
  });
  e.move.addEventListener('pointermove', ev => {
    if (touch.stick.id !== ev.pointerId) return;
    pushStick(ev.clientX - touch.stick.x0, ev.clientY - touch.stick.y0);
  });
  for (const t of ['pointerup', 'pointercancel']) {
    e.move.addEventListener(t, ev => {
      if (touch.stick.id !== ev.pointerId) return;
      touch.stick.id = null;
      e.stick.classList.remove('show');
      pushStick(0, 0);
    });
  }

  e.look.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    touch.look.id = ev.pointerId;
    touch.look.x = ev.clientX;
    if (e.look.setPointerCapture) e.look.setPointerCapture(ev.pointerId);
  });
  e.look.addEventListener('pointermove', ev => {
    if (touch.look.id !== ev.pointerId) return;
    lookBy(ev.clientX - touch.look.x);
    touch.look.x = ev.clientX;
  });
  for (const t of ['pointerup', 'pointercancel']) {
    e.look.addEventListener(t, ev => { if (touch.look.id === ev.pointerId) touch.look.id = null; });
  }

  holdsKey(e.jump, () => codesFor('jump')[0]);
  holdsKey(e.e, () => codesFor('interact')[0]);
  holdsKey(e.pause, () => codesFor('pause')[0]);
  holdsKey(e.special, () => codesFor(specialAction())[0]);
  // The attack is the one thing the keyboard never had: it is the left mouse button.
  e.atk.addEventListener('pointerdown', ev => { ev.preventDefault(); e.atk.classList.add('on'); pressAttack(); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) {
    e.atk.addEventListener(t, () => e.atk.classList.remove('on'));
  }

  if (e.fs) e.fs.addEventListener('pointerdown', ev => { ev.preventDefault(); toggleFullscreen(); });
  if (e.rotateGo) {
    e.rotateGo.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      document.body.classList.add('norotate');   // suggested once, then never again
    });
  }
  touch.built = true;
}

/** Browser chrome eats about a third of a phone screen. This asks for it back. */
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); }
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  } catch { /* a browser that will not, and nothing worth doing about that */ }
}

/* ---------------------------------- per frame ---------------------------------- */

function updateTouch() {
  if (!touch.els.wrap) return;
  const on = touchOn();
  touch.els.wrap.classList.toggle('show', on);
  // The fullscreen offer belongs on the opening screens, not over the game.
  if (touch.els.fs) touch.els.fs.classList.toggle('show', touch.coarse && !session.started);
  if (!on) {
    if (touch.stick.id !== null || touch.look.id !== null) releaseAll();
    return;
  }
  // A locked mini-game wants its own keys; the blade and the dodge are no use in one.
  const locked = !!(ch.active && ch.active.g.locks);
  touch.els.atk.classList.toggle('off', locked);
  touch.els.special.classList.toggle('off', locked);
  touch.els.special.textContent = specialAction() === 'dash' ? '影' : '転';
}

/** Build the controls once, before the first frame, if this is a device that wants them. */
function initTouch() {
  touch.els = { wrap: $('touch'), fs: $('fs'), rotateGo: $('rotateGo') };
  touch.coarse = coarse();
  touch.built = false;
  releaseAll();
  if (touch.coarse) {
    build();
    document.body.classList.add('touch');   // the hint card and the panels read this
  } else {
    touch.els.wrap.innerHTML = '';
  }
  updateTouch();
}

export { SPRINT_AT, STICK_R, initTouch, toggleFullscreen, touch, touchOn, updateTouch };
