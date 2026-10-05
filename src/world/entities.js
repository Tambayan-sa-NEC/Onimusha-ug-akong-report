/**
 * Everything alive on the planet.
 *
 * The spawn system fills these lists, the game loop walks them, and entities join
 * and leave them as they are created and dismissed. Keeping the lists here rather
 * than inside the spawner stops consumers having to depend on the spawner.
 */

const npcs = [];
const critters = [];
const bosses = [];

export { bosses, critters, npcs };
