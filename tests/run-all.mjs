// Runs every test in one go: `npm test`.
// Review tests: each tests/review/*.test.mjs file runs the app's own code from src/lib.
// Export test: builds a workbook from a synthetic scenario, then checks it against
// the lab's master-sheet rules (the check needs python3 + openpyxl; skipped if missing).
import { spawnSync } from 'node:child_process';
import { readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
const reg = ['--import', './tests/export/register.mjs'];
let failed = 0;

for (const f of readdirSync('tests/review').filter((n) => n.endsWith('.test.mjs')).sort()) {
  const r = run(process.execPath, [...reg, join('tests/review', f)]);
  if (r.status === 0) console.log(`PASS  review/${f}`);
  else { failed++; console.log(`FAIL  review/${f}\n${r.stdout}${r.stderr}`); }
}

const out = join(mkdtempSync(join(tmpdir(), 'lm-export-')), 'export');
const build = run(process.execPath, [...reg, 'tests/export/run.mjs', out]);
if (build.status !== 0) { failed++; console.log(`FAIL  export/run.mjs\n${build.stdout}${build.stderr}`); }
else {
  const check = run('python3', ['tests/export/check.py', out]);
  if (check.error || /No module named/.test(check.stderr)) console.log('SKIP  export/check.py (needs python3 + openpyxl)');
  else if (check.status === 0) console.log(`PASS  export/check.py · ${(check.stdout.trim().split('\n').pop() || '').trim()}`);
  else { failed++; console.log(`FAIL  export/check.py\n${check.stdout}${check.stderr}`); }
}

console.log(failed ? `\n${failed} failed` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
