/**
 * Vector maths for living on the surface of a sphere: tangents, headings, offsets.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { rand } from './random.js';
import { hitsCollider } from '../world/colliders.js';
import { onLand } from '../world/terrain.js';

const V3 = THREE.Vector3;

const Y_AXIS = new V3(0, 1, 0), X_AXIS = new V3(1, 0, 0);
const TB_U = new V3(), TB_V = new V3(), _cross = new V3();

/** Two unit vectors u, v spanning the tangent plane at unit normal n. */
function tangentBasis(n, u, v) {
  const ref = Math.abs(n.y) < 0.9 ? Y_AXIS : X_AXIS;
  u.crossVectors(ref, n).normalize();
  v.crossVectors(n, u);
}
function randomDir(rng = rand) {
  const z = rng() * 2 - 1, t = rng() * Math.PI * 2, s = Math.sqrt(1 - z * z);
  return new V3(s * Math.cos(t), z, s * Math.sin(t));
}
/** Direction reached by walking `dist` radians from c along bearing `ang`. */
function offsetDir(c, ang, dist, out = new V3()) {
  tangentBasis(c, TB_U, TB_V);
  const s = Math.sin(dist);
  return out.copy(c).multiplyScalar(Math.cos(dist))
    .addScaledVector(TB_U, Math.cos(ang) * s).addScaledVector(TB_V, Math.sin(ang) * s).normalize();
}
function randTangent(d, rng = rand) {
  tangentBasis(d, TB_U, TB_V);
  const a = rng() * Math.PI * 2;
  return new V3().copy(TB_U).multiplyScalar(Math.cos(a)).addScaledVector(TB_V, Math.sin(a));
}
/** Signed angle from a to b around axis n. */
function signedAngle(a, b, n) { return Math.atan2(_cross.crossVectors(a, b).dot(n), a.dot(b)); }
/** Unit tangent at `from` pointing toward `to`, or null if they coincide. */
function tangentToward(from, to, up, out) {
  out.subVectors(to, from).addScaledVector(up, -out.dot(up));
  const l = out.length();
  return l > 1e-5 ? out.divideScalar(l) : null;
}
/** Point `f` units forward and `s` units to the right of origin direction o. */
function localPoint(o, fwd, f, s) {
  const right = new V3().crossVectors(fwd, o);
  return o.clone().addScaledVector(fwd, f / R).addScaledVector(right, s / R).normalize();
}

function spotAround(from, minD, maxD) {
  for (let i = 0; i < 60; i++) {
    const d = offsetDir(from, Math.random() * 6.283, (minD + Math.random() * (maxD - minD)) / R);
    if (onLand(d) && !hitsCollider(d, 0.8)) return d;
  }
  return from.clone();
}

export { TB_U, TB_V, X_AXIS, Y_AXIS, localPoint, offsetDir, randTangent, randomDir, signedAngle, spotAround, tangentBasis, tangentToward };
