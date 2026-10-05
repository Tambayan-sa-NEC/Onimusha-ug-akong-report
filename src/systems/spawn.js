/**
 * Populates the planet with villagers, animals and yokai. Consumes the seeded stream.
 */
import * as THREE from 'three';
import { hosts } from '../challenges/system.js';
import { R } from '../config/settings.js';
import { NPC_DEFS } from '../data/npcDefs.js';
import { Bird } from '../entities/Bird.js';
import { Koi } from '../entities/Koi.js';
import { NPC } from '../entities/NPC.js';
import { Quadruped } from '../entities/Quadruped.js';
import { Chochin } from '../entities/yokai/Chochin.js';
import { KasaObake } from '../entities/yokai/KasaObake.js';
import { Kitsune } from '../entities/yokai/Kitsune.js';
import { Onibi } from '../entities/yokai/Onibi.js';
import { PETAL_N, respawnPetal } from '../render/effects/petals.js';
import { pick } from '../utils/random.js';
import { localPoint, offsetDir, randTangent, randomDir, tangentToward } from '../utils/sphere.js';
import { gate } from '../world/SealedGate.js';
import { createChests } from '../world/chests.js';
import { createDoors } from '../world/houses.js';
import { findSpot, occupy, spotNear } from '../world/colliders.js';
import { critters, npcs } from '../world/entities.js';
import { GARDENS, GARDEN_R, HILLS, PONDS, SPAWN, SPAWN_FWD } from '../world/layout.js';
import { PAGODA_DIR, TEA_DIR, TEA_FWD } from '../world/scenery.js';

const V3 = THREE.Vector3;

function addNPC(id, dir, fwd) {
  const def = NPC_DEFS.find(d => d.id === id);
  if (!dir) return;
  occupy(dir, 1.5);
  const n = new NPC(def, dir, fwd || randTangent(dir));
  npcs.push(n);
  if (def.game) hosts.push(n);
  return n;
}
/** Populate the planet. Final consumer of the seeded stream. */
function spawnWorld() {
  {
    // Kenji greets you at spawn.
    addNPC('kenji', localPoint(SPAWN, SPAWN_FWD, 3, -2.6), SPAWN_FWD.clone().negate());
    // Hanako in front of her tea house.
    addNPC('hanako', spotNear([localPoint(TEA_DIR, TEA_FWD, 3.4, 0.8)], 0.5), TEA_FWD);
    // Daisuke beside a zen garden, facing it.
    const g = GARDENS[0];
    const md = spotNear([0, 1, 2, 3, 4, 5].map(a => offsetDir(g, a, GARDEN_R + 1.8 / R)), 0.3);
    addNPC('daisuke', md, md && tangentToward(md, g, md, new V3()));
    // Goro on the shore of a pond, facing the water.
    const p = PONDS[1];
    const gd = spotNear(Array.from({ length: 12 }, (_, i) => offsetDir(p.c, i * 0.52, p.r * 1.2)), 0.3);
    addNPC('goro', gd, gd && tangentToward(gd, p.c, gd, new V3()));
    // The rest roam freely.
    for (const id of ['taro', 'yuki', 'kage']) addNPC(id, findSpot(3));
  }

  const CATS = [{ color: '#e59a4c', belly: '#f7e6cf' }, { color: '#8b8c95', belly: '#d9d9de' },
                { color: '#2f2c33', belly: '#4a4650' }, { color: '#f3eee6', belly: '#ffffff', ear: '#e59a4c' }];
  const DOGS = [{ color: '#d8843f', belly: '#f6ecdc' }, { color: '#35302f', belly: '#e9d6b8' }, { color: '#f1ebe0', belly: '#ffffff' }];
  const BIRDS = [{ c: '#8a6a4a', b: '#e8dcc8' }, { c: '#5a7fb0', b: '#f0ece0' }, { c: '#f2f2ee', b: '#ffffff' }, { c: '#c8423a', b: '#f1d7c0' }];
  for (let i = 0; i < 7; i++) { const d = findSpot(0.6); if (d) critters.push(new Quadruped('cat', pick(CATS), d)); }
  for (let i = 0; i < 5; i++) { const d = findSpot(0.6); if (d) critters.push(new Quadruped('dog', pick(DOGS), d)); }
  for (let i = 0; i < 12; i++) { const d = findSpot(0.3); if (d) critters.push(new Bird(pick(BIRDS), d)); }
  // A cat and a shiba near spawn so the first minute has company.
  critters.push(new Quadruped('cat', CATS[0], spotNear([localPoint(SPAWN, SPAWN_FWD, 2, 3)], 0.3)));
  critters.push(new Quadruped('dog', DOGS[0], spotNear([localPoint(SPAWN, SPAWN_FWD, -3, 2)], 0.3)));
  for (const p of PONDS) for (let i = 0; i < 4; i++) critters.push(new Koi(p));

  // Yokai (every one of them is also a challenge host)
  const addYokai = y => { critters.push(y); hosts.push(y); };
  for (let i = 0; i < 2; i++) { const d = findSpot(0.6); if (d) addYokai(new Kitsune(d)); }
  for (let i = 0; i < 3; i++) { const d = findSpot(0.6); if (d) addYokai(new KasaObake(d)); }
  for (const d of [spotNear([localPoint(TEA_DIR, TEA_FWD, 3.5, -2.8)], 0.3),
                   spotNear([0, 1.5, 3, 4.5].map(a => offsetDir(PAGODA_DIR, a, 4.2 / R)), 0.3),
                   findSpot(0.5)]) if (d) addYokai(new Chochin(d));
  for (let i = 0; i < 9; i++) addYokai(new Onibi(randomDir()));
  addNPC('akaoni', findSpot(3));
  addNPC('aooni', findSpot(4));                                        // needs open ground for its shockwaves
  addNPC('tengu', spotNear([HILLS[1] ? HILLS[1].c : null], 0.5));      // tengu live on mountain tops
  addNPC('rokurokubi', findSpot(2));
  addNPC('tanuki', findSpot(2));
  // Kappa live on the shores of the two ponds Goro isn't fishing.
  for (const p of PONDS.slice(2)) {
    const d = spotNear(Array.from({ length: 12 }, (_, i) => offsetDir(p.c, i * 0.52, p.r * 1.2)), 0.3);
    if (d) addNPC('kappa', d, tangentToward(d, p.c, d, new V3()));
  }

  npcs.push(gate);   // the gate answers E and ticks along with the other fixtures
  for (let i = 0; i < PETAL_N; i++) respawnPetal(i, true);

  // Last of all, and from their own streams, so nothing above is disturbed.
  createChests(npcs);
  createDoors(npcs, [
    { roomId: 'teahouse', dir: TEA_DIR, fwd: TEA_FWD, label: 'the tea house' },
    { roomId: 'pagodaRoom', dir: PAGODA_DIR, label: 'the pagoda' },
  ]);
}

export { addNPC, spawnWorld };
