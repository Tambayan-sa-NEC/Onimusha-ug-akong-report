/**
 * Where the ponds, hills and zen gardens are. Fixed once, at world build.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { angleBetween } from '../utils/math.js';
import { rr } from '../utils/random.js';
import { randomDir, tangentBasis } from '../utils/sphere.js';

const V3 = THREE.Vector3;

const SPAWN = new V3(0, 1, 0);
const SPAWN_FWD = new V3(0, 0, 1);

function scatterDirs(count, ok, maxTries = 3000) {
  const out = [];
  for (let i = 0; i < maxTries && out.length < count; i++) { const d = randomDir(); if (ok(d, out)) out.push(d); }
  return out;
}
const GARDEN_R = 0.11;
let PONDS = [], HILLS = [], GARDENS = [];

/** Lay out the ponds, hills and gardens. First consumer of the seeded stream. */
function createLayout() {
  PONDS = scatterDirs(4, (d, list) => angleBetween(d, SPAWN) > 0.6 && list.every(p => angleBetween(p, d) > 0.9))
  .map(c => { const p = { c, r: rr(0.13, 0.17), u: new V3(), v: new V3() }; tangentBasis(c, p.u, p.v); p.world = c.clone().multiplyScalar(R); return p; });
  HILLS = scatterDirs(3, (d, list) => angleBetween(d, SPAWN) > 0.7 &&
  PONDS.every(p => angleBetween(p.c, d) > p.r + 0.45) && list.every(h => angleBetween(h, d) > 0.9))
  .map(c => ({ c, r: rr(0.3, 0.38), a: rr(1.8, 2.8) }));
  GARDENS = scatterDirs(2, (d, list) => angleBetween(d, SPAWN) > 0.45 &&
  PONDS.every(p => angleBetween(p.c, d) > p.r + 0.25) && HILLS.every(h => angleBetween(h.c, d) > h.r + 0.15) &&
    list.every(g => angleBetween(g, d) > 0.7));
}

export { GARDENS, GARDEN_R, HILLS, PONDS, SPAWN, SPAWN_FWD, createLayout, scatterDirs };
