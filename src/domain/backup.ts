import { daysBetween, localYmdFromMs } from './dates';
import { validateSessionFields } from './session';
import type { Family, Session, Student } from './types';
import { validateFamilyInput, validateStudentInput } from './validate';

/**
 * The backup file contract (D-09, one-way: backups saved to Files must restore under every later version).
 * schemaVersion 1 is one JSON document. expenses and attachments are always empty in version 1;
 * attachments is the slot reserved for Phase 3 receipt photos, which raises schemaVersion.
 * Sessions carry endTime (D-07): optional on read, since a file from before Finish existed has no endTime key
 * and restores with null; every new export writes it. schemaVersion stays 1.
 */
export const BACKUP_FORMAT = 'lesson-ledger-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 50_000_000;

export type BackupErrorCode = 'unsupported-data';

export class BackupError extends Error {
  constructor(public readonly code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
  }
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  createdAt: number;
  families: Family[];
  students: Student[];
  sessions: Session[];
  expenses: never[];
  attachments: never[];
}

export type BackupFailure = 'not-backup' | 'damaged' | 'newer-version';
export type ParsedBackup = { ok: true; file: BackupFile } | { ok: false; code: BackupFailure };

export const serializeBackup = (file: BackupFile): string => JSON.stringify(file);

const pad = (n: number) => String(n).padStart(2, '0');

/** lesson-ledger-backup-YYYY-MM-DD.json from the local date. */
export const backupFileName = (now: Date = new Date()): string =>
  `${BACKUP_FORMAT}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;

/** "Oct 19, 2026" in the local time zone. */
export const formatBackupDate = (ms: number): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ms));

/* ---------- Parsing: structure and meaning, all before any write ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isArchivedAt = (v: unknown): v is number | null => v === null || isTime(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v !== '';

class Damaged extends Error {}
const need = (ok: boolean): void => {
  if (!ok) throw new Damaged();
};
const arrayOf = (v: unknown): unknown[] => {
  need(Array.isArray(v));
  return v as unknown[];
};
const rowObj = (v: unknown): Record<string, unknown> => {
  need(isObj(v));
  return v as Record<string, unknown>;
};

/** Rebuilds a row from whitelisted fields only, so extra or hostile keys (for example __proto__) never reach storage. */
function parseFamily(raw: unknown): Family {
  const r = rowObj(raw);
  const v = validateFamilyInput(r);
  need(isId(r.id) && v.ok && isArchivedAt(r.archivedAt) && isTime(r.createdAt) && isTime(r.updatedAt));
  return { id: r.id as string, ...(v as { ok: true; value: { name: string; period: Family['period'] } }).value, archivedAt: r.archivedAt as number | null, createdAt: r.createdAt as number, updatedAt: r.updatedAt as number };
}

function parseStudent(raw: unknown): Student {
  const r = rowObj(raw);
  const v = validateStudentInput(r);
  need(isId(r.id) && v.ok && isArchivedAt(r.archivedAt) && isTime(r.createdAt) && isTime(r.updatedAt));
  return { id: r.id as string, ...(v as { ok: true; value: Pick<Student, 'familyId' | 'name' | 'defaultSubject' | 'notes'> }).value, archivedAt: r.archivedAt as number | null, createdAt: r.createdAt as number, updatedAt: r.updatedAt as number };
}

function parseSession(raw: unknown): Session {
  const r = rowObj(raw);
  const attendees = arrayOf(r.attendees).map((a) => {
    const o = isObj(a) ? a : {};
    return { studentId: o.studentId as string, familyId: o.familyId as string };
  });
  const credits = arrayOf(r.credits).map((c) => {
    const o = isObj(c) ? c : {};
    return { familyId: o.familyId as string, lesson: o.lesson as 'full', activity: o.activity as 'full' };
  });
  const endTime = r.endTime === undefined ? null : (r.endTime as string | null);
  const v = validateSessionFields({
    date: r.date as string,
    startTime: r.startTime as string | null,
    endTime,
    subject: r.subject as 'swim',
    attendees,
    credits,
    lessonMinutes: r.lessonMinutes as number,
    activityMinutes: r.activityMinutes as number,
    travelMinutes: r.travelMinutes as number,
  });
  need(isId(r.id) && v.ok && isTime(r.createdAt) && isTime(r.updatedAt));
  return { id: r.id as string, ...(v as { ok: true; value: Omit<Session, 'id' | 'createdAt' | 'updatedAt'> }).value, createdAt: r.createdAt as number, updatedAt: r.updatedAt as number };
}

const uniqueIds = (rows: { id: string }[]): Set<string> => {
  const ids = new Set(rows.map((r) => r.id));
  need(ids.size === rows.length);
  return ids;
};

/**
 * Validates a picked file's text. 'not-backup' for anything that is not a Lesson Ledger backup at all,
 * 'newer-version' for a higher schemaVersion (checked before row validation), 'damaged' for a backup that fails any check.
 */
export function parseBackup(text: string, size: number = text.length): ParsedBackup {
  const notBackup: ParsedBackup = { ok: false, code: 'not-backup' };
  if (size > MAX_BACKUP_BYTES || !text.trimStart().startsWith('{')) return notBackup;
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, code: 'damaged' };
  }
  if (!isObj(doc) || doc.format !== BACKUP_FORMAT) return notBackup;
  const version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, code: 'damaged' };
  if (version > BACKUP_SCHEMA_VERSION) return { ok: false, code: 'newer-version' };
  try {
    need(isTime(doc.createdAt));
    const families = arrayOf(doc.families).map(parseFamily);
    const students = arrayOf(doc.students).map(parseStudent);
    const sessions = arrayOf(doc.sessions).map(parseSession);
    need(arrayOf(doc.expenses).length === 0 && arrayOf(doc.attachments).length === 0);
    const familyIds = uniqueIds(families);
    const studentIds = uniqueIds(students);
    uniqueIds(sessions);
    need(students.every((s) => familyIds.has(s.familyId)));
    need(sessions.every((s) => s.attendees.every((a) => studentIds.has(a.studentId) && familyIds.has(a.familyId))));
    return { ok: true, file: { format: BACKUP_FORMAT, schemaVersion: version, createdAt: doc.createdAt as number, families, students, sessions, expenses: [], attachments: [] } };
  } catch (e) {
    if (e instanceof Damaged) return { ok: false, code: 'damaged' };
    throw e;
  }
}

/* ---------- Day counts and reminder text (local calendar days) ---------- */

const daysSince = (lastMs: number, nowMs: number): number => Math.max(0, daysBetween(localYmdFromMs(lastMs), localYmdFromMs(nowMs)));

/** "Never", "Today", "Yesterday" or "{n} days ago". */
export function daysAgoText(lastBackupAt: number | null, nowMs: number): string {
  if (lastBackupAt === null) return 'Never';
  const n = daysSince(lastBackupAt, nowMs);
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`;
}

export type BackupReminder = { kind: 'hidden' } | { kind: 'quiet'; text: string } | { kind: 'due'; body: string };

export function backupReminder(status: { sessionCount: number; lastBackupAt: number | null }, nowMs: number): BackupReminder {
  if (status.sessionCount === 0) return { kind: 'hidden' };
  if (status.lastBackupAt === null) return { kind: 'due', body: 'No backup yet.' };
  const n = daysSince(status.lastBackupAt, nowMs);
  if (n >= 7) return { kind: 'due', body: `Last backup ${n} days ago.` };
  return { kind: 'quiet', text: `Last backup ${n === 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`}` };
}

/* ---------- Counts ---------- */

const plural = new Intl.PluralRules('en-US');
const noun = (n: number, one: string, other: string) => `${n} ${plural.select(n) === 'one' ? one : other}`;

/** ["1 family", "2 students", "0 sessions"] */
export const countPhrases = (c: { families: number; students: number; sessions: number }): string[] => [
  noun(c.families, 'family', 'families'),
  noun(c.students, 'student', 'students'),
  noun(c.sessions, 'session', 'sessions'),
];

/** "1 family, 2 students and 3 sessions" */
export function countsText(c: { families: number; students: number; sessions: number }): string {
  const [f, s, n] = countPhrases(c);
  return `${f}, ${s} and ${n}`;
}
