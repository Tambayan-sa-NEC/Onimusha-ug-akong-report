/**
 * Tunable gameplay numbers. Nothing here depends on anything else.
 */

const R = 30;                 // planet radius == water level
const WALK_MIN = R + 0.15;    // terrain lower than this counts as water
const CFG = {
  walk: 4.2, sprint: 7.8, accel: 10, jump: 7.5, gravity: 20, turnRate: 10,
  camDist: 7.2, camHeight: 3.4, talkRange: 3.2, challengeRange: 3.8,
};

export { CFG, R, WALK_MIN };
