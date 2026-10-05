/* Behaviour tests for the sealed gate and the two great yokai behind it. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

async function fresh(seals = 0) {
  const g = await boot();
  const T = g.T;
  T.start('samurai');
  for (const h of T.hosts) h.chCd = 1e9;                 // nobody interrupts the gate tests
  T.GAME_ORDER.slice(0, seals).forEach(k => T.won.add(k));
  T.buildSeals();
  return { g, T, els: g.els };
}
/** Stand the player under the gate. */
function atGate(T) {
  const pb = T.player.body;
  pb.dir.copy(T.GATE_DIR); pb.fixFwd(); pb.lift = 0; pb.grounded = true; pb.sync();
}
/** Stand the player a few paces from a summoned boss. */
function standBy(T, host, dist = 4) {
  const pb = T.player.body;
  for (let i = 0; i < 400; i++) {
    const d = T.offsetDir(host.b.dir, (i / 400) * 6.283, dist / T.R, new T.THREE.Vector3());
    if (T.onLand(d)) { pb.dir.copy(d); pb.fixFwd(); pb.lift = 0; pb.vy = 0; pb.grounded = true; pb.sync(); return; }
  }
  throw new Error('test setup: no land beside the boss');
}
/** Fight to the finish and let the result banner clear. */
function finishFight(g, T, win) {
  const c = T.ch.active;
  if (win) { c.hp = 1; T.BOSS.hit(c, 9, 0, true); } else c.php = 0;
  g.run(5, 0.05, () => !!T.ch.active);
}

/* ------------------------------------------------------------------ */

await test('the gate starts sealed and says how many seals are short', async () => {
  const { T } = await fresh(2);
  eq(T.gate.lit, false, 'not lit');
  eq(T.gateOpen(), false, 'not open at 2 seals');
  assert(/3 more seals/.test(T.gate.prompt()), `prompt should count down, got "${T.gate.prompt()}"`);
});

await test('the last seal is announced in the singular', async () => {
  const { T } = await fresh(4);
  assert(/1 more seal$/.test(T.gate.prompt()), `got "${T.gate.prompt()}"`);
});

await test('a sealed gate turns you away and summons nothing', async () => {
  const { g, T, els } = await fresh(3);
  atGate(T);
  T.gate.interact();
  assert(!T.ch.active, 'no fight should start');
  eq(T.bosses.length, 0, 'nothing summoned');
  g.run(1.5);
  assert(/Five seals open this gate/.test(els('dtext').textContent), 'should explain the requirement');
});

await test('five seals ignite the gate', async () => {
  const { g, T } = await fresh(4);
  eq(T.gate.lit, false, 'still sealed at four');
  T.won.add(T.GAME_ORDER[4]);                            // the fifth seal
  g.run(0.2);
  eq(T.gate.lit, true, 'the gate should ignite');
  eq(T.gateOpen(), true, 'and report open');
  assert(T.gate.m.ofuda.every(o => !o.visible), 'the ofuda should burn away');
});

await test('the seal row shows the tally and both boss slots', async () => {
  const { T, els } = await fresh(5);
  const spans = els('seals').children;
  const tally = spans.find(s => s.className.includes('tally'));
  assert(tally, 'a tally slot exists');
  eq(tally.textContent, '5/5', 'tally text');
  assert(tally.className.includes('lit'), 'tally lights up at five');
  const bossSlots = spans.filter(s => s.className.includes('boss'));
  eq(bossSlots.length, 2, 'two boss slots');
  eq(bossSlots.map(s => s.textContent).join(''), '天蛇', 'the tengu and the serpent');
  assert(bossSlots.every(s => !s.className.includes('won')), 'neither felled yet');
});

await test('pressing E at a lit gate calls out the Otengu', async () => {
  const { g, T, els } = await fresh(5);
  atGate(T);
  g.run(0.2);
  g.press('KeyE');
  g.step();
  assert(T.ch.active, 'a fight should start');
  eq(T.ch.active.g, T.BOSS, 'it is a boss fight');
  eq(T.ch.active.host.def.id, 'otengu', 'the tengu comes first');
  eq(T.bosses.length, 1, 'one boss on the planet');
  assert(T.hosts.includes(T.ch.active.host), 'targetable by the sword');
  assert(els('bossBar').className.includes('show'), 'health bar shown');
});

await test('the boss takes a second wind at half health', async () => {
  const { g, T } = await fresh(5);
  T.gate.interact();
  const c = T.ch.active;
  eq(c.rage, false, 'calm to begin with');
  const windBefore = c.st.windup;
  c.hp = Math.floor(c.st.hp / 2);
  g.run(0.2);
  eq(c.rage, true, 'should enrage');
  assert(c.st.windup < windBefore, `windups should shorten: ${windBefore} -> ${c.st.windup}`);
  eq(c.st.moves.join(','), c.host.def.rage.moves.join(','), 'rage move set applied');
});

await test('felling a boss marks its seal and takes it off the planet', async () => {
  const { g, T, els } = await fresh(5);
  T.gate.interact();
  const host = T.ch.active.host;
  const cols = T.colliders.length;
  finishFight(g, T, true);
  assert(T.bossWon.has('otengu'), 'boss seal recorded');
  eq(T.bosses.length, 0, 'removed from the boss list');
  assert(!T.hosts.includes(host), 'removed from sword targets');
  eq(T.colliders.length, cols - 1, 'its collider is released');
  assert(!els('bossBar').className.includes('show'), 'health bar hidden');
  const slot = els('seals').children.filter(s => s.className.includes('boss'))[0];
  assert(slot.className.includes('won'), 'the 天 slot should fill in');
});

await test('the gate then calls the Orochi', async () => {
  const { g, T } = await fresh(5);
  T.gate.interact();
  finishFight(g, T, true);
  eq(T.gate.nextBoss().id, 'orochi', 'serpent is next');
  T.gate.interact();
  assert(T.ch.active, 'second fight starts');
  eq(T.ch.active.host.def.id, 'orochi', 'against the orochi');
  eq(T.ch.active.host.m.necks.length, 8, 'eight necks');
});

await test('losing costs you the seal but not the rematch', async () => {
  const { g, T } = await fresh(5);
  T.gate.interact();
  finishFight(g, T, false);
  eq(T.bossWon.size, 0, 'no seal awarded');
  eq(T.bosses.length, 0, 'the boss still leaves');
  eq(T.gate.nextBoss().id, 'otengu', 'the tengu is still owed a rematch');
  T.gate.interact();
  assert(T.ch.active && T.ch.active.host.def.id === 'otengu', 'can be called again');
});

await test('with both felled the gate falls quiet', async () => {
  const { g, T, els } = await fresh(5);
  for (let i = 0; i < 2; i++) { T.gate.interact(); finishFight(g, T, true); }
  eq(T.bossWon.size, 2, 'both seals');
  eq(T.gate.nextBoss(), undefined, 'nothing left to call');
  atGate(T);
  T.gate.interact();
  assert(!T.ch.active, 'no third fight');
  g.run(1.5);
  assert(/quiet now/.test(els('dtext').textContent), 'it should say so');
});

await test("the Orochi's heads strike three times in a row", async () => {
  const { g, T } = await fresh(5);
  T.gate.interact(); finishFight(g, T, true);            // clear the tengu
  T.gate.interact();
  const c = T.ch.active;
  standBy(T, c.host, 4);
  c.st.moves = ['heads'];
  c.next = 0;
  const counts = new Set();
  g.run(20, 0.02, () => { if (c.move === 'heads') counts.add(c.heads); return !c.result && counts.size < 4; });
  assert(!c.result, 'the fight should still be running');
  eq([...counts].sort().join(','), '0,1,2,3', 'should count 3 -> 0 across the sequence');
  g.run(1, 0.02, () => c.phase === 'strike');          // ride out the last lunge
  eq(c.phase, 'recover', 'and finish wide open');
});

await test("the Otengu's dive lands on the marked ground", async () => {
  const { g, T } = await fresh(5);
  T.gate.interact();
  const c = T.ch.active, host = c.host;
  standBy(T, host, 5);
  c.st.moves = ['swoop'];
  c.next = 0;
  g.run(10, 0.02, () => !c.result && !(c.phase === 'windup' && c.move === 'swoop'));
  eq(c.move, 'swoop', 'winding up a dive');
  const spot = c.spot.clone();
  let maxLift = 0;
  g.run(3, 0.02, () => { maxLift = Math.max(maxLift, host.b.lift); return c.phase === 'windup'; });
  assert(maxLift > 0.2, `should rise before diving, peak lift ${maxLift.toFixed(2)}`);
  assert(T.angleBetween(host.b.dir, spot) * T.R < 0.2, 'should come down on the marked spot');
  assert(host.b.lift < 0.2, 'and be back on the ground');
});

await test('bosses never hunt and are never offered as a mini-game', async () => {
  const { g, T } = await fresh(5);
  T.gate.interact();
  const host = T.ch.active.host;
  assert(!host.def.aggro, 'no aggro flag');
  assert(host.chCd > 1e8, 'excluded from challenge prompts');
  T.ch.active.result = 'lose';
  g.run(4);
  eq(T.hunter, null, 'no hunting from a boss');
});

await test('the celebration waits for the bosses', async () => {
  const { g, T } = await fresh(0);
  T.GAME_ORDER.forEach(k => T.won.add(k));               // every mini-game seal
  g.run(0.2);
  T.gate.interact();
  finishFight(g, T, true);                               // one boss down, one to go
  eq(T.finishChallenge.celebrated, undefined, 'not yet');
  T.gate.interact();
  finishFight(g, T, true);
  eq(T.finishChallenge.celebrated, true, 'now the planet celebrates');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
