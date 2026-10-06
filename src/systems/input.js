/**
 * The only place that owns what the player is physically doing.
 *
 * The keyboard and the mouse are listened to here. The on-screen controls live in
 * `ui/touch.js`, which owns its own elements' events the way the pause screen and
 * the mini-games own theirs, and drives `pressKey`, `setMove` and `lookBy` rather
 * than writing this state itself. A thumb therefore reaches the menu, the pause
 * screen, the ending and every mini-game by the route a key already takes.
 */
import { challengeKey } from '../challenges/system.js';
import { codesFor, isBound } from '../config/keys.js';
import { dodgeRoll } from '../combat/katana.js';
import { attack, shadowDash } from '../combat/kunai.js';
import { CFG } from '../config/settings.js';
import { session } from '../core/Session.js';
import { renderer } from '../core/Stage.js';
import { Sound } from './audio.js';
import { menuKey } from '../ui/characterSelect.js';
import { pause, pauseKey, togglePause } from '../ui/pause.js';
import { advanceEnding, ending, endingKey } from '../ui/ending.js';
import { clamp } from '../utils/math.js';

// Input
const keys = {};
let dragging = false, lastX = 0;

/**
 * What the player is physically doing. Other systems read this; only this module
 * writes it. `moveX`/`moveZ` are the on-screen stick, which is analog — a gentle
 * push really is a slower walk — and stay at zero for anyone using a keyboard.
 */
const input = { jump: false, interact: false, mouseDX: 0, moveX: 0, moveZ: 0, sprint: false };
/** Consume a one-shot press, so it fires on exactly one frame. */
const takeJump = () => { const v = input.jump; input.jump = false; return v; };
const takeInteract = () => { const v = input.interact; input.interact = false; return v; };
const takeMouseDX = () => { const v = input.mouseDX; input.mouseDX = 0; return v; };
const clearInput = () => {
  for (const k in keys) keys[k] = false;
  input.jump = false; input.interact = false;
  input.moveX = 0; input.moveZ = 0; input.sprint = false;
};
const down = (...codes) => !ending.active && codes.some(c => keys[c]);   // the ending holds you still
/** Whether an action is currently held, whatever it happens to be bound to. */
const acting = action => down(...codesFor(action));

/**
 * Route a press. The keyboard and the on-screen buttons both arrive here, so
 * anything that answers a key answers a thumb — and a mini-game cannot tell them
 * apart, which is why none of the ten needed changing.
 */
function pressKey(code, repeat = false) {
  // The pause panel comes before everything, so it can always be reached and left —
  // including when it was opened from the title screen.
  if (pause.open) { if (!repeat) pauseKey(code); return; }
  if (!session.started) { if (!repeat) menuKey(code); return; }
  keys[code] = true;
  if (repeat) return;
  if (isBound('pause', code)) { clearInput(); togglePause(); return; }
  if (ending.active) { endingKey(code); return; }   // the cutscene owns the input while it plays
  if (challengeKey(code)) return;   // a running mini-game used this key
  if (isBound('jump', code)) input.jump = true;
  if (isBound('interact', code)) input.interact = true;
  if (isBound('dash', code)) shadowDash();
  if (isBound('roll', code)) dodgeRoll();
  if (isBound('mute', code)) Sound.toggleMute();
}
const releaseKey = code => { keys[code] = false; };

/** The on-screen stick: a tangent-plane direction, magnitude up to 1. */
function setMove(x, z, sprint = false) { input.moveX = x; input.moveZ = z; input.sprint = sprint; }
/** Turn the camera by a screen-space drag, from a mouse or from a thumb. */
const lookBy = dx => { input.mouseDX += dx * CFG.lookSens * (CFG.invertLook ? -1 : 1); };
/** The attack the canvas and the on-screen attack button share. */
function pressAttack() { if (!pause.open && !ending.active) attack(); }
/** Zoom, from the wheel or from a pinch. */
const zoomBy = d => { CFG.camDist = clamp(CFG.camDist + d, 4.5, 13); };

window.addEventListener('keydown', e => {
  // Alt is held off the browser too, or Windows hands the keypress to the menu bar.
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
  pressKey(e.code, e.repeat);
});
window.addEventListener('keyup', e => releaseKey(e.code));
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
renderer.domElement.addEventListener('pointerdown', e => {
  if (pause.open) return;
  if (ending.active) { if (e.button === 0) advanceEnding(); return; }   // tap through the cutscene
  if (e.button === 0) attack();   // left click: the character's own attack
  else { dragging = true; lastX = e.clientX; }   // right / middle drag: look around
});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', e => {
  if (!dragging || pause.open) return;
  // Measured from the last position rather than from `movementX`, which a touch
  // pointer does not report. Away from pointer lock the two are the same number.
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  lookBy(dx);
});
window.addEventListener('wheel', e => {
  if (pause.open) return;
  zoomBy(e.deltaY * 0.01);
}, { passive: true });

export {
  acting, clearInput, down, dragging, input, keys, lookBy, pressAttack, pressKey,
  releaseKey, setMove, takeInteract, takeJump, takeMouseDX, zoomBy,
};
