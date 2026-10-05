/**
 * The opening screen, and the way back to it.
 */
import { ch, el } from '../challenges/system.js';
import { clearKunai } from '../combat/kunai.js';
import { CHARACTERS } from '../config/characters.js';
import { last } from '../core/GameLoop.js';
import { session } from '../core/Session.js';
import { setCharacter, setWolf } from '../entities/Player.js';
import { beacon } from '../render/effects/rings.js';
import { Sound } from '../systems/audio.js';
import { HUNT, endHunt, hunter } from '../systems/hunting.js';
import { clearInput } from '../systems/input.js';
import { clearPrompt, closeDialog } from './dialog.js';
import { $ } from '../utils/dom.js';

/* ---------- Character select: the first thing you see, every time ---------- */
const CHAR_ORDER = ['samurai', 'shinobi'];
const menu = { i: 0, cards: [] };
function buildMenu() {
  const box = $('picks');
  box.innerHTML = '';
  menu.cards = CHAR_ORDER.map((id, i) => {
    const c = CHARACTERS[id], card = el('button', 'pick', undefined, box);
    el('div', 'seal', c.kanji, card);
    el('div', 'pname', c.name, card);
    el('div', 'ptag', c.tag, card);
    el('div', 'pdesc', undefined, card).innerHTML = c.blurb;
    card.addEventListener('click', () => { menu.i = i; paintMenu(); start(id); });
    return card;
  });
  paintMenu();
}
function paintMenu() { menu.cards.forEach((card, i) => card.classList.toggle('on', i === menu.i)); }
function menuKey(code) {
  const last = CHAR_ORDER.length - 1;
  if (code === 'ArrowLeft' || code === 'KeyA') { menu.i = menu.i ? menu.i - 1 : last; paintMenu(); }
  else if (code === 'ArrowRight' || code === 'KeyD') { menu.i = menu.i === last ? 0 : menu.i + 1; paintMenu(); }
  else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') start(CHAR_ORDER[menu.i]);
}
/** Begin play. There is no default: a character has to be chosen. */
function start(id) {
  if (session.started || !CHARACTERS[id]) return;
  setCharacter(id);
  session.started = true;
  Sound.init();
  $('overlay').classList.add('hide');
}
/** Step back to the select screen, leaving nothing of this character behind. */
function toMenu() {
  if (ch.active) return;             // finish or forfeit what you are in first
  session.started = false;
  clearInput();
  if (hunter) endHunt(hunter, HUNT.rest);
  clearKunai();
  setWolf(false);
  closeDialog();
  clearPrompt();
  beacon.visible = false;
  $('overlay').classList.remove('hide');
  paintMenu();
}

export { CHAR_ORDER, buildMenu, menu, menuKey, paintMenu, start, toMenu };
