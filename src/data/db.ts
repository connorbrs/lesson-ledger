import Dexie, { type EntityTable } from 'dexie';
import type { Family, Session, Student } from '../domain/types';

export const DB_NAME = 'lesson-ledger-v1'; // D-04

interface IdRow {
  id: string;
}

/** The sessions table row. deleteStudent reads `attendees[].studentId`, so renaming either breaks the build. */
export type SessionRow = Session;

export const db = new Dexie(DB_NAME) as Dexie & {
  families: EntityTable<Family, 'id'>;
  students: EntityTable<Student, 'id'>;
  sessions: EntityTable<SessionRow, 'id'>;
  expenses: EntityTable<IdRow, 'id'>; // typed in Phase 3
  attachments: EntityTable<IdRow, 'id'>; // typed in Phase 3
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
