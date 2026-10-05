# Boss Arenas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Summoning a boss pulls the player out of the world into a sealed arena that belongs to that yokai, and returns them to the gate when the fight ends.

**Architecture:** Two scene groups (`worldRoot`, `arenaRoot`) let the planet be hidden wholesale. A single override hook on `heightAt()` — already the one source of truth for ground height — swaps the ground under the player, so every downstream system (physics, camera, collisions, shadows) follows without modification. Arenas are data modules built lazily and cached.

**Tech Stack:** Vanilla ES modules, three.js 0.128 (import map in the browser, `node_modules` under Node), Node 24 test harness using `vm.SourceTextModule`.

**Spec:** `docs/superpowers/specs/2026-10-02-boss-arenas-design.md`

**Status:** All six tasks implemented. `npm test` reports **96 passed, 0 failed** (78 pre-existing
plus 18 new arena checks). The only outstanding item is the **Manual verification** checklist at the
bottom — seven by-eye checks the test harness cannot make, because it stubs the renderer.

## Global Constraints

- **Arenas must draw nothing from the seeded world stream.** Never call `rand`, `rr` or `pick` from `utils/random.js` in arena code. Use a private `mulberry32(seed)` instance instead. `tests/world.test.js` fails if this is violated.
- **Arena centres and entry points are fixed constants.** No `findSpot`, no `scatterDirs`, no `spotAround`.
- **Arenas build lazily on first entry and are cached.** Construction must never run during `Game.startGame()`.
- **Arena radii are exact:** peak `12`, marsh `13` world units.
- **No new dependencies.** three.js 0.128 only; no build step.
- **All 78 existing tests stay green** after every task.
- **Both bosses stay tuned exactly as they are.** No change to damage, move sets, HP, speed or windups.
- **This project is not a git repository.** Where a task would normally say *commit*, instead run `npm test` and confirm every suite is green. That is the task's gate.
- Test command is `npm test`; a single suite is `node --experimental-vm-modules tests/<name>.test.js`.
- **Imports and the trailing `export { ... }` block are derived from what each module references**, following the convention the whole `src/` tree already uses. After adding or moving code, add the import lines the new references need and extend the export block; keep one declaration style (plain `const`/`function`, exported in the block at the end).

## Review Focus

Five things the spec implies that are easy to leave untested, most likely to bite first:

1. **Losing a boss fight must exit the arena.** The win path gets exercised naturally; the loss path is the one that strands a player in a sealed space forever. Covered in Task 5.
2. **Entering the same arena twice must not duplicate geometry.** The cache is the only thing preventing a second floor mesh stacking on the first. Covered in Task 4.
3. **Sky and fog must restore exactly, across repeated entries.** Saving the "previous" sky while an arena is already active would bake the arena sky in permanently. Covered in Task 4.
4. **Effects spawned during the fight must not survive back into the world.** Emotes and kunai live on `scene` in world coordinates and would hang in mid-air at the gate. Covered in Task 4.
5. **`onLand` must be false outside the arena radius for the boss too, not just the player.** The boss's charge uses `b.step(..., onLand)`; if the arena floor extends further than the visual, a boss can charge out of sight. Covered in Task 6.

---

### Task 1: Scene layers

**Files:**
- Modify: `src/core/Stage.js`
- Modify (mechanical, `scene.add` → `worldRoot.add`): `src/world/terrain.js`, `src/world/scenery.js`, `src/world/props.js`, `src/world/SealedGate.js`, `src/render/materials.js`, `src/entities/Bird.js`, `src/entities/Koi.js`, `src/entities/NPC.js`, `src/entities/Quadruped.js`, `src/entities/yokai/Chochin.js`, `src/entities/yokai/KasaObake.js`, `src/entities/yokai/Onibi.js`
- Test: `tests/arena.test.js` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `worldRoot: THREE.Group`, `arenaRoot: THREE.Group` exported from `src/core/Stage.js`. `arenaRoot.visible` starts `false`.

Do **not** move these to `worldRoot` — they must stay direct children of `scene` because they exist in both places: `src/entities/Player.js` (player model, blob shadow, wolf), `src/entities/bosses/Otengu.js`, `src/entities/bosses/Orochi.js`, `src/render/effects/emotes.js`, `src/render/effects/sparks.js`, `src/render/effects/petals.js`, `src/render/effects/rings.js`, `src/combat/katana.js`, `src/combat/kunai.js`, `src/challenges/games/gather.js`.

- [x] **Step 1: Write the failing test**

Create `tests/arena.test.js`:

```js
/* Behaviour tests for the sealed boss arenas. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

/** Is `obj` underneath `root` anywhere in the scene graph? */
function under(root, obj) {
  for (let n = obj; n; n = n.parent) if (n === root) return true;
  return false;
}

await test('the planet lives under worldRoot, the player does not', async () => {
  const { T } = await boot();
  assert(T.worldRoot, 'Stage exports worldRoot');
  assert(T.arenaRoot, 'Stage exports arenaRoot');
  eq(T.arenaRoot.visible, false, 'the arena layer starts hidden');
  assert(under(T.worldRoot, T.water), 'the water sphere is in the world layer');
  assert(!under(T.worldRoot, T.player.h.root), 'the player is not in the world layer');
});

await test('hiding worldRoot hides the planet but not the player', async () => {
  const { T } = await boot();
  T.worldRoot.visible = false;
  let hiddenWorld = 0, visiblePlayer = 0;
  T.scene.traverse(o => {
    if (!o.isMesh) return;
    let vis = true;
    for (let n = o; n; n = n.parent) if (n.visible === false) { vis = false; break; }
    if (under(T.worldRoot, o)) { if (!vis) hiddenWorld++; }
    else if (under(T.player.h.root, o) && vis) visiblePlayer++;
  });
  assert(hiddenWorld > 100, `the whole world should hide, only ${hiddenWorld} meshes did`);
  assert(visiblePlayer > 0, 'the player should stay visible');
});

const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [x] **Step 2: Run the test and watch it fail**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: FAIL — "Stage exports worldRoot".

- [x] **Step 3: Add the two layers to Stage.js**

In `src/core/Stage.js`, after `const camera = ...`:

```js
// Two layers under the scene, so an arena can hide the planet wholesale.
// The player, the active boss and all transient effects stay directly on the
// scene, because they are the things that exist in both places.
const worldRoot = new THREE.Group();
const arenaRoot = new THREE.Group();
arenaRoot.visible = false;
scene.add(worldRoot, arenaRoot);
```

- [x] **Step 4: Move the world's meshes onto worldRoot**

In each of the twelve modules listed under **Files**, change `scene.add(x)` to `worldRoot.add(x)` and `scene.remove(x)` to `worldRoot.remove(x)`. Then re-derive the imports so each module imports `worldRoot` instead of `scene` where it no longer uses `scene`.

The exact sites, for reference:

| File | Line content to change |
|---|---|
| `world/terrain.js` | `scene.add(new THREE.Mesh(geo, ...))` in `buildPlanet`, and `scene.add(water)` in `createPlanet` |
| `world/scenery.js` | `scene.add(pad)`, `scene.add(cloudRoot)` |
| `world/props.js` | `scene.add(im)` in `scatterInstanced` |
| `world/SealedGate.js` | `scene.add(this.m.root)` in `init` only — leave `scene.remove(b.obj)` in `dismiss` alone, bosses are on the scene |
| `render/materials.js` | `scene.add(obj)` in `placeProp` |
| `entities/Bird.js`, `Koi.js`, `NPC.js`, `Quadruped.js`, `yokai/Chochin.js`, `yokai/KasaObake.js`, `yokai/Onibi.js` | the single `scene.add(...)` in each constructor |

- [x] **Step 5: Run the test and watch it pass**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: PASS, 2 passed.

- [x] **Step 6: Gate — the whole suite stays green**

Run: `npm test`
Expected: `TOTAL: 80 passed, 0 failed`. The world fingerprint must still pass — re-parenting changes no geometry, so it will.

---

### Task 2: Ground override seam

**Files:**
- Modify: `src/world/terrain.js`
- Test: `tests/arena.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `setGroundOverride(fn | null)` exported from `src/world/terrain.js`. While `fn` is installed, `heightAt(dir)` returns `fn(dir)`. `buildPlanet()` always uses planet ground regardless of the override.

- [x] **Step 1: Write the failing test**

Append to `tests/arena.test.js`, before the summary block:

```js
await test('an installed ground override replaces heightAt', async () => {
  const { T } = await boot();
  const spot = T.SPAWN.clone();
  const planet = T.heightAt(spot);
  assert(planet > T.R, 'the planet has ground at spawn');

  T.setGroundOverride(() => 999);
  eq(T.heightAt(spot), 999, 'the override answers instead');

  T.setGroundOverride(null);
  eq(T.heightAt(spot), planet, 'clearing it restores the planet exactly');
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: FAIL — `T.setGroundOverride is not a function`.

- [x] **Step 3: Add the seam**

In `src/world/terrain.js`, rename the existing `heightAt` to `planetHeightAt` and add the wrapper. The body is unchanged:

```js
/** Terrain radius for a unit direction on the planet itself. */
function planetHeightAt(d) {
  let h = R + 0.85 + noise(d) * 0.55;
  for (const hill of HILLS) {
    const a = angleBetween(d, hill.c);
    if (a < hill.r) h += hill.a * (0.5 + 0.5 * Math.cos(Math.PI * a / hill.r));
  }
  for (const g of GARDENS) {               // gardens are flattened sand
    const a = angleBetween(d, g);
    if (a < GARDEN_R * 1.4) h += (R + 0.75 - h) * smoothstep(GARDEN_R * 1.4, GARDEN_R * 0.9, a);
  }
  for (const p of PONDS) {                 // ponds dip below the water sphere
    const a = angleBetween(d, p.c);
    if (a < p.r) h += (R - 1.3 - h) * smoothstep(p.r, p.r * 0.55, a);
  }
  return h;
}

let groundOverride = null;
/** Replace the ground while an arena is active. Pass null to restore the planet. */
function setGroundOverride(fn) { groundOverride = fn; }

/**
 * Ground height for a unit direction. The single source of truth: physics, the
 * camera, collisions and shadows all come through here, which is why swapping it
 * is enough to put the player somewhere else entirely.
 */
function heightAt(d) {
  return groundOverride ? groundOverride(d) : planetHeightAt(d);
}
```

In `buildPlanet()`, change the one call `v.multiplyScalar(heightAt(v))` to `v.multiplyScalar(planetHeightAt(v))`, so the planet mesh is never built from an arena's ground.

- [x] **Step 4: Run the test and watch it pass**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: PASS, 3 passed.

- [x] **Step 5: Gate**

Run: `npm test`
Expected: `TOTAL: 81 passed, 0 failed`.

---

### Task 3: The two arena definitions

**Files:**
- Create: `src/world/arenas/peak.js`
- Create: `src/world/arenas/marsh.js`
- Create: `src/world/arenas/index.js`
- Test: `tests/arena.test.js`

**Interfaces:**
- Consumes: `R`, `WALK_MIN` from `config/settings.js`; `angleBetween` from `utils/math.js`; `tangentBasis` from `utils/sphere.js`; `mulberry32` from `utils/random.js`; builders from `render/materials.js` and `world/props.js`.
- Produces: `ARENAS` — an object keyed by id — exported from `src/world/arenas/index.js`. Each definition is:

```js
{
  id: string,            // 'peak' | 'marsh'
  name: string,          // display name
  centre: THREE.Vector3, // fixed unit vector
  radius: number,        // walkable radius in world units
  entry: THREE.Vector3,  // fixed unit vector where the player appears
  sky: string,           // hex colour
  fogNear: number,
  fogFar: number,
  height(d): number,     // ground height; below WALK_MIN outside `radius`
  build(): THREE.Group,  // called once, lazily, by Arena.js
}
```

- [x] **Step 1: Write the failing test**

Append to `tests/arena.test.js`:

```js
await test('each arena has walkable ground inside and none outside', async () => {
  const { T } = await boot();
  for (const id of ['peak', 'marsh']) {
    const a = T.ARENAS[id];
    assert(a, `${id} exists`);
    eq(a.id, id, 'id matches its key');

    const inside = a.height(a.centre);
    assert(inside > T.WALK_MIN, `${id}: the centre is walkable (got ${inside})`);
    assert(a.height(a.entry) > T.WALK_MIN, `${id}: the entry point is walkable`);
    assert(T.angleBetween(a.entry, a.centre) * T.R < a.radius,
      `${id}: the entry point is inside the radius`);

    // just outside the rim, in several directions
    const u = new T.THREE.Vector3(), v = new T.THREE.Vector3();
    T.tangentBasis(a.centre, u, v);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2;
      const ang = (a.radius + 1) / T.R;
      const d = a.centre.clone().multiplyScalar(Math.cos(ang))
        .addScaledVector(u, Math.cos(th) * Math.sin(ang))
        .addScaledVector(v, Math.sin(th) * Math.sin(ang)).normalize();
      assert(a.height(d) < T.WALK_MIN, `${id}: no ground past the rim at bearing ${i}`);
    }
  }
});

await test('the two arenas are distinguishable', async () => {
  const { T } = await boot();
  const p = T.ARENAS.peak, m = T.ARENAS.marsh;
  eq(p.radius, 12, 'peak radius');
  eq(m.radius, 13, 'marsh radius');
  assert(p.sky !== m.sky, 'different skies');
  assert(T.angleBetween(p.centre, m.centre) > 0.5, 'different places on the sphere');
  assert(p.height(p.centre) !== m.height(m.centre), 'different floor heights');
});

await test('building an arena draws nothing from the world random stream', async () => {
  // Two independent boots are at the same point in the seeded stream. Build the
  // arenas in one of them only; if build() consumed a draw, the next value diverges.
  const a = await boot();
  const b = await boot();
  const g = a.T.ARENAS.peak.build();
  a.T.ARENAS.marsh.build();
  assert(g.isGroup, 'build returns a Group');
  assert(g.children.length > 0, 'and it has contents');
  eq(a.T.rand(), b.T.rand(), 'the world stream is left exactly where it was');
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'peak')`.

- [x] **Step 3: Write `src/world/arenas/peak.js`**

```js
/**
 * 天狗の峰 — the Ōtengu's peak.
 *
 * A bare rock plateau above a sea of cloud. The floor is flat so that what you
 * see and what you stand on agree exactly; the ground simply stops at the rim,
 * which is what seals the arena.
 */
import * as THREE from 'three';
import { R, WALK_MIN } from '../../config/settings.js';
import { GEO, M, group, orient, part } from '../../render/materials.js';
import { angleBetween } from '../../utils/math.js';
import { mulberry32 } from '../../utils/random.js';
import { tangentBasis } from '../../utils/sphere.js';
import { makePine, makeTorii } from '../props.js';
import { buildArenaFloor, buildBarrier } from '../arenaFloor.js';

const V3 = THREE.Vector3;

const id = 'peak';
const name = 'Ōtengu no Mine';
const centre = new V3(0.62, -0.49, 0.61).normalize();
const radius = 12;
const FLOOR = R + 7;                       // the plateau stands well above sea level
const rim = radius / R;                    // angular radius

const u = new V3(), v = new V3();
tangentBasis(centre, u, v);
/** A unit direction `dist` world units from the centre, at `bearing` radians. */
function spot(bearing, dist) {
  const a = dist / R;
  return centre.clone().multiplyScalar(Math.cos(a))
    .addScaledVector(u, Math.cos(bearing) * Math.sin(a))
    .addScaledVector(v, Math.sin(bearing) * Math.sin(a)).normalize();
}

const entry = spot(0, radius * 0.6);
const sky = '#4a4560';
const fogNear = 8;
const fogFar = 46;

/** Flat plateau inside the rim; nothing at all outside it. */
function height(d) {
  return angleBetween(d, centre) > rim ? R - 10 : FLOOR;
}

function build() {
  const g = new THREE.Group();
  const rnd = mulberry32(0x7E26);          // this arena's own stream, never the world's
  const rr = (a, b) => a + (b - a) * rnd();

  g.add(buildArenaFloor({ centre, radius, height }, '#6d6a72', '#56535e'));
  g.add(buildBarrier({ centre, radius, height }, '#9a90c8', 2.4));

  // A weathered torii at the rim, facing the middle.
  const td = spot(Math.PI, radius * 0.92);
  const torii = makeTorii(3.6);
  torii.traverse(m => { if (m.isMesh) m.material = M('#4b3b39'); });
  torii.position.copy(td).multiplyScalar(height(td) - 0.1);
  orient(torii, td, centre.clone().sub(td).normalize());
  g.add(torii);

  // Broken pines and boulders scattered around the plateau.
  for (let i = 0; i < 9; i++) {
    const d = spot(rr(0, 6.283), rr(radius * 0.25, radius * 0.88));
    const pine = makePine();
    pine.traverse(m => { if (m.isMesh) m.material = M('#4a4238'); });
    pine.scale.setScalar(rr(0.6, 1.0));
    pine.position.copy(d).multiplyScalar(height(d) - 0.1);
    orient(pine, d, u);
    g.add(pine);
  }
  for (let i = 0; i < 16; i++) {
    const d = spot(rr(0, 6.283), rr(1.5, radius * 0.95));
    const s = rr(0.3, 0.9);
    const rock = group(part(GEO.dode, '#7d7a82', [0, 0, 0], [s * 1.2, s * 0.8, s]));
    rock.position.copy(d).multiplyScalar(height(d));
    orient(rock, d, u);
    g.add(rock);
  }

  // A sea of cloud below the rim, so the edge reads as a long drop.
  for (let i = 0; i < 30; i++) {
    const d = spot(rr(0, 6.283), rr(radius * 1.1, radius * 2.6));
    const c = group(
      part(GEO.ico, '#cfd4e4', [0, 0, 0], [rr(2, 4), rr(0.5, 0.9), rr(2, 4)]),
      part(GEO.ico, '#e2e5f0', [rr(-1, 1), 0.3, rr(-1, 1)], [rr(1, 2.4), 0.5, rr(1, 2.4)]),
    );
    c.position.copy(d).multiplyScalar(FLOOR - rr(4, 9));
    orient(c, d, u);
    g.add(c);
  }
  return g;
}

export const peak = { id, name, centre, radius, entry, sky, fogNear, fogFar, height, build };
```

- [x] **Step 4: Write `src/world/arenas/marsh.js`**

Identical structure, different constants and dressing:

```js
/**
 * 大蛇の沼 — the Orochi's marsh.
 *
 * A drowned basin under black water, ringed by dead bamboo. Like the peak, the
 * floor is flat and the ground stops at the rim.
 */
import * as THREE from 'three';
import { R } from '../../config/settings.js';
import { GEO, M, group, orient, part } from '../../render/materials.js';
import { angleBetween } from '../../utils/math.js';
import { mulberry32 } from '../../utils/random.js';
import { tangentBasis } from '../../utils/sphere.js';
import { makeBamboo, makeLantern } from '../props.js';
import { buildArenaFloor, buildBarrier } from '../arenaFloor.js';

const V3 = THREE.Vector3;

const id = 'marsh';
const name = 'Orochi no Numa';
const centre = new V3(-0.55, 0.37, -0.75).normalize();
const radius = 13;
const FLOOR = R + 1.2;
const rim = radius / R;

const u = new V3(), v = new V3();
tangentBasis(centre, u, v);
function spot(bearing, dist) {
  const a = dist / R;
  return centre.clone().multiplyScalar(Math.cos(a))
    .addScaledVector(u, Math.cos(bearing) * Math.sin(a))
    .addScaledVector(v, Math.sin(bearing) * Math.sin(a)).normalize();
}

const entry = spot(Math.PI, radius * 0.6);
const sky = '#26332b';
const fogNear = 6;
const fogFar = 34;

function height(d) {
  return angleBetween(d, centre) > rim ? R - 10 : FLOOR;
}

function build() {
  const g = new THREE.Group();
  const rnd = mulberry32(0x0120);
  const rr = (a, b) => a + (b - a) * rnd();

  g.add(buildArenaFloor({ centre, radius, height }, '#3b4238', '#2e3630'));
  g.add(buildBarrier({ centre, radius, height }, '#6f8a74', 2.0));

  // A skin of black water just above the floor.
  const waterDisc = buildArenaFloor({ centre, radius, height: d => height(d) + 0.18 },
    '#161d1a', '#1d2622');
  waterDisc.traverse(m => {
    if (!m.isMesh) return;
    m.material = new THREE.MeshPhongMaterial({
      color: '#131a17', flatShading: true, transparent: true, opacity: 0.82, shininess: 80,
    });
  });
  g.add(waterDisc);

  for (let i = 0; i < 14; i++) {           // dead bamboo
    const d = spot(rr(0, 6.283), rr(radius * 0.3, radius * 0.95));
    const b = makeBamboo();
    b.traverse(m => { if (m.isMesh) m.material = M('#5a5a46'); });
    b.scale.setScalar(rr(0.7, 1.2));
    b.position.copy(d).multiplyScalar(height(d) - 0.1);
    orient(b, d, u);
    g.add(b);
  }
  for (let i = 0; i < 5; i++) {            // half-sunk lanterns
    const d = spot(rr(0, 6.283), rr(2, radius * 0.8));
    const l = makeLantern();
    l.traverse(m => { if (m.isMesh) m.material = M('#5c6158'); });
    l.position.copy(d).multiplyScalar(height(d) - rr(0.4, 0.9));
    orient(l, d, u);
    l.rotateZ(rr(-0.3, 0.3));
    g.add(l);
  }
  for (let i = 0; i < 24; i++) {           // drifting mist
    const d = spot(rr(0, 6.283), rr(1, radius));
    const mist = group(part(GEO.ico, '#8fa89a', [0, 0, 0], [rr(1.5, 3), 0.25, rr(1.5, 3)]));
    mist.traverse(m => {
      if (m.isMesh) m.material = new THREE.MeshBasicMaterial({
        color: '#9fb6a8', transparent: true, opacity: 0.16, depthWrite: false,
      });
    });
    mist.position.copy(d).multiplyScalar(height(d) + rr(0.4, 2.2));
    orient(mist, d, u);
    g.add(mist);
  }
  return g;
}

export const marsh = { id, name, centre, radius, entry, sky, fogNear, fogFar, height, build };
```

- [x] **Step 5: Write `src/world/arenas/index.js`**

```js
/**
 * Every arena, keyed by id. Adding a boss means adding one module and one line.
 */
import { marsh } from './marsh.js';
import { peak } from './peak.js';

export const ARENAS = { peak, marsh };
```

- [x] **Step 6: Write the shared floor and barrier builders**

Create `src/world/arenaFloor.js`:

```js
/**
 * Geometry shared by every arena: the floor, and the shell that marks its edge.
 *
 * The floor is tessellated from the arena's own `height()` function, so what you
 * see and what you stand on cannot disagree.
 */
import * as THREE from 'three';
import { R } from '../config/settings.js';
import { tangentBasis } from '../utils/sphere.js';

const V3 = THREE.Vector3;
const RINGS = 12, SEGMENTS = 48;

/** A unit direction on the cap, at ring `ri` of RINGS and segment `si` of SEGMENTS. */
function capDir(centre, u, v, radius, ri, si, out) {
  const a = (ri / RINGS) * (radius / R);
  const th = (si / SEGMENTS) * Math.PI * 2;
  return out.copy(centre).multiplyScalar(Math.cos(a))
    .addScaledVector(u, Math.cos(th) * Math.sin(a))
    .addScaledVector(v, Math.sin(th) * Math.sin(a)).normalize();
}

/** Tessellate the arena floor, flat-shaded and two-toned so facets read. */
export function buildArenaFloor(def, colorA, colorB) {
  const u = new V3(), v = new V3(), d = new V3();
  tangentBasis(def.centre, u, v);
  const at = (ri, si) => capDir(def.centre, u, v, def.radius, ri, si % SEGMENTS, d)
    .clone().multiplyScalar(def.height(d));

  const pos = [], col = [];
  const a = new THREE.Color(colorA), b = new THREE.Color(colorB);
  const push = (p, c) => { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); };

  for (let ri = 0; ri < RINGS; ri++) {
    for (let si = 0; si < SEGMENTS; si++) {
      const p00 = at(ri, si), p01 = at(ri, si + 1);
      const p10 = at(ri + 1, si), p11 = at(ri + 1, si + 1);
      const c = (ri + si) % 2 ? a : b;
      if (ri > 0) { push(p00, c); push(p10, c); push(p01, c); }
      push(p01, c); push(p10, c); push(p11, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    vertexColors: true, flatShading: true, shininess: 0, side: THREE.DoubleSide,
  }));
}

/** A translucent shell standing on the rim, so the edge is visible before you reach it. */
export function buildBarrier(def, color, tall) {
  const u = new V3(), v = new V3(), d = new V3();
  tangentBasis(def.centre, u, v);
  const pos = [];
  for (let si = 0; si <= SEGMENTS; si++) {
    capDir(def.centre, u, v, def.radius, RINGS, si % SEGMENTS, d);
    const h = def.height(def.centre);                 // the floor height, not the void past it
    pos.push(d.x * h, d.y * h, d.z * h);
    pos.push(d.x * (h + tall), d.y * (h + tall), d.z * (h + tall));
  }
  const idx = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const k = i * 2;
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.17, side: THREE.DoubleSide, depthWrite: false,
  }));
}
```

- [x] **Step 7: Run the test and watch it pass**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: PASS, 6 passed.

- [x] **Step 8: Gate**

Run: `npm test`
Expected: `TOTAL: 84 passed, 0 failed`. In particular `tests/world.test.js` must still pass — that is the proof arenas drew nothing from the world stream.

---

### Task 4: Arena lifecycle

**Files:**
- Create: `src/world/Arena.js`
- Modify: `src/render/effects/emotes.js` (add `clearEmotes`)
- Test: `tests/arena.test.js`

**Interfaces:**
- Consumes: `ARENAS` from `world/arenas/index.js`; `setGroundOverride` from `world/terrain.js`; `worldRoot`, `arenaRoot`, `scene`, `SKY` from `core/Stage.js`; `player` from `entities/Player.js`; `cam`, `updateCamera` from `systems/camera.js`; `clearKunai` from `combat/kunai.js`; `petals` from `render/effects/petals.js`; `GATE_DIR` from `world/SealedGate.js`.
- Produces: `arena` — `{ active, enter(id, home), exit() }` — exported from `src/world/Arena.js`. `home` is the direction to return the player to. `arena.active` is the arena definition while a fight is running, otherwise `null`.
- Produces: `clearEmotes()` exported from `src/render/effects/emotes.js`.

**Note on the import direction:** `Arena.js` imports `GATE_DIR` from `SealedGate.js`, and Task 5 has `SealedGate.js` import `arena` from `Arena.js`. That is a cycle. Avoid it: `Arena.js` must **not** import from `SealedGate.js`. Instead `arena.exit()` returns the player to a remembered direction captured on entry, which the gate supplies. `enter(id, returnTo)` takes the return point as an argument.

- [x] **Step 1: Write the failing test**

Append to `tests/arena.test.js`:

```js
await test('entering an arena hides the world and moves the player', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  T.arena.enter('peak', home);

  assert(T.arena.active, 'an arena is active');
  eq(T.arena.active.id, 'peak', 'the right one');
  eq(T.worldRoot.visible, false, 'the world is hidden');
  eq(T.arenaRoot.visible, true, 'the arena is shown');
  eq(T.petals.visible, false, 'petals are hidden');

  const a = T.ARENAS.peak;
  assert(T.angleBetween(T.player.body.dir, a.centre) * T.R < a.radius,
    'the player is inside the arena');
  assert(T.onLand(T.player.body.dir), 'standing on arena ground');
  eq(T.heightAt(a.centre), a.height(a.centre), 'heightAt now answers from the arena');
});

await test('leaving restores the world exactly and returns the player', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  const sky = T.scene.background.getHex();
  const near = T.scene.fog.near, far = T.scene.fog.far;
  const planetGround = T.heightAt(home);

  T.arena.enter('peak', home);
  assert(T.scene.background.getHex() !== sky, 'the sky changed');
  T.arena.exit();

  eq(T.arena.active, null, 'no arena active');
  eq(T.worldRoot.visible, true, 'the world is back');
  eq(T.arenaRoot.visible, false, 'the arena is hidden');
  eq(T.petals.visible, true, 'petals are back');
  eq(T.scene.background.getHex(), sky, 'the sky is restored');
  eq(T.scene.fog.near, near, 'fog near restored');
  eq(T.scene.fog.far, far, 'fog far restored');
  assert(T.angleBetween(T.player.body.dir, home) * T.R < 0.01, 'the player is back where they were');
  eq(T.heightAt(home), planetGround, 'planet ground answers again');
  assert(T.onLand(home), 'and it is walkable');
});

await test('entering twice does not duplicate the arena geometry', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  T.arena.enter('peak', home);
  const first = T.arenaRoot.children.length;
  T.arena.exit();
  T.arena.enter('peak', home);
  eq(T.arenaRoot.children.length, first, 'the cached arena is reused, not rebuilt');
  T.arena.exit();
});

await test('sky and fog survive repeated entries', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  const sky = T.scene.background.getHex();
  for (let i = 0; i < 3; i++) {
    T.arena.enter(i % 2 ? 'marsh' : 'peak', home);
    T.arena.exit();
  }
  eq(T.scene.background.getHex(), sky, 'the world sky is not drifting');
});

await test('effects in flight do not survive either transition', async () => {
  const { T } = await boot();
  T.start('shinobi');
  T.throwKunai();
  await Promise.resolve();
  const home = T.player.body.dir.clone();
  T.arena.enter('peak', home);
  eq(T.kunai.length, 0, 'kunai cleared on the way in');
  T.emote(T.player.body.obj.position, T.player.body.dir, '!', 1);
  T.arena.exit();
  eq(T.emotes.length, 0, 'emotes cleared on the way out');
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'enter')`.

- [x] **Step 3: Add `clearEmotes` to the emote layer**

In `src/render/effects/emotes.js`, after `updateEmotes`:

```js
/** Drop every floating emote at once. Used when the player is moved elsewhere. */
function clearEmotes() {
  for (const e of emotes) { scene.remove(e.s); e.s.material.dispose(); }
  emotes.length = 0;
}
```

- [x] **Step 4: Write `src/world/Arena.js`**

```js
/**
 * Sealed arenas for boss fights.
 *
 * Entering hides the planet, shows the arena's own geometry, and installs the
 * arena's ground under the player. Because `heightAt()` is the single source of
 * truth for ground height, swapping it is enough to put the player somewhere
 * else entirely — physics, the camera, collisions and shadows all follow.
 *
 * There is exactly one way in and one way out, which is what keeps the state safe.
 */
import * as THREE from 'three';
import { arenaRoot, SKY, scene, worldRoot } from '../core/Stage.js';
import { clearKunai } from '../combat/kunai.js';
import { player } from '../entities/Player.js';
import { clearEmotes } from '../render/effects/emotes.js';
import { petals } from '../render/effects/petals.js';
import { cam, updateCamera } from '../systems/camera.js';
import { randTangent } from '../utils/sphere.js';
import { setGroundOverride } from './terrain.js';
import { ARENAS } from './arenas/index.js';

const built = new Map();        // id -> THREE.Group, built once on first entry
const worldFog = { near: 0, far: 0 };
let returnTo = null;

const arena = {
  active: null,

  /**
   * Pull the player into `id`. `home` is the direction they are standing in, and
   * where `exit()` will put them back.
   */
  enter(id, home) {
    const def = ARENAS[id];
    if (!def || this.active) return;

    if (!built.has(id)) {
      const g = def.build();
      arenaRoot.add(g);
      built.set(id, g);
    }
    for (const [key, g] of built) g.visible = key === id;

    returnTo = home.clone();
    this.active = def;

    // Install the ground before anything moves, so the first sync() lands on it.
    setGroundOverride(def.height);

    worldRoot.visible = false;
    petals.visible = false;
    arenaRoot.visible = true;

    worldFog.near = scene.fog.near;
    worldFog.far = scene.fog.far;
    scene.background = new THREE.Color(def.sky);
    scene.fog.color.set(def.sky);
    scene.fog.near = def.fogNear;
    scene.fog.far = def.fogFar;

    clearEmotes();
    clearKunai();
    place(def.entry, def.centre);
  },

  /** Put everything back and return the player to where they came from. */
  exit() {
    if (!this.active) return;
    this.active = null;
    setGroundOverride(null);

    arenaRoot.visible = false;
    worldRoot.visible = true;
    petals.visible = true;

    scene.background = SKY;
    scene.fog.color.set(SKY);
    scene.fog.near = worldFog.near;
    scene.fog.far = worldFog.far;

    clearEmotes();
    clearKunai();
    place(returnTo, null);
    returnTo = null;
  },
};

/** Stand the player at `dir`, facing `lookAt` if given, and snap the camera. */
function place(dir, lookAt) {
  const b = player.body;
  b.dir.copy(dir);
  b.lift = 0;
  b.vy = 0;
  b.grounded = true;
  b.fwd.copy(lookAt ? lookAt.clone().sub(dir) : randTangent(dir));
  b.fixFwd();
  b.sync();
  player.vel.set(0, 0, 0);
  cam.fwd.copy(b.fwd);
  updateCamera(1, 0);           // a large dt snaps rather than eases
}

export { arena };
```

- [x] **Step 5: Run the test and watch it pass**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: PASS, 11 passed.

- [x] **Step 6: Gate**

Run: `npm test`
Expected: `TOTAL: 89 passed, 0 failed`.

---

### Task 5: Wire the gate, the boss data and the flee rule

**Files:**
- Modify: `src/data/bossDefs.js`
- Modify: `src/world/SealedGate.js:summon` and the `bossHooks.onEnd` registration
- Modify: `src/combat/battle.js:175`
- Test: `tests/arena.test.js`

**Interfaces:**
- Consumes: `arena` from `world/Arena.js`.
- Produces: each entry in `BOSS_DEFS` gains `arena: 'peak' | 'marsh'`.

- [x] **Step 1: Write the failing test**

Append to `tests/arena.test.js`:

```js
/** Five seals, nobody hunting, standing at the gate. */
async function atGateWithSeals() {
  const g = await boot();
  const T = g.T;
  T.start('samurai');
  for (const h of T.hosts) h.chCd = 1e9;
  T.GAME_ORDER.slice(0, 5).forEach(k => T.won.add(k));
  g.run(0.2);
  const pb = T.player.body;
  pb.dir.copy(T.GATE_DIR); pb.fixFwd(); pb.sync();
  return { g, T };
}

await test('summoning a boss puts you in its arena', async () => {
  const { T } = await atGateWithSeals();
  T.gate.interact();
  assert(T.ch.active, 'a fight started');
  eq(T.ch.active.host.def.id, 'otengu', 'the tengu first');
  eq(T.arena.active.id, 'peak', 'and we are on its peak');
  const a = T.ARENAS.peak;
  assert(T.angleBetween(T.player.body.dir, a.centre) * T.R < a.radius, 'player inside');
  assert(T.angleBetween(T.ch.active.host.b.dir, a.centre) * T.R < a.radius, 'boss inside');
});

await test('winning returns you to the gate', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const c = T.ch.active;
  c.hp = 1;
  T.BOSS.hit(c, 9, 0, true);
  g.run(5, 0.05, () => !!T.ch.active);
  eq(T.arena.active, null, 'the arena closed');
  eq(T.worldRoot.visible, true, 'the world is back');
  assert(T.bossWon.has('otengu'), 'the seal was still awarded');
  assert(T.angleBetween(T.player.body.dir, T.GATE_DIR) * T.R < 0.01, 'back at the gate');
});

await test('losing returns you to the gate too', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  T.ch.active.php = 0;
  g.run(5, 0.05, () => !!T.ch.active);
  eq(T.arena.active, null, 'the arena closed on a loss');
  eq(T.worldRoot.visible, true, 'the world is back');
  eq(T.bossWon.size, 0, 'no seal');
  assert(T.angleBetween(T.player.body.dir, T.GATE_DIR) * T.R < 0.01, 'back at the gate');
  eq(T.gate.nextBoss().id, 'otengu', 'and it can be summoned again');
});

await test('the second boss uses the marsh', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const c = T.ch.active;
  c.hp = 1; T.BOSS.hit(c, 9, 0, true);
  g.run(5, 0.05, () => !!T.ch.active);
  T.gate.interact();
  eq(T.ch.active.host.def.id, 'orochi', 'the orochi');
  eq(T.arena.active.id, 'marsh', 'in the marsh');
});

await test('forfeiting with Esc also lets you out', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  assert(T.arena.active, 'in the arena');
  g.press('Escape');                        // challengeKey forfeits a running challenge
  g.run(5, 0.05, () => !!T.ch.active);
  eq(T.arena.active, null, 'a forfeit must not strand you in a sealed space');
  eq(T.worldRoot.visible, true, 'the world is back');
  eq(T.started, true, 'and you are still playing, not dumped to the menu');
});

await test('the flee loss does not fire inside an arena', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const c = T.ch.active;
  // Stand the player at the far rim: more than 20u from the boss at the centre
  // would normally end the fight.
  const a = T.ARENAS.peak;
  const u = new T.THREE.Vector3(), v = new T.THREE.Vector3();
  T.tangentBasis(a.centre, u, v);
  const far = a.centre.clone().multiplyScalar(Math.cos(a.radius / T.R))
    .addScaledVector(u, Math.sin(a.radius / T.R)).normalize();
  T.player.body.dir.copy(far); T.player.body.fixFwd(); T.player.body.sync();
  c.host.b.dir.copy(a.centre); c.host.b.fixFwd(); c.host.b.sync();
  g.run(0.3);
  assert(!c.result || c.result !== 'lose' || c.note !== 'You fled the battle.',
    'the fled-the-battle loss must not fire in a sealed arena');
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: FAIL — "and we are on its peak" (`arena.active` is null).

- [x] **Step 3: Give each boss its arena**

In `src/data/bossDefs.js`, add one property to each entry:

```js
{ id: 'otengu', name: 'Ōtengu, Lord of the Peak', seal: '天', emoteH: 4.4, boss: true, arena: 'peak',
```

```js
{ id: 'orochi', name: 'Yamata-no-Orochi', seal: '蛇', emoteH: 4.8, boss: true, arena: 'marsh',
```

- [x] **Step 4: Enter on summon, exit on end**

In `src/world/SealedGate.js`, replace the body of `summon(def)`:

```js
  /** Call a boss into its own arena, and open the fight at once. */
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
```

and extend the hook registration, which already fires on win, loss and forfeit:

```js
bossHooks.onEnd = (host, felled) => {
  gate.dismiss(host, felled);
  arena.exit();
};
```

- [x] **Step 5: Retire the flee rule inside arenas**

In `src/combat/battle.js`, line 175:

```js
    // A sealed arena has no outside to flee to.
    if (!arena.active && dist > 20) { c.note = 'You fled the battle.'; return 'lose'; }
```

- [x] **Step 6: Run the test and watch it pass**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: PASS, 17 passed.

- [x] **Step 7: Gate**

Run: `npm test`
Expected: `TOTAL: 95 passed, 0 failed`. `tests/boss.test.js` is the one to watch: it drives the gate directly and must still award seals and advance to the second boss.

---

### Task 6: Containment and the edge

**Files:**
- Modify: `src/world/colliders.js`
- Test: `tests/arena.test.js`

**Interfaces:**
- Consumes: `arena` from `world/Arena.js`.
- Produces: no new exports. `resolveCollisions(dir, rad)` additionally keeps `dir` inside the active arena.

- [x] **Step 1: Write the failing test**

Append to `tests/arena.test.js`:

```js
await test('you cannot walk out of a sealed arena', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const a = T.ARENAS.peak;

  // Face straight out from the centre and hold forward for several seconds.
  const pb = T.player.body;
  const away = pb.dir.clone().sub(a.centre).normalize();
  pb.fwd.copy(away); pb.fixFwd(); pb.sync();
  T.cam.fwd.copy(pb.fwd);
  g.press('KeyW'); g.press('ShiftLeft');

  let worst = 0;
  g.run(6, 0.05, () => {
    worst = Math.max(worst, T.angleBetween(pb.dir, a.centre) * T.R);
    return true;
  });
  assert(worst <= a.radius + 0.5, `player escaped to ${worst.toFixed(2)}u of a ${a.radius}u arena`);
  assert(T.onLand(pb.dir), 'and is still on solid ground');
});

await test('the boss cannot be charged out of the arena', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const a = T.ARENAS.peak, c = T.ch.active, hb = c.host.b;
  c.st.moves = ['dash'];
  c.st.dashSpeed = 40;                      // far beyond anything it would normally do
  let worst = 0;
  g.run(12, 0.02, () => {
    worst = Math.max(worst, T.angleBetween(hb.dir, a.centre) * T.R);
    return !c.result;
  });
  assert(worst <= a.radius + 0.5, `boss escaped to ${worst.toFixed(2)}u of a ${a.radius}u arena`);
});
```

- [x] **Step 2: Run the test and watch it fail**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: the boss test should already pass — `b.step(..., onLand)` vetoes the move. The player test may fail, because `resolveCollisions` can nudge the player past the rim after `moveWithSlide` has allowed a legal step near it.

If both already pass, keep the tests and skip to Step 4; the containment is free and the shove is only for feel.

- [x] **Step 3: Keep the player inside** — *not needed. Both tests in Step 2 passed as written: the arena ground override makes `onLand` false outside the rim, and `moveWithSlide` already vetoes a step onto non-land. Per Step 2's branch, the `colliders.js` clamp was skipped, which also avoids the `colliders.js` → `Arena.js` cycle it warns about.*

In `src/world/colliders.js`, add the clamp at the end of `resolveCollisions`:

```js
import { arena } from './Arena.js';
```

```js
function resolveCollisions(dir, rad) {
  const p = _cp.copy(dir).multiplyScalar(R);
  for (const c of colliders) {
    _cd.subVectors(p, c.p);
    const d = _cd.length(), m = c.r + rad;
    if (d < m && d > 1e-5) p.addScaledVector(_cd, (m - d) / d);
  }
  dir.copy(p).normalize();
  if (arena.active) clampToArena(dir, rad);
}

/** Push back inside the rim. The ground already ends here; this makes it feel deliberate. */
function clampToArena(dir, rad) {
  const a = arena.active;
  const ang = angleBetween(dir, a.centre);
  const max = (a.radius - rad) / R;
  if (ang <= max || ang < 1e-6) return;
  // Slide back along the great circle toward the centre.
  const t = max / ang, s = Math.sin(ang);
  _cp.copy(a.centre).multiplyScalar(Math.sin((1 - t) * ang) / s)
    .addScaledVector(_cd.copy(dir), Math.sin(t * ang) / s);
  dir.copy(_cp).normalize();
}
```

`angleBetween` is already imported by `colliders.js`; confirm it is, and add it if not.

**Watch for a cycle:** `colliders.js` → `Arena.js` → `terrain.js` → ... If relinking reports one, move the `arena.active` read behind a setter the way `terrain.js` does with `setGroundOverride`, rather than importing `Arena.js` into `colliders.js`.

- [x] **Step 4: Run the test and watch it pass**

Run: `node --experimental-vm-modules tests/arena.test.js`
Expected: PASS, 18 passed. (The plan said 19; counting the tests it actually specifies gives 18.)

- [x] **Step 5: Gate**

Run: `npm test`
Expected: `TOTAL: 96 passed, 0 failed` — 78 existing plus the 18 new arena checks.

- [x] **Step 6: Update the README**

In `README.md`, under the layout tree, add `arenas/` beneath `world/` and add a row to the responsibilities table:

```
| `world/Arena.js` | Sealed boss arenas: hides the planet, swaps the ground under the player, and puts everything back. |
```

Run `npm test` once more to confirm nothing regressed.

---

## Manual verification

None of this is visible to the test harness, which stubs the renderer. After Task 6, serve the game and check by eye:

- [ ] `npm start`, win five seals (or beat five of the six hunting yokai), walk to the gate, press `E`.
- [ ] The transition should be instant and the camera should not swing.
- [ ] The peak should read as a plateau above cloud; the marsh as black water under fog.
- [ ] Walk into the rim: you should stop, with the barrier shell visible, and not fall or stick.
- [ ] Win, and confirm you are back at the gate with the planet and petals restored.
- [ ] Lose deliberately, and confirm the same.
- [ ] Summon again and confirm the arena looks identical — no doubled geometry, no darkened sky.
