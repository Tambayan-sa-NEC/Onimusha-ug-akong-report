/**
 * Boots the world in a fixed order and hands over to the loop.
 */
import { buildSeals } from '../challenges/seals.js';
import { equipWeapon } from '../combat/katana.js';
import { startLoop } from './GameLoop.js';
import { spawnWorld } from '../systems/spawn.js';
import { buildMenu } from '../ui/characterSelect.js';
import { initHud } from '../ui/hud.js';
import { initPause } from '../ui/pause.js';
import { arena } from '../world/Arena.js';
import { createGate } from '../world/SealedGate.js';
import { createLayout } from '../world/layout.js';
import { buildScenery } from '../world/scenery.js';
import { createPlanet } from '../world/terrain.js';

/**
 * Build the planet, then start running.
 *
 * The order of the first five calls is load-bearing. The whole world is generated
 * from one seeded random stream, so reordering them produces a different planet.
 */
function startGame() {
  createLayout();     // ponds, hills and gardens
  createPlanet();     // the terrain shell and the water sphere
  buildScenery();     // props, trees, ground cover
  createGate();       // the sealed gate on the far hill
  spawnWorld();       // villagers, animals, yokai

  equipWeapon();      // put a blade in the default character's hand
  buildSeals();       // draw the empty seal book
  buildMenu();        // the character select screen, up before the first frame
  initPause();        // restore saved settings and keybinds before anything reads them
  initHud();          // vitals, the seal book, the fading controls card
  void arena;          // the arena system is wired in by the gate
  startLoop();
}

export { startGame };
