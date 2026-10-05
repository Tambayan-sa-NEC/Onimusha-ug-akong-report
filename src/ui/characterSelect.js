/**
 * The opening screens — title, character select, credits — and the way back to them.
 *
 * The live planet turns behind all of them, so the first thing you see is the game
 * running rather than a picture of it.
 */
import { ch, el } from '../challenges/system.js';
import { bossWon, slain, won } from '../challenges/system.js';
import { buildSeals } from '../challenges/seals.js';
import { clearKunai } from '../combat/kunai.js';
import { CHARACTERS } from '../config/characters.js';
import { last } from '../core/GameLoop.js';
import { hasProgress, loadProgress, saveProgress } from '../core/save.js';
import { session } from '../core/Session.js';
import { setCharacter, setWolf, player } from '../entities/Player.js';
import { beacon } from '../render/effects/rings.js';
import { Sound } from '../systems/audio.js';
import { HUNT, endHunt, hunter } from '../systems/hunting.js';
import { clearInput } from '../systems/input.js';
import { clearPreviews, createPreview } from './charPreview.js';
import { clearPrompt, closeDialog } from './dialog.js';
import { openFromTitle } from './pause.js';
import { $ } from '../utils/dom.js';

const CHAR_ORDER = ['samurai', 'shinobi'];
/** `page` is which screen is up; `i` is the highlighted item on it. */
const menu = { page: 'title', i: 0, cards: [], items: [] };

const PAGES = ['title', 'select', 'credits'];

/* ---------------------------------- the title --------------------------------- */

function buildTitle() {
  const box = $('mTitle');
  box.innerHTML = '';
  el('h1', undefined, 'Onimusha', box);
  el('p', 'lede', 'A tiny planet of sakura, sleepy cats, and yokai who would like a word.', box);

  const list = el('div', 'mlist', undefined, box);
  menu.items = [];
  const add = (label, note, onPick) => {
    const b = el('button', 'mitem', undefined, list);
    el('span', 'mlabel', label, b);
    if (note) el('span', 'mnote', note, b);
    b.addEventListener('click', onPick);
    menu.items.push({ el: b, pick: onPick });
    return b;
  };

  const saved = loadProgress();
  if (saved) {
    const n = saved.won.length + saved.bossWon.length;
    add('Continue', `${CHARACTERS[saved.char].name} · ${n} seal${n === 1 ? '' : 's'}`, continueRun);
  }
  add(saved ? 'New journey' : 'Begin', saved ? 'start over, losing the run above' : undefined,
    () => showPage('select'));
  add('Settings', undefined, () => openFromTitle('settings'));
  add('Controls', undefined, () => openFromTitle('keys'));
  add('Credits', undefined, () => showPage('credits'));

  menu.i = 0;
  paintMenu();
}

/* ------------------------------ character select ------------------------------ */

function buildSelect() {
  const box = $('mSelect');
  box.innerHTML = '';
  el('h2', undefined, 'Choose your way', box);

  const picks = el('div', undefined, undefined, box);
  picks.id = 'picks';
  clearPreviews();
  menu.cards = CHAR_ORDER.map((id, i) => {
    const c = CHARACTERS[id];
    const card = el('button', 'pick', undefined, picks);
    card.appendChild(createPreview(c.look));     // the figure itself, turning
    el('div', 'seal', c.kanji, card);
    el('div', 'pname', c.name, card);
    el('div', 'ptag', c.tag, card);

    // The difference between them, shown rather than described.
    const stats = el('div', 'pstats', undefined, card);
    stat(stats, 'Hearts', '♥'.repeat(c.hp) + '♡'.repeat(5 - c.hp));
    stat(stats, 'Pace', c.speed > 1 ? 'quick' : 'steady');
    stat(stats, 'Reach', c.art === 'kunai' ? 'thrown kunai' : 'sword combo');
    stat(stats, 'Escape', c.art === 'kunai' ? 'shadow dash' : 'dodge roll');
    stat(stats, 'Company', c.wolf ? 'a wolf' : 'none');

    el('div', 'pdesc', undefined, card).innerHTML = c.blurb;
    card.addEventListener('click', () => { menu.i = i; paintMenu(); start(id); });
    return card;
  });

  el('p', 'go', undefined, box).innerHTML =
    'Click a character — or <kbd>←</kbd><kbd>→</kbd> to choose, <kbd>Enter</kbd> to begin, <kbd>Esc</kbd> to go back';
  menu.i = 0;
  menu.items = menu.cards.map((card, i) => ({ el: card, pick: () => start(CHAR_ORDER[i]) }));
  paintMenu();
}
function stat(parent, label, value) {
  const r = el('div', 'pstat', undefined, parent);
  el('span', 'pskey', label, r);
  el('span', 'psval', value, r);
}

/* --------------------------------- the credits -------------------------------- */

function buildCredits() {
  const box = $('mCredits');
  box.innerHTML = '';
  el('h2', undefined, 'Credits', box);
  const body = el('div', 'mbody', undefined, box);
  el('p', undefined, 'Onimusha is built from flat-shaded primitives in code. There are no art '
    + 'assets: every model is geometry, every texture is drawn to a canvas at runtime, and the '
    + 'music and effects are synthesised from oscillators while you play.', body);
  el('p', undefined, 'Rendered with three.js. No build step, no bundler — the game is plain '
    + 'ES modules served straight to the browser.', body);
  el('p', undefined, 'The planet is generated from one seeded random stream, so it is the same '
    + 'small world on every visit.', body);
  const back = el('button', 'mitem', undefined, box);
  el('span', 'mlabel', 'Back', back);
  back.addEventListener('click', () => showPage('title'));
  menu.items = [{ el: back, pick: () => showPage('title') }];
  menu.i = 0;
  paintMenu();
}

/* ------------------------------- paging and keys ------------------------------ */

function showPage(page) {
  menu.page = page;
  for (const p of PAGES) $(pageId(p)).classList.toggle('on', p === page);
  if (page === 'title') buildTitle();
  else if (page === 'select') buildSelect();
  else buildCredits();
}
const pageId = p => ({ title: 'mTitle', select: 'mSelect', credits: 'mCredits' })[p];

function paintMenu() {
  menu.items.forEach((it, i) => it.el.classList.toggle('on', i === menu.i));
  menu.cards.forEach((card, i) => card.classList.toggle('on', i === menu.i));
}

/** Build the opening screens. Called once, before the first frame. */
function buildMenu() { showPage('title'); }

function menuKey(code) {
  const n = menu.items.length;
  if (!n) return;
  // The select screen reads left/right; the stacked lists read up/down. Both accept either.
  const prev = ['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(code);
  const next = ['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(code);
  if (prev) { menu.i = menu.i ? menu.i - 1 : n - 1; paintMenu(); }
  else if (next) { menu.i = menu.i === n - 1 ? 0 : menu.i + 1; paintMenu(); }
  else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') menu.items[menu.i].pick();
  else if (code === 'Escape' && menu.page !== 'title') showPage('title');
}

/* ------------------------------- starting a run ------------------------------- */

/** Begin play. There is no default: a character has to be chosen. */
function start(id) {
  if (session.started || !CHARACTERS[id]) return;
  setCharacter(id);
  session.started = true;
  Sound.init();
  $('overlay').classList.add('hide');
  recordProgress();
}

/** Pick up the saved run: the same character, holding the same seals. */
function continueRun() {
  const saved = loadProgress();
  if (!saved) return false;
  won.clear(); bossWon.clear(); slain.clear();
  for (const k of saved.won) won.add(k);
  for (const k of saved.bossWon) bossWon.add(k);
  for (const k of saved.slain) slain.add(k);
  buildSeals();
  start(saved.char);
  return true;
}

/** Write down where the run has got to. Cheap, and only ever loses the last seal. */
function recordProgress() {
  if (!player.char) return;
  saveProgress({ char: player.char.id, won, bossWon, slain });
}

/** Step back to the opening screens, leaving nothing of this character behind. */
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
  showPage('title');
}

export {
  CHAR_ORDER, buildMenu, continueRun, hasProgress, menu, menuKey, paintMenu,
  recordProgress, showPage, start, toMenu,
};
