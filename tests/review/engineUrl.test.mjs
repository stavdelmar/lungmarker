// Engine URL: every natural way of pasting the base URL gives the same request paths.
import { engine, engineRoot } from '@/api/engine';
const S3 = 'https://lungmarker-demo-data-sd.s3.eu-north-1.amazonaws.com';
const forms = [S3, `${S3}/`, `${S3}/api/v1`, `${S3}/api/v1/`, `  ${S3}/api/v1/  `, `${S3}/api/v1/health.json`, `${S3}/api/v1//`];
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
for (const f of forms) {
  ok(engineRoot(f) === S3, `root of "${f}" → ${engineRoot(f)}`);
  ok(engine.sliceUrl(f, 'RIDER-1_test', 'lung', 12) === `${S3}/api/v1/scans/RIDER-1_test/slices/lung/12.png`, `slice url for "${f}"`);
}
// requests built by health/scans/meta/findings
const seen = []; globalThis.fetch = async (u) => { seen.push(u); return { ok: true, json: async () => ({}) }; };
await engine.health(`${S3}/api/v1/`); await engine.scans(`${S3}/api/v1`); await engine.meta(S3, 'X'); await engine.findings(`${S3}/`, 'X');
ok(JSON.stringify(seen) === JSON.stringify([`${S3}/api/v1/health.json`, `${S3}/api/v1/scans.json`, `${S3}/api/v1/scans/X/meta.json`, `${S3}/api/v1/scans/X/findings.json`]), 'fetch urls ' + seen.join(' '));
ok(engineRoot('https://example.org/data/demo') === 'https://example.org/data/demo', 'sub-folder host kept');
console.log(fail ? `${fail} failed` : 'all pass');
