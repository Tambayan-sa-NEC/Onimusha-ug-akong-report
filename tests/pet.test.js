/* Behaviour tests for companions: who walks with you, and what they do. */
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
/** A wandering cat or dog that is not already someone's companion. */
const stray = T => T.critters.find(c => c.tameable && c.kind);

/* ------------------------------ who comes along ----------------------------- */

await test('the rōnin walks with his wolf', async () => {
  const { T } = await playing('samurai');
  assert(T.pet.animal, 'somebody is with him');
  eq(T.pet.animal, T.wolf, 'and it is the wolf');
  eq(T.petKind(T.pet.animal), 'wolf', 'read as a wolf');
  eq(T.petName(T.pet.animal), 'Kuro', 'who has a name');
});

await test('the kunoichi is no longer made to walk alone', async () => {
  const { T } = await playing('shinobi');
  assert(T.pet.animal, 'she has company too');
  eq(T.petKind(T.pet.animal), 'cat', 'a cat, which is not a wolf');
  eq(T.wolf, null, 'and still no wolf, which was never hers');
  assert(T.critters.includes(T.pet.animal), 'the cat is on the planet with everything else');
});

await test('a companion keeps up instead of losing interest', async () => {
  const { g, T } = await playing('shinobi');
  const cat = T.pet.animal, pb = T.player.body;
  const far = T.offsetDir(pb.dir, 0.7, 11 / T.R, new T.THREE.Vector3());
  if (T.onLand(far)) { pb.dir.copy(far); pb.fixFwd(); pb.sync(); }
  const start = T.angleBetween(cat.b.dir, pb.dir) * T.R;
  g.run(6);
  const end = T.angleBetween(cat.b.dir, pb.dir) * T.R;
  assert(end < start, `the cat should close in: ${start.toFixed(2)}u -> ${end.toFixed(2)}u`);
  eq(cat.state, 'follow', 'and stay interested');
});

/* ------------------------------- befriending -------------------------------- */

await test('a stray offers to be talked round', async () => {
  const { T } = await playing('samurai');
  const c = stray(T);
  assert(c, 'there are animals about');
  assert(/befriend/i.test(c.prompt()), `it offers: "${c.prompt()}"`);
});

await test('befriending a stray makes it follow you', async () => {
  const { g, T } = await playing('samurai');
  const c = stray(T);
  c.interact();
  eq(T.pet.animal, c, 'it is yours now');
  eq(c.tame, true, 'and tame');
  g.run(2);
  eq(c.state, 'follow', 'following you about');
});

await test('you walk with one companion, not a procession', async () => {
  const { T } = await playing('samurai');
  const first = T.pet.animal;
  const c = stray(T);
  c.interact();
  eq(T.pet.animal, c, 'the new one is with you');
  eq(first.tame, false, 'and the old one is released');
  eq(T.critters.filter(a => a.tame).length, 1, 'exactly one tame animal');
});

await test('a released companion goes back to its own business', async () => {
  const { g, T } = await playing('samurai');
  const wolf = T.pet.animal;
  stray(T).interact();
  g.run(3);
  assert(wolf.state !== 'follow' || !wolf.tame, 'the wolf is no longer bound to your heel');
});

await test('greeting the animal already with you does not re-befriend it', async () => {
  const { T } = await playing('samurai');
  const mine = T.pet.animal;
  assert(/is with you/i.test(mine.prompt()), `it greets instead: "${mine.prompt()}"`);
  mine.interact();
  eq(T.pet.animal, mine, 'still the same companion');
});

await test('a yokai on the hunt is not somebody to befriend', async () => {
  const { T } = await playing('samurai');
  const c = stray(T);
  c.hunting = true;
  eq(c.tameable, false, 'not while it is charging you');
  eq(c.prompt(), '', 'and it offers nothing');
});

/* -------------------------------- reactions --------------------------------- */

await test('the companion is pleased when a seal is won', async () => {
  const { T } = await playing('samurai');
  eq(T.cheer('seal'), true, 'it reacts');
});

await test('cheering with nobody along is harmless', async () => {
  const { T } = await playing('samurai');
  T.release();
  eq(T.pet.animal, null, 'walking alone');
  eq(T.cheer('seal'), false, 'and nothing happens, rather than throwing');
});

/* ------------------------------- persistence -------------------------------- */

await test('who you walk with is written down', async () => {
  const { T } = await playing('samurai');
  const c = stray(T);
  c.interact();
  T.won.add(T.GAME_ORDER[0]);
  T.recordProgress();
  eq(T.loadProgress().pet, c.id, 'the save names your companion');
});

await test('continuing a run brings your companion back', async () => {
  const { g, T } = await boot().then(g => ({ g, T: g.T }));
  // Pick a stray that will exist again on the next visit, since the world is seeded.
  const target = T.critters.find(c => c.tameable && c.id && c.id !== 'wolf');
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({
    v: T.SAVE_VERSION,
    progress: { char: 'samurai', won: ['shell'], bossWon: [], slain: [], held: [], opened: [], pet: target.id },
  }));
  T.showPage('title');
  eq(T.continueRun(), true, 'the run resumed');
  assert(T.pet.animal, 'with company');
  eq(T.pet.animal.id, target.id, 'the same animal as before');
});

await test('a save naming an animal that is not there leaves you with the default', async () => {
  const { g, T } = await boot().then(g => ({ g, T: g.T }));
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({
    v: T.SAVE_VERSION,
    progress: { char: 'samurai', won: ['shell'], bossWon: [], slain: [], held: [], opened: [], pet: 'dragon7' },
  }));
  T.showPage('title');
  T.continueRun();
  eq(T.pet.animal, T.wolf, 'the rōnin still has his wolf');
});

/* ------------------------------ staying out of it ---------------------------- */

await test('a companion does not join the fight', async () => {
  const { T } = await playing('samurai');
  const mine = T.pet.animal;
  assert(!T.hosts.includes(mine), 'not a challenge host');
  assert(!mine.def, 'no challenge definition');
  assert(!mine.col, 'and nothing solid to body-block with');
  eq(T.playerHP(), 5, 'the rōnin still brings exactly five hearts');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
