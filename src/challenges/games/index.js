import { gather } from './gather.js';
import { iai } from './iai.js';
import { memory } from './memory.js';
import { race } from './race.js';
import { rhythm } from './rhythm.js';
import { riddle } from './riddle.js';
import { shell } from './shell.js';
import { stomp } from './stomp.js';
import { sumo } from './sumo.js';
import { tag } from './tag.js';

/* Every yokai's mini-game, in the order their seals appear in the seal book. */
const GAMES = { tag, rhythm, memory, gather, sumo, iai, stomp, race, riddle, shell };
const GAME_ORDER = Object.keys(GAMES);

export { GAMES, GAME_ORDER };
