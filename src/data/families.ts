import { db } from './db';
import type { Family, Period } from '../domain/types';

export async function createFamily(name: string, period: Period = 'weekly'): Promise<Family> {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('name-empty');
  const now = Date.now();
  const family: Family = {
    id: crypto.randomUUID(),
    name: trimmed,
    period,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.families.add(family);
  return family;
}

export async function listActiveFamilies(): Promise<Family[]> {
  // archivedAt is filtered in memory: null is not a valid IndexedDB key
  const all = await db.families.toArray();
  return all.filter((f) => f.archivedAt === null).sort((a, b) => a.name.localeCompare(b.name));
}
