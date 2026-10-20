import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, restoreBackup } from '../src/data/backup';
import { DB_NAME, db } from '../src/data/db';
import { createFamily, deleteFamily } from '../src/data/families';
import { createStudent } from '../src/data/students';
import { getInstructorName, setInstructorName } from '../src/data/instructor';
import { getPeriodRecord, markSent, saveMessage, unmarkSent } from '../src/data/periodRecords';
import { parseBackup, serializeBackup } from '../src/domain/backup';
import { MESSAGE_MAX, PeriodRecordError } from '../src/domain/periodRecord';
import { RosterError } from '../src/domain/validate';

const FP = 'a1b2c3d4e5f60a';
const FP2 = '0123456789abcd';
const KEY = 'W2026-10-12';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('schema version 2', () => {
  it('opens at verno 2 with seven tables and meta schemaVersion still 1', () => {
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['attachments', 'expenses', 'families', 'meta', 'periodRecords', 'sessions', 'students']);
  });

  it('opens a database written at version 1 with every row intact and an empty periodRecords table', async () => {
    db.close();
    await db.delete();
    const old = new Dexie(DB_NAME);
    old.version(1).stores({
      families: 'id, name',
      students: 'id, familyId',
      sessions: 'id, date, subject',
      expenses: 'id, sessionId',
      attachments: 'id, expenseId',
      meta: 'key',
    });
    const family = { id: 'fam-1', name: 'Test Family A', period: 'weekly', archivedAt: null, createdAt: 1, updatedAt: 1 };
    await old.table('families').add(family);
    await old.table('meta').add({ key: 'schemaVersion', value: 1 });
    old.close();

    await db.open();
    expect(db.verno).toBe(2);
    expect(await db.families.toArray()).toEqual([family]);
    expect(await db.meta.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: 1 });
    expect(await db.periodRecords.count()).toBe(0);
  });
});

describe('writers', () => {
  it('saveMessage, markSent and unmarkSent keep each other\'s fields and updatedAt strictly increases', async () => {
    const fam = await createFamily('Test Family A');
    const saved = await saveMessage(fam.id, KEY, 'Merhaba', FP);
    expect(saved).toMatchObject({
      id: `${fam.id}_${KEY}`, familyId: fam.id, periodKey: KEY, message: 'Merhaba', messageFingerprint: FP, sentAt: null, sentFingerprint: null,
    });
    expect(typeof saved.messageSavedAt).toBe('number');
    const sent = await markSent(fam.id, KEY, FP2, 9_000);
    expect(sent).toMatchObject({ message: 'Merhaba', messageFingerprint: FP, sentAt: 9_000, sentFingerprint: FP2 });
    const resaved = await saveMessage(fam.id, KEY, 'Merhaba 2', FP2);
    expect(resaved).toMatchObject({ message: 'Merhaba 2', sentAt: 9_000, sentFingerprint: FP2 });
    await unmarkSent(fam.id, KEY);
    const cleared = await getPeriodRecord(fam.id, KEY);
    expect(cleared).toMatchObject({ message: 'Merhaba 2', sentAt: null, sentFingerprint: null });
    expect(saved.updatedAt).toBeLessThan(sent.updatedAt);
    expect(sent.updatedAt).toBeLessThan(resaved.updatedAt);
    expect(resaved.updatedAt).toBeLessThan(cleared!.updatedAt);
  });

  it('unmarkSent on a row with only a sent mark deletes the row', async () => {
    const fam = await createFamily('Test Family A');
    await markSent(fam.id, KEY, FP, 1);
    expect(await getPeriodRecord(fam.id, KEY)).toBeDefined();
    await unmarkSent(fam.id, KEY);
    expect(await getPeriodRecord(fam.id, KEY)).toBeUndefined();
    expect(await db.periodRecords.count()).toBe(0);
  });
});

describe('instructor name', () => {
  it('trims and stores, blank clears, too long is refused and leaves the name unchanged', async () => {
    expect(await getInstructorName()).toBeNull();
    await setInstructorName('  Connor B.  ');
    expect(await getInstructorName()).toBe('Connor B.');
    await expect(setInstructorName('x'.repeat(61))).rejects.toMatchObject({ code: 'name-too-long' });
    await expect(setInstructorName('x'.repeat(61))).rejects.toBeInstanceOf(RosterError);
    expect(await getInstructorName()).toBe('Connor B.');
    await setInstructorName('');
    expect(await getInstructorName()).toBeNull();
    expect(await db.meta.get('instructorName')).toBeUndefined();
    await setInstructorName('Connor B.');
    await setInstructorName('   ');
    expect(await getInstructorName()).toBeNull();
  });
});

describe('tracer: message, sent mark and instructor name survive a schemaVersion 3 backup round trip', () => {
  it('builds, serializes, parses, and restores into a cleared database with identical content', async () => {
    const fam = await createFamily('Test Family A');
    await saveMessage(fam.id, KEY, 'Merhaba, özet hazır.', FP);
    await markSent(fam.id, KEY, FP, 4_000);
    await setInstructorName('Connor B.');
    const stored = await db.periodRecords.toArray();

    const file = await buildBackup(1_000);
    expect(file.schemaVersion).toBe(3);
    expect(file.periodRecords).toEqual(stored);
    expect(file.instructorName).toBe('Connor B.');

    const parsed = parseBackup(serializeBackup(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.periodRecords).toEqual(stored);
    expect(parsed.file.instructorName).toBe('Connor B.');

    for (const t of db.tables) if (t.name !== 'meta') await t.clear();
    await db.meta.delete('instructorName');
    await restoreBackup(parsed.file);
    expect(await db.periodRecords.toArray()).toEqual(stored);
    expect(await getInstructorName()).toBe('Connor B.');
  });
});

describe('message cap and writer guards', () => {
  it('saves 10,000 code points (an emoji counts as one) and the text survives a backup round trip untouched', async () => {
    expect(MESSAGE_MAX).toBe(10_000);
    const fam = await createFamily('Test Family A');
    const exact = '😀'.repeat(10_000);
    const saved = await saveMessage(fam.id, KEY, exact, FP);
    expect(saved.message).toBe(exact);
    const parsed = parseBackup(serializeBackup(await buildBackup(1)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.file.periodRecords[0].message).toBe(exact);
  });

  it('stores the text exactly as typed: no trim, no normalization', async () => {
    const fam = await createFamily('Test Family A');
    const typed = '  Merhaba\u0065\u0301  \n';
    expect((await saveMessage(fam.id, KEY, typed, FP)).message).toBe(typed);
  });

  it.each([
    ['blank', ''],
    ['whitespace only', ' \n\t '],
    ['10,001 code points', 'x'.repeat(10_001)],
    ['10,001 emoji', '😀'.repeat(10_001)],
    ['over 20,000 UTF-16 units', 'x'.repeat(20_001)],
  ])('saveMessage rejects a %s text and changes nothing', async (_n, text) => {
    const fam = await createFamily('Test Family A');
    await expect(saveMessage(fam.id, KEY, text, FP)).rejects.toBeInstanceOf(PeriodRecordError);
    expect(await db.periodRecords.count()).toBe(0);
  });

  it('every writer rejects a bad period key, a bad fingerprint and a missing family, writing nothing', async () => {
    const fam = await createFamily('Test Family A');
    const calls: [string, () => Promise<unknown>, string][] = [
      ['saveMessage key', () => saveMessage(fam.id, 'W2026-10-13', 'x', FP), 'period-invalid'],
      ['markSent key', () => markSent(fam.id, 'M2026-13', FP), 'period-invalid'],
      ['unmarkSent key', () => unmarkSent(fam.id, 'nope'), 'period-invalid'],
      ['saveMessage fingerprint', () => saveMessage(fam.id, KEY, 'x', 'A1B2C3D4E5F60A'), 'fingerprint-invalid'],
      ['markSent fingerprint', () => markSent(fam.id, KEY, 'abc'), 'fingerprint-invalid'],
      ['saveMessage family', () => saveMessage('missing', KEY, 'x', FP), 'family-missing'],
      ['markSent family', () => markSent('missing', KEY, FP), 'family-missing'],
      ['unmarkSent family', () => unmarkSent('missing', KEY), 'family-missing'],
    ];
    for (const [name, call, code] of calls) await expect(call(), name).rejects.toMatchObject({ code });
    expect(await db.periodRecords.count()).toBe(0);
  });
});

describe('deleteFamily cascade', () => {
  it('removes the family\'s period records only, and a later export still parses', async () => {
    const gone = await createFamily('Test Family Gone');
    const kept = await createFamily('Test Family Kept');
    await saveMessage(gone.id, KEY, 'x', FP);
    await markSent(gone.id, 'M2026-10', FP, 1);
    await saveMessage(kept.id, KEY, 'y', FP);
    expect(await deleteFamily(gone.id)).toEqual({ ok: true });
    expect((await db.periodRecords.toArray()).map((r) => r.familyId)).toEqual([kept.id]);
    const parsed = parseBackup(serializeBackup(await buildBackup(1)));
    expect(parsed.ok).toBe(true);
  });

  it('a family with students is refused and keeps its records', async () => {
    const fam = await createFamily('Test Family A');
    await createStudent({ familyId: fam.id, name: 'Test Student A1' });
    await saveMessage(fam.id, KEY, 'x', FP);
    expect(await deleteFamily(fam.id)).toEqual({ ok: false, reason: 'has-students' });
    expect(await db.periodRecords.count()).toBe(1);
  });
});
