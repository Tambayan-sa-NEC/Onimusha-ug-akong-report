/**
 * Stats and lines for the critter-sized yokai.
 */

/* ---------- Critter-style yokai definitions (humanoid yokai live in NPC_DEFS) ---------- */
const YOKAI_DEFS = {
  kitsune: { name: 'Kitsune', game: 'tag', emoteH: 1.1, aggro: true, battle: { hp: 6, speed: 3.6, windup: 0.6, moves: ['dash'] },
    intro: ['Kon kon! Catch me if you can, little samurai!', 'A fox never walks in a straight line. Can you keep up?'],
    win: ['Kon... you are quicker than you look. Take my seal.', 'Caught three times! My tails are embarrassed.'],
    lose: ['Kon kon! Too slow. Come find me again.', 'The fox wins today. Maybe next moon.'] },
  kasa: { name: 'Kasa-obake', game: 'rhythm', emoteH: 1.9,
    intro: ['Kekeke! Hop with me! One, two, hop!', 'An umbrella has only one leg, so it needs perfect rhythm. Do you have it?'],
    win: ['Kekeke! You hop like a true umbrella! My seal is yours.'],
    lose: ['Kekeke! Out of step! Try again when it rains.'] },
  chochin: { name: 'Chōchin-obake', game: 'memory', emoteH: 0.9,
    intro: ['Baa! ...Did I scare you? No? Then remember my lights!', 'Lanterns remember every path. Follow my glow.'],
    win: ['Your memory shines brighter than my paper. Here, my seal.'],
    lose: ['Baa! Wrong light! My flame flickers with laughter.'] },
  onibi: { name: 'Onibi', game: 'gather', emoteH: 0.5, aggro: true, battle: { hp: 5, radius: 2, moves: ['dash'], dashSpeed: 14, dash: 4 },
    intro: ['...flicker... my little siblings are lost... gather them... flicker...'],
    win: ['...warm... all together again... thank you... flicker...'],
    lose: ['...scattered... fading... another night, perhaps...'] },
};

export { YOKAI_DEFS };
