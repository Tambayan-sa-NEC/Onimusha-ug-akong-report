/**
 * Koi circling in the ponds.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { worldRoot } from '../core/Stage.js';
import { KOI_COLORS } from './Bird.js';
import { player } from './Player.js';
import { makeKoi } from './models/critters.js';
import { emote } from '../render/effects/emotes.js';
import { orient } from '../render/materials.js';
import { Sound, nearVol } from '../systems/audio.js';
import { pick, rand, rr } from '../utils/random.js';

const V3 = THREE.Vector3;

class Koi {
  constructor(pond) {
    this.p = pond;
    const [c1, c2] = pick(KOI_COLORS);
    this.m = makeKoi(c1, c2);
    worldRoot.add(this.m.root);
    this.a = rand() * Math.PI * 2; this.r = rr(0.35, 0.55) * pond.r;
    this.w = rr(0.6, 1.0); this.sign = rand() < 0.5 ? -1 : 1; this.seed = rand() * 10; this.jump = -1;
    this.dir = new V3(); this.fwd = new V3();
  }
  update(dt, t) {
    const p = this.p, near = player.body.obj.position.distanceTo(p.world) < p.r * R + 3;
    const r = this.r + Math.sin(t * 0.3 + this.seed) * 0.1 * p.r;
    this.a += this.sign * this.w * (near ? 2.2 : 1) * dt / (r * R);   // swim faster when watched
    const ca = Math.cos(this.a), sa = Math.sin(this.a);
    this.dir.copy(p.c).multiplyScalar(Math.cos(r)).addScaledVector(p.u, ca * Math.sin(r)).addScaledVector(p.v, sa * Math.sin(r)).normalize();
    this.fwd.copy(p.u).multiplyScalar(-sa * this.sign).addScaledVector(p.v, ca * this.sign);
    if (near && this.jump < 0 && Math.random() < dt * 0.12) {
      this.jump = 0;
      emote(this.dir.clone().multiplyScalar(R), this.dir, pick(['ピチャ', '~♪']), 0.9, '#3d7f8c');
      Sound.sfx('splash', nearVol(p.world));
    }
    let lift = 0;
    if (this.jump >= 0) {
      this.jump += dt / 0.9;
      lift = Math.sin(Math.PI * this.jump) * 1.3;
      if (this.jump >= 1) this.jump = -1;
    }
    this.m.root.position.copy(this.dir).multiplyScalar(R - 0.35 + lift);
    orient(this.m.root, this.dir, this.fwd);
    if (this.jump >= 0) this.m.root.rotateX(-Math.cos(Math.PI * this.jump) * 0.9);
    this.m.tail.rotation.y = Math.sin(t * (near ? 14 : 7) + this.seed) * 0.4;
  }
}

export { Koi };
