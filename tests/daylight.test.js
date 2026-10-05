/* Behaviour tests for the day/night cycle. */
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

async function playing(id = 'samurai') {
  const g = await boot();
  const T = g.T;
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;
  return { g, T };
}
const sky = T => T.scene.background.getHexString();

/* ----------------------------------- the clock ---------------------------------- */

await test('a full day is four minutes, split evenly', async () => {
  const { T } = await boot().then(g => ({ T: g.T }));
  eq(T.DAY_LENGTH, 120, 'two minutes of daylight');
  eq(T.NIGHT_LENGTH, 120, 'and two of night');
  eq(T.CYCLE_LENGTH, 240, 'four minutes all told');
});

await test('the clock advances with the frame and wraps round', async () => {
  const { T } = await boot().then(g => ({ T: g.T }));
  T.setTimeOfDay(0);
  eq(T.daylight.t, 0, 'at the start of the day');
  T.updateDaylight(30);
  near(T.daylight.t, 30, 0.001, 'half a minute later');
  T.updateDaylight(T.CYCLE_LENGTH);
  near(T.daylight.t, 30, 0.001, 'a whole cycle later, back where it was');
});

await test('it is day for the first half and night for the second', async () => {
  const { T } = await boot().then(g => ({ T: g.T }));
  for (const [t, night] of [[0, false], [60, false], [119, false], [130, true], [180, true], [239, true]]) {
    T.setTimeOfDay(t);
    eq(T.isNight(), night, `at ${t}s it should be ${night ? 'night' : 'day'}`);
  }
});

await test('the game opens in the morning rather than the small hours', async () => {
  const { T } = await boot().then(g => ({ T: g.T }));
  assert(!T.isNight(), 'the first thing you see is daylight');
});

/* ----------------------------------- the sky ----------------------------------- */

await test('the sky is not the same colour at noon and at midnight', async () => {
  const { T } = await playing();
  T.setTimeOfDay(60); T.updateDaylight(0);
  const noon = sky(T);
  T.setTimeOfDay(180); T.updateDaylight(0);
  const midnight = sky(T);
  assert(noon !== midnight, `noon and midnight should differ, both were ${noon}`);
});

await test('midnight is darker than noon, rather than merely different', async () => {
  const { T } = await playing();
  const lum = () => {
    const c = T.scene.background;
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  };
  T.setTimeOfDay(60); T.updateDaylight(0);
  const noon = lum();
  T.setTimeOfDay(180); T.updateDaylight(0);
  const midnight = lum();
  assert(midnight < noon * 0.6, `midnight (${midnight.toFixed(3)}) should be well below noon (${noon.toFixed(3)})`);
});

await test('the sun dims at night and the fog closes in', async () => {
  const { T } = await playing();
  T.setTimeOfDay(60); T.updateDaylight(0);
  const daySun = T.sun.intensity, dayFar = T.scene.fog.far;
  T.setTimeOfDay(180); T.updateDaylight(0);
  assert(T.sun.intensity < daySun * 0.5, `the sun should dim: ${daySun} -> ${T.sun.intensity}`);
  assert(T.scene.fog.far < dayFar, `the night should close in: ${dayFar} -> ${T.scene.fog.far}`);
});

await test('the sky moves gradually rather than snapping between two states', async () => {
  const { T } = await playing();
  const seen = new Set();
  for (let t = 0; t < T.CYCLE_LENGTH; t += 12) { T.setTimeOfDay(t); T.updateDaylight(0); seen.add(sky(T)); }
  assert(seen.size > 8, `the sky should pass through many shades, saw ${seen.size}`);
});

/* ------------------------------- arenas and rooms ------------------------------- */

await test('an arena keeps its own sky while you are in it', async () => {
  const { g, T } = await playing();
  T.setTimeOfDay(60); T.updateDaylight(0);
  T.arena.enter('peak', T.player.body.dir.clone());
  const arenaSky = sky(T);
  // Run the clock right through to the middle of the night.
  T.setTimeOfDay(180);
  T.updateDaylight(1);
  eq(sky(T), arenaSky, 'the arena sky is not repainted by the hour');
});

await test('leaving an arena gives you back the sky of the hour, not midday', async () => {
  const { T } = await playing();
  T.setTimeOfDay(180); T.updateDaylight(0);     // the middle of the night
  const nightSky = sky(T);
  T.arena.enter('peak', T.player.body.dir.clone());
  assert(sky(T) !== nightSky, 'the arena has its own sky');
  T.arena.exit();
  eq(sky(T), nightSky, 'and stepping out returns you to the night you left');
});

await test('a room is the same: no repainting inside, the right sky on the way out', async () => {
  const { T } = await playing();
  T.setTimeOfDay(170); T.updateDaylight(0);
  T.doors.find(d => d.roomId === 'teahouse').interact();
  const inside = sky(T);
  T.updateDaylight(5);
  eq(sky(T), inside, 'the tea house is lit by its own lamps, whatever the hour outside');
  T.roomFixtures.get('teahouse').all.find(f => f.isDoor).interact();
  assert(T.isNight(), 'it was night when you went in, and still is');
  eq(sky(T), T.skyAt(T.daylight.t), 'and the sky is the one the clock now says');
});

await test('the clock keeps running while you are indoors', async () => {
  const { T } = await playing();
  T.setTimeOfDay(100);
  T.doors.find(d => d.roomId === 'teahouse').interact();
  T.updateDaylight(40);                       // a long look around
  T.roomFixtures.get('teahouse').all.find(f => f.isDoor).interact();
  near(T.daylight.t, 140, 0.001, 'forty seconds passed while you were inside');
  assert(T.isNight(), 'you went in by day and came out after dark');
});

/* -------------------------------- the setting --------------------------------- */

await test('the cycle can be turned off, and then the sky holds still', async () => {
  const { T } = await playing();
  T.CFG.dayNight = false;
  T.setTimeOfDay(60); T.updateDaylight(0);
  const held = sky(T);
  T.setTimeOfDay(180); T.updateDaylight(1);
  eq(sky(T), held, 'the sky does not move when the cycle is off');
});

await test('turning it off settles on daylight, not on whatever hour it was', async () => {
  const { T } = await playing();
  T.setTimeOfDay(180); T.updateDaylight(0);
  T.CFG.dayNight = false;
  T.applySettings();
  assert(!T.isNight() || sky(T) !== '000000', 'the world is lit');
  const sun = T.sun.intensity;
  assert(sun > 0.5, `the sun is up when the cycle is off, got ${sun}`);
});

await test('the setting is one of the ones that persists', async () => {
  const { g, T } = await playing();
  assert('dayNight' in T.CFG, 'it is a real setting');
  T.CFG.dayNight = false;
  T.savePrefs();
  T.CFG.dayNight = true;
  T.loadPrefs();
  eq(T.CFG.dayNight, false, 'and it comes back off');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
