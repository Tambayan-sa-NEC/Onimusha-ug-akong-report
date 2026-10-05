/**
 * Chests: small boxes left about the planet, each holding one keepsake.
 *
 * A chest is a fixture rather than an entity — it answers E and ticks, exactly as the
 * sealed gate does, and lives in the same `npcs` list so the interaction system finds
 * it without needing to know what it is.
 */
import * as THREE from 'three';
import { ITEMS, OUTDOOR_ITEMS } from '../data/itemDefs.js';
import { isOpened, markOpened, takeItem } from '../core/keepsakes.js';
import { worldRoot } from '../core/Stage.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { emote } from '../render/effects/emotes.js';
import { burst } from '../render/effects/sparks.js';
import { GEO, M, part } from '../render/materials.js';
import { Sound } from '../systems/audio.js';
import { openDialog } from '../ui/dialog.js';
import { R } from '../config/settings.js';
import { damp } from '../utils/math.js';
import { mulberry32 } from '../utils/random.js';
import { randTangent, randomDir } from '../utils/sphere.js';
import { isFree, occupy } from './colliders.js';
import { heightAt } from './terrain.js';

const chests = [];

/** A small banded box. The lid is its own group so it can swing open. */
function makeChest() {
  const root = new THREE.Group();
  const body = part(GEO.box, '#6b4a33', [0, 0.28, 0], [0.9, 0.56, 0.62]);
  root.add(body);
  for (const x of [-0.3, 0.3]) {                               // iron bands
    root.add(part(GEO.box, '#4a4440', [x, 0.28, 0], [0.1, 0.58, 0.64]));
  }
  root.add(part(GEO.box, '#c9a227', [0, 0.26, 0.32], [0.16, 0.18, 0.06]));   // the clasp

  const lid = new THREE.Group();
  lid.position.set(0, 0.56, -0.31);                            // hinge along the back edge
  lid.add(part(GEO.box, '#7a5639', [0, 0.06, 0.31], [0.9, 0.12, 0.62]));
  for (const x of [-0.3, 0.3]) lid.add(part(GEO.box, '#4a4440', [x, 0.07, 0.31], [0.1, 0.14, 0.64]));
  root.add(lid);
  return { root, lid };
}

/**
 * One chest. `id` is stable across visits — the world is generated from a seed, so
 * chest 3 is always chest 3 — which is what lets "already opened" survive a reload.
 */
function makeChestFixture(id, itemId, dir, fwd, parent = worldRoot) {
  const m = makeChest();
  const fixture = {
    id,
    itemId,
    isChest: true,
    def: { name: 'Chest', seal: '箱' },
    m,
    open: isOpened(id),
    lidT: isOpened(id) ? 1 : 0,
    b: new SurfaceBody(m.root, dir, fwd),
    prompt() {
      return this.open
        ? '<kbd>E</kbd> An empty chest'
        : '<kbd>E</kbd> Open the chest';
    },
    interact() {
      if (this.open) {
        openDialog(this, 'Empty, and still smelling faintly of cedar.');
        Sound.sfx('talk');
        return;
      }
      this.open = true;
      markOpened(this.id);
      const def = ITEMS[this.itemId];
      const fresh = takeItem(this.itemId);
      const p = this.b.obj.position;
      burst(p, this.b.dir, 18, ['#f1cf6a', '#ffffff', '#c9a227'], 5, 0.6);
      emote(p, this.b.dir, def ? def.seal : '箱', 1.9, '#c9a227');
      Sound.sfx(fresh ? 'win' : 'good');
      openDialog(this, def
        ? `${def.name}.\n${def.line}`
        : 'Empty, and still smelling faintly of cedar.');
      onChestOpened(this);
    },
    update(dt) {
      // The lid swings up once, and stays up.
      const want = this.open ? 1 : 0;
      if (this.lidT !== want) this.lidT += (want - this.lidT) * damp(6, dt);
      m.lid.rotation.x = -this.lidT * 1.9;
    },
  };
  parent.add(m.root);
  fixture.b.sync();
  fixture.update(1);          // snap an already-open lid into place
  return fixture;
}

/** Told when a chest is opened, so progress can be written down. Set at boot. */
let onChestOpened = () => {};
const setChestListener = fn => { onChestOpened = fn; };

/** Open ground for a chest, drawn from `rng` rather than the world's stream. */
function chestSpot(rng, clear) {
  for (let i = 0; i < 300; i++) {
    const d = randomDir(rng);
    if (heightAt(d) < R + 0.6 || !isFree(d, clear)) continue;
    return d;
  }
  return null;
}

/**
 * Scatter the chests, one per keepsake.
 *
 * Like the arenas, this builds from its own `mulberry32` and never touches the world's
 * seeded stream. Drawing from the shared stream here would shift every roll that comes
 * after it — the petals, and every critter made once play begins — for no reason beyond
 * where a box happened to land.
 */
function createChests(into) {
  chests.length = 0;
  const rng = mulberry32(0x0C4E);
  OUTDOOR_ITEMS.forEach((item, i) => {
    // Wide clearance: a chest should be found in quiet ground, not underfoot in the
    // middle of a fight. Anything closer crowds the yokai that are already placed.
    const dir = chestSpot(rng, 4.5);
    if (!dir) return;
    // Reserved ground but no solid collider, which is how `world/scenery.js` treats
    // every prop this small — a chest you cannot walk past would snag the critters.
    occupy(dir, 2.2);
    const c = makeChestFixture(`chest${i}`, item.id, dir, randTangent(dir, rng));
    chests.push(c);
    into.push(c);
  });
}

/** Put every lid back down, for a fresh run. */
function resetChests() {
  for (const c of chests) { c.open = isOpened(c.id); c.lidT = c.open ? 1 : 0; c.update(1); }
}

export { chests, createChests, makeChest, makeChestFixture, resetChests, setChestListener };
