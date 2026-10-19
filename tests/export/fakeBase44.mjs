// In-memory stand-in for the Base44 entities API (only the calls the app's lib code uses).
let seq = 0, clock = Date.parse('2026-10-15T09:00:00Z');
const now = () => new Date((clock += 1000)).toISOString();
// Optional permission check like the app's RLS (off unless base44.__rls = true): create / update on Scan, Nodule and
// EditEvent only for a signed-in user whose STORED app_role is "reviewer" — the server never sees a UI default.
let currentUserId = null;
const RLS_ENTITIES = ['Scan', 'Nodule', 'EditEvent'];
function guard(name, op) {
  if (!base44.__rls || !RLS_ENTITIES.includes(name)) return;
  const u = currentUserId && base44.entities.User.rows.get(currentUserId);
  if (u?.app_role !== 'reviewer') throw new Error(`Permission denied for ${op} operation on ${name} entity`);
}
function entity(name) {
  const rows = new Map();
  const match = (r, q = {}) => Object.entries(q).every(([k, v]) => (v && typeof v === 'object' && '$in' in v ? v.$in.includes(r[k]) : r[k] === v));
  return {
    rows,
    async create(d) { guard(name, 'create'); const r = { id: `id${++seq}`, created_date: now(), updated_date: now(), ...d }; rows.set(r.id, r); return { ...r }; },
    async bulkCreate(list) { return Promise.all(list.map((d) => this.create(d))); },
    async update(id, p) { guard(name, 'update'); const r = { ...rows.get(id), ...p, updated_date: now() }; rows.set(id, r); return { ...r }; },
    async bulkUpdate(list) { return Promise.all(list.map(({ id, ...p }) => this.update(id, p))); },
    async get(id) { return { ...rows.get(id) }; },
    async delete(id) { const had = rows.delete(id); return { deleted: had ? 1 : 0 }; },
    async filter(q, { sort } = {}) {
      let items = [...rows.values()].filter((r) => match(r, q)).map((r) => ({ ...r }));
      if (sort) items.sort((a, b) => String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true }));
      return { items, has_more: false };
    },
  };
}
export const base44 = {
  entities: { Scan: entity('Scan'), Nodule: entity('Nodule'), EditEvent: entity('EditEvent'), AppSettings: entity('AppSettings'), User: entity('User') },
  __rls: false,
  __denyUpdateMe: false,
  auth: {
    async me() { if (!currentUserId) throw new Error('Not signed in'); return { ...base44.entities.User.rows.get(currentUserId) }; },
    // Users may update their own custom fields (SDK: auth.updateMe → PUT /entities/User/me).
    async updateMe(d) {
      if (base44.__denyUpdateMe) throw new Error('Permission denied for update operation on User entity');
      const r = { ...base44.entities.User.rows.get(currentUserId), ...d }; base44.entities.User.rows.set(currentUserId, r); return { ...r };
    },
  },
  // Test helper: sign in as a new user record (e.g. { email, full_name } with no app_role = a brand-new user).
  async __signIn(u) { const r = await base44.entities.User.create(u); currentUserId = r.id; return r; },
};
