/* Behaviour tests for playing on a phone: the on-screen controls. */
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

/** A phone: the browser reports a coarse pointer, so the controls come up. */
async function phone(id = 'samurai') {
  const g = await boot({ coarsePointer: true });
  const T = g.T;
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;
  g.run(0.1);
  return { g, T, els: g.els, el: T.touch.els };
}
/** A desktop: a mouse and a keyboard, and nothing drawn over the game. */
async function desktop(id = 'samurai') {
  const g = await boot();
  const T = g.T;
  T.start(id);
  g.run(0.1);
  return { g, T, els: g.els };
}

const shown = (els, id) => els(id).className.includes('show');
const pd = (e, x = 0, y = 0) => e.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: x, clientY: y, preventDefault() {} });
const pm = (e, x, y) => e.dispatch('pointermove', { pointerId: 1, clientX: x, clientY: y, preventDefault() {} });
const pu = e => e.dispatch('pointerup', { pointerId: 1, preventDefault() {} });
/** Press and release a button, the way a thumb does. */
const tapBtn = e => { pd(e); pu(e); };
const only = (T, game) => T.hosts.find(h => h.def.game === game);

/* ------------------------------ when they appear ------------------------------ */

await test('a mouse and keyboard get no on-screen controls', async () => {
  const { T, els } = await desktop();
  eq(T.touchOn(), false, 'a fine pointer plays with the keyboard');
  assert(!shown(els, 'touch'), 'and nothing is drawn over the game');
});

await test('a touch device gets them once a run starts', async () => {
  const { T, els, el } = await phone();
  eq(T.touchOn(), true, 'a coarse pointer needs somewhere to put its thumbs');
  assert(shown(els, 'touch'), 'the controls are up');
  for (const k of ['move', 'look', 'stick', 'pause', 'e', 'atk', 'jump', 'special']) {
    assert(el[k], `there is a ${k}`);
  }
});

await test('the controls are away until a run starts', async () => {
  const g = await boot({ coarsePointer: true });
  g.run(0.2);
  assert(!g.els('touch').className.includes('show'), 'the menu is tapped directly, not driven');
});

await test('turning them off in settings puts them away', async () => {
  const { g, T, els } = await phone();
  assert(shown(els, 'touch'), 'on by default on a phone');
  T.CFG.touchControls = false;
  g.run(0.1);
  assert(!shown(els, 'touch'), 'off when you say so');
  eq(T.touchOn(), false, 'and the game agrees they are gone');
});

/* --------------------------------- the stick --------------------------------- */

await test('the stick walks you in the direction you push it', async () => {
  const { g, T, el } = await phone();
  pd(el.move, 100, 400);
  pm(el.move, 100 + T.STICK_R, 400);
  near(T.input.moveX, 1, 0.01, 'pushed fully to the right');
  near(T.input.moveZ, 0, 0.01, 'and not at all forward');
  g.run(0.3);
  assert(T.player.vel.length() > 0.5, `and the character walks, got ${T.player.vel.length()}`);
});

await test('pushing up on the stick walks you forward, not backward', async () => {
  const { T, el } = await phone();
  pd(el.move, 100, 400);
  pm(el.move, 100, 400 - T.STICK_R);          // up the screen is a smaller y
  near(T.input.moveZ, 1, 0.01, 'forward');
  near(T.input.moveX, 0, 0.01, 'and straight');
});

await test('a half push walks and a full push sprints', async () => {
  const { g, T, el } = await phone();
  pd(el.move, 100, 400);
  pm(el.move, 100 + T.STICK_R * 0.5, 400);
  near(T.input.moveX, 0.5, 0.01, 'half out');
  g.run(0.2);
  eq(T.player.sprinting, false, 'a gentle push is a walk');
  pm(el.move, 100 + T.STICK_R * 2, 400);      // past the edge, which clamps
  near(T.input.moveX, 1, 0.01, 'clamped to the rim');
  g.run(0.2);
  eq(T.player.sprinting, true, 'and the rim is a sprint, so there is no sprint button');
});

await test('letting go of the stick stops you', async () => {
  const { g, T, el } = await phone();
  pd(el.move, 100, 400);
  pm(el.move, 100 + T.STICK_R, 400);
  assert(T.input.moveX !== 0, 'moving');
  pu(el.move);
  eq(T.input.moveX, 0, 'let go');
  eq(T.input.moveZ, 0, 'entirely');
  eq(T.input.sprint, false, 'and no longer sprinting');
  g.run(0.6);
  assert(T.player.vel.length() < 0.5, 'and the character comes to rest');
});

/* -------------------------------- the buttons -------------------------------- */

await test('the jump button jumps', async () => {
  const { T, el } = await phone();
  eq(T.input.jump, false, 'not yet');
  pd(el.jump);
  eq(T.input.jump, true, 'pressed');
});

await test('the talk button is the E key', async () => {
  const { T, el } = await phone();
  pd(el.e);
  eq(T.input.interact, true, 'the same one-shot E sets');
});

await test('the attack button swings the blade', async () => {
  const { T, el } = await phone();
  eq(T.sw.cd, 0, 'blade at rest');
  pd(el.atk);
  assert(T.sw.cd > 0, 'and now mid-swing');
});

await test('the special button is whichever move your character has', async () => {
  const a = await phone('samurai');
  pd(a.el.special);
  assert(a.T.roll.cd > 0, 'the rōnin rolls');
  eq(a.T.dash.cd, 0, 'and does not dash');

  const b = await phone('shinobi');
  pd(b.el.special);
  assert(b.T.dash.cd > 0, 'the kunoichi dashes');
});

await test('the pause button opens the pause screen', async () => {
  const { T, el } = await phone();
  eq(T.pause.open, false, 'playing');
  pd(el.pause);
  eq(T.pause.open, true, 'paused, without an Esc key anywhere');
});

/* ------------------------- reaching the running challenge ------------------------- */

await test('a button reaches the mini-game exactly as a key would', async () => {
  const { g, T, el } = await phone();
  pd(el.jump);
  eq(T.input.jump, true, 'out in the world, jump jumps');
  g.run(0.1);
  T.startChallenge(only(T, 'iai'));            // locks: true, and wants Space
  g.run(0.05);
  pd(el.jump);
  eq(T.input.jump, false, 'inside a locked game the press is eaten by the game, as a key press is');
});

await test('the memory lanterns can be tapped as well as keyed', async () => {
  const { g, T } = await phone();
  T.startChallenge(only(T, 'memory'));
  g.run(0.05);
  const c = T.ch.active;
  c.phase = 'input'; c.seq = [2, 0]; c.pos = 0;
  pd(c.lan[2]);
  eq(c.pos, 1, 'the right lantern advances the sequence');
  pd(c.lan[1]);
  eq(c.result, 'lose', 'and the wrong one is wrong, just as the key is');
});

await test('a phone is told to use the pause button, not a key it has not got', async () => {
  const { g, T, els } = await phone();
  T.startChallenge(only(T, 'iai'));
  g.run(0.05);
  const how = els('chHow').textContent;
  assert(!/Esc/.test(how), `no Esc on a phone, said "${how}"`);
  assert(/[Pp]ause/.test(how), `it names the pause button instead, said "${how}"`);
});

/* --------------------------------- looking around --------------------------------- */

await test('dragging the look side turns the camera', async () => {
  const { g, T, el } = await phone();
  const before = T.cam.fwd.clone();
  pd(el.look, 900, 300);
  pm(el.look, 1000, 300);
  g.run(0.1);
  assert(T.cam.fwd.angleTo(before) > 0.02, 'the camera came round with the drag');
});

await test('the controls stand aside for the ending', async () => {
  const { g, T, els } = await phone();
  assert(shown(els, 'touch'), 'up while playing');
  T.playEnding({ char: 'The Rōnin', kanji: '侍', slain: 2, seals: 5, bosses: ['Ōtengu', 'Orochi'] });
  g.run(0.2);
  assert(!shown(els, 'touch'), 'the cutscene wants the screen to itself');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
