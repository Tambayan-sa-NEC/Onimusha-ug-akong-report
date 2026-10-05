/**
 * The only place that touches the keyboard and mouse. Everything else reads its state.
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
let dragging = false;

/** What the player is physically doing. Other systems read this; only this module writes it. */
const input = { jump: false, interact: false, mouseDX: 0 };
/** Consume a one-shot press, so it fires on exactly one frame. */
const takeJump = () => { const v = input.jump; input.jump = false; return v; };
const takeInteract = () => { const v = input.interact; input.interact = false; return v; };
const takeMouseDX = () => { const v = input.mouseDX; input.mouseDX = 0; return v; };
const clearInput = () => { for (const k in keys) keys[k] = false; input.jump = false; input.interact = false; };
const down = (...codes) => !ending.active && codes.some(c => keys[c]);   // the ending holds you still
/** Whether an action is currently held, whatever it happens to be bound to. */
const acting = action => down(...codesFor(action));

window.addEventListener('keydown', e => {
  // Alt is held off the browser too, or Windows hands the keypress to the menu bar.
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
  // The pause panel comes before everything, so it can always be reached and left —
  // including when it was opened from the title screen.
  if (pause.open) { if (!e.repeat) pauseKey(e.code); return; }
  if (!session.started) { if (!e.repeat) menuKey(e.code); return; }
  keys[e.code] = true;
  if (e.repeat) return;
  if (isBound('pause', e.code)) { clearInput(); togglePause(); return; }
  if (ending.active) { endingKey(e.code); return; }   // the cutscene owns the keyboard while it plays
  if (challengeKey(e.code)) return;   // a running mini-game used this key
  if (isBound('jump', e.code)) input.jump = true;
  if (isBound('interact', e.code)) input.interact = true;
  if (isBound('dash', e.code)) shadowDash();
  if (isBound('roll', e.code)) dodgeRoll();
  if (isBound('mute', e.code)) Sound.toggleMute();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
renderer.domElement.addEventListener('pointerdown', e => {
  if (pause.open) return;
  if (ending.active) { if (e.button === 0) advanceEnding(); return; }   // click through the cutscene
  if (e.button === 0) attack();   // left click: the character's own attack
  else dragging = true;           // right / middle drag: look around
});
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', e => {
  if (dragging && !pause.open) input.mouseDX += e.movementX * CFG.lookSens * (CFG.invertLook ? -1 : 1);
});
window.addEventListener('wheel', e => {
  if (pause.open) return;
  CFG.camDist = clamp(CFG.camDist + e.deltaY * 0.01, 4.5, 13);
}, { passive: true });

export { acting, clearInput, down, dragging, input, keys, takeInteract, takeJump, takeMouseDX };
