/* Behaviour tests for the yokai chase AI, run against the real game in a fake browser. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

/** Fresh game, started, with every host but `keep` made un-huntable. */
async function fresh(pickHost) {
  const g = await boot();
  g.T.start('samurai');
  const host = pickHost(g.T);
  assert(host, 'test setup: no matching host found');
  for (const h of g.T.hosts) if (h !== host) h.chCd = 1e9;   // isolate: only `host` may hunt
  return { g, T: g.T, host };
}
const byGame = key => T => T.hosts.find(h => h.def.game === key);

/** Teleport the player to `dist` world units from the host, on walkable ground. */
function placePlayer(T, host, dist) {
  const pb = T.player.body;
  for (let i = 0; i < 400; i++) {
    const d = T.offsetDir(host.b.dir, (i / 400) * 6.283, dist / T.R, new T.THREE.Vector3());
    if (T.onLand(d)) { pb.dir.copy(d); pb.fixFwd(); pb.lift = 0; pb.vy = 0; pb.grounded = true; pb.sync(); return true; }
  }
  throw new Error(`test setup: no land ${dist}u from ${host.def.name}`);
}
const gap = (T, host) => T.angleBetween(T.player.body.dir, host.b.dir) * T.R;

/* ------------------------------------------------------------------ */

await test('exactly the six fighters are marked aggro', async () => {
  const { T } = await fresh(byGame('tag'));
  const aggro = new Set(), polite = new Set();
  for (const h of T.hosts) (h.def.aggro ? aggro : polite).add(h.def.game);
  eq([...aggro].sort().join(','), 'gather,iai,race,stomp,sumo,tag', 'hunters');
  eq([...polite].sort().join(','), 'memory,rhythm,riddle,shell', 'polite yokai');
});

await test('a hunter notices the player and gives chase', async () => {
  const { g, T, host } = await fresh(byGame('iai'));   // Aka-oni
  placePlayer(T, host, 6);
  eq(T.hunter, null, 'nobody hunting at first');
  g.run(1.5);
  eq(T.hunter, host, 'Aka-oni should be hunting');
  eq(host.hunt.state, 'chase', 'state after the alert beat');
  assert(host.hunting === true, 'host.hunting flag set');
  assert(host.huntGait > 0, 'chase gait set');
});

await test('a polite yokai never hunts, however close you stand', async () => {
  const { g, T, host } = await fresh(byGame('riddle'));   // Rokurokubi
  placePlayer(T, host, 2.5);
  g.run(8);
  eq(T.hunter, null, 'no hunt started');
  eq(host.hunt.state, 'calm', 'stayed calm');
  assert(!T.ch.active, 'no battle forced');
});

await test('a hunter closes the gap', async () => {
  const { g, T, host } = await fresh(byGame('iai'));
  placePlayer(T, host, 7);
  const before = gap(T, host);
  g.run(1.5);                      // let it finish alerting and start moving
  const mid = gap(T, host);
  g.run(1.0);
  assert(gap(T, host) < mid && mid <= before + 0.2,
    `distance should shrink: ${before.toFixed(2)} -> ${mid.toFixed(2)} -> ${gap(T, host).toFixed(2)}`);
});

await test('catching the player starts a battle', async () => {
  const { g, T, host } = await fresh(byGame('iai'));
  placePlayer(T, host, 4);
  g.run(6, 0.05, () => !T.ch.active);
  assert(T.ch.active, 'a challenge should have started');
  eq(T.ch.active.g, T.BATTLE, 'it should be the battle, not a mini-game');
  eq(T.ch.active.host, host, 'against the hunter');
  eq(T.hunter, null, 'hunt slot released');
  assert(host.busy === true, 'host marked busy');
});

await test('pressing E mid-chase opens the mini-game instead of a fight', async () => {
  const { g, T, host } = await fresh(byGame('iai'));
  placePlayer(T, host, 7);
  g.run(1.5);
  eq(T.hunter, host, 'should be mid-chase');
  assert(gap(T, host) > T.HUNT.contact, 'still out of contact range');
  g.press('KeyE');
  g.step();
  assert(T.ch.active, 'E should have started something');
  eq(T.ch.active.g, T.GAMES[host.def.game], 'should be its mini-game');
  assert(T.ch.active.g !== T.BATTLE, 'should not be a battle');
  g.step();
  eq(T.hunter, null, 'the hunt is called off');
  assert(host.hunting === false, 'hunting flag cleared');
});

await test('outrunning a hunter makes it give up and go home', async () => {
  const { g, T, host } = await fresh(byGame('iai'));
  placePlayer(T, host, 6);
  g.run(1.5);
  eq(T.hunter, host, 'hunting');
  placePlayer(T, host, T.HUNT.leash + 4);   // sprint away over the horizon
  g.run(1);
  eq(host.hunt.state, 'return', 'should give up and head home');
  eq(T.hunter, null, 'slot released on giving up');
  assert(T.huntPeace > 0, 'a quiet spell follows a chase');
  g.run(T.HUNT.patience + 1);
  eq(host.hunt.state, 'calm', 'eventually settles');
});

await test('a yokai whose seal you hold never hunts again', async () => {
  const { g, T, host } = await fresh(byGame('iai'));
  T.won.add(host.def.game);          // you already beat the Aka-oni
  host.chCd = 0;
  placePlayer(T, host, 4);
  g.run(8);
  eq(T.hunter, null, 'no hunt from a yokai you have befriended');
  assert(!T.ch.active, 'and no battle');
});

await test('only one yokai hunts at a time', async () => {
  const g = await boot();
  const T = g.T;
  T.start('samurai');
  const a = T.hosts.find(h => h.def.game === 'iai');
  const b = T.hosts.find(h => h.def.game === 'stomp');
  // Drop both oni right next to the player.
  placePlayer(T, a, 0);
  b.b.dir.copy(T.offsetDir(T.player.body.dir, 1.2, 5 / T.R, new T.THREE.Vector3()));
  b.b.fixFwd(); b.b.sync();
  a.b.dir.copy(T.offsetDir(T.player.body.dir, 4.0, 5 / T.R, new T.THREE.Vector3()));
  a.b.fixFwd(); a.b.sync();
  let maxHunting = 0;
  g.run(5, 0.05, () => {
    maxHunting = Math.max(maxHunting, T.hosts.filter(h => h.hunting).length);
    return !T.ch.active;
  });
  assert(maxHunting <= 1, `at most one hunter at a time, saw ${maxHunting}`);
});

await test('nothing hunts before the player has started', async () => {
  const g = await boot();                 // deliberately not started
  const T = g.T;
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 3);
  g.run(5);
  eq(T.started, false, 'still on the title card');
  eq(T.hunter, null, 'no hunting before start');
});

await test('regression: a polite yokai still offers its mini-game on E', async () => {
  const { g, T, host } = await fresh(byGame('shell'));   // Tanuki
  placePlayer(T, host, 2);
  g.run(0.5);
  g.press('KeyE');
  g.step();
  assert(T.ch.active, 'E should open the tanuki shell game');
  eq(T.ch.active.g, T.GAMES.shell, 'correct mini-game');
});

await test('regression: a full battle still awards the seal', async () => {
  const { g, T, host } = await fresh(byGame('iai'));
  placePlayer(T, host, 4);
  g.run(6, 0.05, () => !T.ch.active);
  assert(T.ch.active && T.ch.active.g === T.BATTLE, 'in a battle');
  const c = T.ch.active;
  eq(T.won.has('iai'), false, 'seal not yet earned');
  c.hp = 1;
  T.BATTLE.hit(c, 5, 0, true);          // finishing blow
  g.run(0.2);
  assert(T.won.has('iai'), 'beating the Aka-oni should award its seal');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) {
  console.log(`  ${status === 'PASS' ? 'PASS' : 'FAIL'}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
