/* Behaviour tests for the title screen, the credits, and continuing a saved run. */
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
/** The labels on whatever list the current page offers. */
const labels = T => T.menu.items.map(it => {
  const l = it.el.children.find(c => c.className === 'mlabel');
  return l ? l.textContent : it.el.textContent;
});
const item = (T, label) => T.menu.items.find((it, i) => labels(T)[i] === label);
const pageUp = (els, id) => els(id).className.includes('on');

/* ---------------------------------- the title --------------------------------- */

await test('the title is the first thing up, with the planet behind it', async () => {
  const { T, els } = await menu();
  eq(T.menu.page, 'title', 'on the title');
  assert(pageUp(els, 'mTitle'), 'the title page is shown');
  assert(!pageUp(els, 'mSelect'), 'the character cards are not');
  assert(!els('overlay').className.includes('hide'), 'the overlay is up over the running game');
});

await test('a fresh install is offered a beginning, not a continue', async () => {
  const { T } = await menu();
  const l = labels(T);
  assert(l.includes('Begin'), `somewhere to start, got ${l.join(' / ')}`);
  assert(!l.includes('Continue'), 'nothing to continue yet');
  assert(l.includes('Settings') && l.includes('Controls') && l.includes('Credits'), 'and the rest');
});

await test('beginning goes to the character cards', async () => {
  const { T, els } = await menu();
  item(T, 'Begin').pick();
  eq(T.menu.page, 'select', 'on the select page');
  assert(pageUp(els, 'mSelect'), 'the cards are shown');
  eq(T.menu.cards.length, 2, 'both characters');
});

await test('Escape backs out of the cards to the title', async () => {
  const { g, T } = await menu();
  T.showPage('select');
  g.press('Escape');
  eq(T.menu.page, 'title', 'back on the title');
});

await test('the credits can be read and left', async () => {
  const { T, els } = await menu();
  item(T, 'Credits').pick();
  eq(T.menu.page, 'credits', 'reading the credits');
  assert(pageUp(els, 'mCredits'), 'the page is shown');
  assert(els('mCredits').children.length > 1, 'and it says something');
  item(T, 'Back').pick();
  eq(T.menu.page, 'title', 'and back again');
});

await test('settings and controls are reachable before a run starts', async () => {
  const { T, els } = await menu();
  item(T, 'Settings').pick();
  eq(T.pause.open, true, 'the settings panel opened');
  eq(T.pause.fromTitle, true, 'knowing it came from the title');
  eq(T.session.paused, false, 'nothing to pause — the run has not begun');
  assert(els('pause').className.includes('show'), 'and it is on screen');
});

await test('leaving the settings from the title closes them outright', async () => {
  const { g, T } = await menu();
  item(T, 'Settings').pick();
  g.press('Escape');
  eq(T.pause.open, false, 'closed rather than dropped onto a pause root that is not there');
  eq(T.menu.page, 'title', 'still on the title');
});

/* --------------------------------- navigation -------------------------------- */

await test('the keyboard walks the title list and picks with Enter', async () => {
  const { g, T } = await menu();
  eq(T.menu.i, 0, 'starts at the top');
  g.press('ArrowDown');
  eq(T.menu.i, 1, 'moved down');
  g.press('ArrowUp'); g.press('ArrowUp');
  eq(T.menu.i, T.menu.items.length - 1, 'and wraps around the top');
  T.menu.i = labels(T).indexOf('Credits');
  g.press('Enter');
  eq(T.menu.page, 'credits', 'Enter took the highlighted item');
});

/* ------------------------------- continuing a run ------------------------------ */

await test('winning a seal writes the run down', async () => {
  const { g, T } = await menu();
  T.showPage('select');
  T.start('samurai');
  for (const h of T.hosts) h.chCd = 1e9;
  T.won.add(T.GAME_ORDER[0]);
  T.recordProgress();
  const saved = T.loadProgress();
  assert(saved, 'there is something to come back to');
  eq(saved.char, 'samurai', 'who you were');
  eq(saved.won.join(), T.GAME_ORDER[0], 'and what you had won');
});

await test('a run with nothing won is not worth offering to continue', async () => {
  const { T } = await menu();
  T.showPage('select');
  T.start('samurai');
  T.recordProgress();
  eq(T.loadProgress(), null, 'an empty run is not a run');
  eq(T.hasProgress(), false, 'so nothing is offered');
});

await test('continuing restores the character and the seals', async () => {
  const { g, T, els } = await menu();
  els('pause');                      // touch, so the panel element exists
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({
    v: T.SAVE_VERSION,
    progress: { char: 'shinobi', won: [T.GAME_ORDER[0], T.GAME_ORDER[1]], bossWon: [], slain: [] },
  }));
  T.showPage('title');               // rebuild the list now there is a save
  assert(labels(T).includes('Continue'), `Continue is offered, got ${labels(T).join(' / ')}`);
  item(T, 'Continue').pick();
  eq(T.started, true, 'the run resumed');
  eq(T.player.char.id, 'shinobi', 'as the saved character');
  eq(T.won.size, 2, 'holding the saved seals');
});

await test('a save naming a character that does not exist is ignored', async () => {
  const { g, T } = await menu();
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({
    v: T.SAVE_VERSION, progress: { char: 'dragon', won: ['shell'], bossWon: [], slain: [] },
  }));
  eq(T.loadProgress(), null, 'nothing restored from nonsense');
  T.showPage('title');
  assert(!labels(T).includes('Continue'), 'and nothing offered');
});

await test('clearing the run leaves the settings alone', async () => {
  const { g, T } = await menu();
  T.CFG.lookSens = 2;
  T.savePrefs();
  T.showPage('select');
  T.start('samurai');
  T.won.add(T.GAME_ORDER[0]);
  T.recordProgress();
  assert(T.hasProgress(), 'a run is saved');
  T.clearProgress();
  eq(T.hasProgress(), false, 'the run is gone');
  T.CFG.lookSens = 1;
  T.loadPrefs();
  eq(T.CFG.lookSens, 2, 'but the settings survived');
});

/* -------------------------------- the cards ------------------------------- */

await test('each character card carries a turning figure and its own stats', async () => {
  const { T } = await menu();
  T.showPage('select');
  for (const card of T.menu.cards) {
    assert(card.children.some(c => c.tagName === 'CANVAS'), 'a preview canvas');
    const stats = card.children.find(c => c.className === 'pstats');
    assert(stats && stats.children.length >= 4, 'and a stat block');
  }
  eq(T.previews.length, 2, 'one preview built per character');
});

await test('rebuilding the cards does not stack previews up', async () => {
  const { T } = await menu();
  T.showPage('select');
  T.showPage('title');
  T.showPage('select');
  eq(T.previews.length, 2, 'still just the two');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
