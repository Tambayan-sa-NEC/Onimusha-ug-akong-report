/**
 * Doors: the way into the two buildings you can walk inside, and the way out again.
 *
 * A door is a fixture like the sealed gate — it answers E and lives in `npcs`. The
 * room itself is an arena (`arenas/rooms.js`), so stepping inside reuses the one
 * tested path that swaps the ground under the player and puts it all back.
 */
import * as THREE from 'three';
import { ch } from '../challenges/system.js';
import { arenaRoot, worldRoot } from '../core/Stage.js';
import { GEO, part } from '../render/materials.js';
import { INDOOR_ITEMS } from '../data/itemDefs.js';
import { SurfaceBody } from '../physics/SurfaceBody.js';
import { Sound } from '../systems/audio.js';
import { HUNT, endHunt, hunter } from '../systems/hunting.js';
import { openDialog } from '../ui/dialog.js';
import { mulberry32 } from '../utils/random.js';
import { randTangent } from '../utils/sphere.js';
import { arena } from './Arena.js';
import { ARENAS } from './arenas/index.js';
import { makeChestFixture } from './chests.js';

const doors = [];
/** The fixtures that only exist while you are indoors, keyed by room id. */
const roomFixtures = new Map();

/** Where the player was standing when they stepped inside. */
let cameFrom = null;

/** True when the player is inside a room rather than a boss arena. */
const indoors = () => !!(arena.active && arena.active.isRoom);

/* ---------------------------------- the door --------------------------------- */

/** A noren: the split curtain hung in a doorway, which is what you walk through. */
function makeNoren(colour = '#8a3b36') {
  const g = new THREE.Group();
  g.add(part(GEO.box, '#4b3b39', [0, 1.62, 0], [1.5, 0.1, 0.12]));        // the rail
  for (const x of [-0.37, 0.37]) {
    g.add(part(GEO.box, colour, [x, 1.1, 0], [0.68, 0.95, 0.04]));        // the two panels
  }
  g.add(part(GEO.box, '#efe6d2', [0, 1.28, 0.03], [0.3, 0.3, 0.02]));     // a pale crest
  return g;
}

function makeDoor(roomId, dir, fwd, label) {
  const room = ARENAS[roomId];
  const mesh = makeNoren();
  worldRoot.add(mesh);
  const door = {
    isDoor: true,
    roomId,
    m: mesh,
    def: { name: label, seal: '戸' },
    b: new SurfaceBody(mesh, dir, fwd),
    prompt() {
      return ch.active ? '' : `<kbd>E</kbd> Step inside ${label}`;
    },
    interact() {
      if (ch.active || arena.active) return;        // not mid-challenge, not already away
      // A room is a refuge. Rooms sit on real directions of the same sphere, so a
      // yokai already chasing you would otherwise walk in after you.
      if (hunter) endHunt(hunter, HUNT.rest);
      cameFrom = door.b.dir.clone();
      arena.enter(roomId, cameFrom);
      Sound.sfx('talk');
      showRoomFixtures(roomId, true);
    },
    update() {},            // everything in `npcs` is ticked; a door has nothing to do
  };
  doors.push(door);
  void room;
  return door;
}

/** The way out, standing just inside the door. */
function makeExit(roomId, label) {
  const room = ARENAS[roomId];
  const dir = room.spot(Math.PI, room.radius * 0.78);
  const mesh = makeNoren('#3b4a6b');
  arenaRoot.add(mesh);
  return {
    isDoor: true,
    roomId,
    m: mesh,
    def: { name: label, seal: '外' },
    b: new SurfaceBody(mesh, dir, randTangent(dir, mulberry32(0xD007))),
    prompt() { return '<kbd>E</kbd> Step back outside'; },
    interact() {
      showRoomFixtures(roomId, false);
      arena.exit();
      Sound.sfx('talk');
      cameFrom = null;
    },
    update() {},
  };
}

/* ------------------------- what is inside, and when ------------------------- */

/**
 * A room's own fixtures join `npcs` only while you are in it. They are positioned
 * in the room's own patch of the sphere, so they could never be reached from
 * outside, but leaving them in the list would still have the interaction system
 * measuring distances to them every frame.
 */
function showRoomFixtures(roomId, on) {
  const set = roomFixtures.get(roomId);
  if (!set) return;
  for (const f of set.all) {
    const i = set.into.indexOf(f);
    if (on && i < 0) set.into.push(f);
    else if (!on && i >= 0) set.into.splice(i, 1);
  }
  if (set.chest) set.chest.m.root.visible = true;
}

/**
 * Build both rooms' contents: an exit, and a chest holding a keepsake that is not
 * left lying outside. Drawn from its own stream, like everything else in a room.
 */
function furnishRooms(into) {
  roomFixtures.clear();
  const indoorItems = INDOOR_ITEMS;
  [['teahouse', 'the tea house'], ['pagodaRoom', 'the pagoda']].forEach(([id, label], i) => {
    const room = ARENAS[id];
    if (!room) return;
    const all = [makeExit(id, label)];
    let chest = null;
    const item = indoorItems[i];
    if (item) {
      const d = room.spot(2.1 + i, room.radius * 0.45);
      chest = makeChestFixture(`room-${id}`, item.id, d, randTangent(d, mulberry32(0xC4E5 + i)), arenaRoot);
      all.push(chest);
    }
    for (const f of all) if (f.b) f.b.sync();
    roomFixtures.set(id, { all, into, chest });
  });
}

/** Put the doors on the planet. Called from `spawnWorld`. */
function createDoors(into, places) {
  doors.length = 0;
  for (const p of places) {
    if (!p.dir) continue;
    const d = makeDoor(p.roomId, p.dir, p.fwd || randTangent(p.dir, mulberry32(0xD00 + p.roomId.length)), p.label);
    d.b.sync();
    into.push(d);
  }
  furnishRooms(into);
}

/** Leave any room we happen to be in — for quitting to the menu. */
function leaveRoom() {
  if (!indoors()) return false;
  const id = arena.active.id;
  showRoomFixtures(id, false);
  arena.exit();
  cameFrom = null;
  return true;
}

export { createDoors, doors, furnishRooms, indoors, leaveRoom, makeDoor, roomFixtures, showRoomFixtures };
