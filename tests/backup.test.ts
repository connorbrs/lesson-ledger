import 'fake-indexeddb/auto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackup, markBackedUp, readBackupStatus, restoreBackup } from '../src/data/backup';
import { db } from '../src/data/db';
import { createFamily } from '../src/data/families';
import type { ExpensePayload, NewPhoto } from '../src/data/expenses';
import { createSession, listSessions } from '../src/data/sessions';
import { setInstructorName, getInstructorName } from '../src/data/instructor';
import { markSent, saveMessage } from '../src/data/periodRecords';
import { createStudent } from '../src/data/students';
import {
  BACKUP_TOO_LARGE_MESSAGE,
  backupFileName,
  backupReminder,
  BackupError,
  countPhrases,
  countsText,
  daysAgoText,
  formatBackupDate,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreFailureFor,
  serializeBackup,
  type BackupFile,
} from '../src/domain/backup';
import { base64ToBytes, bytesToBase64 } from '../src/domain/base64';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

const full = (familyId: string) => ({ familyId, lesson: 'full' as const, activity: 'full' as const });

/** A JPEG-like Blob: starts FF D8 FF E0, then deterministic bytes that differ per seed. */
const jpeg = (seed: number, size = 64): NewPhoto => {
  const bytes = Uint8Array.from({ length: size }, (_, i) => (i < 4 ? [0xff, 0xd8, 0xff, 0xe0][i] : (i * 7 + seed * 13) % 256));
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), width: 40 + seed, height: 30 + seed, createdAt: 1_000 + seed };
};

const draft = (id: string, description: string, amountCents: number, photoIds: string[], createdAt: number) => ({
  id, description, amountCents, splits: null, photoIds, createdAt,
});

const payload = (): ExpensePayload => ({
  expenses: [draft('e-b', 'Pool entry', 1001, ['p-1', 'p-3'], 10), draft('e-a', 'Snacks', 450, ['p-2'], 11)],
  photos: new Map([['p-1', jpeg(1)], ['p-2', jpeg(2, 200)], ['p-3', jpeg(3, 5000)]]),
});

async function seed() {
  const famA = await createFamily('Test Family A');
  const famB = await createFamily('Test Family B', 'monthly');
  const s1 = await createStudent({ familyId: famA.id, name: 'Test Student A1', notes: 'Test note' });
  const s2 = await createStudent({ familyId: famB.id, name: 'Test Student B1' });
  await createSession(
    {
      date: '2026-10-19', startTime: '16:00', endTime: '17:15', subject: 'swim',
      attendees: [{ studentId: s1.id, familyId: famA.id }, { studentId: s2.id, familyId: famB.id }],
      credits: [{ familyId: famA.id, lesson: 'half', activity: 'full' }, full(famB.id)],
      lessonMinutes: 45, activityMinutes: 30, travelMinutes: 10,
    },
    payload(),
  );
  await createSession({
    date: '2026-10-19', startTime: null, endTime: null, subject: 'math',
    attendees: [{ studentId: s1.id, familyId: famA.id }], credits: [full(famA.id)],
    lessonMinutes: 60, activityMinutes: 0, travelMinutes: 0,
  });
  await saveMessage(famA.id, 'W2026-10-12', 'Merhaba, bu hafta özet.', 'a1b2c3d4e5f60a');
  await markSent(famA.id, 'W2026-10-12', 'a1b2c3d4e5f60a', 5_000);
  await markSent(famB.id, 'M2026-10', '0123456789abcd', 6_000);
  await setInstructorName('Connor B.');
}

const blobBase64 = async (b: Blob) => bytesToBase64(new Uint8Array(await b.arrayBuffer()));

/** Photo Blobs become type plus base64 text, so deep equality really compares contents. */
const snapshot = async () => ({
  families: await db.families.toArray(),
  students: await db.students.toArray(),
  sessions: await db.sessions.toArray(),
  expenses: await db.expenses.toArray(),
  attachments: await Promise.all((await db.attachments.toArray()).map(async (a) => ({ ...a, blob: { type: a.blob.type, data: await blobBase64(a.blob) } }))),
  periodRecords: await db.periodRecords.toArray(),
  instructorName: await getInstructorName(),
  last: (await db.meta.get('lastBackupAt'))?.value,
});

const clearData = async () => {
  for (const t of db.tables) if (t.name !== 'meta') await t.clear();
  await db.meta.delete('instructorName');
};

describe('buildBackup', () => {
  it('exports the contract, sorted by id, with every data table present', async () => {
    await seed();
    const file = await buildBackup(1_000);
    expect(file).toMatchObject({ format: 'lesson-ledger-backup', schemaVersion: 3, createdAt: 1_000, instructorName: 'Connor B.' });
    expect(file.families).toHaveLength(2);
    expect(file.students).toHaveLength(2);
    expect(file.sessions).toHaveLength(2);
    expect(file.expenses).toHaveLength(2);
    expect(file.attachments).toHaveLength(3);
    expect(file.periodRecords).toHaveLength(2);
    for (const list of [file.families, file.students, file.sessions, file.expenses, file.attachments, file.periodRecords]) {
      const ids = list.map((r) => r.id);
      expect(ids).toEqual([...ids].sort());
    }
    const dataKeys = Object.keys(file).filter((k) => !['format', 'schemaVersion', 'createdAt', 'instructorName'].includes(k)).sort();
    expect(dataKeys).toEqual(db.tables.map((t) => t.name).filter((n) => n !== 'meta').sort());
  });

  it('exports expenses as the stored rows and photos as {id, expenseId, mime, width, height, createdAt, data}', async () => {
    await seed();
    const file = await buildBackup(1_000);
    expect(file.expenses).toEqual((await db.expenses.toArray()).sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(file.expenses.map((e) => e.id)).toEqual(['e-a', 'e-b']);
    const stored = new Map((await db.attachments.toArray()).map((a) => [a.id, a]));
    expect(file.attachments.map((a) => a.id)).toEqual(['p-1', 'p-2', 'p-3']);
    for (const a of file.attachments) {
      const row = stored.get(a.id)!;
      expect(Object.keys(a).sort()).toEqual(['createdAt', 'data', 'expenseId', 'height', 'id', 'mime', 'width']);
      expect({ expenseId: a.expenseId, mime: a.mime, width: a.width, height: a.height, createdAt: a.createdAt }).toEqual({
        expenseId: row.expenseId, mime: 'image/jpeg', width: row.width, height: row.height, createdAt: row.createdAt,
      });
      expect(a.data).toBe(await blobBase64(row.blob));
      expect(Array.from(base64ToBytes(a.data) as Uint8Array)).toEqual(Array.from(new Uint8Array(await row.blob.arrayBuffer())));
    }
  });

  it('exports period records as the stored rows, sorted by id', async () => {
    await seed();
    const file = await buildBackup(1_000);
    expect(file.periodRecords).toEqual((await db.periodRecords.toArray()).sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(file.periodRecords.some((r) => r.message !== null && r.sentAt !== null)).toBe(true);
  });

  it('is identical across two exports except createdAt, and an empty database exports six empty arrays and no name', async () => {
    await seed();
    const a = await buildBackup(1);
    const b = await buildBackup(2);
    expect({ ...a, createdAt: 0 }).toEqual({ ...b, createdAt: 0 });
    await clearData();
    const empty = await buildBackup(3);
    expect([empty.families, empty.students, empty.sessions, empty.expenses, empty.attachments, empty.periodRecords].every((x) => x.length === 0)).toBe(true);
    expect(empty.instructorName).toBeNull();
    expect(parseBackup(serializeBackup(empty)).ok).toBe(true);
  });

  it('never yields a dangling reference, receipts included (racing writes)', async () => {
    const fam = await createFamily('Test Family A');
    let n = 0;
    for (let round = 0; round < 5; round++) {
      let stop = false;
      const writer = (async () => {
        while (!stop) {
          const st = await createStudent({ familyId: fam.id, name: 'Test Student R' });
          n += 1;
          await createSession(
            {
              date: '2026-10-19', startTime: null, endTime: null, subject: 'math',
              attendees: [{ studentId: st.id, familyId: fam.id }], credits: [full(fam.id)],
              lessonMinutes: 30, activityMinutes: 0, travelMinutes: 0,
            },
            { expenses: [draft(`e${n}`, 'Race', 500, [`p${n}`], n)], photos: new Map([[`p${n}`, jpeg(n % 50)]]) },
          );
        }
      })();
      for (let i = 0; i < 10; i++) {
        const file = await buildBackup();
        const students = new Set(file.students.map((s) => s.id));
        const sessions = new Set(file.sessions.map((s) => s.id));
        const expenses = new Set(file.expenses.map((e) => e.id));
        expect(file.sessions.every((s) => s.attendees.every((a) => students.has(a.studentId)))).toBe(true);
        expect(file.expenses.every((e) => sessions.has(e.sessionId))).toBe(true);
        expect(file.attachments.every((a) => expenses.has(a.expenseId))).toBe(true);
        expect(parseBackup(serializeBackup(file)).ok).toBe(true);
      }
      stop = true;
      await writer;
    }
  });

  it('refuses with too-large before encoding anything when the projected size is over the cap, and succeeds at the boundary', async () => {
    await seed();
    const total = (await db.attachments.toArray()).reduce((sum, a) => sum + a.blob.size, 0);
    const projected = Math.ceil(total / 3) * 4;
    const spy = vi.spyOn(Blob.prototype, 'arrayBuffer');
    try {
      await expect(buildBackup(1, projected - 1)).rejects.toMatchObject({ code: 'too-large' });
      await expect(buildBackup(1, projected - 1)).rejects.toBeInstanceOf(BackupError);
      expect(spy).not.toHaveBeenCalled();
      const file = await buildBackup(1, projected);
      expect(file.attachments).toHaveLength(3);
    } finally {
      spy.mockRestore();
    }
  });

  it('an export of a database with receipts, serialized and parsed with its size, is accepted', async () => {
    await seed();
    const text = serializeBackup(await buildBackup(5));
    expect(parseBackup(text, new Blob([text]).size).ok).toBe(true);
  });

  it('too-large message is exact', () => {
    expect(BACKUP_TOO_LARGE_MESSAGE).toBe('This backup is too large to save (over 150 MB).');
  });
});

describe('restoreFailureFor', () => {
  it('maps an undecodable photo to damaged and everything else to null', () => {
    expect(restoreFailureFor(new BackupError('invalid-photo'))).toBe('damaged');
    expect(restoreFailureFor(new BackupError('too-large'))).toBeNull();
    expect(restoreFailureFor(new Error('boom'))).toBeNull();
    expect(restoreFailureFor({ name: 'BulkError', message: 'x' })).toBeNull();
    expect(restoreFailureFor('nope')).toBeNull();
    expect(restoreFailureFor(undefined)).toBeNull();
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

  it('a file over 150 MB is not a backup, judged by size before parsing', () => {
    expect(MAX_BACKUP_BYTES).toBe(150_000_000);
    expect(parseBackup('{"format":"lesson-ledger-backup"}', MAX_BACKUP_BYTES + 1)).toEqual({ ok: false, code: 'not-backup' });
  });

  it('truncated JSON is damaged', () => {
    expect(parseBackup('{"format":"lesson-ledger-backup","schemaVersion":2,')).toEqual({ ok: false, code: 'damaged' });
  });

  it('a higher schemaVersion is newer-version, even when the rows are unusable', () => {
    expect(parseBackup('{"format":"lesson-ledger-backup","schemaVersion":4,"families":7}')).toEqual({ ok: false, code: 'newer-version' });
  });

  it('accepts a version 2 file with receipts, and a version 1 file with empty arrays', async () => {
    const d = await doc();
    const v3 = parseBackup(JSON.stringify(d));
    expect(v3.ok && v3.file.schemaVersion === 3 && v3.file.expenses.length === 2 && v3.file.attachments.length === 3).toBe(true);
    expect(v3.ok && v3.file.periodRecords.length === 2 && v3.file.instructorName === 'Connor B.').toBe(true);
    d.schemaVersion = 2;
    delete d.periodRecords;
    delete d.instructorName;
    const v2 = parseBackup(JSON.stringify(d));
    expect(v2.ok && v2.file.schemaVersion === 2 && v2.file.expenses.length === 2 && v2.file.attachments.length === 3).toBe(true);
    expect(v2.ok && v2.file.periodRecords.length === 0 && v2.file.instructorName === null).toBe(true);
    d.schemaVersion = 1;
    d.expenses = [];
    d.attachments = [];
    const v1 = parseBackup(JSON.stringify(d));
    expect(v1.ok && v1.file.schemaVersion === 1 && v1.file.expenses.length === 0 && v1.file.attachments.length === 0).toBe(true);
  });

  /** Changes a record's family or period and rebuilds its id, so only that one rule is broken. */
  const relink = (r: Record<string, any>, change: { familyId?: string; periodKey?: string }) => {
    Object.assign(r, change);
    r.id = `${r.familyId}_${r.periodKey}`;
  };
  const withMessage = (d: Record<string, any>) => d.periodRecords.find((r: any) => r.message !== null);
  const sentOnly = (d: Record<string, any>) => d.periodRecords.find((r: any) => r.message === null);

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
    ['version 1 carrying expenses', (d) => ((d.schemaVersion = 1), (d.attachments = []), (d.periodRecords = []), delete d.instructorName)],
    ['version 1 carrying attachments', (d) => ((d.schemaVersion = 1), (d.expenses = []), (d.periodRecords = []), delete d.instructorName)],
    ['expenses missing', (d) => delete d.expenses],
    ['attachments missing', (d) => delete d.attachments],
    ['expense with unknown sessionId', (d) => (d.expenses[0].sessionId = 'nope')],
    ['expense amount 0', (d) => (d.expenses[0].amountCents = 0)],
    ['expense amount 1.5', (d) => (d.expenses[0].amountCents = 1.5)],
    ['expense amount -1', (d) => (d.expenses[0].amountCents = -1)],
    ['expense amount a string', (d) => (d.expenses[0].amountCents = '450')],
    ['expense amount beyond the safe-integer range', (d) => (d.expenses[0].amountCents = 2 ** 53)],
    ['expense with blank description', (d) => (d.expenses[0].description = '   ')],
    ['expense with an 81-code-point description', (d) => (d.expenses[0].description = 'x'.repeat(81))],
    ['expense with no shares', (d) => (d.expenses[0].splits = [])],
    ['expense with shares that are not an array', (d) => (d.expenses[0].splits = {})],
    ['share of -1 cents', (d) => (d.expenses[0].splits[0].cents = -1)],
    ['share of 1.5 cents', (d) => (d.expenses[0].splits[0].cents = 1.5)],
    ['shares not summing to the amount', (d) => (d.expenses[0].splits[0].cents += 1)],
    ['share for a family not on the session', (d) => (d.expenses[0].splits[0].familyId = 'nope')],
    ['shares missing one of the session families', (d) => (d.expenses[0].splits = [{ familyId: d.expenses[0].splits[0].familyId, cents: d.expenses[0].amountCents }])],
    ['duplicate share family', (d) => (d.expenses[0].splits[1].familyId = d.expenses[0].splits[0].familyId)],
    ['expense with bad createdAt', (d) => (d.expenses[0].createdAt = 'x')],
    ['expense that is not an object', (d) => (d.expenses[0] = 5)],
    ['duplicate expense ids', (d) => (d.expenses[1].id = d.expenses[0].id)],
    ['attachment with unknown expenseId', (d) => (d.attachments[0].expenseId = 'nope')],
    ['attachment mime not image/jpeg', (d) => (d.attachments[0].mime = 'image/png')],
    ['attachment data not base64', (d) => (d.attachments[0].data = 'not base64!!')],
    ['attachment data of the wrong length', (d) => (d.attachments[0].data = d.attachments[0].data.slice(1))],
    ['attachment data empty', (d) => (d.attachments[0].data = '')],
    ['attachment data not a string', (d) => (d.attachments[0].data = 12)],
    ['attachment data with a PNG header', (d) => (d.attachments[0].data = bytesToBase64(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])))],
    ['attachment data over the 10 MB decoded cap', (d) => (d.attachments[0].data = '/9j/'.padEnd(14_000_000, 'A'))],
    ['attachment width 0', (d) => (d.attachments[0].width = 0)],
    ['attachment width 1.5', (d) => (d.attachments[0].width = 1.5)],
    ['attachment height above 100000', (d) => (d.attachments[0].height = 100_001)],
    ['attachment with bad createdAt', (d) => (d.attachments[0].createdAt = 'x')],
    ['duplicate attachment ids', (d) => (d.attachments[1].id = d.attachments[0].id)],
    ['attachment that is not an object', (d) => (d.attachments[0] = 5)],
    ['record whose family is not in the file', (d) => relink(d.periodRecords[0], { familyId: 'nope' })],
    ['record id different from familyId_periodKey', (d) => (d.periodRecords[0].id = 'other-id')],
    ["record id containing ':'", (d) => (d.periodRecords[0].id = `${d.periodRecords[0].familyId}:${d.periodRecords[0].periodKey}`)],
    ["record id containing '|'", (d) => (d.periodRecords[0].id = `${d.periodRecords[0].familyId}|${d.periodRecords[0].periodKey}`)],
    ['record week that is not a Monday', (d) => relink(d.periodRecords[0], { periodKey: 'W2026-10-13' })],
    ['record month 13', (d) => relink(d.periodRecords[0], { periodKey: 'M2026-13' })],
    ['record week on a day that does not exist', (d) => relink(d.periodRecords[0], { periodKey: 'W2026-02-30' })],
    ['duplicate record ids', (d) => d.periodRecords.push({ ...d.periodRecords[0] })],
    ['empty message', (d) => (withMessage(d).message = '')],
    ['blank message', (d) => (withMessage(d).message = '   ')],
    ['message of 10,001 code points', (d) => (withMessage(d).message = 'x'.repeat(10_001))],
    ['message of 10,001 emoji', (d) => (withMessage(d).message = '😀'.repeat(10_001))],
    ['message that is not a string', (d) => (withMessage(d).message = 5)],
    ['message without a messageFingerprint', (d) => (withMessage(d).messageFingerprint = null)],
    ['message without a messageSavedAt', (d) => (withMessage(d).messageSavedAt = null)],
    ['messageFingerprint without a message', (d) => (sentOnly(d).messageFingerprint = 'a1b2c3d4e5f60a')],
    ['messageSavedAt without a message', (d) => (sentOnly(d).messageSavedAt = 5)],
    ['sentAt without a sentFingerprint', (d) => (sentOnly(d).sentFingerprint = null)],
    ['sentFingerprint without a sentAt', (d) => (sentOnly(d).sentAt = null)],
    ['13-character fingerprint', (d) => (withMessage(d).messageFingerprint = 'a1b2c3d4e5f60')],
    ['uppercase fingerprint', (d) => (withMessage(d).messageFingerprint = 'A1B2C3D4E5F60A')],
    ['non-hex fingerprint', (d) => (sentOnly(d).sentFingerprint = 'g1b2c3d4e5f60a')],
    ['negative messageSavedAt', (d) => (withMessage(d).messageSavedAt = -1)],
    ['non-finite sentAt', (d) => (sentOnly(d).sentAt = 'x')],
    ['negative updatedAt', (d) => (d.periodRecords[0].updatedAt = -1)],
    ['record with neither message nor sent mark', (d) => Object.assign(sentOnly(d), { sentAt: null, sentFingerprint: null })],
    ['record that is not an object', (d) => (d.periodRecords[0] = 5)],
    ['periodRecords that is not an array', (d) => (d.periodRecords = {})],
    ['version 3 without periodRecords', (d) => delete d.periodRecords],
    ['version 3 without an instructorName key', (d) => delete d.instructorName],
    ['instructorName that is a number', (d) => (d.instructorName = 5)],
    ['instructorName that is blank', (d) => (d.instructorName = '   ')],
    ['instructorName of 61 code points', (d) => (d.instructorName = 'x'.repeat(61))],
    ['version 2 carrying a period record', (d) => ((d.schemaVersion = 2), (d.instructorName = null))],
    ['version 2 carrying an instructorName', (d) => ((d.schemaVersion = 2), (d.periodRecords = []))],
    ['version 1 carrying a period record', (d) => ((d.schemaVersion = 1), (d.expenses = []), (d.attachments = []), (d.instructorName = null))],
    ['version 1 carrying an instructorName', (d) => ((d.schemaVersion = 1), (d.expenses = []), (d.attachments = []), (d.periodRecords = []))],
  ];

  it.each(damage)('%s is damaged and leaves the database untouched', async (_n, mutate) => {
    const d = await doc();
    const before = await snapshot();
    mutate(d);
    expect(parseBackup(JSON.stringify(d))).toEqual({ ok: false, code: 'damaged' });
    expect(await snapshot()).toEqual(before);
  });

  it('accepts a 10,000 code point message (an emoji counts as one) and drops hostile record keys', async () => {
    const d = await doc();
    withMessage(d).message = '😀'.repeat(10_000);
    withMessage(d).extra = 'x';
    const text = JSON.stringify(d).replace('"extra":"x"', '"extra":"x","__proto__":{"polluted":true}');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const rec = parsed.file.periodRecords.find((r) => r.message !== null)!;
    expect([...rec.message!]).toHaveLength(10_000);
    expect(Object.keys(rec).sort()).toEqual(['familyId', 'id', 'message', 'messageFingerprint', 'messageSavedAt', 'periodKey', 'sentAt', 'sentFingerprint', 'updatedAt']);
    expect((rec as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects hostile or malformed row ids, and accepts the same backup under an ordinary id', async () => {
    const text = JSON.stringify(await doc());
    const sessionId = (JSON.parse(text).sessions[0] as { id: string }).id;
    const swap = (id: string) => text.split(JSON.stringify(sessionId)).join(JSON.stringify(id));
    expect(parseBackup(swap('renamed-id_1')).ok).toBe(true);
    for (const bad of ['__proto__', 'has space', 'x'.repeat(65), '']) {
      expect(parseBackup(swap(bad)), bad).toEqual({ ok: false, code: 'damaged' });
    }
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
    d.expenses[0].extra = 'y';
    d.expenses[0].splits[0].extra = 'z';
    d.attachments[0].extra = 'w';
    const text = serializeBackup(d as BackupFile)
      .replace('"extra":"x"', '"extra":"x","__proto__":{"polluted":true}')
      .replace('"extra":"y"', '"extra":"y","__proto__":{"polluted":true}')
      .replace('"extra":"w"', '"extra":"w","__proto__":{"polluted":true}');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.file.families[0]).sort()).toEqual(['archivedAt', 'createdAt', 'id', 'name', 'period', 'updatedAt']);
    expect(Object.keys(parsed.file.expenses[0]).sort()).toEqual(['amountCents', 'createdAt', 'description', 'id', 'sessionId', 'splits', 'updatedAt']);
    expect(Object.keys(parsed.file.expenses[0].splits[0]).sort()).toEqual(['cents', 'familyId']);
    expect(Object.keys(parsed.file.attachments[0]).sort()).toEqual(['createdAt', 'data', 'expenseId', 'height', 'id', 'mime', 'width']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    for (const row of [parsed.file.families[0], parsed.file.expenses[0], parsed.file.attachments[0]]) {
      expect((row as unknown as Record<string, unknown>).polluted).toBeUndefined();
    }
  });
});

/** Hand-written literal old files: no periodRecords and no instructorName keys. */
const LITERAL_FAMILY = '{"id":"fam-1","name":"Test Family A","period":"weekly","archivedAt":null,"createdAt":1,"updatedAt":1}';
const LITERAL_V1 = `{"format":"lesson-ledger-backup","schemaVersion":1,"createdAt":5,"families":[${LITERAL_FAMILY}],"students":[],"sessions":[],"expenses":[],"attachments":[]}`;
const LITERAL_V2 = `{"format":"lesson-ledger-backup","schemaVersion":2,"createdAt":5,"families":[${LITERAL_FAMILY}],"students":[],"sessions":[],"expenses":[],"attachments":[]}`;

describe('old backup files (schemaVersion 1 and 2) are read forever', () => {
  it.each([
    ['1', LITERAL_V1],
    ['2', LITERAL_V2],
  ])('a literal schemaVersion %s file parses with no period records and no instructor name', (v, text) => {
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.schemaVersion).toBe(Number(v));
    expect(parsed.file.periodRecords).toEqual([]);
    expect(parsed.file.instructorName).toBeNull();
    expect(parsed.file.families).toHaveLength(1);
  });

  it.each([
    ['1', LITERAL_V1],
    ['2', LITERAL_V2],
  ])('restoring a literal schemaVersion %s file clears stored period records and the instructor name (D-18)', async (_v, text) => {
    await seed();
    expect(await db.periodRecords.count()).toBe(2);
    expect(await getInstructorName()).toBe('Connor B.');
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('parse failed');
    await restoreBackup(parsed.file);
    expect(await db.periodRecords.count()).toBe(0);
    expect(await getInstructorName()).toBeNull();
    expect((await db.families.toArray()).map((f) => f.id)).toEqual(['fam-1']);
  });

  it('a file at schemaVersion 4 is newer-version even when its rows are unusable', () => {
    expect(parseBackup('{"format":"lesson-ledger-backup","schemaVersion":4,"periodRecords":"junk"}')).toEqual({ ok: false, code: 'newer-version' });
  });
});

describe('restoreBackup', () => {
  const roundTrip = async () => parseBackup(serializeBackup(await buildBackup(7_000)));

  it('round-trips every table, photo bytes included, and keeps the Sessions order', async () => {
    await seed();
    const before = await snapshot();
    const order = (await listSessions()).map((s) => s.id);
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    await clearData();
    await restoreBackup(parsed.file);
    expect({ ...(await snapshot()), last: undefined }).toEqual({ ...before, last: undefined });
    expect(before.attachments).toHaveLength(3);
    expect((await db.attachments.toArray()).every((a) => a.blob.type === 'image/jpeg')).toBe(true);
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

  it('restoring a version 1 file over receipts leaves expenses and attachments empty', async () => {
    await seed();
    const d = JSON.parse(serializeBackup(await buildBackup(8_000))) as Record<string, any>;
    d.schemaVersion = 1;
    d.expenses = [];
    d.attachments = [];
    delete d.periodRecords;
    delete d.instructorName;
    const parsed = parseBackup(JSON.stringify(d));
    if (!parsed.ok) throw new Error('parse failed');
    expect(await db.attachments.count()).toBe(3);
    await restoreBackup(parsed.file);
    expect(await db.periodRecords.count()).toBe(0);
    expect(await db.expenses.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.sessions.count()).toBe(2);
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

  it('restoring a version 3 file restores period records and the instructor name over different ones', async () => {
    await seed();
    const before = await snapshot();
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    await clearData();
    await setInstructorName('Someone Else');
    await restoreBackup(parsed.file);
    expect(await db.periodRecords.toArray()).toEqual(before.periodRecords);
    expect(await getInstructorName()).toBe('Connor B.');
  });

  it('is atomic with records: a duplicate record id aborts and every table, the name and lastBackupAt are as before', async () => {
    await seed();
    await markBackedUp(123);
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    const bad: BackupFile = { ...parsed.file, createdAt: 999, instructorName: 'Changed', periodRecords: [parsed.file.periodRecords[0], parsed.file.periodRecords[0]] };
    const before = await snapshot();
    await expect(restoreBackup(bad)).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
    expect(before.instructorName).toBe('Connor B.');
    expect(before.last).toBe(123);
  });

  it('is atomic with receipts: a duplicate expense id aborts and expenses, photo bytes and lastBackupAt are as before', async () => {
    await seed();
    await markBackedUp(123);
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    const bad: BackupFile = { ...parsed.file, createdAt: 999, expenses: [parsed.file.expenses[0], parsed.file.expenses[0]] };
    const before = await snapshot();
    await expect(restoreBackup(bad)).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
    expect(before.attachments).toHaveLength(3);
    expect(before.last).toBe(123);
  });

  it('a photo that is not valid base64 rejects with invalid-photo before any write', async () => {
    await seed();
    await markBackedUp(123);
    const parsed = await roundTrip();
    if (!parsed.ok) throw new Error('parse failed');
    const bad: BackupFile = {
      ...parsed.file,
      createdAt: 999,
      families: [],
      attachments: [{ ...parsed.file.attachments[0], data: 'not base64!!' }],
    };
    const before = await snapshot();
    const error = await restoreBackup(bad).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BackupError);
    expect(restoreFailureFor(error)).toBe('damaged');
    expect(await snapshot()).toEqual(before);
    expect(before.last).toBe(123);
  });
});

describe('scripts/make-large-backup.mjs', () => {
  const script = 'scripts/make-large-backup.mjs';

  it('writes a valid version 2 backup of about the asked size, with an expense and several photos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lesson-ledger-large-'));
    try {
      const out = join(dir, 'large.json');
      const run = spawnSync('node', [script, '2', out], { encoding: 'utf8' });
      expect(run.status).toBe(0);
      const size = statSync(out).size;
      expect(size).toBeGreaterThan(1_800_000);
      expect(size).toBeLessThan(2_200_000);
      expect(run.stdout).toContain(out);
      const parsed = parseBackup(readFileSync(out, 'utf8'), size);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.file.schemaVersion).toBe(2);
      expect(parsed.file.expenses.length).toBeGreaterThanOrEqual(1);
      expect(parsed.file.attachments.length).toBeGreaterThanOrEqual(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('needs both arguments: exits non-zero with a usage line and writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lesson-ledger-large-'));
    try {
      const out = join(dir, 'never.json');
      for (const args of [[], ['2'], ['abc', out], ['0', out]]) {
        const run = spawnSync('node', [script, ...args], { encoding: 'utf8' });
        expect(run.status).not.toBe(0);
        expect(run.stderr).toContain('Usage:');
      }
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
    expect(countsText({ families: 1, students: 1, sessions: 1, expenses: 1, photos: 1 })).toBe(
      '1 family, 1 student, 1 session, 1 expense and 1 receipt photo',
    );
    expect(countsText({ families: 2, students: 0, sessions: 5, expenses: 3, photos: 0 })).toBe(
      '2 families, 0 students, 5 sessions, 3 expenses and 0 receipt photos',
    );
    expect(countPhrases({ families: 1, students: 2, sessions: 0, expenses: 2, photos: 1 }).join(', ')).toBe(
      '1 family, 2 students, 0 sessions, 2 expenses, 1 receipt photo',
    );
  });
});
