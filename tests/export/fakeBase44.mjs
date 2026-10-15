// In-memory stand-in for the Base44 entities API (only the calls the app's lib code uses).
let seq = 0, clock = Date.parse('2026-10-15T09:00:00Z');
const now = () => new Date((clock += 1000)).toISOString();
function entity() {
  const rows = new Map();
  const match = (r, q = {}) => Object.entries(q).every(([k, v]) => (v && typeof v === 'object' && '$in' in v ? v.$in.includes(r[k]) : r[k] === v));
  return {
    rows,
    async create(d) { const r = { id: `id${++seq}`, created_date: now(), updated_date: now(), ...d }; rows.set(r.id, r); return { ...r }; },
    async bulkCreate(list) { return Promise.all(list.map((d) => this.create(d))); },
    async update(id, p) { const r = { ...rows.get(id), ...p, updated_date: now() }; rows.set(id, r); return { ...r }; },
    async bulkUpdate(list) { return Promise.all(list.map(({ id, ...p }) => this.update(id, p))); },
    async get(id) { return { ...rows.get(id) }; },
    async filter(q, { sort } = {}) {
      let items = [...rows.values()].filter((r) => match(r, q)).map((r) => ({ ...r }));
      if (sort) items.sort((a, b) => String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true }));
      return { items, has_more: false };
    },
  };
}
export const base44 = { entities: { Scan: entity(), Nodule: entity(), EditEvent: entity(), AppSettings: entity() } };
