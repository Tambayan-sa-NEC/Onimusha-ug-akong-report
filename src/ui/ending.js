/**
 * The ending cutscene: once both great yokai are felled, the screen turns to washi
 * paper and the journey is told back in sumi-e — brushed black ink, a red hanko, and
 * a line of verse per scene. Everything here is drawn to a canvas at runtime; there
 * are no image assets, in keeping with the rest of the game.
 *
 * This module owns the DOM and the drawing. Input is routed in from input.js
 * (the one keyboard owner) through endingKey / advanceEnding.
 */
import { Sound } from '../systems/audio.js';
import { $ } from '../utils/dom.js';

const PAPER = '#efe7d6', INK = '#141210', SEAL = '#9c2b22';

/** The one running cutscene, if any. Read by input.js and the frame loop. */
const ending = {
  active: false,         // is the cutscene on screen
  played: false,         // once per session
  panels: [],            // the scenes to show, in order
  i: 0,                  // current scene
  t: 0,                  // seconds into the current scene
  journey: null,         // the recap numbers
  cv: null, ctx: null, cap: null, w: 0, h: 0,
};

/* ---------- Brushwork ----------
   Small ink primitives the scenes are composed from. A "brush" stroke tapers by
   laying a few shrinking passes along the same spine; splatter throws ink off it. */

function brush(ctx, pts, width, grain = 1) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.fillStyle = INK; ctx.strokeStyle = INK;
  const passes = Math.max(1, Math.round(3 * grain));
  for (let p = 0; p < passes; p++) {
    const k = 1 - p / (passes + 0.5);
    ctx.lineWidth = Math.max(0.6, width * k);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let s = 1; s < pts.length - 1; s++) {
      const mx = (pts[s][0] + pts[s + 1][0]) / 2, my = (pts[s][1] + pts[s + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[s][0], pts[s][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }
  ctx.restore();
}

/** A closed, filled ink shape from a loop of points (smoothed). */
function blob(ctx, pts, fill = INK) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2);
  for (let s = 0; s < pts.length; s++) {
    const a = pts[s], b = pts[(s + 1) % pts.length];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function splatter(ctx, x, y, spread, n, max = 6) {
  ctx.save();
  ctx.fillStyle = INK;
  for (let s = 0; s < n; s++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, Math.random() * max + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The red seal stamp in the corner, the way an ink painting is signed. */
function hanko(ctx, x, y, size, glyph) {
  ctx.save();
  ctx.fillStyle = SEAL;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, size, size, size * 0.12); ctx.fill(); }
  else ctx.fillRect(x, y, size, size);
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${size * 0.62}px "Yu Mincho", "Hiragino Mincho ProN", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x + size / 2, y + size / 2 + size * 0.02);
  ctx.restore();
}

/** A disc of pale ink — the moon — with a soft ring. */
function moon(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,18,16,0.06)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,18,16,0.14)'; ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(40,30,18,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/** Vertical kanji title down the right, the way a scroll is headed. */
function title(ctx, glyphs, x, y, size) {
  ctx.save();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px "Yu Mincho", "Hiragino Mincho ProN", serif`;
  [...glyphs].forEach((ch, i) => ctx.fillText(ch, x, y + i * size * 1.12));
  ctx.restore();
}

/* ---------- The lone figure, in silhouette ---------- */
function samurai(ctx, x, y, s, flip = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(flip * s, s);
  // kasa hat
  blob(ctx, [[-34, -2], [0, -16], [34, -2], [20, 4], [-20, 4]]);
  blob(ctx, [[-6, -16], [6, -16], [5, -24], [-5, -24]]);
  // head + torso + hakama as one flowing robe
  blob(ctx, [[-10, 2], [10, 2], [12, 20], [20, 70], [8, 86], [-10, 86], [-20, 68], [-12, 22]]);
  // sword, drawn low behind
  brush(ctx, [[14, 40], [40, 58], [74, 66]], 4, 1.2);
  ctx.restore();
}

/* ---------- Scenes ----------
   Each is draw(ctx, w, h, k) where k is 0..1 reveal. They keep to the brush palette
   so the whole sequence reads as one hand. */

function sceneArrival(ctx, w, h, k, J) {
  moon(ctx, w * 0.72, h * 0.3, Math.min(w, h) * 0.17);
  // horizon brush
  brush(ctx, [[0, h * 0.74], [w * 0.3, h * 0.72], [w * 0.62, h * 0.75], [w, h * 0.73]], 6, 1.4);
  if (k > 0.25) samurai(ctx, w * 0.3, h * 0.46, Math.min(w, h) / 240 * 1.4);
  if (k > 0.5) { // a few petals on the wind
    for (let i = 0; i < 9; i++) splatter(ctx, w * (0.4 + i * 0.05), h * (0.3 + (i % 3) * 0.12), 10, 2, 3);
  }
  title(ctx, '侍の旅', w * 0.9, h * 0.22, Math.min(w, h) * 0.07);
  hanko(ctx, w * 0.9, h * 0.6, Math.min(w, h) * 0.07, J.kanji);
}

function sceneHunt(ctx, w, h, k, J) {
  // a line of toppled yokai silhouettes, ink flung between them
  const n = Math.min(6, Math.max(2, J.slain));
  for (let i = 0; i < n; i++) {
    const x = w * (0.16 + i * (0.68 / Math.max(1, n - 1))), y = h * (0.6 + (i % 2) * 0.06);
    const sc = Math.min(w, h) / 240 * (0.8 + (i % 3) * 0.12);
    if (k > i / (n + 1)) {
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      blob(ctx, [[-16, 0], [0, -30], [16, 0], [22, 30], [-22, 30]]);           // hunched body
      for (const s of [-1, 1]) blob(ctx, [[s * 6, -30], [s * 14, -46], [s * 2, -32]]);  // horns
      ctx.restore();
    }
  }
  if (k > 0.4) { splatter(ctx, w * 0.5, h * 0.4, w * 0.28, 60, 9); }
  // the player, blade out, at the left
  samurai(ctx, w * 0.1, h * 0.42, Math.min(w, h) / 240 * 1.5);
  title(ctx, '刃', w * 0.92, h * 0.2, Math.min(w, h) * 0.08);
  hanko(ctx, w * 0.9, h * 0.72, Math.min(w, h) * 0.07, '戦');
}

function sceneTengu(ctx, w, h, k) {
  // the peak
  blob(ctx, [[0, h], [w * 0.2, h * 0.5], [w * 0.34, h * 0.64], [w * 0.5, h * 0.28], [w * 0.7, h * 0.62], [w, h]]);
  // Ōtengu: a winged shadow, wings spread, long nose
  const cx = w * 0.56, cy = h * 0.4, s = Math.min(w, h) / 240 * 2.6;
  if (k > 0.2) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    blob(ctx, [[-70, -6], [-22, -20], [-10, 6], [-30, 10]]);   // left wing
    blob(ctx, [[70, -6], [22, -20], [10, 6], [30, 10]]);       // right wing
    blob(ctx, [[-14, -18], [14, -18], [16, 20], [0, 30], [-16, 20]]);  // body
    brush(ctx, [[0, -6], [18, -2], [30, 2]], 3, 1);            // long nose
    ctx.restore();
  }
  if (k > 0.5) splatter(ctx, cx, cy, w * 0.14, 24, 6);
  title(ctx, '天狗', w * 0.9, h * 0.2, Math.min(w, h) * 0.07);
  hanko(ctx, w * 0.9, h * 0.66, Math.min(w, h) * 0.07, '天');
}

function sceneOrochi(ctx, w, h, k) {
  // black marsh water
  brush(ctx, [[0, h * 0.82], [w * 0.5, h * 0.8], [w, h * 0.83]], 10, 1.6);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = INK; ctx.fillRect(0, h * 0.82, w, h * 0.18); ctx.restore();
  // Orochi: a knot of necks rising, each ending in a head
  const bx = w * 0.5, by = h * 0.8, s = Math.min(w, h) / 240 * 1.1;
  const necks = 5;
  for (let i = 0; i < necks; i++) {
    if (k < i / (necks + 1)) continue;
    const spread = (i - (necks - 1) / 2) * 0.5;
    const tx = bx + spread * w * 0.13, ty = h * (0.28 + Math.abs(spread) * 0.08);
    brush(ctx, [[bx, by], [bx + spread * w * 0.05, by - h * 0.25], [tx, ty]], 10 * s, 1.4);
    blob(ctx, [[tx - 16 * s, ty], [tx, ty - 22 * s], [tx + 16 * s, ty], [tx + 10 * s, ty + 14 * s], [tx - 10 * s, ty + 14 * s]]);
    splatter(ctx, tx, ty, 10, 2, 3);  // eyes, more or less
  }
  if (k > 0.6) splatter(ctx, bx, h * 0.5, w * 0.2, 30, 7);
  title(ctx, '八岐大蛇', w * 0.92, h * 0.12, Math.min(w, h) * 0.055);
  hanko(ctx, w * 0.06, h * 0.1, Math.min(w, h) * 0.07, '蛇');
}

function scenePeace(ctx, w, h, k) {
  moon(ctx, w * 0.5, h * 0.32, Math.min(w, h) * 0.2);
  brush(ctx, [[0, h * 0.76], [w * 0.5, h * 0.75], [w, h * 0.77]], 6, 1.3);
  // the figure, bowing
  if (k > 0.2) {
    ctx.save(); ctx.translate(w * 0.5, h * 0.52); ctx.scale(Math.min(w, h) / 240 * 1.6, Math.min(w, h) / 240 * 1.6);
    blob(ctx, [[-34, -2], [0, -14], [34, -2], [18, 6], [-18, 6]]);   // kasa, tipped forward
    blob(ctx, [[-10, 4], [12, 6], [26, 40], [36, 78], [10, 84], [-12, 80], [-18, 44]]);  // robe, bowed
    ctx.restore();
  }
  if (k > 0.5) for (let i = 0; i < 12; i++) splatter(ctx, w * (0.2 + i * 0.05), h * (0.25 + (i % 4) * 0.1), 8, 2, 3);
  title(ctx, '静けさ', w * 0.9, h * 0.2, Math.min(w, h) * 0.06);
  hanko(ctx, w * 0.08, h * 0.78, Math.min(w, h) * 0.08, '和');
}

function sceneEnd(ctx, w, h, k, J) {
  title(ctx, '完', w * 0.5, h * 0.42, Math.min(w, h) * 0.22);
  hanko(ctx, w * 0.5 - Math.min(w, h) * 0.045, h * 0.58, Math.min(w, h) * 0.09, J.kanji);
}

/* ---------- Composing the recap ---------- */
function buildPanels(J) {
  const him = J.char;
  const kills = J.slain === 1 ? 'a single yokai' : `${J.slain} yokai`;
  const peace = J.seals === 1 ? 'one seal' : `${J.seals} seals`;
  const [boss1, boss2] = J.bosses;
  return [
    { draw: sceneArrival, dur: 5.5, text: `${him} came to the little planet with a blade and a question.` },
    { draw: sceneHunt,    dur: 5.5, text: `Steel met ${kills} beneath the sakura — and each one knelt.` },
    { draw: sceneTengu,   dur: 5.5, text: `High on the wind-peak, ${boss1} fell before the blade.` },
    { draw: sceneOrochi,  dur: 5.5, text: `In the black marsh, ${boss2} bowed its heads as one.` },
    { draw: scenePeace,   dur: 5.5, text: `${peace} rest in the book now, won by game and by sword alike.` },
    { draw: sceneEnd,     dur: 1e9, text: `The planet is quiet. Walk it a while longer, ${him}.  —  press any key` },
  ];
}

/* ---------- Lifecycle ---------- */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  ending.w = w; ending.h = h;
  ending.cv.width = Math.round(w * dpr); ending.cv.height = Math.round(h * dpr);
  ending.cv.style.width = w + 'px'; ending.cv.style.height = h + 'px';
  ending.ctx.setTransform ? ending.ctx.setTransform(dpr, 0, 0, dpr, 0, 0) : ending.ctx.scale(dpr, dpr);
}

function playEnding(journey) {
  if (ending.played) return;
  ending.played = true;
  ending.active = true;
  ending.journey = journey;
  ending.panels = buildPanels(journey);
  ending.i = 0; ending.t = 0;

  const root = $('ending');
  root.innerHTML = '';
  root.classList.add('show');
  const cv = document.createElement('canvas'); cv.className = 'ink-canvas'; root.appendChild(cv);
  const cap = document.createElement('div'); cap.className = 'ink-cap'; root.appendChild(cap);
  const skip = document.createElement('div'); skip.className = 'ink-skip';
  skip.textContent = 'Space ▸ next   ·   Esc to skip'; root.appendChild(skip);
  ending.cv = cv; ending.ctx = cv.getContext('2d'); ending.cap = cap;
  if (ending.ctx) resize();
  window.addEventListener('resize', resize);
  Sound.sfx('win');
}

function drawPanel() {
  const { ctx, w, h } = ending;
  if (!ctx) return;
  const p = ending.panels[ending.i];
  const k = Math.min(1, ending.t / 1.1);          // ink spreads in over the first second
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = Math.min(1, ending.t / 0.5);  // whole scene fades up
  p.draw(ctx, w, h, k, ending.journey);
  ctx.restore();
  vignette(ctx, w, h);
  // caption: brushed in a few words at a time
  const chars = Math.floor(ending.t * 36);
  ending.cap.textContent = p.text.slice(0, chars);
}

function updateEnding(dt) {
  if (!ending.active) return;
  ending.t += dt;
  drawPanel();
  const p = ending.panels[ending.i];
  if (ending.t >= p.dur) advanceEnding();          // the last panel's dur is effectively forever
}

function advanceEnding() {
  if (!ending.active) return;
  if (ending.i >= ending.panels.length - 1) { closeEnding(); return; }
  ending.i++; ending.t = 0;
  Sound.sfx('swish');
}

function closeEnding() {
  ending.active = false;
  window.removeEventListener('resize', resize);
  const root = $('ending');
  root.classList.remove('show');
  root.innerHTML = '';
  ending.cv = ending.ctx = ending.cap = null;
}

/** Keyboard, routed in from input.js. Returns nothing; it always consumes the key. */
function endingKey(code) {
  if (code === 'Escape') closeEnding();
  else advanceEnding();
}

export { advanceEnding, closeEnding, ending, endingKey, playEnding, updateEnding };
