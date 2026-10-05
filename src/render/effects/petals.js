/**
 * The sakura petal field that follows the player around the planet.
 */
import * as THREE from 'three';
import { R } from '../../config/settings.js';
import { scene } from '../../core/Stage.js';
import { player } from '../../entities/Player.js';
import { offsetDir } from '../../utils/sphere.js';
import { heightAt } from '../../world/terrain.js';

const V3 = THREE.Vector3;

// Sakura petals drift down around the player.
const PETAL_N = 220;
const petalPos = new Float32Array(PETAL_N * 3), petalPhase = new Float32Array(PETAL_N);
const petalGeo = new THREE.BufferGeometry();
petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({ color: '#f6b3c7', size: 0.2, sizeAttenuation: true }));
petals.frustumCulled = false;
scene.add(petals);
const WIND = new V3(0.8, 0.1, 0.5).normalize();
const _pp = new V3(), _pu = new V3(), _pw = new V3(), _ps = new V3(), _pd = new V3();
function respawnPetal(i, anyHeight) {
  const d = offsetDir(player.body.dir, Math.random() * 6.283, Math.random() * 20 / R, _pd);
  const h = heightAt(d) + (anyHeight ? Math.random() * 11 : 6 + Math.random() * 6);
  petalPos[i * 3] = d.x * h; petalPos[i * 3 + 1] = d.y * h; petalPos[i * 3 + 2] = d.z * h;
  petalPhase[i] = Math.random() * 6.283;
}
function updatePetals(dt, t) {
  const P = player.body.obj.position;
  for (let i = 0; i < PETAL_N; i++) {
    _pp.set(petalPos[i * 3], petalPos[i * 3 + 1], petalPos[i * 3 + 2]);
    _pu.copy(_pp).normalize();
    _pw.copy(WIND).addScaledVector(_pu, -WIND.dot(_pu));
    _ps.crossVectors(_pu, _pw);
    _pp.addScaledVector(_pu, -0.8 * dt).addScaledVector(_pw, 0.9 * dt).addScaledVector(_ps, Math.sin(t * 2 + petalPhase[i]) * 0.5 * dt);
    if (_pp.length() < heightAt(_pu) + 0.05 || _pp.distanceToSquared(P) > 28 * 28) { respawnPetal(i, false); continue; }
    petalPos[i * 3] = _pp.x; petalPos[i * 3 + 1] = _pp.y; petalPos[i * 3 + 2] = _pp.z;
  }
  petalGeo.attributes.position.needsUpdate = true;
}

export { PETAL_N, WIND, petalGeo, petalPhase, petalPos, petals, respawnPetal, updatePetals };
