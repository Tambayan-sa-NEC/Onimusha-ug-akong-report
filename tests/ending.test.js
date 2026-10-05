/* Behaviour tests for the ending cutscene that plays once both great yokai are felled. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

async function fresh(seals = 5) {
  const g = await boot();
  const T = g.T;
  T.start('samurai');
  for (const h of T.hosts) h.chCd = 1e9;                 // nobody interrupts
  T.GAME_ORDER.slice(0, seals).forEach(k => T.won.add(k));
  T.buildSeals();
  return { g, T, els: g.els };
}
function atGate(T) {
  const pb = T.player.body;
  pb.dir.copy(T.GATE_DIR); pb.fixFwd(); pb.lift = 0; pb.grounded = true; pb.sync();
}
/** Fight the summoned boss to the finish and let the banner clear. */
function finishBoss(g, T, win = true) {
  const c = T.ch.active;
  if (win) { c.hp = 1; T.BOSS.hit(c, 9, 0, true); } else c.php = 0;
  g.run(5, 0.05, () => !!T.ch.active);
}
/** Win whatever challenge is running by forcing its result, then let it wrap up. */
function winChallenge(g, T) {
  T.ch.active.result = 'win';
  g.run(5, 0.05, () => !!T.ch.active);
}
/** Fell both bosses from the gate. */
function fellBothBosses(g, T) {
  for (let i = 0; i < 2; i++) { atGate(T); T.gate.interact(); finishBoss(g, T, true); }
}

/* ------------------------------------------------------------------ */

await test('felling both bosses rolls the ending', async () => {
  const { g, T, els } = await fresh(5);
  assert(!T.ending.active, 'no cutscene before the fights');
  fellBothBosses(g, T);
  eq(T.bossWon.size, 2, 'both bosses down');
  assert(T.ending.active, 'the ending is playing');
  assert(els('ending').classList.contains('show'), 'and its overlay is shown');
});

await test('the ending holds off until the second boss', async () => {
  const { g, T } = await fresh(5);
  atGate(T); T.gate.interact(); finishBoss(g, T, true);
  eq(T.bossWon.size, 1, 'one boss down');
  assert(!T.ending.active, 'one is not enough');
});

await test('a yokai cut down with the blade counts as a kill', async () => {
  const { g, T } = await fresh(0);
  const host = T.hosts.find(h => !h.def.boss);
  const before = T.slain.size;
  T.startChallenge(host, T.BATTLE);
  winChallenge(g, T);
  eq(T.slain.size, before + 1, 'the blade kill is tallied');
  assert(T.slain.has(host.def.id), 'and it is that very yokai');
});

await test('a mini-game win is peace, not a kill', async () => {
  const { g, T } = await fresh(0);
  const host = T.hosts.find(h => !h.def.boss);
  const kills = T.slain.size, seals = T.won.size;
  T.startChallenge(host);                 // its own mini-game, not a battle
  winChallenge(g, T);
  eq(T.slain.size, kills, 'no blood drawn');
  assert(T.won.size > seals, 'but a seal was still earned');
});

await test('the recap carries the real journey tally', async () => {
  const { g, T } = await fresh(5);
  const host = T.hosts.find(h => !h.def.boss);
  T.startChallenge(host, T.BATTLE);
  winChallenge(g, T);
  fellBothBosses(g, T);
  eq(T.ending.journey.slain, T.slain.size, 'kills match the tally');
  eq(T.ending.journey.seals, T.won.size, 'seals match the book');
  eq(T.ending.journey.bosses.length, 2, 'both great yokai are named');
});

await test('you can skip to the end of the cutscene', async () => {
  const { g, T } = await fresh(5);
  fellBothBosses(g, T);
  assert(T.ending.active, 'playing');
  T.endingKey('Escape');
  assert(!T.ending.active, 'Escape closes it');
});

await test('clicking through every panel returns you to the planet', async () => {
  const { g, T } = await fresh(5);
  fellBothBosses(g, T);
  const panels = T.ending.panels.length;
  assert(panels >= 3, 'a few panels of recap');
  for (let i = 0; i < panels + 1; i++) T.advanceEnding();
  assert(!T.ending.active, 'past the last panel, play resumes');
});

await test('the cutscene freezes your footsteps', async () => {
  const { g, T } = await fresh(5);
  fellBothBosses(g, T);
  const pb = T.player.body;
  const from = pb.dir.clone();
  g.press('KeyW'); g.press('ShiftLeft');
  g.run(0.6);
  assert(T.angleBetween(from, pb.dir) * T.R < 0.2, 'you hold still while it plays');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
