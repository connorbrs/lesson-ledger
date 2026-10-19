import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { createFamily } from '../src/data/families';
import { createSession, listSessions } from '../src/data/sessions';
import { archiveStudent, createStudent, deleteStudent, studentHasHistory } from '../src/data/students';
import { SessionError, type SessionFields } from '../src/domain/session';
import type { Attendee } from '../src/domain/types';

let a1: Attendee, a2: Attendee, b1: Attendee;

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
  const famA = await createFamily('Test Family A');
  const famB = await createFamily('Test Family B');
  const s1 = await createStudent({ familyId: famA.id, name: 'Test Student A1' });
  const s2 = await createStudent({ familyId: famA.id, name: 'Test Student A2' });
  const s3 = await createStudent({ familyId: famB.id, name: 'Test Student B1' });
  a1 = { studentId: s1.id, familyId: famA.id };
  a2 = { studentId: s2.id, familyId: famA.id };
  b1 = { studentId: s3.id, familyId: famB.id };
});

const full = (familyId: string) => ({ familyId, lesson: 'full' as const, activity: 'full' as const });

function swim(attendees: Attendee[], over: Partial<SessionFields> = {}): SessionFields {
  const families = [...new Set(attendees.map((a) => a.familyId))];
  return {
    date: '2026-10-19',
    startTime: null,
    subject: 'swim',
    attendees,
    credits: families.map(full),
    lessonMinutes: 45,
    activityMinutes: 0,
    travelMinutes: 0,
    ...over,
  };
}

describe('createSession', () => {
  it('persists a swim session and listSessions returns it', async () => {
    const created = await createSession(swim([a1]));
    expect(created.id).toHaveLength(36);
    expect(await listSessions()).toEqual([created]);
  });

  it('makes the student history so deleteStudent refuses', async () => {
    await createSession(swim([a1]));
    expect(await studentHasHistory(a1.studentId)).toBe(true);
    expect(await deleteStudent(a1.studentId)).toEqual({ ok: false, reason: 'has-history' });
  });

  it('stores one credits entry for two siblings', async () => {
    const s = await createSession(swim([a1, a2]));
    expect(s.credits).toEqual([full(a1.familyId)]);
  });

  it('keeps Half for a two-family swim and stores the modes as given', async () => {
    const credits = [
      { familyId: a1.familyId, lesson: 'half' as const, activity: 'full' as const },
      full(b1.familyId),
    ];
    const s = await createSession(swim([a1, b1], { credits }));
    expect(s.credits).toEqual(credits);
  });

  it('saves lesson 0 with activity above 0, and an all-zero session', async () => {
    await createSession(swim([a1], { lessonMinutes: 0, activityMinutes: 45 }));
    await createSession(swim([a1], { lessonMinutes: 0 }));
    expect(await db.sessions.count()).toBe(2);
  });

  it('accepts the minute bounds 0 and 999 and the attendee bounds 1 and 2', async () => {
    await createSession(swim([a1], { lessonMinutes: 0, activityMinutes: 999, travelMinutes: 999 }));
    await createSession(swim([a1, b1]));
    await createSession({ ...swim([a1]), subject: 'math' });
    expect(await db.sessions.count()).toBe(3);
  });

  it('keeps Dexie at version 1 with the six tables', () => {
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['attachments', 'expenses', 'families', 'meta', 'sessions', 'students']);
  });

  describe('rejections store nothing', () => {
    const cases: [string, () => SessionFields, string][] = [
      ['math with 2 attendees', () => ({ ...swim([a1, b1]), subject: 'math' }), 'students-invalid'],
      ['swim with 3 attendees', () => swim([a1, a2, b1]), 'students-invalid'],
      ['0 attendees', () => swim([]), 'students-invalid'],
      ['duplicate student', () => swim([a1, a1]), 'students-invalid'],
      ['minutes -1', () => swim([a1], { lessonMinutes: -1 }), 'minutes-invalid'],
      ['minutes 1000', () => swim([a1], { activityMinutes: 1000 }), 'minutes-invalid'],
      ['minutes 1.5', () => swim([a1], { travelMinutes: 1.5 }), 'minutes-invalid'],
      ['minutes NaN', () => swim([a1], { lessonMinutes: NaN }), 'minutes-invalid'],
      ['date 2026-02-29', () => swim([a1], { date: '2026-02-29' }), 'date-invalid'],
      ['start 24:00', () => swim([a1], { startTime: '24:00' }), 'time-invalid'],
      ['subject golf', () => swim([a1], { subject: 'golf' as never }), 'subject-invalid'],
      ['Half on a one-family session', () => swim([a1, a2], { credits: [{ ...full(a1.familyId), lesson: 'half' }] }), 'credits-invalid'],
      ['Half on a math session', () => ({ ...swim([a1], { credits: [{ ...full(a1.familyId), activity: 'half' }] }), subject: 'math' }), 'credits-invalid'],
      ['a credit for a family not among the attendees', () => swim([a1], { credits: [full(b1.familyId)] }), 'credits-invalid'],
      ['a missing family credit', () => swim([a1, b1], { credits: [full(a1.familyId)] }), 'credits-invalid'],
      ['an unknown credit mode', () => swim([a1], { credits: [{ ...full(a1.familyId), lesson: 'third' as never }] }), 'credits-invalid'],
    ];
    it.each(cases)('%s', async (_name, build, code) => {
      await expect(createSession(build())).rejects.toMatchObject({ code });
      expect(await db.sessions.count()).toBe(0);
    });

    it('an archived student', async () => {
      await archiveStudent(a1.studentId);
      await expect(createSession(swim([a1]))).rejects.toBeInstanceOf(SessionError);
      expect(await db.sessions.count()).toBe(0);
    });

    it('a student whose familyId does not match', async () => {
      await expect(createSession(swim([{ ...a1, familyId: b1.familyId }]))).rejects.toMatchObject({ code: 'student-missing' });
      expect(await db.sessions.count()).toBe(0);
    });

    it('a student that does not exist', async () => {
      await expect(createSession(swim([{ studentId: 'nope', familyId: a1.familyId }]))).rejects.toMatchObject({ code: 'student-missing' });
      expect(await db.sessions.count()).toBe(0);
    });
  });
});
