/**
 * Runs every suite in its own process and prints a combined summary.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(here).filter(f => f.endsWith('.test.js')).sort();

let total = 0, failed = 0;
for (const suite of suites) {
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', join(here, suite)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  const m = /(\d+) passed, (\d+) failed/.exec(out);
  if (m) { total += Number(m[1]); failed += Number(m[2]); }
  else { console.error(`  ${suite} produced no summary`); failed++; }
  if (r.status !== 0 && !m) console.error(out.slice(-1500));
}
console.log(`\n${'='.repeat(46)}\nTOTAL: ${total} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
