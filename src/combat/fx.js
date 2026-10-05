/**
 * The animation layer laid over a yokai while it fights.
 */
import { ch, hostEmoteH } from '../challenges/system.js';
import { burst } from '../render/effects/sparks.js';
import { clamp } from '../utils/math.js';
import { vecA } from '../utils/scratch.js';

/* ---------- Yokai combat animation layer ----------
   Applied after each host's own update: offsets/tilts/scales its root, so it works for
   every yokai type. The timers are seconds counting down; `chase` is different — whoever
   is driving a pursuit re-sets it every frame, and it fades by itself when they stop. */
const FX_STYLE = { tag: { leap: 0.8 }, race: { leap: 0.5 }, rhythm: { spin: true }, gather: { grow: true } };
const FX_STRIKE = 0.3, FX_HURT = 0.3, FX_DASH = 0.35, FX_REC = 0.55;
const fxHosts = new Set();
function hostFx(host) {
  if (!host.fx) {
    host.fx = { wind: 0, strike: 0, hurt: 0, ko: 0, spin: 0, dash: 0, recover: 0, chase: 0, base: host.b.obj.scale.x };
    fxHosts.add(host);
  }
  return host.fx;
}
function clearFx(host) {
  if (!host.fx) return;
  host.b.obj.scale.setScalar(host.fx.base);
  host.fx = null;
  fxHosts.delete(host);
}
function updateCombatFX(dt, t) {
  for (const host of fxHosts) {
    const f = host.fx, obj = host.b.obj, up = host.b.dir, style = FX_STYLE[host.def.game] || {};
    f.strike = Math.max(0, f.strike - dt); f.hurt = Math.max(0, f.hurt - dt); f.ko = Math.max(0, f.ko - dt);
    f.dash = Math.max(0, f.dash - dt); f.recover = Math.max(0, f.recover - dt);
    const w = f.wind;
    const sb = f.strike > 0 ? Math.sin(Math.PI * (1 - f.strike / FX_STRIKE)) : 0;   // strike bell
    const sp = f.strike > 0 ? 1 - f.strike / FX_STRIKE : 0;                          // strike progress
    const hb = f.hurt > 0 ? Math.sin(Math.PI * (1 - f.hurt / FX_HURT)) : 0;          // hurt bell
    const ko = f.ko > 0 ? Math.min(1, (2.2 - f.ko) / 0.4) : 0;
    const da = f.dash > 0 ? Math.sin(Math.PI * Math.min(1, (1 - f.dash / FX_DASH) * 1.4)) : 0;   // mid-charge
    const rc = clamp(f.recover / FX_REC, 0, 1);                                      // winded and open
    const cs = f.chase;                                                              // leaning into a run
    f.chase = Math.max(0, f.chase - dt * 3);
    vecA.crossVectors(host.b.fwd, up);   // the yokai's right
    // Position: lunge forward, pounce, recoil hop, tremble while charging, sag when spent.
    obj.position.addScaledVector(host.b.fwd, 0.9 * sb - 0.25 * hb + 0.35 * da)
      .addScaledVector(up, (style.leap || 0) * sb + 0.2 * hb - 0.12 * rc)
      .addScaledVector(vecA, Math.sin(t * 70) * 0.05 * w);
    // Rotation: coil to charge, pitch into the blow, reel when hurt, lean into a run,
    // sag through the recovery, spin when beaten.
    obj.rotateX(-0.35 * w + 0.45 * sb - 0.45 * hb + 0.32 * da + 0.22 * cs + 0.3 * rc
      - ko * (0.25 + Math.sin(t * 8) * 0.15));
    obj.rotateZ(Math.sin(t * 9) * 0.07 * cs);   // shoulders rolling with the stride
    if (f.ko > 0) f.spin += dt * 12 * (f.ko / 2.2);
    if (style.spin && sb) obj.rotateY(sp * Math.PI * 2);
    obj.rotateY(f.spin);
    // Squash and stretch; a charge draws it out along its own heading.
    let sy = 1 - 0.18 * w + 0.2 * sb - 0.12 * hb - 0.3 * ko - 0.12 * rc,
        sxz = 1 + 0.1 * w - 0.08 * sb + 0.06 * hb + 0.12 * ko;
    if (style.grow) { sy = sxz = 1 + 0.8 * w + 0.5 * sb - 0.3 * ko; }
    obj.scale.set(f.base * sxz * (1 - 0.15 * da), f.base * sy, f.base * sxz * (1 + 0.55 * da));
    if (host.h) poseYokaiCombat(host.h, w, sb, sp, rc, ko, cs, t);
    if (host.m && host.m.tongue) host.m.tongue.scale.y += w * 1.5 + sb * 2.5 + da * 2;   // lantern / umbrella tongue lash
    if (f.ko > 0 && Math.random() < dt * 6) burst(vecA.copy(obj.position).addScaledVector(up, hostEmoteH(host) * 0.7), up, 2, ['#ffe08a'], 1.5, 0.3);
    if (f.dash > 0 && Math.random() < dt * 40) burst(obj.position, up, 1, ['#e9dfc6', '#cdbf9b'], 2, 0.15);   // dust off the heels
    if (!w && !f.strike && !f.hurt && !f.ko && !f.dash && !f.recover && f.chase <= 0.01
      && !(ch.active && ch.active.host === host)) clearFx(host);
  }
}
/** Arm and torso work for humanoid yokai: pump, coil, swing through, hang open, wobble. */
function poseYokaiCombat(h, w, sb, sp, rc, ko, cs, t) {
  const arms = h.arms;
  if (cs > 0.01) {   // running: arms driving back, chest forward
    arms[0].rotation.x -= 0.5 * cs; arms[1].rotation.x -= 0.5 * cs;
    h.upper.rotation.x -= 0.15 * cs;
  }
  if (w > 0) {   // coil: club up and back, shoulders wound away
    const a = -2.7 * w;
    arms[0].rotation.set(a, 0, 0.2 + 0.3 * w); arms[1].rotation.set(a, 0, -0.2 - 0.3 * w);
    h.upper.rotation.x = -0.3 * w; h.upper.rotation.y = 0.3 * w;
    h.head.rotation.x = -0.15 * w;
  }
  if (sb) {   // swing through, and keep going past the target
    const x = -2.7 + 3.2 * Math.min(1, sp * 2.5);
    arms[0].rotation.set(x, 0, 0.2); arms[1].rotation.set(x, 0, -0.2);
    h.upper.rotation.x = 0.5 * sb; h.upper.rotation.y = -0.35 * sb;
    h.head.rotation.x = 0.25 * sb;
  }
  if (rc > 0) {   // spent, arms hanging wide — this is your window
    arms[0].rotation.set(0.45 * rc, 0, 0.55 * rc); arms[1].rotation.set(0.45 * rc, 0, -0.55 * rc);
    h.upper.rotation.x = 0.35 * rc;
    h.head.rotation.x = 0.3 * rc;
  }
  if (ko) { arms[0].rotation.z = 1.2 * ko; arms[1].rotation.z = -1.2 * ko; h.head.rotation.z = Math.sin(t * 6) * 0.3 * ko; }
}

export { FX_DASH, FX_HURT, FX_REC, FX_STRIKE, FX_STYLE, clearFx, fxHosts, hostFx, poseYokaiCombat, updateCombatFX };
