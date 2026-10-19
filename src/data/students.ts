import { db, type SessionRow } from './db';
import { compareRoster, type DeleteResult } from '../domain/roster';
import type { DefaultSubject, Student } from '../domain/types';
import { RosterError, validateStudentInput } from '../domain/validate';

export interface StudentInput {
  familyId: string;
  name: string;
  defaultSubject?: DefaultSubject;
  notes?: string;
}

function validated(input: StudentInput) {
  // D-06: a new student defaults to Both; D-07: notes default to empty. Applied only when omitted.
  const r = validateStudentInput({
    ...input,
    defaultSubject: input.defaultSubject === undefined ? 'both' : input.defaultSubject,
    notes: input.notes === undefined ? '' : input.notes,
  });
  if (!r.ok) throw new RosterError(r.code);
  return r.value;
}

export async function createStudent(input: StudentInput): Promise<Student> {
  const v = validated(input);
  const now = Date.now();
  const student: Student = { id: crypto.randomUUID(), ...v, archivedAt: null, createdAt: now, updatedAt: now };
  // The family check and the write share one transaction, so a concurrent delete or archive cannot slip between them.
  await db.transaction('rw', db.students, db.families, async () => {
    const family = await db.families.get(v.familyId);
    if (!family || family.archivedAt !== null) throw new RosterError('family-missing');
    await db.students.add(student);
  });
  return student;
}

/** Omitted fields keep their stored values, so a partial update never resets the subject or erases notes. */
export async function updateStudent(id: string, input: Partial<StudentInput>): Promise<Student> {
  return db.transaction('rw', db.students, db.families, async () => {
    const current = await db.students.get(id);
    if (!current) throw new RosterError('not-found');
    const r = validateStudentInput({
      familyId: input.familyId === undefined ? current.familyId : input.familyId,
      name: input.name === undefined ? current.name : input.name,
      defaultSubject: input.defaultSubject === undefined ? current.defaultSubject : input.defaultSubject,
      notes: input.notes === undefined ? current.notes : input.notes,
    });
    if (!r.ok) throw new RosterError(r.code);
    const v = r.value;
    const family = await db.families.get(v.familyId);
    // Unchanged family: it only has to exist. A changed family must be active.
    if (!family || (v.familyId !== current.familyId && family.archivedAt !== null)) throw new RosterError('family-missing');
    const next: Student = { ...current, ...v, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
    await db.students.put(next);
    return next;
  });
}

async function setArchived(id: string, archived: boolean): Promise<Student> {
  return db.transaction('rw', db.students, db.families, async () => {
    const current = await db.students.get(id);
    if (!current) throw new RosterError('not-found');
    if ((current.archivedAt !== null) === archived) return current;
    if (!archived) {
      // An active student must have an active family, or it would appear on no screen. Restore the family first.
      const family = await db.families.get(current.familyId);
      if (!family || family.archivedAt !== null) throw new RosterError('family-missing');
    }
    const now = Date.now();
    const next: Student = { ...current, archivedAt: archived ? now : null, updatedAt: Math.max(now, current.updatedAt + 1) };
    await db.students.put(next);
    return next;
  });
}

export const archiveStudent = (id: string) => setArchived(id, true);
export const restoreStudent = (id: string) => setArchived(id, false);

/**
 * A session counts as history when its `attendees` array contains `studentId`. The guard fails
 * closed: a row whose `attendees` is not an array has an unknown shape, so it counts as history
 * rather than allowing a delete that could orphan it.
 */
function hasAttendee(row: SessionRow, studentId: string): boolean {
  const attendees: unknown = row.attendees;
  if (!Array.isArray(attendees)) return true;
  return attendees.some((a) => (a as { studentId?: unknown } | null)?.studentId === studentId);
}

export async function studentHasHistory(id: string): Promise<boolean> {
  return (await db.sessions.filter((row) => hasAttendee(row, id)).count()) > 0;
}

/** Hard delete, allowed only when no session includes the student. */
export async function deleteStudent(id: string): Promise<DeleteResult> {
  return db.transaction('rw', db.students, db.sessions, async () => {
    if (!(await db.students.get(id))) return { ok: false, reason: 'not-found' } as const;
    if (await studentHasHistory(id)) return { ok: false, reason: 'has-history' } as const;
    await db.students.delete(id);
    return { ok: true } as const;
  });
}

export function getStudent(id: string): Promise<Student | undefined> {
  return db.students.get(id);
}

export async function listActiveStudents(): Promise<Student[]> {
  return (await db.students.toArray()).filter((s) => s.archivedAt === null).sort(compareRoster);
}

export async function listArchivedStudents(): Promise<Student[]> {
  return (await db.students.toArray()).filter((s) => s.archivedAt !== null).sort(compareRoster);
}
