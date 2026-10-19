import { db } from './db';
import { SessionError, validateSessionFields, type SessionFields } from '../domain/session';
import type { Session } from '../domain/types';

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

/** Oldest first by date, then createdAt. */
export async function listSessions(): Promise<Session[]> {
  return (await db.sessions.toArray()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
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
