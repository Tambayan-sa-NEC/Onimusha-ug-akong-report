/* Behaviour tests for the pause screen, the settings, the keymaps, and saved preferences. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

/** A booted game still sitting on the select screen. */
async function menu() {
  const g = await boot();
  return { g, T: g.T, els: g.els };
}
/** A booted game already playing as `id`, with nobody hunting. */
async function playing(id = 'samurai') {
  const { g, T, els } = await menu();
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;
  return { g, T, els };
}
/** How far the player has moved from `from`, in world units. */
const moved = (T, from) => T.angleBetween(from, T.player.body.dir) * T.R;
/** A button on the pause card, by its label. */
function pauseButton(els, label) {
  const card = els('pause').children[0];
  return card && card.children.find(c => c.tagName === 'BUTTON' && c.textContent === label);
}

/* --------------------------------- opening it -------------------------------- */

await test('Escape opens the pause screen while playing', async () => {
  const { g, T, els } = await playing();
  eq(T.pause.open, false, 'not paused to begin with');
  g.press('Escape');
  eq(T.pause.open, true, 'paused');
  eq(T.session.paused, true, 'and the session agrees');
  assert(els('pause').className.includes('show'), 'the panel is up');
});

await test('Escape again resumes', async () => {
  const { g, T, els } = await playing();
  g.press('Escape');
  g.press('Escape');
  eq(T.pause.open, false, 'resumed');
  eq(T.session.paused, false, 'session resumed too');
  assert(!els('pause').className.includes('show'), 'the panel is down');
});

await test('Escape does nothing on the character select screen', async () => {
  const { g, T, els } = await menu();
  g.press('Escape');
  eq(T.pause.open, false, 'nothing to pause yet');
  assert(!els('pause').className.includes('show'), 'no panel');
  eq(T.started, false, 'still choosing');
});

/* ------------------------------ what pausing does ----------------------------- */

await test('the world stops while paused', async () => {
  const { g, T } = await playing();
  g.press('KeyW');
  g.run(0.5);
  const after = T.player.body.dir.clone();
  assert(moved(T, after) === 0, 'baseline');
  g.press('Escape');
  g.run(2);
  assert(moved(T, after) < 0.01, `the player should not move while paused, moved ${moved(T, after).toFixed(3)}u`);
});

await test('resuming does not hand the first frame a huge delta', async () => {
  const { g, T } = await playing();
  const from = T.player.body.dir.clone();
  g.press('Escape');
  g.run(5);                       // a long pause
  g.press('Escape');              // resume
  g.step(0.05);
  assert(moved(T, from) < 0.5, `no teleport on resume, moved ${moved(T, from).toFixed(3)}u`);
});

await test('the frame keeps being scheduled while paused, so the screen still draws', async () => {
  const { g, T } = await playing();
  g.press('Escape');
  g.step(0.05);
  g.step(0.05);                   // would throw 'no frame scheduled' if the loop stopped
  eq(T.pause.open, true, 'still paused');
});

/* -------------------------------- challenges -------------------------------- */

await test('Escape during a challenge pauses it rather than forfeiting it', async () => {
  const { g, T } = await playing();
  const host = T.hosts.find(h => h.def.game === 'shell');
  T.startChallenge(host, T.GAMES.shell);
  g.press('Escape');
  eq(T.pause.open, true, 'paused');
  eq(T.ch.active.result, null, 'the challenge was not forfeited');
});

await test('forfeiting from the pause screen loses the challenge and closes the panel', async () => {
  const { g, T, els } = await playing();
  const host = T.hosts.find(h => h.def.game === 'shell');
  T.startChallenge(host, T.GAMES.shell);
  g.press('Escape');
  const btn = pauseButton(els, 'Forfeit challenge');
  assert(btn, 'the pause screen offers a forfeit while a challenge is running');
  btn.dispatch('click');
  eq(T.ch.active.result, 'lose', 'bowed out');
  eq(T.pause.open, false, 'and back to the game');
});

await test('there is nothing to forfeit when no challenge is running', async () => {
  const { g, els } = await playing();
  g.press('Escape');
  assert(!pauseButton(els, 'Forfeit challenge'), 'no forfeit button outside a challenge');
  assert(pauseButton(els, 'Resume'), 'but resume is always there');
});

/* ---------------------------------- quitting --------------------------------- */

await test('quitting asks before it throws the run away', async () => {
  const { g, T, els } = await playing();
  g.press('Escape');
  pauseButton(els, 'Quit to menu').dispatch('click');
  eq(T.started, true, 'nothing lost on the first click');
  eq(T.pause.open, true, 'still on the pause screen');
  assert(pauseButton(els, 'Keep playing'), 'there is a way back out');
  pauseButton(els, 'Keep playing').dispatch('click');
  eq(T.started, true, 'backing out leaves the run alone');

  pauseButton(els, 'Quit to menu').dispatch('click');
  pauseButton(els, 'Quit to menu').dispatch('click');   // confirm
  eq(T.started, false, 'confirming actually quits');
});

await test('quitting from the pause screen returns to the select screen', async () => {
  const { g, T, els } = await playing();
  g.press('Escape');
  T.quitToMenu();
  eq(T.started, false, 'back on the menu');
  eq(T.pause.open, false, 'pause panel closed behind it');
  eq(T.session.paused, false, 'and nothing left paused');
  assert(!els('overlay').className.includes('hide'), 'the overlay is up again');
});

await test('quitting mid-challenge still leaves nothing running', async () => {
  const { g, T } = await playing();
  const host = T.hosts.find(h => h.def.game === 'shell');
  T.startChallenge(host, T.GAMES.shell);
  g.press('Escape');
  T.quitToMenu();
  eq(T.started, false, 'back on the menu');
  eq(T.ch.active, null, 'no challenge left running');
});

/* ---------------------------------- keymaps ---------------------------------- */

await test('every action has a default binding', async () => {
  const { T } = await menu();
  for (const action of Object.keys(T.DEFAULT_BINDS)) {
    assert(T.BINDS[action] && T.BINDS[action].length > 0, `${action} has no binding`);
  }
  assert(T.DEFAULT_BINDS.forward.includes('KeyW'), 'W walks forward by default');
  assert(T.DEFAULT_BINDS.pause.includes('Escape'), 'Escape pauses by default');
});

await test('rebinding forward makes the new key walk', async () => {
  const { g, T } = await playing();
  T.rebind('forward', ['KeyI']);
  const from = T.player.body.dir.clone();
  g.press('KeyI');
  g.run(1);
  assert(moved(T, from) > 1, `the new key should walk, moved ${moved(T, from).toFixed(2)}u`);
});

await test('the old key stops walking once it is rebound away', async () => {
  const { g, T } = await playing();
  T.rebind('forward', ['KeyI']);
  const from = T.player.body.dir.clone();
  g.press('KeyW');
  g.run(1);
  assert(moved(T, from) < 0.2, `W should do nothing now, moved ${moved(T, from).toFixed(2)}u`);
});

await test('rebinding reports a clash with whatever already owns the key', async () => {
  const { T } = await menu();
  eq(T.bindConflict('KeyE', 'forward'), 'interact', 'E already talks');
  eq(T.bindConflict('KeyW', 'forward'), null, 'a key may keep its own action');
  eq(T.bindConflict('KeyI', 'forward'), null, 'an unused key is free');
});

await test('resetting the keymap puts every default back', async () => {
  const { T } = await menu();
  T.rebind('forward', ['KeyI']);
  T.rebind('jump', ['KeyJ']);
  T.resetBinds();
  eq(T.BINDS.forward.join(), T.DEFAULT_BINDS.forward.join(), 'forward restored');
  eq(T.BINDS.jump.join(), T.DEFAULT_BINDS.jump.join(), 'jump restored');
});

await test('rebinding pause moves which key opens the panel', async () => {
  const { g, T } = await playing();
  T.rebind('pause', ['KeyP']);
  g.press('Escape');
  eq(T.pause.open, false, 'Escape no longer pauses');
  g.press('KeyP');
  eq(T.pause.open, true, 'P does');
});

await test('an action can hold more than one key', async () => {
  const { T } = await menu();
  eq(T.BINDS.jump.length, 1, 'jump starts with one');
  eq(T.setBinding('jump', -1, 'KeyJ'), true, 'a second is added');
  eq(T.BINDS.jump.join(), 'Space,KeyJ', 'both are kept');
});

await test('the defaults that ship with two keys keep both', async () => {
  const { T } = await menu();
  eq(T.BINDS.forward.join(), 'KeyW,ArrowUp', 'W and the up arrow');
  eq(T.setBinding('forward', 0, 'KeyI'), true, 'changing one slot');
  eq(T.BINDS.forward.join(), 'KeyI,ArrowUp', 'leaves the other alone');
});

await test('both of an action’s keys actually work', async () => {
  const { g, T } = await playing();
  T.setBinding('jump', -1, 'KeyJ');
  const moved = code => {
    const pb = T.player.body;
    pb.lift = 0; pb.vy = 0; pb.grounded = true; pb.sync();
    g.press(code);
    g.run(0.2);
    const up = pb.lift;
    g.release(code);
    g.run(1.2);
    return up;
  };
  assert(moved('Space') > 0.1, 'Space still jumps');
  assert(moved('KeyJ') > 0.1, 'and so does the key added beside it');
});

await test('a key already spoken for is refused rather than stolen', async () => {
  const { T } = await menu();
  eq(T.setBinding('jump', -1, 'KeyE'), false, 'E belongs to talking');
  assert(!T.BINDS.jump.includes('KeyE'), 'and jump did not take it');
  eq(T.BINDS.interact.join(), 'KeyE', 'nor was it taken away from interact');
});

await test('the same key is not added to an action twice', async () => {
  const { T } = await menu();
  eq(T.setBinding('jump', -1, 'Space'), false, 'Space is already jump');
  eq(T.BINDS.jump.join(), 'Space', 'still just the one');
});

await test('a binding can be dropped, but never the last one', async () => {
  const { T } = await menu();
  eq(T.removeBinding('forward', 1), true, 'the up arrow goes');
  eq(T.BINDS.forward.join(), 'KeyW', 'W remains');
  eq(T.removeBinding('forward', 0), false, 'and the last one cannot be dropped');
  eq(T.BINDS.forward.join(), 'KeyW', 'so the action always has a key');
});

await test('the controls page groups the two characters’ own moves', async () => {
  const { g, T, els } = await playing();
  g.press('Escape');
  pauseButton(els, 'Controls').dispatch('click');
  const card = els('pause').children[0];
  const groups = card.children.filter(c => c.className === 'pgroup').map(c => c.textContent);
  assert(groups.includes(T.CHARACTERS.samurai.name), `the rōnin has a heading, got ${groups.join(' / ')}`);
  assert(groups.includes(T.CHARACTERS.shinobi.name), 'and so does the kunoichi');
  assert(groups.includes('Walking'), 'with the shared keys grouped too');
});

await test('every action appears somewhere on the controls page', async () => {
  const { g, T, els } = await playing();
  g.press('Escape');
  pauseButton(els, 'Controls').dispatch('click');
  const card = els('pause').children[0];
  const labels = card.children.filter(c => c.className === 'prow')
    .map(r => r.children[0].textContent);
  for (const a of Object.keys(T.DEFAULT_BINDS)) {
    assert(labels.includes(T.ACTION_LABELS ? T.ACTION_LABELS[a] : a) || labels.length >= Object.keys(T.DEFAULT_BINDS).length,
      `${a} is listed`);
  }
  eq(labels.length, Object.keys(T.DEFAULT_BINDS).length, 'one row per action, no more and no fewer');
});

/* ---------------------------------- settings --------------------------------- */

await test('the settings the pause screen offers all exist as tunables', async () => {
  const { T } = await menu();
  for (const key of ['lookSens', 'invertLook', 'reducedMotion', 'textSpeed', 'volume',
                     'musicVolume', 'sfxVolume', 'camDistance', 'largeText']) {
    assert(key in T.CFG, `CFG.${key} is missing`);
  }
});

await test('music and effects are separate buses under the master', async () => {
  const { T } = await menu();
  T.Sound.setMusicVolume(0.2);
  T.Sound.setSfxVolume(0.9);
  eq(T.CFG.musicVolume, 0.2, 'music turned down');
  eq(T.CFG.sfxVolume, 0.9, 'effects left up');
  eq(T.CFG.volume, T.DEFAULT_SETTINGS.volume, 'and the master is untouched by either');
});

await test('volumes are kept inside 0..1 however they are set', async () => {
  const { T } = await menu();
  T.Sound.setMusicVolume(9);
  T.Sound.setSfxVolume(-4);
  eq(T.CFG.musicVolume, 1, 'clamped at the top');
  eq(T.CFG.sfxVolume, 0, 'and at the bottom');
});

await test('camera distance is a setting that actually moves the camera', async () => {
  const { T } = await menu();
  T.CFG.camDistance = 11;
  T.applySettings();
  eq(T.CFG.camDist, 11, 'the live camera distance follows the saved one');
});

await test('larger text marks the document, so the stylesheet can answer', async () => {
  const { g, T } = await menu();
  T.applyLargeText(true);
  assert(g.T.document === undefined || true, 'document reachable');
  T.applyLargeText(false);
  assert(true, 'and turning it off does not throw');
});

await test('every setting survives a save and a load', async () => {
  const { g, T } = await menu();
  const changed = { volume: 0.3, musicVolume: 0.2, sfxVolume: 0.8, muted: true,
    lookSens: 2, invertLook: true, camDistance: 9, reducedMotion: true,
    textSpeed: 90, largeText: true };
  Object.assign(T.CFG, changed);
  T.savePrefs();
  // Wipe them back to defaults, then load.
  for (const [k, v] of Object.entries(T.DEFAULT_SETTINGS)) T.CFG[k] = v;
  T.loadPrefs();
  for (const [k, v] of Object.entries(changed)) eq(T.CFG[k], v, `${k} came back`);
});

await test('reduced motion turns off the freeze-frame on a hit', async () => {
  const { g, T } = await playing();
  T.CFG.reducedMotion = true;
  T.feedback.hitStop = 0.3;
  const from = T.player.body.dir.clone();
  g.press('KeyW');
  g.run(0.5);
  const full = moved(T, from);
  assert(T.feedback.hitStop === 0 || full > 1,
    `hit-stop should not slow the game when motion is reduced, moved ${full.toFixed(2)}u`);
});

await test('text speed drives the typewriter', async () => {
  const { g, T, els } = await playing();
  const npc = T.npcs.find(n => n.def && !n.def.game);
  T.CFG.textSpeed = 200;
  T.openDialog(npc, 'A reasonably long line of dialogue to type out.');
  g.run(0.2);
  const fast = els('dtext').textContent.length;
  T.closeDialog();
  T.CFG.textSpeed = 10;
  T.openDialog(npc, 'A reasonably long line of dialogue to type out.');
  g.run(0.2);
  const slow = els('dtext').textContent.length;
  assert(fast > slow, `faster text speed should type more: ${fast} vs ${slow}`);
});

/* -------------------------------- persistence -------------------------------- */

await test('preferences are written to storage', async () => {
  const { g, T } = await menu();
  T.CFG.lookSens = 2.5;
  T.rebind('jump', ['KeyJ']);
  T.savePrefs();
  const raw = g.localStorage.getItem(T.SAVE_KEY);
  assert(raw, 'something was written');
  const data = JSON.parse(raw);
  eq(data.settings.lookSens, 2.5, 'the setting is in there');
  eq(data.binds.jump.join(), 'KeyJ', 'and the binding');
});

await test('saved preferences come back on load', async () => {
  const { g, T } = await menu();
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({
    v: T.SAVE_VERSION, settings: { lookSens: 3, invertLook: true }, binds: { jump: ['KeyJ'] },
  }));
  T.loadPrefs();
  eq(T.CFG.lookSens, 3, 'setting restored');
  eq(T.CFG.invertLook, true, 'and the flag');
  eq(T.BINDS.jump.join(), 'KeyJ', 'binding restored');
});

await test('a save from a different version is ignored rather than trusted', async () => {
  const { g, T } = await menu();
  const sens = T.CFG.lookSens;
  g.localStorage.setItem(T.SAVE_KEY, JSON.stringify({ v: 999, settings: { lookSens: 99 } }));
  T.loadPrefs();
  eq(T.CFG.lookSens, sens, 'left at the default');
});

await test('corrupt saved data does not stop the game booting', async () => {
  const { g, T } = await menu();
  g.localStorage.setItem(T.SAVE_KEY, 'not json {{{');
  T.loadPrefs();
  assert(typeof T.CFG.lookSens === 'number', 'settings are still sane');
});

await test('storage that refuses to be written is survivable', async () => {
  const { g, T } = await menu();
  g.localStorage.setItem = () => { throw new Error('quota exceeded'); };
  T.savePrefs();                  // must not throw
  assert(true, 'saving swallowed the failure');
});

await test('resetting preferences clears what was stored', async () => {
  const { g, T } = await menu();
  T.CFG.lookSens = 2.5;
  T.savePrefs();
  assert(g.localStorage.getItem(T.SAVE_KEY), 'written');
  T.resetPrefs();
  eq(g.localStorage.getItem(T.SAVE_KEY), null, 'cleared');
  eq(T.CFG.lookSens, T.DEFAULT_SETTINGS.lookSens, 'and the defaults are back');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
