/**
 * The one family-summary computation (D-13). Pure: no database, no DOM, no clock, no host locale.
 * The Turkish message, the PDF and the personal totals all read this model.
 */
import { periodRange, type PeriodKind } from './dates';
import { formatHoursTr } from './hours';
import { formatCents } from './money';
import { compareSessions, creditedMinutes } from './session';
import { formatPeriodLabelTr, formatSessionDateTr, SUBJECT_TR } from './turkish';
import type { Expense, Session, Subject } from './types';

export interface SummaryPeriod {
  kind: PeriodKind;
  start: string;
  end: string;
}

export function summaryPeriod(kind: PeriodKind, anchorYmd: string): SummaryPeriod {
  return { kind, ...periodRange(kind, anchorYmd) };
}

export interface SummaryInput {
  familyId: string;
  familyName: string;
  period: SummaryPeriod;
  /** Sessions of any family; the builder keeps this family's sessions inside the period. */
  sessions: Session[];
  /** Expenses of those sessions. */
  expenses: Expense[];
  /** Expense id to ordered photo ids. */
  photoIdsByExpense: ReadonlyMap<string, readonly string[]>;
  /** Student id to name. */
  studentNames: Record<string, string>;
}

export interface SummarySessionLine {
  id: string;
  date: string;
  startTime: string | null;
  subject: Subject;
  /** This family's attendees only, in pick order. */
  studentNames: string[];
  /** Credited whole minutes (D-17). */
  lessonMinutes: number;
  activityMinutes: number;
}

export interface SummaryExpenseLine {
  id: string;
  sessionId: string;
  date: string;
  description: string;
  amountCents: number;
  /** This family's stored split. */
  shareCents: number;
  photoIds: string[];
}

export interface FamilySummary {
  familyId: string;
  familyName: string;
  period: SummaryPeriod;
  sessions: SummarySessionLine[];
  expenses: SummaryExpenseLine[];
  lessonMinutes: number;
  activityMinutes: number;
  expenseCents: number;
  hasReceipts: boolean;
}

const byIdThen = (a: { createdAt: number; id: string }, b: { createdAt: number; id: string }): number =>
  a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Which sessions belong to the family, the credited minutes, the family's expense shares and the totals. Never travel. */
export function buildFamilySummary(input: SummaryInput): FamilySummary {
  const { familyId, period } = input;
  const mine = input.sessions
    .filter((s) => s.date >= period.start && s.date <= period.end && s.attendees.some((a) => a.familyId === familyId))
    .sort(compareSessions);

  const sessions: SummarySessionLine[] = mine.map((s) => {
    const credit = s.credits.find((c) => c.familyId === familyId);
    return {
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      subject: s.subject,
      studentNames: s.attendees.filter((a) => a.familyId === familyId).map((a) => input.studentNames[a.studentId]).filter((n): n is string => Boolean(n)),
      lessonMinutes: creditedMinutes(s.lessonMinutes, credit?.lesson ?? 'full'),
      activityMinutes: creditedMinutes(s.activityMinutes, credit?.activity ?? 'full'),
    };
  });

  const position = new Map(mine.map((s, i) => [s.id, i]));
  const dateOf = new Map(mine.map((s) => [s.id, s.date]));
  const expenses: SummaryExpenseLine[] = input.expenses
    .filter((e) => position.has(e.sessionId))
    .sort((a, b) => (position.get(a.sessionId) as number) - (position.get(b.sessionId) as number) || byIdThen(a, b))
    .map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      date: dateOf.get(e.sessionId) as string,
      description: e.description,
      amountCents: e.amountCents,
      shareCents: e.splits.find((x) => x.familyId === familyId)?.cents ?? 0,
      photoIds: [...(input.photoIdsByExpense.get(e.id) ?? [])],
    }));

  return {
    familyId,
    familyName: input.familyName,
    period,
    sessions,
    expenses,
    lessonMinutes: sessions.reduce((n, s) => n + s.lessonMinutes, 0),
    activityMinutes: sessions.reduce((n, s) => n + s.activityMinutes, 0),
    expenseCents: expenses.reduce((n, e) => n + e.shareCents, 0),
    hasReceipts: expenses.some((e) => e.photoIds.length > 0),
  };
}

/** The Turkish parent message (D-05 to D-07, D-18). Credited time only; never travel, names or another family's data. */
export function renderMessageTr(summary: FamilySummary): string {
  const lines = [`${summary.familyName} ailesi — ${formatPeriodLabelTr(summary.period.kind, summary.period)}`, ''];
  if (summary.sessions.length > 0) {
    for (const s of summary.sessions) {
      lines.push(
        `${formatSessionDateTr(s.date)} · ${SUBJECT_TR[s.subject]} · ders ${formatHoursTr(s.lessonMinutes)}, aktivite ${formatHoursTr(s.activityMinutes)}`,
      );
    }
    lines.push('');
  }
  lines.push(`Toplam ders ${formatHoursTr(summary.lessonMinutes)}`, `Toplam aktivite ${formatHoursTr(summary.activityMinutes)}`);
  if (summary.expenses.length > 0) {
    lines.push(`Masraflar ${formatCents(summary.expenseCents)}${summary.hasReceipts ? " (fişler PDF'te)" : ''}`);
  }
  return lines.join('\n');
}
