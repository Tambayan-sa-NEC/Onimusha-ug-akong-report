/**
 * An ordinary yokai fight: footwork, telegraphs, damage and the result.
 */
import { ch, chUI, hostEmoteH, rpick, setStatus } from '../challenges/system.js';
import { FX_DASH, FX_STRIKE, hostFx } from './fx.js';
import { R } from '../config/settings.js';
import { player } from '../entities/Player.js';
import { startAction } from '../entities/models/humanoid.js';
import { moveWithSlide } from '../physics/movement.js';
import { emote } from '../render/effects/emotes.js';
import { flash } from '../render/effects/flash.js';
import { feedback, impact, shockwave } from '../render/effects/impact.js';
import { makeShockRing, removeMesh, updateShockRing } from '../render/effects/rings.js';
import { burst } from '../render/effects/sparks.js';
import { Sound } from '../systems/audio.js';
import { angleBetween } from '../utils/math.js';
import { tangentB, tangentC, vecA } from '../utils/scratch.js';
import { tangentBasis, tangentToward } from '../utils/sphere.js';
import { arena } from '../world/Arena.js';
import { onLand } from '../world/terrain.js';

const playerHP = () => player.char.hp;
const DEFAULT_BATTLE = { hp: 8, radius: 2.4, windup: 0.75, rest: 1.1, speed: 2.4,
  recover: 0.55, dash: 5, dashSpeed: 12, moves: ['slam'] };
const hearts = (n, max, on, off) => on.repeat(Math.max(0, n)) + off.repeat(Math.max(0, max - n));
const inBattle = () => !!(ch.active && ch.active.g.fight && !ch.active.done);

/* ---------- Battle (runs through the challenge flow: HUD, result, seal, cooldown) ---------- */
const BATTLE = { seal: '戦', title: 'Battle', locks: false, fight: true,
  how: 'Click to slash; keep clicking for a 3-hit combo. A ring under a yokai means a slam — leave the ring or jump. A ring ahead of it means a charge — step aside.',
  intro: ['Hah! You draw your blade on me? So be it!', 'A fight? Very well, samurai. Show me your sword!'],
  win: ['Mairimashita! I yield, samurai. Take my seal.', 'Your blade is honest and swift. The seal is yours.'],
  lose: ['Hah! Rest a while, little samurai, and try again.', 'Even samurai fall. Fall seven times, stand up eight!'],
  start(c) {
    const st = c.st = { ...DEFAULT_BATTLE, ...(c.host.def.battle || {}) };
    c.hp = st.hp; c.php = playerHP(); c.next = 0.6; c.phase = 'idle'; c.inv = 0; c.pinv = 0;
    c.move = 'slam'; c.rt = 0;
    c.orbit = Math.random() < 0.5 ? 1 : -1; c.orbitT = 1.2 + Math.random() * 1.6;
    c.warn = makeShockRing(c.host.b.dir);
    c.warn.a = st.radius / R;
    c.warn.mesh.material.color.set('#e0503a');
    c.warn.mesh.visible = false;
    hostFx(c.host);
    chUI.title.textContent = `戦  Battle: ${c.host.def.name}`;
  },
  /** The player's blade connects. dmg/kb grow with the combo finisher. */
  hit(c, dmg = 1, kb = 0.8, finisher = false) {
    if (c.inv > 0 || c.done) return;
    const host = c.host, hb = host.b, pb = player.body, f = hostFx(host);
    c.inv = 0.15; c.hp -= dmg;
    f.hurt = 0.3;
    flash(hb.obj);
    burst(vecA.copy(hb.obj.position).addScaledVector(hb.dir, hostEmoteH(host) * 0.5), hb.dir, finisher ? 22 : 12, ['#ffffff', '#ffd56a', '#fff1c2'], finisher ? 7 : 5);
    emote(hb.obj.position, hb.dir, finisher ? '斬!!' : '斬!', hostEmoteH(host));
    Sound.sfx('clash');
    impact(finisher ? 0.11 : 0.06, finisher ? 0.3 : 0.14);
    if (tangentToward(hb.dir, pb.dir, hb.dir, tangentB)) hb.step(tangentB.negate(), kb, onLand);   // knock back
    // A finisher through the windup breaks the attack and leaves it wide open.
    if (finisher && (c.phase === 'windup' || c.phase === 'strike')) c.g.stagger(c, f);
  },
  stagger(c, f) {
    c.phase = 'recover'; c.rt = c.st.recover;
    f.wind = 0; f.dash = 0; f.recover = c.st.recover;
    c.warn.mesh.visible = false;
  },
  /** Idle footwork: close the gap, give ground when crowded, otherwise circle for an opening. */
  circle(c, dt, dist, f) {
    const hb = c.host.b, pb = player.body, st = c.st;
    if (!tangentToward(hb.dir, pb.dir, hb.dir, tangentB)) return;
    hb.turnToward(tangentB, 5 * dt);                           // always square up to you
    if (dist > st.radius + 1.2) { hb.step(tangentB, st.speed * dt, onLand); f.chase = 1; }
    else if (dist < 1.5) hb.step(tangentC.copy(tangentB).negate(), st.speed * 0.7 * dt, onLand);
    else {                                                // strafe, switching sides now and then
      if ((c.orbitT -= dt) <= 0) { c.orbit = -c.orbit; c.orbitT = 1.2 + Math.random() * 1.6; }
      tangentC.crossVectors(hb.dir, tangentB).multiplyScalar(c.orbit);
      if (!hb.step(tangentC, st.speed * 0.55 * dt, onLand)) c.orbit = -c.orbit;
      f.chase = 0.45;
    }
    if ((c.next -= dt) <= 0 && dist < st.radius + 3) c.g.beginMove(c, dist);
  },
  /** Pick the next attack and telegraph where it will land. */
  beginMove(c, dist) {
    const host = c.host, hb = host.b, pb = player.body, st = c.st;
    c.move = rpick(st.moves);
    if (c.move === 'dash' && dist < st.radius * 0.8) c.move = 'slam';   // no room for a run-up
    c.phase = 'windup'; c.wt = st.windup;
    host.slam = st.windup + 0.25;
    if (c.move === 'dash') {
      if (tangentToward(hb.dir, pb.dir, hb.dir, tangentB)) hb.turnToward(tangentB, Math.PI);   // commit to a line, then you may dodge it
      c.warn.a = 1.6 / R;
      c.warn.c.copy(hb.dir).addScaledVector(hb.fwd, st.dash / R).normalize();
    } else {
      c.warn.a = st.radius / R;
      c.warn.c.copy(hb.dir);
    }
    tangentBasis(c.warn.c, c.warn.u, c.warn.v);
    emote(hb.obj.position, hb.dir, c.move === 'dash' ? '突!' : '!', hostEmoteH(host) + 0.6);
  },
  windup(c, dt, f) {
    const hb = c.host.b, st = c.st;
    c.wt -= dt;
    f.wind = 1 - c.wt / st.windup;
    if (c.move === 'slam') { c.warn.c.copy(hb.dir); tangentBasis(c.warn.c, c.warn.u, c.warn.v); }   // the ring tracks its feet
    updateShockRing(c.warn);
    c.warn.mesh.visible = true;
    c.warn.mesh.material.opacity = 0.35 + 0.45 * Math.abs(Math.sin(c.wt * 14));
    if (c.wt <= 0) c.g.launch(c, f);
  },
  /** Windup over: a slam lands at once, a charge starts travelling. */
  launch(c, f) {
    const host = c.host, hb = host.b, pb = player.body, st = c.st;
    c.warn.mesh.visible = false;
    f.wind = 0; f.strike = FX_STRIKE;
    c.phase = 'strike';
    if (c.move === 'dash') {
      c.rt = FX_DASH; f.dash = FX_DASH;
      Sound.sfx('swish');
      burst(hb.obj.position, hb.dir, 10, ['#e9dfc6', '#cdbf9b'], 3, 0.2);
      return;
    }
    c.rt = 0.22;                       // short follow-through before the recovery
    Sound.sfx('boom');
    shockwave(hb.dir, st.radius);
    burst(hb.obj.position, hb.dir, 16, ['#cdbf9b', '#e9dfc6', '#a89a7c'], 4, 0.3);
    impact(0, 0.12);
    if (angleBetween(pb.dir, hb.dir) * R < st.radius && pb.lift < 0.5) c.g.hurtPlayer(c);
  },
  /** Active frames. A charge keeps travelling and hurts on contact. */
  striking(c, dt, f) {
    const hb = c.host.b, pb = player.body, st = c.st;
    if (c.move === 'dash') {
      if (!hb.step(hb.fwd, st.dashSpeed * dt, onLand)) {   // ran into the sea or a hillside
        c.rt = 0; f.dash = 0;
        impact(0.05, 0.25);
        emote(hb.obj.position, hb.dir, '!?', hostEmoteH(c.host));
      } else if (angleBetween(pb.dir, hb.dir) * R < 1.7 && pb.lift < 0.9) c.g.hurtPlayer(c);
    }
    if ((c.rt -= dt) <= 0) { c.phase = 'recover'; c.rt = st.recover; f.recover = st.recover; }
  },
  /** The yokai connects. */
  hurtPlayer(c) {
    if (c.pinv > 0 || player.inv > 0) return;   // a shadow dash slips the blow
    const pb = player.body, hb = c.host.b;
    c.php--; c.pinv = 0.8;
    Sound.sfx('hit');
    emote(pb.obj.position, pb.dir, '痛!', 2.4);
    flash(player.h.root);
    burst(vecA.copy(pb.obj.position).addScaledVector(pb.dir, 1.1), pb.dir, 14, ['#e0503a', '#ffffff', '#ff9a7a'], 5);
    impact(0.09, 0.4);
    feedback.hurtGlow = 1;
    startAction(player.h, 'hurt');
    if (tangentToward(pb.dir, hb.dir, pb.dir, tangentB)) moveWithSlide(pb, tangentB.negate(), 1.4);
    pb.jump(4);
  },
  update(c, dt) {
    const host = c.host, hb = host.b, pb = player.body, st = c.st, f = hostFx(host);
    const dist = angleBetween(pb.dir, hb.dir) * R;
    c.inv -= dt; c.pinv -= dt;
    // Face the foe while standing still, so clicks land.
    if (player.vel.length() < 0.5 && tangentToward(pb.dir, hb.dir, pb.dir, tangentB)) pb.turnToward(tangentB, 8 * dt);

    if (c.phase === 'idle') c.g.circle(c, dt, dist, f);
    else if (c.phase === 'windup') c.g.windup(c, dt, f);
    else if (c.phase === 'strike') c.g.striking(c, dt, f);
    else if ((c.rt -= dt) <= 0) { c.phase = 'idle'; c.next = st.rest + Math.random() * 0.8; }

    setStatus(`You ${hearts(c.php, playerHP(), '♥', '♡')}    ${host.def.name} ${hearts(c.hp, st.hp, '■', '□')}`);
    if (c.hp <= 0) {
      c.note = 'Defeated!';
      f.ko = 2.2; f.wind = 0; f.dash = 0; f.recover = 0;
      c.warn.mesh.visible = false;
      impact(0.15, 0.35);
      return 'win';
    }
    if (c.php <= 0) { c.note = 'You are worn out.'; startAction(player.h, 'kneel'); return 'lose'; }
    // A sealed arena has no outside to flee to.
    if (!arena.active && dist > 20) { c.note = 'You fled the battle.'; return 'lose'; }
    return null;
  },
  end(c) { removeMesh(c.warn.mesh); if (c.host.fx) { c.host.fx.wind = 0; c.host.fx.dash = 0; c.host.fx.recover = 0; } },
};

export { BATTLE, DEFAULT_BATTLE, hearts, inBattle, playerHP };
