import { chUI, el, hostEmoteH, setStatus } from '../system.js';
import { player } from '../../entities/Player.js';
import { startAction } from '../../entities/models/humanoid.js';
import { emote } from '../../render/effects/emotes.js';
import { Sound } from '../../systems/audio.js';

const sumo = { seal: '河', title: 'Kappa sumo', locks: true,
  how: 'Mash Space to push the kappa out of the ring. Press E once to bow: a polite kappa must bow back and spill its strength.',
  start(c) {
    c.p = 0; c.weak = 0; c.bowed = false;
    const panel = el('div', 'panel', undefined, chUI.stage);
    const bar = el('div', 'bar sumo', undefined, panel);
    el('div', 'mid', undefined, bar);
    c.markEl = el('div', 'rikishi', '力', bar);
    el('div', 'ends', undefined, panel).innerHTML = '<span>Your edge</span><span>Kappa\'s edge</span>';
  },
  update(c, dt) {
    c.weak -= dt;
    c.p -= (c.weak > 0 ? 0.04 : 0.2 + c.t * 0.008) * dt;
    c.markEl.style.left = (c.p + 1) * 50 + '%';
    setStatus(c.weak > 0 ? 'The kappa is dizzy, push now!' : (c.bowed ? 'Push!' : 'Push! (E to bow)'));
    if (c.p >= 1) return 'win';
    if (c.p <= -1) { c.note = 'Pushed out of the ring!'; return 'lose'; }
    return null;
  },
  key(c, code) {
    if (code === 'Space') c.p += 0.05;
    if (code === 'KeyE' && !c.bowed) {
      c.bowed = true; c.weak = 2.5;
      startAction(player.h, 'bow'); startAction(c.host.h, 'bow');
      emote(c.host.b.obj.position, c.host.b.dir, 'ぴちゃ!', hostEmoteH(c.host), '#3d7f8c');
      Sound.sfx('splash');
    }
  },
};

export { sumo };
