import { setStatus } from '../system.js';
import { scene } from '../../core/Stage.js';
import { player } from '../../entities/Player.js';
import { makeOnibi } from '../../entities/yokai/Onibi.js';
import { emote } from '../../render/effects/emotes.js';
import { showBeacon } from '../../render/effects/rings.js';
import { orient } from '../../render/materials.js';
import { Sound } from '../../systems/audio.js';
import { tangentB } from '../../utils/scratch.js';
import { TB_U, TB_V, spotAround, tangentBasis } from '../../utils/sphere.js';
import { heightAt } from '../../world/terrain.js';

const gather = { seal: '火', title: 'Onibi gathering', locks: false,
  how: 'Collect all 6 lost wisps within 35 seconds. Jump for the high ones.',
  start(c) {
    c.time = 35;
    c.w = Array.from({ length: 6 }, (_, i) => {
      const m = makeOnibi();
      scene.add(m);
      return { d: spotAround(player.body.dir, 4, 13), m, lift: i < 2 ? 2.5 : 1.0, seed: Math.random() * 6 };
    });
  },
  update(c, dt) {
    c.time -= dt;
    const pb = player.body, chest = tangentB.copy(pb.obj.position).addScaledVector(pb.dir, 1.0);
    let nearest = null, nd = Infinity, got = 0;
    for (const w of c.w) {
      if (w.got) { got++; continue; }
      w.m.position.copy(w.d).multiplyScalar(heightAt(w.d) + w.lift + Math.sin(c.t * 2 + w.seed) * 0.15);
      tangentBasis(w.d, TB_U, TB_V);
      orient(w.m, w.d, TB_U);
      const dist = w.m.position.distanceTo(chest);
      if (dist < 1.2) {
        w.got = true; got++; scene.remove(w.m);
        Sound.sfx('wisp'); emote(w.m.position, w.d, '火', 0.3, '#3f94d6');
      } else if (dist < nd) { nd = dist; nearest = w; }
    }
    setStatus(`Wisps ${got} of 6    ${Math.ceil(c.time)} s`);
    if (!nearest) return 'win';
    showBeacon(nearest.d);
    if (c.time <= 0) { c.note = 'The wisps faded away...'; return 'lose'; }
    return null;
  },
  end(c) { for (const w of c.w) scene.remove(w.m); },
};

export { gather };
