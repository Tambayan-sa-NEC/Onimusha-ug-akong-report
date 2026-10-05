/* Behaviour tests for the sealed boss arenas. */
import { boot } from './env.js';

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name, '']); pass++; }
  catch (e) { results.push(['FAIL', name, e.message]); fail++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`); }

/** A booted game already playing as `id`, with nobody hunting. */
async function bootPlaying(id) {
  const g = await boot();
  g.T.start(id);
  for (const h of g.T.hosts) h.chCd = 1e9;
  return { g, T: g.T };
}

/** Is `obj` underneath `root` anywhere in the scene graph? */
function under(root, obj) {
  for (let n = obj; n; n = n.parent) if (n === root) return true;
  return false;
}

await test('the planet lives under worldRoot, the player does not', async () => {
  const { T } = await boot();
  assert(T.worldRoot, 'Stage exports worldRoot');
  assert(T.arenaRoot, 'Stage exports arenaRoot');
  eq(T.arenaRoot.visible, false, 'the arena layer starts hidden');
  assert(under(T.worldRoot, T.water), 'the water sphere is in the world layer');
  assert(!under(T.worldRoot, T.player.h.root), 'the player is not in the world layer');
});

await test('hiding worldRoot hides the planet but not the player', async () => {
  const { T } = await boot();
  T.worldRoot.visible = false;
  let hiddenWorld = 0, visiblePlayer = 0;
  T.scene.traverse(o => {
    if (!o.isMesh) return;
    let vis = true;
    for (let n = o; n; n = n.parent) if (n.visible === false) { vis = false; break; }
    if (under(T.worldRoot, o)) { if (!vis) hiddenWorld++; }
    else if (under(T.player.h.root, o) && vis) visiblePlayer++;
  });
  assert(hiddenWorld > 100, `the whole world should hide, only ${hiddenWorld} meshes did`);
  assert(visiblePlayer > 0, 'the player should stay visible');
});

await test('an installed ground override replaces heightAt', async () => {
  const { T } = await boot();
  const spot = T.SPAWN.clone();
  const planet = T.heightAt(spot);
  assert(planet > T.R, 'the planet has ground at spawn');

  T.setGroundOverride(() => 999);
  eq(T.heightAt(spot), 999, 'the override answers instead');

  T.setGroundOverride(null);
  eq(T.heightAt(spot), planet, 'clearing it restores the planet exactly');
});

await test('each arena has walkable ground inside and none outside', async () => {
  const { T } = await boot();
  for (const id of ['peak', 'marsh']) {
    const a = T.ARENAS[id];
    assert(a, `${id} exists`);
    eq(a.id, id, 'id matches its key');

    const inside = a.height(a.centre);
    assert(inside > T.WALK_MIN, `${id}: the centre is walkable (got ${inside})`);
    assert(a.height(a.entry) > T.WALK_MIN, `${id}: the entry point is walkable`);
    assert(T.angleBetween(a.entry, a.centre) * T.R < a.radius,
      `${id}: the entry point is inside the radius`);

    const u = new T.THREE.Vector3(), v = new T.THREE.Vector3();
    T.tangentBasis(a.centre, u, v);
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2;
      const ang = (a.radius + 1) / T.R;
      const d = a.centre.clone().multiplyScalar(Math.cos(ang))
        .addScaledVector(u, Math.cos(th) * Math.sin(ang))
        .addScaledVector(v, Math.sin(th) * Math.sin(ang)).normalize();
      assert(a.height(d) < T.WALK_MIN, `${id}: no ground past the rim at bearing ${i}`);
    }
  }
});

await test('the two arenas are distinguishable', async () => {
  const { T } = await boot();
  const p = T.ARENAS.peak, m = T.ARENAS.marsh;
  eq(p.radius, 12, 'peak radius');
  eq(m.radius, 13, 'marsh radius');
  assert(p.sky !== m.sky, 'different skies');
  assert(T.angleBetween(p.centre, m.centre) > 0.5, 'different places on the sphere');
  assert(p.height(p.centre) !== m.height(m.centre), 'different floor heights');
});

await test('building an arena draws nothing from the world random stream', async () => {
  // Two independent boots are at the same point in the seeded stream. Build the
  // arenas in one of them only; if build() consumed a draw, the next value diverges.
  const a = await boot();
  const b = await boot();
  const g = a.T.ARENAS.peak.build();
  a.T.ARENAS.marsh.build();
  assert(g.isGroup, 'build returns a Group');
  assert(g.children.length > 0, 'and it has contents');
  eq(a.T.rand(), b.T.rand(), 'the world stream is left exactly where it was');
});

await test('entering an arena hides the world and moves the player', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  T.arena.enter('peak', home);

  assert(T.arena.active, 'an arena is active');
  eq(T.arena.active.id, 'peak', 'the right one');
  eq(T.worldRoot.visible, false, 'the world is hidden');
  eq(T.arenaRoot.visible, true, 'the arena is shown');
  eq(T.petals.visible, false, 'petals are hidden');

  const a = T.ARENAS.peak;
  assert(T.angleBetween(T.player.body.dir, a.centre) * T.R < a.radius, 'the player is inside the arena');
  assert(T.onLand(T.player.body.dir), 'standing on arena ground');
  eq(T.heightAt(a.centre), a.height(a.centre), 'heightAt now answers from the arena');
});

await test('leaving restores the world exactly and returns the player', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  const sky = T.scene.background.getHex();
  const near = T.scene.fog.near, far = T.scene.fog.far;
  const planetGround = T.heightAt(home);

  T.arena.enter('peak', home);
  assert(T.scene.background.getHex() !== sky, 'the sky changed');
  T.arena.exit();

  eq(T.arena.active, null, 'no arena active');
  eq(T.worldRoot.visible, true, 'the world is back');
  eq(T.arenaRoot.visible, false, 'the arena is hidden');
  eq(T.petals.visible, true, 'petals are back');
  eq(T.scene.background.getHex(), sky, 'the sky is restored');
  eq(T.scene.fog.near, near, 'fog near restored');
  eq(T.scene.fog.far, far, 'fog far restored');
  assert(T.angleBetween(T.player.body.dir, home) * T.R < 0.01, 'the player is back where they were');
  eq(T.heightAt(home), planetGround, 'planet ground answers again');
  assert(T.onLand(home), 'and it is walkable');
});

await test('entering twice does not duplicate the arena geometry', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  T.arena.enter('peak', home);
  const first = T.arenaRoot.children.length;
  T.arena.exit();
  T.arena.enter('peak', home);
  eq(T.arenaRoot.children.length, first, 'the cached arena is reused, not rebuilt');
  T.arena.exit();
});

await test('sky and fog survive repeated entries', async () => {
  const { T } = await boot();
  const home = T.player.body.dir.clone();
  const sky = T.scene.background.getHex();
  for (let i = 0; i < 3; i++) {
    T.arena.enter(i % 2 ? 'marsh' : 'peak', home);
    T.arena.exit();
  }
  eq(T.scene.background.getHex(), sky, 'the world sky is not drifting');
});

await test('effects in flight do not survive either transition', async () => {
  const { g, T } = await bootPlaying('shinobi');
  T.throwKunai();
  g.run(0.3);
  assert(T.kunai.length > 0, 'a kunai is in the air');
  const home = T.player.body.dir.clone();
  T.arena.enter('peak', home);
  eq(T.kunai.length, 0, 'kunai cleared on the way in');
  T.emote(T.player.body.obj.position, T.player.body.dir, '!', 1);
  assert(T.emotes.length > 0, 'an emote is up');
  T.arena.exit();
  eq(T.emotes.length, 0, 'emotes cleared on the way out');
});

/** Five seals, nobody hunting, standing at the gate. */
async function atGateWithSeals() {
  const { g, T } = await bootPlaying('samurai');
  T.GAME_ORDER.slice(0, 5).forEach(k => T.won.add(k));
  g.run(0.2);
  const pb = T.player.body;
  pb.dir.copy(T.GATE_DIR); pb.fixFwd(); pb.sync();
  return { g, T };
}

await test('summoning a boss puts you in its arena', async () => {
  const { T } = await atGateWithSeals();
  T.gate.interact();
  assert(T.ch.active, 'a fight started');
  eq(T.ch.active.host.def.id, 'otengu', 'the tengu first');
  assert(T.arena.active, 'an arena opened');
  eq(T.arena.active.id, 'peak', 'and we are on its peak');
  const a = T.ARENAS.peak;
  assert(T.angleBetween(T.player.body.dir, a.centre) * T.R < a.radius, 'player inside');
  assert(T.angleBetween(T.ch.active.host.b.dir, a.centre) * T.R < a.radius, 'boss inside');
});

await test('winning returns you to the gate', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const c = T.ch.active;
  c.hp = 1;
  T.BOSS.hit(c, 9, 0, true);
  g.run(5, 0.05, () => !!T.ch.active);
  eq(T.arena.active, null, 'the arena closed');
  eq(T.worldRoot.visible, true, 'the world is back');
  assert(T.bossWon.has('otengu'), 'the seal was still awarded');
  assert(T.angleBetween(T.player.body.dir, T.GATE_DIR) * T.R < 0.01, 'back at the gate');
});

await test('losing returns you to the gate too', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  T.ch.active.php = 0;
  g.run(5, 0.05, () => !!T.ch.active);
  eq(T.arena.active, null, 'the arena closed on a loss');
  eq(T.worldRoot.visible, true, 'the world is back');
  eq(T.bossWon.size, 0, 'no seal');
  assert(T.angleBetween(T.player.body.dir, T.GATE_DIR) * T.R < 0.01, 'back at the gate');
  eq(T.gate.nextBoss().id, 'otengu', 'and it can be summoned again');
});

await test('the second boss uses the marsh', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const c = T.ch.active;
  c.hp = 1; T.BOSS.hit(c, 9, 0, true);
  g.run(5, 0.05, () => !!T.ch.active);
  T.gate.interact();
  eq(T.ch.active.host.def.id, 'orochi', 'the orochi');
  eq(T.arena.active.id, 'marsh', 'in the marsh');
});

await test('forfeiting with Esc also lets you out', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  assert(T.arena.active, 'in the arena');
  g.press('Escape');
  g.run(5, 0.05, () => !!T.ch.active);
  eq(T.arena.active, null, 'a forfeit must not strand you in a sealed space');
  eq(T.worldRoot.visible, true, 'the world is back');
  eq(T.started, true, 'and you are still playing, not dumped to the menu');
});

await test('you cannot walk out of a sealed arena', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const a = T.ARENAS.peak, pb = T.player.body;

  // Face straight out from the centre and hold sprint-forward.
  const away = pb.dir.clone().sub(a.centre).normalize();
  pb.fwd.copy(away); pb.fixFwd(); pb.sync();
  T.cam.fwd.copy(pb.fwd);
  g.press('KeyW'); g.press('ShiftLeft');

  let worst = 0;
  g.run(6, 0.05, () => {
    worst = Math.max(worst, T.angleBetween(pb.dir, a.centre) * T.R);
    return true;
  });
  assert(worst <= a.radius + 0.5, `player escaped to ${worst.toFixed(2)}u of a ${a.radius}u arena`);
  assert(T.onLand(pb.dir), 'and is still on solid ground');
});

await test('the boss cannot be charged out of the arena', async () => {
  const { g, T } = await atGateWithSeals();
  T.gate.interact();
  const a = T.ARENAS.peak, c = T.ch.active, hb = c.host.b;
  c.st.moves = ['dash'];
  c.st.dashSpeed = 40;                      // far beyond anything it would normally do
  let worst = 0;
  g.run(12, 0.02, () => {
    worst = Math.max(worst, T.angleBetween(hb.dir, a.centre) * T.R);
    return !c.result;
  });
  assert(worst <= a.radius + 0.5, `boss escaped to ${worst.toFixed(2)}u of a ${a.radius}u arena`);
});

const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
