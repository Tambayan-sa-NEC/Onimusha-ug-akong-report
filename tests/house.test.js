/* Behaviour tests for the buildings you can walk into. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

async function playing(id = 'samurai') {
  const g = await boot();
  const T = g.T;
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;
  return { g, T, els: g.els };
}
const exitOf = (T, roomId) => T.roomFixtures.get(roomId).all.find(f => f.isDoor);
const chestOf = (T, roomId) => T.roomFixtures.get(roomId).chest;

/* ---------------------------------- the doors --------------------------------- */

await test('both buildings have a way in', async () => {
  const { T } = await playing();
  eq(T.doors.length, 2, 'two doors');
  const ids = T.doors.map(d => d.roomId).sort().join();
  eq(ids, 'pagodaRoom,teahouse', 'the tea house and the pagoda');
  for (const d of T.doors) {
    assert(T.npcs.includes(d), `${d.roomId} door answers E`);
    assert(/step inside/i.test(d.prompt()), `and says so: "${d.prompt()}"`);
  }
});

await test('a door stands where its building does', async () => {
  const { T } = await playing();
  const tea = T.doors.find(d => d.roomId === 'teahouse');
  assert(T.angleBetween(tea.b.dir, T.TEA_DIR) * T.R < 0.01, 'the tea house door is at the tea house');
});

/* --------------------------------- going in --------------------------------- */

await test('stepping inside swaps the planet for the room', async () => {
  const { g, T } = await playing();
  const door = T.doors.find(d => d.roomId === 'teahouse');
  eq(T.arena.active, null, 'outdoors to begin with');
  door.interact();
  assert(T.arena.active, 'somewhere else now');
  eq(T.arena.active.id, 'teahouse', 'in the tea house');
  eq(T.indoors(), true, 'and it counts as indoors, not a boss arena');
  eq(T.worldRoot.visible, false, 'the planet is out of sight');
  eq(T.arenaRoot.visible, true, 'the room is shown');
  g.run(0.3);
  assert(T.onLand(T.player.body.dir), 'standing on the room floor');
});

await test('the room has floor inside and nothing past the walls', async () => {
  const { T } = await playing();
  for (const id of ['teahouse', 'pagodaRoom']) {
    const room = T.ARENAS[id];
    assert(room.isRoom, `${id} is a room`);
    assert(room.height(room.centre) > T.WALK_MIN, `${id}: the middle is walkable`);
    assert(room.height(room.entry) > T.WALK_MIN, `${id}: so is the doorway`);
    const out = room.spot(0.4, room.radius + 2);
    assert(room.height(out) < T.WALK_MIN, `${id}: the floor stops at the wall`);
  }
});

await test('you cannot walk out through the wall', async () => {
  const { g, T } = await playing();
  T.doors.find(d => d.roomId === 'teahouse').interact();
  const room = T.ARENAS.teahouse, pb = T.player.body;
  const away = pb.dir.clone().sub(room.centre).normalize();
  pb.fwd.copy(away); pb.fixFwd(); pb.sync();
  T.cam.fwd.copy(pb.fwd);
  g.press('KeyW'); g.press('ShiftLeft');
  g.run(4);
  assert(T.angleBetween(pb.dir, room.centre) * T.R <= room.radius + 0.5, 'still inside');
});

/* -------------------------------- coming out -------------------------------- */

await test('there is a way out, and it puts you back where you came from', async () => {
  const { g, T } = await playing();
  const door = T.doors.find(d => d.roomId === 'teahouse');
  door.interact();
  g.run(0.3);
  const way = exitOf(T, 'teahouse');
  assert(way && /outside/i.test(way.prompt()), 'the exit offers itself');
  way.interact();
  eq(T.arena.active, null, 'back on the planet');
  eq(T.worldRoot.visible, true, 'and it is visible again');
  assert(T.angleBetween(T.player.body.dir, door.b.dir) * T.R < 0.5, 'standing in the doorway you came out of');
});

await test('quitting to the menu from indoors puts the planet back', async () => {
  const { g, T } = await playing();
  T.doors.find(d => d.roomId === 'pagodaRoom').interact();
  assert(T.indoors(), 'inside');
  g.press('Escape');
  T.quitToMenu();
  eq(T.arena.active, null, 'the room was left behind');
  eq(T.worldRoot.visible, true, 'the planet is back');
  eq(T.started, false, 'and we are on the menu');
});

/* ---------------------------- what is in the room ---------------------------- */

await test('a room keeps its own fixtures out of the way until you are in it', async () => {
  const { T } = await playing();
  const way = exitOf(T, 'teahouse');
  assert(!T.npcs.includes(way), 'the exit is not reachable from outside');
  T.doors.find(d => d.roomId === 'teahouse').interact();
  assert(T.npcs.includes(way), 'and is once you are inside');
  way.interact();
  assert(!T.npcs.includes(way), 'and is put away again on the way out');
});

await test('each room holds a keepsake that is not left lying outdoors', async () => {
  const { T } = await playing();
  const inside = ['teahouse', 'pagodaRoom'].map(id => chestOf(T, id)).filter(Boolean);
  eq(inside.length, 2, 'a chest in each room');
  const outdoors = new Set(T.chests.map(c => c.itemId));
  for (const c of inside) {
    assert(!outdoors.has(c.itemId), `${c.itemId} is only found indoors`);
  }
});

await test('the indoor chest hands over its keepsake like any other', async () => {
  const { T } = await playing();
  T.doors.find(d => d.roomId === 'teahouse').interact();
  const c = chestOf(T, 'teahouse');
  eq(T.held.size, 0, 'empty-handed');
  c.interact();
  assert(T.hasItem(c.itemId), 'and now carrying what was in the tea house');
});

/* ---------------------------- a room is a refuge ---------------------------- */

await test('stepping inside calls off a yokai that was chasing you', async () => {
  const { g, T } = await playing();
  const host = T.hosts.find(h => h.def && h.def.aggro);
  assert(host, 'there are yokai that give chase');
  T.startHunt(host);
  assert(T.hunter, 'one is after you');
  T.doors.find(d => d.roomId === 'teahouse').interact();
  eq(T.hunter, null, 'and gives up at the door');
  assert(T.indoors(), 'you are inside');
});

await test('nothing out on the planet is in reach while you are indoors', async () => {
  const { g, T } = await playing();
  // Stand a yokai exactly where the room is, which the sphere allows.
  const host = T.hosts.find(h => h.def && h.def.game);
  const room = T.ARENAS.teahouse;
  T.doors.find(d => d.roomId === 'teahouse').interact();
  host.b.dir.copy(room.centre); host.b.fixFwd(); host.b.sync();
  host.chCd = 0; host.announced = true;
  g.run(0.5);
  eq(T.ch.active, null, 'it cannot challenge you through the wall');
  const p = T.promptBox.label;
  assert(!p || !p.includes(host.def.name), `the prompt should not offer it, said "${p}"`);
});

await test('the room chest is reachable indoors, and the outdoor ones are not', async () => {
  const { g, T } = await playing();
  const room = T.ARENAS.teahouse;
  const outside = T.chests[0];
  T.doors.find(d => d.roomId === 'teahouse').interact();
  outside.b.dir.copy(room.centre); outside.b.sync();   // even sitting in the same place
  g.run(0.4);
  const p = T.promptBox.label || '';
  assert(!/Open the chest/.test(p) || T.roomFixtures.get('teahouse').chest.b.dist(T.player.body.obj.position) < 3,
    'an outdoor chest is not offered from inside');
});

/* -------------------------------- good manners ------------------------------- */

await test('a door will not open in the middle of a challenge', async () => {
  const { T } = await playing();
  const host = T.hosts.find(h => h.def.game === 'shell');
  T.startChallenge(host, T.GAMES.shell);
  T.doors[0].interact();
  eq(T.arena.active, null, 'the challenge keeps you where you are');
  eq(T.doors[0].prompt(), '', 'and the door does not even offer');
});

await test('rooms are built from their own stream, leaving the world alone', async () => {
  const a = await boot();
  const b = await boot();
  a.T.ARENAS.teahouse.build();
  a.T.ARENAS.pagodaRoom.build();
  eq(a.T.rand(), b.T.rand(), 'the world stream is left exactly where it was');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
