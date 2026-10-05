/**
 * The lantern ghost that drifts and says boo.
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
import { angleBetween } from '../../utils/math.js';
import { rand, rr } from '../../utils/random.js';
import { tangentA } from '../../utils/scratch.js';
import { tangentToward } from '../../utils/sphere.js';
import { onLand } from '../../world/terrain.js';

/** Chōchin-obake: a glowing paper lantern ghost that floats around and says "boo". */
function makeChochin() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.add(part(GEO.ico1, '#f6dcae', [0, 0, 0], [0.36, 0.46, 0.36], null, '#9a5a1c'));   // glowing paper
  for (const y of [-0.28, 0, 0.28]) body.add(part(GEO.ring, '#8a5a3a', [0, y, 0], [y ? 0.3 : 0.37, 1, y ? 0.3 : 0.37]));
  for (const y of [-0.47, 0.47]) body.add(part(GEO.cyl, '#2a2626', [0, y, 0], [0.18, 0.08, 0.18]));
  body.add(part(GEO.ico1, '#ffffff', [0, 0.12, 0.3], [0.12, 0.12, 0.07]));
  body.add(part(GEO.ico, '#1a1616', [0, 0.12, 0.36], 0.05));
  body.add(part(GEO.box, '#5a2320', [0, -0.12, 0.33], [0.3, 0.06, 0.04]));   // split-paper mouth
  const tongue = group(part(GEO.box, '#e86a7a', [0, -0.16, 0], [0.1, 0.32, 0.03]));
  tongue.position.set(0, -0.13, 0.36);
  body.add(tongue);
  return { root, body, tongue };
}
class Chochin {
  constructor(dir) {
    this.m = makeChochin();
    this.b = new SurfaceBody(this.m.root, dir);
    this.home = dir.clone(); this.cd = 0; this.pop = 0; this.seed = rand() * 10; this.drift = rr(0.2, 0.4);
    this.def = YOKAI_DEFS.chochin;
    worldRoot.add(this.m.root);
  }
  update(dt, t) {
    const b = this.b, P = player.body.obj.position, pd = b.dist(P);
    this.cd -= dt;
    if (!this.busy && session.started && this.cd <= 0 && pd < 3.2) {   // "Baa!" pops up with its tongue out
      this.cd = 8; this.pop = 1;
      emote(b.obj.position, b.dir, 'ばあ!', 0.9, '#b8433c');
      Sound.sfx('boo', nearVol(b.obj.position));
    }
    this.pop = Math.max(0, this.pop - dt * 0.7);
    if (pd < 6 || this.busy) { if (b.toward(P, tangentA)) b.turnToward(tangentA, 3 * dt); }
    else {   // lazy drift around its home spot
      b.turn(Math.sin(t * 0.3 + this.seed) * 0.6 * dt);
      if (angleBetween(b.dir, this.home) > 0.08 && tangentToward(b.dir, this.home, b.dir, tangentA)) b.turnToward(tangentA, 1.5 * dt);
      b.step(b.fwd, this.drift * dt, onLand);
    }
    const bounce = Math.sin(this.pop * Math.PI) * 0.8;
    b.lift = 1.5 + Math.sin(t * 1.4 + this.seed) * 0.2 + bounce;
    b.sync();
    this.m.body.rotation.z = Math.sin(t * 1.1 + this.seed) * 0.12;
    this.m.body.rotation.x = -bounce * 0.4;
    this.m.tongue.scale.y = 1 + this.pop * 2.2;
    this.m.tongue.rotation.x = Math.sin(t * 7) * 0.25 * this.pop;
  }
}

export { Chochin, makeChochin };
