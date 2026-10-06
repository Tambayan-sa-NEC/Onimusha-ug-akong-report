/* Behaviour tests for the compass: finding the yokai you still owe a seal. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: ${a} is not within ${tol} of ${b}`);
}

async function menu() {
  const g = await boot();
  return { g, T: g.T, els: g.els };
}
async function playing(id = 'samurai') {
  const { g, T, els } = await menu();
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;   // nothing gives chase while we measure
  g.run(0.1);
  return { g, T, els };
}

const shown = (els, id) => els(id).className.includes('show');
/** The one host of a game with only one host, so "nearest" is never in doubt. */
const only = (T, game) => T.hosts.find(h => h.def.game === game);
const markFor = (T, key) => T.compassMarks().find(m => m.key === key);

/**
 * Move `host` to a point `dist` units from the player along a screen-space bearing:
 * 0 is straight ahead, positive is to the right of the screen.
 */
function place(T, host, bearing, dist) {
  const up = T.player.body.dir;
  const f = T.cam.fwd.clone().addScaledVector(up, -T.cam.fwd.dot(up)).normalize();
  const right = new T.THREE.Vector3().crossVectors(f, up).normalize();
  const head = f.clone().multiplyScalar(Math.cos(bearing)).addScaledVector(right, Math.sin(bearing)).normalize();
  const d = dist / T.R;
  host.b.dir.copy(up).multiplyScalar(Math.cos(d)).addScaledVector(head, Math.sin(d)).normalize();
  host.b.fixFwd();
  host.b.sync();
}
/** Every game the compass points at over one slow turn on the spot. */
function allRound(T) {
  const seen = new Set();
  for (let i = 0; i < 16; i++) {
    T.cam.fwd.applyAxisAngle(T.player.body.dir, Math.PI / 8);
    for (const m of T.compassMarks()) seen.add(m.key);
  }
  return seen;
}

/* ------------------------------- what it marks ------------------------------- */

await test('the compass is away until a run begins', async () => {
  const { g, els } = await menu();
  g.run(0.2);
  assert(!shown(els, 'compass'), 'nothing to find from the menu');
  eq(els('compass').children.length, 0, 'and nothing drawn');
});

await test('starting a run gives every seal you still owe a mark', async () => {
  const { T, els } = await playing();
  assert(shown(els, 'compass'), 'the strip is up');
  eq(els('compass').children.length, T.GAME_ORDER.length, 'one mark per unwon game');
  const drawn = els('compass').children.map(c => c.textContent).sort().join();
  eq(drawn, T.GAME_ORDER.map(k => T.GAMES[k].seal).sort().join(), 'and they are the right seals');
});

await test('turning on the spot finds every one of them', async () => {
  const { T } = await playing();
  eq(allRound(T).size, T.GAME_ORDER.length, 'no yokai is unreachable from where you stand');
});

await test('winning a seal takes that yokai off the compass', async () => {
  const { g, T, els } = await playing();
  const key = T.GAME_ORDER[0];
  assert(allRound(T).has(key), `${key} can be found to begin with`);
  T.won.add(key);
  g.run(0.1);
  eq(els('compass').children.length, T.GAME_ORDER.length - 1, 'one fewer mark');
  assert(!allRound(T).has(key), 'and no bearing leads back to it');
});

await test('a mark carries its yokai, not just its game', async () => {
  const { T, els } = await playing();
  place(T, only(T, 'iai'), 0, 20);
  const m = markFor(T, 'iai');
  eq(m.seal, T.GAMES.iai.seal, 'drawn with the same glyph as the seal book');
  assert(m.title.includes(T.hostNameFor('iai')), `the tooltip names the yokai, said "${m.title}"`);
  assert(m.title.includes(T.GAMES.iai.title), 'and still names the game');
  const cell = els('compass').children.find(c => c.textContent === T.GAMES.iai.seal);
  assert(cell && cell.title === m.title, 'the drawn mark says the same');
});

/* -------------------------------- where it points -------------------------------- */

await test('a yokai straight ahead sits at the centre of the strip', async () => {
  const { T } = await playing();
  place(T, only(T, 'iai'), 0, 20);
  const m = markFor(T, 'iai');
  near(m.bearing, 0, 0.02, 'dead ahead');
  near(m.x, 50, 1, 'and drawn in the middle');
  eq(m.edge, false, 'not pinned');
});

await test('a yokai to your right is marked right of centre', async () => {
  const { T } = await playing();
  place(T, only(T, 'iai'), 0.6, 20);
  const m = markFor(T, 'iai');
  near(m.bearing, 0.6, 0.02, 'six tenths of a radian to the right');
  assert(m.x > 50, `drawn right of centre, got ${m.x}`);
});

await test('a yokai to your left is marked left of centre', async () => {
  const { T } = await playing();
  place(T, only(T, 'iai'), -0.6, 20);
  const m = markFor(T, 'iai');
  assert(m.x < 50, `drawn left of centre, got ${m.x}`);
});

await test('turning the camera slides the marks the other way', async () => {
  const { T } = await playing();
  place(T, only(T, 'iai'), 0, 20);
  near(markFor(T, 'iai').x, 50, 1, 'centred before the turn');
  T.cam.fwd.applyAxisAngle(T.player.body.dir, 0.5);     // look to the left
  const m = markFor(T, 'iai');
  assert(m.x > 50, `what was ahead is now to the right, got ${m.x}`);
  near(m.bearing, 0.5, 0.02, 'by exactly the angle turned');
});

await test('a yokai behind you is pinned to the edge rather than lost', async () => {
  const { T } = await playing();
  place(T, only(T, 'iai'), Math.PI * 0.9, 20);
  const m = markFor(T, 'iai');
  assert(m, 'still marked, so an empty strip never means nothing is left');
  eq(m.edge, true, 'pinned');
  eq(m.x, 100, 'against the right-hand end');
});

await test('only the nearest yokai on each side is pinned, so the ends never pile up', async () => {
  const { T } = await playing();
  const marks = T.compassMarks();
  for (const side of [-1, 1]) {
    const pinned = marks.filter(m => m.edge && Math.sign(m.bearing) === side);
    assert(pinned.length <= 1, `at most one pinned to the ${side < 0 ? 'left' : 'right'}, got ${pinned.length}`);
  }
  assert(marks.every(m => m.edge || Math.abs(m.bearing) <= T.COMPASS_FOV + 1e-6),
    'everything not pinned is within the window');
});

await test('a mark past the end of the strip is drawn inside it', async () => {
  const { g, T, els } = await playing();
  place(T, only(T, 'iai'), Math.PI * 0.9, 20);
  g.run(0.05);
  const cell = els('compass').children.find(c => c.textContent === T.GAMES.iai.seal);
  assert(cell.className.includes('edge'), 'marked as a direction to turn');
  assert(cell.className.includes('right'), 'and as which way, so it is not drawn off the end');
});

/* --------------------------------- how far away --------------------------------- */

await test('a nearer yokai is drawn more strongly than a distant one', async () => {
  const { T } = await playing();
  const host = only(T, 'iai');
  place(T, host, 0, T.COMPASS_NEAR);
  const close = markFor(T, 'iai');
  place(T, host, 0, T.COMPASS_FAR);
  const far = markFor(T, 'iai');
  near(close.dist, T.COMPASS_NEAR, 0.5, 'the near one is near');
  near(far.dist, T.COMPASS_FAR, 0.5, 'and the far one is far');
  assert(close.fade > far.fade, `near is stronger: ${close.fade} vs ${far.fade}`);
  eq(close.fade, 1, 'close up it is drawn in full');
});

await test('distance is measured round the planet, not through it', async () => {
  const { T } = await playing();
  // A quarter turn around the sphere is a long walk, but a much shorter chord.
  place(T, only(T, 'iai'), 0, Math.PI * T.R * 0.5);
  near(markFor(T, 'iai').dist, Math.PI * T.R * 0.5, 1, 'a quarter of the way round, as walked');
});

/* ------------------------------ when it stands aside ------------------------------ */

await test('the compass stands aside for a challenge', async () => {
  const { g, T, els } = await playing();
  assert(shown(els, 'compass'), 'up while walking');
  T.startChallenge(only(T, 'iai'));
  g.run(0.1);
  assert(!shown(els, 'compass'), 'and away while you play');
});

await test('the compass stands aside indoors', async () => {
  const { g, T, els } = await playing();
  T.doors[0].interact();
  g.run(0.2);
  eq(T.indoors(), true, 'inside');
  assert(!shown(els, 'compass'), 'nothing out there to point at from in here');
});

await test('the compass stands aside for the ending', async () => {
  const { g, T, els } = await playing();
  T.playEnding({ char: 'The Rōnin', kanji: '侍', slain: 2, seals: 5, bosses: ['Ōtengu', 'Orochi'] });
  g.run(0.2);
  assert(!shown(els, 'compass'), 'the cutscene wants the screen to itself');
});

await test('the compass goes away once there is nothing left to find', async () => {
  const { g, T, els } = await playing();
  assert(shown(els, 'compass'), 'up while seals are outstanding');
  for (const k of T.GAME_ORDER) T.won.add(k);
  g.run(0.1);
  assert(!shown(els, 'compass'), 'an empty strip is only clutter');
  eq(els('compass').children.length, 0, 'and it lets go of its marks');
});

/* --------------------------------- as a setting --------------------------------- */

await test('turning the compass off puts it away', async () => {
  const { g, T, els } = await playing();
  assert(shown(els, 'compass'), 'on by default');
  T.CFG.compass = false;
  g.run(0.1);
  assert(!shown(els, 'compass'), 'off when you say so');
  eq(els('compass').children.length, 0, 'and it lets go of its marks');
});

await test('whether you want the compass is remembered', async () => {
  const { T } = await playing();
  assert('compass' in T.DEFAULT_SETTINGS, 'it is a setting, so it is saved');
  T.CFG.compass = false;
  T.savePrefs();
  T.CFG.compass = true;
  T.loadPrefs();
  eq(T.CFG.compass, false, 'still off next time');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
