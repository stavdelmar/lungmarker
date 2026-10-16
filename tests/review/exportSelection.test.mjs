// Results: which rows are ticked on load, and what changes after an export.
import { preselect, exportStatus, selectForExport } from '@/lib/exportSelect';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const rows = [
  { id: 'a', scan: 's1' },                                                        // new
  { id: 'b', scan: 's1', exported_at: '2026-10-15T18:00:00Z' },                  // exported
  { id: 'c', scan: 's2', exported_at: '2026-10-15T18:00:00Z', changed_after_export: true }, // changed
];
ok(rows.map(exportStatus).join() === 'new,exported,changed', 'status tags');
let r = preselect(rows, new Set(), new Set());
ok([...r.selected].sort().join() === 'a,c', 'page load: new + changed ticked, exported not');
// user unticks c and ticks b: a refetch must not undo that
let sel = new Set(['a', 'b']);
r = preselect(rows, sel, r.seen);
ok([...r.selected].sort().join() === 'a,b', 'user choice kept on refetch');
// export of a, b → they become exported; the page removes them from the selection
const after = [{ ...rows[0], exported_at: 'x' }, { ...rows[1] }, rows[2]];
r = preselect(after, new Set(), r.seen);
ok(r.selected.size === 0, 'just-exported rows not re-ticked');
// later, b is edited → changed since export → ticked again
const later = [after[0], { ...after[1], changed_after_export: true }, rows[2]];
r = preselect(later, r.selected, r.seen);
ok([...r.selected].join() === 'b', 'row changed after export gets ticked: ' + [...r.selected]);
// export builds from exactly the ticked rows (logic unchanged)
const x = selectForExport({ scans: [{ id: 's1' }, { id: 's2' }], nodules: [rows[0]], events: [{ scan: 's1', nodule: 'a' }, { scan: 's1', nodule: 'b' }, { scan: 's1' }, { scan: 's2' }], onlyPending: false });
ok(x.nodules.length === 1 && x.scans.length === 1 && x.events.length === 2, 'export = ticked rows + their scan events');
console.log(fail ? `${fail} failed` : 'all pass');
