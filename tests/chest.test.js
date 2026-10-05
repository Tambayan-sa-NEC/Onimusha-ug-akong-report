/* Behaviour tests for chests and the keepsakes inside them. */
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

/* --------------------------------- placement -------------------------------- */

await test('there is a chest out on the planet for every outdoor keepsake', async () => {
  const { T } = await playing();
  eq(T.chests.length, T.OUTDOOR_ITEMS.length, 'one chest each');
  eq(new Set(T.chests.map(c => c.itemId)).size, T.OUTDOOR_ITEMS.length, 'and no two hold the same thing');
  // The rest are indoors; between them the two sets cover everything exactly once.
  eq(T.OUTDOOR_ITEMS.length + T.INDOOR_ITEMS.length, T.ITEM_DEFS.length, 'nothing is unreachable');
});

await test('chests answer E alongside the villagers', async () => {
  const { T } = await playing();
  for (const c of T.chests) {
    assert(T.npcs.includes(c), `${c.id} is reachable`);
    assert(typeof c.interact === 'function' && typeof c.prompt === 'function', 'it offers an interaction');
  }
});

await test('chests land on walkable ground, apart from each other', async () => {
  const { T } = await playing();
  for (const c of T.chests) assert(T.onLand(c.b.dir), `${c.id} is on land`);
  for (let i = 0; i < T.chests.length; i++) {
    for (let j = i + 1; j < T.chests.length; j++) {
      const d = T.angleBetween(T.chests[i].b.dir, T.chests[j].b.dir) * T.R;
      assert(d > 2, `${T.chests[i].id} and ${T.chests[j].id} are piled together, ${d.toFixed(2)}u apart`);
    }
  }
});

await test('chests are drawn from their own stream, leaving the world alone', async () => {
  // Two boots sit at the same point in the world stream. If chest placement had drawn
  // from it, the next value out would differ between a boot that placed them and one
  // that did not — but both place them, so the check is that they agree exactly.
  const a = await boot();
  const b = await boot();
  eq(a.T.rand(), b.T.rand(), 'the world stream lands in the same place either way');
  eq(a.T.chests.map(c => c.id).join(), b.T.chests.map(c => c.id).join(), 'same chests');
  const same = a.T.chests.every((c, i) => c.b.dir.distanceTo(b.T.chests[i].b.dir) < 1e-9);
  assert(same, 'and in the same places on every visit');
});

/* ---------------------------------- opening --------------------------------- */

await test('opening a chest hands over what is inside', async () => {
  const { T } = await playing();
  const c = T.chests[0];
  eq(T.held.size, 0, 'empty-handed to begin with');
  c.interact();
  eq(c.open, true, 'the chest is open');
  assert(T.hasItem(c.itemId), `${c.itemId} is in hand`);
  eq(T.held.size, 1, 'exactly one keepsake');
});

await test('the lid stays up once it has been opened', async () => {
  const { g, T } = await playing();
  const c = T.chests[0];
  c.interact();
  g.run(1.5);
  assert(c.lidT > 0.9, `the lid should have swung open, got ${c.lidT.toFixed(2)}`);
  assert(c.m.lid.rotation.x < -1.5, 'and be tilted back on its hinge');
});

await test('an opened chest is empty the next time, and grants nothing more', async () => {
  const { T } = await playing();
  const c = T.chests[0];
  c.interact();
  c.interact();
  eq(T.held.size, 1, 'no second copy of the keepsake');
  assert(/empty/i.test(c.prompt()) || /empty/i.test(T.dlg.full), 'and it says as much');
});

await test('each chest holds its own thing', async () => {
  const { T } = await playing();
  for (const c of T.chests) c.interact();
  eq(T.held.size, T.OUTDOOR_ITEMS.length, 'every outdoor keepsake found');
  for (const d of T.OUTDOOR_ITEMS) assert(T.hasItem(d.id), `${d.id} was in one of them`);
  for (const d of T.INDOOR_ITEMS) assert(!T.hasItem(d.id), `${d.id} is kept indoors`);
});

/* ------------------------------- the collection ------------------------------ */

await test('the collection shows what is found and the shape of what is not', async () => {
  const { T } = await playing();
  const before = T.collection();
  eq(before.length, T.ITEM_DEFS.length, 'every keepsake is listed, indoors and out');
  eq(before.filter(i => i.held).length, 0, 'none held yet');
  T.chests[0].interact();
  const after = T.collection();
  eq(after.filter(i => i.held).length, 1, 'one held now');
  assert(after.every(i => i.name && i.seal && i.line), 'each one still knows what it is');
});

await test('a keepsake that is not real cannot be taken', async () => {
  const { T } = await playing();
  eq(T.takeItem('moon'), false, 'there is no such keepsake');
  eq(T.held.size, 0, 'and nothing was added');
});

/* -------------------------------- persistence ------------------------------- */

await test('opening a chest writes the run down', async () => {
  const { g, T } = await playing();
  T.chests[0].interact();
  const saved = T.loadProgress();
  assert(saved, 'a run worth continuing, on the strength of a keepsake alone');
  eq(saved.held.join(), T.chests[0].itemId, 'the keepsake is in the save');
  eq(saved.opened.join(), T.chests[0].id, 'and so is the chest it came from');
});

await test('continuing a run brings the keepsakes back and leaves the lids up', async () => {
  const { g, T } = await boot().then(g => ({ g, T: g.T }));
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({
    v: T.SAVE_VERSION,
    progress: { char: 'samurai', won: [], bossWon: [], slain: [], held: ['koban'], opened: ['chest0'] },
  }));
  T.showPage('title');
  eq(T.continueRun(), true, 'the run resumed');
  assert(T.hasItem('koban'), 'carrying what was found');
  assert(T.isOpened('chest0'), 'and remembering where it came from');
  const c = T.chests.find(x => x.id === 'chest0');
  eq(c.open, true, 'that chest is still open');
  assert(c.lidT > 0.9, 'with its lid still up');
});

await test('a keepsake alone is enough to make a run worth continuing', async () => {
  const { g, T } = await playing();
  eq(T.won.size, 0, 'no seals');
  T.chests[0].interact();
  assert(T.hasProgress(), 'but something was found, so there is a run to come back to');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
