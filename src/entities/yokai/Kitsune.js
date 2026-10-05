/**
 * The fox spirit, which blinks away when you get close.
 */
import * as THREE from 'three';
import { GAMES } from '../../challenges/games/index.js';
import { ch } from '../../challenges/system.js';
import { R } from '../../config/settings.js';
import { YOKAI_DEFS } from '../../data/yokaiDefs.js';
import { Quadruped } from '../Quadruped.js';
import { emote } from '../../render/effects/emotes.js';
import { GEO, group, part } from '../../render/materials.js';
import { Sound, nearVol } from '../../systems/audio.js';
import { rr } from '../../utils/random.js';
import { offsetDir } from '../../utils/sphere.js';
import { hitsCollider } from '../../world/colliders.js';
import { onLand } from '../../world/terrain.js';

const FOXFIRE = ['#bfe6ff', '#3f94d6'];   // colour, emissive glow

/** Kitsune: a fox spirit that plays hide-and-seek, blinking away when you get close. */
class Kitsune extends Quadruped {
  constructor(dir) {
    super('fox', { color: '#f7f3ec', belly: '#ffffff' }, dir);
    const m = this.m;
    m.tail.visible = false;
    m.head.add(part(GEO.cone, '#f7f3ec', [0, -0.05, 0.2], [0.08, 0.16, 0.08], [Math.PI / 2, 0, 0]));          // pointed snout
    for (const s of [-1, 1]) m.head.add(part(GEO.box, '#d9463b', [0.08 * s, 0.075, 0.131], [0.07, 0.02, 0.01])); // red markings
    m.tails = [-0.55, 0, 0.55].map(z => {
      const tail = group(part(GEO.ico, '#f7f3ec', [0, 0.26, 0], [0.1, 0.3, 0.1]), part(GEO.ico, '#d9463b', [0, 0.54, 0], [0.065, 0.09, 0.065]));
      tail.position.set(0, 0.4, -0.3);
      tail.rotation.set(-0.9, 0, z);
      tail.userData.z = z;
      m.body.add(tail);
      return tail;
    });
    m.fire = new THREE.Group();   // two orbiting kitsunebi (foxfire)
    m.fire.position.y = 0.75;
    for (const s of [-1, 1]) m.fire.add(part(GEO.ico, FOXFIRE[0], [0.55 * s, 0, 0], 0.08, null, FOXFIRE[1]));
    m.root.add(m.fire);
    this.def = YOKAI_DEFS.kitsune;
  }
  react() {
    const b = this.b;
    if (this.busy) {   // mid-tag: scamper away; mid-battle: stand and face you
      if (ch.active && ch.active.g === GAMES.tag) { this.state = 'flee'; this.timer = 0.8; } else { this.state = 'notice'; this.timer = 1; }
      this.cd = 0; return;
    }
    this.state = 'notice'; this.timer = 3; this.cd = 8;
    emote(b.obj.position, b.dir, 'コン!', 1.1);
    Sound.sfx('kon', nearVol(b.obj.position));
  }
  blink() {   // poof, reappear a little way off and watch you
    const b = this.b;
    Sound.sfx('kon', nearVol(b.obj.position));
    Sound.sfx('poof');
    for (let i = 0; i < 40; i++) {
      const d = offsetDir(b.dir, Math.random() * 6.283, rr(7, 11) / R);
      if (onLand(d) && !hitsCollider(d, 0.4)) { b.dir.copy(d); b.fixFwd(); break; }
    }
    b.lift = 0; b.vy = 0; b.grounded = true;
    b.sync();
    emote(b.obj.position, b.dir, '♪', 1.1, '#3f94d6');
    this.state = 'notice'; this.timer = rr(3, 5); this.cd = 3;
  }
  update(dt, t) {
    super.update(dt, t);
    const wag = this.state === 'notice' ? 6 : 1.5;
    this.m.tails.forEach((tl, i) => { tl.rotation.z = tl.userData.z + Math.sin(t * wag + i * 1.3) * 0.18; });
    this.m.fire.rotation.y += dt * 2;
    this.m.fire.position.y = 0.75 + Math.sin(t * 2.3 + this.seed) * 0.1;
  }
}

export { FOXFIRE, Kitsune };
