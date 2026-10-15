// Resolves the app's "@/..." imports for Node, and swaps the Base44 client for an in-memory fake.
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
const SRC = path.resolve(import.meta.dirname, '../../src');
export async function resolve(spec, ctx, next) {
  if (spec === '@/api/base44Client') return { url: pathToFileURL(path.resolve(import.meta.dirname, 'fakeBase44.mjs')).href, shortCircuit: true };
  if (spec.startsWith('@/')) {
    const base = path.join(SRC, spec.slice(2));
    for (const ext of ['', '.js', '.jsx']) if (existsSync(base + ext) && !base.endsWith('/')) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
