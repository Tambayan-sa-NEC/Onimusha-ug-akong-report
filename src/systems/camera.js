/**
 * Third-person camera that stays upright relative to the ground beneath you.
 */
import * as THREE from 'three';
import { CFG } from '../config/settings.js';
import { camera, hemi, sun } from '../core/Stage.js';
import { player } from '../entities/Player.js';
import { feedback } from '../render/effects/impact.js';
import { takeMouseDX } from './input.js';
import { damp } from '../utils/math.js';
import { tangentA } from '../utils/scratch.js';
import { signedAngle } from '../utils/sphere.js';
import { SPAWN_FWD } from '../world/layout.js';
import { heightAt } from '../world/terrain.js';

const V3 = THREE.Vector3;

const cam = { fwd: SPAWN_FWD.clone(), lastDrag: -10, shake: new V3() };
const _desired = new V3(), _cdir = new V3(), _look = new V3();
function updateCamera(dt, t) {
  const b = player.body, up = b.dir, P = b.obj.position;
  camera.position.sub(cam.shake);
  cam.fwd.addScaledVector(up, -cam.fwd.dot(up)).normalize();
  const dx = takeMouseDX();
  if (dx) { cam.fwd.applyAxisAngle(up, -dx * 0.005); cam.lastDrag = t; }
  // Drift behind the character while it moves (but not when it walks toward the camera).
  if (player.vel.length() > 0.5 && t - cam.lastDrag > 1.5) {
    const a = signedAngle(cam.fwd, b.fwd, up);
    if (Math.abs(a) < 2.3) cam.fwd.applyAxisAngle(up, a * damp(1.6, dt));
  }
  _desired.copy(P).addScaledVector(up, CFG.camHeight).addScaledVector(cam.fwd, -CFG.camDist);
  _cdir.copy(_desired).normalize();
  const minH = heightAt(_cdir) + 1.2;                               // don't clip into hills
  if (_desired.length() < minH) _desired.copy(_cdir).multiplyScalar(minH);
  camera.position.lerp(_desired, damp(5, dt));
  camera.up.lerp(up, damp(5, dt)).normalize();
  _look.copy(P).addScaledVector(up, 1.3).addScaledVector(cam.fwd, 1.2);
  camera.lookAt(_look);
  feedback.camShake = Math.max(0, feedback.camShake - dt * 1.6);
  cam.shake.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(feedback.camShake * 0.6);
  camera.position.add(cam.shake);

  // Lights ride along with the player.
  tangentA.crossVectors(cam.fwd, up);
  sun.position.copy(P).addScaledVector(up, 40).addScaledVector(tangentA, 18).addScaledVector(cam.fwd, -10);
  sun.target.position.copy(P);
  hemi.position.copy(up);
}

export { cam, updateCamera };
