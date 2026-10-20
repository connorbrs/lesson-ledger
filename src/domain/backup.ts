import { base64DecodedLength, base64ToBytes, isBase64 } from './base64';
import { daysBetween, localYmdFromMs } from './dates';
import { validateExpenseText } from './expense';
import { recordId, validateMessage } from './periodRecord';
import { MAX_PHOTO_DIMENSION, MAX_STORED_PHOTO_BYTES, hasJpegMagic } from './photos';
import { validateSessionFields } from './session';
import { isFingerprint, parsePeriodKey } from './summary';
import type { Expense, ExpenseSplit, Family, PeriodRecord, Session, Student } from './types';
import { validateFamilyInput, validateInstructorName, validateStudentInput } from './validate';

/**
 * The backup file contract (D-06, one-way: backups saved to Files must restore under every later version).
 * One JSON document, no zip. schemaVersion 2 adds the receipts: expenses (the stored rows) and attachments, each
 * {id, expenseId, mime 'image/jpeg', width, height, createdAt, data} where data is the standard base64 of the JPEG bytes.
 * schemaVersion 1 files (expenses and attachments always empty) are read forever and restore with no receipts.
 * schemaVersion 3 adds periodRecords (the saved message and sent mark per family and period) and instructorName
 * (a non-blank string or null), both required. Version 1 and 2 files are read forever: they must carry neither
 * (absent, empty or null) and parse to periodRecords [] and instructorName null; restoring one clears both on this phone.
 * Sessions carry endTime (D-07 of Phase 2): optional on read, since a file from before Finish existed has no endTime key
 * and restores with null; every new export writes it.
 * Any change from here needs a migration reader for version 3.
 */
export const BACKUP_FORMAT = 'lesson-ledger-backup';
export const BACKUP_SCHEMA_VERSION = 3;
/** D-08: the cap on a backup file (150 MB). Export refuses above it and restore treats a larger file as not a backup. */
export const MAX_BACKUP_BYTES = 150_000_000;
export const BACKUP_TOO_LARGE_MESSAGE = `This backup is too large to save (over ${MAX_BACKUP_BYTES / 1_000_000} MB).`;

export type BackupErrorCode = 'too-large' | 'invalid-photo';

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
  expenses: Expense[];
  attachments: BackupAttachment[];
  periodRecords: PeriodRecord[];
  instructorName: string | null;
}

export interface BackupAttachment {
  id: string;
  expenseId: string;
  mime: 'image/jpeg';
  width: number;
  height: number;
  createdAt: number;
  /** Standard base64 of the JPEG bytes. */
  data: string;
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
/** Row ids are UUIDs in practice; the narrow charset and length keep hostile keys such as __proto__ out of the data. */
const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) && v !== '__proto__';

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

/** The expense row, rebuilt from whitelisted fields; its shares must be exactly the session's attendee families and sum to the amount. */
function parseExpense(raw: unknown, sessions: Map<string, Session>): Expense {
  const r = rowObj(raw);
  const text = validateExpenseText(r.description);
  const session = isId(r.sessionId) ? sessions.get(r.sessionId) : undefined;
  need(isId(r.id) && session !== undefined && text.ok);
  need(Number.isSafeInteger(r.amountCents) && (r.amountCents as number) > 0);
  need(isTime(r.createdAt) && isTime(r.updatedAt));
  const amountCents = r.amountCents as number;
  const splits: ExpenseSplit[] = arrayOf(r.splits).map((entry) => {
    const o = rowObj(entry);
    need(isId(o.familyId) && Number.isSafeInteger(o.cents) && (o.cents as number) >= 0);
    return { familyId: o.familyId as string, cents: o.cents as number };
  });
  const shareFamilies = new Set(splits.map((x) => x.familyId));
  const sessionFamilies = new Set(session!.attendees.map((a) => a.familyId));
  need(splits.length > 0 && shareFamilies.size === splits.length);
  need(shareFamilies.size === sessionFamilies.size && [...shareFamilies].every((f) => sessionFamilies.has(f)));
  let total = 0;
  for (const x of splits) {
    total += x.cents;
    need(total <= amountCents);
  }
  need(total === amountCents);
  return {
    id: r.id as string,
    sessionId: r.sessionId as string,
    description: (text as { ok: true; value: string }).value,
    amountCents,
    splits,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
  };
}

/** Longest base64 text that could still decode within the per-photo cap; judged on length before any character scan. */
const MAX_PHOTO_BASE64_LENGTH = Math.ceil(MAX_STORED_PHOTO_BYTES / 3) * 4;
const isDimension = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) <= MAX_PHOTO_DIMENSION;

function parseAttachment(raw: unknown, expenseIds: Set<string>): BackupAttachment {
  const r = rowObj(raw);
  need(isId(r.id) && isId(r.expenseId) && expenseIds.has(r.expenseId) && r.mime === 'image/jpeg');
  need(isDimension(r.width) && isDimension(r.height) && isTime(r.createdAt));
  const data = r.data;
  need(typeof data === 'string' && data.length <= MAX_PHOTO_BASE64_LENGTH && isBase64(data));
  const head = base64ToBytes((data as string).slice(0, 4));
  need(head !== null && hasJpegMagic(head) && base64DecodedLength(data as string) <= MAX_STORED_PHOTO_BYTES);
  return { id: r.id as string, expenseId: r.expenseId as string, mime: 'image/jpeg', width: r.width as number, height: r.height as number, createdAt: r.createdAt as number, data: data as string };
}

/** The saved message and sent mark, rebuilt from whitelisted fields. Its id must equal `${familyId}_${periodKey}`. */
function parsePeriodRecord(raw: unknown, familyIds: Set<string>): PeriodRecord {
  const r = rowObj(raw);
  need(isId(r.id) && isId(r.familyId) && familyIds.has(r.familyId) && parsePeriodKey(r.periodKey) !== null);
  need(r.id === recordId(r.familyId as string, r.periodKey as string));
  need(isTime(r.updatedAt));
  const hasMessage = r.message !== null;
  need((r.messageFingerprint !== null) === hasMessage && (r.messageSavedAt !== null) === hasMessage);
  if (hasMessage) need(validateMessage(r.message).ok && isFingerprint(r.messageFingerprint) && isTime(r.messageSavedAt));
  const hasSent = r.sentAt !== null;
  need((r.sentFingerprint !== null) === hasSent);
  if (hasSent) need(isTime(r.sentAt) && isFingerprint(r.sentFingerprint));
  need(hasMessage || hasSent);
  return {
    id: r.id as string,
    familyId: r.familyId as string,
    periodKey: r.periodKey as string,
    message: hasMessage ? (r.message as string) : null,
    messageFingerprint: hasMessage ? (r.messageFingerprint as string) : null,
    messageSavedAt: hasMessage ? (r.messageSavedAt as number) : null,
    sentAt: hasSent ? (r.sentAt as number) : null,
    sentFingerprint: hasSent ? (r.sentFingerprint as string) : null,
    updatedAt: r.updatedAt as number,
  };
}

/** A non-blank name that validateInstructorName accepts, stored normalized. */
function parseInstructorName(raw: unknown): string {
  need(typeof raw === 'string');
  const v = validateInstructorName(raw);
  need(v.ok && v.value !== null);
  return (v as { ok: true; value: string }).value;
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
    const familyIds = uniqueIds(families);
    const studentIds = uniqueIds(students);
    uniqueIds(sessions);
    need(students.every((s) => familyIds.has(s.familyId)));
    need(sessions.every((s) => s.attendees.every((a) => studentIds.has(a.studentId) && familyIds.has(a.familyId))));
    let expenses: Expense[] = [];
    let attachments: BackupAttachment[] = [];
    if (version === 1) {
      // A version 1 file never carried receipts; either array holding rows means it was altered.
      need(arrayOf(doc.expenses).length === 0 && arrayOf(doc.attachments).length === 0);
    } else {
      const sessionsById = new Map(sessions.map((s) => [s.id, s]));
      expenses = arrayOf(doc.expenses).map((e) => parseExpense(e, sessionsById));
      const expenseIds = uniqueIds(expenses);
      attachments = arrayOf(doc.attachments).map((a) => parseAttachment(a, expenseIds));
      uniqueIds(attachments);
    }
    let periodRecords: PeriodRecord[] = [];
    let instructorName: string | null = null;
    if (version >= 3) {
      periodRecords = arrayOf(doc.periodRecords).map((p) => parsePeriodRecord(p, familyIds));
      uniqueIds(periodRecords);
      need('instructorName' in doc);
      instructorName = doc.instructorName === null ? null : parseInstructorName(doc.instructorName);
    } else {
      // Older files never carried either; anything there means the file was altered.
      need(doc.periodRecords === undefined || (Array.isArray(doc.periodRecords) && doc.periodRecords.length === 0));
      need(doc.instructorName === undefined || doc.instructorName === null);
    }
    return { ok: true, file: { format: BACKUP_FORMAT, schemaVersion: version, createdAt: doc.createdAt as number, families, students, sessions, expenses, attachments, periodRecords, instructorName } };
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

/* ---------- Restore failure classification ---------- */

/** The restore screen's alert for a failed restore: an undecodable photo is a damaged file; anything else is null (the generic failure line). */
export function restoreFailureFor(error: unknown): BackupFailure | null {
  return error instanceof BackupError && error.code === 'invalid-photo' ? 'damaged' : null;
}

/* ---------- Counts ---------- */

const plural = new Intl.PluralRules('en-US');
const noun = (n: number, one: string, other: string) => `${n} ${plural.select(n) === 'one' ? one : other}`;

interface Counts {
  families: number;
  students: number;
  sessions: number;
  expenses?: number;
  photos?: number;
}

/** ["1 family", "2 students", "0 sessions"], plus "N expenses" and "N receipt photos" when those counts are given. */
export const countPhrases = (c: Counts): string[] => [
  noun(c.families, 'family', 'families'),
  noun(c.students, 'student', 'students'),
  noun(c.sessions, 'session', 'sessions'),
  ...(c.expenses === undefined ? [] : [noun(c.expenses, 'expense', 'expenses')]),
  ...(c.photos === undefined ? [] : [noun(c.photos, 'receipt photo', 'receipt photos')]),
];

/** "1 family, 2 students and 3 sessions" */
export function countsText(c: Counts): string {
  const parts = countPhrases(c);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
