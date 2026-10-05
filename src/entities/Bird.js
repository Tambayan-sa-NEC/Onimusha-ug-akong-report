/**
 * Birds that peck, hop and take flight.
 */
import { session } from '../core/Session.js';
import { worldRoot } from '../core/Stage.js';
import { player } from './Player.js';
import { makeBird } from './models/critters.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { emote } from '../render/effects/emotes.js';
import { Sound, nearVol } from '../systems/audio.js';
import { damp } from '../utils/math.js';
import { pick, rand, rr } from '../utils/random.js';
import { tangentA } from '../utils/scratch.js';
import { onLand } from '../world/terrain.js';

class Bird {
  constructor(look, dir) {
    this.m = makeBird(look.c, look.b);
    this.b = new SurfaceBody(this.m.root, dir);
    worldRoot.add(this.m.root);
    this.state = 'ground'; this.timer = rr(0.5, 2); this.alt = 0; this.peck = 0; this.seed = rand() * 10;
    this.b.sync();
  }
  takeoff(scared) {
    const b = this.b;
    this.state = 'fly'; this.timer = rr(5, 10); this.alt = rr(4, 8);
    b.grounded = false; b.vy = 0;
    if (scared) {
      if (b.toward(player.body.obj.position, tangentA)) b.turnToward(tangentA.negate(), Math.PI);
      emote(b.obj.position, b.dir, pick(['ピヨ!', 'チュン!', '!']), 0.8);
      Sound.sfx('chirp', nearVol(b.obj.position));
    }
  }
  update(dt, t) {
    const b = this.b, pd = b.dist(player.body.obj.position), W = this.m.wings;
    this.timer -= dt;
    if (this.state === 'ground') {
      if (b.grounded && this.timer <= 0) {
        if (rand() < 0.55) { b.jump(2.6); b.turn(rr(-1, 1)); } else this.peck = 0.4;
        this.timer = rr(0.5, 1.5);
      }
      if (!b.grounded) b.step(b.fwd, dt * 1.6, onLand);
      b.physics(dt, 14);
      this.peck -= dt;
      this.m.body.rotation.x = this.peck > 0 ? 0.5 : 0;
      W[0].rotation.z = W[1].rotation.z = 0;
      if ((session.started && pd < 4) || Math.random() < dt * 0.015) this.takeoff(session.started && pd < 4);
    } else {
      const flying = this.timer > 0;
      b.lift += ((flying ? this.alt : 0) - b.lift) * damp(1.1, dt);
      b.turn(Math.sin(t * 0.5 + this.seed) * 0.9 * dt);
      b.step(b.fwd, dt * (flying ? 5.5 : 3));
      const f = Math.sin(t * (flying ? 18 : 12) + this.seed) * 0.9;
      W[0].rotation.z = -f; W[1].rotation.z = f;
      this.m.body.rotation.x = -0.1;
      if (!flying && b.lift < 0.4) {
        if (onLand(b.dir)) { b.lift = 0; b.grounded = true; this.state = 'ground'; this.timer = rr(1, 3); this.m.body.rotation.x = 0; }
        else { this.timer = 2; this.alt = rr(3, 5); }   // over a pond: circle a little longer
      }
    }
    b.sync();
  }
}

const KOI_COLORS = [['#f07a2e', '#ffffff'], ['#ffffff', '#e0402e'], ['#f2b33a', '#fff4d6'], ['#fafafa', '#2a2a2a']];

export { Bird, KOI_COLORS };
