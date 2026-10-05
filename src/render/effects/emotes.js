/**
 * Floating speech bubbles drawn to a canvas texture.
 */
import * as THREE from 'three';
import { scene } from '../../core/Stage.js';

const texCache = new Map();
function labelTexture(text, color) {
  const key = text + color;
  if (texCache.has(key)) return texCache.get(key);
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const font = '600 54px "Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 44, h = 88;
  cv.width = w; cv.height = h;
  ctx.fillStyle = 'rgba(255,251,244,0.94)';
  ctx.strokeStyle = 'rgba(60,40,30,0.25)'; ctx.lineWidth = 4;
  const r = 30;
  ctx.beginPath();
  ctx.moveTo(r, 4); ctx.arcTo(w - 4, 4, w - 4, h - 4, r); ctx.arcTo(w - 4, h - 4, 4, h - 4, r);
  ctx.arcTo(4, h - 4, 4, 4, r); ctx.arcTo(4, 4, w - 4, 4, r); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const out = { tex, aspect: w / h };
  texCache.set(key, out);
  return out;
}
const emotes = [];
function emote(pos, up, text, height = 1.2, color = '#c8423a') {
  const { tex, aspect } = labelTexture(text, color);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.5 * aspect, 0.5, 1);
  s.position.copy(pos).addScaledVector(up, height);
  s.renderOrder = 10;
  scene.add(s);
  emotes.push({ s, up: up.clone(), t: 0, base: s.scale.x });
}
/** Drop every floating emote at once. Used when the player is moved elsewhere. */
function clearEmotes() {
  for (const e of emotes) { scene.remove(e.s); e.s.material.dispose(); }
  emotes.length = 0;
}
function updateEmotes(dt) {
  for (let i = emotes.length - 1; i >= 0; i--) {
    const e = emotes[i];
    e.t += dt;
    const k = e.t / 1.8;
    e.s.position.addScaledVector(e.up, dt * 0.5);
    e.s.material.opacity = k < 0.12 ? k / 0.12 : 1 - Math.pow((k - 0.12) / 0.88, 2);
    const pop = k < 0.12 ? 0.6 + 0.4 * (k / 0.12) : 1;
    e.s.scale.set(e.base * pop, 0.5 * pop, 1);
    if (k >= 1) { scene.remove(e.s); e.s.material.dispose(); emotes.splice(i, 1); }
  }
}

export { clearEmotes, emote, emotes, labelTexture, texCache, updateEmotes };
