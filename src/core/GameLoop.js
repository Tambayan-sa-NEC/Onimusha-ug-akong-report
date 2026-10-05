/**
 * The requestAnimationFrame loop: timing, hit-stop, and the frame order.
 */
import { updateChallenge } from '../challenges/system.js';
import { updateCombat } from '../combat/katana.js';
import { CFG } from '../config/settings.js';
import { session } from './Session.js';
import { camera, renderer, scene } from './Stage.js';
import { updatePlayer } from '../entities/Player.js';
import { updateEmotes } from '../render/effects/emotes.js';
import { feedback } from '../render/effects/impact.js';
import { updatePetals } from '../render/effects/petals.js';
import { updateCamera } from '../systems/camera.js';
import { updateHunts } from '../systems/hunting.js';
import { updateInteraction } from '../systems/interaction.js';
import { updateEnding } from '../ui/ending.js';
import { bosses, critters, npcs } from '../world/entities.js';
import { CLOUD_AXIS, cloudRoot } from '../world/scenery.js';
import { water } from '../world/terrain.js';

let last = 0, time = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  const raw = Math.min(0.05, now - last);
  // `last` advances even while paused, so resuming never hands the first frame a
  // delta the size of the whole pause.
  last = now;
  if (session.paused) { renderer.render(scene, camera); return; }

  let dt = raw;
  if (feedback.hitStop > 0) {
    feedback.hitStop = Math.max(0, feedback.hitStop - raw);
    if (!CFG.reducedMotion) dt = raw * 0.08;   // freeze-frame on big hits
  }
  time += dt;

  updatePlayer(dt, time);
  updateHunts(dt);
  for (const c of critters) c.update(dt, time);
  for (const n of npcs) n.update(dt, time);
  for (const b of bosses) b.update(dt, time);
  updateInteraction(dt);
  updateChallenge(dt);
  updateCombat(dt, time);
  updateEmotes(dt);
  if (!CFG.reducedMotion) updatePetals(dt, time);
  water.rotation.y += dt * 0.004;   // slow facet shimmer
  cloudRoot.rotateOnAxis(CLOUD_AXIS, dt * 0.012);
  updateCamera(dt, time);
  updateEnding(dt);

  renderer.render(scene, camera);
}
/** Begin the loop. Snaps the player and camera into place on the first frame. */
function startLoop() {
  last = performance.now() / 1000;
  updatePlayer(0, 0);
  updateCamera(1, 0);
  frame();
}

export { frame, last, startLoop, time };
