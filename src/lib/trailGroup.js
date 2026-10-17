// Edit trail, export view: consecutive outline edits on the same nodule become one row per field.
// Dragging outline points saves after every drag, and each save logs the outline plus the axes and
// volume it recomputed, so one nodule could produce ~30 rows. The raw trail in Base44 stays
// append-only and complete; only what the export shows is grouped.
//
// A "save" = the rows one saveNodule call wrote (same nodule, same edited_at).
// An "outline save" = a save that contains an outline row.
// A run = consecutive outline saves on the same nodule; any other row in the scan (another field,
// another nodule, a scan-level event) ends it. Each field in a run → one row: AI value and
// Previous value from its first edit, New value and time from its last. A field that ended where it
// started (e.g. volume after an undo) is dropped, like any non-change; the outline row always stays.

const HAND = 'points moved by hand';
const byTime = (a, b) => String(a.edited_at).localeCompare(String(b.edited_at));

function saves(events) {
  const out = [];
  for (const ev of events) {
    const last = out[out.length - 1];
    if (last && ev.nodule && last[0].nodule === ev.nodule && last[0].edited_at === ev.edited_at) last.push(ev);
    else out.push([ev]);
  }
  return out;
}

function mergeRun(run) {
  if (run.length === 1) return run[0];
  const fields = new Map(); // field → { first, last, sources, n }
  for (const save of run) {
    for (const ev of save) {
      const f = fields.get(ev.field);
      const how = ev.source || HAND; // an outline row without a source = points dragged by hand
      if (!f) fields.set(ev.field, { first: ev, last: ev, sources: [how], n: 1 });
      else { f.last = ev; f.n += 1; if (!f.sources.includes(how)) f.sources.push(how); }
    }
  }
  const rows = [];
  for (const [field, { first, last, sources, n }] of fields) {
    if (field !== 'outline' && String(first.old_value ?? '') === String(last.new_value ?? '')) continue;
    const row = { ...last, ai_value: first.ai_value, old_value: first.old_value, grouped_edits: n };
    if (field === 'outline') {
      if (sources.length === 1 && sources[0] === HAND) delete row.source; else row.source = sources.join(', ');
      if (n > 1) row.new_value = `${last.new_value} · ${n} edits grouped`;
    }
    rows.push(row);
  }
  return rows;
}

// events of any scans; returns the same kind of rows, outline runs collapsed, in time order per scan.
export function groupOutlineEdits(events) {
  const perScan = new Map();
  for (const ev of events) { if (!perScan.has(ev.scan)) perScan.set(ev.scan, []); perScan.get(ev.scan).push(ev); }
  const out = [];
  for (const list of perScan.values()) {
    const groups = saves([...list].sort(byTime));
    let run = [];
    const flush = () => { if (run.length) out.push(...mergeRun(run)); run = []; };
    for (const g of groups) {
      const isOutline = g.some((ev) => ev.field === 'outline');
      if (isOutline && run.length && run[0][0].nodule === g[0].nodule) { run.push(g); continue; }
      flush();
      if (isOutline) run = [g]; else out.push(...g);
    }
    flush();
  }
  return out;
}
