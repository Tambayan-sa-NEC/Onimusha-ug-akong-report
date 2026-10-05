/* Behaviour tests for the villagers: their walking, and what they say when. */
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
  return { g, T };
}
/**
 * Villagers are the NPCs with no challenge of their own. The sealed gate also lives
 * in `npcs` so that E reaches it, but it is a plain object, not an NPC.
 */
const villagers = T => T.npcs.filter(n => n.def && !n.def.game && typeof n.linesNow === 'function');

/* ---------------------------------- walking --------------------------------- */

await test('every villager has somewhere to walk', async () => {
  const { T } = await playing();
  const still = villagers(T).filter(n => !(n.wander > 0));
  eq(still.length, 0, `villagers rooted to the spot: ${still.map(n => n.def.id).join(', ')}`);
});

await test('a villager left alone actually moves', async () => {
  const { g, T } = await playing();
  // Someone far enough away not to stop and greet the player.
  const far = villagers(T)
    .map(n => ({ n, d: n.b.dist(T.player.body.obj.position) }))
    .sort((a, b) => b.d - a.d)[0].n;
  const from = far.b.dir.clone();
  g.run(25);
  const moved = T.angleBetween(from, far.b.dir) * T.R;
  assert(moved > 0.5, `${far.def.id} should have wandered, moved ${moved.toFixed(2)}u`);
});

await test('a villager stays near the place it belongs', async () => {
  const { g, T } = await playing();
  const far = villagers(T)
    .map(n => ({ n, d: n.b.dist(T.player.body.obj.position) }))
    .sort((a, b) => b.d - a.d)[0].n;
  g.run(60);
  const strayed = T.angleBetween(far.b.dir, far.home);
  assert(strayed <= far.wander + 0.08,
    `${far.def.id} wandered off: ${strayed.toFixed(3)} rad vs a leash of ${far.wander}`);
});

/* --------------------------------- chapters --------------------------------- */

await test('the chapter follows how far the journey has got', async () => {
  const { T } = await playing();
  eq(T.chapter(), 'start', 'nothing won yet');
  T.won.add(T.GAME_ORDER[0]);
  eq(T.chapter(), 'midway', 'something won');
  for (const k of T.GAME_ORDER.slice(0, T.SEALS_FOR_GATE)) T.won.add(k);
  eq(T.chapter(), 'gate', 'enough for the gate');
  for (const b of T.BOSS_ORDER) T.bossWon.add(b.id);
  eq(T.chapter(), 'done', 'both great yokai felled');
});

await test('a line bound to a chapter is only offered in that chapter', async () => {
  const { T } = await playing();
  const who = T.npcs.find(n => n.def && n.def.id === 'kenji');
  assert(who, 'Kenji is on the planet');
  const bound = who.def.lines.filter(l => l[3]);
  assert(bound.length > 0, 'he has lines tied to a chapter');

  const atStart = who.linesNow();
  assert(atStart.every(l => !l[3] || l[3] === 'start'), 'only start lines at the start');
  assert(!atStart.some(l => l[3] === 'done'), 'nothing from the end of the story');

  for (const b of T.BOSS_ORDER) T.bossWon.add(b.id);
  const atEnd = who.linesNow();
  assert(atEnd.some(l => l[3] === 'done'), 'the closing line is available once it is true');
  assert(!atEnd.some(l => l[3] === 'start'), 'and the opening one is not');
});

await test('an NPC with no line for this chapter still has something to say', async () => {
  const { T } = await playing();
  for (const n of villagers(T)) {
    for (const ch of ['start', 'midway', 'gate', 'done']) {
      T.won.clear(); T.bossWon.clear();
      if (ch === 'midway') T.won.add(T.GAME_ORDER[0]);
      if (ch === 'gate') for (const k of T.GAME_ORDER.slice(0, T.SEALS_FOR_GATE)) T.won.add(k);
      if (ch === 'done') for (const b of T.BOSS_ORDER) T.bossWon.add(b.id);
      assert(n.linesNow().length > 0, `${n.def.id} runs dry in chapter ${ch}`);
    }
  }
});

/* ---------------------------------- errands --------------------------------- */

const asker = (T, id) => T.npcs.find(n => n.def && n.def.id === id);

await test('some villagers ask you for something', async () => {
  const { T } = await playing();
  const withErrand = villagers(T).filter(n => n.def.errand);
  assert(withErrand.length >= 2, `at least a couple have an errand, got ${withErrand.length}`);
  for (const n of withErrand) {
    const e = n.def.errand;
    assert(T.ITEMS[e.wants], `${n.def.id} wants a real keepsake`);
    assert(T.ITEMS[e.gives], `${n.def.id} gives a real one`);
    assert(e.ask && e.thanks && e.done, `${n.def.id} has all three lines`);
  }
});

await test('what an errand gives is not lying about in a chest', async () => {
  const { T } = await playing();
  const inChests = new Set(T.chests.map(c => c.itemId));
  for (const d of T.ERRAND_ITEMS) {
    assert(!inChests.has(d.id), `${d.id} is only ever given, never found`);
    assert(!T.OUTDOOR_ITEMS.includes(d) && !T.INDOOR_ITEMS.includes(d), `${d.id} is in neither pile`);
  }
});

await test('empty-handed, the villager asks rather than rewards', async () => {
  const { T } = await playing();
  const who = asker(T, 'goro');
  assert(who, 'Goro is on the planet');
  const line = who.errandLine();
  eq(line[0], who.def.errand.ask, 'he asks');
  eq(T.held.size, 0, 'and nothing changes hands');
  eq(T.didErrand('goro'), false, 'the errand is still open');
});

await test('showing the keepsake settles the errand and is repaid', async () => {
  const { T } = await playing();
  const who = asker(T, 'goro');
  const e = who.def.errand;
  T.takeItem(e.wants);
  const line = who.errandLine();
  assert(line[0].startsWith(e.thanks), 'he is pleased');
  assert(T.hasItem(e.gives), 'and gives you his own keepsake');
  eq(T.didErrand('goro'), true, 'the errand is settled');
});

await test('the keepsake you showed is not taken off you', async () => {
  const { T } = await playing();
  const who = asker(T, 'goro');
  T.takeItem(who.def.errand.wants);
  who.errandLine();
  assert(T.hasItem(who.def.errand.wants), 'you keep what you brought');
  eq(T.held.size, 2, 'and are two keepsakes up');
});

await test('a settled errand is not paid twice', async () => {
  const { T } = await playing();
  const who = asker(T, 'goro');
  T.takeItem(who.def.errand.wants);
  who.errandLine();
  const before = T.held.size;
  for (let i = 0; i < 10; i++) who.errandLine();
  eq(T.held.size, before, 'no second reward');
});

await test('a settled errand is mentioned, not laboured', async () => {
  const { T } = await playing();
  const who = asker(T, 'goro');
  T.takeItem(who.def.errand.wants);
  who.errandLine();
  let mentions = 0, quiet = 0;
  for (let i = 0; i < 60; i++) (who.errandLine() ? mentions++ : quiet++);
  assert(mentions > 0, 'he brings it up sometimes');
  assert(quiet > 0, 'but not every single time');
});

await test('settling an errand writes the run down', async () => {
  const { T } = await playing();
  const who = asker(T, 'goro');
  T.takeItem(who.def.errand.wants);
  who.interact();
  const saved = T.loadProgress();
  assert(saved, 'a run worth continuing');
  assert(saved.errands.includes('goro'), 'with the errand remembered');
});

/* --------------------------------- gestures --------------------------------- */

await test('the villagers have more to do than bow and wave', async () => {
  const { T } = await playing();
  for (const a of ['nod', 'laugh', 'stretch', 'ponder', 'sweep']) {
    assert(T.ACTION_DUR[a] > 0, `${a} is a real gesture`);
  }
  assert(T.GENTLE_ACTIONS.filter(Boolean).length >= 4, 'and the idle set draws on several');
});

await test('a new gesture actually moves the model and then lets go', async () => {
  const { T } = await playing();
  const who = villagers(T)[0];
  T.startAction(who.h, 'stretch');
  T.applyAction(who.h, 0.9);                 // halfway through
  assert(who.h.arms[0].rotation.x < -0.5, 'arms go up');
  T.applyAction(who.h, 2);                   // past the end
  eq(who.h.action, null, 'and the gesture finishes');
});

await test('the villagers do not all look the same', async () => {
  const { T } = await playing();
  const looks = villagers(T).map(n => JSON.stringify(n.def.look));
  eq(new Set(looks).size, looks.length, 'every villager has their own look');
  const extras = villagers(T).filter(n => n.def.look.scarf || n.def.look.apron || n.def.look.pack);
  assert(extras.length >= 2, `some wear the newer pieces, got ${extras.length}`);
});

/* ----------------------------------- hints ---------------------------------- */

await test('some villagers know things worth passing on', async () => {
  const { T } = await playing();
  assert(villagers(T).some(n => n.def.hints), 'at least one villager gives hints');
});

await test('a hint names something still unplayed', async () => {
  const { T } = await playing();
  const hint = T.hintLine();
  assert(hint, 'there is a hint to give');
  const left = Object.keys(T.GAMES).filter(k => !T.won.has(k));
  assert(left.some(k => hint[0].includes(T.GAMES[k].title)),
    `the hint should name an unplayed game, said: "${hint[0]}"`);
});

await test('a hint never sends you somewhere you have already been', async () => {
  const { T } = await playing();
  const all = Object.keys(T.GAMES);
  for (const k of all.slice(0, all.length - 1)) T.won.add(k);
  const last = all[all.length - 1];
  for (let i = 0; i < 25; i++) {
    const hint = T.hintLine();
    if (!hint) continue;
    assert(hint[0].includes(T.GAMES[last].title), `should only name the one left, said: "${hint[0]}"`);
  }
});

await test('with every game won the hint points at the gate instead', async () => {
  const { T } = await playing();
  for (const k of Object.keys(T.GAMES)) T.won.add(k);
  eq(T.unwonGame(), null, 'nothing left to play');
  const hint = T.hintLine();
  assert(hint && /gate/i.test(hint[0]), `should point at the gate, said: "${hint && hint[0]}"`);
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
