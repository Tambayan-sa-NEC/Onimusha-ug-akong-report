/**
 * The player character: model, companion, and the per-frame movement update.
 */
import * as THREE from 'three';
import { inputLocked } from '../challenges/system.js';
import { inBattle } from '../combat/battle.js';
import { equipWeapon, guardPose, roll, sw } from '../combat/katana.js';
import { clearKunai, dash, kn } from '../combat/kunai.js';
import { CHARACTERS } from '../config/characters.js';
import { CFG } from '../config/settings.js';
import { session } from '../core/Session.js';
import { scene } from '../core/Stage.js';
import { Wolf } from './Wolf.js';
import { Quadruped } from './Quadruped.js';
import { adopt, release } from './pets.js';
import { COMBAT_ACTIONS, applyAction, makeHumanoid, poseHumanoid, startAction } from './models/humanoid.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { moveWithSlide } from '../physics/movement.js';
import { feedback } from '../render/effects/impact.js';
import { burst } from '../render/effects/sparks.js';
import { orient } from '../render/materials.js';
import { Sound } from '../systems/audio.js';
import { cam } from '../systems/camera.js';
import { acting, takeJump } from '../systems/input.js';
import { $ } from '../utils/dom.js';
import { clamp, damp } from '../utils/math.js';
import { localPoint } from '../utils/sphere.js';
import { resolveCollisions, spotNear } from '../world/colliders.js';
import { critters } from '../world/entities.js';
import { SPAWN, SPAWN_FWD } from '../world/layout.js';
import { heightAt, onLand } from '../world/terrain.js';

const V3 = THREE.Vector3;

const player = {
  char: CHARACTERS.samurai,
  h: makeHumanoid(CHARACTERS.samurai.look),
  vel: new V3(), phase: 0, amt: 0, sprinting: false, inv: 0,
};
player.body = new SurfaceBody(player.h.root, SPAWN, SPAWN_FWD);
scene.add(player.h.root);

let wolf = null;
/** The rōnin's companion. Lives in `critters`, so it is never a collider, a sword
    target or a challenge host — it cannot touch his combat or difficulty. */
/**
 * Put the character's companion beside them. The rōnin's wolf is his own class; the
 * kunoichi is joined by a cat that is otherwise an ordinary critter, so either can be
 * swapped for anything else you talk round later.
 */
function setStarterPet(c) {
  release();
  if (c.pet === 'wolf') { adopt(wolf); return; }
  if (c.pet !== 'cat') return;
  const d = spotNear([localPoint(SPAWN, SPAWN_FWD, -1.7, 1.5)], 0.4) || SPAWN.clone();
  const cat = new Quadruped('cat', { color: '#2f2c33', belly: '#d9d4cc', ear: '#b36a8a' }, d);
  cat.id = 'pet-cat';
  critters.push(cat);
  adopt(cat);
  cat.state = 'follow'; cat.timer = 1e9; cat.cd = 1e9;
}
function setWolf(on) {
  if (wolf) {
    scene.remove(wolf.m.root);
    const i = critters.indexOf(wolf);
    if (i >= 0) critters.splice(i, 1);
    wolf = null;
  }
  if (!on) return;
  wolf = new Wolf(spotNear([localPoint(SPAWN, SPAWN_FWD, -1.7, 1.5)], 0.4) || SPAWN.clone());
  critters.push(wolf);
}
/** Put a character on the planet at the spawn point, with nothing left over from the last one. */
function setCharacter(id) {
  const c = CHARACTERS[id];
  scene.remove(player.h.root);
  player.char = c;
  player.h = makeHumanoid(c.look);
  scene.add(player.h.root);
  player.body = new SurfaceBody(player.h.root, SPAWN, SPAWN_FWD);
  player.vel.set(0, 0, 0);
  player.phase = 0; player.amt = 0; player.sprinting = false; player.inv = 0;
  cam.fwd.copy(SPAWN_FWD);
  equipWeapon();
  player.body.sync();
  // Drop every scrap of the previous character's combat state.
  sw.cd = 0; sw.sinceLast = 9; sw.step = 0; sw.buffered = false; sw.pending = null;
  if (sw.arc) { sw.arc.visible = false; sw.arc = null; }
  kn.cd = 0; kn.pending = 0;
  dash.cd = 0; dash.t = 0;
  roll.cd = 0; roll.t = 0;
  feedback.hurtGlow = 0;
  clearKunai();
  setWolf(c.wolf);
  setStarterPet(c);
  $('hintAtk').innerHTML = c.hint;
}
const shadowGeo = new THREE.CircleGeometry(0.45, 10).rotateX(-Math.PI / 2);
const blob = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false }));
scene.add(blob);

const _want = new V3(), _right = new V3(), _mv = new V3(), _prev = new V3();
function updatePlayer(dt, t) {
  const b = player.body, up = b.dir, h = player.h;
  let ix = 0, iz = 0;
  if (session.started && !inputLocked()) {
    if (acting('forward')) iz += 1;
    if (acting('back')) iz -= 1;
    if (acting('right')) ix += 1;
    if (acting('left')) ix -= 1;
  }
  // Camera-relative input on the tangent plane.
  cam.fwd.addScaledVector(up, -cam.fwd.dot(up)).normalize();
  _right.crossVectors(cam.fwd, up);
  _want.set(0, 0, 0).addScaledVector(cam.fwd, iz).addScaledVector(_right, ix);
  if (_want.lengthSq() > 0) _want.normalize();
  player.sprinting = acting('sprint') && _want.lengthSq() > 0;
  _want.multiplyScalar((player.sprinting ? CFG.sprint : CFG.walk) * player.char.speed);

  player.vel.addScaledVector(up, -player.vel.dot(up));             // keep velocity tangent
  player.vel.lerp(_want, damp(b.grounded ? CFG.accel : 3, dt));
  const spd = player.vel.length();
  if (spd > 0.05) {
    _mv.copy(player.vel).divideScalar(spd);
    moveWithSlide(b, _mv, spd * dt);
    _prev.copy(b.dir);
    resolveCollisions(b.dir, 0.35);
    if (!onLand(b.dir)) b.dir.copy(_prev);                         // never get pushed into a pond
    b.fixFwd();
    if (spd > 0.4) b.turnToward(_mv.addScaledVector(b.dir, -_mv.dot(b.dir)).normalize(), CFG.turnRate * dt);
    if (spd > 0.6 && h.action && !COMBAT_ACTIONS.has(h.action.type)) h.action = null;   // walking cancels gestures
  }
  player.inv = Math.max(0, player.inv - dt);
  dash.cd = Math.max(0, dash.cd - dt);
  if (dash.t > 0) {                                                // shadow dash: a short, fast slide
    dash.t -= dt;
    moveWithSlide(b, b.fwd, CFG.sprint * 2.1 * dt);
    resolveCollisions(b.dir, 0.35);
    if (Math.random() < dt * 40) burst(b.obj.position, up, 1, ['#3b3552', '#8a5f9a'], 1.5, 0.2);
  }
  roll.cd = Math.max(0, roll.cd - dt);
  if (roll.t > 0) {                                               // dodge roll: a shorter, committed tumble
    roll.t -= dt;
    moveWithSlide(b, b.fwd, CFG.sprint * 1.5 * dt);
    resolveCollisions(b.dir, 0.35);
  }
  if (takeJump()) {
    if (b.grounded) {
      b.jump(CFG.jump); Sound.sfx('jump');
      if (inBattle() && !h.action) startAction(h, 'spin');   // dodge with a spinning leap
    }
  }
  b.physics(dt);
  b.sync();

  // Animation
  const target = b.grounded ? clamp(spd / (CFG.walk * player.char.speed), 0, 1.35) : 0.35;
  player.amt += (target - player.amt) * damp(10, dt);
  player.phase += dt * (2 + spd * 1.9);
  poseHumanoid(h, player.phase, player.amt, t);
  h.upper.rotation.x = (spd / CFG.sprint) * 0.18;                  // lean into a sprint
  if (!b.grounded) { h.legs[0].rotation.x = -0.6; h.legs[1].rotation.x = 0.25; }
  if (!h.action && inBattle()) guardPose(h, t);
  applyAction(h, dt);

  // Blob shadow
  blob.position.copy(b.dir).multiplyScalar(heightAt(b.dir) + 0.05);
  orient(blob, b.dir, b.fwd);
  blob.scale.setScalar(clamp(1 - b.lift * 0.2, 0.4, 1));
}

export { blob, player, setCharacter, setWolf, shadowGeo, updatePlayer, wolf };
