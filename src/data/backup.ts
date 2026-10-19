import type { Table } from 'dexie';
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, BackupError, type BackupFile } from '../domain/backup';
import { db } from './db';

const LAST_BACKUP_KEY = 'lastBackupAt';

/** Every table except meta. Taken from the schema so a table added later cannot be missed silently. */
const dataTables = (): Table<{ id: string }, string>[] => db.tables.filter((t) => t.name !== 'meta') as Table<{ id: string }, string>[];

/**
 * Reads every data table inside ONE read transaction, so the snapshot is consistent (a session never
 * references a student missing from it). Fails closed if expenses or attachments hold rows: a JSON
 * file cannot carry receipt photos, and dropping them silently would report a false backup.
 */
export async function buildBackup(now: number = Date.now()): Promise<BackupFile> {
  const tables = dataTables();
  const rows = await db.transaction('r', tables, async () => {
    const out: Record<string, { id: string }[]> = {};
    for (const t of tables) out[t.name] = await t.toArray();
    return out;
  });
  if (rows.expenses.length > 0 || rows.attachments.length > 0) throw new BackupError('unsupported-data');
  const byId = <T extends { id: string }>(list: T[]): T[] => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now,
    families: byId(rows.families),
    students: byId(rows.students),
    sessions: byId(rows.sessions),
    expenses: [],
    attachments: [],
  } as unknown as BackupFile;
}

/**
 * Replaces everything with the file's rows in ONE read-write transaction: clear each table, then bulk add
 * (add, not put, so a duplicate id fails loudly). Any error aborts the whole transaction.
 */
export async function restoreBackup(file: BackupFile): Promise<void> {
  const tables = dataTables();
  await db.transaction('rw', [...tables, db.meta], async () => {
    for (const t of tables) {
      await t.clear();
      const rows = (file as unknown as Record<string, { id: string }[]>)[t.name];
      if (rows.length > 0) await t.bulkAdd(rows);
    }
    await db.meta.put({ key: LAST_BACKUP_KEY, value: file.createdAt });
  });
}

export async function readBackupStatus(): Promise<{ sessionCount: number; lastBackupAt: number | null }> {
  const [sessionCount, row] = await Promise.all([db.sessions.count(), db.meta.get(LAST_BACKUP_KEY)]);
  return { sessionCount, lastBackupAt: typeof row?.value === 'number' ? row.value : null };
}

export async function markBackedUp(at: number): Promise<void> {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: at });
}
