import { currentHHMM, minutesToTime, timeToMinutes } from './dates';
import { type ExpenseDraft } from './expense';
import { validateSessionFields, type SessionCheck } from './session';
import type { Attendee, CreditMode, DefaultSubject, Session, Student, Subject } from './types';

export interface FormCredit {
  lesson: CreditMode;
  activity: CreditMode;
}

/** D-05: Duration is 45 minutes when there is no previous session. */
const DEFAULT_DURATION = 45;

export interface FormState {
  /** null means today, so a form left open past midnight still saves today's date. */
  date: string | null;
  /** Start as HH:MM, or null. Clearing Start clears Finish too. */
  startTime: string | null;
  /** Finish as HH:MM. Null when there is no Start, or when Start plus Duration passes midnight (D-02). */
  endTime: string | null;
  subject: Subject;
  attendees: Attendee[];
  /** Whole minutes of Lesson plus Activity (D-03). Lesson is derived from it, never typed. */
  duration: number;
  /** Raw text so a half-typed or invalid value stays visible. */
  activity: string;
  travel: string;
  credits: Record<string, FormCredit>;
  subjectTouched: boolean;
  /** Drafts are JSON-safe (ids, strings, integers), so sameForm sees any change to them. */
  expenses: ExpenseDraft[];
}

/** Start plus minutes as HH:MM, or null when the result passes midnight. */
const finishFrom = (start: string, minutes: number): string | null => minutesToTime(timeToMinutes(start) + minutes);

/**
 * Finish is now (to the minute) and Start is Finish minus minutes. Start clamps at 00:00 and Duration
 * shrinks with it, so Start plus Duration still equals Finish.
 */
function startingTimes(now: string, minutes: number): Pick<FormState, 'startTime' | 'endTime' | 'duration'> {
  const finish = timeToMinutes(now);
  const start = Math.max(0, finish - minutes);
  return { startTime: minutesToTime(start) as string, endTime: now, duration: finish - start };
}

export function blankForm(now: string = currentHHMM()): FormState {
  return {
    date: null,
    ...startingTimes(now, DEFAULT_DURATION),
    subject: 'swim',
    attendees: [],
    activity: '0',
    travel: '0',
    credits: {},
    subjectTouched: false,
    expenses: [],
  };
}

/** Whole minutes 0 to 999 from 1 to 3 digits (surrounding spaces ignored), else null. */
export function parseMinutes(text: string): number | null {
  const t = text.trim();
  return /^\d{1,3}$/.test(t) ? Number(t) : null;
}

/** Swim toggles and ignores a third student; math replaces the selection (LOG-03, LOG-04). */
export function togglePick(subject: Subject, attendees: Attendee[], student: Attendee): Attendee[] {
  if (attendees.some((a) => a.studentId === student.studentId)) return attendees.filter((a) => a.studentId !== student.studentId);
  if (subject === 'math') return [student];
  return attendees.length >= 2 ? attendees : [...attendees, student];
}

/** One family per distinct family among the attendees, in pick order. */
export function creditFamilies(attendees: Attendee[]): string[] {
  return [...new Set(attendees.map((a) => a.familyId))];
}

/** Swim with students from two different families: the only case where credit is chosen (LOG-05). */
export function needsCreditGroups(subject: Subject, attendees: Attendee[]): boolean {
  return subject === 'swim' && creditFamilies(attendees).length === 2;
}

function pruneCredits(credits: Record<string, FormCredit>, attendees: Attendee[]): Record<string, FormCredit> {
  const keep = new Set(creditFamilies(attendees));
  return Object.fromEntries(Object.entries(credits).filter(([familyId]) => keep.has(familyId)));
}

/** Math keeps only the first picked student; touching the subject stops the default-subject suggestion. */
export function changeSubject(form: FormState, subject: Subject): FormState {
  const attendees = subject === 'math' ? form.attendees.slice(0, 1) : form.attendees;
  return { ...form, subject, attendees, credits: pruneCredits(form.credits, attendees), subjectTouched: true };
}

/**
 * Apply a new picker selection. The first student picked on an untouched form suggests their
 * Default Subject (Both becomes Swim); credits of families that left the selection are dropped.
 */
export function setAttendees(form: FormState, attendees: Attendee[], pickedDefault?: DefaultSubject): FormState {
  const suggest = form.attendees.length === 0 && attendees.length === 1 && !form.subjectTouched && pickedDefault !== undefined;
  const subject: Subject = suggest ? (pickedDefault === 'math' ? 'math' : 'swim') : form.subject;
  return { ...form, subject, attendees, credits: pruneCredits(form.credits, attendees) };
}

/** The only path from the form to the repo: normalizes credits, then runs the shared validation. */
export function formToInput(form: FormState, today: string): SessionCheck {
  if (form.startTime !== null && form.endTime === null) return { ok: false, code: 'time-invalid' };
  const families = creditFamilies(form.attendees);
  const choosable = form.subject === 'swim' && families.length === 2;
  const full: FormCredit = { lesson: 'full', activity: 'full' };
  return validateSessionFields({
    date: form.date ?? today,
    startTime: form.startTime,
    endTime: form.endTime,
    subject: form.subject,
    attendees: form.attendees,
    credits: families.map((familyId) => ({ familyId, ...(choosable ? (form.credits[familyId] ?? full) : full) })),
    lessonMinutes: lessonMinutesOf(form) ?? NaN,
    activityMinutes: parseMinutes(form.activity) ?? NaN,
    travelMinutes: parseMinutes(form.travel) ?? NaN,
  });
}

/**
 * D-02: the next form starts from the last session (subject, minutes, and the students who are still
 * active, with their current family). Date and start time reset, credit resets to Full, and the
 * subject counts as chosen so a picked student's Default Subject does not override it.
 */
export function prefillFromSession(last: Session, activeStudents: Student[], now: string = currentHHMM()): FormState {
  const byId = new Map(activeStudents.map((s) => [s.id, s]));
  const attendees: Attendee[] = [];
  for (const a of last.attendees) {
    const student = byId.get(a.studentId);
    if (student) attendees.push({ studentId: student.id, familyId: student.familyId });
  }
  return {
    date: null,
    ...startingTimes(now, last.lessonMinutes + last.activityMinutes),
    subject: last.subject,
    attendees,
    activity: String(last.activityMinutes),
    travel: String(last.travelMinutes),
    credits: {},
    subjectTouched: true,
    expenses: [],
  };
}

/** The form an existing session opens with: stored values, stored family snapshots, stored credit modes. */
export function formFromSession(s: Session, expenses: ExpenseDraft[] = []): FormState {
  const duration = s.lessonMinutes + s.activityMinutes;
  // A row saved before Finish existed has no endTime; its Finish is Start plus Duration.
  const endTime = s.startTime === null ? null : (s.endTime ?? finishFrom(s.startTime, duration));
  return {
    date: s.date,
    startTime: s.startTime,
    endTime,
    subject: s.subject,
    attendees: s.attendees.map((a) => ({ ...a })),
    duration,
    activity: String(s.activityMinutes),
    travel: String(s.travelMinutes),
    credits: Object.fromEntries(s.credits.map((c) => [c.familyId, { lesson: c.lesson, activity: c.activity }])),
    subjectTouched: true,
    expenses,
  };
}

/** Replace the draft with the same id in place, else append. */
export function upsertExpense(form: FormState, draft: ExpenseDraft): FormState {
  const found = form.expenses.some((e) => e.id === draft.id);
  return { ...form, expenses: found ? form.expenses.map((e) => (e.id === draft.id ? draft : e)) : [...form.expenses, draft] };
}

export function removeExpense(form: FormState, id: string): FormState {
  return { ...form, expenses: form.expenses.filter((e) => e.id !== id) };
}

/** D-02: Start keeps Duration and moves Finish. Clearing Start clears Finish too. */
export function setStartTime(form: FormState, startTime: string | null): FormState {
  if (startTime === null) return { ...form, startTime: null, endTime: null };
  return { ...form, startTime, endTime: finishFrom(startTime, form.duration) };
}

/**
 * D-02: Finish sets Duration from Start. A Finish before Start is kept as typed, so its caption can show,
 * and Duration stays put. With no Start there is no Finish to set.
 */
export function setFinishTime(form: FormState, endTime: string): FormState {
  if (form.startTime === null) return form;
  const span = timeToMinutes(endTime) - timeToMinutes(form.startTime);
  return span < 0 ? { ...form, endTime } : { ...form, endTime, duration: span };
}

/** D-02: Duration moves Finish from Start. With no Start, only Duration changes. */
/** Duration typed as plain minutes: '' is 0; anything but 1–3 digits (so above 999) is null and refused. */
export function parseTypedDuration(text: string): number | null {
  const t = text.trim();
  if (t === '') return 0;
  return /^\d{1,3}$/.test(t) ? Number(t) : null;
}

export function setDuration(form: FormState, duration: number): FormState {
  // Whole minutes 0–999, the same range as the other minute fields; anything else is ignored.
  if (!Number.isInteger(duration) || duration < 0 || duration > 999) return form;
  if (form.startTime === null) return { ...form, duration };
  return { ...form, duration, endTime: finishFrom(form.startTime, duration) };
}

/** D-03: Lesson is Duration minus Activity, or null when Activity does not parse or exceeds Duration. */
export function lessonMinutesOf(form: FormState): number | null {
  const activity = parseMinutes(form.activity);
  if (activity === null) return null;
  const lesson = form.duration - activity;
  return lesson < 0 ? null : lesson;
}

export interface TimeCaption {
  row: 'finish' | 'activity';
  text: string;
}

/** The one caption to show under Finish or Activity, Finish checked first; null when the times and minutes agree. */
export function timeCaption(form: FormState): TimeCaption | null {
  if (form.startTime !== null && form.endTime === null) return { row: 'finish', text: "Session can't run past midnight." };
  if (form.startTime !== null && form.endTime !== null && form.endTime < form.startTime) {
    return { row: 'finish', text: "Finish can't be before Start." };
  }
  const activity = parseMinutes(form.activity);
  if (activity !== null && activity > form.duration) return { row: 'activity', text: "Activity can't be longer than Duration." };
  return null;
}

/** True when two forms hold the same values; the order students were picked in does not count. */
export function sameForm(a: FormState, b: FormState): boolean {
  const norm = (f: FormState) =>
    JSON.stringify({ ...f, attendees: [...f.attendees].sort((x, y) => (x.studentId < y.studentId ? -1 : x.studentId > y.studentId ? 1 : 0)) });
  return norm(a) === norm(b);
}
