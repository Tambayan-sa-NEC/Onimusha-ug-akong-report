/**
 * The two rooms you can walk into: Hanako's tea house, and the pagoda's ground floor.
 *
 * @hand-linked — these modules reuse local names by design.
 */
import * as THREE from 'three';
import { GEO, part } from '../../render/materials.js';
import { makeInterior } from './interior.js';

const V3 = THREE.Vector3;

/** A low table with something on it. */
function table(colour, top) {
  const g = new THREE.Group();
  g.add(part(GEO.box, colour, [0, 0.34, 0], [1.3, 0.12, 0.9]));
  for (const x of [-0.5, 0.5]) for (const z of [-0.3, 0.3]) {
    g.add(part(GEO.box, colour, [x, 0.17, z], [0.1, 0.34, 0.1]));
  }
  if (top) g.add(part(GEO.cyl, top, [0, 0.47, 0], [0.16, 0.14, 0.16]));
  return g;
}
/** Stand a built object on the floor at a bearing and distance from the middle. */
function placeIn(g, obj, def, bearing, dist, turn = 0) {
  const d = def.spot(bearing, dist);
  const p = d.clone().multiplyScalar(def.height(d));
  obj.position.copy(p);
  obj.lookAt(p.clone().add(d));
  obj.rotateX(Math.PI / 2);
  obj.rotateY(turn);
  g.add(obj);
}

const teahouse = makeInterior({
  id: 'teahouse',
  name: 'Hanako’s Tea House',
  centre: new V3(-0.31, 0.74, -0.59).normalize(),
  radius: 9,
  seed: 0x7EA1,
  sky: '#d9c7a6',            // lamplight on paper walls
  floorA: '#cbb27e', floorB: '#bda36f',    // tatami, woven in two tones
  wall: '#efe6d2', beam: '#6b4a33',
  furnish(g, def) {
    placeIn(g, table('#6b4a33', '#8fae72'), def, 0.6, 2.2, 0.4);        // tea and a bowl of matcha
    placeIn(g, table('#6b4a33'), def, 3.3, 2.6, 1.1);
    // A hearth in the middle, the way a tea room is laid out.
    placeIn(g, (() => {
      const h = new THREE.Group();
      h.add(part(GEO.box, '#4a4440', [0, 0.1, 0], [1.0, 0.2, 1.0]));
      h.add(part(GEO.box, '#2a2522', [0, 0.21, 0], [0.76, 0.06, 0.76]));
      h.add(part(GEO.ico, '#e0803a', [0, 0.3, 0], [0.22, 0.2, 0.22]));   // embers
      return h;
    })(), def, 0, 0);
  },
});

const pagodaRoom = makeInterior({
  id: 'pagodaRoom',
  name: 'The Pagoda',
  centre: new V3(0.78, 0.22, -0.58).normalize(),
  radius: 10,
  seed: 0x7A60,
  sky: '#b9a894',
  floorA: '#7a6650', floorB: '#6d5b47',    // dark boards
  wall: '#d8c9ae', beam: '#4b3b39',
  furnish(g, def) {
    // The central pillar every pagoda is built around.
    placeIn(g, (() => {
      const p = new THREE.Group();
      p.add(part(GEO.cyl, '#4b3b39', [0, 1.7, 0], [0.38, 3.4, 0.38]));
      p.add(part(GEO.box, '#c9a227', [0, 2.2, 0], [0.9, 0.12, 0.9]));
      return p;
    })(), def, 0, 0);
    for (let i = 0; i < 4; i++) {
      placeIn(g, (() => {
        const s = new THREE.Group();
        s.add(part(GEO.box, '#5a4a3a', [0, 0.3, 0], [0.5, 0.6, 0.5]));
        s.add(part(GEO.ico, '#e9dcc4', [0, 0.72, 0], [0.22, 0.22, 0.22]));   // a small stone buddha
        return s;
      })(), def, i * 1.57 + 0.8, 5.2, 0);
    }
  },
});

export { pagodaRoom, teahouse };
