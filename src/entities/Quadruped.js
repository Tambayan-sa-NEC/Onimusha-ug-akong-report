/**
 * Cats and dogs: wandering, reacting, and the shared four-legged walk cycle.
 */
import { session } from '../core/Session.js';
import { worldRoot } from '../core/Stage.js';
import { player } from './Player.js';
import { makeQuadruped } from './models/critters.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { emote } from '../render/effects/emotes.js';
import { Sound, nearVol } from '../systems/audio.js';
import { clamp, damp } from '../utils/math.js';
import { pick, rand, rr } from '../utils/random.js';
import { tangentA } from '../utils/scratch.js';
import { hitsCollider } from '../world/colliders.js';
import { onLand } from '../world/terrain.js';

class Quadruped {
  constructor(kind, look, dir) {
    this.kind = kind;
    this.m = makeQuadruped({ ...look, kind, scale: kind === 'dog' ? 1.25 : 0.9 });
    this.b = new SurfaceBody(this.m.root, dir);
    worldRoot.add(this.m.root);
    this.state = 'idle'; this.timer = rr(1, 4); this.cd = rr(0, 3);
    this.phase = rand() * 10; this.speed = 0; this.seed = rand() * 10;
    this.rad = kind === 'dog' ? 0.35 : 0.28;
    this.can = d => onLand(d) && (!hitsCollider(d, this.rad) || hitsCollider(this.b.dir, this.rad));
    this.b.sync();
  }
  say(text) {
    emote(this.b.obj.position, this.b.dir, text, this.kind === 'dog' ? 1.3 : 1.0);
    Sound.sfx(this.kind === 'dog' ? 'bark' : 'meow', nearVol(this.b.obj.position));
  }
  /** Charming reaction when the samurai comes close. */
  react(pd) {
    const b = this.b;
    if (this.kind === 'cat') {
      if (player.sprinting && pd < 2.8) { this.state = 'flee'; this.timer = 1.6; this.cd = 6; emote(b.obj.position, b.dir, '!', 1.0); }
      else { this.state = 'notice'; this.timer = 2.6; this.cd = 9; b.jump(3.2); this.say(pick(['ニャ〜', 'にゃ♪', '…ニャ?'])); }
    } else {
      this.state = 'follow'; this.timer = 7; this.cd = 13; b.jump(4); this.say(pick(['ワン!', 'ワンワン!', '♥']));
    }
  }
  update(dt, t) {
    const b = this.b, P = player.body.obj.position, pd = b.dist(P);
    this.cd -= dt; this.timer -= dt;
    let target = 0, wag = 2;

    if (this.hunting) { this.state = 'hunt'; target = this.huntGait; wag = 12; }   // no case below: the hunt steers
    else if (session.started && this.cd <= 0 && pd < (this.kind === 'dog' ? 5 : 3.5)) this.react(pd);
    switch (this.state) {
      case 'idle':
        if (this.timer <= 0) { this.state = 'walk'; this.timer = rr(2, 6); b.turn(rr(-2, 2)); }
        break;
      case 'walk':
        target = this.kind === 'dog' ? 1.6 : 1.1;
        b.turn(Math.sin(t * 0.7 + this.seed) * 0.8 * dt);
        if (this.timer <= 0) { this.state = 'idle'; this.timer = rr(2, 6); }
        break;
      case 'notice':   // stop, look up at the player, swish tail
        if (b.toward(P, tangentA)) b.turnToward(tangentA, 5 * dt);
        wag = 8;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = rr(2, 4); }
        break;
      case 'flee':
        if (b.toward(P, tangentA)) b.turnToward(tangentA.negate(), 8 * dt);
        target = 3.8;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = rr(2, 4); }
        break;
      case 'follow':   // shiba trots after you, tail going wild
        if (b.toward(P, tangentA)) b.turnToward(tangentA, 6 * dt);
        target = pd > 2.2 ? Math.min(5.5, pd * 1.4) : 0;
        wag = 16;
        if (b.grounded && pd < 3 && Math.random() < dt * 0.8) b.jump(3);
        if (Math.random() < dt * 0.2) this.say('ワン!');
        if (this.timer <= 0 || pd > 14) { this.state = 'idle'; this.timer = rr(2, 4); }
        break;
    }
    this.speed += (target - this.speed) * damp(6, dt);
    if (this.speed > 0.05 && !b.step(b.fwd, this.speed * dt, this.can)) b.turn(rr(1.5, 3));
    b.physics(dt);
    b.sync();

    // Animation
    this.phase += dt * this.speed * 7;
    const amt = clamp(this.speed / 1.2, 0, 1), s = Math.sin(this.phase) * 0.7 * amt, L = this.m.legs;
    L[0].rotation.x = L[3].rotation.x = s;
    L[1].rotation.x = L[2].rotation.x = -s;
    this.m.tail.rotation.z = Math.sin(t * wag + this.seed) * (this.kind === 'dog' ? 0.45 : 0.35);
    this.m.head.rotation.x = this.state === 'idle' ? Math.sin(t * 0.8 + this.seed) * 0.12 : (this.state === 'notice' ? -0.3 : 0);
  }
}

export { Quadruped };
