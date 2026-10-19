import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { archiveFamily, createFamily, deleteFamily, getFamily, hasFamilyHistory } from '../src/data/families';
import { createSession, deleteSession, getLastSession, getSession, listSessions, listSessionsInRange, updateSession } from '../src/data/sessions';
import { archiveStudent, createStudent, deleteStudent, listSessionEligibleStudents, studentHasHistory, updateStudent } from '../src/data/students';
import { prefillFromSession } from '../src/domain/sessionForm';
import { groupSessionsByDate, sessionRowText, SessionError, type SessionFields } from '../src/domain/session';
import type { Attendee, Session } from '../src/domain/types';

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

    it('an active student whose family is archived', async () => {
      await archiveFamily(a1.familyId);
      await expect(createSession(swim([a1]))).rejects.toMatchObject({ code: 'student-missing' });
      expect(await db.sessions.count()).toBe(0);
    });

    it('a student that does not exist', async () => {
      await expect(createSession(swim([{ studentId: 'nope', familyId: a1.familyId }]))).rejects.toMatchObject({ code: 'student-missing' });
      expect(await db.sessions.count()).toBe(0);
    });
  });
});

describe('getLastSession', () => {
  it('is undefined with no sessions', async () => {
    expect(await getLastSession()).toBeUndefined();
  });

  it('returns the only session, then the one with the greatest createdAt', async () => {
    const first = await createSession(swim([a1]));
    expect((await getLastSession())?.id).toBe(first.id);
    await db.sessions.add({ ...first, id: 'newer', createdAt: first.createdAt + 5 });
    await db.sessions.add({ ...first, id: 'older', createdAt: first.createdAt - 5, date: '2030-01-01' });
    expect((await getLastSession())?.id).toBe('newer');
  });

  it('breaks a createdAt tie by id', async () => {
    const base = await createSession(swim([a1]));
    await db.sessions.add({ ...base, id: 'zzz' });
    await db.sessions.add({ ...base, id: 'aaa' });
    expect((await getLastSession())?.id).toBe(base.id > 'zzz' ? base.id : 'zzz');
  });
});

describe('listSessionsInRange', () => {
  it('is inclusive on both dates and splits the adjacent days into their weeks and months', async () => {
    const sun = await createSession({ ...swim([a1]), date: '2026-10-18' });
    const mon = await createSession({ ...swim([a1]), date: '2026-10-19' });
    const oct31 = await createSession({ ...swim([a1]), date: '2026-10-31' });
    const nov1 = await createSession({ ...swim([a1]), date: '2026-11-01' });
    const ids = async (start: string, end: string) => (await listSessionsInRange(start, end)).map((s) => s.id).sort();
    expect(await ids('2026-10-12', '2026-10-18')).toEqual([sun.id]);
    expect(await ids('2026-10-19', '2026-10-25')).toEqual([mon.id]);
    expect(await ids('2026-10-01', '2026-10-31')).toEqual([sun.id, mon.id, oct31.id].sort());
    expect(await ids('2026-11-01', '2026-11-30')).toEqual([nov1.id]);
  });
  it('returns [] for an empty range', async () => {
    await createSession(swim([a1]));
    expect(await listSessionsInRange('2030-01-01', '2030-01-07')).toEqual([]);
  });
});

describe('groupSessionsByDate and sessionRowText', () => {
  const row = (over: Partial<Session>): Session => ({
    id: 'x',
    date: '2026-10-19',
    startTime: null,
    subject: 'swim',
    attendees: [{ studentId: 's1', familyId: 'F' }],
    credits: [{ familyId: 'F', lesson: 'full', activity: 'full' }],
    lessonMinutes: 45,
    activityMinutes: 0,
    travelMinutes: 0,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });

  it('orders days ascending and, inside a day, timed sessions by start time with untimed last in logging order', () => {
    const late = row({ id: 'late', startTime: '16:30', createdAt: 1 });
    const early = row({ id: 'early', startTime: '09:00', createdAt: 9 });
    const untimedFirst = row({ id: 'u1', createdAt: 2 });
    const untimedSecond = row({ id: 'u2', createdAt: 3 });
    const nextDay = row({ id: 'next', date: '2026-10-20', startTime: '07:00' });
    const groups = groupSessionsByDate([nextDay, untimedSecond, late, untimedFirst, early]);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-19', '2026-10-20']);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(['early', 'late', 'u1', 'u2']);
  });

  it('breaks a start-time tie by createdAt, then id', () => {
    const b = row({ id: 'b', startTime: '10:00', createdAt: 5 });
    const a = row({ id: 'a', startTime: '10:00', createdAt: 5 });
    const older = row({ id: 'z', startTime: '10:00', createdAt: 4 });
    expect(groupSessionsByDate([b, a, older])[0].sessions.map((s) => s.id)).toEqual(['z', 'a', 'b']);
  });

  it('gives names, a meta line, and the two amount lines with none for zero', () => {
    const text = sessionRowText(row({ startTime: '16:30', attendees: [{ studentId: 's1', familyId: 'F' }, { studentId: 's2', familyId: 'F' }], lessonMinutes: 90, activityMinutes: 30 }), { s1: 'Ava', s2: 'Ben' });
    expect(text).toEqual({ names: 'Ava, Ben', meta: 'Swim · 4:30 PM', lesson: 'Lesson 1.5 h (1:30)', activity: 'Activity 0.5 h (0:30)' });
    expect(sessionRowText(row({ activityMinutes: 0 }), { s1: 'Ava' })).toMatchObject({ meta: 'Swim', activity: 'Activity none' });
  });

  it('never shows travel minutes or a credited figure in a row', () => {
    const text = sessionRowText(row({ travelMinutes: 777, lessonMinutes: 45, credits: [{ familyId: 'F', lesson: 'half', activity: 'half' }] }), { s1: 'Ava' });
    const all = Object.values(text).join(' | ');
    expect(all).not.toContain('777');
    expect(all).not.toContain('22.5');
  });
});

describe('updateSession and deleteSession', () => {
  it('updates the fields, keeps id and createdAt, and advances updatedAt', async () => {
    const created = await createSession(swim([a1]));
    const next = await updateSession(created.id, swim([a1], { lessonMinutes: 60 }));
    expect(next).toMatchObject({ id: created.id, createdAt: created.createdAt, lessonMinutes: 60 });
    expect(next.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(await getSession(created.id)).toEqual(next);
  });

  it('applying the same update twice leaves every field equal except a larger updatedAt', async () => {
    const created = await createSession(swim([a1]));
    const once = await updateSession(created.id, swim([a1], { lessonMinutes: 60 }));
    const twice = await updateSession(created.id, swim([a1], { lessonMinutes: 60 }));
    const { updatedAt: u1, ...rest1 } = once;
    const { updatedAt: u2, ...rest2 } = twice;
    expect(rest2).toEqual(rest1);
    expect(u2).toBeGreaterThan(u1);
  });

  it('rejects an invalid edit and leaves the stored row unchanged', async () => {
    const created = await createSession(swim([a1]));
    await expect(updateSession(created.id, swim([a1], { lessonMinutes: 1000 }))).rejects.toMatchObject({ code: 'minutes-invalid' });
    expect(await getSession(created.id)).toEqual(created);
  });

  it('deleteSession returns ok, then not-found on the second call', async () => {
    const created = await createSession(swim([a1]));
    expect(await deleteSession(created.id)).toEqual({ ok: true });
    expect(await deleteSession(created.id)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('an update of a deleted session rejects with not-found and never recreates the row', async () => {
    const created = await createSession(swim([a1]));
    await deleteSession(created.id);
    await expect(updateSession(created.id, swim([a1]))).rejects.toMatchObject({ code: 'not-found' });
    expect(await listSessions()).toEqual([]);
  });

  it.each(['update-first', 'delete-first'] as const)('an update racing a delete ends with the session gone (%s)', async (order) => {
    const created = await createSession(swim([a1]));
    const update = () => updateSession(created.id, swim([a1], { lessonMinutes: 60 }));
    const remove = () => deleteSession(created.id);
    const settled = await Promise.allSettled(order === 'update-first' ? [update(), remove()] : [remove(), update()]);
    expect(await getSession(created.id)).toBeUndefined();
    expect(await db.sessions.count()).toBe(0);
    const updateResult = settled[order === 'update-first' ? 0 : 1];
    if (updateResult.status === 'rejected') expect(updateResult.reason).toMatchObject({ code: 'not-found' });
  });

  it('edits a session whose second student has since been archived when that student stays on it', async () => {
    const created = await createSession(swim([a1, a2]));
    await archiveStudent(a2.studentId);
    const next = await updateSession(created.id, swim([a1, a2], { lessonMinutes: 30 }));
    expect(next.lessonMinutes).toBe(30);
  });

  it('keeps a retained attendee on its stored family after a move, and its credit follows', async () => {
    const created = await createSession(swim([a1]));
    await db.students.update(a1.studentId, { familyId: b1.familyId });
    const next = await updateSession(created.id, swim([{ studentId: a1.studentId, familyId: b1.familyId }], { lessonMinutes: 50 }));
    expect(next.attendees).toEqual([a1]);
    expect(next.credits).toEqual([full(a1.familyId)]);
  });

  it('a newly added attendee must be active and match its current family', async () => {
    const created = await createSession(swim([a1]));
    await expect(updateSession(created.id, swim([a1, { studentId: b1.studentId, familyId: a1.familyId }]))).rejects.toMatchObject({
      code: 'student-missing',
    });
    await archiveStudent(b1.studentId);
    await expect(updateSession(created.id, swim([a1, b1]))).rejects.toMatchObject({ code: 'student-missing' });
    expect(await getSession(created.id)).toEqual(created);
  });

  it('keeps a retained attendee editable after its family is archived, but refuses a new one from that family', async () => {
    const created = await createSession(swim([a1]));
    await archiveFamily(a1.familyId);
    const kept = await updateSession(created.id, swim([a1], { lessonMinutes: 30 }));
    expect(kept.lessonMinutes).toBe(30);
    await expect(updateSession(created.id, swim([a1, a2]))).rejects.toMatchObject({ code: 'student-missing' });
    expect(await getSession(created.id)).toEqual(kept);
  });

  it('deleting the last session of a student makes the student deletable again', async () => {
    const created = await createSession(swim([a1]));
    expect(await studentHasHistory(a1.studentId)).toBe(true);
    await deleteSession(created.id);
    expect(await studentHasHistory(a1.studentId)).toBe(false);
    expect(await deleteStudent(a1.studentId)).toEqual({ ok: true });
  });
});

describe('family delete with lesson history', () => {
  // A family whose only student had a lesson, then moved to family B and the family was archived: no students left.
  async function familyWithOrphanedHistory() {
    const fam = await createFamily('Test Family C');
    const student = await createStudent({ familyId: fam.id, name: 'Test Student C1' });
    const created = await createSession(swim([{ studentId: student.id, familyId: fam.id }]));
    await updateStudent(student.id, { familyId: b1.familyId });
    await archiveFamily(fam.id);
    return { fam, created };
  }

  it('refuses to delete a family whose session still references it after its only student moved away', async () => {
    const { fam } = await familyWithOrphanedHistory();
    expect(await hasFamilyHistory(fam.id)).toBe(true);
    expect(await deleteFamily(fam.id)).toEqual({ ok: false, reason: 'has-history' });
    expect(await getFamily(fam.id)).toBeDefined();
  });

  it('deletes the family once its lesson history is gone', async () => {
    const { fam, created } = await familyWithOrphanedHistory();
    await deleteSession(created.id);
    expect(await hasFamilyHistory(fam.id)).toBe(false);
    expect(await deleteFamily(fam.id)).toEqual({ ok: true });
  });
});

describe('session students exclude archived families', () => {
  it('lists only students of active families, so a prefill cannot carry an archived family into a new session', async () => {
    const last = await createSession(swim([a1, b1]));
    await archiveFamily(a1.familyId);
    const eligible = await listSessionEligibleStudents();
    expect(eligible.map((s) => s.id)).not.toContain(a1.studentId);
    expect(prefillFromSession(last, eligible).attendees).toEqual([b1]);
  });
});
