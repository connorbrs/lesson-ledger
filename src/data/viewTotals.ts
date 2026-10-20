import { db } from './db';
import { computeViewTotals, type NameInfo, type ViewTotals } from '../domain/viewTotals';

export interface LoadedViewTotals {
  sessionCount: number;
  totals: ViewTotals;
}

/** One read transaction over sessions, students and families (archived included) for a period [start, end], both inclusive. */
export function loadViewTotals(start: string, end: string): Promise<LoadedViewTotals> {
  return db.transaction('r', db.sessions, db.students, db.families, async () => {
    const sessions = await db.sessions.where('date').between(start, end, true, true).toArray();
    const students = new Map<string, NameInfo>();
    for (const s of await db.students.toArray()) students.set(s.id, { name: s.name, archived: s.archivedAt !== null });
    const families = new Map<string, NameInfo>();
    for (const f of await db.families.toArray()) families.set(f.id, { name: f.name, archived: f.archivedAt !== null });
    return { sessionCount: sessions.length, totals: computeViewTotals({ sessions, students, families }) };
  });
}
