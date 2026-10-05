/**
 * Villagers and humanoid yokai: idle life, dialogue and gestures.
 */
import { GAMES } from '../challenges/games/index.js';
import { bossWon, gateOpen, won } from '../challenges/system.js';
import { R } from '../config/settings.js';
import { BOSS_ORDER } from '../data/bossDefs.js';
import { worldRoot } from '../core/Stage.js';
import { SHARED_LINES } from '../data/npcDefs.js';
import { player } from './Player.js';
import { cheer } from './pets.js';
import { didErrand, hasItem, markErrand, takeItem } from '../core/keepsakes.js';
import { ITEMS } from '../data/itemDefs.js';
import { applyAction, makeHumanoid, poseHumanoid, startAction } from './models/humanoid.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { emote } from '../render/effects/emotes.js';
import { Sound } from '../systems/audio.js';
import { openDialog } from '../ui/dialog.js';
import { angleBetween, damp } from '../utils/math.js';
import { rand, rr } from '../utils/random.js';
import { tangentA } from '../utils/scratch.js';
import { offsetDir, tangentToward } from '../utils/sphere.js';
import { colliders, hitsCollider } from '../world/colliders.js';
import { onLand } from '../world/terrain.js';

/** Oni arm pose: raise the club, then slam it down (driven by npc.slam). */
function oniAnim(n, dt) {
  if (n.slam > 0) { n.slam -= dt; n.h.arms[1].rotation.x = n.slam > 0.25 ? -2.9 : -0.9; }
}

const GENTLE_ACTIONS = ['bow', 'wave', 'nod', 'laugh', 'ponder', null, null];

/** Told when an errand is settled, so progress can be written down. Set at boot. */
let onErrandDone = () => {};
const setErrandListener = fn => { onErrandDone = fn; };

/**
 * How far along the journey is, as a single word. Lines in `npcDefs` may carry a
 * `when` naming one of these, and are then only said at that point.
 */
function chapter() {
  if (bossWon.size >= BOSS_ORDER.length) return 'done';
  if (gateOpen()) return 'gate';
  return won.size > 0 ? 'midway' : 'start';
}

/** A yokai whose game is still unwon, or null when none are left. */
function unwonGame() {
  const left = Object.keys(GAMES).filter(k => !won.has(k) && GAMES[k].title);
  return left.length ? left[Math.floor(Math.random() * left.length)] : null;
}

/** A villager pointing you at something you have not done yet. */
function hintLine() {
  const k = unwonGame();
  if (!k) {
    return gateOpen()
      ? ['The gate on the far hill is open. Whatever waits behind it has been waiting a long while.', 'bow', '門']
      : null;
  }
  return [`They say ${GAMES[k].title} is still unplayed. Someone out there is waiting for a worthy hand.`, 'wave', '?'];
}

class NPC {
  constructor(def, dir, fwd) {
    this.def = def;
    this.h = makeHumanoid(def.look);
    this.b = new SurfaceBody(this.h.root, dir, fwd);
    this.home = dir.clone();
    this.wander = def.wander || 0;
    this.state = 'idle'; this.timer = rr(2, 5); this.phase = 0; this.amt = 0; this.seed = rand() * 10;
    this.recent = [];
    this.col = { p: dir.clone().multiplyScalar(R), r: 0.45 * (def.look.scale || 1) };
    colliders.push(this.col);
    this.can = d => onLand(d) && !hitsCollider(d, 0.3, this.col);
    worldRoot.add(this.h.root);
    this.b.sync();
  }
  /** Lines that fit where the journey has got to. A line with no `when` always fits. */
  linesNow() {
    const now = chapter();
    const fits = l => !l[3] || l[3] === now;
    const own = this.def.lines.filter(fits);
    return own.length ? own : this.def.lines;
  }
  pickLine() {
    // Villagers who know things sometimes point you somewhere instead.
    if (this.def.hints && Math.random() < 0.34) {
      const hint = hintLine();
      if (hint) return hint;
    }
    const pool = Math.random() < 0.28 ? SHARED_LINES.filter(l => !l[3] || l[3] === chapter()) : this.linesNow();
    const use = pool.length ? pool : this.def.lines;
    let line;
    for (let i = 0; i < 20; i++) { line = use[Math.floor(Math.random() * use.length)]; if (!this.recent.includes(line)) break; }
    this.recent.push(line);
    if (this.recent.length > 4) this.recent.shift();
    return line;
  }
  /**
   * An errand, if this villager has one and it is the thing worth saying. Returns a
   * line in the usual shape, or null to carry on with ordinary conversation.
   *
   * Nothing is taken from you — they want to see the keepsake, not keep it.
   */
  errandLine() {
    const e = this.def.errand;
    if (!e) return null;
    if (didErrand(this.def.id)) {
      return Math.random() < 0.4 ? [e.done, 'nod', null] : null;   // mentioned, not laboured
    }
    if (!hasItem(e.wants)) return [e.ask, 'ponder', '?'];
    markErrand(this.def.id);
    const got = takeItem(e.gives);
    const item = ITEMS[e.gives];
    onErrandDone(this);
    const note = got && item ? '\n\n(' + item.name + ')' : '';
    return [e.thanks + note, 'bow', item ? item.seal : '礼'];
  }
  interact() {
    const b = this.b, P = player.body.obj.position;
    if (b.toward(P, tangentA)) b.turnToward(tangentA, Math.PI);
    const [text, action0, em] = this.errandLine() || this.pickLine();
    const action = action0 !== undefined ? action0 : GENTLE_ACTIONS[Math.floor(Math.random() * GENTLE_ACTIONS.length)];
    if (action === 'vanish') this.vanish(); else startAction(this.h, action);
    if (em) emote(b.obj.position, b.dir, em, 2.5 * (this.def.look.scale || 1));
    openDialog(this, text);
    Sound.sfx('talk');
    // The samurai returns the courtesy.
    const pb = player.body;
    if (pb.toward(b.obj.position, tangentA)) pb.turnToward(tangentA, Math.PI);
    startAction(player.h, 'bow');
    if (Math.random() < 0.3) cheer('talk');
  }
  vanish() {   // ninja trick: poof, reappear a few steps away
    const b = this.b;
    emote(b.obj.position, b.dir, 'ドロン!', 1.6, '#444444');
    Sound.sfx('poof');
    for (let i = 0; i < 30; i++) {
      const d = offsetDir(b.dir, Math.random() * 6.283, rr(3, 6) / R);
      if (onLand(d) && !hitsCollider(d, 0.5, this.col)) { b.dir.copy(d); b.fixFwd(); break; }
    }
    b.sync();
    emote(b.obj.position, b.dir, '…', 2.4, '#444444');
  }
  update(dt, t) {
    const b = this.b, P = player.body.obj.position, pd = b.dist(P), h = this.h;
    let speed = 0;
    if (this.hunting) {   // bearing down on the player
      speed = this.huntGait;
      if (!b.step(b.fwd, speed * dt, this.can)) b.turn(rr(1.5, 3));
    } else if (pd < 5) {   // turn to greet the player
      if (b.toward(P, tangentA)) b.turnToward(tangentA, 4 * dt);
      this.state = 'idle'; this.timer = Math.max(this.timer, 2);
    } else if (this.wander > 0 && !h.action) {
      this.timer -= dt;
      if (this.state === 'idle' && this.timer <= 0) { this.state = 'walk'; this.timer = rr(2, 4); b.turn(rr(-2, 2)); }
      else if (this.state === 'walk') {
        speed = 1;
        if (angleBetween(b.dir, this.home) > this.wander && tangentToward(b.dir, this.home, b.dir, tangentA)) b.turnToward(tangentA, 2 * dt);
        if (!b.step(b.fwd, speed * dt, this.can)) b.turn(rr(1.5, 3));
        if (this.timer <= 0) { this.state = 'idle'; this.timer = rr(3, 6); }
      }
    }
    b.sync();
    this.col.p.copy(b.dir).multiplyScalar(R);

    this.amt += (speed - this.amt) * damp(8, dt);
    this.phase += dt * (2 + speed * 3);
    poseHumanoid(h, this.phase, this.amt, t + this.seed);
    h.head.rotation.y = pd >= 5 && !h.action && !this.hunting ? Math.sin(t * 0.4 + this.seed) * 0.5 : 0;   // idle look-around
    applyAction(h, dt);
    if (this.def.anim) this.def.anim(this, dt, t);
  }
}

export { GENTLE_ACTIONS, NPC, chapter, hintLine, oniAnim, setErrandListener, unwonGame };
