/* Behaviour tests for the character select screen, the kunoichi, and the rōnin's wolf. */
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
async function playing(id) {
  const { g, T, els } = await menu();
  T.start(id);
  for (const h of T.hosts) h.chCd = 1e9;
  return { g, T, els };
}
/** A button on the pause card, by its label. */
function pauseButton(els, label) {
  const card = els('pause').children[0];
  return card && card.children.find(c => c.tagName === 'BUTTON' && c.textContent === label);
}
function placePlayer(T, host, dist, face) {
  const pb = T.player.body;
  for (let i = 0; i < 400; i++) {
    const d = T.offsetDir(host.b.dir, (i / 400) * 6.283, dist / T.R, new T.THREE.Vector3());
    if (!T.onLand(d)) continue;
    pb.dir.copy(d); pb.fixFwd(); pb.lift = 0; pb.vy = 0; pb.grounded = true;
    if (face) T.tangentToward(pb.dir, host.b.dir, pb.dir, pb.fwd);
    pb.sync();
    return;
  }
  throw new Error('test setup: no land near the host');
}

/* ---------------------------- the select screen ---------------------------- */

await test('the game opens on the select screen, not in play', async () => {
  const { T, els } = await menu();
  eq(T.started, false, 'not started');
  assert(!els('overlay').className.includes('hide'), 'the overlay is up');
  eq(T.menu.cards.length, 2, 'two characters offered');
});

await test('both characters are built from the registry', async () => {
  const { T } = await menu();
  const names = T.CHAR_ORDER.map(id => T.CHARACTERS[id].name);
  eq(names.join(' / '), 'The Rōnin / The Kunoichi', 'roster');
  eq(T.menu.cards.map(c => c.children[0].textContent).join(''), '侍忍', 'seals on the cards');
  eq(T.menu.cards.map(c => c.children[1].textContent).join(' / '), names.join(' / '), 'names on the cards');
});

await test('a stray keypress does not start the game — a choice is required', async () => {
  const { g, T, els } = await menu();
  for (const k of ['KeyZ', 'KeyM', 'KeyE', 'Escape', 'ShiftLeft']) g.press(k);
  eq(T.started, false, 'still choosing');
  assert(!els('overlay').className.includes('hide'), 'overlay still up');
});

await test('start() refuses anything that is not a character', async () => {
  const { T } = await menu();
  T.start();
  T.start('wolf');
  T.start(null);
  eq(T.started, false, 'nothing started');
});

await test('arrows move the highlight and Enter begins', async () => {
  const { g, T, els } = await menu();
  eq(T.menu.i, 0, 'the rōnin is highlighted first');
  assert(T.menu.cards[0].className.includes('on'), 'card 0 marked');
  g.press('ArrowRight');
  eq(T.menu.i, 1, 'moved to the kunoichi');
  assert(T.menu.cards[1].className.includes('on') && !T.menu.cards[0].className.includes('on'), 'highlight moved');
  g.press('ArrowLeft'); g.press('ArrowLeft');
  eq(T.menu.i, 1, 'the highlight wraps around');
  g.press('Enter');
  eq(T.started, true, 'Enter begins');
  eq(T.player.char.id, 'shinobi', 'with the highlighted character');
  assert(els('overlay').className.includes('hide'), 'overlay dismissed');
});

await test('clicking a card picks that character', async () => {
  const { T } = await menu();
  T.menu.cards[1].dispatch('click');
  eq(T.started, true, 'started');
  eq(T.player.char.id, 'shinobi', 'the clicked one');
});

/* ------------------------------- the kunoichi ------------------------------ */

await test('the kunoichi is a sibling of the rōnin, not a copy', async () => {
  const { T } = await playing('shinobi');
  const c = T.player.char;
  eq(c.hp, 3, 'fewer hearts');
  eq(T.playerHP(), 3, 'and the battle HUD agrees');
  assert(c.speed > 1, 'quicker on her feet');
  eq(c.art, 'kunai', 'ranged');
  eq(c.wolf, false, 'no companion');
  assert(!c.look.katana, 'carries no katana');
  assert(T.player.h.arms[0].children.includes(T.player.blade), 'holds her own weapon');
});

await test('the rōnin is untouched', async () => {
  const { T } = await playing('samurai');
  eq(T.playerHP(), 5, 'five hearts');
  eq(T.player.char.speed, 1, 'the original pace');
  eq(T.player.char.art, 'blade', 'sword');
  assert(T.player.char.look.katana, 'wears the katana');
});

await test('left click throws a kunai that flies and lands damage', async () => {
  const { g, T } = await playing('shinobi');
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 7, true);
  eq(T.kunai.length, 0, 'none in the air yet');
  g.click(0);                                   // the real pointerdown binding
  g.run(0.2);
  assert(T.kunai.length > 0 || T.ch.active, 'a kunai should have left her hand');
  g.run(2, 0.02, () => !T.ch.active);
  assert(T.ch.active, 'hitting a yokai starts the fight');
  eq(T.ch.active.g, T.BATTLE, 'an ordinary battle');
  eq(T.ch.active.host, host, 'against the one she hit');
  assert(T.ch.active.hp < T.ch.active.st.hp, 'and the kunai did damage');
});

await test('a kunai that hits nothing is cleaned up', async () => {
  const { g, T } = await playing('shinobi');
  T.throwKunai();
  g.run(0.2);
  const flying = T.kunai.length;
  assert(flying > 0, 'in flight');
  g.run(3);
  eq(T.kunai.length, 0, 'expired and removed');
});

await test('the kunoichi has a throw cooldown and never swings a sword', async () => {
  const { g, T } = await playing('shinobi');
  for (let i = 0; i < 5; i++) T.attack();       // mash the button
  g.run(0.3);
  eq(T.kunai.length, 1, 'only one kunai per cooldown');
  eq(T.sw.step, 0, 'the sword combo never advances for her');
  assert(!T.player.h.action || T.player.h.action.type === 'throw', 'she throws, she does not slash');
});

await test('Q is a shadow dash for her, and nothing for him', async () => {
  const her = await playing('shinobi');
  const pb = her.T.player.body;
  const from = pb.dir.clone();
  her.g.press('KeyQ');
  her.g.run(0.3);
  const moved = her.T.angleBetween(from, pb.dir) * her.T.R;
  assert(moved > 1.0, `the dash should cover ground, moved ${moved.toFixed(2)}u`);
  assert(her.T.dash.cd > 0, 'and go on cooldown');

  const him = await playing('samurai');
  const hb = him.T.player.body;
  const hFrom = hb.dir.clone();
  him.g.press('KeyQ');
  him.g.run(0.3);
  assert(him.T.angleBetween(hFrom, hb.dir) * him.T.R < 0.2, 'the rōnin has no dash');
  eq(him.T.dash.cd, 0, 'and no cooldown to speak of');
});

await test('dashing slips a blow', async () => {
  const { T } = await playing('shinobi');
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 1.5);
  T.startChallenge(host, T.BATTLE);
  const c = T.ch.active;
  const before = c.php;
  T.player.inv = 0.3;                           // mid-dash
  T.BATTLE.hurtPlayer(c);
  eq(c.php, before, 'untouchable through the dash');
  T.player.inv = 0; c.pinv = 0;
  T.BATTLE.hurtPlayer(c);
  eq(c.php, before - 1, 'and vulnerable again after');
});

await test('she actually moves faster than he does', async () => {
  const dist = async id => {
    const { g, T } = await playing(id);
    const from = T.player.body.dir.clone();
    g.press('KeyW');
    g.run(2);
    return T.angleBetween(from, T.player.body.dir) * T.R;
  };
  const him = await dist('samurai'), her = await dist('shinobi');
  assert(her > him * 1.1, `kunoichi should outpace the rōnin: ${him.toFixed(2)}u vs ${her.toFixed(2)}u`);
});

/** Every colour used anywhere in a character's model. */
function palette(h) {
  const out = new Set();
  h.root.traverse(o => { if (o.isMesh && o.material.color) out.add(o.material.color.getHexString()); });
  return out;
}

await test('the kunoichi reads as a woman, using the markers this game already uses', async () => {
  const { T } = await playing('shinobi');
  const look = T.player.char.look, h = T.player.h;
  eq(look.hair, 'bun', 'the bun is how Hanako and Yuki are drawn');
  assert(palette(h).has('f49ab4'), 'so she gets the same pink kanzashi hairpin');
  assert(h.ponytail, 'long hair swept down the back');
  assert(look.hakama, 'a flared hip piece rather than a straight tunic');
  eq(h.upper.scale.x, 0.86, 'narrower shoulders');
  assert(look.hair !== 'hood', 'no hood — that is what made her read as generic');
});

await test('she is still unmistakably a shinobi', async () => {
  const { T } = await playing('shinobi');
  assert(T.player.char.look.facemask, 'cloth over the lower face');
  assert(!T.player.char.look.katana, 'no sword');
  eq(T.player.char.art, 'kunai', 'kunai at range');
});

await test('the face cloth reads as cloth, not as a beard', async () => {
  const { T } = await playing('shinobi');
  const head = T.player.h.head, mask = T.player.char.look.facemask;
  let band = null, ties = 0, eyeBottom = 1, headR = 0, headRY = 0;
  for (const o of head.children) {
    if (!o.isMesh) continue;
    const hex = o.material.color.getHexString();
    if (hex === '1a1616' && o.scale.x < 0.06) eyeBottom = Math.min(eyeBottom, o.position.y - o.scale.y / 2);
    if (hex === T.player.char.look.skin.slice(1) && o.scale.x > 0.2) { headR = o.scale.x; headRY = o.scale.y; }
    if (hex === mask.slice(1)) { if (o.scale.x > 0.2) band = o; else ties++; }
  }
  assert(band, 'there is a band');
  const top = band.position.y + band.scale.y / 2, bot = band.position.y - band.scale.y / 2;

  // A beard clings to the chin. This has to wrap the whole head, at every height it covers.
  for (let y = bot; y <= top; y += 0.01) {
    const r = Math.abs(y) >= headRY ? 0 : headR * Math.sqrt(1 - (y / headRY) ** 2);
    assert(band.scale.x > r, `band sinks into the head at y=${y.toFixed(2)}`);
  }
  assert(bot <= -headRY, 'and carry on past the chin');
  eq(ties, 2, 'knotted at both sides');
  assert(top < eyeBottom, 'sitting clear below the eyes');

  // A beard is hair-coloured. This must not be.
  assert(mask.toLowerCase() !== T.player.char.look.hairColor.toLowerCase(), 'not the hair colour');
  const hue = h => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
  const [mr, mg, mb] = hue(mask), [hr2, hg, hb] = hue(T.player.char.look.hairColor);
  const gap = Math.abs(mr - hr2) + Math.abs(mg - hg) + Math.abs(mb - hb);
  assert(gap > 150, `cloth must be clearly lighter than the hair, channel gap was ${gap}`);
});

await test('the new body options touch nobody else', async () => {
  const { T } = await playing('samurai');
  eq(T.player.h.upper.scale.x, 1, 'the rōnin keeps his shoulders');
  assert(!T.player.h.ponytail, 'and his hair');
  for (const def of T.NPC_DEFS) {
    assert(!def.look.ponytail && !def.look.facemask && !def.look.slim,
      `${def.name} should not have picked up the new flags`);
  }
  const kage = T.npcs.find(n => n.def && n.def.id === 'kage');
  eq(kage.h.upper.scale.x, 1, 'Kage the ninja is unchanged');
});

/* --------------------------------- the wolf -------------------------------- */

await test('the wolf comes with the rōnin only', async () => {
  const him = await playing('samurai');
  assert(him.T.wolf, 'the rōnin has his wolf');
  assert(him.T.critters.includes(him.T.wolf), 'it ticks with the other animals');

  const her = await playing('shinobi');
  eq(her.T.wolf, null, 'the kunoichi walks alone');
});

await test('the wolf keeps up with the rōnin', async () => {
  const { g, T } = await playing('samurai');
  const pb = T.player.body;
  const far = T.offsetDir(pb.dir, 0.7, 11 / T.R, new T.THREE.Vector3());
  if (T.onLand(far)) { pb.dir.copy(far); pb.fixFwd(); pb.sync(); }
  const start = T.angleBetween(T.wolf.b.dir, pb.dir) * T.R;
  g.run(6);
  const end = T.angleBetween(T.wolf.b.dir, pb.dir) * T.R;
  assert(end < start, `the wolf should close in: ${start.toFixed(2)}u -> ${end.toFixed(2)}u`);
  eq(T.wolf.state, 'follow', 'and never lose interest');
});

await test('the wolf cannot touch combat, collisions or difficulty', async () => {
  const { T } = await playing('samurai');
  assert(!T.hosts.includes(T.wolf), 'not a sword target or a challenge host');
  assert(!T.wolf.def, 'no challenge definition at all');
  assert(!T.wolf.col, 'registers no collider');
  assert(!T.colliders.some(c => c === T.wolf.col), 'nothing of it in the collider list');
  eq(T.playerHP(), 5, 'the rōnin still has exactly five hearts');
});

/* -------------------- returning to the menu, and stale state ------------------- */

await test('Escape pauses, and quitting from there goes back to the select screen', async () => {
  const { g, T, els } = await playing('samurai');
  g.run(0.5);
  g.press('Escape');
  eq(T.started, true, 'pausing alone does not end the run');
  eq(T.pause.open, true, 'the pause screen is up');
  pauseButton(els, 'Quit to menu').dispatch('click');
  pauseButton(els, 'Quit to menu').dispatch('click');   // and again to confirm
  eq(T.started, false, 'back on the menu');
  assert(!els('overlay').className.includes('hide'), 'overlay is up again');
});

await test('Escape in a challenge pauses it, and forfeiting is a deliberate choice', async () => {
  const { g, T, els } = await playing('samurai');
  const host = T.hosts.find(h => h.def.game === 'shell');
  T.startChallenge(host, T.GAMES.shell);
  g.press('Escape');
  eq(T.started, true, 'still playing');
  eq(T.ch.active.result, null, 'nothing forfeited by the pause itself');
  pauseButton(els, 'Forfeit challenge').dispatch('click');
  eq(T.ch.active.result, 'lose', 'the challenge was forfeited');
});

await test('going back to the menu takes the wolf with it', async () => {
  const { g, T } = await playing('samurai');
  assert(T.wolf, 'wolf present');
  const before = T.critters.length;
  T.quitToMenu();
  eq(T.wolf, null, 'wolf gone');
  eq(T.critters.length, before - 1, 'and removed from the world');
});

await test('re-selecting leaves nothing of the last character behind', async () => {
  const { g, T } = await playing('samurai');
  const pb0 = T.player.body;
  pb0.dir.copy(T.offsetDir(pb0.dir, 1, 20 / T.R, new T.THREE.Vector3()));
  pb0.fixFwd(); pb0.sync();
  T.sw.step = 2; T.sw.cd = 1;                      // mid-combo when they quit
  T.quitToMenu();
  T.start('shinobi');

  eq(T.player.char.id, 'shinobi', 'now the kunoichi');
  eq(T.wolf, null, 'no wolf carried over');
  eq(T.kunai.length, 0, 'no kunai in the air');
  eq(T.sw.step, 0, 'sword combo state cleared');
  eq(T.sw.cd, 0, 'and its cooldown');
  eq(T.dash.cd, 0, 'dash ready');
  eq(T.player.vel.length(), 0, 'standing still');
  assert(T.angleBetween(T.player.body.dir, T.SPAWN) * T.R < 0.01, 'back at the spawn point');
  assert(!T.player.char.look.katana, 'and holding no katana');
});

await test('switching back the other way restores the wolf and the sword', async () => {
  const { g, T } = await playing('shinobi');
  T.throwKunai();
  g.run(0.3);
  assert(T.kunai.length > 0, 'a kunai is in the air');
  T.quitToMenu();
  T.start('samurai');
  eq(T.kunai.length, 0, 'her kunai are gone');
  assert(T.wolf, 'his wolf is back');
  eq(T.playerHP(), 5, 'five hearts again');
  eq(T.player.char.art, 'blade', 'sword back in hand');
});

await test('a battle after re-selecting uses the new character sheet', async () => {
  const { T } = await playing('samurai');
  T.quitToMenu();
  T.start('shinobi');
  for (const h of T.hosts) h.chCd = 1e9;
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 3);
  T.startChallenge(host, T.BATTLE);
  eq(T.ch.active.php, 3, 'she brings three hearts into the fight');
});

/* ------------------------- the rōnin's armour ------------------------- */

await test('the rōnin wears a kabuto and a menpō', async () => {
  const { T } = await playing('samurai');
  const o = T.player.char.look;
  assert(o.kabuto, 'the look names a helmet');
  assert(o.menpo, 'and a face mask');
  const hex = c => c.slice(1).toLowerCase();
  const worn = new Set();
  for (const m of T.player.h.head.children) if (m.isMesh) worn.add(m.material.color.getHexString());
  assert(worn.has(hex(o.kabuto)), 'the helmet is actually on his head');
  assert(worn.has(hex(o.menpo)), 'and so is the mask');
  assert(worn.has(hex(o.maedate)), 'with the crest on the front');
});

await test('the helmet covers the crown and the mask stays below the eyes', async () => {
  const { T } = await playing('samurai');
  const o = T.player.char.look, head = T.player.h.head;
  const hex = c => c.slice(1).toLowerCase();
  /* Measure real extents. `part` scale means a radius on ico/cyl but a full width on
     box, so comparing raw scale across geometries would be meaningless. */
  const boxOf = m => {
    m.geometry.computeBoundingBox();
    return m.geometry.boundingBox.clone()
      .applyMatrix4(new T.THREE.Matrix4().compose(m.position, m.quaternion, m.scale));
  };
  let bowl = null, mask = null, eyeBottom = Infinity, crown = -Infinity;
  for (const m of head.children) {
    if (!m.isMesh) continue;
    const c = m.material.color.getHexString(), b = boxOf(m);
    if (c === '1a1616' && m.scale.x < 0.06) eyeBottom = Math.min(eyeBottom, b.min.y);
    if (c === hex(o.skin || '#f0c9a4') && m.scale.x > 0.2) crown = Math.max(crown, b.max.y);
    // the bowl and the face plate are the wide pieces; crest and rivets are small
    if (c === hex(o.kabuto) && m.scale.x > 0.25 && (!bowl || b.max.y > boxOf(bowl).max.y)) bowl = m;
    if (c === hex(o.menpo) && m.scale.x > 0.2) mask = m;
  }
  assert(bowl, 'there is a helmet bowl');
  assert(mask, 'there is a face plate');
  assert(eyeBottom < Infinity && crown > -Infinity, 'found the eyes and the head');
  const bb = boxOf(bowl), mb = boxOf(mask);
  assert(bb.max.y >= crown, 'the bowl sits over the crown, not behind it');
  assert(bb.min.y > eyeBottom, 'and its rim clears the eyes');
  assert(mb.max.y < eyeBottom, 'the face plate stays below the eyes');
  assert(mb.min.y < -0.2, 'and carries past the chin rather than floating on it');
});

await test('the white headband is gone, replaced by the helmet', async () => {
  const { T } = await playing('samurai');
  assert(!T.player.char.look.headband, 'no headband in the look');
  for (const m of T.player.h.head.children) {
    if (m.isMesh) assert(m.material.color.getHexString() !== 'f2efe8', 'and none left on the model');
  }
});

await test('the armour flags touch nobody else', async () => {
  const { T } = await playing('samurai');
  for (const def of T.NPC_DEFS) {
    assert(!def.look.kabuto && !def.look.menpo && !def.look.maedate,
      `${def.name} should not have picked up the armour flags`);
  }
  assert(!T.CHARACTERS.shinobi.look.kabuto, 'and the kunoichi stays bare-headed');
});

/* ------------------------- the rōnin's dodge roll ------------------------- */

await test('Alt rolls the rōnin, and goes on cooldown', async () => {
  const { g, T } = await playing('samurai');
  const pb = T.player.body;
  const from = pb.dir.clone();
  g.press('AltLeft');
  g.run(0.3);
  const moved = T.angleBetween(from, pb.dir) * T.R;
  assert(moved > 1.0, `the roll should cover ground, moved ${moved.toFixed(2)}u`);
  assert(T.roll.cd > 0, 'and go on cooldown');
});

await test('the roll makes him briefly untouchable', async () => {
  const { g, T } = await playing('samurai');
  g.press('AltLeft');
  assert(T.player.inv > 0, 'invulnerable the moment he commits');
  g.run(1.2);
  eq(T.player.inv, 0, 'and open again once it is over');
});

await test('rolling slips a blow', async () => {
  const { g, T } = await playing('samurai');
  const host = T.hosts.find(h => h.def.game === 'iai');
  placePlayer(T, host, 1.5);
  T.startChallenge(host, T.BATTLE);
  const c = T.ch.active;
  const before = c.php;
  g.press('AltLeft');
  T.BATTLE.hurtPlayer(c);
  eq(c.php, before, 'untouchable through the roll');
  T.player.inv = 0; c.pinv = 0;
  T.BATTLE.hurtPlayer(c);
  eq(c.php, before - 1, 'and vulnerable again after');
});

await test('the roll will not chain — a second Alt waits for the cooldown', async () => {
  const { g, T } = await playing('samurai');
  const pb = T.player.body;
  g.press('AltLeft');
  g.run(0.4);
  const after = pb.dir.clone(), cd = T.roll.cd;
  assert(cd > 0, 'still cooling down');
  g.press('AltLeft');
  g.run(0.2);
  assert(T.angleBetween(after, pb.dir) * T.R < 0.2, 'the second press did nothing');
  assert(T.roll.cd < cd, 'and the cooldown kept running down rather than resetting');
});

await test('Alt is the rōnin\u2019s move, not the kunoichi\u2019s', async () => {
  const { g, T } = await playing('shinobi');
  const pb = T.player.body;
  const from = pb.dir.clone();
  g.press('AltLeft');
  g.run(0.3);
  assert(T.angleBetween(from, pb.dir) * T.R < 0.2, 'she does not roll');
  eq(T.roll.cd, 0, 'and burns no cooldown');
});

/* ------------------------------------------------------------------ */
const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
