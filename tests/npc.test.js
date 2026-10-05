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
