/**
 * Briefly paints a model white when it is struck.
 */
import * as THREE from 'three';

const FLASH_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const flashes = new Map();   // object -> seconds left
/** Paint every mesh of obj solid white for a moment (swaps materials, restores after). */
function flash(obj, t = 0.09) {
  if (!flashes.has(obj)) obj.traverse(m => { if (m.isMesh) { m.userData.mat = m.material; m.material = FLASH_MAT; } });
  flashes.set(obj, t);
}
function updateFlashes(dt) {
  for (const [obj, t] of flashes) {
    if (t - dt > 0) { flashes.set(obj, t - dt); continue; }
    obj.traverse(m => { if (m.isMesh && m.userData.mat) { m.material = m.userData.mat; m.userData.mat = null; } });
    flashes.delete(obj);
  }
}

export { FLASH_MAT, flash, flashes, updateFlashes };
