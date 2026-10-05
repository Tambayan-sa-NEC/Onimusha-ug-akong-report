import { chUI, el, hostEmoteH, setStatus } from '../system.js';
import { DIGIT } from '../../data/quiz.js';
import { emote } from '../../render/effects/emotes.js';
import { Sound } from '../../systems/audio.js';

const shell = { seal: '狸', title: 'Tanuki kettle shuffle', locks: true,
  how: 'The tanuki hides in one kettle. Follow it, then pick with 1, 2 or 3, or click. Win 2 of 3 rounds.',
  start(c) {
    const panel = el('div', 'panel', undefined, chUI.stage);
    const row = el('div', 'kettles', undefined, panel);
    c.cups = [0, 1, 2].map(i => {
      const e = el('div', 'kettle', '', row);
      e.onmousedown = ev => { ev.preventDefault(); shell.pick(c, c.cups[i].slot); };
      return { e, slot: i };
    });
    el('div', 'slotnums', undefined, panel).innerHTML = '<span>1</span><span>2</span><span>3</span>';
    c.round = 0; c.w = 0; c.l = 0;
    shell.next(c);
  },
  place(cup, lift = 0) { cup.e.style.transform = `translate(${cup.slot * 120}px, ${lift}px)`; },
  next(c) {
    c.round++;
    c.prize = Math.floor(Math.random() * 3);
    c.cups.forEach((cup, i) => {
      cup.e.textContent = i === c.prize ? '狸' : '';
      cup.e.classList.remove('miss');
      cup.e.classList.toggle('open', i === c.prize);
      shell.place(cup);
    });
    c.phase = 'reveal'; c.timer = 1.4;
    c.swaps = 4 + c.round * 3; c.swapDur = 0.55 - c.round * 0.1;
  },
  update(c, dt) {
    setStatus(c.phase === 'pick' ? 'Which kettle? (1, 2, 3)' : `Round ${c.round} of 3    You ${c.w}    Tanuki ${c.l}`);
    if ((c.timer -= dt) > 0) return null;
    if (c.phase === 'reveal') {
      c.cups.forEach(cup => { cup.e.textContent = ''; cup.e.classList.remove('open'); cup.e.style.transitionDuration = c.swapDur * 0.9 + 's'; });
      c.phase = 'shuffle'; c.timer = 0.3;
    } else if (c.phase === 'shuffle') {
      c.cups.forEach(cup => shell.place(cup));   // settle the previous swap
      if (c.swaps-- > 0) {
        const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
        const ca = c.cups.find(k => k.slot === a), cb = c.cups.find(k => k.slot === b);
        ca.slot = b; cb.slot = a;
        shell.place(ca, -28); shell.place(cb, 28);
        c.timer = c.swapDur;
      } else c.phase = 'pick';
    } else if (c.phase === 'result') {
      if (c.w >= 2) return 'win';
      if (c.l >= 2) return 'lose';
      shell.next(c);
    }
    return null;
  },
  pick(c, slot) {
    if (c.phase !== 'pick' || c.done) return;
    const cup = c.cups.find(k => k.slot === slot), ok = c.cups.indexOf(cup) === c.prize;
    if (ok) c.w++; else c.l++;
    const prizeCup = c.cups[c.prize];
    prizeCup.e.textContent = '狸'; prizeCup.e.classList.add('open');
    if (!ok) { cup.e.textContent = '葉'; cup.e.classList.add('open', 'miss'); }
    Sound.sfx(ok ? 'good' : 'bad');
    emote(c.host.b.obj.position, c.host.b.dir, ok ? 'ぽん!' : 'ケケッ', hostEmoteH(c.host) + 0.6);
    c.phase = 'result'; c.timer = 1.4;
  },
  key(c, code) { if (DIGIT[code] !== undefined) shell.pick(c, DIGIT[code]); },
};

export { shell };
