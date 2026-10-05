import { chUI, el, setStatus } from '../system.js';
import { LAN_NOTES } from '../../data/quiz.js';
import { Sound } from '../../systems/audio.js';

const memory = { seal: '灯', title: 'Lantern memory', locks: true,
  how: 'Watch the lanterns light up, then repeat the order with WASD or the arrow keys. 3 rounds.',
  start(c) {
    const grid = el('div', 'lanterns', undefined, el('div', 'panel', undefined, chUI.stage));
    c.lan = ['↑', '←', '→', '↓'].map((s, i) => el('div', 'lan l' + i, s, grid));
    c.round = 0; c.seq = []; c.lit = [0, 0, 0, 0];
    memory.next(c);
  },
  next(c) {
    c.round++;
    while (c.seq.length < c.round + 2) c.seq.push(Math.floor(Math.random() * 4));
    c.phase = 'show'; c.i = 0; c.timer = 0.9;
  },
  flash(c, i) { c.lit[i] = 0.35; Sound.pluck(LAN_NOTES[i], 0.09); },
  update(c, dt) {
    for (let i = 0; i < 4; i++) { c.lit[i] -= dt; c.lan[i].classList.toggle('lit', c.lit[i] > 0); }
    if (c.phase !== 'input' && (c.timer -= dt) <= 0) {
      if (c.phase === 'wait') memory.next(c);
      else if (c.i < c.seq.length) { memory.flash(c, c.seq[c.i++]); c.timer = 0.65 - c.round * 0.08; }
      else { c.phase = 'input'; c.pos = 0; }
    }
    setStatus(c.phase === 'input' ? `Your turn: ${c.pos} of ${c.seq.length}` : `Round ${c.round} of 3, watch closely`);
    return null;
  },
  key(c, code) {
    const i = { KeyW: 0, ArrowUp: 0, KeyA: 1, ArrowLeft: 1, KeyD: 2, ArrowRight: 2, KeyS: 3, ArrowDown: 3 }[code];
    if (i === undefined || c.phase !== 'input') return;
    memory.flash(c, i);
    if (i !== c.seq[c.pos]) { c.result = 'lose'; c.note = 'Wrong lantern!'; return; }
    if (++c.pos === c.seq.length) {
      if (c.round >= 3) c.result = 'win';
      else { c.phase = 'wait'; c.timer = 1.0; Sound.sfx('good'); }
    }
  },
};

export { memory };
