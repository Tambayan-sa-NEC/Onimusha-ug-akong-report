/**
 * 大蛇の沼 — the Orochi's marsh.
 *
 * A drowned basin under black water, ringed by dead bamboo. Like the peak, the
 * floor is flat and the ground stops at the rim.
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
import { makeLantern } from '../props.js';

const V3 = THREE.Vector3;

const id = 'marsh';
const name = 'Orochi no Numa';
const centre = new V3(-0.55, 0.37, -0.75).normalize();
const radius = 13;
const FLOOR = R + 1.2;
const rim = radius / R;

const _u = new V3(), _v = new V3();
tangentBasis(centre, _u, _v);
function spot(bearing, dist) {
  const a = dist / R;
  return centre.clone().multiplyScalar(Math.cos(a))
    .addScaledVector(_u, Math.cos(bearing) * Math.sin(a))
    .addScaledVector(_v, Math.sin(bearing) * Math.sin(a)).normalize();
}

const entry = spot(Math.PI, radius * 0.6);
const sky = '#26332b';
const fogNear = 6;
const fogFar = 34;

/**
 * A dead bamboo stalk. Built here rather than reused from props.js because the
 * shared builder draws from the world's seeded stream, and an arena must not.
 */
function deadBamboo(rr) {
  const t = new THREE.Group();
  const h = rr(2.5, 4.5);
  t.add(part(GEO.cyl, '#5a5a46', [0, h / 2, 0], [0.09, h, 0.09]));
  for (let k = 1; k < 4; k++) t.add(part(GEO.cyl, '#6a6a54', [0, (h / 4) * k, 0], [0.11, 0.06, 0.11]));
  t.rotation.z = rr(-0.25, 0.25);
  return t;
}

/** Flat basin inside the rim; nothing at all outside it. */
function height(d) {
  return angleBetween(d, centre) > rim ? R - 10 : FLOOR;
}

function build() {
  const g = new THREE.Group();
  const rnd = mulberry32(0x0120);          // this arena's own stream, never the world's
  const rr = (a, b) => a + (b - a) * rnd();

  g.add(buildArenaFloor({ centre, radius, height }, '#3b4238', '#2e3630'));
  g.add(buildBarrier({ centre, radius, height }, '#6f8a74', 2.0));

  // A skin of black water just above the floor.
  const water = buildArenaFloor({ centre, radius, height: d => height(d) + 0.18 }, '#161d1a', '#1d2622');
  water.material = new THREE.MeshPhongMaterial({
    color: '#131a17', flatShading: true, transparent: true, opacity: 0.82, shininess: 80,
  });
  g.add(water);

  for (let i = 0; i < 14; i++) {           // dead bamboo
    const d = spot(rr(0, 6.283), rr(radius * 0.3, radius * 0.95));
    const b = deadBamboo(rr);
    b.scale.setScalar(rr(0.7, 1.2));
    b.position.copy(d).multiplyScalar(height(d) - 0.1);
    orient(b, d, _u);
    g.add(b);
  }
  for (let i = 0; i < 5; i++) {            // half-sunk lanterns
    const d = spot(rr(0, 6.283), rr(2, radius * 0.8));
    const l = makeLantern();
    l.traverse(m => { if (m.isMesh) m.material = M('#5c6158'); });
    l.position.copy(d).multiplyScalar(height(d) - rr(0.4, 0.9));
    orient(l, d, _u);
    l.rotateZ(rr(-0.3, 0.3));
    g.add(l);
  }
  for (let i = 0; i < 24; i++) {           // drifting mist
    const d = spot(rr(0, 6.283), rr(1, radius));
    const mist = group(part(GEO.ico, '#8fa89a', [0, 0, 0], [rr(1.5, 3), 0.25, rr(1.5, 3)]));
    mist.traverse(m => {
      if (m.isMesh) {
        m.material = new THREE.MeshBasicMaterial({
          color: '#9fb6a8', transparent: true, opacity: 0.16, depthWrite: false,
        });
      }
    });
    mist.position.copy(d).multiplyScalar(height(d) + rr(0.4, 2.2));
    orient(mist, d, _u);
    g.add(mist);
  }
  return g;
}

const marsh = { id, name, centre, radius, entry, sky, fogNear, fogFar, height, build };

export { marsh };
