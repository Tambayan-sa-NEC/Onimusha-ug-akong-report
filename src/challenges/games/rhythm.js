import { chUI, el, setStatus } from '../system.js';
import { emote } from '../../render/effects/emotes.js';
import { Sound } from '../../systems/audio.js';

const rhythm = { seal: '傘', title: 'Hop-along', locks: true,
  how: 'Press Space while the marker is in the red zone. 5 hits win, 3 misses lose.',
  start(c) {
    c.hits = 0; c.miss = 0; c.x = 0; c.dir = 1; c.speed = 0.7; c.w = 0.22;
    const bar = el('div', 'bar', undefined, el('div', 'panel', undefined, chUI.stage));
    c.zoneEl = el('div', 'zone', undefined, bar);
    c.markEl = el('div', 'marker', undefined, bar);
    rhythm.newZone(c);
  },
  newZone(c) {
    c.z = 0.08 + Math.random() * (0.84 - c.w);
    c.zoneEl.style.left = c.z * 100 + '%';
    c.zoneEl.style.width = c.w * 100 + '%';
  },
  update(c, dt) {
    c.x += c.dir * c.speed * dt;
    if (c.x > 1) { c.x = 1; c.dir = -1; } else if (c.x < 0) { c.x = 0; c.dir = 1; }
    c.markEl.style.left = c.x * 100 + '%';
    setStatus(`Hits ${c.hits} of 5    Misses ${c.miss} of 3`);
    return null;
  },
  key(c, code) {
    if (code !== 'Space') return;
    const b = c.host.b;
    if (c.x >= c.z && c.x <= c.z + c.w) {
      c.hits++; c.speed *= 1.2; c.w = Math.max(0.1, c.w - 0.025);
      rhythm.newZone(c);
      b.grounded = true; b.jump(4.5);
      emote(b.obj.position, b.dir, '♪', 1.9, '#7a3d8f');
      Sound.sfx('boing');
      if (c.hits >= 5) c.result = 'win';
    } else {
      c.miss++; Sound.sfx('bad');
      if (c.miss >= 3) { c.result = 'lose'; c.note = 'Out of step!'; }
    }
  },
};

export { rhythm };
