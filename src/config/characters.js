
/* Two playable characters. `look` feeds makeHumanoid exactly as before; everything
   else is read at runtime, so both plug into the same movement, battle and animation
   code. Placeholder geometry throughout — swap `look` for real art when it exists. */
const CHARACTERS = {
  samurai: {
    id: 'samurai', name: 'The Rōnin', kanji: '侍', tag: 'sword · sturdy',
    hp: 5, speed: 1, art: 'blade', wolf: true, pet: 'wolf',
    look: { top: '#2f3a5e', bottom: '#23242e', sash: '#e9d8a6', armor: '#a8332e', hair: 'topknot', hakama: true, katana: true,
      kabuto: '#4a4e5a', maedate: '#c9a227', menpo: '#6b2f2a' },
    blurb: 'Five hearts, helm and mask, and a heavy blade.<br><b>Left click</b> to slash — keep clicking for a three-hit combo.<br><kbd>Alt</kbd> rolls clear of a blow.<br>A wolf walks with him.',
    hint: '<b>Left click</b> slash, keep clicking to combo &nbsp; <kbd>Alt</kbd> dodge roll (hit a yokai to fight it)',
  },
  shinobi: {
    id: 'shinobi', name: 'The Kunoichi', kanji: '忍', tag: 'kunai · quick · she/her',
    hp: 3, speed: 1.22, art: 'kunai', wolf: false, pet: 'cat',
    look: { top: '#3b3552', bottom: '#2a2636', sash: '#b3537f', collar: '#e7dcea', skin: '#f6ddc9',
      hair: 'bun', hairColor: '#241f2b', ponytail: '#241f2b', facemask: '#8f82bd',
      hakama: true, slim: true, scale: 0.94 },
    blurb: 'Three hearts, but lighter on her feet.<br><b>Left click</b> throws a kunai from range.<br><kbd>Q</kbd> is a shadow dash — brief, and untouchable.<br>A cat has decided to come along.',
    hint: '<b>Left click</b> throw a kunai &nbsp; <kbd>Q</kbd> shadow dash (hit a yokai to fight it)',
  },
};

export { CHARACTERS };
