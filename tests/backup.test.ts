import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, markBackedUp, readBackupStatus, restoreBackup } from '../src/data/backup';
import { db } from '../src/data/db';
import { createFamily } from '../src/data/families';
import { createSession, listSessions } from '../src/data/sessions';
import { createStudent } from '../src/data/students';
import {
  backupFileName,
  backupReminder,
  BackupError,
  countsText,
  daysAgoText,
  formatBackupDate,
  MAX_BACKUP_BYTES,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from '../src/domain/backup';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

const full = (familyId: string) => ({ familyId, lesson: 'full' as const, activity: 'full' as const });

async function seed() {
  const famA = await createFamily('Test Family A');
  const famB = await createFamily('Test Family B', 'monthly');
  const s1 = await createStudent({ familyId: famA.id, name: 'Test Student A1', notes: 'Test note' });
  const s2 = await createStudent({ familyId: famB.id, name: 'Test Student B1' });
  await createSession({
    date: '2026-10-19', startTime: '16:00', endTime: '17:15', subject: 'swim',
    attendees: [{ studentId: s1.id, familyId: famA.id }, { studentId: s2.id, familyId: famB.id }],
    credits: [{ familyId: famA.id, lesson: 'half', activity: 'full' }, full(famB.id)],
    lessonMinutes: 45, activityMinutes: 30, travelMinutes: 10,
  });
  await createSession({
    date: '2026-10-19', startTime: null, endTime: null, subject: 'math',
    attendees: [{ studentId: s1.id, familyId: famA.id }], credits: [full(famA.id)],
    lessonMinutes: 60, activityMinutes: 0, travelMinutes: 0,
  });
}

const snapshot = async () => ({
  families: await db.families.toArray(),
  students: await db.students.toArray(),
  sessions: await db.sessions.toArray(),
  expenses: await db.expenses.toArray(),
  attachments: await db.attachments.toArray(),
  last: (await db.meta.get('lastBackupAt'))?.value,
});

describe('buildBackup', () => {
  it('exports the contract, sorted by id, with every data table present', async () => {
    await seed();
    const file = await buildBackup(1_000);
    expect(file).toMatchObject({ format: 'lesson-ledger-backup', schemaVersion: 1, createdAt: 1_000, expenses: [], attachments: [] });
    expect(file.families).toHaveLength(2);
    expect(file.students).toHaveLength(2);
    expect(file.sessions).toHaveLength(2);
    for (const list of [file.families, file.students, file.sessions]) {
      const ids = list.map((r) => r.id);
      expect(ids).toEqual([...ids].sort());
    }
    const dataKeys = Object.keys(file).filter((k) => !['format', 'schemaVersion', 'createdAt'].includes(k)).sort();
    expect(dataKeys).toEqual(db.tables.map((t) => t.name).filter((n) => n !== 'meta').sort());
  });

  it('is identical across two exports except createdAt, and an empty database exports a valid file', async () => {
    await seed();
    const a = await buildBackup(1);
    const b = await buildBackup(2);
    expect({ ...a, createdAt: 0 }).toEqual({ ...b, createdAt: 0 });
    await db.families.clear();
    await db.students.clear();
    await db.sessions.clear();
    const empty = await buildBackup(3);
    expect([empty.families, empty.students, empty.sessions, empty.expenses, empty.attachments].every((x) => x.length === 0)).toBe(true);
    expect(parseBackup(serializeBackup(empty)).ok).toBe(true);
  });

  it('never yields a session that references a student missing from the snapshot (racing writes)', async () => {
    const fam = await createFamily('Test Family A');
    for (let round = 0; round < 5; round++) {
      let stop = false;
      const writer = (async () => {
        while (!stop) {
          const st = await createStudent({ familyId: fam.id, name: 'Test Student R' });
          await createSession({
            date: '2026-10-19', startTime: null, endTime: null, subject: 'math',
            attendees: [{ studentId: st.id, familyId: fam.id }], credits: [full(fam.id)],
            lessonMinutes: 30, activityMinutes: 0, travelMinutes: 0,
          });
        }
      })();
      for (let i = 0; i < 10; i++) {
        const file = await buildBackup();
        const ids = new Set(file.students.map((s) => s.id));
        expect(file.sessions.every((s) => s.attendees.every((a) => ids.has(a.studentId)))).toBe(true);
        expect(parseBackup(serializeBackup(file)).ok).toBe(true);
      }
      stop = true;
      await writer;
    }
  });

  it.each(['expenses', 'attachments'] as const)('rejects with unsupported-data when %s holds a row', async (table) => {
    await seed();
    await db[table].add({ id: 'x' } as never); // rows are typed since Phase 3; this fakes a non-empty table
    await expect(buildBackup()).rejects.toMatchObject({ code: 'unsupported-data' });
    await expect(buildBackup()).rejects.toBeInstanceOf(BackupError);
  });
});

describe('parseBackup rejection', () => {
  const doc = async () => {
    await seed();
    return JSON.parse(serializeBackup(await buildBackup(5))) as Record<string, any>;
  };

  it.each([
    ['empty', ''],
    ['whitespace', '  \n\t '],
    ['null', 'null'],
    ['array', '[]'],
    ['empty object', '{}'],
    ['object without the marker', '{"a":1}'],
    ['wrong marker', '{"format":"other"}'],
    ['not JSON', 'GIF89a binary'],
  ])('%s is not a backup', (_n, text) => {
    expect(parseBackup(text)).toEqual({ ok: false, code: 'not-backup' });
  });

  it('a file over 50 MB is not a backup, judged by size before parsing', () => {
    expect(parseBackup('{"format":"lesson-ledger-backup"}', MAX_BACKUP_BYTES + 1)).toEqual({ ok: false, code: 'not-backup' });
  });

  it('truncated JSON is damaged', () => {
    expect(parseBackup('{"format":"lesson-ledger-backup","schemaVersion":1,')).toEqual({ ok: false, code: 'damaged' });
  });

  it('a higher schemaVersion is newer-version, even when the rows are unusable', () => {
    expect(parseBackup('{"format":"lesson-ledger-backup","schemaVersion":2,"families":7}')).toEqual({ ok: false, code: 'newer-version' });
  });

  const damage: [string, (d: Record<string, any>) => void][] = [
    ['missing array', (d) => delete d.students],
    ['array is not an array', (d) => (d.sessions = {})],
    ['schemaVersion 0', (d) => (d.schemaVersion = 0)],
    ['schemaVersion 1.5', (d) => (d.schemaVersion = 1.5)],
    ['schemaVersion string', (d) => (d.schemaVersion = '1')],
    ['createdAt missing', (d) => delete d.createdAt],
    ['family with empty name', (d) => (d.families[0].name = '  ')],
    ['family with bad period', (d) => (d.families[0].period = 'daily')],
    ['family with bad timestamp', (d) => (d.families[0].createdAt = 'x')],
    ['student with bad subject', (d) => (d.students[0].defaultSubject = 'art')],
    ['session with bad date', (d) => (d.sessions[0].date = '2026-02-30')],
    ['session with negative minutes', (d) => (d.sessions[0].lessonMinutes = -1)],
    ['session missing startTime', (d) => delete d.sessions[0].startTime],
    ['session whose finish does not match its minutes', (d) => (d.sessions.find((s: any) => s.startTime === '16:00').endTime = '17:00')],
    ['session with a finish but no start', (d) => (d.sessions.find((s: any) => s.startTime === null).endTime = '10:00')],
    ['session with a malformed finish', (d) => (d.sessions.find((s: any) => s.startTime === '16:00').endTime = '25:00')],
    ['row is not an object', (d) => (d.families[0] = 5)],
    ['duplicate family id', (d) => (d.families[1].id = d.families[0].id)],
    ['duplicate session id', (d) => (d.sessions[1].id = d.sessions[0].id)],
    ['student whose family is absent', (d) => (d.students[0].familyId = 'nope')],
    ['session whose student is absent', (d) => (d.sessions[0].attendees[0].studentId = 'nope')],
    ['session whose family is absent', (d) => (d.sessions[0].attendees[0].familyId = 'nope')],
    ['non-empty expenses', (d) => (d.expenses = [{ id: 'x' }])],
    ['non-empty attachments', (d) => (d.attachments = [{ id: 'x' }])],
  ];

  it.each(damage)('%s is damaged and leaves the database untouched', async (_n, mutate) => {
    const d = await doc();
    const before = await snapshot();
    mutate(d);
    expect(parseBackup(JSON.stringify(d))).toEqual({ ok: false, code: 'damaged' });
    expect(await snapshot()).toEqual(before);
  });

  it('a backup whose sessions have no endTime key parses ok, and every session reads endTime null', async () => {
    const d = await doc();
    for (const s of d.sessions) delete s.endTime;
    const parsed = parseBackup(JSON.stringify(d));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.sessions.every((s) => s.endTime === null)).toBe(true);
  });

  it('rebuilds rows from whitelisted fields: extra and __proto__ keys never reach the result', async () => {
    const d = await doc();
    d.families[0].extra = 'x';
    const text = serializeBackup(d as BackupFile).replace('"extra":"x"', '"extra":"x","__proto__":{"polluted":true}');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.file.families[0]).sort()).toEqual(['archivedAt', 'createdAt', 'id', 'name', 'period', 'updatedAt']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((parsed.file.families[0] as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('restoreBackup', () => {
  const roundTrip = async () => parseBackup(serializeBackup(await buildBackup(7_000)));

  it('round-trips every table and keeps the Sessions order', async () => {
    await seed();
    const before = await snapshot();
    const order = (await listSessions()).map((s) => s.id);
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    for (const t of [db.families, db.students, db.sessions]) await t.clear();
    await restoreBackup(parsed.file);
    expect({ ...(await snapshot()), last: undefined }).toEqual({ ...before, last: undefined });
    expect((await listSessions()).map((s) => s.id)).toEqual(order);
    expect((await listSessions()).find((s) => s.startTime === '16:00')?.endTime).toBe('17:15');
    expect((await readBackupStatus()).lastBackupAt).toBe(7_000);
  });

  it('a backup dated in the future restores with lastBackupAt clamped to now, not to the future', async () => {
    const parsed = parseBackup(serializeBackup(await buildBackup(Date.now() + 10 * 86_400_000)));
    if (!parsed.ok) throw new Error('parse failed');
    const before = Date.now();
    await restoreBackup(parsed.file);
    const { lastBackupAt } = await readBackupStatus();
    expect(lastBackupAt).toBeGreaterThanOrEqual(before);
    expect(lastBackupAt).toBeLessThanOrEqual(Date.now());
  });

  it('is idempotent: restoring the same file twice leaves identical tables', async () => {
    await seed();
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    await restoreBackup(parsed.file);
    const once = await snapshot();
    await restoreBackup(parsed.file);
    expect(await snapshot()).toEqual(once);
  });

  it('replaces different data with only the file rows', async () => {
    await seed();
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    await createFamily('Test Family Z');
    await restoreBackup(parsed.file);
    expect((await db.families.toArray()).map((f) => f.name).sort()).toEqual(['Test Family A', 'Test Family B']);
  });

  it('restoring an empty backup into a database with data empties every data table', async () => {
    const empty = await buildBackup(9);
    await seed();
    await restoreBackup(empty);
    const s = await snapshot();
    expect([s.families, s.students, s.sessions, s.expenses, s.attachments].every((x) => x.length === 0)).toBe(true);
  });

  it('is atomic: a duplicate session id aborts and every table plus lastBackupAt is as before', async () => {
    await seed();
    await markBackedUp(123);
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    const bad: BackupFile = { ...parsed.file, createdAt: 999, sessions: [parsed.file.sessions[0], parsed.file.sessions[0]] };
    const before = await snapshot();
    await expect(restoreBackup(bad)).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
    expect(before.last).toBe(123);
  });
});

describe('names, day counts and reminder text', () => {
  it('names the file from the local date', () => {
    expect(backupFileName(new Date(2026, 9, 19, 23, 30))).toBe('lesson-ledger-backup-2026-10-19.json');
    expect(backupFileName(new Date(2026, 0, 1, 0, 5))).toBe('lesson-ledger-backup-2026-01-01.json');
  });

  it('formats a local date', () => {
    expect(formatBackupDate(new Date(2026, 9, 19, 12).getTime())).toBe('Oct 19, 2026');
  });

  const at = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m).getTime();

  it('daysAgoText counts local calendar days', () => {
    expect(daysAgoText(null, at(19))).toBe('Never');
    expect(daysAgoText(at(19, 8), at(19, 23))).toBe('Today');
    expect(daysAgoText(at(18), at(19))).toBe('Yesterday');
    expect(daysAgoText(at(16), at(19))).toBe('3 days ago');
    expect(daysAgoText(at(18, 23, 50), at(19, 0, 10))).toBe('Yesterday');
    expect(daysAgoText(at(20), at(19))).toBe('Today'); // clock set back: never a negative count
  });

  it('backupReminder: hidden, quiet, then due from 7 days or when never backed up', () => {
    const now = at(19);
    expect(backupReminder({ sessionCount: 0, lastBackupAt: null }, now)).toEqual({ kind: 'hidden' });
    expect(backupReminder({ sessionCount: 0, lastBackupAt: at(1) }, now)).toEqual({ kind: 'hidden' });
    expect(backupReminder({ sessionCount: 1, lastBackupAt: null }, now)).toEqual({ kind: 'due', body: 'No backup yet.' });
    expect(backupReminder({ sessionCount: 1, lastBackupAt: at(19) }, now)).toEqual({ kind: 'quiet', text: 'Last backup today' });
    expect(backupReminder({ sessionCount: 1, lastBackupAt: at(18) }, now)).toEqual({ kind: 'quiet', text: 'Last backup yesterday' });
    expect(backupReminder({ sessionCount: 1, lastBackupAt: at(13) }, now)).toEqual({ kind: 'quiet', text: 'Last backup 6 days ago' });
    expect(backupReminder({ sessionCount: 1, lastBackupAt: at(12) }, now)).toEqual({ kind: 'due', body: 'Last backup 7 days ago.' });
  });

  it('countsText uses plural rules', () => {
    expect(countsText({ families: 1, students: 1, sessions: 1 })).toBe('1 family, 1 student and 1 session');
    expect(countsText({ families: 2, students: 0, sessions: 5 })).toBe('2 families, 0 students and 5 sessions');
  });
});
