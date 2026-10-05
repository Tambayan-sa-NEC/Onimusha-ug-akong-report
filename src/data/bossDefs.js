/**
 * Stats, move sets and lines for the two great yokai.
 */

/* ---------- The two great yokai waiting behind the sealed gate ----------
   They never roam: the gate summons them, one at a time, once you hold five seals. */
const BOSS_DEFS = [
  { id: 'otengu', name: 'Ōtengu, Lord of the Peak', seal: '天', emoteH: 4.4, boss: true, arena: 'peak',
    battle: { hp: 26, radius: 3.6, windup: 0.75, rest: 0.85, speed: 3.2, recover: 0.5, dash: 7, dashSpeed: 15,
      moves: ['dash', 'slam', 'swoop'] },
    rage: { speed: 4.2, windup: 0.5, rest: 0.5, moves: ['dash', 'swoop', 'dash', 'swoop', 'slam'] },
    intro: ['So. The seals are broken, and a samurai climbs to the gate.', 'Five yokai knelt to you. I am not five yokai.'],
    rageLine: 'Enough walking. Now the mountain wind!',
    win: ['...The wind acknowledges you. Take my feather-seal, samurai.'],
    lose: ['Go back down, little one. Return when your blade is honest.'] },
  { id: 'orochi', name: 'Yamata-no-Orochi', seal: '蛇', emoteH: 4.8, boss: true, arena: 'marsh',
    battle: { hp: 32, radius: 4.2, windup: 0.9, rest: 1.0, speed: 2.0, recover: 0.6, dash: 6, dashSpeed: 13,
      moves: ['heads', 'slam', 'heads'] },
    rage: { windup: 0.6, rest: 0.6, moves: ['heads', 'heads', 'slam', 'dash'] },
    intro: ['Ssssso small. Eight heads watched this planet before your shrine was raised.', 'Eight mouths, samurai. You have one blade.'],
    rageLine: 'Sssss — ALL EIGHT!',
    win: ['Sssss... eight heads bow at once. The seal is yours.'],
    lose: ['Ssssleep now, samurai. The heads are patient.'] },
];
const BOSS_ORDER = BOSS_DEFS;
const bossDef = id => BOSS_DEFS.find(b => b.id === id);

export { BOSS_DEFS, BOSS_ORDER, bossDef };
