/**
 * Sealed arenas for boss fights.
 *
 * Entering hides the planet, shows the arena's own geometry, and installs the
 * arena's ground under the player. Because `heightAt()` is the single source of
 * truth for ground height, swapping it is enough to put the player somewhere
 * else entirely — physics, the camera, collisions and shadows all follow.
 *
 * There is exactly one way in and one way out, which is what keeps the state safe.
 *
 * @hand-linked — imports are maintained here, not derived.
 */
import * as THREE from 'three';
import { clearKunai } from '../combat/kunai.js';
import { SKY, arenaRoot, scene, worldRoot } from '../core/Stage.js';
import { player } from '../entities/Player.js';
import { clearEmotes } from '../render/effects/emotes.js';
import { petals } from '../render/effects/petals.js';
import { cam, updateCamera } from '../systems/camera.js';
import { holdDaylight, releaseDaylight } from '../systems/daylight.js';
import { randTangent } from '../utils/sphere.js';
import { ARENAS } from './arenas/index.js';
import { setGroundOverride } from './terrain.js';

const built = new Map();              // id -> THREE.Group, built once on first entry
const worldFog = { near: 0, far: 0 };
let returnTo = null;

/** Stand the player at `dir`, facing `lookAt` if given, and snap the camera. */
function standPlayerAt(dir, lookAt) {
  const b = player.body;
  b.dir.copy(dir);
  b.lift = 0;
  b.vy = 0;
  b.grounded = true;
  b.fwd.copy(lookAt ? lookAt.clone().sub(dir) : randTangent(dir));
  b.fixFwd();
  b.sync();
  player.vel.set(0, 0, 0);
  cam.fwd.copy(b.fwd);
  updateCamera(1, 0);                 // a large dt snaps the camera rather than easing it
}

const arena = {
  active: null,

  /**
   * Pull the player into `id`. `home` is where they are standing now, and where
   * `exit()` will put them back.
   */
  enter(id, home) {
    const def = ARENAS[id];
    if (!def || this.active) return;

    if (!built.has(id)) {
      const g = def.build();
      arenaRoot.add(g);
      built.set(id, g);
    }
    for (const [key, g] of built) g.visible = key === id;

    returnTo = home.clone();
    this.active = def;

    // Install the ground before anything moves, so the first sync() lands on it.
    setGroundOverride(def.height);

    worldRoot.visible = false;
    petals.visible = false;
    arenaRoot.visible = true;

    // The hour stops painting the sky while somewhere else is showing. The clock
    // keeps running underneath, so a long fight ends later in the day than it began.
    holdDaylight();
    worldFog.near = scene.fog.near;
    worldFog.far = scene.fog.far;
    scene.background = new THREE.Color(def.sky);
    scene.fog.color.set(def.sky);
    scene.fog.near = def.fogNear;
    scene.fog.far = def.fogFar;

    clearEmotes();
    clearKunai();
    standPlayerAt(def.entry, def.centre);
  },

  /** Put everything back and return the player to where they came from. */
  exit() {
    if (!this.active) return;
    this.active = null;
    setGroundOverride(null);

    arenaRoot.visible = false;
    worldRoot.visible = true;
    petals.visible = true;

    // Hand the sky back to the clock, which repaints it at whatever hour it is now —
    // walking out of a boss fight into the same midday you left would be a lie.
    scene.fog.near = worldFog.near;
    scene.fog.far = worldFog.far;
    releaseDaylight();

    clearEmotes();
    clearKunai();
    standPlayerAt(returnTo, null);
    returnTo = null;
  },
};

export { arena };
