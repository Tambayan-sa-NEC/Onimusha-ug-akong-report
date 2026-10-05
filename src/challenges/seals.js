/**
 * The seal book: what you have won and whether the gate will open.
 */
import { GAMES, GAME_ORDER } from './games/index.js';
import { SEALS_FOR_GATE, bossWon, chUI, el, gateOpen, won } from './system.js';
import { BOSS_ORDER } from '../data/bossDefs.js';

function buildSeals() {
  chUI.seals.innerHTML = '';
  for (const k of GAME_ORDER) {
    const s = el('span', won.has(k) ? 'won' : '', GAMES[k].seal, chUI.seals);
    s.title = GAMES[k].title;
  }
  const tally = el('span', 'tally' + (gateOpen() ? ' lit' : ''), `${won.size}/${SEALS_FOR_GATE}`, chUI.seals);
  tally.title = gateOpen() ? 'The sealed gate is open' : `${SEALS_FOR_GATE - won.size} more to open the sealed gate`;
  for (const b of BOSS_ORDER) {
    const s = el('span', 'boss' + (bossWon.has(b.id) ? ' won' : ''), b.seal, chUI.seals);
    s.title = b.name;
  }
}

export { buildSeals };
