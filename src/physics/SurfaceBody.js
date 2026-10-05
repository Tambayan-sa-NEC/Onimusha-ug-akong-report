/**
 * Position and heading on the sphere, with jump physics. The base of every moving thing.
 */
import * as THREE from 'three';
import { CFG, R } from '../config/settings.js';
import { orient } from '../render/materials.js';
import { clamp } from '../utils/math.js';
import { randTangent, signedAngle, tangentToward } from '../utils/sphere.js';
import { heightAt } from '../world/terrain.js';

const V3 = THREE.Vector3;

const _step = new V3();
class SurfaceBody {
  constructor(obj, dir, fwd) {
    this.obj = obj;
    this.dir = dir.clone().normalize();   // "up" at this spot
    this.fwd = fwd ? fwd.clone() : randTangent(this.dir);
    this.fixFwd();
    this.lift = 0; this.vy = 0; this.grounded = true;
  }
  /** Move `dist` along a tangent. canEnter(newDir) may veto. */
  step(tangent, dist, canEnter) {
    const nd = _step.copy(this.dir).addScaledVector(tangent, dist / R).normalize();
    if (canEnter && !canEnter(nd)) return false;
    this.dir.copy(nd);
    this.fixFwd();
    return true;
  }
  fixFwd() { this.fwd.addScaledVector(this.dir, -this.fwd.dot(this.dir)).normalize(); }   // parallel transport
  turn(a) { this.fwd.applyAxisAngle(this.dir, a); }
  turnToward(target, maxA) { const a = signedAngle(this.fwd, target, this.dir); this.turn(clamp(a, -maxA, maxA)); return a; }
  toward(pos, out) { return tangentToward(this.obj.position, pos, this.dir, out); }
  jump(v) { if (this.grounded) { this.vy = v; this.grounded = false; } }
  physics(dt, g = CFG.gravity) {
    if (this.grounded) return;
    this.vy -= g * dt; this.lift += this.vy * dt;
    if (this.lift <= 0) { this.lift = 0; this.vy = 0; this.grounded = true; }
  }
  sync() {
    this.obj.position.copy(this.dir).multiplyScalar(heightAt(this.dir) + this.lift);
    orient(this.obj, this.dir, this.fwd);
  }
  dist(pos) { return this.obj.position.distanceTo(pos); }
}

export { SurfaceBody };
