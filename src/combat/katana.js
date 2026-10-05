/**
 * The rōnin's three-hit sword combo and its arcs.
 */
import * as THREE from 'three';
import { ch, hosts, inputLocked, startChallenge } from '../challenges/system.js';
import { BATTLE, inBattle } from './battle.js';
import { updateCombatFX } from './fx.js';
import { updateKunai, updateThrow } from './kunai.js';
import { R } from '../config/settings.js';
import { session } from '../core/Session.js';
import { scene } from '../core/Stage.js';
import { player } from '../entities/Player.js';
import { startAction } from '../entities/models/humanoid.js';
import { moveWithSlide } from '../physics/movement.js';
import { updateFlashes } from '../render/effects/flash.js';
import { feedback, hurtFx, updateShockFx } from '../render/effects/impact.js';
import { burst, updateSparks } from '../render/effects/sparks.js';
import { GEO, group, orient, part } from '../render/materials.js';
import { Sound } from '../systems/audio.js';
import { angleBetween } from '../utils/math.js';
import { tangentB } from '../utils/scratch.js';
import { tangentToward } from '../utils/sphere.js';

/* ---------- Player sword work ---------- */
// Held weapon: in guard during battles, and visible through every attack.
/** Give the current character its weapon. Called again whenever the character changes. */
function equipWeapon() {
  player.blade = player.char.art === 'kunai'
    ? group(
        part(GEO.box, '#3a3a42', [0, -0.3, 0], [0.045, 0.36, 0.02]),
        part(GEO.cone, '#dfe5ea', [0, -0.56, 0], [0.05, 0.19, 0.025], [Math.PI, 0, 0]),
        part(GEO.torus, '#b08d3a', [0, -0.08, 0], 1.2),
      )
    : group(
        part(GEO.box, '#e8eef2', [0, -0.5, 0], [0.03, 0.9, 0.07], null, '#55606a'),
        part(GEO.cyl, '#b08d3a', [0, -0.04, 0], [0.08, 0.02, 0.08]),
      );
  player.blade.position.set(-0.02, -0.55, 0.02);
  player.blade.visible = false;
  player.h.arms[0].add(player.blade);
}

const arcMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const ARCS = {
  slash1: new THREE.Mesh(new THREE.RingGeometry(0.9, 1.6, 16, 1, -0.7, 2.4).rotateY(-Math.PI / 2), arcMat('#ffffff')),            // vertical
  slash2: new THREE.Mesh(new THREE.RingGeometry(0.9, 1.7, 18, 1, -Math.PI / 2 - 1.3, 2.6).rotateX(-Math.PI / 2), arcMat('#ffffff')), // horizontal
  slash3: new THREE.Mesh(new THREE.RingGeometry(1.0, 2.1, 30, 1, 0, Math.PI * 2).rotateX(-Math.PI / 2), arcMat('#ffe08a')),         // full spin
};
for (const a of Object.values(ARCS)) { a.visible = false; scene.add(a); }
// step: anim, cooldown, hit delay (lands mid-swing), range, min facing dot, damage, knockback, arc height
const COMBO = [
  { anim: 'slash1', cd: 0.38, delay: 0.08, range: 2.6, dot: 0.25, dmg: 1, kb: 0.6, h: 1.1 },
  { anim: 'slash2', cd: 0.38, delay: 0.08, range: 2.8, dot: -0.1, dmg: 1, kb: 0.8, h: 1.0 },
  { anim: 'slash3', cd: 0.65, delay: 0.18, range: 3.0, dot: -2, dmg: 2, kb: 1.6, h: 0.9 },
];
const sw = { cd: 0, sinceLast: 9, step: 0, buffered: false, pending: null, arc: null, arcT: 0, arcStep: null };

/* ---------- The rōnin's dodge roll ----------
   His only way out of a committed swing. Shorter than the kunoichi's shadow dash and
   slower to come back, but it buys the same breath of invulnerability. */
const roll = { cd: 0, t: 0 };

function dodgeRoll() {
  if (!session.started || inputLocked() || roll.cd > 0 || player.char.art !== 'blade') return;
  const pb = player.body;
  roll.cd = 1.4; roll.t = 0.22;
  player.inv = 0.36;
  startAction(player.h, 'roll');
  Sound.sfx('swish');
  burst(pb.obj.position, pb.dir, 10, ['#4a4e5a', '#c9a227', '#d8d2c4'], 3.5, 0.3);
}

function slash() {
  const c = ch.active;
  if (!session.started || (c && (!c.g.fight || c.done))) return;   // no swinging during mini-games
  if (sw.cd > 0) { sw.buffered = true; return; }                // queue the next combo hit
  sw.step = sw.sinceLast < 0.6 ? (sw.step + 1) % COMBO.length : 0;
  const s = COMBO[sw.step];
  sw.cd = s.cd; sw.sinceLast = 0;
  startAction(player.h, s.anim);
  Sound.sfx('swish');
  moveWithSlide(player.body, player.body.fwd, sw.step === 2 ? 0.6 : 0.35);   // lunge
  sw.pending = { s, t: s.delay };
}
/** Resolve a swing at the moment the blade passes through. */
function landSwing(s) {
  const pb = player.body, c = ch.active;
  if (sw.arc) sw.arc.visible = false;
  sw.arc = ARCS[s.anim]; sw.arcT = 0.22; sw.arcStep = s;
  let target = null, best = s.range;
  for (const y of hosts) {
    const d = angleBetween(pb.dir, y.b.dir) * R;
    if (d >= best) continue;
    if (d > 0.6 && tangentToward(pb.dir, y.b.dir, pb.dir, tangentB) && tangentB.dot(pb.fwd) < s.dot) continue;
    best = d; target = y;
  }
  if (!target || (c && (!c.g.fight || c.done))) return;
  if (!c) startChallenge(target, BATTLE);   // first strike starts the fight
  else if (target !== c.host) return;
  ch.active.g.hit(ch.active, s.dmg, s.kb, s === COMBO[2]);
}
/** Guard stance: two-handed grip, blade forward, slight crouch. */
function guardPose(h, t) {
  h.arms[0].rotation.set(-1.0, 0, 0.38);
  h.arms[1].rotation.set(-1.0, 0, -0.38);
  h.upper.rotation.x = 0.12;
  h.body.position.y -= 0.05 - Math.sin(t * 3) * 0.015;
}
function updateSlash(dt) {
  sw.cd = Math.max(0, sw.cd - dt);
  sw.sinceLast += dt;
  if (sw.buffered && sw.cd <= 0) { sw.buffered = false; slash(); }
  if (sw.pending && (sw.pending.t -= dt) <= 0) { const s = sw.pending.s; sw.pending = null; landSwing(s); }
  const pb = player.body, a = player.h.action;
  const swinging = !!(a && a.type.startsWith('slash'));
  player.blade.visible = swinging || inBattle();
  player.blade.rotation.x = swinging ? 0 : -1.3;   // in guard, the blade points forward and up
  if (sw.arc) {
    sw.arcT -= dt;
    const k = sw.arcT / 0.22;
    sw.arc.visible = k > 0;
    if (k > 0) {
      sw.arc.position.copy(pb.obj.position).addScaledVector(pb.dir, sw.arcStep.h);
      orient(sw.arc, pb.dir, pb.fwd);
      if (sw.arcStep.anim === 'slash2') sw.arc.rotateY(0.6 - (1 - k) * 1.2);   // sweep follows the blade
      sw.arc.material.opacity = k * 0.85;
      sw.arc.scale.setScalar(1 + (1 - k) * 0.35);
    }
  }
}
function updateCombat(dt, t) {
  if (player.char.art === 'kunai') updateThrow(dt); else updateSlash(dt);
  updateKunai(dt);
  // Red screen-edge glow after taking a hit.
  feedback.hurtGlow = Math.max(0, feedback.hurtGlow - dt * 2);
  hurtFx.style.opacity = feedback.hurtGlow.toFixed(2);
  updateCombatFX(dt, t);
  updateSparks(dt);
  updateShockFx(dt);
  updateFlashes(dt);
}

export { ARCS, COMBO, arcMat, dodgeRoll, equipWeapon, guardPose, landSwing, roll, slash, sw, updateCombat, updateSlash };
