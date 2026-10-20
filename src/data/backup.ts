import type { Table } from 'dexie';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BackupError,
  MAX_BACKUP_BYTES,
  type BackupAttachment,
  type BackupFile,
} from '../domain/backup';
import { base64ToBytes, bytesToBase64 } from '../domain/base64';
import { hasJpegMagic } from '../domain/photos';
import { db, type AttachmentRow } from './db';
import { INSTRUCTOR_KEY } from './instructor';

const LAST_BACKUP_KEY = 'lastBackupAt';

/** Every table except meta. Taken from the schema so a table added later cannot be missed silently. */
const dataTables = (): Table<{ id: string }, string>[] => db.tables.filter((t) => t.name !== 'meta') as Table<{ id: string }, string>[];

/**
 * Reads every data table (including attachments) inside ONE read transaction, so the snapshot is consistent
 * (a session never references a student missing from it, a photo never points at a missing expense). Photos are
 * encoded only afterwards, one at a time. Refuses with BackupError('too-large') BEFORE encoding anything when the
 * projected base64 size of the photos is over maxBytes, so the app never writes a file restore would refuse (D-08).
 */
export async function buildBackup(now: number = Date.now(), maxBytes: number = MAX_BACKUP_BYTES): Promise<BackupFile> {
  const tables = dataTables();
  // The instructor name is in meta; reading it in the same transaction keeps it consistent with the rows.
  const { rows, name } = await db.transaction('r', [...tables, db.meta], async () => {
    const out: Record<string, unknown[]> = {};
    for (const t of tables) out[t.name] = await t.toArray();
    const stored = (await db.meta.get(INSTRUCTOR_KEY))?.value;
    return { rows: out, name: typeof stored === 'string' && stored !== '' ? stored : null };
  });
  const byId = <T extends { id: string }>(list: T[]): T[] => [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const photos = byId(rows.attachments as AttachmentRow[]);
  const photoBytes = photos.reduce((sum, p) => sum + p.blob.size, 0);
  if (Math.ceil(photoBytes / 3) * 4 > maxBytes) throw new BackupError('too-large');
  const attachments: BackupAttachment[] = [];
  for (const p of photos) {
    const data = bytesToBase64(new Uint8Array(await p.blob.arrayBuffer()));
    attachments.push({ id: p.id, expenseId: p.expenseId, mime: p.mime, width: p.width, height: p.height, createdAt: p.createdAt, data });
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now,
    families: byId(rows.families as BackupFile['families']),
    students: byId(rows.students as BackupFile['students']),
    sessions: byId(rows.sessions as BackupFile['sessions']),
    expenses: byId(rows.expenses as BackupFile['expenses']),
    attachments,
    periodRecords: byId(rows.periodRecords as BackupFile['periodRecords']),
    instructorName: name,
  };
}

/**
 * Replaces everything with the file's rows in ONE read-write transaction: clear each table, then bulk add
 * (add, not put, so a duplicate id fails loudly). Every photo is decoded to a Blob first, outside the transaction,
 * so an undecodable entry throws BackupError('invalid-photo') with nothing written. Any error aborts the whole
 * transaction, receipts included (WR-02).
 */
export async function restoreBackup(file: BackupFile): Promise<void> {
  const tables = dataTables();
  const photos: AttachmentRow[] = file.attachments.map((a) => {
    const bytes = base64ToBytes(a.data);
    if (!bytes || !hasJpegMagic(bytes)) throw new BackupError('invalid-photo');
    return { id: a.id, expenseId: a.expenseId, blob: new Blob([bytes as BlobPart], { type: 'image/jpeg' }), mime: 'image/jpeg', width: a.width, height: a.height, createdAt: a.createdAt };
  });
  const sources: Record<string, { id: string }[]> = {
    families: file.families,
    students: file.students,
    sessions: file.sessions,
    expenses: file.expenses,
    attachments: photos,
    periodRecords: file.periodRecords,
  };
  // A table added later with no source here must fail before anything is cleared.
  for (const t of tables) if (!sources[t.name]) throw new Error(`No backup source for table ${t.name}`);
  await db.transaction('rw', [...tables, db.meta], async () => {
    for (const t of tables) {
      await t.clear();
      const rows = sources[t.name];
      if (rows.length > 0) await t.bulkAdd(rows);
    }
    // The instructor name replaces the stored one; a file without a name clears it.
    if (file.instructorName === null) await db.meta.delete(INSTRUCTOR_KEY);
    else await db.meta.put({ key: INSTRUCTOR_KEY, value: file.instructorName });
    // A backup made on a phone whose clock ran ahead must not store a future time: the reminder would stay silent.
    await db.meta.put({ key: LAST_BACKUP_KEY, value: Math.min(file.createdAt, Date.now()) });
  });
}

export async function readBackupStatus(): Promise<{ sessionCount: number; lastBackupAt: number | null }> {
  const [sessionCount, row] = await Promise.all([db.sessions.count(), db.meta.get(LAST_BACKUP_KEY)]);
  return { sessionCount, lastBackupAt: typeof row?.value === 'number' ? row.value : null };
}

export async function markBackedUp(at: number): Promise<void> {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: at });
}
