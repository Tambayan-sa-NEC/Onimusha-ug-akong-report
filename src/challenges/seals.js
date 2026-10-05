/**
 * The seal book: what you have won and whether the gate will open.
 */
import { GAMES, GAME_ORDER } from './games/index.js';
import { SEALS_FOR_GATE, bossWon, chUI, el, gateOpen, won } from './system.js';
import { BOSS_ORDER } from '../data/bossDefs.js';
import { NPC_DEFS } from '../data/npcDefs.js';
import { YOKAI_DEFS } from '../data/yokaiDefs.js';

/**
 * Which yokai hosts which game. The seal row shows a game's kanji, which says
 * nothing about who you have to find — so everywhere a seal is named, it is named
 * with its yokai.
 */
const HOST_NAMES = {};
for (const d of [...Object.values(YOKAI_DEFS), ...NPC_DEFS]) if (d.game) HOST_NAMES[d.game] = d.name;
const hostNameFor = key => HOST_NAMES[key] || 'someone';

/** 'Kitsune — Fox tag', the way a seal is worth describing. */
const sealTitle = key => `${hostNameFor(key)} — ${GAMES[key].title}`;

function buildSeals() {
  chUI.seals.innerHTML = '';
  for (const k of GAME_ORDER) {
    const w = won.has(k);
    const s = el('span', w ? 'won' : '', GAMES[k].seal, chUI.seals);
    s.title = w ? `${sealTitle(k)} — won` : `${sealTitle(k)} — not yet`;
    // A tick as well as the fill, so the row reads without colour vision.
    if (w) el('i', 'mark', '✓', s);
  }
  const tally = el('span', 'tally' + (gateOpen() ? ' lit' : ''), `${won.size}/${SEALS_FOR_GATE}`, chUI.seals);
  tally.title = gateOpen() ? 'The sealed gate is open' : `${SEALS_FOR_GATE - won.size} more to open the sealed gate`;
  for (const b of BOSS_ORDER) {
    const bw = bossWon.has(b.id);
    const s = el('span', 'boss' + (bw ? ' won' : ''), b.seal, chUI.seals);
    s.title = bw ? `${b.name} — felled` : b.name;
    if (bw) el('i', 'mark', '✓', s);
  }
}

export { HOST_NAMES, buildSeals, hostNameFor, sealTitle };
