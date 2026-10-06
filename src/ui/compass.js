/**
 * The compass strip: which yokai still owe you a meeting, and which way they lie.
 *
 * A bearing tape across the top of the screen, one mark per seal you have yet to
 * win, placed by the direction of the nearest yokai hosting it. It reads the world
 * and never writes to it.
 */
import * as THREE from 'three';
import { GAMES, GAME_ORDER } from '../challenges/games/index.js';
import { sealTitle } from '../challenges/seals.js';
import { ch, hosts, won } from '../challenges/system.js';
import { CFG, R } from '../config/settings.js';
import { session } from '../core/Session.js';
import { player } from '../entities/Player.js';
import { cam } from '../systems/camera.js';
import { ending } from './ending.js';
import { $ } from '../utils/dom.js';
import { angleBetween, clamp } from '../utils/math.js';
import { signedAngle, tangentToward } from '../utils/sphere.js';
import { arena } from '../world/Arena.js';

const V3 = THREE.Vector3;

/** How far either side of where you are looking the strip reaches. */
const COMPASS_FOV = Math.PI / 2;
/** Drawn in full within COMPASS_NEAR, at its faintest past COMPASS_FAR. */
const COMPASS_NEAR = 15, COMPASS_FAR = 70, COMPASS_DIM = 0.35;

const compass = { keys: '', cells: new Map() };
const ui = {};
const _t = new V3();

/** Only while you are out walking the planet, with seals left to win. */
const compassUp = () => !!(CFG.compass && session.started
  && !ch.active && !arena.active && !ending.active
  && won.size < GAME_ORDER.length);

/**
 * How far you would have to walk, not how far it is through the planet. On a sphere
 * the chord badly understates the journey — half a world away is a short straight line.
 */
const walkTo = dir => angleBetween(player.body.dir, dir) * R;

/**
 * Where each unwon seal lies, as marks ready to draw. `bearing` is measured from
 * where the camera looks, positive to the right of the screen; `x` is that as a
 * percentage across the strip.
 *
 * Anything past the end of the strip would otherwise vanish, which would leave an
 * empty strip meaning both "nothing left" and "you are facing the wrong way". So the
 * nearest one off each end is pinned there instead — at most one a side, or the ends
 * would pile up.
 */
function compassMarks() {
  const up = player.body.dir;
  // Several yokai host the same game, so one pass finds the nearest of each.
  const nearest = new Map();
  for (const h of hosts) {
    const key = h.def.game;
    if (!key || won.has(key)) continue;
    const dist = walkTo(h.b.dir);
    const best = nearest.get(key);
    if (!best || dist < best.dist) nearest.set(key, { dir: h.b.dir, dist });
  }

  const marks = [], pinned = {};
  for (const key of GAME_ORDER) {
    const near = nearest.get(key);
    if (!near || !tangentToward(up, near.dir, up, _t)) continue;
    const bearing = -signedAngle(cam.fwd, _t, up);
    const m = {
      key, seal: GAMES[key].seal, title: sealTitle(key), bearing, dist: near.dist,
      fade: 1 - COMPASS_DIM * clamp((near.dist - COMPASS_NEAR) / (COMPASS_FAR - COMPASS_NEAR), 0, 1),
      x: 50 + (bearing / COMPASS_FOV) * 50,
      edge: false,
    };
    if (Math.abs(bearing) <= COMPASS_FOV) { marks.push(m); continue; }
    const side = bearing > 0 ? 'right' : 'left';
    m.edge = true;
    m.x = bearing > 0 ? 100 : 0;
    if (!pinned[side] || near.dist < pinned[side].dist) pinned[side] = m;
  }
  for (const m of Object.values(pinned)) marks.push(m);
  return marks;
}

/**
 * Draw the strip. One element per seal you still owe, so turning on the spot moves
 * marks rather than rebuilding them; the set only changes when you win one.
 */
function paintCompass() {
  const up = compassUp();
  ui.wrap.classList.toggle('show', up);
  if (!up) { if (compass.keys) clearCompass(); return; }

  const keys = GAME_ORDER.filter(k => !won.has(k)).join();
  if (keys !== compass.keys) {
    clearCompass();
    compass.keys = keys;
    for (const key of GAME_ORDER) {
      if (won.has(key)) continue;
      const s = document.createElement('span');
      s.className = 'cmark';
      s.textContent = GAMES[key].seal;
      s.title = sealTitle(key);          // the glyph alone does not say who it is
      ui.wrap.appendChild(s);
      compass.cells.set(key, s);
    }
  }
  const drawn = new Map(compassMarks().map(m => [m.key, m]));
  for (const [key, s] of compass.cells) {
    const m = drawn.get(key);
    s.classList.toggle('off', !m);
    s.classList.toggle('edge', !!(m && m.edge));
    s.classList.toggle('right', !!(m && m.edge && m.bearing > 0));   // which end it is pinned to
    if (!m) continue;
    s.style.left = `${m.x}%`;
    s.style.opacity = m.fade.toFixed(2);
  }
}
function clearCompass() {
  ui.wrap.innerHTML = '';
  compass.cells.clear();
  compass.keys = '';
}

/** Per-frame upkeep, driven by the HUD. */
const updateCompass = () => paintCompass();

/** Grab the element once, before the first frame. */
function initCompass() {
  ui.wrap = $('compass');
  clearCompass();
  paintCompass();
}

export { COMPASS_FAR, COMPASS_FOV, COMPASS_NEAR, compass, compassMarks, compassUp, initCompass, updateCompass };
