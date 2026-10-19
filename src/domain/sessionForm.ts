import { validateSessionFields, type SessionCheck } from './session';
import type { Attendee, CreditMode, Subject } from './types';

export interface FormCredit {
  lesson: CreditMode;
  activity: CreditMode;
}

export interface FormState {
  /** null means today, so a form left open past midnight still saves today's date. */
  date: string | null;
  startTime: string | null;
  subject: Subject;
  attendees: Attendee[];
  /** Raw text so a half-typed or invalid value stays visible. */
  lesson: string;
  activity: string;
  travel: string;
  credits: Record<string, FormCredit>;
  subjectTouched: boolean;
}

export function blankForm(): FormState {
  return {
    date: null,
    startTime: null,
    subject: 'swim',
    attendees: [],
    lesson: '45',
    activity: '0',
    travel: '0',
    credits: {},
    subjectTouched: false,
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

/** The only path from the form to the repo: normalizes credits, then runs the shared validation. */
export function formToInput(form: FormState, today: string): SessionCheck {
  const families = creditFamilies(form.attendees);
  const choosable = form.subject === 'swim' && families.length === 2;
  const full: FormCredit = { lesson: 'full', activity: 'full' };
  return validateSessionFields({
    date: form.date ?? today,
    startTime: form.startTime,
    subject: form.subject,
    attendees: form.attendees,
    credits: families.map((familyId) => ({ familyId, ...(choosable ? (form.credits[familyId] ?? full) : full) })),
    lessonMinutes: parseMinutes(form.lesson) ?? NaN,
    activityMinutes: parseMinutes(form.activity) ?? NaN,
    travelMinutes: parseMinutes(form.travel) ?? NaN,
  });
}
