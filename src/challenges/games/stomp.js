import { hostEmoteH, setStatus } from '../system.js';
import { R } from '../../config/settings.js';
import { player } from '../../entities/Player.js';
import { emote } from '../../render/effects/emotes.js';
import { makeShockRing, removeMesh, updateShockRing } from '../../render/effects/rings.js';
import { Sound } from '../../systems/audio.js';
import { angleBetween } from '../../utils/math.js';

const stomp = { seal: '青', title: 'Oni stomp', locks: false,
  how: 'Jump over each shockwave from the oni\'s club. Clear 6 waves; 3 hits and you are out.',
  start(c) { c.cleared = 0; c.hits = 0; c.next = 1.8; c.spawnIn = 0; c.rings = []; },
  update(c, dt) {
    const host = c.host, pb = player.body, pd = angleBetween(pb.dir, host.b.dir);
    if ((c.next -= dt) <= 0) {   // raise the club; the ring leaves when it lands
      host.slam = 0.6; c.spawnIn = 0.35;
      c.next = 2.6 - Math.min(1, c.cleared * 0.15) + Math.random() * 0.6;
    }
    if (c.spawnIn > 0 && (c.spawnIn -= dt) <= 0) {
      c.rings.push(makeShockRing(host.b.dir));
      Sound.sfx('boom');
      emote(host.b.obj.position, host.b.dir, 'ドン!', hostEmoteH(host), '#3f6fb0');
    }
    for (let i = c.rings.length - 1; i >= 0; i--) {
      const r = c.rings[i], prev = r.a;
      r.a += 6 / R * dt;
      if (prev < pd && r.a >= pd) {   // the wave passes the player this frame
        if (pb.lift < 0.3) { c.hits++; Sound.sfx('hit'); emote(pb.obj.position, pb.dir, '痛!', 2.4); pb.jump(4); }
        else { c.cleared++; Sound.sfx('good'); }
      }
      if (r.a > 18 / R) { removeMesh(r.mesh); c.rings.splice(i, 1); continue; }
      updateShockRing(r);
      r.mesh.material.opacity = 0.8 * (1 - r.a * R / 18);
    }
    setStatus(pd * R > 15 ? 'Come back, the oni is waiting!' : `Waves cleared ${c.cleared} of 6    Hits ${c.hits} of 3`);
    if (c.hits >= 3) { c.note = 'Flattened!'; return 'lose'; }
    return c.cleared >= 6 ? 'win' : null;
  },
  end(c) { for (const r of c.rings) removeMesh(r.mesh); },
};

export { stomp };
