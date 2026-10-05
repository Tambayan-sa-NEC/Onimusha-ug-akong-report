/**
 * Tunable gameplay numbers. Nothing here depends on anything else.
 */

const R = 30;                 // planet radius == water level
const WALK_MIN = R + 0.15;    // terrain lower than this counts as water

/**
 * The subset the player can change from the pause screen. Kept apart from the
 * gameplay numbers above so `core/save.js` knows exactly what is safe to persist
 * and what to restore on reset — and so a saved file can never reach the rest.
 */
const DEFAULT_SETTINGS = {
  volume: 0.55,          // master output, 0..1
  muted: false,
  lookSens: 1,           // multiplier on right-drag look
  invertLook: false,
  reducedMotion: false,  // drops the freeze-frame on hits and the drifting petals
  textSpeed: 45,         // dialogue characters per second
};

const CFG = {
  walk: 4.2, sprint: 7.8, accel: 10, jump: 7.5, gravity: 20, turnRate: 10,
  camDist: 7.2, camHeight: 3.4, talkRange: 3.2, challengeRange: 3.8,
  ...DEFAULT_SETTINGS,
};

export { CFG, DEFAULT_SETTINGS, R, WALK_MIN };
