/**
 * The eight-headed serpent and its sequenced head strikes.
 */
import { ch } from '../../challenges/system.js';
import { R } from '../../config/settings.js';
import { scene } from '../../core/Stage.js';
import { bossDef } from '../../data/bossDefs.js';
import { makeOrochi } from '../models/orochi.js';
import { SurfaceBody } from '../../physics/SurfaceBody.js';
import { rand } from '../../utils/random.js';
import { colliders } from '../../world/colliders.js';

/* ---------- Yamata-no-Orochi: a coiled body and eight necks ---------- */

class Orochi {
  constructor(dir, fwd) {
    this.def = bossDef('orochi');
    this.m = makeOrochi();
    this.b = new SurfaceBody(this.m.root, dir, fwd);
    this.seed = rand() * 10; this.lead = 0; this.mark = -1;
    this.col = { p: dir.clone().multiplyScalar(R), r: 2.6 };
    colliders.push(this.col);
    scene.add(this.m.root);
    this.b.sync();
  }
  update(dt, t) {
    const b = this.b, c = ch.active, mine = !!(c && c.host === this && c.move === 'heads');
    const windup = mine && c.phase === 'windup', strike = mine && c.phase === 'strike';
    // Pick a fresh head for each strike in the sequence, and keep it through the lunge.
    if (windup && this.mark !== c.heads) { this.mark = c.heads; this.lead = Math.floor(Math.random() * 8); }
    if (!mine) this.mark = -1;
    for (let i = 0; i < 8; i++) {
      const nk = this.m.necks[i], sway = Math.sin(t * 1.1 + nk.seed) * 0.17;
      const rear = i === this.lead && windup ? 1 : 0;
      const lunge = i === this.lead && strike ? 1 : 0;
      nk.root.rotation.x = -0.22 + sway - 0.55 * rear + 1.05 * lunge;
      nk.root.rotation.z = nk.spread * 0.45 + Math.sin(t * 0.9 + nk.seed) * 0.11 - nk.spread * 0.3 * lunge;
      nk.root.scale.set(1, 1 + 0.55 * lunge + 0.1 * Math.sin(t * 1.3 + nk.seed) - 0.1 * rear, 1);
      for (let k = 0; k < 5; k++) nk.segs[k].rotation.x = sway * 0.45 + (lunge ? -0.1 : 0.1) * k + 0.18 * rear;
      nk.head.rotation.x = -nk.root.rotation.x * 0.55;
      nk.head.rotation.y = Math.sin(t * 0.7 + nk.seed) * 0.2 * (1 - lunge);
    }
    this.m.tail.rotation.z = Math.sin(t * 0.8 + this.seed) * 0.3;
    this.m.body.position.y = Math.sin(t * 0.9) * 0.08;
    this.col.p.copy(b.dir).multiplyScalar(R);
    b.sync();
  }
}

export { Orochi };
