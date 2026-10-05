/**
 * Renderer, scene, camera and lights — the three.js plumbing, and nothing else.
 */
import * as THREE from 'three';

const SKY = new THREE.Color('#bcd9ea');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 22, 75);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 250);

// Two layers under the scene, so an arena can hide the planet wholesale.
// The player, the active boss and all transient effects stay directly on the
// scene, because they are the things that exist in both places.
const worldRoot = new THREE.Group();
const arenaRoot = new THREE.Group();
arenaRoot.visible = false;
scene.add(worldRoot, arenaRoot);

// The sun follows the player so the visible side of the planet is always softly lit.
const hemi = new THREE.HemisphereLight('#fff3e4', '#7c8f6c', 0.7);
const sun = new THREE.DirectionalLight('#ffe6c8', 0.8);
scene.add(hemi, sun, sun.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

export { SKY, arenaRoot, camera, hemi, renderer, scene, sun, worldRoot };
