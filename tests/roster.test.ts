import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import {
  archiveFamily,
  createFamily,
  deleteFamily,
  getFamily,
  hasFamilyHistory,
  listActiveFamilies,
  listArchivedFamilies,
  restoreFamily,
  updateFamily,
} from '../src/data/families';
import {
  archiveStudent,
  createStudent,
  deleteStudent,
  getStudent,
  listActiveStudents,
  listArchivedStudents,
  restoreStudent,
  studentHasHistory,
  updateStudent,
} from '../src/data/students';
import { compareRoster, periodLabel, studentCountLabel, subjectLabel } from '../src/domain/roster';
import type { Period } from '../src/domain/types';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('roster ordering and labels', () => {
  const item = (name: string, createdAt: number, id: string) => ({ name, createdAt, id });

  it('orders case-insensitively by name', () => {
    const list = [item('Bea', 1, 'b'), item('anna', 2, 'a')];
    expect([...list].sort(compareRoster).map((x) => x.name)).toEqual(['anna', 'Bea']);
  });

  it('breaks ties by createdAt then id, the same on every call', () => {
    const list = [
      item('Test Family A', 5, 'z'),
      item('test family a', 5, 'b'),
      item('Test Family A', 1, 'q'),
      item('Test Family A', 5, 'a'),
    ];
    const expected = ['q', 'a', 'b', 'z'];
    expect([...list].sort(compareRoster).map((x) => x.id)).toEqual(expected);
    expect([...list].reverse().sort(compareRoster).map((x) => x.id)).toEqual(expected);
    expect([...list].sort(compareRoster).map((x) => x.id)).toEqual(expected);
  });

  it('labels periods, counts and subjects exactly', () => {
    expect(periodLabel('weekly')).toBe('Weekly · Monday to Sunday');
    expect(periodLabel('monthly')).toBe('Monthly · calendar month');
    expect(studentCountLabel(1)).toBe('1 student');
    expect(studentCountLabel(2)).toBe('2 students');
    expect(studentCountLabel(0)).toBe('0 students');
    expect(subjectLabel('swim')).toBe('Swim');
    expect(subjectLabel('math')).toBe('Math');
    expect(subjectLabel('both')).toBe('Both');
  });
});

describe('family repo', () => {
  it('stores a trimmed NFC name and defaults the period only when omitted', async () => {
    const a = await createFamily('  é Family ');
    expect(a.name).toBe('é Family');
    expect(a.period).toBe('weekly');
    const m = await createFamily('Test Family M', 'monthly');
    expect(m.period).toBe('monthly');
  });

  it('rejects invalid input with a RosterError code and writes nothing', async () => {
    await expect(createFamily('   ')).rejects.toMatchObject({ code: 'name-empty' });
    await expect(createFamily(null as unknown as string)).rejects.toMatchObject({ code: 'name-empty' });
    await expect(createFamily('a'.repeat(61))).rejects.toMatchObject({ code: 'name-too-long' });
    await expect(createFamily('Test Family A', '' as Period)).rejects.toMatchObject({ code: 'period-invalid' });
    await expect(createFamily('Test Family A', null as unknown as Period)).rejects.toMatchObject({
      code: 'period-invalid',
    });
    await expect(createFamily('Test Family A', 'daily' as Period)).rejects.toMatchObject({ code: 'period-invalid' });
    expect(await db.families.count()).toBe(0);
  });

  it('makes two separate records from identical input', async () => {
    const a = await createFamily('Test Family A');
    const b = await createFamily('Test Family A');
    expect(a.id).not.toBe(b.id);
    expect(await db.families.count()).toBe(2);
  });

  it('updates name, period and updatedAt, and validates', async () => {
    const f = await createFamily('Test Family A');
    await db.families.update(f.id, { updatedAt: 1 });
    const u = await updateFamily(f.id, { name: ' Test Family B ', period: 'monthly' });
    expect(u.name).toBe('Test Family B');
    expect(u.period).toBe('monthly');
    expect(u.updatedAt).toBeGreaterThan(1);
    expect((await getFamily(f.id))?.name).toBe('Test Family B');
    await expect(updateFamily(f.id, { name: '', period: 'weekly' })).rejects.toMatchObject({ code: 'name-empty' });
    await expect(updateFamily('missing', { name: 'x', period: 'weekly' })).rejects.toMatchObject({ code: 'not-found' });
    expect((await getFamily(f.id))?.name).toBe('Test Family B');
  });

  it('archives once and restores once, both idempotent', async () => {
    const f = await createFamily('Test Family A');
    const first = await archiveFamily(f.id);
    expect(first.archivedAt).not.toBeNull();
    await db.families.update(f.id, { archivedAt: 123 });
    const second = await archiveFamily(f.id);
    expect(second.archivedAt).toBe(123);
    expect((await getFamily(f.id))?.archivedAt).toBe(123);
    const r = await restoreFamily(f.id);
    expect(r.archivedAt).toBeNull();
    const r2 = await restoreFamily(f.id);
    expect(r2.archivedAt).toBeNull();
    await expect(archiveFamily('missing')).rejects.toMatchObject({ code: 'not-found' });
    await expect(restoreFamily('missing')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('lists active families sorted and archived families separately', async () => {
    const b = await createFamily('Bea');
    const a = await createFamily('anna');
    const c = await createFamily('Cy');
    await archiveFamily(c.id);
    expect((await listActiveFamilies()).map((f) => f.id)).toEqual([a.id, b.id]);
    expect((await listArchivedFamilies()).map((f) => f.id)).toEqual([c.id]);
  });

  it('deletes a family with no students and reports not-found for unknown ids', async () => {
    const f = await createFamily('Test Family A');
    expect(await hasFamilyHistory(f.id)).toBe(false);
    expect(await deleteFamily(f.id)).toEqual({ ok: true });
    expect(await getFamily(f.id)).toBeUndefined();
    expect(await deleteFamily('missing')).toEqual({ ok: false, reason: 'not-found' });
  });

  it('refuses to delete a family with an active student or only an archived student', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    expect(await hasFamilyHistory(f.id)).toBe(true);
    expect(await deleteFamily(f.id)).toEqual({ ok: false, reason: 'has-students' });
    await archiveStudent(s.id);
    expect(await hasFamilyHistory(f.id)).toBe(true);
    expect(await deleteFamily(f.id)).toEqual({ ok: false, reason: 'has-students' });
    expect(await getFamily(f.id)).toBeDefined();
  });

  it('archiving a family does not change its students', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    await archiveFamily(f.id);
    expect((await getStudent(s.id))?.archivedAt).toBeNull();
  });
});

describe('student repo', () => {
  it('requires an active existing family', async () => {
    await expect(createStudent({ familyId: 'missing', name: 'Test Student A' })).rejects.toMatchObject({
      code: 'family-missing',
    });
    const archived = await createFamily('Test Family A');
    await archiveFamily(archived.id);
    await expect(createStudent({ familyId: archived.id, name: 'Test Student A' })).rejects.toMatchObject({
      code: 'family-missing',
    });
    const gone = await createFamily('Test Family B');
    await deleteFamily(gone.id);
    await expect(createStudent({ familyId: gone.id, name: 'Test Student A' })).rejects.toMatchObject({
      code: 'family-missing',
    });
    expect(await db.students.count()).toBe(0);
  });

  it('defaults subject to both and notes to empty, and stores given values', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: ' Test Student A ' });
    expect(s.name).toBe('Test Student A');
    expect(s.defaultSubject).toBe('both');
    expect(s.notes).toBe('');
    expect(s.archivedAt).toBeNull();
    const t = await createStudent({
      familyId: f.id,
      name: 'Test Student B',
      defaultSubject: 'math',
      notes: 'line one\nline two',
    });
    expect(t.defaultSubject).toBe('math');
    expect(t.notes).toBe('line one\nline two');
  });

  it('rejects invalid input with the validator code and writes nothing', async () => {
    const f = await createFamily('Test Family A');
    await expect(createStudent({ familyId: f.id, name: '  ' })).rejects.toMatchObject({ code: 'name-empty' });
    await expect(createStudent({ familyId: f.id, name: 'a'.repeat(61) })).rejects.toMatchObject({
      code: 'name-too-long',
    });
    await expect(
      createStudent({ familyId: f.id, name: 'Test Student A', defaultSubject: 'art' as never }),
    ).rejects.toMatchObject({ code: 'subject-invalid' });
    await expect(createStudent({ familyId: '', name: 'Test Student A' })).rejects.toMatchObject({
      code: 'family-missing',
    });
    expect(await db.students.count()).toBe(0);
  });

  it('keeps two same-name students as separate records', async () => {
    const f = await createFamily('Test Family A');
    const a = await createStudent({ familyId: f.id, name: 'Test Student A' });
    const b = await createStudent({ familyId: f.id, name: 'Test Student A' });
    expect(a.id).not.toBe(b.id);
    expect((await listActiveStudents()).length).toBe(2);
  });

  it('updates fields, moves between active families only, and moves updatedAt', async () => {
    const f1 = await createFamily('Test Family A');
    const f2 = await createFamily('Test Family B');
    const f3 = await createFamily('Test Family C');
    await archiveFamily(f3.id);
    const s = await createStudent({ familyId: f1.id, name: 'Test Student A' });
    await db.students.update(s.id, { updatedAt: 1 });
    const u = await updateStudent(s.id, {
      familyId: f2.id,
      name: 'Test Student B',
      defaultSubject: 'swim',
      notes: 'note',
    });
    expect(u).toMatchObject({ familyId: f2.id, name: 'Test Student B', defaultSubject: 'swim', notes: 'note' });
    expect(u.updatedAt).toBeGreaterThan(1);
    await expect(
      updateStudent(s.id, { familyId: f3.id, name: 'Test Student B', defaultSubject: 'swim', notes: '' }),
    ).rejects.toMatchObject({ code: 'family-missing' });
    await expect(
      updateStudent(s.id, { familyId: 'missing', name: 'Test Student B', defaultSubject: 'swim', notes: '' }),
    ).rejects.toMatchObject({ code: 'family-missing' });
    await expect(
      updateStudent('missing', { familyId: f1.id, name: 'x', defaultSubject: 'swim', notes: '' }),
    ).rejects.toMatchObject({ code: 'not-found' });
    expect((await getStudent(s.id))?.familyId).toBe(f2.id);
  });

  it('lets a student stay under a family that was archived since, when familyId is unchanged', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    await archiveFamily(f.id);
    const u = await updateStudent(s.id, { familyId: f.id, name: 'Test Student B', defaultSubject: 'both', notes: '' });
    expect(u.name).toBe('Test Student B');
  });

  it('keeps stored subject, notes and family when an update omits them', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A', defaultSubject: 'swim', notes: 'private note' });
    const u = await updateStudent(s.id, { name: 'Test Student B' });
    expect(u).toMatchObject({ familyId: f.id, name: 'Test Student B', defaultSubject: 'swim', notes: 'private note' });
    expect(await getStudent(s.id)).toMatchObject({ defaultSubject: 'swim', notes: 'private note' });
    await expect(updateStudent(s.id, { name: '  ' })).rejects.toMatchObject({ code: 'name-empty' });
  });

  it('archives and restores idempotently and lists each state', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    const other = await createStudent({ familyId: f.id, name: 'Test Student B' });
    const first = await archiveStudent(s.id);
    expect(first.archivedAt).not.toBeNull();
    await db.students.update(s.id, { archivedAt: 456 });
    expect((await archiveStudent(s.id)).archivedAt).toBe(456);
    expect((await listActiveStudents()).map((x) => x.id)).toEqual([other.id]);
    expect((await listArchivedStudents()).map((x) => x.id)).toEqual([s.id]);
    expect((await restoreStudent(s.id)).archivedAt).toBeNull();
    expect((await restoreStudent(s.id)).archivedAt).toBeNull();
    await expect(archiveStudent('missing')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('refuses to restore a student whose family is archived, until the family is restored', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    await archiveStudent(s.id);
    await archiveFamily(f.id);
    await expect(restoreStudent(s.id)).rejects.toMatchObject({ code: 'family-missing' });
    expect((await getStudent(s.id))?.archivedAt).not.toBeNull();
    await restoreFamily(f.id);
    expect((await restoreStudent(s.id)).archivedAt).toBeNull();
  });

  it('deletes a student with no sessions and blocks one with a session', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    const t = await createStudent({ familyId: f.id, name: 'Test Student B' });
    expect(await studentHasHistory(s.id)).toBe(false);
    await db.sessions.add({ id: 'session-1', attendees: [{ studentId: t.id }] });
    expect(await studentHasHistory(t.id)).toBe(true);
    expect(await studentHasHistory(s.id)).toBe(false);
    expect(await deleteStudent(t.id)).toEqual({ ok: false, reason: 'has-history' });
    expect(await getStudent(t.id)).toBeDefined();
    expect(await deleteStudent(s.id)).toEqual({ ok: true });
    expect(await getStudent(s.id)).toBeUndefined();
    expect(await deleteStudent('missing')).toEqual({ ok: false, reason: 'not-found' });
  });
});

describe('student delete guard', () => {
  it('treats a session row with an unrecognised shape as history and refuses the delete', async () => {
    const f = await createFamily('Test Family A');
    const s = await createStudent({ familyId: f.id, name: 'Test Student A' });
    await db.sessions.add({ id: 'session-x', studentIds: [s.id] } as never);
    expect(await studentHasHistory(s.id)).toBe(true);
    expect(await deleteStudent(s.id)).toEqual({ ok: false, reason: 'has-history' });
    expect(await getStudent(s.id)).toBeDefined();
  });
});

describe('concurrency', () => {
  it('never leaves a student pointing at a missing family when delete and create race', async () => {
    for (let i = 0; i < 10; i++) {
      const f = await createFamily(`Test Family ${i}`);
      const [del, add] = await Promise.allSettled([
        deleteFamily(f.id),
        createStudent({ familyId: f.id, name: 'Test Student A' }),
      ]);
      const family = await getFamily(f.id);
      const students = await db.students.where('familyId').equals(f.id).toArray();
      if (family === undefined) {
        expect(del).toMatchObject({ status: 'fulfilled', value: { ok: true } });
        expect(add).toMatchObject({ status: 'rejected', reason: { code: 'family-missing' } });
        expect(students).toEqual([]);
      } else {
        expect(del).toMatchObject({ status: 'fulfilled', value: { ok: false, reason: 'has-students' } });
        expect(add.status).toBe('fulfilled');
        expect(students).toHaveLength(1);
      }
    }
  });
});
