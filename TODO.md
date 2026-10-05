# Onimusha — planned work

Features to build, written out so each one can be picked up without rereading the whole
game. Your ideas are in **Planned features**; ideas I suggested are in **Worth
considering**, kept separate so it stays clear which is which.

**Done so far:** the *Foundations* and all of **#2 Pause screen** (including settings and
keymaps). Everything else is still open.

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
4. **HUD** (#1), **main menu** (#3), **character select** (#4) — presentation, independent.
5. **NPCs** (#5), **houses** (#6), **chests** (#7) — all touch world generation; do them
   together so the fingerprint baseline is regenerated once, not three times.
6. **Items** (#8) and **pets** (#9) — these build on chests and NPCs.

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

### 1. Better HUD

The in-game overlay — currently the seal row, the prompt bar, the boss bar, and the
static controls card in `index.html`.

- [ ] Show player health persistently. Hearts currently appear only inside the battle
      panel, so outside a fight you cannot see how hurt you are.
- [ ] Make the seal row (`#seals`) readable at a glance — which of the five are won,
      which yokai each belongs to, how far the sealed gate is from opening. Do not rely
      on colour alone to signal "won"; see *accessibility* below.
- [ ] Retire the permanent controls card. It covers a quarter of the screen in every
      screenshot. Fold it into the pause screen's keymap page, or fade it after the
      first minute of play.
- [ ] Give the challenge panel, boss bar, and dialogue box one consistent visual
      language — spacing, corners, type scale.
- [ ] Decide what the HUD does during the ending cutscene. It should almost certainly
      get out of the way.

*Lives in:* `styles/hud.css`, `ui/`, `index.html`.

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

### 3. Better landing page / main menu

Today `index.html` shows one overlay card that is both the title and the character
select, over a live view of the planet.

- [ ] Separate title from character select, so the flow is Title → Select → Play.
- [ ] Add: Continue (needs persistence), Settings, Controls, Credits.
- [ ] Keep the live planet behind it — that it is the running game, not a static image,
      is the best thing about the current screen.
- [ ] Give the title card a stronger first impression: the game is visually confident
      and the opening card undersells it.

*Lives in:* `index.html`, `styles/base.css`, `ui/characterSelect.js`.

---

### 4. Better character selection

- [ ] Show each character in 3D — they are built from primitives in
      `entities/models/humanoid.js` and could be posed and turned on the select screen.
- [ ] Preview the real difference between them: five hearts and a heavy three-hit combo
      versus three hearts, a thrown kunai, and a shadow dash. The current blurb states
      this in text; show it.
- [ ] Support gamepad and keyboard navigation properly. `menuKey()` handles arrows and
      Enter today; the cards are the only mouse target.
- [ ] `config/characters.js` holds the `look` objects — the natural seam if a third
      character is ever added. Worth keeping that in mind while restructuring.

---

### 5. Better NPCs

Villagers are defined in `data/npcDefs.js` as `{ id, name, seal, look, lines }`, where
each line is `[text, action?, emote?]`. They stand still and cycle their lines.

- [ ] Let them move — a daily path, a place they belong, somewhere they go. The planet
      feels staged because nobody walks it but you.
- [ ] Make dialogue react to state: whether you have met them, how many seals you carry,
      whether the gate is open, whether a boss has fallen. The data shape already has
      room for conditional lines.
- [ ] Give a few of them something to *do* — a hint toward an unfound yokai, a reward, a
      small errand. Right now every conversation is flavour.
- [ ] More variety in `look` and in the animation set (`bow`, `hop`, `spin`, `wave`,
      `meditate`, `dance`, `vanish`).
- [ ] Watch the spawn count: NPCs are placed during `spawnWorld`, so adding or moving
      them changes the world fingerprint. See constraint 1.

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

### 7. Chests

- [ ] A chest model and an open animation.
- [ ] Placement during world generation — see constraint 1.
- [ ] Opened state must persist, or chests refill on every reload. Needs the persistence
      foundation.
- [ ] Decide what is inside, which depends on #8 below. Do not build chests before
      there is something worth finding in them.
- [ ] Hide them somewhere worth searching: behind the sealed gate, inside houses, at the
      poles, underwater.

---

### 8. Better items

There is no item system at all today — this is new ground, not an improvement.

- [ ] Decide the purpose before the implementation. Consumables that heal? Equipment
      that changes stats? Collectibles that reward exploration? Key items that open
      routes? Each implies a different system, and the game does not need all four.
- [ ] Inventory UI, if items can be held rather than used immediately.
- [ ] Persist held items.
- [ ] Keep it honest to the game's tone — it is gentle and small, and a full RPG
      inventory would sit awkwardly on it.

My suggestion: start with the smallest version that makes chests worth opening, and
grow it only if it earns the room.

---

### 9. Better pet system

The rōnin already walks with a wolf — `setWolf()` in `entities/Player.js`,
`entities/Wolf.js`, and the planet has `Bird`, `Koi`, and `Quadruped` critters.

- [ ] Give the wolf more presence: reactions, idle behaviour, a name, acknowledgement
      when you talk to someone or win a seal.
- [ ] Should the wolf help in battle? It currently follows and does nothing. This is the
      biggest open question in the feature.
- [ ] Let the kunoichi have a companion too, so the pet is not a rōnin-only perk — or
      make that asymmetry deliberate and visible on the character select screen.
- [ ] Tame or befriend the existing critters. The planet is full of animals that
      currently ignore you.
- [ ] Persist which pet is with you.

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

- Tests: `npm test` — 140 checks across eight suites. Run before and after each feature.
- `tests/world.test.js` failing after a world change is expected; regenerate
  `tests/baseline.json` deliberately and in its own commit.
- The game has no build step and one devDependency (`three`, used only by the tests).
  Keep it that way unless a feature genuinely cannot be built without more.
