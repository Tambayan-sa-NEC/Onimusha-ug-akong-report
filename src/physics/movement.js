/**
 * Moving along the ground, sliding along shorelines instead of stopping dead.
 */
import * as THREE from 'three';
import { onLand } from '../world/terrain.js';

const V3 = THREE.Vector3;

const SLIDE = [0, 0.5, -0.5, 1.0, -1.0, 1.4, -1.4];
const _md = new V3();
/** Move along dir; if the way is water, try angled alternatives (slides along shores). */
function moveWithSlide(b, dir, dist) {
  for (const a of SLIDE) {
    _md.copy(dir);
    if (a) _md.applyAxisAngle(b.dir, a);
    if (b.step(_md, dist * Math.cos(a), onLand)) return true;
  }
  return false;
}

export { SLIDE, moveWithSlide };
