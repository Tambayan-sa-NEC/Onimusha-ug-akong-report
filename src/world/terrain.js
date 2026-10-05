/**
 * Ground height and colour at any point, and the planet mesh itself.
 */
import * as THREE from 'three';
import { R, WALK_MIN } from '../config/settings.js';
import { worldRoot } from '../core/Stage.js';
import { angleBetween, clamp, smoothstep } from '../utils/math.js';
import { rand } from '../utils/random.js';
import { GARDENS, GARDEN_R, HILLS, PONDS } from './layout.js';

const V3 = THREE.Vector3;

function noise(d) {
  return 0.55 * Math.sin(d.x * 4.1 + 1.7) * Math.sin(d.y * 3.7 + 0.3) * Math.sin(d.z * 4.3 + 2.1)
       + 0.30 * Math.sin(d.x * 9.3 + 0.5) * Math.sin(d.y * 8.7 + 1.1) * Math.sin(d.z * 9.9 + 0.9)
       + 0.15 * Math.sin(d.x * 17.0) * Math.sin(d.y * 15.3 + 2.0) * Math.sin(d.z * 16.1 + 1.0);
}
/** Terrain radius for a unit direction on the planet itself. */
function planetHeightAt(d) {
  let h = R + 0.85 + noise(d) * 0.55;
  for (const hill of HILLS) {
    const a = angleBetween(d, hill.c);
    if (a < hill.r) h += hill.a * (0.5 + 0.5 * Math.cos(Math.PI * a / hill.r));
  }
  for (const g of GARDENS) {               // gardens are flattened sand
    const a = angleBetween(d, g);
    if (a < GARDEN_R * 1.4) h += (R + 0.75 - h) * smoothstep(GARDEN_R * 1.4, GARDEN_R * 0.9, a);
  }
  for (const p of PONDS) {                 // ponds dip below the water sphere
    const a = angleBetween(d, p.c);
    if (a < p.r) h += (R - 1.3 - h) * smoothstep(p.r, p.r * 0.55, a);
  }
  return h;
}
let groundOverride = null;
/** Replace the ground while an arena is active. Pass null to restore the planet. */
function setGroundOverride(fn) { groundOverride = fn; }

/**
 * Ground height for a unit direction. The single source of truth: physics, the
 * camera, collisions and shadows all come through here, which is why swapping it
 * is enough to put the player somewhere else entirely.
 */
function heightAt(d) {
  return groundOverride ? groundOverride(d) : planetHeightAt(d);
}
const onLand = d => heightAt(d) > WALK_MIN;

const _tc = new THREE.Color();
function terrainColor(n, h, out) {
  if (h < R - 0.25) return out.set('#6d8f86');                        // pond bed
  if (h < R + 0.4) return out.set('#dccb9c');                         // shore sand
  for (const g of GARDENS) if (angleBetween(n, g) < GARDEN_R * 1.05) return out.set(rand() < 0.5 ? '#e9dfc6' : '#e2d6b9');
  const t = clamp((h - R - 0.9) / 2.2, 0, 1);                        // higher = deeper green
  out.set('#9ec873').lerp(_tc.set('#6c9a57'), t * 0.8 + rand() * 0.15);
  if (rand() < 0.035) out.set('#b8d582');                             // clover specks
  return out;
}
function buildPlanet() {
  const geo = new THREE.IcosahedronGeometry(1, 24);   // non-indexed: one colour per face
  const pos = geo.attributes.position;
  const v = new V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    v.multiplyScalar(planetHeightAt(v));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const col = new Float32Array(pos.count * 3);
  const a = new V3(), b = new V3(), c = new V3(), n = new V3(), color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.copy(a).add(b).add(c).divideScalar(3);
    const h = n.length(); n.normalize();
    terrainColor(n, h, color);
    for (let k = 0; k < 3; k++) color.toArray(col, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  worldRoot.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0 })));
}

// One water sphere at radius R; it only shows where terrain dips below it (the ponds).
const water = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 12), new THREE.MeshPhongMaterial({
  color: '#86c3c6', flatShading: true, transparent: true, opacity: 0.78, shininess: 90, specular: '#ffffff',
}));

/** Build the planet shell and drop the water sphere in. Second consumer of the stream. */
function createPlanet() {
  buildPlanet();
  worldRoot.add(water);
}

export { buildPlanet, createPlanet, groundOverride, heightAt, noise, onLand, planetHeightAt, setGroundOverride, terrainColor, water };
