/**
 * Every arena, keyed by id. Adding a boss means adding one module and one line.
 *
 * @hand-linked — these modules reuse local names by design.
 */
import { marsh } from './marsh.js';
import { peak } from './peak.js';

const ARENAS = { peak, marsh };

export { ARENAS };
