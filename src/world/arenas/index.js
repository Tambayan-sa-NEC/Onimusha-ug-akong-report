/**
 * Every arena, keyed by id. Adding a boss means adding one module and one line.
 *
 * @hand-linked — these modules reuse local names by design.
 */
import { marsh } from './marsh.js';
import { peak } from './peak.js';
import { pagodaRoom, teahouse } from './rooms.js';

/** Boss arenas and walk-in rooms alike: both are places the planet is swapped for. */
const ARENAS = { peak, marsh, teahouse, pagodaRoom };

export { ARENAS };
