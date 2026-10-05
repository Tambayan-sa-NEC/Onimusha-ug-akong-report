/**
 * The boss health bar.
 */
import { $ } from '../utils/dom.js';

/* The slab of health across the top of a boss fight. */
const bossBar = {
  wrap: $('bossBar'), name: $('bossName'), fill: $('bossFill'),
  show(c) { this.name.textContent = c.host.def.name; this.wrap.classList.add('show'); this.draw(c); },
  hide() { this.wrap.classList.remove('show'); },
  draw(c) {
    this.fill.style.width = `${Math.max(0, c.hp / c.st.hp) * 100}%`;
    this.wrap.classList.toggle('rage', !!c.rage);
  },
};

export { bossBar };
