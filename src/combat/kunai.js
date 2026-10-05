/**
 * The kunoichi's thrown kunai and shadow dash.
 */
import { ch, hosts, inputLocked, startChallenge } from '../challenges/system.js';
import { BATTLE, inBattle } from './battle.js';
import { slash } from './katana.js';
import { R } from '../config/settings.js';
import { session } from '../core/Session.js';
import { scene } from '../core/Stage.js';
import { player } from '../entities/Player.js';
import { startAction } from '../entities/models/humanoid.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { burst } from '../render/effects/sparks.js';
import { GEO, group, part } from '../render/materials.js';
import { Sound } from '../systems/audio.js';
import { angleBetween } from '../utils/math.js';
import { onLand } from '../world/terrain.js';

/* ---------- Kunoichi: thrown kunai, and the shadow dash ----------
   A kunai is a SurfaceBody like any other thing on the planet, so it follows the
   curve of the ground. It lands damage through exactly the same call the katana
   uses, which is what keeps battles, seals and bosses working for both characters. */
const KUNAI_SPEED = 21, KUNAI_LIFE = 0.68, KUNAI_HIT = 1.3, KUNAI_DMG = 1, KUNAI_CD = 0.34;
const kunai = [], kn = { cd: 0, pending: 0 };
const dash = { cd: 0, t: 0 };

function throwKunai() {
  const c = ch.active;
  if (!session.started || (c && (!c.g.fight || c.done))) return;   // no throwing during mini-games
  if (kn.cd > 0) return;
  kn.cd = KUNAI_CD; kn.pending = 0.11;                     // released part-way through the throw
  startAction(player.h, 'throw');
  Sound.sfx('swish');
}
function releaseKunai() {
  const pb = player.body;
  const m = group(
    part(GEO.box, '#3a3a42', [0, 0, 0], [0.05, 0.34, 0.02]),
    part(GEO.cone, '#dfe5ea', [0, 0.26, 0], [0.055, 0.19, 0.025]),
    part(GEO.torus, '#b08d3a', [0, -0.2, 0], 1.2),
  );
  scene.add(m);
  const k = { m, b: new SurfaceBody(m, pb.dir.clone(), pb.fwd.clone()), life: KUNAI_LIFE, spin: 0 };
  k.b.lift = 1.05;
  k.b.sync();
  kunai.push(k);
}
function dropKunai(i) { scene.remove(kunai[i].m); kunai.splice(i, 1); }
function clearKunai() { for (let i = kunai.length - 1; i >= 0; i--) dropKunai(i); }
/** Same targeting rules as a sword hit: start a fight, or damage the one you are in. */
function strikeWithKunai(k) {
  const c = ch.active;
  for (const y of hosts) {
    if (angleBetween(k.b.dir, y.b.dir) * R > KUNAI_HIT) continue;
    if (c && (!c.g.fight || c.done)) return false;
    if (!c) startChallenge(y, BATTLE);
    else if (y !== c.host) continue;
    ch.active.g.hit(ch.active, KUNAI_DMG, 0.5, false);
    return true;
  }
  return false;
}
function updateKunai(dt) {
  for (let i = kunai.length - 1; i >= 0; i--) {
    const k = kunai[i];
    if ((k.life -= dt) <= 0 || !k.b.step(k.b.fwd, KUNAI_SPEED * dt, onLand)) { dropKunai(i); continue; }
    k.b.sync();
    k.spin += dt * 22;
    k.m.rotateX(k.spin);
    if (strikeWithKunai(k)) {
      burst(k.m.position, k.b.dir, 8, ['#ffffff', '#ffd56a'], 4, 0.3);
      dropKunai(i);
    }
  }
}
function updateThrow(dt) {
  kn.cd = Math.max(0, kn.cd - dt);
  if (kn.pending > 0 && (kn.pending -= dt) <= 0) { kn.pending = 0; releaseKunai(); }
  const a = player.h.action;
  player.blade.visible = !!(a && a.type === 'throw') || inBattle();
  player.blade.rotation.x = 0;
}
function shadowDash() {
  if (!session.started || inputLocked() || dash.cd > 0 || player.char.art !== 'kunai') return;
  const pb = player.body;
  dash.cd = 1.3; dash.t = 0.18;
  player.inv = 0.34;
  startAction(player.h, 'spin');
  Sound.sfx('poof');
  burst(pb.obj.position, pb.dir, 16, ['#3b3552', '#8a5f9a', '#ffffff'], 5, 0.35);
}
/** Left click, whichever character is holding the weapon. */
function attack() { if (player.char.art === 'kunai') throwKunai(); else slash(); }

export { KUNAI_CD, KUNAI_DMG, KUNAI_HIT, KUNAI_LIFE, KUNAI_SPEED, attack, clearKunai, dash, dropKunai, kn, kunai, releaseKunai, shadowDash, strikeWithKunai, throwKunai, updateKunai, updateThrow };
