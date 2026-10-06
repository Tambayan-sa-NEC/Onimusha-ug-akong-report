/**
 * Boots the real game in a fake browser so behaviour can be asserted from Node.
 *
 * Each boot builds a fresh ES module graph with vm.SourceTextModule, so tests are
 * fully isolated from one another. Nothing in src/ is modified or instrumented —
 * the handle below is assembled from the modules' own exports.
 *
 * Needs --experimental-vm-modules (see the "test" script in package.json).
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------ a fake browser ------------------------------ */

function ctx2d() {
  return {
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '',
    measureText: t => ({ width: String(t).length * 28 }),
    beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, closePath() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {}, rect() {}, roundRect() {},
    fill() {}, stroke() {}, fillText() {}, strokeText() {}, clearRect() {}, fillRect() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, drawImage() {}, setLineDash() {}, clip() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
}

class El {
  constructor(tag, id) {
    this.tagName = String(tag).toUpperCase();
    this.id = id || '';
    this.children = [];
    this.style = {};
    this.width = 300;
    this.height = 150;
    this._text = '';
    this._html = '';
    this._handlers = {};
    const set = new Set();
    this.classList = {
      set,
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; on ? set.add(c) : set.delete(c); },
      contains: c => set.has(c),
    };
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v == null ? '' : String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v == null ? '' : String(v); if (!this._html) this.children = []; }
  get className() { return [...this.classList.set].join(' '); }
  set className(v) {
    this.classList.set.clear();
    String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList.set.add(c));
  }
  appendChild(c) { this.children.push(c); return c; }
  prepend(c) { this.children.unshift(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const a = this._handlers[type];
    if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  }
  dispatch(type, ev) { (this._handlers[type] || []).forEach(fn => fn(ev || { type, preventDefault() {} })); }
  getContext(type) { return type === '2d' ? ctx2d() : null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
}

/** Deterministic Math.random so repeated runs line up. */
function seedMathRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------- the boot --------------------------------- */

/** Start the game in a fresh module graph. Returns a handle for driving and inspecting it. */
export async function boot({ randomSeed = 7, coarsePointer = false } = {}) {
  seedMathRandom(randomSeed);

  const elements = new Map();
  const getEl = id => {
    if (!elements.has(id)) elements.set(id, new El('div', id));
    return elements.get(id);
  };
  const listeners = {};
  const on = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const fire = (type, ev) => (listeners[type] || []).forEach(fn => fn(ev));

  let nowMs = 0;
  let pending = null;
  const canvas = new El('canvas');

  // A stand-in for localStorage, so saved settings and keybinds can be asserted.
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(),
  };

  // A module namespace is frozen, so work from a mutable copy. The one piece of
  // three that needs a real GPU is swapped out on it.
  const three = { ...THREE };
  three.WebGLRenderer = function WebGLRenderer() {
    return {
      domElement: canvas,
      setPixelRatio() {}, setSize() {}, render() {}, setClearColor() {}, dispose() {},
      shadowMap: {}, outputEncoding: 0, toneMapping: 0,
    };
  };

  const sandbox = {
    THREE: three, console, Math, Date, JSON, Set, Map, Array, Object, String, Number, Boolean,
    Float32Array, Uint16Array, Uint32Array, isNaN, parseFloat, parseInt, Error, RegExp, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => nowMs },
    requestAnimationFrame(cb) { pending = cb; return 1; },
    cancelAnimationFrame() { pending = null; },
    devicePixelRatio: 1,
    // Enough of a device for the touch layer to make up its mind about.
    navigator: { maxTouchPoints: coarsePointer ? 5 : 0, userAgent: 'node' },
    matchMedia: q => ({ matches: coarsePointer && /coarse/.test(q), media: q,
      addEventListener() {}, removeEventListener() {} }),
    localStorage,
    innerWidth: 1280,
    innerHeight: 720,
    AudioContext: undefined,          // Sound.init() bails out harmlessly without one
    webkitAudioContext: undefined,
    addEventListener: on,
    removeEventListener() {},
    document: {
      body: new El('body'),
      getElementById: getEl,
      createElement: tag => new El(tag),
      documentElement: new El('html'),
      fullscreenElement: null,
      addEventListener: on,
      removeEventListener() {},
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  // The namespace already carries a `default` from CommonJS interop, so dedupe.
  const threeExports = [...new Set(['default', ...Object.keys(three)])];
  const threeModule = new vm.SyntheticModule(threeExports, function () {
    for (const k of threeExports) this.setExport(k, k === 'default' ? three : three[k]);
  }, { context, identifier: 'three' });

  const modules = new Map();
  const loadModule = file => {
    if (modules.has(file)) return modules.get(file);
    const src = fs.readFileSync(file, 'utf8');
    const m = new vm.SourceTextModule(src, { context, identifier: file });
    modules.set(file, m);
    return m;
  };
  const link = (specifier, referencing) =>
    specifier === 'three'
      ? threeModule
      : loadModule(path.resolve(path.dirname(referencing.identifier), specifier));

  const entry = loadModule(path.join(ROOT, 'src', 'main.js'));
  await entry.link(link);
  await entry.evaluate();

  /* Every export from every module, as live getters so mutable bindings stay current. */
  const T = { THREE: three };
  for (const m of modules.values()) {
    const ns = m.namespace;
    for (const key of Object.keys(ns)) {
      if (key in T) continue;
      Object.defineProperty(T, key, { get: () => ns[key], enumerable: true, configurable: true });
    }
  }
  Object.defineProperty(T, 'started', { get: () => T.session.started, enumerable: true });

  return {
    T,
    els: getEl,
    storage: store,
    localStorage,
    canvas,
    get clock() { return nowMs / 1000; },
    /** Advance one frame. The game caps raw dt at 0.05s, so that is the useful maximum. */
    step(dt = 0.05) {
      nowMs += dt * 1000;
      if (!pending) throw new Error('no frame scheduled');
      const cb = pending;
      pending = null;
      cb();
    },
    /** Advance `seconds` of simulated time; `each` may return false to stop early. */
    run(seconds, dt = 0.05, each) {
      const n = Math.max(1, Math.round(seconds / dt));
      for (let i = 0; i < n; i++) {
        this.step(dt);
        if (each && each(i) === false) return false;
      }
      return true;
    },
    press(code) { fire('keydown', { code, preventDefault() {} }); },
    release(code) { fire('keyup', { code, preventDefault() {} }); },
    /** Fire a mouse button at the game canvas. 0 = left. */
    click(button = 0) { canvas.dispatch('pointerdown', { button, preventDefault() {} }); },
  };
}
