/**
 * What is in reach, what the prompt says, and what E does about it.
 */
import { GAMES } from '../challenges/games/index.js';
import { ch, hostEmoteH, hosts, startChallenge } from '../challenges/system.js';
import { CFG } from '../config/settings.js';
import { session } from '../core/Session.js';
import { player } from '../entities/Player.js';
import { emote } from '../render/effects/emotes.js';
import { HUNT } from './hunting.js';
import { indoors } from '../world/houses.js';
import { takeInteract } from './input.js';
import { closeDialog, dlg, promptBox, ui } from '../ui/dialog.js';
import { critters, npcs } from '../world/entities.js';

function updateInteraction(dt) {
  const P = player.body.obj.position;
  let near = null, bd = Infinity;
  // Indoors, the planet is out of reach — nothing standing on it can be talked to,
  // challenged, or walked into, however near its direction happens to be.
  const inside = indoors();
  for (const h of inside ? [] : hosts) {
    const d = h.b.dist(P);
    h.chCd = Math.max(0, (h.chCd || 0) - dt);
    if (d > CFG.challengeRange + 3) h.announced = false;
    if (!session.started || ch.active || h.chCd > 0 || d >= (h.hunting ? HUNT.see : CFG.challengeRange)) continue;
    if (!h.announced && !h.hunting) {   // every fresh encounter: the yokai calls out a challenge
      h.announced = true;
      emote(h.b.obj.position, h.b.dir, '勝負!', hostEmoteH(h) + 0.6);
    }
    if (d < bd) { bd = d; near = h; }
  }
  if (session.started && !ch.active) for (const n of npcs) {
    if (inside && !n.roomId && !n.isChest) continue;      // room fixtures only
    if (inside && n.isChest && !String(n.id).startsWith('room-')) continue;
    if (n.def.game) continue;
    if (n.isChest) {   // chests have a shorter reach than a conversation
      const d = n.b.dist(P);
      if (d < CFG.talkRange - 0.8 && d < bd) { bd = d; near = n; }
      continue;
    }
    const d = n.b.dist(P);
    if (d < CFG.talkRange && d < bd) { bd = d; near = n; }
  }
  // Cats and dogs can be talked round, at arm's length rather than across a field.
  if (session.started && !ch.active && !inside) for (const c of critters) {
    if (!c.greetable) continue;
    const d = c.b.dist(P);
    if (d < CFG.talkRange - 0.6 && d < bd) { bd = d; near = c; }
  }
  const label = !near ? '' : near.prompt ? near.prompt()
    : !near.def.game
    ? `<kbd>E</kbd> Talk to ${near.def.name}`
    : near.hunting
      ? `${near.def.name} is charging you! <kbd>E</kbd> to offer ${GAMES[near.def.game].title} instead`
      : `<kbd>E</kbd> ${near.def.name} challenges you: ${GAMES[near.def.game].title}`;
  if (label !== promptBox.label) {
    promptBox.label = label;
    if (label) ui.prompt.innerHTML = label;
    ui.prompt.classList.toggle('show', !!label);
  }
  if (takeInteract()) {
    // Critters have no challenge definition at all, so ask before reaching for one.
    if (near) { if (near.def && near.def.game) startChallenge(near); else near.interact(); }
  }
  if (dlg.npc) {
    dlg.shown += dt * CFG.textSpeed;   // typewriter
    ui.text.textContent = dlg.full.slice(0, Math.floor(dlg.shown));
    dlg.timer -= dt;
    if (dlg.timer <= 0 || dlg.npc.b.dist(player.body.obj.position) > CFG.talkRange + 2.5) closeDialog();
  }
}

export { updateInteraction };
