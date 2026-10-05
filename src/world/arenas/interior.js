/**
 * Room interiors, built on the same machinery the boss arenas use.
 *
 * A building you can walk into is the same problem as a sealed arena: hide the
 * planet, put different ground under the player, and put it all back on the way
 * out. `world/Arena.js` already does exactly that, so a room is an arena that
 * happens to have tatami on the floor and nothing trying to kill you.
 *
 * @hand-linked — these modules reuse local names by design.
 */
import * as THREE from 'three';
import { R } from '../../config/settings.js';
import { GEO, M, group, part } from '../../render/materials.js';
import { angleBetween } from '../../utils/math.js';
import { mulberry32 } from '../../utils/random.js';
import { tangentBasis } from '../../utils/sphere.js';
import { buildArenaFloor } from '../arenaFloor.js';

const V3 = THREE.Vector3;

/**
 * Build a room definition the arena system understands.
 *
 * Like every arena, it draws only from its own `mulberry32`. Calling `rr` or
 * `rand` from `utils/random.js` here — including indirectly, through a builder in
 * `world/props.js` — would change what the rest of the planet rolls afterwards.
 */
function makeInterior(o) {
  const centre = o.centre.clone().normalize();
  const radius = o.radius;
  const FLOOR = R + (o.floorLift || 4);
  const rim = radius / R;

  const _u = new V3(), _v = new V3();
  tangentBasis(centre, _u, _v);
  const spot = (bearing, dist) => {
    const a = dist / R;
    return centre.clone().multiplyScalar(Math.cos(a))
      .addScaledVector(_u, Math.cos(bearing) * Math.sin(a))
      .addScaledVector(_v, Math.sin(bearing) * Math.sin(a)).normalize();
  };

  /** Flat inside the walls, nothing outside them. */
  const height = d => (angleBetween(d, centre) > rim ? R - 10 : FLOOR);

  /**
   * Walls around the rim.
   *
   * `buildBarrier` is the arenas' translucent shimmer, which is right for sealing a
   * boss fight and wrong for a tea house, so these are solid panels. Each is stood up
   * by pointing its `up` along the surface normal and then facing it at the middle of
   * the room, which leaves its width running tangentially without any angle maths.
   */
  function walls(g) {
    const mid = centre.clone().multiplyScalar(FLOOR + 1.5);
    const n = 28;
    const panelW = (2 * Math.PI * radius / n) * 1.14;      // overlap, so no gaps show
    for (let i = 0; i < n; i++) {
      const b = (i / n) * Math.PI * 2;
      const d = spot(b, radius * 0.98);
      const p = d.clone().multiplyScalar(height(d) + 1.5);
      const panel = part(GEO.box, o.wall, [0, 0, 0], [panelW, 3.0, 0.12]);
      panel.up.copy(d);
      panel.position.copy(p);
      panel.lookAt(mid);
      g.add(panel);
    }
    // Posts on the corners, to read as a building rather than a drum.
    for (let i = 0; i < 8; i++) {
      const b = (i / 8) * Math.PI * 2;
      const d = spot(b, radius * 0.96);
      const p = d.clone().multiplyScalar(height(d));
      const post = part(GEO.box, o.beam, [0, 0, 0], [0.26, 3.2, 0.26]);
      post.position.copy(p);
      post.lookAt(p.clone().add(d));
      post.rotateX(Math.PI / 2);
      post.translateY(1.6);
      g.add(post);
    }
  }

  function build() {
    const g = new THREE.Group();
    const rnd = mulberry32(o.seed);          // this room's own stream, never the world's
    g.add(buildArenaFloor({ centre, radius, height }, o.floorA, o.floorB));
    walls(g);
    if (o.furnish) o.furnish(g, { spot, height, rnd, rr: (a, b) => a + (b - a) * rnd() });
    return g;
  }

  return {
    id: o.id,
    name: o.name,
    isRoom: true,
    centre,
    radius,
    height,
    spot,
    entry: spot(0, radius * 0.62),
    sky: o.sky,
    fogNear: 6,
    fogFar: 38,
    build,
  };
}

/** A squat piece of furniture — a table, a brazier, a stack of chests. */
function block(colour, w, h, d) {
  return group(part(GEO.box, colour, [0, h / 2, 0], [w, h, d]));
}

export { block, makeInterior };
