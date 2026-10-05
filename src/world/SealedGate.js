/**
 * The gate that opens at five seals and calls out the two great yokai.
 */
import * as THREE from 'three';
import { buildSeals } from '../challenges/seals.js';
import { SEALS_FOR_GATE, bossWon, ch, gateOpen, hosts, startChallenge, won } from '../challenges/system.js';
import { BOSS, bossHooks } from '../combat/bossBattle.js';
import { clearFx } from '../combat/fx.js';
import { CFG } from '../config/settings.js';
import { scene, worldRoot } from '../core/Stage.js';
import { BOSS_ORDER } from '../data/bossDefs.js';
import { player } from '../entities/Player.js';
import { Orochi } from '../entities/bosses/Orochi.js';
import { Otengu } from '../entities/bosses/Otengu.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { emote } from '../render/effects/emotes.js';
import { impact, shockwave } from '../render/effects/impact.js';
import { beacon, showBeacon } from '../render/effects/rings.js';
import { burst } from '../render/effects/sparks.js';
import { GEO, M, part } from '../render/materials.js';
import { Sound } from '../systems/audio.js';
import { openDialog } from '../ui/dialog.js';
import { randTangent, tangentToward } from '../utils/sphere.js';
import { arena } from './Arena.js';
import { ARENAS } from './arenas/index.js';
import { colliders, findSpot, isFree, occupy } from './colliders.js';
import { bosses } from './entities.js';
import { HILLS, SPAWN } from './layout.js';
import { makeLantern, makeTorii } from './props.js';
import { onLand } from './terrain.js';

const V3 = THREE.Vector3;

/* ---------- The sealed gate ----------
   A dark torii hung with ofuda. Five seals burn the papers away; after that it
   calls out one great yokai at a time. */
let GATE_DIR, GATE_FWD, gate;

bossHooks.onEnd = (host, felled) => {
  gate.dismiss(host, felled);
  arena.exit();
};

/** Raise the gate on the far hill. Fourth consumer of the seeded stream. */
function createGate() {
  GATE_DIR = (() => {   // the far hill if it is clear, otherwise any open ground
    const h = HILLS[2] && HILLS[2].c;
    return ((h && onLand(h) && isFree(h, 4.5) ? h : findSpot(5)) || SPAWN).clone().normalize();
  })();
  GATE_FWD = randTangent(GATE_DIR);
  gate = gateFixture.init();
}
function makeSealedGate() {
  const root = new THREE.Group();
  const arch = makeTorii(4.2);
  arch.traverse(m => { if (m.isMesh) m.material = M('#4b3b39'); });   // weathered, colourless wood
  root.add(arch);
  const ofuda = [];
  for (let i = 0; i < 5; i++) {   // paper talismans strung across the opening
    const o = part(GEO.box, '#efe6cf', [(i - 2) * 0.62, 2.95, 0.06], [0.26, 0.76, 0.02]);
    o.add(part(GEO.box, '#8a2a24', [0, 0.02, 0.6], [0.36, 0.62, 0.02]));   // inked sutra
    root.add(o); ofuda.push(o);
  }
  const flames = [];
  for (const s of [-1, 1]) {
    const l = makeLantern();
    l.position.set(2.7 * s, 0, 1.0);
    l.scale.setScalar(1.2);
    root.add(l);
    flames.push(l.children[3]);   // the paper box that glows once it is lit
  }
  for (const f of flames) f.material = M('#6a6258');   // cold until the seals are won
  return { root, arch, ofuda, flames };
}
const gateFixture = {
  def: { name: 'The Sealed Gate', seal: '封' },
  isGate: true, lit: false, beaconT: 0, summoned: null,
  init() {
    this.m = makeSealedGate();
    this.b = new SurfaceBody(this.m.root, GATE_DIR, GATE_FWD);
    worldRoot.add(this.m.root);
    this.b.sync();
    occupy(GATE_DIR, 5, 1.4);
    return this;
  },
  nextBoss() { return BOSS_ORDER.find(b => !bossWon.has(b.id)); },
  prompt() {
    if (!gateOpen()) {
      const left = SEALS_FOR_GATE - won.size;
      return '<kbd>E</kbd> The gate is sealed — ' + left + ' more seal' + (left === 1 ? '' : 's');
    }
    const b = this.nextBoss();
    return b ? '<kbd>E</kbd> Call out ' + b.name : '<kbd>E</kbd> The gate stands quiet';
  },
  interact() {
    if (!gateOpen()) {
      openDialog(this, 'Five seals open this gate. You carry ' + won.size + '.\n'
        + "Win a yokai's game, or win its respect with your blade — either marks your book.");
      Sound.sfx('bad');
      return;
    }
    const def = this.nextBoss();
    if (!def) { openDialog(this, 'Both great yokai have bowed to you. The mountain is quiet now.'); Sound.sfx('good'); return; }
    this.summon(def);
  },
  /** Call a boss into its own sealed arena, and open the fight at once. */
  summon(def) {
    const a = ARENAS[def.arena];
    arena.enter(def.arena, GATE_DIR);

    // The boss stands at the middle of the arena, facing the way in.
    const dir = a.centre.clone();
    const out = new V3();
    const fwd = tangentToward(dir, a.entry, dir, out) ? out : randTangent(dir);
    const host = def.id === 'otengu' ? new Otengu(dir, fwd) : new Orochi(dir, fwd);
    host.chCd = 1e9;                       // the gate owns it; it is never a mini-game host
    this.summoned = host;
    bosses.push(host);
    hosts.push(host);
    shockwave(dir, 7);
    burst(host.b.obj.position, host.b.dir, 36, ['#2a2626', '#8a2a24', '#f1cf6a'], 7, 0.6);
    emote(host.b.obj.position, host.b.dir, '！！', def.emoteH);
    Sound.sfx('boom');
    impact(0.12, 0.5);
    startChallenge(host, BOSS);
  },
  /** Win or lose, the fight ends with the boss leaving the planet so it can be called again. */
  dismiss(host, felled) {
    const b = host.b;
    burst(b.obj.position, b.dir, 30, felled ? ['#f1cf6a', '#ffffff'] : ['#2a2626', '#6a5a48'], 6, 0.5);
    Sound.sfx('poof');
    scene.remove(b.obj);
    for (const list of [hosts, bosses]) { const i = list.indexOf(host); if (i >= 0) list.splice(i, 1); }
    if (host.col) { const i = colliders.indexOf(host.col); if (i >= 0) colliders.splice(i, 1); }
    clearFx(host);
    this.summoned = null;
  },
  /** Five seals: the papers curl into ash and the lanterns take light. */
  ignite() {
    this.lit = true;
    for (const o of this.m.ofuda) {
      burst(o.getWorldPosition(new V3()), GATE_DIR, 10, ['#ffd27a', '#e0503a', '#5a4a3a'], 4, 0.5);
      o.visible = false;
    }
    for (const f of this.m.flames) f.material = M('#ffe2a6', '#b77a28');
    this.m.arch.traverse(m => { if (m.isMesh) m.material = M('#8a2a24'); });   // the wood takes colour again
    emote(this.b.obj.position, GATE_DIR, '開!', 5.6, '#c8423a');
    Sound.sfx('win');
    this.beaconT = 14;
    if (this.b.dist(player.body.obj.position) < CFG.talkRange + 5) {
      openDialog(this, 'The ofuda curl into ash. Something very old stirs beyond the gate.');
    }
    buildSeals();
  },
  update(dt, t) {
    if (!this.lit && gateOpen()) this.ignite();
    if (!this.lit) {
      for (let i = 0; i < this.m.ofuda.length; i++) this.m.ofuda[i].rotation.x = Math.sin(t * 1.8 + i * 0.7) * 0.22;
    } else if (this.beaconT > 0 && !ch.active) {
      this.beaconT -= dt;
      showBeacon(GATE_DIR);
      if (this.beaconT <= 0) beacon.visible = false;
    }
  },
};

export { GATE_DIR, GATE_FWD, createGate, gate, gateFixture, makeSealedGate };
