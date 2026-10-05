/**
 * Builds the eight-necked serpent.
 */
import * as THREE from 'three';
import { GEO, group, part } from '../../render/materials.js';

function makeOrochi() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const dark = '#3b5538', mid = '#4a6a42', pale = '#55774c';
  for (let i = 0; i < 16; i++) {   // the coil
    const a = i / 16 * Math.PI * 2, r = 2.5 + Math.sin(a * 2) * 0.35;
    body.add(part(GEO.ico, i % 2 ? mid : dark,
      [Math.cos(a) * r, 0.5 + Math.sin(a * 3) * 0.14, Math.sin(a) * r], [0.9, 0.72, 0.9], [0, a, 0]));
  }
  const tail = group(part(GEO.cone, dark, [0, 0, 0], [0.5, 2.6, 0.5], [-Math.PI / 2, 0, 0]));
  tail.position.set(0, 0.6, -3.4);
  body.add(tail);
  const necks = [];
  for (let i = 0; i < 8; i++) {
    const spread = (i - 3.5) / 3.5;                       // -1 .. 1 across the fan
    const neck = new THREE.Group();
    neck.position.set(spread * 1.8, 0.85, 1.7 - Math.abs(spread) * 0.5);
    const segs = [];
    let parent = neck;
    for (let s = 0; s < 5; s++) {
      const seg = new THREE.Group();
      seg.position.y = s ? 0.66 : 0.1;
      seg.add(part(GEO.ico, s % 2 ? mid : dark, [0, 0.33, 0], [0.33 - s * 0.028, 0.4, 0.33 - s * 0.028]));
      parent.add(seg); parent = seg; segs.push(seg);
    }
    const head = new THREE.Group();
    head.position.y = 0.62;
    head.add(part(GEO.ico, pale, [0, 0.08, 0.12], [0.33, 0.26, 0.48]));
    head.add(part(GEO.cone, pale, [0, 0.02, 0.5], [0.19, 0.34, 0.19], [Math.PI / 2, 0, 0]));       // snout
    head.add(part(GEO.box, '#5a2320', [0, -0.08, 0.3], [0.3, 0.05, 0.3]));                        // mouth line
    for (const s of [-1, 1]) {
      head.add(part(GEO.ico, '#e8c23a', [0.15 * s, 0.21, 0.14], 0.085, null, '#9a6a12'));         // lamp eye
      head.add(part(GEO.cone, '#f6efdc', [0.1 * s, -0.11, 0.4], [0.04, 0.15, 0.04], [Math.PI, 0, 0]));       // fang
      head.add(part(GEO.cone, '#7d3027', [0.16 * s, 0.3, -0.1], [0.06, 0.3, 0.06], [-0.45, 0, -0.55 * s]));  // horn
    }
    parent.add(head);
    body.add(neck);
    necks.push({ root: neck, segs, head, spread, seed: i * 0.83 });
  }
  return { root, body, necks, tail };
}

export { makeOrochi };
