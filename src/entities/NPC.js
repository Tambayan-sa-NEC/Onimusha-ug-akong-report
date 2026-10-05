/**
 * Villagers and humanoid yokai: idle life, dialogue and gestures.
 */
import { R } from '../config/settings.js';
import { worldRoot } from '../core/Stage.js';
import { SHARED_LINES } from '../data/npcDefs.js';
import { player } from './Player.js';
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

const GENTLE_ACTIONS = ['bow', 'wave', null, null];

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
  pickLine() {
    const pool = Math.random() < 0.28 ? SHARED_LINES : this.def.lines;
    let line;
    for (let i = 0; i < 20; i++) { line = pool[Math.floor(Math.random() * pool.length)]; if (!this.recent.includes(line)) break; }
    this.recent.push(line);
    if (this.recent.length > 4) this.recent.shift();
    return line;
  }
  interact() {
    const b = this.b, P = player.body.obj.position;
    if (b.toward(P, tangentA)) b.turnToward(tangentA, Math.PI);
    const [text, action0, em] = this.pickLine();
    const action = action0 !== undefined ? action0 : GENTLE_ACTIONS[Math.floor(Math.random() * GENTLE_ACTIONS.length)];
    if (action === 'vanish') this.vanish(); else startAction(this.h, action);
    if (em) emote(b.obj.position, b.dir, em, 2.5 * (this.def.look.scale || 1));
    openDialog(this, text);
    Sound.sfx('talk');
    // The samurai returns the courtesy.
    const pb = player.body;
    if (pb.toward(b.obj.position, tangentA)) pb.turnToward(tangentA, Math.PI);
    startAction(player.h, 'bow');
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

export { GENTLE_ACTIONS, NPC, oniAnim };
