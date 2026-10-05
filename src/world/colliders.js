/**
 * Reserved space on the planet, and the queries that keep things out of each other.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { randomDir } from '../utils/sphere.js';
import { heightAt, onLand } from './terrain.js';

const V3 = THREE.Vector3;

const occupied = [];   // { p, r } keeps props from overlapping
const colliders = [];  // { p, r } solid for the player and critters
function occupy(dir, clearR, colR = 0) {
  const p = dir.clone().multiplyScalar(R);
  occupied.push({ p, r: clearR });
  if (colR > 0) colliders.push({ p, r: colR });
}
function isFree(dir, clear) {
  const p = _free.copy(dir).multiplyScalar(R);
  return occupied.every(o => o.p.distanceTo(p) >= o.r + clear);
}
const _free = new V3();
function findSpot(clear, minH = R + 0.45, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const d = randomDir();
    if (heightAt(d) < minH || !isFree(d, clear)) continue;
    return d;
  }
  return null;
}
const _hp = new V3();
function hitsCollider(d, rad, ignore) {
  const p = _hp.copy(d).multiplyScalar(R);
  for (const c of colliders) {
    if (c === ignore) continue;
    const m = c.r + rad;
    if (p.distanceToSquared(c.p) < m * m) return true;
  }
  return false;
}
/** Push a surface direction out of any colliders it overlaps (used for sliding). */
/** The first candidate on clear, walkable ground; otherwise any free spot. */
function spotNear(candidates, clear) {
  for (const d of candidates) if (d && onLand(d) && heightAt(d) > R + 0.3 && isFree(d, clear)) return d;
  return findSpot(clear);
}

const _cp = new V3(), _cd = new V3();
function resolveCollisions(dir, rad) {
  const p = _cp.copy(dir).multiplyScalar(R);
  for (const c of colliders) {
    _cd.subVectors(p, c.p);
    const d = _cd.length(), m = c.r + rad;
    if (d < m && d > 1e-5) p.addScaledVector(_cd, (m - d) / d);
  }
  dir.copy(p).normalize();
}

export { colliders, findSpot, hitsCollider, isFree, occupied, occupy, resolveCollisions, spotNear };
