/**
 * Procedural wind, koto plucks and sound effects. No audio files.
 */
import { last } from '../core/GameLoop.js';
import { player } from '../entities/Player.js';
import { clamp } from '../utils/math.js';

const Sound = {
  ctx: null, master: null, echo: null, white: null, muted: false, idx: 6,
  scale: [164.81, 174.61, 220.0, 246.94, 261.63, 329.63, 349.23, 440.0, 493.88, 523.25, 659.25],
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);
    // echo send
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.42; fb.gain.value = 0.38; wet.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);
    this.echo = delay;
    // noise buffers (brown for wind, white for splashes)
    const len = ctx.sampleRate * 3;
    const brown = ctx.createBuffer(1, len, ctx.sampleRate), white = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = brown.getChannelData(0), wd = white.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; wd[i] = w; last = (last + 0.02 * w) / 1.02; bd[i] = last * 3.5; }
    this.white = white;
    const src = ctx.createBufferSource(); src.buffer = brown; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.18;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 250;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
    // gentle wandering melody
    const next = () => {
      this.idx = clamp(this.idx + Math.floor(Math.random() * 5) - 2, 0, this.scale.length - 1);
      this.pluck(this.scale[this.idx], 0.09);
      if (Math.random() < 0.25) setTimeout(() => this.pluck(this.scale[Math.max(0, this.idx - 2)], 0.06), 180);
      setTimeout(next, 1400 + Math.random() * 3000);
    };
    setTimeout(next, 800);
  },
  pluck(freq, vol = 0.1) {
    const ctx = this.ctx; if (!ctx || this.muted) return;
    const t = ctx.currentTime, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + 1.5);
    for (const [type, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3.01, 0.12]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = freq * mul; og.gain.value = v;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + 2.5);
    }
    lp.connect(g); g.connect(this.master); g.connect(this.echo);
  },
  tone(f0, f1, dur, type = 'sine', vol = 0.08) {
    const ctx = this.ctx; if (!ctx || this.muted || vol <= 0.001) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  noiseBurst(dur, freq, vol) {
    const ctx = this.ctx; if (!ctx || this.muted || vol <= 0.001) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.white; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 2); s.stop(t + dur);
  },
  sfx(name, v = 1) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'meow': this.tone(820, 520, 0.38, 'sine', 0.07 * v); break;
      case 'bark': this.tone(480, 240, 0.1, 'square', 0.035 * v); setTimeout(() => this.tone(460, 230, 0.1, 'square', 0.03 * v), 150); break;
      case 'howl': this.tone(430, 300, 0.75, 'sine', 0.055 * v); setTimeout(() => this.tone(350, 250, 0.55, 'sine', 0.04 * v), 340); break;
      case 'chirp': this.tone(2600, 3400, 0.07, 'sine', 0.04 * v); setTimeout(() => this.tone(2800, 3600, 0.06, 'sine', 0.035 * v), 90); break;
      case 'splash': this.noiseBurst(0.35, 1800, 0.25 * v); break;
      case 'jump': this.tone(320, 520, 0.12, 'triangle', 0.04); break;
      case 'talk': this.pluck(659.25, 0.08); setTimeout(() => this.pluck(880, 0.05), 120); break;
      case 'poof': this.noiseBurst(0.45, 700, 0.35); break;
      case 'kon': this.tone(900, 1350, 0.14, 'triangle', 0.05 * v); break;
      case 'boing': this.tone(260, 620, 0.18, 'triangle', 0.06 * v); setTimeout(() => this.tone(300, 700, 0.15, 'triangle', 0.05 * v), 170); break;
      case 'boo': this.tone(340, 170, 0.45, 'sine', 0.08 * v); break;
      case 'wisp': this.pluck(987.77, 0.035 * v); break;
      case 'good': this.pluck(880, 0.07); break;
      case 'bad': this.tone(210, 140, 0.2, 'square', 0.03); break;
      case 'win': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.pluck(f, 0.08), i * 120)); break;
      case 'lose': this.tone(330, 160, 0.6, 'triangle', 0.07); break;
      case 'boom': this.noiseBurst(0.5, 180, 0.7); this.tone(120, 45, 0.45, 'sine', 0.15); break;
      case 'hit': this.tone(180, 90, 0.25, 'square', 0.05); break;
      case 'clash': this.noiseBurst(0.18, 3200, 0.45); this.pluck(1318.5, 0.06); break;
      case 'swish': this.noiseBurst(0.16, 2400, 0.22); break;
    }
  },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.1);
  },
};
/** 0..1 volume falloff from the player. */
const nearVol = pos => clamp(1 - player.body.obj.position.distanceTo(pos) / 14, 0, 1);

export { Sound, nearVol };
