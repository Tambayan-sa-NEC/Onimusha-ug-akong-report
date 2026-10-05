/**
 * Geometry shared by every arena: the floor, and the shell that marks its edge.
 *
 * The floor is tessellated from the arena's own `height()` function, so what you
 * see and what you stand on cannot disagree.
 *
 * @hand-linked — these modules reuse local names by design.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { tangentBasis } from '../utils/sphere.js';

const V3 = THREE.Vector3;

const RINGS = 12, SEGMENTS = 48;

/** A unit direction on the cap, at ring `ri` of RINGS and segment `si` of SEGMENTS. */
function capDir(centre, u, v, radius, ri, si, out) {
  const a = (ri / RINGS) * (radius / R);
  const th = (si / SEGMENTS) * Math.PI * 2;
  return out.copy(centre).multiplyScalar(Math.cos(a))
    .addScaledVector(u, Math.cos(th) * Math.sin(a))
    .addScaledVector(v, Math.sin(th) * Math.sin(a)).normalize();
}

/** Tessellate the arena floor, flat-shaded and two-toned so the facets read. */
function buildArenaFloor(def, colorA, colorB) {
  const u = new V3(), v = new V3(), d = new V3();
  tangentBasis(def.centre, u, v);
  const at = (ri, si) => {
    capDir(def.centre, u, v, def.radius, ri, si % SEGMENTS, d);
    return d.clone().multiplyScalar(def.height(d));
  };

  const pos = [], col = [];
  const a = new THREE.Color(colorA), b = new THREE.Color(colorB);
  const push = (p, c) => { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); };

  for (let ri = 0; ri < RINGS; ri++) {
    for (let si = 0; si < SEGMENTS; si++) {
      const p00 = at(ri, si), p01 = at(ri, si + 1);
      const p10 = at(ri + 1, si), p11 = at(ri + 1, si + 1);
      const c = (ri + si) % 2 ? a : b;
      if (ri > 0) { push(p00, c); push(p10, c); push(p01, c); }
      push(p01, c); push(p10, c); push(p11, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    vertexColors: true, flatShading: true, shininess: 0, side: THREE.DoubleSide,
  }));
}

/** A translucent shell standing on the rim, so the edge is visible before you reach it. */
function buildBarrier(def, color, tall) {
  const u = new V3(), v = new V3(), d = new V3();
  tangentBasis(def.centre, u, v);
  const h = def.height(def.centre);        // the floor height, not the void past the rim
  const pos = [];
  for (let si = 0; si <= SEGMENTS; si++) {
    capDir(def.centre, u, v, def.radius, RINGS, si % SEGMENTS, d);
    pos.push(d.x * h, d.y * h, d.z * h);
    pos.push(d.x * (h + tall), d.y * (h + tall), d.z * (h + tall));
  }
  const idx = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const k = i * 2;
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false,
  }));
}

export { buildArenaFloor, buildBarrier };
