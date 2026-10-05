/* A stable summary of the generated world. Any change to the order in which the
   seeded RNG is consumed will change this, so it is the proof that a refactor
   did not disturb world generation. */
const r3 = v => [v.x, v.y, v.z].map(n => n.toFixed(6)).join(',');
export default function fingerprint(T) {
  const o = {};
  o.R = T.R;
  o.spawn = r3(T.SPAWN);
  o.gate = r3(T.GATE_DIR);
  o.colliders = T.colliders.length;
  o.colliderSum = T.colliders.map(c => r3(c.p) + ':' + c.r.toFixed(4)).join('|').length;
  o.hosts = T.hosts.map(h => h.def.name + '@' + r3(h.b.dir)).join('|');
  o.npcs = T.npcs.filter(n => n.def && n.def.name).map(n => n.def.name + '@' + r3(n.b.dir)).join('|');
  o.critters = T.critters.length;
  o.critterPos = T.critters.map(c => (c.b ? r3(c.b.dir) : 'koi')).join('|');
  let meshes = 0, verts = 0;
  T.scene.traverse(m => { if (m.isMesh) { meshes++; verts += m.geometry.attributes.position.count; } });
  o.meshes = meshes; o.verts = verts;
  return o;
};
