/* Behaviour tests for the heads-up display: vitals, the seal book, and getting out of the way. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

async function menu() {
  const g = await boot();
  return { g, T: g.T, els: g.els };
}
async function playing(id = 'samurai') {
  const { g, T, els } = await menu();
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;
  g.run(0.1);
  return { g, T, els };
}
/** The hearts currently drawn, as a string like '♥♥♥♡♡'. */
const vitals = els => els('vitals').children.map(c => c.textContent).join('');
const shown = (els, id) => els(id).className.includes('show');
/** Stand the player `dist` units from a host, as the combat suites do. */
function placePlayer(T, host, dist) {
  const pb = T.player.body;
  for (let i = 0; i < 400; i++) {
    const d = T.offsetDir(host.b.dir, (i / 400) * 6.283, dist / T.R, new T.THREE.Vector3());
    if (!T.onLand(d)) continue;
    pb.dir.copy(d); pb.fixFwd(); pb.lift = 0; pb.vy = 0; pb.grounded = true; pb.sync();
    return;
  }
  throw new Error('test setup: no land near the host');
}

/* ---------------------------------- vitals ---------------------------------- */

await test('the vitals row is hidden on the select screen', async () => {
  const { g, els } = await menu();
  g.run(0.2);
  assert(!shown(els, 'vitals'), 'nothing to show before a character exists');
});

await test('starting a run puts the hearts up', async () => {
  const { els } = await playing('samurai');
  assert(shown(els, 'vitals'), 'the row is up');
  eq(vitals(els), '♥♥♥♥♥', 'the rōnin carries five');
});

await test('the kunoichi carries her own three', async () => {
  const { els } = await playing('shinobi');
  eq(vitals(els), '♥♥♥', 'three hearts');
});

await test('hearts are told apart by shape, not only by colour', async () => {
  const { g, T, els } = await playing('samurai');
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 2.5);
  T.startChallenge(host, T.BATTLE);
  T.player.inv = 0; T.ch.active.pinv = 0;
  T.BATTLE.hurtPlayer(T.ch.active);
  g.run(0.1);
  const row = vitals(els);
  assert(row.includes('♡'), `a spent heart is a different glyph, got "${row}"`);
  assert(row.includes('♥'), 'and a full one is still filled');
});

await test('the hearts follow the damage taken in a fight', async () => {
  const { g, T, els } = await playing('samurai');
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 2.5);
  T.startChallenge(host, T.BATTLE);
  g.run(0.1);
  eq(vitals(els), '♥♥♥♥♥', 'unhurt at the start');
  const c = T.ch.active;
  T.player.inv = 0; c.pinv = 0; T.BATTLE.hurtPlayer(c);
  T.player.inv = 0; c.pinv = 0; T.BATTLE.hurtPlayer(c);
  g.run(0.1);
  eq(vitals(els), '♥♥♥♡♡', 'two hearts spent');
});

await test('the hearts are full again once the fight is over', async () => {
  const { g, T, els } = await playing('samurai');
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 2.5);
  T.startChallenge(host, T.BATTLE);
  const c = T.ch.active;
  T.player.inv = 0; c.pinv = 0; T.BATTLE.hurtPlayer(c);
  g.run(0.1);
  assert(vitals(els).includes('♡'), 'hurt mid-fight');
  c.result = 'lose';
  g.run(4);                        // let the challenge resolve and tear down
  eq(T.ch.active, null, 'the fight is over');
  eq(vitals(els), '♥♥♥♥♥', 'and the hearts are whole again');
});

/* -------------------------------- the seal book ------------------------------- */

await test('a won seal is marked by more than its colour', async () => {
  const { T, els } = await playing('samurai');
  const first = T.GAME_ORDER[0];
  T.won.add(first);
  T.buildSeals();
  const box = els('seals');
  const cell = box.children[0];
  assert(cell.className.includes('won'), 'still carries the won class for styling');
  assert(cell.children.length > 0, 'and a mark that does not depend on colour');
  assert(cell.children.some(m => m.textContent === '✓'), 'a tick, specifically');
});

await test('an unwon seal carries no mark, and says what it is', async () => {
  const { els } = await playing('samurai');
  const cell = els('seals').children[0];
  eq(cell.children.length, 0, 'nothing marked yet');
  assert(cell.title && cell.title.length > 0, 'but it still names its challenge');
});

/* ----------------------------- getting out of the way ---------------------------- */

await test('the controls card bows out once you have been playing a while', async () => {
  const { g, T, els } = await playing('samurai');
  assert(!els('hint').className.includes('fade'), 'up at the start');
  assert(T.HINT_FADE_AFTER > 0, 'there is a stated delay');
  g.run(T.HINT_FADE_AFTER + 2);
  assert(els('hint').className.includes('fade'), 'and gone once you know the controls');
});

await test('the controls card is back when you return to the menu', async () => {
  const { g, T, els } = await playing('samurai');
  g.run(50);
  assert(els('hint').className.includes('fade'), 'faded while playing');
  T.quitToMenu();
  g.run(0.2);
  assert(!els('hint').className.includes('fade'), 'up again for the next run');
});

await test('the hud gets out of the way for the ending', async () => {
  const { g, T, els } = await playing('samurai');
  assert(shown(els, 'vitals'), 'hearts up while playing');
  T.playEnding({ char: 'The Rōnin', kanji: '侍', slain: 2, seals: 5, bosses: ['Ōtengu', 'Orochi'] });
  g.run(0.2);
  assert(!shown(els, 'vitals'), 'the hearts stand aside for the cutscene');
  assert(els('seals').className.includes('away'), 'and so does the seal book');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
