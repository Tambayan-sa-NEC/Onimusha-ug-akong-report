/**
 * Shared scratch vectors.
 *
 * Sphere maths runs for every entity on every frame, so these are reused rather than
 * allocated. They are only valid within the expression that fills them: never hold on
 * to one across a call, and never assume another function left yours alone.
 */
import * as THREE from 'three';

const V3 = THREE.Vector3;

const tangentA = new V3();
const tangentB = new V3();
const tangentC = new V3();
const vecA = new V3();
const vecB = new V3();

export { tangentA, tangentB, tangentC, vecA, vecB };
