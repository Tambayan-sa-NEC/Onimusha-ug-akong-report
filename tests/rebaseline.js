/**
 * Rewrite `tests/baseline.json` from the world as it is generated now.
 *
 * This is a deliberate act, not a way to make a red test green. `tests/world.test.js`
 * failing means the planet changed; it is the only warning that a reordered call or a
 * stray `rand()` has regenerated a different world. Run this only once you have looked
 * at what moved and are satisfied it is what you meant.
 *
 *   node --experimental-vm-modules tests/rebaseline.js          # show what would change
 *   node --experimental-vm-modules tests/rebaseline.js --write  # and write it
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot } from './env.js';
import fingerprint from './fingerprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'baseline.json');
const old = JSON.parse(readFileSync(file, 'utf8'));

const g = await boot();
const now = fingerprint(g.T);

let changed = 0;
for (const key of Object.keys({ ...old, ...now })) {
  const a = String(old[key]), b = String(now[key]);
  if (a === b) { console.log(`  same      ${key}`); continue; }
  changed++;
  // The long list fields are only readable as a difference.
  if (a.includes('|') || b.includes('|')) {
    const A = a.split('|'), B = b.split('|');
    console.log(`  CHANGED   ${key}: ${A.length} -> ${B.length} entries`);
    for (const x of B.filter(v => !A.includes(v))) console.log(`              + ${x}`);
    for (const x of A.filter(v => !B.includes(v))) console.log(`              - ${x}`);
  } else {
    console.log(`  CHANGED   ${key}: ${a} -> ${b}`);
  }
}

if (!changed) { console.log('\nThe world is unchanged. Nothing to write.'); process.exit(0); }
if (!process.argv.includes('--write')) {
  console.log(`\n${changed} field(s) would change. Re-run with --write once you are sure.`);
  process.exit(0);
}
writeFileSync(file, JSON.stringify(now, null, 2) + '\n');
console.log(`\nWrote ${file}. Commit it on its own, saying why the world moved.`);
