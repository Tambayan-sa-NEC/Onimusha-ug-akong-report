/**
 * The little turning figure on each character card.
 *
 * Each preview owns a small renderer and scene of its own rather than borrowing the
 * game's, so nothing it does can disturb the planet standing by behind the menu.
 */
import * as THREE from 'three';
import { makeHumanoid } from '../entities/models/humanoid.js';

const previews = [];

/** Build a preview of `look` onto its own canvas, and return that canvas. */
function createPreview(look) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pview';
  canvas.width = 220;
  canvas.height = 240;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return canvas;   // no WebGL for a second context: the card still works without it
  }
  renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
  renderer.setSize(220, 240, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 220 / 240, 0.1, 50);
  camera.position.set(0, 1.5, 6.2);
  camera.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9bb0c4, 1.05));
  const key = new THREE.DirectionalLight(0xfff2e0, 0.85);
  key.position.set(2.5, 4, 3);
  scene.add(key);

  const pivot = new THREE.Group();
  const h = makeHumanoid(look);
  pivot.add(h.root);
  scene.add(pivot);

  previews.push({ renderer, scene, camera, pivot, t: Math.random() * 6.28 });
  return canvas;
}

/** Turn them slowly, and draw. Called while the menu is up. */
function updatePreviews(dt) {
  for (const p of previews) {
    p.t += dt * 0.55;
    p.pivot.rotation.y = Math.sin(p.t * 0.55) * 0.85;   // a slow look left and right
    p.pivot.position.y = Math.sin(p.t * 1.6) * 0.015;   // barely breathing
    p.renderer.render(p.scene, p.camera);
  }
}

/** Drop every preview, so rebuilding the menu does not stack them up. */
function clearPreviews() {
  for (const p of previews) { if (p.renderer.dispose) p.renderer.dispose(); }
  previews.length = 0;
}

export { clearPreviews, createPreview, previews, updatePreviews };
