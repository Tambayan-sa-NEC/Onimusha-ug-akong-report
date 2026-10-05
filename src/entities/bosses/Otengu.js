/**
 * The mountain king: wings, a dive attack, and a second wind.
 */
import { ch } from '../../challenges/system.js';
import { R } from '../../config/settings.js';
import { scene } from '../../core/Stage.js';
import { bossDef } from '../../data/bossDefs.js';
import { applyAction, makeHumanoid, poseHumanoid } from '../models/humanoid.js';
import { SurfaceBody } from '../../physics/SurfaceBody.js';
import { GEO, group, part } from '../../render/materials.js';
import { angleBetween, clamp, damp } from '../../utils/math.js';
import { rand } from '../../utils/random.js';
import { colliders } from '../../world/colliders.js';

/* ---------- Ōtengu: a mountain king with a four-metre wingspan ---------- */
const OTENGU_LOOK = { top: '#2d2d38', bottom: '#4a2f2c', sash: '#c8423a', skin: '#c23a2c', collar: '#efe9dc',
  hair: 'short', hairColor: '#ece6da', nose: '#c23a2c', wings: '#1b1b24', hat: 'tokin', scale: 2.3 };
class Otengu {
  constructor(dir, fwd) {
    this.def = bossDef('otengu');
    this.h = makeHumanoid(OTENGU_LOOK);
    const fan = group(   // tengu-uchiwa: the feather fan that calls the wind
      part(GEO.cyl, '#3a2a22', [0, -0.3, 0], [0.04, 0.6, 0.04]),
      part(GEO.kasa, '#efe9dc', [0, 0.18, 0], [0.42, 0.34, 0.1], [Math.PI, 0, 0]),
    );
    fan.position.set(0.02, -0.62, 0.04);
    this.h.arms[1].add(fan);
    this.b = new SurfaceBody(this.h.root, dir, fwd);
    this.phase = 0; this.amt = 0; this.seed = rand() * 10;
    this.prev = dir.clone();
    this.col = { p: dir.clone().multiplyScalar(R), r: 1.25 };
    colliders.push(this.col);
    scene.add(this.h.root);
    this.b.sync();
  }
  update(dt, t) {
    const b = this.b, h = this.h, c = ch.active, mine = c && c.host === this;
    const speed = dt > 0 ? angleBetween(b.dir, this.prev) * R / dt : 0;
    this.prev.copy(b.dir);
    this.amt += (clamp(speed / 2.6, 0, 1.3) - this.amt) * damp(8, dt);
    this.phase += dt * (2 + speed * 2);
    poseHumanoid(h, this.phase, this.amt, t + this.seed);
    applyAction(h, dt);
    // Wings beat with the stride, and hammer when it leaves the ground.
    const air = clamp(b.lift / 3, 0, 1);
    const beat = 0.45 + Math.sin(t * (5 + speed * 1.5 + air * 9)) * (0.22 + 0.3 * this.amt + 0.45 * air);
    h.wings.forEach((w, i) => {
      w.rotation.y = (i ? 1 : -1) * beat;
      w.rotation.z = (i ? -1 : 1) * (0.18 * this.amt + 0.5 * air);
    });
    if (mine && c.move === 'swoop' && c.phase === 'windup') h.head.rotation.x = -0.4;   // sights the ground
    this.col.p.copy(b.dir).multiplyScalar(R);
    b.sync();
  }
}

export { OTENGU_LOOK, Otengu };
