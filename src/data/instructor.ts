import { RosterError, validateInstructorName } from '../domain/validate';
import { db } from './db';

/** D-10: the instructor name lives in the meta table (no schema change); the backup reads and writes the same key. */
export const INSTRUCTOR_KEY = 'instructorName';

export async function getInstructorName(): Promise<string | null> {
  const row = await db.meta.get(INSTRUCTOR_KEY);
  return typeof row?.value === 'string' && row.value !== '' ? row.value : null;
}

/** Stores the trimmed, composed name; a blank value clears it. */
export async function setInstructorName(raw: string): Promise<string | null> {
  const v = validateInstructorName(raw);
  if (!v.ok) throw new RosterError(v.code);
  await db.transaction('rw', db.meta, async () => {
    if (v.value === null) await db.meta.delete(INSTRUCTOR_KEY);
    else await db.meta.put({ key: INSTRUCTOR_KEY, value: v.value });
  });
  return v.value;
}
