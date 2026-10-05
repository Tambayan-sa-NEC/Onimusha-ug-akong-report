/**
 * What you are carrying, and which chests you have already been into.
 *
 * Deliberately knows nothing about the world or the UI — it is two sets and the
 * questions worth asking of them, so that the chest, the pause screen and the save
 * file can all read it without reaching for each other.
 */
import { ITEMS, ITEM_DEFS } from '../data/itemDefs.js';

/** Keepsake ids in hand. */
const held = new Set();
/** Chest ids already opened, so they stay open across a reload. */
const opened = new Set();

const hasItem = id => held.has(id);
const isOpened = id => opened.has(id);
/** Take a keepsake. Returns false if it is not a real one, or already held. */
function takeItem(id) {
  if (!ITEMS[id] || held.has(id)) return false;
  held.add(id);
  return true;
}
const markOpened = id => { opened.add(id); };
/** Every keepsake, in a fixed order, each marked with whether it is held. */
const collection = () => ITEM_DEFS.map(d => ({ ...d, held: held.has(d.id) }));
const clearKeepsakes = () => { held.clear(); opened.clear(); };

export { clearKeepsakes, collection, hasItem, held, isOpened, markOpened, opened, takeItem };
