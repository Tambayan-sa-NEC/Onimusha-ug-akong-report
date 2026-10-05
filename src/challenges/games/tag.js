import { setStatus } from '../system.js';
import { player } from '../../entities/Player.js';
import { showBeacon } from '../../render/effects/rings.js';
import { Sound } from '../../systems/audio.js';

const tag = { seal: '狐', title: 'Kitsune tag', locks: false,
  how: 'Catch the fox 3 times within 40 seconds. Follow the light, and sprint.',
  start(c) { c.n = 0; c.time = 40; c.host.blink(); },
  update(c, dt) {
    const f = c.host;
    c.time -= dt;
    showBeacon(f.b.dir);
    if (f.b.dist(player.body.obj.position) < 1.6) {
      c.n++; Sound.sfx('good');
      if (c.n >= 3) return 'win';
      f.blink();
    }
    setStatus(`Tagged ${c.n} of 3    ${Math.ceil(c.time)} s`);
    if (c.time <= 0) { c.note = 'The fox got away!'; return 'lose'; }
    return null;
  },
};

export { tag };
