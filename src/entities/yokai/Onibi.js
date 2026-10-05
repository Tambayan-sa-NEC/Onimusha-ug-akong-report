/**
 * Will-o'-the-wisps that circle curious visitors.
 */
import { session } from '../../core/Session.js';
import { worldRoot } from '../../core/Stage.js';
import { YOKAI_DEFS } from '../../data/yokaiDefs.js';
import { player } from '../Player.js';
import { FOXFIRE } from './Kitsune.js';
import { SurfaceBody } from '../../physics/SurfaceBody.js';
import { GEO, group, part } from '../../render/materials.js';
import { Sound } from '../../systems/audio.js';
import { rand, rr } from '../../utils/random.js';
import { tangentA, tangentB } from '../../utils/scratch.js';

/** Onibi: little blue will-o'-wisps that drift over the planet and circle curious visitors. */
function makeOnibi() {
  return group(
    part(GEO.ico, FOXFIRE[0], [0, 0, 0], 0.13, null, FOXFIRE[1]),
    part(GEO.cone, FOXFIRE[0], [0, 0.02, -0.2], [0.09, 0.32, 0.09], [-Math.PI / 2, 0, 0], FOXFIRE[1]),
  );
}
class Onibi {
  constructor(dir) {
    this.m = makeOnibi();
    this.b = new SurfaceBody(this.m, dir);
    this.alt = rr(1.6, 3.2); this.speed = rr(0.8, 1.5); this.seed = rand() * 10; this.cd = 0; this.orbit = 0;
    this.def = YOKAI_DEFS.onibi;
    worldRoot.add(this.m);
  }
  update(dt, t) {
    const b = this.b, P = player.body.obj.position, pd = b.dist(P);
    this.cd -= dt; this.orbit -= dt;
    if (!this.busy && !this.hunting && session.started && this.cd <= 0 && pd < 4) { this.cd = 12; this.orbit = 4; Sound.sfx('wisp'); }
    let speed = this.speed;
    if (this.hunting) speed = this.huntGait;
    else if (this.busy) { speed = 0; if (b.toward(P, tangentA)) b.turnToward(tangentA, 3 * dt); }   // hover while you play
    else if (this.orbit > 0 && b.toward(P, tangentA)) {   // circle the player at a polite distance
      tangentB.crossVectors(b.dir, tangentA).addScaledVector(tangentA, (pd - 3.2) * 0.6).normalize();
      b.turnToward(tangentB, 5 * dt);
      speed = 3;
    } else b.turn(Math.sin(t * 0.6 + this.seed) * 1.2 * dt);
    b.step(b.fwd, speed * dt);
    b.lift = (this.hunting ? 0.9 : this.alt) + Math.sin(t * 2 + this.seed) * 0.3;   // drops to attack height
    b.sync();
    this.m.scale.setScalar(1 + Math.sin(t * 6 + this.seed) * 0.12);
  }
}

export { Onibi, makeOnibi };
