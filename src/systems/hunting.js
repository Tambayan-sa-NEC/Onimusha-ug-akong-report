/**
 * Which yokai is chasing you, and how it gives up.
 */
import * as THREE from 'three';
import { ch, hostEmoteH, hosts, startChallenge, won } from '../challenges/system.js';
import { BATTLE } from '../combat/battle.js';
import { hostFx } from '../combat/fx.js';
import { R } from '../config/settings.js';
import { session } from '../core/Session.js';
import { player } from '../entities/Player.js';
import { emote } from '../render/effects/emotes.js';
import { Sound, nearVol } from './audio.js';
import { angleBetween } from '../utils/math.js';
import { rr } from '../utils/random.js';
import { vecB } from '../utils/scratch.js';
import { tangentToward } from '../utils/sphere.js';
import { indoors } from '../world/houses.js';

const V3 = THREE.Vector3;

/* ---------- Hunting: the fiercer yokai notice you and give chase ----------
   This owns the state and the steering; each yokai still travels in its own way
   (the fox trots, the wisp floats, the oni stomps) by reading `hunting` and `huntGait`.
   Pressing E while one bears down still opens its mini-game: the chase is a timer,
   not a lock-out. Win a yokai's seal and it never hunts you again. */
const HUNT = { see: 9, contact: 2, leash: 18, patience: 6, alert: 0.5, rest: 9, home: 2.5, peace: 12 };
let hunter = null;    // only ever one yokai on your heels
let huntPeace = 0;    // quiet spell after a chase ends, so the planet can breathe
const HUNT_CRIES = { tag: 'コン!', gather: '…みつけた…', sumo: 'キュウ!', iai: 'グラァ!', stomp: 'ホホホ!', race: 'フン!' };
/** Only yokai marked `aggro` hunt, and only while you still owe them a seal. */
const huntable = h => h.def.aggro && !won.has(h.def.game) && !(h.chCd > 0);
const huntSpeed = h => (h.def.battle && h.def.battle.speed) || 3.4;   // slower than a sprint, so you can always flee

function startHunt(h) {
  const b = h.b;
  h.hunt.state = 'alert'; h.hunt.t = HUNT.alert;
  h.hunt.home.copy(h.home || b.dir);
  h.hunting = true; h.huntGait = 0;
  hunter = h;
  emote(b.obj.position, b.dir, HUNT_CRIES[h.def.game] || '!', hostEmoteH(h) + 0.4, '#b8433c');
  Sound.sfx('boo', nearVol(b.obj.position));
}
/** Free the one-chase-at-a-time slot and let the planet breathe for a while. */
function releaseHunter(h) {
  if (hunter === h) { hunter = null; huntPeace = HUNT.peace; }
}
function endHunt(h, rest) {
  h.hunt.state = 'calm'; h.hunt.cd = rest;
  h.hunting = false; h.huntGait = 0;
  releaseHunter(h);
  if (h.state === 'hunt') { h.state = 'idle'; h.timer = rr(1, 3); }   // hand the fox back its own moods
}
function updateHunts(dt) {
  // A room is a refuge: rooms sit on real directions of the same sphere, so without
  // this a yokai would simply walk in after you.
  if (indoors()) { if (hunter) endHunt(hunter, HUNT.rest); return; }
  const P = player.body.obj.position;
  if (huntPeace > 0) huntPeace -= dt;
  for (const h of hosts) {
    const s = h.hunt || (h.hunt = { state: 'calm', t: 0, cd: 0, home: new V3() });
    if (s.cd > 0) s.cd -= dt;
    // A challenge — mini-game or battle — always takes over from the chase.
    if (!session.started || ch.active || h.busy) { if (s.state !== 'calm') endHunt(h, HUNT.rest); continue; }
    const b = h.b, pd = b.dist(P);
    switch (s.state) {
      case 'calm':
        if (!hunter && huntPeace <= 0 && s.cd <= 0 && pd < HUNT.see && huntable(h)) startHunt(h);
        break;
      case 'alert':   // a beat to notice you and square up, then it comes
        if (b.toward(P, vecB)) b.turnToward(vecB, 7 * dt);
        if ((s.t -= dt) <= 0) { s.state = 'chase'; s.t = HUNT.patience; h.huntGait = huntSpeed(h); }
        break;
      case 'chase':
        hostFx(h).chase = 1;   // leans into the run, arms pumping
        if (b.toward(P, vecB)) b.turnToward(vecB, 4 * dt);
        if (pd < HUNT.contact) { endHunt(h, 0); startChallenge(h, BATTLE); }
        else if ((s.t -= dt) <= 0 || pd > HUNT.leash) {   // outrun, or it simply loses heart
          emote(b.obj.position, b.dir, '…', hostEmoteH(h), '#6a6a6a');
          s.state = 'return'; s.t = HUNT.patience; h.huntGait = huntSpeed(h) * 0.45;
          releaseHunter(h);
        }
        break;
      case 'return':
        if (angleBetween(b.dir, s.home) * R < HUNT.home || (s.t -= dt) <= 0) endHunt(h, HUNT.rest);
        else if (tangentToward(b.dir, s.home, b.dir, vecB)) b.turnToward(vecB, 3 * dt);
        break;
    }
  }
}

export { HUNT, HUNT_CRIES, endHunt, huntPeace, huntSpeed, huntable, hunter, releaseHunter, startHunt, updateHunts };
