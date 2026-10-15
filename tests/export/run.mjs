import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { runScenario } from './scenario.mjs';
const out = process.argv[2] || 'tests/export/out';
const { wb, afterInit, all } = await runScenario();
writeFileSync(`${out}.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
writeFileSync(`${out}.state.json`, JSON.stringify({ afterInit, nodules: all.nodules, scans: all.scans }, null, 1));
console.log('wrote', `${out}.xlsx`);
