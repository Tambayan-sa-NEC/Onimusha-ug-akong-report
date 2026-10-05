/**
 * The seal book: what you have won and whether the gate will open.
 */
import { GAMES, GAME_ORDER } from './games/index.js';
import { SEALS_FOR_GATE, bossWon, chUI, el, gateOpen, won } from './system.js';
import { BOSS_ORDER } from '../data/bossDefs.js';

function buildSeals() {
  chUI.seals.innerHTML = '';
  for (const k of GAME_ORDER) {
    const w = won.has(k);
    const s = el('span', w ? 'won' : '', GAMES[k].seal, chUI.seals);
    s.title = w ? `${GAMES[k].title} — won` : GAMES[k].title;
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

export { buildSeals };
