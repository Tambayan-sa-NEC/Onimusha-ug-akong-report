/**
 * Runs whichever challenge is active, and routes keys and results to it.
 */
import { GAMES, GAME_ORDER } from './games/index.js';
import { tag } from './games/tag.js';
import { buildSeals } from './seals.js';
import { BOSS_ORDER } from '../data/bossDefs.js';
import { player } from '../entities/Player.js';
import { startAction } from '../entities/models/humanoid.js';
import { emote } from '../render/effects/emotes.js';
import { beacon } from '../render/effects/rings.js';
import { Sound } from '../systems/audio.js';
import { openDialog } from '../ui/dialog.js';
import { ending, playEnding } from '../ui/ending.js';
import { $ } from '../utils/dom.js';
import { tangentA } from '../utils/scratch.js';

const hosts = [];              // anything with def.game (yokai critters + yokai NPCs)
const ch = { active: null };   // the running challenge, if any
const won = new Set();         // games won (one seal each)
const bossWon = new Set();     // bosses felled (ids from BOSS_DEFS)
const slain = new Set();       // yokai cut down with the blade (host ids), for the ending recap
/** The sealed gate opens at five seals, from mini-games or battles alike. */
const SEALS_FOR_GATE = 5;
const gateOpen = () => won.size >= SEALS_FOR_GATE;

const chUI = { panel: $('chPanel'), title: $('chTitle'), how: $('chHow'), status: $('chStatus'), stage: $('stage'), banner: $('banner'), seals: $('seals') };
function el(tag, cls, text, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const rpick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const setStatus = text => { chUI.status.textContent = text; };
const inputLocked = () => !!(ch.active && ch.active.g.locks);   // on-screen games freeze walking
const hostEmoteH = h => h.def.emoteH || 2.5 * ((h.def.look && h.def.look.scale) || 1);
/** Random walkable spot minD..maxD world units from a direction. */

/* ---------- Challenge flow ---------- */
function startChallenge(host, g = GAMES[host.def.game]) {
  const c = { host, g, t: 0, result: null, note: '', done: false, doneT: 0 };
  ch.active = c;
  host.busy = true;
  chUI.title.textContent = `${g.seal}  ${g.title}`;
  chUI.how.textContent = `${g.how} Esc to forfeit.`;
  setStatus('');
  chUI.stage.innerHTML = '';
  chUI.panel.classList.add('show');
  openDialog(host, rpick(g.intro || host.def.intro));
  const pb = player.body;
  if (pb.toward(host.b.obj.position, tangentA)) pb.turnToward(tangentA, Math.PI);
  if (g.locks) player.vel.set(0, 0, 0);
  g.start(c);
  Sound.sfx('talk');
}
function resolveChallenge(c, win) {
  c.done = true; c.doneT = 2.6;
  chUI.banner.textContent = win ? '勝' : '負';
  chUI.banner.className = win ? 'show win' : 'show';
  const h = c.host;
  openDialog(h, (c.note ? c.note + ' ' : '') + rpick(win ? (c.g.win || h.def.win) : (c.g.lose || h.def.lose)));
  emote(h.b.obj.position, h.b.dir, win ? '参った!' : 'ははは!', hostEmoteH(h) + 0.6);
  Sound.sfx(win ? 'win' : 'lose');
  if (h.h) startAction(h.h, win ? 'bow' : 'dance');
  if (win) {
    startAction(player.h, 'spin');
    if (c.g.boss) bossWon.add(h.def.id);
    else { won.add(h.def.game); if (c.g.fight) slain.add(h.def.id); }   // a battle win is a blade kill
    buildSeals();
  }
  setStatus(win ? 'Seal earned!' : 'Try again next time you meet.');
}
function finishChallenge() {
  const c = ch.active;
  if (c.g.end) c.g.end(c);
  chUI.stage.innerHTML = '';
  chUI.panel.classList.remove('show');
  chUI.banner.className = '';
  beacon.visible = false;
  c.host.busy = false;
  c.host.chCd = 20;          // rest before it challenges you again
  c.host.announced = true;
  ch.active = null;
  if (c.result === 'win' && won.size === GAME_ORDER.length && bossWon.size === BOSS_ORDER.length
    && !finishChallenge.celebrated) {
    finishChallenge.celebrated = true;
    openDialog(c.host, 'Every yokai on this little planet now calls you friend, and the two great ones bow with them. The whole world hums with quiet joy.');
    emote(player.body.obj.position, player.body.dir, '妖 全!', 2.6);
  }
  // Felling the second great yokai rolls the ending, however many seals you hold.
  if (c.result === 'win' && c.g.boss && bossWon.size === BOSS_ORDER.length && !ending.played) {
    playEnding({
      char: player.char.name,
      kanji: player.char.kanji,
      slain: slain.size,
      seals: won.size,
      bosses: BOSS_ORDER.map(b => b.name),
    });
  }
}
function updateChallenge(dt) {
  const c = ch.active;
  if (!c) return;
  if (c.done) { if ((c.doneT -= dt) <= 0) finishChallenge(); return; }
  c.t += dt;
  const r = c.result || c.g.update(c, dt);
  if (r) { c.result = r; resolveChallenge(c, r === 'win'); }
}
/** Route a key press to the running mini-game. Returns true if it was consumed. */
function challengeKey(code) {
  const c = ch.active;
  if (!c || c.done) return false;
  if (code === 'Escape') { c.result = 'lose'; c.note = 'You bowed out.'; return true; }
  if (c.g.key) c.g.key(c, code);
  return c.g.locks && code !== 'KeyM';
}

export { SEALS_FOR_GATE, bossWon, ch, chUI, challengeKey, el, finishChallenge, gateOpen, hostEmoteH, hosts, inputLocked, resolveChallenge, rpick, setStatus, shuffle, slain, startChallenge, updateChallenge, won };
