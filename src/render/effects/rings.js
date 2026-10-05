/**
 * Rings that hug the curved ground: attack telegraphs and shockwaves.
 */
import * as THREE from 'three';
import { R } from '../../config/settings.js';
import { scene } from '../../core/Stage.js';
import { orient } from '../materials.js';
import { TB_U, TB_V, tangentBasis } from '../../utils/sphere.js';
import { heightAt } from '../../world/terrain.js';

const V3 = THREE.Vector3;

/* ---------- Shared 3D helpers: target beacon + shockwave rings ---------- */
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, 16, 8, 1, true).translate(0, 8, 0),
  new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
beacon.visible = false;
scene.add(beacon);
function showBeacon(dir) {
  beacon.visible = true;
  beacon.position.copy(dir).multiplyScalar(heightAt(dir));
  tangentBasis(dir, TB_U, TB_V);
  orient(beacon, dir, TB_U);
}
const RING_N = 48, _rd = new V3();
function makeShockRing(center) {
  const pos = new Float32Array((RING_N + 1) * 6), idx = [];
  for (let i = 0; i < RING_N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#7cc2ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const r = { mesh, pos, a: 0.5 / R, c: center.clone(), u: new V3(), v: new V3() };
  tangentBasis(r.c, r.u, r.v);
  return r;
}
/** Rebuild the ring as a low wall hugging the curved ground at angular radius r.a. */
function updateShockRing(r) {
  const s = Math.sin(r.a), co = Math.cos(r.a);
  for (let i = 0; i <= RING_N; i++) {
    const th = i / RING_N * Math.PI * 2;
    _rd.copy(r.c).multiplyScalar(co).addScaledVector(r.u, Math.cos(th) * s).addScaledVector(r.v, Math.sin(th) * s).normalize();
    const h = Math.max(heightAt(_rd), R), k = i * 6;
    r.pos[k] = _rd.x * (h + 0.02); r.pos[k + 1] = _rd.y * (h + 0.02); r.pos[k + 2] = _rd.z * (h + 0.02);
    r.pos[k + 3] = _rd.x * (h + 0.45); r.pos[k + 4] = _rd.y * (h + 0.45); r.pos[k + 5] = _rd.z * (h + 0.45);
  }
  r.mesh.geometry.attributes.position.needsUpdate = true;
}
function removeMesh(m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }

export { RING_N, beacon, makeShockRing, removeMesh, showBeacon, updateShockRing };
