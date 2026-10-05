/**
 * The boss fight: a battle plus a health bar, a second wind and signature moves.
 */
import { chUI, hostEmoteH, rpick } from '../challenges/system.js';
import { BATTLE } from './battle.js';
import { FX_DASH, FX_STRIKE, hostFx } from './fx.js';
import { R } from '../config/settings.js';
import { player } from '../entities/Player.js';
import { emote } from '../render/effects/emotes.js';
import { flash } from '../render/effects/flash.js';
import { impact, shockwave } from '../render/effects/impact.js';
import { burst } from '../render/effects/sparks.js';
import { Sound } from '../systems/audio.js';
import { bossBar } from '../ui/bossBar.js';
import { openDialog } from '../ui/dialog.js';
import { angleBetween } from '../utils/math.js';
import { tangentB } from '../utils/scratch.js';
import { tangentBasis, tangentToward } from '../utils/sphere.js';

/* ---------- Boss fight ----------
   The ordinary battle with three additions: a health bar, a second wind at half
   health, and one signature move each — the tengu's dive and the orochi's heads. */
/** Whoever summoned the boss says here what to do when the fight ends. */
const bossHooks = { onEnd() {} };

const BOSS = Object.assign({}, BATTLE, {
  seal: '鬼', title: 'Great Yokai', boss: true,
  how: 'Click to slash and combo. Red ring under it: a slam. Red ring ahead: a charge. Red ring under YOU: step off it.',
  start(c) {
    BATTLE.start(c);
    c.rage = false; c.heads = 0;
    c.spot = c.host.b.dir.clone();
    chUI.title.textContent = `${c.host.def.seal}  ${c.host.def.name}`;
    bossBar.show(c);
  },
  /** Second wind at half health: faster, angrier, a nastier move set. */
  enrage(c) {
    const host = c.host;
    c.rage = true;
    Object.assign(c.st, host.def.rage || {});
    c.phase = 'recover'; c.rt = 0.7;
    hostFx(host).recover = 0.7;
    c.warn.mesh.visible = false;
    flash(host.b.obj, 0.3);
    burst(host.b.obj.position, host.b.dir, 30, ['#e0503a', '#ffe08a', '#ffffff'], 7, 0.5);
    shockwave(host.b.dir, c.st.radius);
    emote(host.b.obj.position, host.b.dir, '怒!!', hostEmoteH(host) + 0.8);
    Sound.sfx('boom');
    impact(0.14, 0.5);
    if (host.def.rageLine) openDialog(host, host.def.rageLine);
  },
  beginMove(c, dist) {
    const host = c.host, hb = host.b, pb = player.body, st = c.st;
    c.move = rpick(st.moves);
    if (c.move === 'dash' && dist < st.radius * 0.8) c.move = 'slam';
    if (c.move === 'swoop' || c.move === 'heads') {
      if (c.move === 'heads' && !c.heads) c.heads = 3;
      c.phase = 'windup';
      c.wt = c.move === 'heads' ? st.windup * 0.55 : st.windup;
      c.spot.copy(pb.dir);                      // mark where you are standing right now
      c.warn.c.copy(c.spot);
      c.warn.a = (c.move === 'heads' ? 1.9 : st.radius * 0.8) / R;
      tangentBasis(c.warn.c, c.warn.u, c.warn.v);
      if (tangentToward(hb.dir, pb.dir, hb.dir, tangentB)) hb.turnToward(tangentB, Math.PI);
      emote(hb.obj.position, hb.dir, c.move === 'heads' ? `${c.heads}!` : '舞!', hostEmoteH(host) + 0.6);
      return;
    }
    BATTLE.beginMove(c, dist);
  },
  windup(c, dt, f) {
    if (c.move === 'swoop') c.host.b.lift = 3.2 * (1 - c.wt / c.st.windup);   // gathers the wind under itself
    BATTLE.windup(c, dt, f);
  },
  launch(c, f) {
    const host = c.host, hb = host.b, pb = player.body, st = c.st;
    if (c.move !== 'swoop' && c.move !== 'heads') { BATTLE.launch(c, f); return; }
    c.warn.mesh.visible = false;
    f.wind = 0; f.strike = FX_STRIKE;
    c.phase = 'strike'; c.rt = 0.22;
    const reach = c.move === 'heads' ? 1.9 : st.radius * 0.8;
    if (c.move === 'swoop') {                    // comes down on the marked ground
      hb.dir.copy(c.spot); hb.fixFwd(); hb.lift = 0; hb.sync();
      f.dash = FX_DASH;
      Sound.sfx('boom');
      impact(0.05, 0.3);
    } else {
      c.heads--;
      Sound.sfx('clash');
      impact(0, 0.14);
    }
    shockwave(c.spot, reach);
    burst(hb.obj.position, hb.dir, 14, ['#cdbf9b', '#e9dfc6', '#a89a7c'], 4, 0.3);
    if (angleBetween(pb.dir, c.spot) * R < reach && pb.lift < 0.6) c.g.hurtPlayer(c);
  },
  striking(c, dt, f) {
    if (c.move === 'heads') {                    // the heads come one after another
      if ((c.rt -= dt) > 0) return;
      if (c.heads > 0) { c.g.beginMove(c, angleBetween(player.body.dir, c.host.b.dir) * R); return; }
      c.phase = 'recover'; c.rt = c.st.recover; f.recover = c.st.recover;
      return;
    }
    BATTLE.striking(c, dt, f);
  },
  update(c, dt) {
    if (!c.rage && c.hp <= c.st.hp / 2 && !c.done) BOSS.enrage(c);
    const r = BATTLE.update(c, dt);
    bossBar.draw(c);
    return r;
  },
  end(c) {
    BATTLE.end(c);
    c.host.b.lift = 0;
    bossBar.hide();
    bossHooks.onEnd(c.host, c.result === 'win');
  },
});

export { BOSS, bossHooks };
