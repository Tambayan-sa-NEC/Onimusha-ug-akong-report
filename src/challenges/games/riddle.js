import { chUI, el, hostEmoteH, setStatus, shuffle } from '../system.js';
import { DIGIT, QUIZ } from '../../data/quiz.js';
import { emote } from '../../render/effects/emotes.js';
import { Sound } from '../../systems/audio.js';

const riddle = { seal: '首', title: 'Riddles of the long neck', locks: true,
  how: 'Answer with 1, 2 or 3, or click. Two right answers out of three wins.',
  start(c) {
    c.qs = shuffle(QUIZ).slice(0, 3); c.i = 0; c.right = 0; c.wrong = 0; c.wait = 0;
    c.panel = el('div', 'panel quiz', undefined, chUI.stage);
    riddle.show(c);
  },
  show(c) {
    const [q, ...answers] = c.qs[c.i];
    c.opts = shuffle(answers); c.correct = c.opts.indexOf(answers[0]); c.locked = false;
    c.panel.innerHTML = '';
    el('div', 'q', q, c.panel);
    c.btns = c.opts.map((a, i) => {
      const b = el('button', 'opt', `${i + 1}. ${a}`, c.panel);
      b.onmousedown = e => { e.preventDefault(); riddle.choose(c, i); };   // no focus, so Space can't re-click
      return b;
    });
    c.host.stretch = 1;   // the neck shoots up with every question
  },
  choose(c, i) {
    if (c.locked || c.done) return;
    c.locked = true;
    const ok = i === c.correct;
    if (ok) c.right++; else c.wrong++;
    c.btns[c.correct].classList.add('right');
    if (!ok) c.btns[i].classList.add('wrong');
    Sound.sfx(ok ? 'good' : 'bad');
    emote(c.host.b.obj.position, c.host.b.dir, ok ? '○' : '×', hostEmoteH(c.host) + 0.6);
    c.wait = 1.3;
  },
  update(c, dt) {
    if (c.wait > 0 && (c.wait -= dt) <= 0) {
      if (c.right >= 2) return 'win';
      if (c.wrong >= 2) return 'lose';
      c.i++; riddle.show(c);
    }
    setStatus(`Question ${c.i + 1} of 3    Right ${c.right}`);
    return null;
  },
  key(c, code) { if (DIGIT[code] !== undefined) riddle.choose(c, DIGIT[code]); },
};

export { riddle };
