# Boss arenas

**Date:** 2026-10-02
**Status:** design, awaiting review

## Intent

Boss fights currently happen on the same hillside as everything else. The gate
summons Ōtengu or Orochi onto the grass a few paces away and the fight plays out in
front of the village. Nothing about the space says this is different.

The goal is that summoning a boss takes you somewhere. You are pulled out of the
world into a sealed place that belongs to that yokai — the Tengu's peak, the Orochi's
marsh — and returned to the gate when it is over.

Success means a player can tell, from one screenshot, which boss they are fighting,
without the boss being in frame.

## Decisions taken

Settled in conversation before this document:

1. **A dedicated space, not a dressed-up patch of the planet.** The world is hidden
   while you are in an arena.
2. **Sealed.** There is no walking out. Win or lose, you are returned to the gate and
   may summon again. The existing "you fled the battle" loss is retired inside arenas.
3. **Presentation, plus a real edge.** Arenas do not change damage, movement, or the
   bosses' move sets — both stay tuned exactly as they are now. The boundary, however,
   physically stops you.

## Non-goals

- No arena-specific combat mechanics (no updrafts, no water that slows you). The
  arenas are stages, not puzzles. This can be revisited once they exist.
- No third arena, and no arenas for ordinary yokai.
- No new art assets. Everything is built from the existing primitive builders.
- The wolf companion does not enter the arena.

## Architecture

### Three scene layers

Today every mesh is added straight to `scene`. Split it by lifetime:

| Layer | Contents | In an arena |
|---|---|---|
| `worldRoot` | planet, water, props, clouds, the gate, ambient entities (NPCs, critters, yokai) | hidden |
| `arenaRoot` | the active arena's ground and props | shown |
| `scene` | player, the active boss, transient effects (sparks, emotes, rings, arcs, kunai, blob shadow) | always visible |

The player and boss stay directly on `scene` because they are the only things that
exist in both places. Transient effects stay there because they are short-lived and
follow whatever is happening.

Both roots live in `core/Stage.js` alongside the scene they belong to.

### One seam for ground height

`heightAt(dir)` in `world/terrain.js` is already the single source of truth for ground
height — eleven modules call it and nothing computes height independently. The arena
system replaces it for the duration of a fight:

```js
let groundOverride = null;

/** Replace the ground for the duration of an arena fight. Pass null to restore the planet. */
export function setGroundOverride(fn) { groundOverride = fn; }

function heightAt(d) {
  return groundOverride ? groundOverride(d) : planetHeightAt(d);
}
```

Everything downstream follows without modification: `SurfaceBody.sync`, `onLand`, the
camera's up-vector, the blob shadow, `resolveCollisions`, prop placement.

This is what makes an arena a real place rather than fog over the old one. While you
are inside, the planet is not consulted for anything.

`Arena.js` imports `terrain.js`; `terrain.js` imports nothing from the arena system.
No cycle.

### The boundary

An arena's height function returns ground below `WALK_MIN` outside its radius. That
makes `onLand` false out there, and `moveWithSlide` already refuses to move onto
non-land — for the player and for the boss's charges alike. Containment therefore
costs no new collision code.

Two additions on top, for feel rather than function:

- a visible barrier shell on `arenaRoot`, so the edge is legible before you reach it;
- a small outward-to-inward shove in `resolveCollisions` when an arena is active, so
  pressing into the edge reads as being pushed back rather than stuck.

## Components

### `src/world/Arena.js`

Owns the lifecycle. Exports:

```js
arena.active            // the active arena definition, or null
arena.enter(definition) // hide the world, show and install the arena, place the player
arena.exit()            // restore everything, return the player to the gate
```

`enter` is responsible for, in order: building the arena on first use and caching it;
installing the ground override **before** moving anything, so the first `sync()` uses
arena ground; hiding `worldRoot` and the petal field; showing `arenaRoot`; swapping
`scene.background` and `scene.fog`; clearing in-flight emotes and kunai; teleporting
the player to the arena's entry point; resetting `cam.fwd` and snapping the camera.

`exit` reverses it, restoring the player to `GATE_DIR`.

### `src/world/arenas/peak.js`, `src/world/arenas/marsh.js`

One module per arena, each exporting a definition:

```js
{
  id, name,
  centre,                 // fixed unit vector — never from the world RNG
  radius,                 // walkable radius in world units
  entry,                  // where the player appears
  sky, fogNear, fogFar,
  height(dir),            // ground height; below WALK_MIN outside `radius`
  build(),                // returns a Group for arenaRoot; called once, lazily
}
```

Adding a boss later means adding one file and one reference.

### Changes to existing modules

| Module | Change |
|---|---|
| `core/Stage.js` | add `worldRoot` and `arenaRoot` |
| `world/terrain.js` | the `setGroundOverride` seam |
| `world/colliders.js` | edge shove while an arena is active |
| `world/SealedGate.js` | `summon` enters the arena; the existing `bossHooks.onEnd` exits it |
| `combat/battle.js` | gate the `dist > 20` flee-loss on `!arena.active` |
| `data/bossDefs.js` | each boss gains `arena: 'peak'` / `arena: 'marsh'` |
| ~13 modules | mechanical `scene.add(x)` → `worldRoot.add(x)` |

## Lifecycle

```
E at a lit gate
  └─ gate.summon(def)
       ├─ arena.enter(def.arena)
       │    ├─ build once and cache
       │    ├─ setGroundOverride(arena.height)
       │    ├─ worldRoot.visible = false, petals hidden
       │    ├─ arenaRoot.visible = true, sky and fog swapped
       │    ├─ clear emotes and kunai
       │    ├─ player → arena.entry, camera reset and snapped
       │    └─ remember nothing: exit always returns to the gate
       ├─ spawn the boss at the arena centre
       └─ startChallenge(host, BOSS)

fight → win, loss, or forfeit (all resolve through the challenge flow)

  └─ bossHooks.onEnd(host, felled)
       ├─ gate.dismiss(host, felled)      (unchanged: seal, particles, delist)
       └─ arena.exit()
            ├─ setGroundOverride(null)
            ├─ arenaRoot.visible = false, sky and fog restored
            ├─ worldRoot.visible = true, petals restored
            ├─ clear emotes and kunai spawned during the fight
            └─ player → GATE_DIR, camera reset and snapped
```

There is exactly one way in and one way out. That is what makes the state safe.

## The two arenas

| | 天狗の峰 — Ōtengu's Peak | 大蛇の沼 — Orochi's Marsh |
|---|---|---|
| Floor | bare rock, slightly domed, 12u radius | sunken basin under black shallow water, 13u |
| Sky | bruised grey-violet | sickly green-black |
| Fog | close, to hide the absent horizon | dense |
| Props | broken pine snags, a weathered torii at the rim, boulders, a cloud sea below the edge | dead bamboo, half-sunk stone lanterns, drifting mist |
| Edge | rising wind streaks | a wall of reeds and mist |

All assembled from `world/props.js` and `render/materials.js`. No new asset types.

## Keeping world generation untouched

The planet is generated from a single seeded stream, and `tests/world.test.js`
fingerprints the result. Arenas must draw nothing from that stream. Three rules:

1. Arena centres and entry points are **fixed constants** — no `findSpot`, no
   `scatterDirs`.
2. Arena geometry uses its **own `mulberry32` instance**, independent of the world
   stream.
3. Arenas are **built lazily on first entry** and cached, so construction provably
   cannot run before or during `spawnWorld()`.

Breaking any of these fails the fingerprint test rather than silently reshaping the
planet.

## Edge cases

| Case | Handling |
|---|---|
| `Esc` mid-fight | forfeits via `challengeKey`, resolves as a loss, exits through `onEnd` |
| The 2.6s result banner | `toMenu()` already returns early while `ch.active` is set, so you cannot reach the menu from inside an arena |
| Hearts reach zero | loss → the same single exit path |
| A yokai is hunting you when the gate fires | `updateHunts` already releases the hunter whenever `ch.active` is set |
| Emotes and kunai in flight | cleared on entry **and** exit; they live on `scene` in world space, so either transition would otherwise leave them hanging at the old location |
| Camera | `cam.fwd` reset and snapped at both ends, so neither transition swings wildly |
| Petals | hidden with the world — sakura on a storm-lashed peak would read as a bug |
| The wolf | stays at the gate with the rest of `critters` |
| Re-entry after a loss | the cached arena is re-shown; player position is re-placed |

## Testing

New `tests/arena.test.js`:

- entering hides `worldRoot`, shows `arenaRoot`, installs the override
- `heightAt` at the arena centre returns arena ground, not planet ground
- the player lands inside the bounds, on walkable ground
- **you cannot walk out** — drive movement outward for several seconds and assert the
  distance from centre never exceeds the radius
- the boss cannot be charged out of bounds either
- exiting restores visibility, sky, fog, `groundOverride === null`, and places the
  player at the gate — on a win and on a loss
- the flee-loss does not fire inside an arena
- the two arenas are distinguishable (different sky, radius, centre)
- regression: boss seals still awarded, the gate still advances to the second boss

All 78 existing tests stay green. The fingerprint test is the specific guard that
arenas consumed no seeded randomness.

## Risks

| Risk | Mitigation |
|---|---|
| The `scene.add` → `worldRoot.add` sweep misses something, leaving a stray prop floating in the arena | the arena suite asserts `worldRoot.visible === false` and checks that nothing outside the known layers is visible |
| An arena is entered before the world is built | arenas are lazy and only reachable through the gate, which requires five seals |
| Visual result is wrong in ways tests cannot see | unavoidable here — no browser automation in this environment. Flagged for manual check. |
| Fog and sky restore incorrectly after repeated entries | asserted explicitly on both win and loss paths |

## Open question for review

Arena radius is 12u (peak) and 13u (marsh). The bosses' charge moves cover 6–7u and their slam
radius is 3.6–4.2u, so this should leave room to dodge without the fight feeling
cramped. Worth confirming by feel once it is playable; it is a one-line change per
arena.
