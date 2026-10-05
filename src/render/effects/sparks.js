/**
 * One pooled particle system for every burst in the game.
 */
import * as THREE from 'three';
import { scene } from '../../core/Stage.js';
import { randomDir } from '../../utils/sphere.js';

const SPARK_N = 200;
const sparkPos = new Float32Array(SPARK_N * 3), sparkCol = new Float32Array(SPARK_N * 3);
const sparkVel = new Float32Array(SPARK_N * 3), sparkLife = new Float32Array(SPARK_N);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.17, vertexColors: true, sizeAttenuation: true }));
sparks.frustumCulled = false;   // dead sparks park at the planet centre, hidden by the ground
scene.add(sparks);
let sparkHead = 0;
const _sc = new THREE.Color();
/** Spray `count` particles from pos. colors: array of hex strings. */
function burst(pos, up, count, colors, speed = 5, upBias = 0.6) {
  for (let n = 0; n < count; n++) {
    const i = sparkHead++ % SPARK_N, k = i * 3;
    const v = randomDir(Math.random).multiplyScalar(speed * (0.4 + Math.random() * 0.6)).addScaledVector(up, speed * upBias);
    sparkPos[k] = pos.x; sparkPos[k + 1] = pos.y; sparkPos[k + 2] = pos.z;
    sparkVel[k] = v.x; sparkVel[k + 1] = v.y; sparkVel[k + 2] = v.z;
    _sc.set(colors[n % colors.length]).toArray(sparkCol, k);
    sparkLife[i] = 0.3 + Math.random() * 0.3;
  }
  sparkGeo.attributes.color.needsUpdate = true;
}
function updateSparks(dt) {
  for (let i = 0; i < SPARK_N; i++) {
    const k = i * 3;
    if (sparkLife[i] <= 0) continue;
    if ((sparkLife[i] -= dt) <= 0) { sparkPos[k] = sparkPos[k + 1] = sparkPos[k + 2] = 0; continue; }
    const len = Math.hypot(sparkPos[k], sparkPos[k + 1], sparkPos[k + 2]) || 1, g = 9 * dt / len, drag = 1 - 2.5 * dt;
    for (let a = 0; a < 3; a++) {
      sparkVel[k + a] = (sparkVel[k + a] - sparkPos[k + a] * g) * drag;   // planet gravity + air drag
      sparkPos[k + a] += sparkVel[k + a] * dt;
    }
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

export { SPARK_N, burst, sparkCol, sparkGeo, sparkHead, sparkLife, sparkPos, sparkVel, sparks, updateSparks };
