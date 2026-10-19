import Dexie, { type EntityTable } from 'dexie';
import type { Expense, Family, Session, Student } from '../domain/types';

export const DB_NAME = 'lesson-ledger-v1'; // D-04

/** A receipt photo. The Blob is a downscaled JPEG; width and height are its pixel size. */
export interface AttachmentRow {
  id: string;
  expenseId: string;
  blob: Blob;
  mime: 'image/jpeg';
  width: number;
  height: number;
  createdAt: number;
}

/** The sessions table row. deleteStudent reads `attendees[].studentId`, so renaming either breaks the build. */
export type SessionRow = Session;

export const db = new Dexie(DB_NAME) as Dexie & {
  families: EntityTable<Family, 'id'>;
  students: EntityTable<Student, 'id'>;
  sessions: EntityTable<SessionRow, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  attachments: EntityTable<AttachmentRow, 'id'>;
  meta: EntityTable<{ key: string; value: unknown }, 'key'>;
};

// Never edit version(1) after a real save; add version(2) instead.
// archivedAt and defaultSubject are deliberately not indexed (null/boolean are not valid keys).
db.version(1).stores({
  families: 'id, name',
  students: 'id, familyId',
  sessions: 'id, date, subject',
  expenses: 'id, sessionId',
  attachments: 'id, expenseId',
  meta: 'key',
});

db.on('populate', (tx) => {
  tx.table('meta').add({ key: 'schemaVersion', value: 1 });
});
