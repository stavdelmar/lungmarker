export async function fetchAll(entity, query, sort = 'created_date') {
  const items = [];
  let cursor;
  for (;;) {
    const page = await entity.filter(query, { sort, limit: 1000, ...(cursor ? { cursor } : {}) });
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return items;
}

export const fmt1 = (v) => (v == null || v === '' ? '—' : Number(v).toFixed(1));
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—');