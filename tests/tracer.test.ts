import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { createFamily, listActiveFamilies } from '../src/data/families';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('tracer: family create and list', () => {
  it('opens lesson-ledger-v1 with all six tables and meta schemaVersion 1', async () => {
    expect(db.name).toBe('lesson-ledger-v1');
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'attachments',
      'expenses',
      'families',
      'meta',
      'sessions',
      'students',
    ]);
    expect(await db.meta.get('schemaVersion')).toEqual({ key: 'schemaVersion', value: 1 });
  });

  it('creates a trimmed family and lists it', async () => {
    const family = await createFamily('  Test Family A  ');
    expect(family.name).toBe('Test Family A');
    expect(family.period).toBe('weekly');
    expect(family.archivedAt).toBeNull();
    expect(family.id).toHaveLength(36);
    expect(await listActiveFamilies()).toEqual([family]);
  });

  it('rejects a whitespace-only name and stores nothing', async () => {
    await expect(createFamily('   ')).rejects.toThrow('name-empty');
    expect(await listActiveFamilies()).toEqual([]);
  });

  it('still lists the family after the database is closed and reopened', async () => {
    const family = await createFamily('Test Family B');
    db.close();
    await db.open();
    expect(await listActiveFamilies()).toEqual([family]);
  });
});
