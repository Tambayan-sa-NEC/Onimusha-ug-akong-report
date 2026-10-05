/**
 * Whether play has begun, and whether it is currently held. Owned here so no
 * module has to reach for a global.
 */

const session = { started: false, paused: false };

export { session };
