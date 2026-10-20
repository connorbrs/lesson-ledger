import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, restoreBackup } from '../src/data/backup';
import { DB_NAME, db } from '../src/data/db';
import { createFamily } from '../src/data/families';
import { getInstructorName, setInstructorName } from '../src/data/instructor';
import { getPeriodRecord, markSent, saveMessage, unmarkSent } from '../src/data/periodRecords';
import { parseBackup, serializeBackup } from '../src/domain/backup';
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
