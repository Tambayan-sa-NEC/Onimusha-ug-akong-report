/**
 * Scalar helpers: clamping, easing, frame-rate independent damping.
 */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (k, dt) => 1 - Math.exp(-k * dt);   // frame-rate independent lerp factor
const angleBetween = (a, b) => Math.acos(clamp(a.dot(b), -1, 1));

export { angleBetween, clamp, damp, smoothstep };
