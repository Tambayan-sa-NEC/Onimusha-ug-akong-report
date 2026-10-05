/**
 * Builds and poses every two-legged character, player and yokai alike.
 */
import * as THREE from 'three';
import { GEO, group, part } from '../../render/materials.js';

/** Humanoid facing +Z with pivots for walk cycles and small gestures. */
function makeHumanoid(o) {
  const skin = o.skin || '#f0c9a4', hairC = o.hairColor || '#1e1b1f';
  const root = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group();
  root.add(body);
  upper.position.y = 0.9;   // hip pivot so bows bend at the waist
  body.add(upper);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.14 * s, 0.88, 0);
    leg.add(part(GEO.box, o.bottom || o.top, [0, -0.4, 0], [0.22, 0.8, 0.26]));
    leg.add(part(GEO.box, '#3a302a', [0, -0.84, 0.05], [0.2, 0.08, 0.32]));
    body.add(leg); legs.push(leg);
  }
  if (o.hakama) body.add(part(GEO.hakama, o.bottom, [0, 0.62, 0]));
  if (o.robe) body.add(part(GEO.robe, o.top, [0, 0.5, 0]));

  upper.add(part(GEO.box, o.top, [0, 0.33, 0], [0.56, 0.7, 0.34]));
  upper.add(part(GEO.box, o.collar || '#f4efe4', [0, 0.52, 0.172], [0.16, 0.26, 0.01]));   // inner collar / belly
  if (o.shell) upper.add(part(GEO.dode, o.shell, [0, 0.35, -0.24], [0.34, 0.42, 0.16]));
  if (o.scarf) {   // a band of cloth wound at the neck, knotted at the front
    upper.add(part(GEO.box, o.scarf, [0, 0.55, 0], [0.38, 0.12, 0.34]));
    upper.add(part(GEO.box, o.scarf, [0.06, 0.46, 0.17], [0.1, 0.18, 0.06], [0, 0, 0.3]));
  }
  if (o.pack) {   // a bundle carried on the back
    upper.add(part(GEO.box, o.pack, [0, 0.33, -0.28], [0.44, 0.38, 0.22]));
    upper.add(part(GEO.box, '#6b5a44', [0, 0.46, -0.28], [0.46, 0.06, 0.24]));
  }
  if (o.apron) upper.add(part(GEO.box, o.apron, [0, 0.2, 0.19], [0.46, 0.5, 0.02]));
  if (o.armor) {
    upper.add(part(GEO.box, o.armor, [0, 0.32, 0], [0.62, 0.46, 0.4]));
    upper.add(part(GEO.box, '#d9b45a', [0, 0.18, 0.205], [0.5, 0.04, 0.01]));
  }
  upper.add(part(GEO.box, o.sash || '#c9b27a', [0, 0.02, 0], [0.6, 0.14, 0.38]));

  const head = new THREE.Group();
  head.position.set(0, 0.9, 0);
  upper.add(head);
  const hooded = o.hair === 'hood';
  head.add(part(GEO.ico1, hooded ? o.top : skin, [0, 0, 0], [0.24, 0.26, 0.24]));
  if (hooded) head.add(part(GEO.box, skin, [0, 0.03, 0.17], [0.3, 0.09, 0.12]));
  for (const s of [-1, 1]) head.add(part(GEO.box, '#1a1616', [0.08 * s, 0.03, hooded ? 0.235 : 0.23], [0.05, 0.035, 0.02]));
  if (o.hair === 'topknot' || o.hair === 'bun' || o.hair === 'short') head.add(part(GEO.ico1, hairC, [0, 0.1, -0.05], [0.25, 0.2, 0.24]));
  if (o.hair === 'topknot') head.add(part(GEO.box, hairC, [0, 0.29, 0], [0.07, 0.07, 0.22]));
  if (o.hair === 'bun') {
    head.add(part(GEO.ico1, hairC, [0, 0.24, -0.12], 0.14));
    head.add(part(GEO.ico, '#f49ab4', [0.13, 0.25, -0.08], 0.05));   // kanzashi
  }
  if (o.headband) head.add(part(GEO.cyl, o.headband, [0, 0.1, -0.01], [0.255, 0.06, 0.255]));
  if (o.hat === 'kasa') head.add(part(GEO.kasa, '#d6b56d', [0, 0.3, 0], [0.6, 0.28, 0.6]));
  if (o.hair === 'kappa') {   // fringe, water dish (sara) and beak
    head.add(part(GEO.cyl, '#2f4a2a', [0, 0.15, 0], [0.25, 0.08, 0.25]));
    head.add(part(GEO.cyl, '#f1ede2', [0, 0.24, 0], [0.17, 0.04, 0.17]));
    head.add(part(GEO.cyl, '#8fd0dd', [0, 0.262, 0], [0.13, 0.01, 0.13]));
    head.add(part(GEO.cone, '#e0b23a', [0, -0.05, 0.26], [0.07, 0.12, 0.06], [Math.PI / 2, 0, 0]));
  }

  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.36 * s, 0.62, 0);
    arm.add(part(GEO.box, o.top, [0.02 * s, -0.24, 0], [0.2, 0.5, 0.26]));   // wide kimono sleeve
    arm.add(part(GEO.ico, skin, [0.02 * s, -0.54, 0.02], 0.075));
    if (o.armor) arm.add(part(GEO.box, o.armor, [0.05 * s, -0.06, 0], [0.26, 0.28, 0.32]));
    upper.add(arm); arms.push(arm);
  }
  if (o.katana) {   // worn on the left hip (+X), hilt forward and up
    const k = group(
      part(GEO.box, '#1c1a1d', [0, 0, -0.2], [0.06, 0.08, 0.9]),
      part(GEO.cyl, '#b08d3a', [0, 0, 0.27], [0.09, 0.025, 0.09], [Math.PI / 2, 0, 0]),
      part(GEO.box, '#ece5d3', [0, 0, 0.44], [0.055, 0.065, 0.32]),
    );
    k.position.set(0.33, 0.02, 0.02);
    k.rotation.x = -0.35;
    upper.add(k);
  }
  const h = { root, body, upper, legs, arms, head, action: null };
  addYokaiFeatures(h, o);
  if (o.scale) root.scale.setScalar(o.scale);
  return h;
}

/** Extra parts for humanoid yokai (oni horns and club, tengu nose and wings, long neck,
    tanuki bits), for the kunoichi (ponytail, face cloth, slighter build) and for the
    rōnin (kabuto and menpō). */
function addYokaiFeatures(h, o) {
  const head = h.head;
  if (o.ponytail) {   // long hair gathered at the crown and swept down the back
    const tail = group(
      part(GEO.box, o.ponytail, [0, -0.2, 0], [0.12, 0.46, 0.1]),
      part(GEO.cone, o.ponytail, [0, -0.5, 0], [0.1, 0.24, 0.08], [Math.PI, 0, 0]),
    );
    tail.position.set(0, 0.17, -0.21);
    tail.rotation.x = -0.45;
    head.add(tail);
    h.ponytail = tail;
  }
  if (o.facemask) {   // cloth band wrapped right round the lower face, knotted at the sides
    head.add(part(GEO.cyl, o.facemask, [0, -0.14, 0], [0.252, 0.26, 0.252]));   // same band primitive as a headband
    for (const s of [-1, 1]) head.add(part(GEO.cone, o.facemask, [0.26 * s, -0.12, -0.08], [0.04, 0.22, 0.03], [0, 0, 1.9 * s]));
  }
  if (o.kabuto) {   // helmet: a domed bowl, a flared neck guard behind, and a crest at the brow
    head.add(part(GEO.cyl, o.kabuto, [0, 0.19, 0], [0.3, 0.2, 0.3]));            // hachi, the bowl
    head.add(part(GEO.ico1, o.kabuto, [0, 0.29, 0], [0.295, 0.07, 0.295]));      // its dome
    head.add(part(GEO.cyl, o.kabuto, [0, 0.05, -0.06], [0.34, 0.06, 0.3]));      // shikoro, the neck guard
    if (o.maedate) head.add(part(GEO.cone, o.maedate, [0, 0.33, 0.17], [0.12, 0.18, 0.03], [-0.5, 0, 0]));   // the crest
  }
  if (o.menpo) {   // face armour over the lower face, with a ridge along the jaw
    head.add(part(GEO.cyl, o.menpo, [0, -0.13, 0], [0.252, 0.24, 0.252]));
    head.add(part(GEO.box, o.menpo, [0, -0.26, 0.1], [0.2, 0.05, 0.16]));        // the chin
    for (const s of [-1, 1]) head.add(part(GEO.cone, o.menpo, [0.1 * s, -0.09, 0.21], [0.03, 0.09, 0.03], [0, 0, 1.2 * s]));   // moustache tusks
  }
  if (o.slim) {   // narrower shoulders and hips; the head keeps its own width
    h.upper.scale.x = 0.86;
    h.head.scale.x = 1 / 0.86;
    h.legs.forEach(l => { l.position.x *= 0.88; });
  }
  if (o.horns) for (const s of [-1, 1]) head.add(part(GEO.cone, o.horns, [0.12 * s, 0.27, 0.02], [0.05, 0.2, 0.05], [0, 0, -0.35 * s]));
  if (o.fangs) for (const s of [-1, 1]) head.add(part(GEO.cone, '#ffffff', [0.06 * s, -0.1, 0.21], [0.025, 0.07, 0.025], [Math.PI, 0, 0]));
  if (o.tiger) for (const leg of h.legs) for (let k = 0; k < 3; k++) leg.add(part(GEO.box, '#2a2626', [0, -0.12 - k * 0.2, 0], [0.23, 0.04, 0.27]));
  if (o.club) {   // studded kanabō in one hand, resting on the ground
    const club = group(part(GEO.club, '#3a3230', [0, -0.55, 0]));
    for (let i = 0; i < 6; i++) club.add(part(GEO.ico, '#8a8580', [Math.cos(i * 2.1) * 0.09, -0.7 - i * 0.07, Math.sin(i * 2.1) * 0.09], 0.03));
    club.position.set(0.02, -0.5, 0.02);
    h.arms[1].add(club);
  }
  if (o.nose) head.add(part(GEO.cone, o.nose, [0, -0.02, 0.36], [0.06, 0.32, 0.06], [Math.PI / 2, 0, 0]));
  if (o.hat === 'tokin') head.add(part(GEO.cone, '#1e1b1f', [0, 0.3, 0.06], [0.1, 0.14, 0.1]));
  if (o.wings) h.wings = [-1, 1].map(s => {
    const w = group(part(GEO.box, o.wings, [0.3 * s, 0.1, 0], [0.55, 0.7, 0.05]));
    w.position.set(0.1 * s, 0.5, -0.22);
    h.upper.add(w);
    return w;
  });
  if (o.ears) for (const s of [-1, 1]) head.add(part(GEO.ico, o.ears, [0.15 * s, 0.22, 0], 0.07));
  if (o.mask) for (const s of [-1, 1]) head.add(part(GEO.box, o.mask, [0.08 * s, 0.03, 0.225], [0.1, 0.07, 0.02]));
  if (o.belly) h.upper.add(part(GEO.ico1, o.belly, [0, 0.22, 0.14], [0.26, 0.28, 0.14]));
  if (o.tail) h.upper.add(part(GEO.ico, o.tail, [0, -0.05, -0.26], [0.12, 0.12, 0.2], [0.6, 0, 0]));
  if (o.leaf) head.add(part(GEO.ico, '#6fae4a', [0, 0.27, 0], [0.12, 0.03, 0.07]));
  if (o.neck) { h.neck = part(GEO.cyl, o.skin || '#f0c9a4', [0, 0.72, 0], [0.07, 0.2, 0.07]); h.upper.add(h.neck); }
}

/** Walk cycle + idle breathing. amt 0..1+ scales the swing. */
function poseHumanoid(h, phase, amt, t) {
  const s = Math.sin(phase);
  h.legs[0].rotation.x = s * 0.65 * amt;  h.legs[1].rotation.x = -s * 0.65 * amt;
  h.arms[0].rotation.x = -s * 0.55 * amt; h.arms[1].rotation.x = s * 0.55 * amt;
  h.arms[0].rotation.z = -0.08;           h.arms[1].rotation.z = 0.08;
  h.body.position.y = Math.abs(Math.cos(phase)) * 0.07 * amt + Math.sin(t * 2) * 0.012;
  h.body.rotation.y = 0;
  h.body.rotation.x = 0;
  h.upper.rotation.x = 0;
  h.upper.rotation.y = 0;
  h.head.rotation.x = 0;
}
const ACTION_DUR = { bow: 1.2, hop: 0.9, spin: 1.0, wave: 1.6, meditate: 3.2, dance: 2.2, throw: 0.3,
  nod: 1.0, laugh: 1.4, stretch: 1.8, ponder: 2.0, sweep: 2.4,
  slash1: 0.32, slash2: 0.32, slash3: 0.5, hurt: 0.4, kneel: 2.4, roll: 0.34 };
const COMBAT_ACTIONS = new Set(['slash1', 'slash2', 'slash3', 'throw', 'hurt', 'spin', 'kneel', 'roll']);   // walking doesn't cancel these
function startAction(h, type) { if (ACTION_DUR[type]) h.action = { type, t: 0, dur: ACTION_DUR[type] }; }
/** Gesture layer on top of the walk pose. */
function applyAction(h, dt) {
  const a = h.action; if (!a) return;
  a.t += dt;
  const k = a.t / a.dur;
  if (k >= 1) { h.action = null; return; }
  const bell = Math.sin(Math.PI * k);
  switch (a.type) {
    case 'bow': h.upper.rotation.x = bell * 0.75; break;
    case 'hop': h.body.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * 0.55; break;
    case 'spin': h.body.rotation.y = (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * Math.PI * 2; h.body.position.y = bell * 0.3; break;
    case 'roll': {   // forward tumble, tucked low and round
      h.body.rotation.x = k * Math.PI * 2;
      h.body.position.y = -0.22 * bell;
      h.legs.forEach(l => { l.rotation.x = -1.3 * bell; });
      h.arms.forEach(ar => { ar.rotation.x = -1.7 * bell; });
      break;
    }
    case 'wave': h.arms[1].rotation.set(0, 0, 2.6 + Math.sin(a.t * 14) * 0.35); break;
    case 'nod': h.head.rotation.x = Math.sin(a.t * 9) * 0.3 * bell; break;
    case 'laugh': {   // head back, shoulders going
      h.head.rotation.x = -0.3 * bell;
      h.upper.rotation.x = -0.12 * bell;
      h.body.position.y = Math.abs(Math.sin(a.t * 11)) * 0.06 * bell;
      h.arms.forEach((ar, i) => { ar.rotation.z = (i ? -0.5 : 0.5) * bell; });
      break;
    }
    case 'stretch': {   // both arms up and a long lean back
      h.arms.forEach(ar => { ar.rotation.x = -2.7 * bell; });
      h.upper.rotation.x = -0.3 * bell;
      h.head.rotation.x = -0.2 * bell;
      break;
    }
    case 'ponder': {   // one hand to the chin, head tipped
      h.arms[1].rotation.set(-2.2 * bell, 0, 0.5 * bell);
      h.head.rotation.z = 0.22 * bell;
      h.head.rotation.x = 0.1 * bell;
      break;
    }
    case 'sweep': {   // both hands low, working side to side
      const w = Math.sin(a.t * 5) * bell;
      h.arms.forEach(ar => { ar.rotation.x = -0.9 * bell; ar.rotation.y = w * 0.5; });
      h.upper.rotation.x = 0.35 * bell;
      h.upper.rotation.y = w * 0.3;
      break;
    }
    case 'meditate': {
      const d = Math.min(1, Math.min(a.t, a.dur - a.t) * 3);
      h.body.position.y = -0.62 * d;
      h.legs.forEach(l => { l.rotation.x = -1.45 * d; });
      h.arms.forEach((ar, i) => { ar.rotation.x = -0.9 * d; ar.rotation.z = (i ? -0.5 : 0.5) * d; });
      break;
    }
    case 'slash1': {   // overhead cut: quick raise, fast chop down
      const x = k < 0.2 ? -2.9 * (k / 0.2) : -2.9 + Math.min(1, (k - 0.2) / 0.22) * 2.5;
      h.arms[0].rotation.set(x, 0, 0.3); h.arms[1].rotation.set(x, 0, -0.3);
      h.upper.rotation.x = k < 0.2 ? -0.15 : 0.35;
      break;
    }
    case 'slash2': {   // horizontal sweep: wind the torso right, whip it left
      const y = k < 0.2 ? 1.1 * (k / 0.2) : 1.1 - Math.min(1, (k - 0.2) / 0.25) * 2.2;
      h.arms[0].rotation.set(-1.45, 0, 0.45); h.arms[1].rotation.set(-1.45, 0, -0.45);
      h.upper.rotation.y = y; h.upper.rotation.x = 0.15;
      h.legs[0].rotation.x = -0.35; h.legs[1].rotation.x = 0.35;   // wide stance
      break;
    }
    case 'slash3': {   // spinning finisher with a little hop
      const e = 1 - Math.pow(1 - k, 3);
      h.body.rotation.y = e * Math.PI * 2;
      h.body.position.y = Math.sin(Math.PI * k) * 0.35;
      h.arms[0].rotation.set(-1.5, 0, 0.9); h.arms[1].rotation.set(-1.2, 0, -0.3);
      h.upper.rotation.x = 0.2;
      h.legs[0].rotation.x = -0.6 * bell; h.legs[1].rotation.x = 0.4 * bell;
      break;
    }
    case 'throw': {   // kunai: wind the arm back over the shoulder, then snap it through
      const x = k < 0.35 ? -0.4 - 2.3 * (k / 0.35) : -2.7 + Math.min(1, (k - 0.35) / 0.3) * 3.5;
      h.arms[0].rotation.set(x, 0, 0.25);
      h.upper.rotation.y = 0.55 - Math.min(1, k / 0.6) * 1.0;
      h.upper.rotation.x = 0.12;
      h.legs[0].rotation.x = -0.25 * bell; h.legs[1].rotation.x = 0.25 * bell;
      break;
    }
    case 'hurt': {   // flinch backwards, arms thrown out
      h.upper.rotation.x = -0.6 * bell;
      h.arms[0].rotation.set(-0.6 * bell, 0, -1.0 * bell); h.arms[1].rotation.set(-0.6 * bell, 0, 1.0 * bell);
      h.head.rotation.x = -0.3 * bell;
      break;
    }
    case 'kneel': {  // defeated: drop to one knee, head bowed
      const d = Math.min(1, a.t * 4);
      h.body.position.y = -0.42 * d;
      h.legs[0].rotation.x = -1.5 * d; h.legs[1].rotation.x = 0.7 * d;
      h.upper.rotation.x = 0.55 * d;
      h.arms[0].rotation.set(-0.5 * d, 0, 0); h.arms[1].rotation.set(-0.2 * d, 0, 0);
      break;
    }
    case 'dance': {
      const w = Math.sin(a.t * 6);
      h.body.rotation.y = w * 0.6;
      h.arms[0].rotation.z = -2.1 - w * 0.3; h.arms[1].rotation.z = 2.1 - w * 0.3;
      h.body.position.y = Math.abs(Math.sin(a.t * 12)) * 0.1;
      break;
    }
  }
}

export { ACTION_DUR, COMBAT_ACTIONS, addYokaiFeatures, applyAction, makeHumanoid, poseHumanoid, startAction };
