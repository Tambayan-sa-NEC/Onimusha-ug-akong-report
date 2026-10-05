import { setStatus } from '../system.js';
import { R } from '../../config/settings.js';
import { player } from '../../entities/Player.js';
import { emote } from '../../render/effects/emotes.js';
import { showBeacon } from '../../render/effects/rings.js';
import { Sound } from '../../systems/audio.js';
import { angleBetween } from '../../utils/math.js';
import { spotAround } from '../../utils/sphere.js';

const race = { seal: '天', title: 'Tengu sky race', locks: false,
  how: 'Reach each glowing marker before its timer runs out. 4 markers. Sprint!',
  start(c) { c.n = 0; c.target = spotAround(player.body.dir, 16, 24); c.time = 10; },
  update(c, dt) {
    const pb = player.body;
    c.time -= dt;
    showBeacon(c.target);
    const dist = angleBetween(pb.dir, c.target) * R;
    if (dist < 1.8) {
      c.n++; Sound.sfx('good');
      emote(pb.obj.position, pb.dir, `${c.n}!`, 2.4);
      if (c.n >= 4) return 'win';
      c.target = spotAround(c.target, 16, 24);
      c.time = 10 - c.n * 0.6;
    }
    setStatus(`Marker ${c.n + 1} of 4    ${Math.round(dist)} m    ${Math.ceil(c.time)} s`);
    if (c.time <= 0) { c.note = 'Too slow for a tengu!'; return 'lose'; }
    return null;
  },
};

export { race };
