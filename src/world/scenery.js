/**
 * Places the props and scatters the ground cover. Consumes the seeded stream.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { worldRoot } from '../core/Stage.js';
import { GEO, M, group, orient, part, placeProp } from '../render/materials.js';
import { pick, rand, rr } from '../utils/random.js';
import { localPoint, offsetDir, randTangent, randomDir } from '../utils/sphere.js';
import { colliders, findSpot, isFree, occupy } from './colliders.js';
import { GARDENS, GARDEN_R, HILLS, PONDS, SPAWN, SPAWN_FWD } from './layout.js';
import { inGarden, makeBamboo, makeCloud, makeLantern, makePagoda, makePine, makeSakura, makeTeaHouse, makeTorii, scatterInstanced } from './props.js';
import { heightAt } from './terrain.js';

const V3 = THREE.Vector3;

let PAGODA_DIR, TEA_DIR, TEA_FWD;
const cloudRoot = new THREE.Group();
const CLOUD_AXIS = new V3(0.3, 1, 0.2).normalize();

/** Place every prop and scatter the ground cover. Third consumer of the seeded stream. */
function buildScenery() {
  // Spawn approach: path through a torii flanked by lanterns.
  occupy(SPAWN, 3);
  for (let f = 2; f <= 12; f += 2) occupy(localPoint(SPAWN, SPAWN_FWD, f, 0), 1.6);
  placeProp(makeTorii(), localPoint(SPAWN, SPAWN_FWD, 7, 0), SPAWN_FWD, 0.15);
  for (const f of [4, 10]) for (const s of [-2.3, 2.3]) {
    const d = localPoint(SPAWN, SPAWN_FWD, f, s);
    placeProp(makeLantern(), d, SPAWN_FWD, 0.05); occupy(d, 0.8, 0.4);
  }
  { // torii pillar colliders
    const r = new V3().crossVectors(SPAWN_FWD, SPAWN);
    const td = localPoint(SPAWN, SPAWN_FWD, 7, 0);
    for (const s of [-1.3, 1.3]) colliders.push({ p: td.clone().addScaledVector(r, s / R).normalize().multiplyScalar(R), r: 0.25 });
  }

  // Floating torii standing in the first pond (Itsukushima vibes).
  placeProp(makeTorii(4.6), PONDS[0].c, randTangent(PONDS[0].c), 0);

  // Lily pads.
  for (const p of PONDS) for (let i = 0; i < 6; i++) {
    const d = offsetDir(p.c, rand() * 6.28, rand() * p.r * 0.5);
    if (heightAt(d) > R - 0.4) continue;
    const pad = group(part(GEO.cyl, '#5f9b5a', [0, 0, 0], [rr(0.25, 0.4), 0.03, rr(0.25, 0.4)]));
    if (rand() < 0.4) pad.add(part(GEO.ico, '#f7c6d6', [0.05, 0.08, 0], 0.09));
    pad.position.copy(d).multiplyScalar(R + 0.02);
    orient(pad, d, randTangent(d));
    worldRoot.add(pad);
  }

  // Pagoda on the first hill.
  PAGODA_DIR = HILLS[0].c;
  placeProp(makePagoda(), PAGODA_DIR, randTangent(PAGODA_DIR), 0.35);
  occupy(PAGODA_DIR, 3.2, 2.1);

  // Tea house.
  TEA_DIR = findSpot(4);
  TEA_FWD = randTangent(TEA_DIR);
  placeProp(makeTeaHouse(), TEA_DIR, TEA_FWD, 0.25);
  occupy(TEA_DIR, 3.4, 2.1);

  // Zen gardens: raked sand, a few stones with ripple rings.
  for (const g of GARDENS) {
    occupy(g, GARDEN_R * R + 0.5);
    for (let i = 0; i < 3; i++) {
      const d = offsetDir(g, i * 2.1 + rr(-0.4, 0.4), rr(0.25, 0.6) * GARDEN_R);
      const s = rr(0.45, 0.8);
      const stone = group(
        part(GEO.dode, '#8f8b84', [0, s * 0.3, 0], [s, s * 0.8, s * 0.9], [rand(), rand(), rand()]),
        part(GEO.cyl, '#6f9a55', [0, 0.02, 0], [s * 1.1, 0.06, s * 1.1]),
      );
      for (const k of [1.5, 2.0, 2.5]) stone.add(part(GEO.ring, '#cdbf9b', [0, 0.05, 0], [s * k, 1, s * k]));
      placeProp(stone, d, randTangent(d), 0.02);
      colliders.push({ p: d.clone().multiplyScalar(R), r: s * 0.9 });
    }
  }

  // Trees, bamboo, lanterns, extra torii.
  for (let i = 0; i < 24; i++) { const d = findSpot(1.8); if (d) { placeProp(makeSakura(), d); occupy(d, 1.8, 0.35); } }
  for (let i = 0; i < 14; i++) { const d = findSpot(1.6); if (d) { placeProp(makePine(), d); occupy(d, 1.6, 0.35); } }
  for (let i = 0; i < 8; i++) { const d = findSpot(1.5); if (d) { placeProp(makeBamboo(), d); occupy(d, 1.5, 0.8); } }
  for (let i = 0; i < 6; i++) { const d = findSpot(1); if (d) { placeProp(makeLantern(), d, null, 0.05); occupy(d, 1, 0.4); } }
  for (let i = 0; i < 2; i++) {
    const d = findSpot(3); if (!d) continue;
    const f = randTangent(d);
    placeProp(makeTorii(), d, f, 0.15); occupy(d, 3);
    const r = new V3().crossVectors(f, d);
    for (const s of [-1.3, 1.3]) colliders.push({ p: d.clone().addScaledVector(r, s / R).normalize().multiplyScalar(R), r: 0.25 });
  }

  // Rocks (instanced); big ones are solid.
  scatterInstanced(GEO.dode, M('#a09d94'), 40,
    (d, h) => h > R + 0.3 && !inGarden(d) && isFree(d, 0.8),
    () => { const s = rand() < 0.25 ? rr(0.6, 1.0) : rr(0.2, 0.45); return { x: s * 1.2, y: s * 0.75, z: s, lift: -s * 0.2 }; },
    null,
    (d, s) => { occupy(d, s.x + 0.3, s.x > 0.6 ? s.x * 0.8 : 0); });
  // Flowers and grass tufts.
  scatterInstanced(GEO.ico, new THREE.MeshPhongMaterial({ color: '#ffffff', flatShading: true, shininess: 0 }), 170,
    (d, h) => h > R + 0.45 && !inGarden(d),
    () => ({ x: 0.11, y: 0.09, z: 0.11, lift: 0.1 }),
    () => pick(['#ffffff', '#f9e27d', '#ea8fb2', '#b79be6', '#f6b2c4']));
  scatterInstanced(GEO.cone, M('#7fae5b'), 380,
    (d, h) => h > R + 0.45 && !inGarden(d),
    () => { const s = rr(0.8, 1.3); return { x: 0.07 * s, y: 0.35 * s, z: 0.07 * s, lift: 0.1 }; });

  // Clouds drift around the planet.
  for (let i = 0; i < 12; i++) {
    const d = randomDir(), c = makeCloud();
    c.position.copy(d).multiplyScalar(R + rr(13, 18));
    orient(c, d, randTangent(d));
    cloudRoot.add(c);
  }
  worldRoot.add(cloudRoot);
}

export { CLOUD_AXIS, PAGODA_DIR, TEA_DIR, TEA_FWD, buildScenery, cloudRoot };
