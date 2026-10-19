import { db } from './db';
import { SessionError, validateSessionFields, type SessionFields } from '../domain/session';
import type { Attendee, Session } from '../domain/types';

/** Validates first, re-checks every attendee inside the write transaction, then stores one row. */
export async function createSession(input: SessionFields): Promise<Session> {
  const r = validateSessionFields(input);
  if (!r.ok) throw new SessionError(r.code);
  const now = Date.now();
  const session: Session = { id: crypto.randomUUID(), ...r.value, createdAt: now, updatedAt: now };
  await db.transaction('rw', db.students, db.sessions, async () => {
    for (const a of session.attendees) {
      const student = await db.students.get(a.studentId);
      if (!student || student.archivedAt !== null || student.familyId !== a.familyId) throw new SessionError('student-missing');
    }
    await db.sessions.add(session);
  });
  return session;
}

/**
 * Replaces the editable fields of one session in one transaction. A retained attendee (same studentId)
 * keeps its stored familyId, and its credit follows that snapshot, so a later family move never rewrites
 * billing history. Only a newly added attendee must be active and match its current family.
 */
export async function updateSession(id: string, input: SessionFields): Promise<Session> {
  const first = validateSessionFields(input);
  if (!first.ok) throw new SessionError(first.code);
  return db.transaction('rw', db.students, db.sessions, async () => {
    const current = await db.sessions.get(id);
    if (!current) throw new SessionError('not-found');
    const stored = new Map(current.attendees.map((a) => [a.studentId, a.familyId]));
    const remap = new Map<string, string>(); // family as entered -> stored snapshot, for retained attendees
    const attendees: Attendee[] = [];
    for (const a of first.value.attendees) {
      const snapshot = stored.get(a.studentId);
      if (snapshot !== undefined) {
        remap.set(a.familyId, snapshot);
        attendees.push({ studentId: a.studentId, familyId: snapshot });
        continue;
      }
      const student = await db.students.get(a.studentId);
      if (!student || student.archivedAt !== null || student.familyId !== a.familyId) throw new SessionError('student-missing');
      attendees.push(a);
    }
    const credits = first.value.credits.map((c) => ({ ...c, familyId: remap.get(c.familyId) ?? c.familyId }));
    const r = validateSessionFields({ ...first.value, attendees, credits });
    if (!r.ok) throw new SessionError(r.code);
    const next: Session = { ...current, ...r.value, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.sessions.put(next);
    return next;
  });
}

/** Deleting a missing session returns not-found and writes nothing. */
export async function deleteSession(id: string): Promise<{ ok: true } | { ok: false; reason: 'not-found' }> {
  return db.transaction('rw', db.sessions, async () => {
    if (!(await db.sessions.get(id))) return { ok: false, reason: 'not-found' } as const;
    await db.sessions.delete(id);
    return { ok: true } as const;
  });
}

export function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

/** Oldest first by date, then createdAt. */
export async function listSessions(): Promise<Session[]> {
  return (await db.sessions.toArray()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
}

/** Sessions whose date falls in [start, end], both inclusive, via the date index. */
export function listSessionsInRange(start: string, end: string): Promise<Session[]> {
  return db.sessions.where('date').between(start, end, true, true).toArray();
}

/** The most recently logged session (greatest createdAt, ties by id), or undefined. No index: the table is small. */
export async function getLastSession(): Promise<Session | undefined> {
  let last: Session | undefined;
  for (const s of await db.sessions.toArray()) {
    if (!last || s.createdAt > last.createdAt || (s.createdAt === last.createdAt && s.id > last.id)) last = s;
  }
  return last;
}

/** Names for every student and family, archived included, so history still reads correctly. */
export async function loadNameMaps(): Promise<{ students: Record<string, string>; families: Record<string, string> }> {
  const students: Record<string, string> = {};
  const families: Record<string, string> = {};
  for (const s of await db.students.toArray()) students[s.id] = s.name;
  for (const f of await db.families.toArray()) families[f.id] = f.name;
  return { students, families };
}
