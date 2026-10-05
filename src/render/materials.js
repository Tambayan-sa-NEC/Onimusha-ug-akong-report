/**
 * Shared flat-shaded materials and primitive geometry, cached and reused.
 */
import * as THREE from 'three';
import { worldRoot } from '../core/Stage.js';
import { randTangent } from '../utils/sphere.js';
import { heightAt } from '../world/terrain.js';

const V3 = THREE.Vector3;

const matCache = new Map();
function M(color, emissive) {
  const key = color + (emissive || '');
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 0, emissive: emissive || '#000000' }));
  }
  return matCache.get(key);
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dode: new THREE.DodecahedronGeometry(1, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
  cone: new THREE.ConeGeometry(1, 1, 6),
  kasa: new THREE.ConeGeometry(1, 1, 8),
  roof: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),   // axis-aligned square pyramid
  trunk: new THREE.CylinderGeometry(0.12, 0.22, 1, 5).translate(0, 0.5, 0),
  hakama: new THREE.CylinderGeometry(0.3, 0.42, 0.55, 6),
  robe: new THREE.CylinderGeometry(0.3, 0.46, 0.92, 7),
  torus: new THREE.TorusGeometry(0.1, 0.045, 4, 7),
  ring: new THREE.TorusGeometry(1, 0.035, 3, 28).rotateX(Math.PI / 2),
  club: new THREE.CylinderGeometry(0.05, 0.11, 1.1, 6),
};
/** Mesh helper: part(geometry, color, [pos], scale|[scale], [rot], emissive) */
function part(geo, color, pos, scale, rot, emissive) {
  const m = new THREE.Mesh(geo, M(color, emissive));
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale !== undefined && scale !== null) {
    if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(scale[0], scale[1], scale[2]);
  }
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  return m;
}
function group(...children) { const g = new THREE.Group(); children.forEach(c => g.add(c)); return g; }

const _m4 = new THREE.Matrix4(), _or = new V3(), _of = new V3();
/** Orient obj so local +Y = up and local +Z = fwd (projected onto the tangent plane). */
function orient(obj, up, fwd) {
  _of.copy(fwd).addScaledVector(up, -fwd.dot(up)).normalize();
  _or.crossVectors(up, _of);
  _m4.makeBasis(_or, up, _of);
  obj.quaternion.setFromRotationMatrix(_m4);
}
function placeProp(obj, dir, fwd, sink = 0.1) {
  obj.position.copy(dir).multiplyScalar(heightAt(dir) - sink);
  orient(obj, dir, fwd || randTangent(dir));
  worldRoot.add(obj);
  return obj;
}

export { GEO, M, group, matCache, orient, part, placeProp };
