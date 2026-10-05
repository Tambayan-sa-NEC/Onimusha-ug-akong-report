/**
 * Builders for scenery: trees, torii, lanterns, the pagoda, the tea house.
 */
import * as THREE from 'three';
import { worldRoot } from '../core/Stage.js';
import { GEO, group, part } from '../render/materials.js';
import { angleBetween } from '../utils/math.js';
import { pick, rand, rr } from '../utils/random.js';
import { Y_AXIS, randomDir } from '../utils/sphere.js';
import { GARDENS, GARDEN_R } from './layout.js';
import { heightAt } from './terrain.js';

function makeSakura() {
  const g = new THREE.Group(), h = rr(2.0, 3.0);
  const trunk = part(GEO.trunk, '#6b4a3a', [0, 0, 0], [1, h, 1], [rr(-0.1, 0.1), 0, rr(-0.12, 0.12)]);
  g.add(trunk, part(GEO.trunk, '#6b4a3a', [0, h * 0.55, 0], [0.6, h * 0.5, 0.6], [0, 0, rr(0.6, 0.9)]));
  const pinks = ['#f7c1d0', '#f2a6bd', '#fbd6e0', '#f5b3c8'];
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const s = rr(0.7, 1.2);
    g.add(part(GEO.ico, pick(pinks), [rr(-0.9, 0.9), h + rr(-0.2, 0.7), rr(-0.9, 0.9)], [s, s * 0.85, s], [rand() * 3, rand() * 3, 0]));
  }
  return g;
}
function makePine() {  // Japanese black pine: flat cloud-pads on a crooked trunk
  const g = new THREE.Group(), h = rr(2.4, 3.4), lean = rr(-0.25, 0.25);
  g.add(part(GEO.trunk, '#5b4636', [0, 0, 0], [1.1, h, 1.1], [0, 0, lean]));
  const greens = ['#3f6b4b', '#4b7b55', '#35604a'];
  for (let i = 0; i < 4; i++) {
    const y = h * (0.45 + i * 0.2), s = rr(0.8, 1.3) * (1 - i * 0.15);
    g.add(part(GEO.ico, pick(greens), [-Math.sin(lean) * y + rr(-0.7, 0.7), y, rr(-0.7, 0.7)], [s * 1.2, s * 0.4, s * 1.2], [0, rand() * 3, 0]));
  }
  return g;
}
function makeBamboo() {
  const g = new THREE.Group();
  const n = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const x = rr(-0.7, 0.7), z = rr(-0.7, 0.7), h = rr(3.5, 5.5);
    const stalk = group(part(GEO.cyl, pick(['#86b25f', '#7aa654', '#93bb68']), [0, h / 2, 0], [0.07, h, 0.07]));
    for (let y = 1; y < h; y += 1.1) stalk.add(part(GEO.cyl, '#6d9446', [0, y, 0], [0.085, 0.05, 0.085]));
    for (let k = 0; k < 3; k++) stalk.add(part(GEO.ico, '#a3c96d', [rr(-0.4, 0.4), h - rr(0, 0.9), rr(-0.4, 0.4)], [0.35, 0.12, 0.2], [0, rand() * 3, rr(-0.5, 0.5)]));
    stalk.position.set(x, 0, z);
    stalk.rotation.set(rr(-0.06, 0.06), 0, rr(-0.06, 0.06));
    g.add(stalk);
  }
  return g;
}
function makeTorii(ph = 3.2) {
  const red = '#c8423a', black = '#2a2626';
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(part(GEO.cyl, red, [1.3 * s, ph / 2, 0], [0.17, ph, 0.17]));
    g.add(part(GEO.cyl, black, [1.3 * s, 0.15, 0], [0.21, 0.3, 0.21]));
    g.add(part(GEO.box, black, [2.05 * s, ph + 0.38, 0], [0.4, 0.2, 0.42], [0, 0, 0.3 * s]));   // upturned tips
  }
  g.add(part(GEO.box, red, [0, ph - 0.55, 0], [3.2, 0.18, 0.18]));    // nuki
  g.add(part(GEO.box, red, [0, ph - 0.25, 0], [0.16, 0.45, 0.16]));   // centre strut
  g.add(part(GEO.box, red, [0, ph + 0.05, 0], [3.5, 0.22, 0.3]));     // shimaki
  g.add(part(GEO.box, black, [0, ph + 0.28, 0], [3.8, 0.22, 0.4]));   // kasagi
  return g;
}
function makeLantern() {  // stone tōrō
  return group(
    part(GEO.cyl, '#9a9a94', [0, 0.1, 0], [0.32, 0.2, 0.32]),
    part(GEO.cyl, '#a8a8a0', [0, 0.55, 0], [0.1, 0.7, 0.1]),
    part(GEO.box, '#a8a8a0', [0, 0.95, 0], [0.5, 0.12, 0.5]),
    part(GEO.box, '#ffe2a6', [0, 1.15, 0], [0.3, 0.28, 0.3], null, '#b77a28'),
    part(GEO.roof, '#8e8e88', [0, 1.45, 0], [0.5, 0.32, 0.5]),
    part(GEO.ico, '#8e8e88', [0, 1.66, 0], 0.08),
  );
}
function makePagoda() {
  const g = group(part(GEO.box, '#8d8a80', [0, -0.2, 0], [3.6, 0.9, 3.6]));
  let y = 0.25, w = 2.4;
  for (let i = 0; i < 3; i++) {
    const bh = 1.1;
    g.add(part(GEO.box, '#f1e6d2', [0, y + bh / 2, 0], [w, bh, w]));
    g.add(part(GEO.box, '#b5473b', [0, y + bh * 0.25, 0], [w + 0.06, 0.2, w + 0.06]));
    g.add(part(GEO.box, '#5a3b30', [0, y + bh * 0.55, w / 2 + 0.01], [w * 0.3, bh * 0.5, 0.02]));   // window
    g.add(part(GEO.roof, '#3d3b45', [0, y + bh + 0.25, 0], [w * 1.08, 0.6, w * 1.08]));
    y += bh + 0.35; w *= 0.75;
  }
  g.add(part(GEO.cyl, '#c9a24a', [0, y + 0.8, 0], [0.06, 1.8, 0.06]));
  for (let k = 0; k < 4; k++) g.add(part(GEO.cyl, '#c9a24a', [0, y + 0.3 + k * 0.3, 0], [0.14 - k * 0.02, 0.05, 0.14 - k * 0.02]));
  return g;
}
function makeTeaHouse() {
  const g = group(
    part(GEO.box, '#8b6a4e', [0, 0, 0], [4, 0.6, 3.4]),
    part(GEO.box, '#efe6d0', [0, 1.05, 0], [3.2, 1.5, 2.6]),
    part(GEO.box, '#4a3a2e', [0, 1.72, 1.31], [3.25, 0.1, 0.04]),
    part(GEO.box, '#5a4a3c', [0, 0.95, 1.31], [0.9, 1.3, 0.03]),                 // doorway
    part(GEO.roof, '#4b4e5a', [0, 2.4, 0], [2.97, 1.2, 2.55]),
    part(GEO.ico, '#d9463b', [1.25, 1.45, 1.55], [0.18, 0.24, 0.18], null, '#6a1a12'),   // red chōchin
  );
  for (const x of [-1.6, 1.6]) for (const z of [-1.3, 1.3]) g.add(part(GEO.box, '#4a3a2e', [x, 1.05, z], [0.14, 1.5, 0.14]));
  for (const x of [-1.15, -0.8, 0.8, 1.15]) g.add(part(GEO.box, '#6a5646', [x, 1.05, 1.31], [0.04, 1.3, 0.03]));   // shoji frame
  return g;
}
function makeCloud() {
  const g = new THREE.Group(), n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const s = rr(1.2, 2.2);
    g.add(part(GEO.ico, '#fbf7f2', [(i - n / 2) * 1.5, rr(-0.3, 0.3), rr(-0.6, 0.6)], [s, s * 0.6, s]));
  }
  return g;
}

/* ---------- Instanced ground cover (one draw call each) ---------- */
function scatterInstanced(geo, mat, count, test, scaleFn, colorFn, onPlace) {
  const im = new THREE.InstancedMesh(geo, mat, count);
  im.frustumCulled = false;   // instances are spread over the whole planet
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  let n = 0;
  for (let guard = 0; n < count && guard < count * 25; guard++) {
    const d = randomDir(), h = heightAt(d);
    if (!test(d, h)) continue;
    const s = scaleFn();
    dummy.position.copy(d).multiplyScalar(h + (s.lift || 0));
    dummy.quaternion.setFromUnitVectors(Y_AXIS, d);
    dummy.rotateY(rand() * Math.PI * 2);
    dummy.scale.set(s.x, s.y, s.z);
    dummy.updateMatrix();
    im.setMatrixAt(n, dummy.matrix);
    if (colorFn) im.setColorAt(n, col.set(colorFn()));
    if (onPlace) onPlace(d, s);
    n++;
  }
  im.count = n;
  worldRoot.add(im);
  return im;
}
const inGarden = d => GARDENS.some(g => angleBetween(d, g) < GARDEN_R * 1.25);

export { inGarden, makeBamboo, makeCloud, makeLantern, makePagoda, makePine, makeSakura, makeTeaHouse, makeTorii, scatterInstanced };
