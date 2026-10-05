/**
 * 天狗の峰 — the Ōtengu's peak.
 *
 * A bare rock plateau above a sea of cloud. The floor is flat so that what you
 * see and what you stand on agree exactly; the ground simply stops at the rim,
 * which is what seals the arena.
 *
 * @hand-linked — these modules reuse local names by design.
 */
import * as THREE from 'three';
import { R } from '../../config/settings.js';
import { GEO, M, group, orient, part } from '../../render/materials.js';
import { angleBetween } from '../../utils/math.js';
import { mulberry32 } from '../../utils/random.js';
import { tangentBasis } from '../../utils/sphere.js';
import { buildArenaFloor, buildBarrier } from '../arenaFloor.js';
import { makeTorii } from '../props.js';

const V3 = THREE.Vector3;

const id = 'peak';
const name = 'Ōtengu no Mine';
const centre = new V3(0.62, -0.49, 0.61).normalize();
const radius = 12;
const FLOOR = R + 7;                       // the plateau stands well above sea level
const rim = radius / R;                    // angular radius

const _u = new V3(), _v = new V3();
tangentBasis(centre, _u, _v);
/** A unit direction `dist` world units from the centre, at `bearing` radians. */
function spot(bearing, dist) {
  const a = dist / R;
  return centre.clone().multiplyScalar(Math.cos(a))
    .addScaledVector(_u, Math.cos(bearing) * Math.sin(a))
    .addScaledVector(_v, Math.sin(bearing) * Math.sin(a)).normalize();
}

const entry = spot(0, radius * 0.6);
const sky = '#4a4560';
const fogNear = 8;
const fogFar = 46;

/**
 * A lightning-split pine. Built here rather than reused from props.js because the
 * shared builder draws from the world's seeded stream, and an arena must not.
 */
function deadPine(rr) {
  const t = group(part(GEO.trunk, '#4a4238', [0, 0, 0], [rr(0.5, 0.8), rr(2.2, 3.6), rr(0.5, 0.8)]));
  for (let k = 0; k < 3; k++) {
    t.add(part(GEO.box, '#443d34', [rr(-0.5, 0.5), rr(1.2, 2.6), rr(-0.5, 0.5)],
      [rr(0.6, 1.3), 0.12, 0.12], [0, rr(0, 6.283), rr(-0.6, 0.6)]));
  }
  return t;
}

/** Flat plateau inside the rim; nothing at all outside it. */
function height(d) {
  return angleBetween(d, centre) > rim ? R - 10 : FLOOR;
}

function build() {
  const g = new THREE.Group();
  const rnd = mulberry32(0x7E26);          // this arena's own stream, never the world's
  const rr = (a, b) => a + (b - a) * rnd();

  g.add(buildArenaFloor({ centre, radius, height }, '#6d6a72', '#56535e'));
  g.add(buildBarrier({ centre, radius, height }, '#9a90c8', 2.4));

  // A weathered torii at the rim, facing the middle.
  const td = spot(Math.PI, radius * 0.92);
  const torii = makeTorii(3.6);
  torii.traverse(m => { if (m.isMesh) m.material = M('#4b3b39'); });
  torii.position.copy(td).multiplyScalar(height(td) - 0.1);
  orient(torii, td, centre.clone().sub(td).normalize());
  g.add(torii);

  // Broken pines and boulders scattered across the plateau.
  for (let i = 0; i < 9; i++) {
    const d = spot(rr(0, 6.283), rr(radius * 0.25, radius * 0.88));
    const pine = deadPine(rr);
    pine.scale.setScalar(rr(0.6, 1.0));
    pine.position.copy(d).multiplyScalar(height(d) - 0.1);
    orient(pine, d, _u);
    g.add(pine);
  }
  for (let i = 0; i < 16; i++) {
    const d = spot(rr(0, 6.283), rr(1.5, radius * 0.95));
    const s = rr(0.3, 0.9);
    const rock = group(part(GEO.dode, '#7d7a82', [0, 0, 0], [s * 1.2, s * 0.8, s]));
    rock.position.copy(d).multiplyScalar(height(d));
    orient(rock, d, _u);
    g.add(rock);
  }

  // A sea of cloud below the rim, so the edge reads as a long drop.
  for (let i = 0; i < 30; i++) {
    const d = spot(rr(0, 6.283), rr(radius * 1.1, radius * 2.6));
    const c = group(
      part(GEO.ico, '#cfd4e4', [0, 0, 0], [rr(2, 4), rr(0.5, 0.9), rr(2, 4)]),
      part(GEO.ico, '#e2e5f0', [rr(-1, 1), 0.3, rr(-1, 1)], [rr(1, 2.4), 0.5, rr(1, 2.4)]),
    );
    c.position.copy(d).multiplyScalar(FLOOR - rr(4, 9));
    orient(c, d, _u);
    g.add(c);
  }
  return g;
}

const peak = { id, name, centre, radius, entry, sky, fogNear, fogFar, height, build };

export { peak };
