/* The planet is generated from one seeded random stream, so the order in which the
   world-building steps run is itself behaviour. This compares a fingerprint of the
   generated world against the one captured from the original single-file build. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot } from './env.js';
import fingerprint from './fingerprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(join(here, 'baseline.json'), 'utf8'));

let pass = 0, fail = 0;
const results = [];
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  results.push([ok ? 'PASS' : 'FAIL', name,
    ok ? '' : `expected ${String(expected).slice(0, 40)}, got ${String(actual).slice(0, 40)}`]);
  ok ? pass++ : fail++;
}

const g = await boot();
const now = fingerprint(g.T);
for (const key of Object.keys(baseline)) check(`world fingerprint: ${key}`, now[key], baseline[key]);

const w = Math.max(...results.map(r => r[1].length));
for (const [status, name, msg] of results) console.log(`  ${status}  ${name.padEnd(w)}${msg ? '  <- ' + msg : ''}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
