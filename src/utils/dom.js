/**
 * The DOM helpers the UI layer is built from.
 */

const $ = id => document.getElementById(id);

/**
 * Whether the pointer you lead with is a finger rather than a mouse. Lives here
 * rather than in `ui/touch.js` so the challenge panel can word itself for a phone
 * without the challenge system having to know the touch controls exist.
 */
const coarse = () => {
  try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }
  catch { return false; }   // a browser too old to say is a browser with a mouse
};

export { $, coarse };
