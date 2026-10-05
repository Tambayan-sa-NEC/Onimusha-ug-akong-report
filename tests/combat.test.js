/* Behaviour tests for the reworked yokai fight: phase cycle, charge vs slam, punish window. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }
function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error(`${msg}: expected ~${b} (±${tol}), got ${a.toFixed(3)}`); }

function placePlayer(T, host, dist) {
  const pb = T.player.body;
  for (let i = 0; i < 400; i++) {
    const d = T.offsetDir(host.b.dir, (i / 400) * 6.283, dist / T.R, new T.THREE.Vector3());
    if (T.onLand(d)) { pb.dir.copy(d); pb.fixFwd(); pb.lift = 0; pb.vy = 0; pb.grounded = true; pb.sync(); return; }
  }
  throw new Error(`test setup: no land ${dist}u from ${host.def.name}`);
}

/** A started game with a live battle against the yokai that hosts `gameKey`. */
async function battle(gameKey = 'iai', dist = 3) {
  const g = await boot();
  const T = g.T;
  T.start('samurai');
  const host = T.hosts.find(h => h.def.game === gameKey);
  for (const h of T.hosts) if (h !== host) h.chCd = 1e9;
  placePlayer(T, host, dist);
  T.startChallenge(host, T.BATTLE);
  return { g, T, host, c: T.ch.active };
}
const gap = (T, host) => T.angleBetween(T.player.body.dir, host.b.dir) * T.R;

/* ------------------------------------------------------------------ */

await test('a fight cycles idle -> windup -> strike -> recover', async () => {
  const { g, T, c } = await battle('iai');
  const seen = new Set();
  g.run(10, 0.05, () => { seen.add(c.phase); return !c.result; });
  for (const p of ['idle', 'windup', 'strike', 'recover']) assert(seen.has(p), `never saw phase "${p}" (saw ${[...seen].join(', ')})`);
});

await test('a slam telegraphs under its own feet', async () => {
  const { T, host, c } = await battle('iai');
  c.st.moves = ['slam'];
  T.BATTLE.beginMove(c, 3);
  eq(c.move, 'slam', 'chose a slam');
  near(T.angleBetween(c.warn.c, host.b.dir) * T.R, 0, 0.01, 'ring centred on the yokai');
  near(c.warn.a * T.R, c.st.radius, 0.01, 'ring radius matches its reach');
});

await test('a charge telegraphs up the lane ahead', async () => {
  const { T, host, c } = await battle('iai', 6);
  c.st.moves = ['dash'];
  T.BATTLE.beginMove(c, 6);
  eq(c.move, 'dash', 'chose a charge');
  near(T.angleBetween(c.warn.c, host.b.dir) * T.R, c.st.dash, 0.05, 'landing zone sits a charge ahead');
  assert(c.warn.a * T.R < c.st.radius, 'the charge marker is tighter than a slam ring');
});

await test('a charge actually carries the yokai forward', async () => {
  const { g, T, host, c } = await battle('iai', 7);
  c.st.moves = ['dash'];
  g.run(6, 0.02, () => c.phase !== 'strike');          // walk-in, then the windup, then it launches
  eq(c.phase, 'strike', 'should reach a charge');
  const from = host.b.dir.clone();
  g.run(0.6, 0.02, () => c.phase === 'strike');        // ride the charge out
  const travelled = T.angleBetween(from, host.b.dir) * T.R;
  assert(travelled > 2.5, `a charge should cover ground, moved ${travelled.toFixed(2)}u`);
});

await test('a slam hurts a grounded player and misses a jumping one', async () => {
  const { T, host, c } = await battle('iai', 1.5);
  c.move = 'slam';
  const pb = T.player.body;

  pb.lift = 2.5;                                        // airborne over the shockwave
  const before = c.php;
  T.BATTLE.launch(c, host.fx);
  eq(c.php, before, 'jumping should clear the slam');

  c.pinv = 0; c.phase = 'idle'; pb.lift = 0;            // back on the ground
  T.BATTLE.launch(c, host.fx);
  eq(c.php, before - 1, 'a grounded player takes the hit');
});

await test('every attack leaves a recovery window', async () => {
  const { g, T, c } = await battle('iai');
  c.st.moves = ['slam'];
  c.next = 0;
  g.run(6, 0.02, () => c.phase !== 'recover');
  eq(c.phase, 'recover', 'should end up open after striking');
  assert(c.rt > 0 && c.rt <= c.st.recover + 1e-6, `recovery timer in range, got ${c.rt}`);
  eq(c.warn.mesh.visible, false, 'telegraph cleared');
});

await test('a combo finisher through the windup staggers it', async () => {
  const { T, host, c } = await battle('iai');
  c.st.moves = ['slam'];
  T.BATTLE.beginMove(c, 3);
  eq(c.phase, 'windup', 'winding up');
  c.warn.mesh.visible = true;
  T.BATTLE.hit(c, 2, 0.6, true);                        // the 3-hit finisher lands
  eq(c.phase, 'recover', 'the attack breaks');
  eq(c.warn.mesh.visible, false, 'telegraph cancelled');
  eq(host.fx.wind, 0, 'charge-up discarded');
});

await test('a tapped yokai keeps its windup (only finishers break it)', async () => {
  const { T, c } = await battle('iai');
  c.st.moves = ['slam'];
  T.BATTLE.beginMove(c, 3);
  T.BATTLE.hit(c, 1, 0.6, false);
  eq(c.phase, 'windup', 'a light hit should not stagger');
});

await test('move sets are respected', async () => {
  const { T, c } = await battle('tag', 8);                    // kitsune: charges only
  eq(c.st.moves.join(','), 'dash', 'kitsune charge-only');
  const picks = new Set();
  for (let i = 0; i < 40; i++) { T.BATTLE.beginMove(c, 8); picks.add(c.move); }
  eq([...picks].join(','), 'dash', 'kitsune should never slam at range');

  const b2 = await battle('stomp', 8);                        // ao-oni: mostly slams, sometimes charges
  const p2 = new Set();
  for (let i = 0; i < 80; i++) { b2.T.BATTLE.beginMove(b2.c, 8); p2.add(b2.c.move); }
  eq([...p2].sort().join(','), 'dash,slam', 'ao-oni should mix both');
});

await test('a charge becomes a slam when there is no room to run', async () => {
  const { T, c } = await battle('tag', 1);
  for (let i = 0; i < 20; i++) { T.BATTLE.beginMove(c, 0.5); eq(c.move, 'slam', 'point blank should slam'); }
});

await test('it circles instead of standing still at mid range', async () => {
  const { g, T, host, c } = await battle('iai');
  placePlayer(T, host, c.st.radius + 0.6);              // inside engage range, outside crowding range
  c.next = 1e6;                                         // suppress attacks: pure footwork
  const from = host.b.dir.clone();
  const d0 = gap(T, host);
  g.run(2, 0.05, () => !c.result);
  const moved = T.angleBetween(from, host.b.dir) * T.R;
  assert(moved > 0.8, `should strafe around you, moved only ${moved.toFixed(2)}u`);
  near(gap(T, host), d0, 1.6, 'while roughly holding its distance');
});

await test('it closes the gap when you back off', async () => {
  const { g, T, host, c } = await battle('iai');
  placePlayer(T, host, 12);
  c.next = 1e6;
  const d0 = gap(T, host);
  g.run(2, 0.05, () => !c.result);
  assert(gap(T, host) < d0 - 1.5, `should advance, went ${d0.toFixed(2)} -> ${gap(T, host).toFixed(2)}`);
});

await test('fx are torn down once the fight is over', async () => {
  const { g, T, host, c } = await battle('iai');
  g.run(0.5);
  assert(host.fx, 'fx active during the fight');
  c.hp = 1;
  T.BATTLE.hit(c, 5, 0, true);
  g.run(6);                                             // KO wobble, result banner, cleanup
  assert(T.won.has('iai'), 'seal awarded');
  assert(!host.fx, 'fx released afterwards');
  near(host.b.obj.scale.x, 1.3, 0.001, 'scale restored to the oni default');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
