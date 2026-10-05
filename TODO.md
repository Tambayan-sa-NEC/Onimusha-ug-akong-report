# Onimusha — planned work

Features to build, written out so each one can be picked up without rereading the whole
game. Your ideas are in **Planned features**; ideas I suggested are in **Worth
considering**, kept separate so it stays clear which is which.

**All nine features are built.** Each section says what was done and what was
deliberately left, so the remaining work stays visible rather than implied. The
*Worth considering* list at the bottom is mostly untouched.

---

## Read this first — four constraints that shape everything below

These are already documented in `README.md`, but three of the features below collide
with them directly, so they are repeated here.

**1. The world is generated from one seeded random stream.**
`createLayout → createPlanet → buildScenery → createGate → spawnWorld` in
`core/Game.js` all draw from `utils/random.js`, which is why the planet is identical on
every visit. Anything that consumes `rand()` between those calls shifts every roll that
follows and regenerates a different world.

*This affects:* enterable houses, chests, better NPCs — anything that places objects.
Expect `tests/world.test.js` to fail, because it compares a fingerprint of the generated
world against `tests/baseline.json`. That failure is correct and expected. Regenerate the
baseline **deliberately**, in its own commit, once you are satisfied the new world is
right — never to make a red test go green.

**2. Arenas must not touch the world's random stream.** `world/arenas/*` use their own
`mulberry32`. `tests/arena.test.js` checks this.

**3. Nothing outside `ui/` writes to the DOM.** Every screen below — pause, settings,
keymaps, HUD — belongs in `ui/`, and reads game state rather than reaching into it.

**4. `input.js` is the only module that touches the keyboard and mouse.** Everything
else reads its state. Remappable keys must not change that.

**Persistence now exists, but only for preferences.** `core/save.js` keeps settings and
key bindings in `localStorage`. Progress — seals won, bosses felled, chests opened, pet
state — is still lost when the tab closes, and would be the natural next thing to add to
the same file.

---

## Suggested order

Later items lean on earlier ones, so building in roughly this order avoids rework:

1. ~~**Foundations** — persistence + the `Esc` decision.~~ **Done.**
2. ~~**Pause screen** (#2)~~ **Done.**
3. ~~**Settings & keymaps**~~ **Done.**
4. ~~**HUD** (#1), **main menu** (#3), **character select** (#4)~~ **Done.**
5. ~~**NPCs** (#5), **houses** (#6), **chests** (#7)~~ **Done** — the baseline was
   regenerated once, in its own commit, as intended.
6. ~~**Items** (#8) and **pets** (#9)~~ **Done.**

---

## Foundations

Not features in themselves — two small pieces of groundwork that several features need.

- [x] **A persistence layer.** *Done — `src/core/save.js` keeps one versioned JSON blob
      in `localStorage`, with settings and key bindings in it, and a reset path.*
      **Still open:** progress (seals won, bosses felled, chests opened, pet state) does
      not go through it yet. When it does, keep the line between *run state* and *saved
      state* explicit, or this gets muddy fast.

- [x] **Resolve the `Esc` conflict.** *Done — `Esc` now always opens the pause screen.
      Forfeiting moved inside it as its own button, shown only while a challenge is
      running. The two tests that encoded the old behaviour were rewritten rather than
      deleted, and `challengeKey` no longer consumes `Escape`.*

---

## Planned features

### 1. Better HUD — **mostly done**

Built in `src/ui/hud.js`, covered by `tests/hud.test.js`.

- [x] Show player health persistently — a heart row sits bottom-left whenever you are
      playing. It reads the live fight when there is one and shows a full row otherwise,
      and keeps showing what a fight cost until that fight is torn down.
- [x] Make the seal row readable without colour — a won seal now carries a tick as well
      as the fill, and its tooltip says "won" rather than just naming the challenge.
- [x] Retire the permanent controls card — it fades after 45 seconds of play
      (`HINT_FADE_AFTER`) and comes back when you return to the menu. The same
      information lives on the pause screen's Controls page.
- [x] Decide what the HUD does during the ending cutscene — the hearts and the seal book
      both stand aside.
- [ ] **Still open:** the challenge panel, boss bar and dialogue box still have their own
      spacing, corners and type scale. Pulling them onto one scale is the remaining work.
- [ ] **Still open:** the seal row does not say which yokai each seal belongs to beyond
      its tooltip.

*Lives in:* `ui/hud.js`, `styles/hud.css`, `index.html`.

**Worth knowing:** damage only happens inside a fight — `hurtPlayer` is only reached from
`combat/battle.js` and `combat/bossBattle.js`, and each fight starts you at full health.
So the heart row is a consistent place to read your health, not a resource you manage
between fights. Making health persist across fights would be a real balance change.

---

### 2. Pause screen — **done**

Built in `src/ui/pause.js`, styled in `styles/pause.css`, covered by `tests/pause.test.js`.

- [x] **Resume.**
- [x] **Settings** — see below.
- [x] **Keymaps** — see below.
- [x] **Quit** — back to the main menu, behind a confirm step, reusing `toMenu()` in
      `ui/characterSelect.js` for the teardown rather than writing a second path. A live
      challenge is torn down first, since `toMenu()` refuses to run while one is active.
- [x] Actually pause: `core/GameLoop.js` skips the whole update block but keeps
      rendering and keeps `last` advancing, so resuming never hands the first frame a
      delta the size of the pause. A large delta would teleport bodies through colliders.
- [x] Decide whether pausing mid-challenge is allowed. *Allowed, and the timer genuinely
      stops rather than running on. That makes pausing a reprieve in the ten timed
      mini-games — worth revisiting if it turns out to make them too easy.*

*Still open:* a gamepad has no way into any of this.

#### Settings — **done**
- [x] Audio: a master volume and a mute that the pause screen can set directly.
      *Separate music and effect buses are still open — the oscillators in
      `systems/audio.js` all share one gain node today.*
- [x] Camera: invert look and sensitivity.  *Default camera distance is still not
      exposed, though `CFG.camDist` is ready for it.*
- [x] Accessibility: reduced motion (drops the hit-stop freeze-frame and the drifting
      petals) and dialogue typewriter speed.  *A larger-text option is still open.*
- [x] Persist all of it, with a reset-to-defaults.

Most of these map onto `CFG` already. Resist scattering new globals; extend `CFG` and
let the settings screen write to it.

#### Keymaps — **mostly done**
- [x] Show the current bindings.
- [x] Allow rebinding, with conflict detection and a reset-to-defaults.
- [x] Keep `input.js` the single owner of input. Bindings live in `config/keys.js` as
      data; `input.js` reads them instead of hard-coding `e.code === 'KeyE'`.
- [ ] **Still open:** the list is flat, so the kunoichi's dash and the rōnin's roll are
      both always shown, each labelled with whose move it is. A per-character view would
      read better.
- [ ] **Still open:** rebinding takes a single key, so an action cannot be given a second
      binding from the UI — the defaults that have two (`W`/`↑`) can only lose one.
      The data layer supports several; only the editor does not.

---

### 3. Better landing page / main menu — **done**

- [x] Title, select and credits are separate pages inside the overlay card, so the flow
      is Title → Select → Play. `Esc` backs out of select and credits.
- [x] Continue (only when a run is worth resuming), Settings, Controls, Credits. Settings
      and Controls reuse the pause screen's own pages rather than a second copy.
- [x] The live planet still turns behind every page.
- [x] A quieter title card: the name, one line, and a short list — rather than two
      paragraphs of rules before you have chosen anyone.

*Lives in:* `ui/characterSelect.js`, `index.html`, `styles/base.css`.

---

### 4. Better character selection — **mostly done**

- [x] Each card shows the character in 3D, built from the same `makeHumanoid` the game
      uses, turning slowly on its own small renderer (`ui/charPreview.js`) so nothing it
      does can disturb the planet behind the menu.
- [x] A stat block shows the difference rather than describing it: hearts as filled and
      hollow glyphs, pace, reach, escape, and whether anyone walks with you.
- [x] Keyboard navigation works on every page, and accepts either axis.
- [x] Nothing is hard-coded to two characters — the cards, the previews and the stat
      block are all built from `CHAR_ORDER` and `CHARACTERS`.
- [ ] **Still open:** gamepad support. No page reads a gamepad, menu or otherwise.

---

### 5. Better NPCs — **mostly done**

Covered by `tests/npc.test.js`.

- [x] All seven villagers now walk. Each has a `wander` leash in radians and returns to
      the spot it belongs to, so the village still feels inhabited rather than scattered.
- [x] Dialogue reacts to progress. Lines gained a fourth slot, `when`, naming the chapter
      they belong to — `start`, `midway`, `gate` or `done` — and `chapter()` in
      `entities/NPC.js` decides which is current. An NPC with no line for the current
      chapter falls back to its whole set rather than falling silent.
- [x] Kenji, Daisuke and Goro give hints, naming a game still unplayed, and pointing at
      the gate once there are none left.
- [ ] **Still open:** no new `look` variety, and the animation set is unchanged.
- [ ] **Still open:** nobody gives a reward or sets an errand — hints are as far as it
      goes.

**No world-generation risk after all.** None of this changes how many draws come out of
the seeded stream: `wander` is read at runtime, `makeHumanoid` never calls `rand`, and no
NPC was added or removed. `tests/world.test.js` passes untouched.

---

### 6. Enterable houses

Currently `makeTeaHouse()` and `makePagoda()` in `world/props.js` are exteriors only.

- [ ] Pick the approach first, because it decides everything else:
      - **Interior as an arena.** `world/Arena.js` already hides the planet, swaps the
        ground under the player, and puts everything back. It was built for boss fights
        but is close to what a building interior needs. Lowest-risk option, and it
        reuses a tested system.
      - **Interior in place**, with the roof hidden on entry. Keeps the world
        continuous, but needs real work on the camera and colliders.
- [ ] A door that prompts on `E`, matching how everything else in the game is entered.
- [ ] Decide what interiors are *for* — a tea house you can sit in, a shop, somewhere a
      villager sleeps, somewhere a chest hides. An empty room is worse than a closed
      door.
- [ ] Remember constraint 2 if you go the arena route: arena builders must not call
      `rr` or `rand` from `utils/random.js`, including indirectly through a `props.js`
      builder that uses them.

---

### 7. Chests — **done**

- [x] A banded box with a lid that swings open on its hinge and stays up.
- [x] Placed from their own `mulberry32`, after everything else, so world generation is
      untouched. They reserve ground but carry no collider, as `world/scenery.js`
      already does for props this small.
- [x] Opened state persists, so they do not refill on reload.
- [x] Each holds a keepsake. Ten are out on the planet; two are indoors.
- [ ] **Still open:** none are hidden anywhere properly cunning — behind the sealed
      gate, at the poles, or underwater.

---

### 8. Better items — **done, as keepsakes**

- [x] **Purpose decided: collectibles, not equipment.** Health resets at the start of
      every fight and there are no stats to raise, so an item that changed numbers
      would either do nothing or quietly rewrite the balance. Twelve keepsakes, each a
      sentence about the little world, are what make a chest worth opening.
- [x] A Keepsakes page on the pause screen: what has been found, and the shape of what
      has not.
- [x] Held keepsakes persist, and finding one alone makes a run worth continuing.
- [x] Nothing is consumed, equipped or managed, which suits a game this gentle.

---

### 9. Better pet system — **done**

Built in `entities/pets.js`, covered by `tests/pet.test.js`.

- [x] The companion has a name (Kuro, Mame, Tora by kind) and reacts — to a seal won, a
      chest opened, and sometimes a villager greeted.
- [x] **Does the companion fight? No, and deliberately.** Every fight starts you at full
      health and ends with the seal won or not, so an animal dealing damage would
      quietly rewrite the difficulty of all ten yokai and both bosses. It keeps up, it
      reacts, and it stays out of the way. A test holds that line.
- [x] The kunoichi is no longer made to walk alone — a cat comes with her, and the
      select screen's Company row says so for both characters.
- [x] Any cat or dog can be talked round with `E`. Befriending releases whoever was with
      you, so you walk with one companion rather than a procession.
- [x] Which animal is with you is saved and restored, falling back to the character's
      own companion if that animal is not found.

---

## Worth considering

My suggestions, not from your list. Pick up or discard freely.

- [ ] **A way to find things.** Finding a yokai means wandering the sphere until one
      appears — when I drove the game to take the README screenshots, it took around
      forty-five seconds of walking to meet the first one. A compass, a map, or a
      marker on an unmet yokai would help, and it pairs naturally with the HUD work.
- [ ] **Save and continue.** Falls out of the persistence foundation almost for free,
      and the game currently loses all five seals if the tab closes.
- [ ] **Accessibility pass.** The seal row relies on colour; dialogue speed is fixed;
      no reduced-motion option exists despite constant falling petals and hit-stop on
      every sword connection. Cheap to do alongside the settings screen, expensive to
      retrofit later.
- [ ] **A day/night cycle.** The art style would carry it beautifully, and lanterns
      already exist as props — they currently glow in full daylight.
- [ ] **A journal or quest log.** Which seals remain, who you have met, what a villager
      asked for. Grows naturally out of #5.
- [ ] **Photo mode.** Hide the HUD, free the camera. The game is pretty and has no way
      to look at itself — it would also make future README screenshots trivial.
- [ ] **Commit the screenshot tooling.** The README screenshots were captured with a
      Puppeteer script driving headless Chrome, which lives outside the repository, so
      they cannot currently be reproduced from a clean checkout. Worth adding under
      `tools/` if screenshots are to be refreshed as the game changes.
- [ ] **More mini-games, or difficulty tiers for the existing ten.** The challenge
      framework in `challenges/` already supports this cleanly — `GAMES` and
      `GAME_ORDER` in `challenges/games/index.js` are the seam.

---

## Working notes

- Tests: `npm test` — 217 checks across fifteen suites. Run before and after each feature.
- `node --experimental-vm-modules tests/rebaseline.js` shows what moved in the world;
  only `--write` rewrites the baseline.
- `tests/world.test.js` failing after a world change is expected; regenerate
  `tests/baseline.json` deliberately and in its own commit.
- The game has no build step and one devDependency (`three`, used only by the tests).
  Keep it that way unless a feature genuinely cannot be built without more.
