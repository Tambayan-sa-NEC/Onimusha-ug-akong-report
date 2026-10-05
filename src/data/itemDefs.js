/**
 * Keepsakes: the small things left in chests around the planet.
 *
 * They are deliberately not equipment. Health resets at the start of every fight and
 * there are no stats to raise, so an item that changed numbers would either do nothing
 * or quietly rewrite the balance. These are things worth finding instead — each one a
 * sentence about the little world you are walking around.
 */

const ITEM_DEFS = [
  { id: 'koban', name: 'Worn Koban', seal: '金',
    line: 'A gold coin rubbed smooth and featureless. Somebody carried this a very long way.' },
  { id: 'netsuke', name: 'Cat Netsuke', seal: '猫',
    line: 'A sleeping cat, carved small enough to close your hand around. Still slightly warm.' },
  { id: 'bell', name: 'Shrine Bell', seal: '鈴',
    line: 'It makes no sound when you shake it, and a very clear one when you do not.' },
  { id: 'fan', name: 'Folded Fan', seal: '扇',
    line: 'Painted with a wave that is either coming in or going out, depending on the hour.' },
  { id: 'inkstone', name: 'Cracked Inkstone', seal: '墨',
    line: 'Split down the middle. Whoever used it last was writing in a hurry.' },
  { id: 'comb', name: 'Lacquer Comb', seal: '櫛',
    line: 'Three teeth missing. A single long black hair is still caught in the fourth.' },
  { id: 'teacup', name: 'Chipped Teacup', seal: '茶',
    line: 'Mended once with gold along the crack, which has made it worth rather more.' },
  { id: 'feather', name: "Tengu's Feather", seal: '羽',
    line: 'Far too large for any bird on this planet. It is warm, and it is not moulting.' },
  // The last two are kept indoors, so that walking into a building is worth doing.
  { id: 'teabowl', name: 'Raku Tea Bowl', seal: '椀', indoors: true,
    line: 'Black, lopsided, and worth more than the house it sits in. Hanako would know why.' },
  { id: 'sutra', name: 'Rolled Sutra', seal: '経', indoors: true,
    line: 'Copied out by a careful hand, then corrected by a less careful one.' },
  { id: 'stone', name: 'River Stone', seal: '石',
    line: 'Flat, grey, and perfectly weighted for skipping. The ponds here are small, though.' },
  { id: 'charm', name: 'Paper Charm', seal: '符',
    line: 'The ink has run. Whatever it was warding off, it seems to have worked.' },
];

const ITEMS = Object.fromEntries(ITEM_DEFS.map(d => [d.id, d]));
/** Left in chests out on the planet. */
const OUTDOOR_ITEMS = ITEM_DEFS.filter(d => !d.indoors);
/** Left in the buildings you can walk into. */
const INDOOR_ITEMS = ITEM_DEFS.filter(d => d.indoors);

export { INDOOR_ITEMS, ITEMS, ITEM_DEFS, OUTDOOR_ITEMS };
