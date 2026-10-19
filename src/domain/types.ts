export type Period = 'weekly' | 'monthly';
export type DefaultSubject = 'swim' | 'math' | 'both';

export const NAME_MAX = 60;

export interface Family {
  id: string;
  name: string;
  period: Period;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Student {
  id: string;
  familyId: string;
  name: string;
  defaultSubject: DefaultSubject; // D-06
  notes: string; // D-07: free text, never shown on summaries
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type Subject = 'swim' | 'math';
export type CreditMode = 'full' | 'half';

/** The family is snapshotted at log time so a later student move cannot change what was credited. */
export interface Attendee {
  studentId: string;
  familyId: string;
}

/** One entry per distinct family in a session, so siblings count once. Half is exactly half of the entered minutes. */
export interface FamilyCredit {
  familyId: string;
  lesson: CreditMode;
  activity: CreditMode;
}

/**
 * D-06: local date YYYY-MM-DD, an optional HH:MM start time and an optional HH:MM Finish (endTime);
 * no note field. Rows saved before endTime existed have no endTime key; readers treat that as null.
 */
export interface Session {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  subject: Subject;
  attendees: Attendee[];
  credits: FamilyCredit[];
  lessonMinutes: number;
  activityMinutes: number;
  travelMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export const MINUTES_MAX = 999;

export const EXPENSE_DESCRIPTION_MAX = 80;

/** D-02: one explicit share per family of the session, in cents, stored so a summary never recomputes a split. */
export interface ExpenseSplit {
  familyId: string;
  cents: number;
}

/** D-03: dated by its session (no date field of its own); money is integer cents. */
export interface Expense {
  id: string;
  sessionId: string;
  description: string;
  amountCents: number;
  splits: ExpenseSplit[];
  createdAt: number;
  updatedAt: number;
}
