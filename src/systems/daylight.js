/**
 * The day/night cycle: four minutes round, two of daylight and two of night.
 *
 * Sky, fog, sun and hemisphere light are all owned by `core/Stage.js`, so this is
 * the one module that animates them. Everything else that wants a different sky —
 * a boss arena, a tea house — asks to be left alone while it is showing, and is
 * handed the sky of the hour back on the way out.
 */
import { CFG } from '../config/settings.js';
import * as THREE from 'three';
import { hemi, scene, sun } from '../core/Stage.js';

const DAY_LENGTH = 120;        // seconds of daylight
const NIGHT_LENGTH = 120;      // and of night
const CYCLE_LENGTH = DAY_LENGTH + NIGHT_LENGTH;

/** Start mid-morning, so the first thing anyone sees is a bright planet. */
const START_AT = 36;

/**
 * The cycle as a handful of moments, interpolated between. Times are seconds from
 * the start of the day; the list wraps, so midnight blends back round into dawn.
 */
const MOMENTS = [
  { at: 0, name: 'dawn',
    sky: '#e7b593', sun: '#ffcf9e', sunI: 0.45, hemiSky: '#ffe3cd', hemiGround: '#7a7f66', hemiI: 0.55,
    fogNear: 18, fogFar: 62 },
  { at: 30, name: 'morning',
    sky: '#c8dff0', sun: '#ffe6c8', sunI: 0.74, hemiSky: '#fff3e4', hemiGround: '#7c8f6c', hemiI: 0.68,
    fogNear: 22, fogFar: 75 },
  { at: 60, name: 'noon',
    sky: '#bcd9ea', sun: '#fff1d8', sunI: 0.85, hemiSky: '#fff8ee', hemiGround: '#83966f', hemiI: 0.74,
    fogNear: 24, fogFar: 80 },
  { at: 96, name: 'afternoon',
    sky: '#cbdcea', sun: '#ffe2bd', sunI: 0.72, hemiSky: '#fff2e2', hemiGround: '#7c8f6c', hemiI: 0.66,
    fogNear: 22, fogFar: 74 },
  { at: 120, name: 'dusk',
    sky: '#d98a63', sun: '#ff9f63', sunI: 0.40, hemiSky: '#f0bb9a', hemiGround: '#5e5a52', hemiI: 0.46,
    fogNear: 16, fogFar: 56 },
  { at: 150, name: 'nightfall',
    sky: '#4a4f74', sun: '#8fa3d6', sunI: 0.18, hemiSky: '#5a648c', hemiGround: '#363b48', hemiI: 0.30,
    fogNear: 13, fogFar: 44 },
  { at: 180, name: 'midnight',
    sky: '#1b2440', sun: '#8fa8e0', sunI: 0.12, hemiSky: '#38436b', hemiGround: '#262c38', hemiI: 0.24,
    fogNear: 11, fogFar: 38 },
  { at: 214, name: 'small hours',
    sky: '#2b3454', sun: '#9db2e6', sunI: 0.15, hemiSky: '#46527d', hemiGround: '#2c3340', hemiI: 0.28,
    fogNear: 13, fogFar: 44 },
];

/** What the sky looks like when the cycle is switched off. */
const FIXED = MOMENTS[2];      // noon

const daylight = { t: START_AT, held: 0 };

const _a = new THREE.Color(), _b = new THREE.Color();
const _sky = new THREE.Color(), _sun = new THREE.Color();
const _hs = new THREE.Color(), _hg = new THREE.Color();

const wrap = t => ((t % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
/** Night is the back half of the cycle. */
const isNight = () => wrap(daylight.t) >= DAY_LENGTH;
/** Which moment we are in, by name — handy for anything that wants to read the hour. */
function momentName() {
  const { from } = span(wrap(daylight.t));
  return from.name;
}

/** The two moments either side of `t`, and how far between them it sits. */
function span(t) {
  let i = 0;
  for (let k = 0; k < MOMENTS.length; k++) if (MOMENTS[k].at <= t) i = k;
  const from = MOMENTS[i];
  const to = MOMENTS[(i + 1) % MOMENTS.length];
  const end = to.at > from.at ? to.at : to.at + CYCLE_LENGTH;   // the last one wraps to the first
  const k = end === from.at ? 0 : (t - from.at) / (end - from.at);
  return { from, to, k };
}

const mix = (a, b, k) => a + (b - a) * k;

/** Paint the scene for one moment of the cycle. */
function paint(t) {
  const { from, to, k } = span(wrap(t));
  _sky.set(from.sky).lerp(_a.set(to.sky), k);
  _sun.set(from.sun).lerp(_b.set(to.sun), k);
  _hs.set(from.hemiSky).lerp(_a.set(to.hemiSky), k);
  _hg.set(from.hemiGround).lerp(_b.set(to.hemiGround), k);

  scene.background = _sky.clone();
  scene.fog.color.copy(_sky);
  scene.fog.near = mix(from.fogNear, to.fogNear, k);
  scene.fog.far = mix(from.fogFar, to.fogFar, k);

  sun.color.copy(_sun);
  sun.intensity = mix(from.sunI, to.sunI, k);
  hemi.color.copy(_hs);
  hemi.groundColor.copy(_hg);
  hemi.intensity = mix(from.hemiI, to.hemiI, k);
}

/** Paint the fixed daylight the game uses when the cycle is switched off. */
function paintFixed() {
  scene.background = new THREE.Color(FIXED.sky);
  scene.fog.color.set(FIXED.sky);
  scene.fog.near = FIXED.fogNear;
  scene.fog.far = FIXED.fogFar;
  sun.color.set(FIXED.sun);
  sun.intensity = FIXED.sunI;
  hemi.color.set(FIXED.hemiSky);
  hemi.groundColor.set(FIXED.hemiGround);
  hemi.intensity = FIXED.hemiI;
}

/**
 * Somewhere with a sky of its own is showing. The clock keeps running underneath —
 * you should come out of a long boss fight into a later hour than you went in.
 */
const holdDaylight = () => { daylight.held++; };
/** That place has gone; put the hour back on the sky. */
function releaseDaylight() {
  daylight.held = Math.max(0, daylight.held - 1);
  if (!daylight.held) applyDaylight();
}

/** Push the current hour onto the scene, unless something else owns the sky. */
function applyDaylight() {
  if (daylight.held) return false;
  if (CFG.dayNight) paint(daylight.t); else paintFixed();
  return true;
}

/** Advance the clock and repaint. Called every frame, menu or not. */
function updateDaylight(dt) {
  if (CFG.dayNight) daylight.t = wrap(daylight.t + dt);
  applyDaylight();
}

/** Put the clock at a given second of the cycle. */
function setTimeOfDay(t) { daylight.t = wrap(t); }

/** The sky colour at a given moment, without touching the scene. For tests and tools. */
function skyAt(t) {
  const { from, to, k } = span(wrap(t));
  return _a.set(from.sky).lerp(_b.set(to.sky), k).getHexString();
}

export {
  CYCLE_LENGTH, DAY_LENGTH, FIXED, MOMENTS, NIGHT_LENGTH, START_AT,
  applyDaylight, daylight, holdDaylight, isNight, momentName, paint, paintFixed,
  releaseDaylight, setTimeOfDay, skyAt, updateDaylight,
};
