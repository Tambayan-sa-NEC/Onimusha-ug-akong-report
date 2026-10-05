/**
 * Builds the four-legged animals, the birds and the koi.
 */
import * as THREE from 'three';
import { GEO, group, part } from '../../render/materials.js';

function makeQuadruped(o) {  // cats and dogs, facing +Z
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const c = o.color, b = o.belly || c, dog = o.kind === 'dog';
  body.add(part(GEO.box, c, [0, 0.34, 0], [0.3, 0.26, 0.6]));
  body.add(part(GEO.box, b, [0, 0.26, 0.05], [0.24, 0.1, 0.45]));
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.33);
  body.add(head);
  head.add(part(GEO.box, c, [0, 0, 0], [0.3, 0.25, 0.26]));
  head.add(part(GEO.box, b, [0, -0.05, 0.14], [dog ? 0.16 : 0.14, 0.11, dog ? 0.14 : 0.06]));
  head.add(part(GEO.box, '#1a1616', [0, -0.01, dog ? 0.21 : 0.17], [0.05, 0.04, 0.03]));
  for (const s of [-1, 1]) {
    head.add(part(GEO.box, '#1a1616', [0.08 * s, 0.04, 0.131], [0.04, 0.04, 0.01]));
    head.add(part(GEO.cone, o.ear || c, [0.09 * s, 0.17, -0.02], [0.07, 0.13, 0.05]));
  }
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = group(part(GEO.box, c, [0, -0.11, 0], [0.08, 0.22, 0.08]));
    leg.position.set(0.1 * sx, 0.22, 0.2 * sz);
    body.add(leg); legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.3);
  if (dog) tail.add(part(GEO.torus, c, [0, 0.08, 0.04], 1, [0, Math.PI / 2, 0]));   // curled shiba tail
  else { tail.add(part(GEO.box, c, [0, 0.2, 0], [0.05, 0.4, 0.05])); tail.rotation.x = -0.6; }
  body.add(tail);
  root.scale.setScalar(o.scale || 1);
  return { root, body, head, legs, tail };
}
function makeBird(c, belly) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.add(part(GEO.ico, c, [0, 0.18, 0], [0.14, 0.13, 0.2]));
  body.add(part(GEO.ico, belly, [0, 0.14, 0.03], [0.11, 0.09, 0.14]));
  body.add(part(GEO.ico, c, [0, 0.3, 0.14], 0.09));
  body.add(part(GEO.cone, '#e8a33a', [0, 0.29, 0.25], [0.03, 0.08, 0.03], [Math.PI / 2, 0, 0]));
  body.add(part(GEO.box, c, [0, 0.2, -0.2], [0.1, 0.02, 0.14], [0.3, 0, 0]));
  for (const s of [-1, 1]) {
    body.add(part(GEO.box, '#1a1616', [0.05 * s, 0.32, 0.2], [0.02, 0.02, 0.02]));
    body.add(part(GEO.box, '#d88b2e', [0.04 * s, 0.04, 0], [0.02, 0.08, 0.02]));
  }
  const wings = [-1, 1].map(s => {
    const w = group(part(GEO.box, c, [0.1 * s, 0, 0], [0.2, 0.02, 0.14]));
    w.position.set(0.1 * s, 0.22, 0);
    body.add(w);
    return w;
  });
  root.scale.setScalar(1.3);
  return { root, body, wings };
}
function makeKoi(c1, c2) {
  const root = new THREE.Group();
  root.add(part(GEO.ico, c1, [0, 0, 0], [0.16, 0.12, 0.36]));
  root.add(part(GEO.ico, c2, [0, 0.05, 0.08], [0.1, 0.08, 0.18]));
  const tail = group(part(GEO.cone, c1, [0, 0, -0.12], [0.03, 0.24, 0.18], [Math.PI / 2, 0, 0]));
  tail.position.z = -0.33;
  root.add(tail);
  root.scale.setScalar(1.15);
  return { root, tail };
}

export { makeBird, makeKoi, makeQuadruped };
