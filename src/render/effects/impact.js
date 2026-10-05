/**
 * Hit-stop, camera shake and the hurt vignette — the feel of a landed blow.
 */
import { R } from '../../config/settings.js';
import { makeShockRing, removeMesh, updateShockRing } from './rings.js';

/* ---------- Impact feel: hit-stop, camera shake, hit flash, sparks, shock rings ---------- */
/** The physical feedback of a landed blow: read by the loop, the camera and the HUD. */
const feedback = { hitStop: 0, camShake: 0, hurtGlow: 0 };
const hurtFx = document.getElementById('hurtFx');
function impact(stop, shake) { feedback.hitStop = Math.max(feedback.hitStop, stop); feedback.camShake = Math.max(feedback.camShake, shake); }

const shockFx = [];   // quick white rings when a yokai strikes the ground
function shockwave(center, radius) {
  const r = makeShockRing(center);
  shockFx.push({ r, t: 0, radius });
}
function updateShockFx(dt) {
  for (let i = shockFx.length - 1; i >= 0; i--) {
    const s = shockFx[i];
    s.t += dt;
    const k = s.t / 0.3;
    if (k >= 1) { removeMesh(s.r.mesh); shockFx.splice(i, 1); continue; }
    s.r.a = (0.3 + k * s.radius) / R;
    updateShockRing(s.r);
    s.r.mesh.material.opacity = 0.9 * (1 - k);
  }
}

export { feedback, hurtFx, impact, shockFx, shockwave, updateShockFx };
