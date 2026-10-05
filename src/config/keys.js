/**
 * What each action is bound to. Data only — `systems/input.js` is still the only
 * module that listens to the keyboard; it reads these bindings rather than
 * hard-coding key codes.
 *
 * An action may hold several codes, which is how W and the up arrow both walk.
 */

const DEFAULT_BINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  interact: ['KeyE'],
  dash: ['KeyQ'],          // the kunoichi's shadow dash
  roll: ['AltLeft', 'AltRight'],   // the rōnin's dodge roll
  mute: ['KeyM'],
  pause: ['Escape'],
};

/** The live bindings. Mutated in place so holders of the object stay current. */
const BINDS = {};
const resetBinds = () => {
  for (const action of Object.keys(BINDS)) delete BINDS[action];
  for (const [action, codes] of Object.entries(DEFAULT_BINDS)) BINDS[action] = codes.slice();
};
resetBinds();

/** The codes bound to an action, never undefined. */
const codesFor = action => BINDS[action] || [];
/** Whether `code` is bound to `action`. */
const isBound = (action, code) => codesFor(action).includes(code);
/** Which action owns `code`, or null. */
function actionFor(code) {
  for (const [action, codes] of Object.entries(BINDS)) if (codes.includes(code)) return action;
  return null;
}
/**
 * The action that would clash if `code` were given to `action`, or null when it is
 * free. A key keeping its own action is not a clash.
 */
function bindConflict(code, action) {
  const owner = actionFor(code);
  return owner && owner !== action ? owner : null;
}
/** Point an action at a new set of codes. */
function rebind(action, codes) {
  if (!(action in DEFAULT_BINDS)) return false;
  BINDS[action] = (Array.isArray(codes) ? codes : [codes]).filter(Boolean);
  return true;
}

export { BINDS, DEFAULT_BINDS, actionFor, bindConflict, codesFor, isBound, rebind, resetBinds };
