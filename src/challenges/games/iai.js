import { chUI, el, setStatus } from '../system.js';
import { player } from '../../entities/Player.js';
import { startAction } from '../../entities/models/humanoid.js';
import { Sound } from '../../systems/audio.js';

const iai = { seal: '赤', title: 'Iai duel', locks: true,
  how: 'When 斬 appears, press Space as fast as you can. Too early loses the round. Best of 3.',
  start(c) {
    const panel = el('div', 'panel', undefined, chUI.stage);
    c.big = el('div', 'big', '…', panel);
    c.sub = el('div', 'sub', '', panel);
    c.w = 0; c.l = 0; c.round = 0;
    iai.next(c);
  },
  next(c) {
    c.round++; c.phase = 'wait'; c.timer = 1.5 + Math.random() * 2.5;
    c.window = [0.6, 0.48, 0.4][Math.min(c.round - 1, 2)];
    c.big.textContent = '…'; c.big.className = 'big';
    c.sub.textContent = `Round ${c.round}. Steady your breath...`;
  },
  endRound(c, win, msg) {
    if (win) { c.w++; startAction(player.h, 'spin'); startAction(c.host.h, 'hop'); Sound.sfx('good'); }
    else { c.l++; startAction(c.host.h, 'spin'); Sound.sfx('bad'); }
    c.phase = 'result'; c.timer = 1.4;
    c.big.textContent = win ? '○' : '×';
    c.sub.textContent = msg;
  },
  update(c, dt) {
    c.timer -= dt;
    if (c.phase === 'wait' && c.timer <= 0) {
      c.phase = 'go'; c.goT = 0; c.big.textContent = '斬!'; c.big.className = 'big go'; Sound.sfx('clash');
    } else if (c.phase === 'go') {
      if ((c.goT += dt) > c.window) iai.endRound(c, false, 'Too slow! The oni struck first.');
    } else if (c.phase === 'result' && c.timer <= 0) {
      if (c.w >= 2) return 'win';
      if (c.l >= 2) return 'lose';
      iai.next(c);
    }
    setStatus(`You ${c.w}    Oni ${c.l}`);
    return null;
  },
  key(c, code) {
    if (code !== 'Space') return;
    if (c.phase === 'wait') iai.endRound(c, false, 'Too hasty! Patience is the blade.');
    else if (c.phase === 'go') iai.endRound(c, true, `Clean strike in ${Math.round(c.goT * 1000)} ms!`);
  },
};

export { iai };
