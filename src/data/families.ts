import { db } from './db';
import { compareRoster, type DeleteResult } from '../domain/roster';
import type { Family, Period } from '../domain/types';
import { RosterError, validateFamilyInput } from '../domain/validate';

function validated(name: unknown, period: unknown): { name: string; period: Period } {
  const r = validateFamilyInput({ name, period });
  if (!r.ok) throw new RosterError(r.code);
  return r.value;
}

// Every write is one transaction over each table it reads or writes.

export async function createFamily(name: string, period: Period = 'weekly'): Promise<Family> {
  // The default applies only when period is omitted (undefined); '' / null / unknown reach the validator.
  const v = validated(name, period);
  const now = Date.now();
  const family: Family = { id: crypto.randomUUID(), ...v, archivedAt: null, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.families, () => db.families.add(family));
  return family;
}

export async function updateFamily(id: string, input: { name: string; period: Period }): Promise<Family> {
  const v = validated(input.name, input.period);
  return db.transaction('rw', db.families, async () => {
    const current = await db.families.get(id);
    if (!current) throw new RosterError('not-found');
    const next: Family = { ...current, ...v, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.families.put(next);
    return next;
  });
}

async function setArchived(id: string, archived: boolean): Promise<Family> {
  return db.transaction('rw', db.families, async () => {
    const current = await db.families.get(id);
    if (!current) throw new RosterError('not-found');
    if ((current.archivedAt !== null) === archived) return current; // already in that state: no write
    const now = Date.now();
    const next: Family = { ...current, archivedAt: archived ? now : null, updatedAt: Math.max(now, current.updatedAt + 1) };
    await db.families.put(next);
    return next;
  });
}

// Archiving a family does not touch its students (UI-SPEC Assumption 2).
export const archiveFamily = (id: string) => setArchived(id, true);
export const restoreFamily = (id: string) => setArchived(id, false);

/**
 * Hard delete, allowed only when no student (active or archived) belongs to the family and no session
 * references it. Sessions snapshot familyId on each attendee and credit, so a student moved away after a
 * lesson still leaves history that the backup must be able to restore.
 */
export async function deleteFamily(id: string): Promise<DeleteResult> {
  return db.transaction('rw', db.families, db.students, db.sessions, async () => {
    if (!(await db.families.get(id))) return { ok: false, reason: 'not-found' } as const;
    if ((await db.students.where('familyId').equals(id).count()) > 0) return { ok: false, reason: 'has-students' } as const;
    if (await familyHasSessions(id)) return { ok: false, reason: 'has-history' } as const;
    await db.families.delete(id);
    return { ok: true } as const;
  });
}

export function getFamily(id: string): Promise<Family | undefined> {
  return db.families.get(id);
}

export async function familyHasSessions(id: string): Promise<boolean> {
  return (await db.sessions.filter((s) => s.attendees.some((a) => a.familyId === id) || s.credits.some((c) => c.familyId === id)).count()) > 0;
}

/** True when the family cannot be deleted for its students or its lesson history. */
export async function hasFamilyHistory(id: string): Promise<boolean> {
  return (await db.students.where('familyId').equals(id).count()) > 0 || (await familyHasSessions(id));
}

// archivedAt is filtered in memory: null is not a valid IndexedDB key (RESEARCH Pitfall 7).
export async function listActiveFamilies(): Promise<Family[]> {
  return (await db.families.toArray()).filter((f) => f.archivedAt === null).sort(compareRoster);
}

export async function listArchivedFamilies(): Promise<Family[]> {
  return (await db.families.toArray()).filter((f) => f.archivedAt !== null).sort(compareRoster);
}
