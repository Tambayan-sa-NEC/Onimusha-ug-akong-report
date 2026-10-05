/**
 * The rōnin's companion. A Quadruped that never leaves his heel.
 */
import { Quadruped } from './Quadruped.js';
import { emote } from '../render/effects/emotes.js';
import { Sound, nearVol } from '../systems/audio.js';

/** The rōnin's wolf. A shiba's walk cycle on a bigger, greyer frame, permanently loyal. */
const WOLF_LOOK = { color: '#6f6b73', belly: '#cfc8c0', ear: '#49454f' };
class Wolf extends Quadruped {
  constructor(dir) {
    super('dog', WOLF_LOOK, dir);
    this.isWolf = true;
    this.id = 'wolf';
    this.tame = true;
    this.m.root.scale.setScalar(1.5);   // Quadruped fixes the dog scale, so size it here
    this.state = 'follow';
    this.howl = 4;
  }
  react() {}            // never startled, never needs coaxing
  say() {               // a long howl now and then instead of a shiba's yapping
    if (this.howl > 0) return;
    this.howl = 9 + Math.random() * 11;
    emote(this.b.obj.position, this.b.dir, 'ウォーン', 1.7, '#6f6b73');
    Sound.sfx('howl', nearVol(this.b.obj.position));
  }
  update(dt, t) {
    this.howl -= dt;
    this.state = 'follow'; this.timer = 9; this.cd = 9;   // no wandering off, no losing interest
    super.update(dt, t);
  }
}

export { WOLF_LOOK, Wolf };
