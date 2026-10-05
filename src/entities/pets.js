/**
 * The animal that walks with you.
 *
 * A companion is a critter that has been talked round rather than a special kind of
 * thing: befriending one marks it tame, and taming is the whole difference between a
 * cat that wanders off and a cat that follows you around a planet.
 *
 * Deliberately not a combatant. Every fight starts you at full health and ends with
 * the seal either won or not, so an animal that dealt damage would quietly rewrite the
 * difficulty of all ten yokai. It reacts, it keeps up, and it is pleased when you win.
 */
import { emote } from '../render/effects/emotes.js';
import { Sound, nearVol } from '../systems/audio.js';

/** The one animal currently following you. */
const pet = { animal: null };

/** Names, so a companion is somebody rather than a critter. */
const PET_NAMES = { wolf: 'Kuro', dog: 'Mame', cat: 'Tora' };
/** What a kind of animal says when it is pleased. */
const PET_CRIES = {
  wolf: ['ウォーン', '♥'],
  dog: ['ワン!', 'ワンワン!', '♥'],
  cat: ['ニャ〜', 'にゃ♪', '♥'],
};

const petKind = a => (a && a.isWolf ? 'wolf' : a && a.kind) || null;
const petName = a => PET_NAMES[petKind(a || pet.animal)] || 'your companion';

/** Let whoever was following you go back to their own business. */
function release() {
  if (!pet.animal) return null;
  const was = pet.animal;
  was.tame = false;
  if (was.state === 'follow') { was.state = 'idle'; was.timer = 1; }
  pet.animal = null;
  return was;
}

/**
 * Talk an animal round. The one already following you is let go first — you walk
 * with one companion, not a procession.
 */
function befriend(critter) {
  if (!critter || critter === pet.animal) return false;
  release();
  critter.tame = true;
  critter.state = 'follow';
  critter.timer = 1e9;
  critter.cd = 1e9;
  pet.animal = critter;
  cheer('befriend');
  return true;
}

/** Hand the companion role to an animal that already belongs to you, like the wolf. */
function adopt(critter) {
  if (!critter) { pet.animal = null; return; }
  critter.tame = true;
  pet.animal = critter;
}

/**
 * A noise and a flourish, for the moments worth noticing: a seal won, a chest
 * opened, somebody greeted.
 */
function cheer(why) {
  const a = pet.animal;
  if (!a || !a.b || !a.b.obj) return false;
  const kind = petKind(a);
  const cries = PET_CRIES[kind] || PET_CRIES.dog;
  const text = why === 'seal' ? '♥' : cries[Math.floor(Math.random() * cries.length)];
  emote(a.b.obj.position, a.b.dir, text, kind === 'cat' ? 1.0 : 1.4);
  Sound.sfx(kind === 'cat' ? 'meow' : 'bark', nearVol(a.b.obj.position));
  if (a.b.grounded && why !== 'talk') a.b.jump(kind === 'cat' ? 3.2 : 4);
  return true;
}

/** Who is with you, for the save file. */
const petId = () => (pet.animal ? pet.animal.id || null : null);

export { PET_CRIES, PET_NAMES, adopt, befriend, cheer, pet, petId, petKind, petName, release };
