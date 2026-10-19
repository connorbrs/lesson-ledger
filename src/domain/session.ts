import { formatTime12, isValidTime, isValidYmd } from './dates';
import { formatHours } from './hours';
import { MINUTES_MAX, type Attendee, type CreditMode, type FamilyCredit, type Session, type Subject } from './types';

export type SessionErrorCode =
  | 'date-invalid'
  | 'time-invalid'
  | 'subject-invalid'
  | 'students-invalid'
  | 'minutes-invalid'
  | 'credits-invalid'
  | 'student-missing'
  | 'not-found';

export class SessionError extends Error {
  constructor(public readonly code: SessionErrorCode) {
    super(code);
    this.name = 'SessionError';
  }
}

/** Everything the user enters for a session (the stored row minus id and timestamps). */
export interface SessionFields {
  date: string;
  startTime: string | null;
  subject: Subject;
  attendees: Attendee[];
  credits: FamilyCredit[];
  lessonMinutes: number;
  activityMinutes: number;
  travelMinutes: number;
}

export type SessionCheck = { ok: true; value: SessionFields } | { ok: false; code: SessionErrorCode };

const isMinutes = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MINUTES_MAX;
const isMode = (m: unknown): m is CreditMode => m === 'full' || m === 'half';
const isId = (s: unknown): s is string => typeof s === 'string' && s.length > 0;

export function validateSessionFields(input: SessionFields): SessionCheck {
  const fail = (code: SessionErrorCode): SessionCheck => ({ ok: false, code });
  if (!isValidYmd(input.date)) return fail('date-invalid');
  if (input.startTime !== null && !isValidTime(input.startTime)) return fail('time-invalid');
  if (input.subject !== 'swim' && input.subject !== 'math') return fail('subject-invalid');

  const { attendees } = input;
  if (!Array.isArray(attendees) || !attendees.every((a) => a && isId(a.studentId) && isId(a.familyId))) return fail('students-invalid');
  if (new Set(attendees.map((a) => a.studentId)).size !== attendees.length) return fail('students-invalid');
  const count = attendees.length;
  if (input.subject === 'math' ? count !== 1 : count < 1 || count > 2) return fail('students-invalid');

  if (!isMinutes(input.lessonMinutes) || !isMinutes(input.activityMinutes) || !isMinutes(input.travelMinutes)) return fail('minutes-invalid');

  const families = new Set(attendees.map((a) => a.familyId));
  const { credits } = input;
  if (!Array.isArray(credits) || credits.length !== families.size) return fail('credits-invalid');
  const seen = new Set<string>();
  const halfAllowed = input.subject === 'swim' && families.size === 2;
  for (const c of credits) {
    if (!c || !families.has(c.familyId) || seen.has(c.familyId)) return fail('credits-invalid');
    seen.add(c.familyId);
    if (!isMode(c.lesson) || !isMode(c.activity)) return fail('credits-invalid');
    if (!halfAllowed && (c.lesson !== 'full' || c.activity !== 'full')) return fail('credits-invalid');
  }
  return { ok: true, value: input };
}

/** Half is exactly half: 45 gives 22.5, 1 gives 0.5. Never rounded. */
export function creditedMinutes(minutes: number, mode: CreditMode): number {
  return mode === 'half' ? minutes / 2 : minutes;
}

/** Within a day: start time ascending, untimed last; ties and untimed sessions in logging order (createdAt, then id). */
function compareSessions(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.startTime !== b.startTime) {
    if (a.startTime === null) return 1;
    if (b.startTime === null) return -1;
    return a.startTime < b.startTime ? -1 : 1;
  }
  return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export interface DayGroup {
  date: string;
  sessions: Session[];
}

/** Days in ascending order, each with its sessions in day order. */
export function groupSessionsByDate(sessions: Session[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const s of [...sessions].sort(compareSessions)) {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.sessions.push(s);
    else groups.push({ date: s.date, sessions: [s] });
  }
  return groups;
}

export interface SessionRowText {
  names: string;
  meta: string;
  lesson: string;
  activity: string;
}

const SUBJECT_LABEL: Record<Subject, string> = { swim: 'Swim', math: 'Math' };

/** Compact row copy. Travel and credited minutes never appear here (D-08). */
export function sessionRowText(s: Session, nameById: Record<string, string>): SessionRowText {
  const amount = (label: string, minutes: number) => (minutes === 0 ? `${label} none` : `${label} ${formatHours(minutes)}`);
  return {
    names: s.attendees.map((a) => nameById[a.studentId]).filter(Boolean).join(', '),
    meta: s.startTime ? `${SUBJECT_LABEL[s.subject]} · ${formatTime12(s.startTime)}` : SUBJECT_LABEL[s.subject],
    lesson: amount('Lesson', s.lessonMinutes),
    activity: amount('Activity', s.activityMinutes),
  };
}
