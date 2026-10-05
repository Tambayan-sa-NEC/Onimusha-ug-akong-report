/**
 * The one-legged umbrella that never stops hopping.
 */
import * as THREE from 'three';
import { session } from '../../core/Session.js';
import { worldRoot } from '../../core/Stage.js';
import { YOKAI_DEFS } from '../../data/yokaiDefs.js';
import { player } from '../Player.js';
import { SurfaceBody } from '../../physics/SurfaceBody.js';
import { emote } from '../../render/effects/emotes.js';
import { GEO, group, part } from '../../render/materials.js';
import { Sound, nearVol } from '../../systems/audio.js';
import { damp } from '../../utils/math.js';
import { rand, rr } from '../../utils/random.js';
import { tangentA } from '../../utils/scratch.js';
import { hitsCollider } from '../../world/colliders.js';
import { onLand } from '../../world/terrain.js';

/** Kasa-obake: a one-eyed, one-legged paper umbrella that never stops hopping. */
function makeKasaObake() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.add(part(GEO.cyl, '#6b4a3a', [0, 0.5, 0], [0.04, 0.9, 0.04]));          // handle = leg
  body.add(part(GEO.box, '#9a7550', [0, 0.04, 0.03], [0.14, 0.06, 0.24]));    // geta sandal
  body.add(part(GEO.kasa, '#c2473d', [0, 1.2, 0], [0.62, 0.55, 0.62]));      // oil-paper canopy
  body.add(part(GEO.ico, '#e9c46a', [0, 1.5, 0], 0.05));
  body.add(part(GEO.ico1, '#ffffff', [0, 1.12, 0.36], [0.13, 0.13, 0.08]));  // one big eye
  body.add(part(GEO.ico, '#1a1616', [0, 1.12, 0.43], 0.055));
  const tongue = group(part(GEO.box, '#e86a7a', [0, -0.14, 0], [0.1, 0.28, 0.03]));
  tongue.position.set(0, 0.95, 0.46);
  body.add(tongue);
  return { root, body, tongue };
}
class KasaObake {
  constructor(dir) {
    this.m = makeKasaObake();
    this.b = new SurfaceBody(this.m.root, dir);
    worldRoot.add(this.m.root);
    this.timer = rr(0, 1); this.cd = 0; this.spin = 0; this.squash = 1; this.seed = rand() * 10;
    this.can = d => onLand(d) && !hitsCollider(d, 0.3);
    this.def = YOKAI_DEFS.kasa;
    this.b.sync();
  }
  update(dt, t) {
    const b = this.b, P = player.body.obj.position, pd = b.dist(P);
    this.cd -= dt; this.spin -= dt;
    if (b.grounded) this.timer -= dt;
    if (!this.busy && session.started && this.cd <= 0 && pd < 3.5) {   // twirl and cackle
      this.cd = 7; this.spin = 1.4;
      emote(b.obj.position, b.dir, 'ケケケ!', 1.9, '#7a3d8f');
      Sound.sfx('boing', nearVol(b.obj.position));
    }
    if (this.busy) { if (b.toward(P, tangentA)) b.turnToward(tangentA, 6 * dt); }   // mid-challenge: hops only on your beat
    else {
      if (b.grounded && this.timer <= 0) {         // hop, hop, hop
        b.jump(this.spin > 0 ? 4.5 : 3);
        this.timer = rr(0.05, 0.35);
        if (this.spin > 0 && b.toward(P, tangentA)) b.turnToward(tangentA, Math.PI); else b.turn(rr(-0.7, 0.7));
      }
      if (!b.grounded && !b.step(b.fwd, dt * (this.spin > 0 ? 0.6 : 1.6), this.can)) b.turn(rr(1.5, 3));
    }
    b.physics(dt, 16);
    b.sync();
    // Squash on landing, spin while excited, tongue flaps.
    this.squash += ((b.grounded ? 0.8 : 1.08) - this.squash) * damp(18, dt);
    const w = 1 / Math.sqrt(this.squash);
    this.m.body.scale.set(w, this.squash, w);
    this.m.body.rotation.y = this.spin > 0 ? (1.4 - this.spin) * 9 : 0;
    this.m.tongue.rotation.x = Math.sin(t * 9 + this.seed) * 0.35;
    this.m.tongue.scale.y = this.spin > 0 ? 1.8 : 1;
  }
}

export { KasaObake, makeKasaObake };
