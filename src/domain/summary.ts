/**
 * The one family-summary computation (D-13). Pure: no database, no DOM, no clock, no host locale.
 * The Turkish message, the PDF and the personal totals all read this model.
 */
import { isValidYmd, periodRange, rangeLabel, shiftPeriod, type PeriodKind } from './dates';
import { formatHoursTr } from './hours';
import { formatCents } from './money';
import { subjectLabel } from './roster';
import { compareSessions, creditedMinutes } from './session';
import { foldTurkishAscii, formatPeriodLabelTr, formatSessionDateTr, SUBJECT_TR } from './turkish';
import type { Expense, Period, Session, Subject } from './types';

export interface SummaryPeriod {
  kind: PeriodKind;
  start: string;
  end: string;
}

export function summaryPeriod(kind: PeriodKind, anchorYmd: string): SummaryPeriod {
  return { kind, ...periodRange(kind, anchorYmd) };
}

/* ---------- Period keys and the default period (SUM-01) ---------- */

/** 'W2026-10-12' (a week, from its Monday) or 'M2026-10' (a month). */
export function periodKey(p: SummaryPeriod): string {
  return p.kind === 'week' ? `W${p.start}` : `M${p.start.slice(0, 7)}`;
}

/** The strict inverse of periodKey; null for anything else, including a non-Monday week. */
export function parsePeriodKey(key: unknown): SummaryPeriod | null {
  if (typeof key !== 'string') return null;
  const week = /^W(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (week) {
    if (!isValidYmd(week[1])) return null;
    const p = summaryPeriod('week', week[1]);
    return p.start === week[1] ? p : null;
  }
  const month = /^M(\d{4})-(\d{2})$/.exec(key);
  if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12) return summaryPeriod('month', `${month[1]}-${month[2]}-01`);
  return null;
}

/** The complete period before today: the Monday-to-Sunday week before the current week, or the month before the current month. */
export function defaultPeriod(familyPeriod: Period, todayYmd: string): SummaryPeriod {
  const kind: PeriodKind = familyPeriod === 'weekly' ? 'week' : 'month';
  return summaryPeriod(kind, shiftPeriod(kind, todayYmd, -1));
}

export function shiftSummaryPeriod(p: SummaryPeriod, delta: number): SummaryPeriod {
  return summaryPeriod(p.kind, shiftPeriod(p.kind, p.start, delta));
}

export function isDefaultPeriod(p: SummaryPeriod, def: SummaryPeriod): boolean {
  return p.kind === def.kind && p.start === def.start;
}

/** False on the default period, so an incomplete period is never summarized. */
export function canGoNext(p: SummaryPeriod, def: SummaryPeriod): boolean {
  return p.start < def.start;
}

export function periodReturnLabel(kind: PeriodKind): string {
  return kind === 'week' ? 'Last Week' : 'Last Month';
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

/** D-16: an expense without a receipt photo, or a session whose credited lesson and activity are both zero. Never blocks anything. */
export type SummaryWarning =
  | { kind: 'zero-minutes'; id: string; date: string; subject: Subject }
  | { kind: 'no-receipt'; id: string; date: string; description: string; amountCents: number };

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
  warnings: SummaryWarning[];
  /** Change detection for the parent-visible data of this period (D-09, D-15, D-18); not security. */
  fingerprint: string;
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

  const warnings: SummaryWarning[] = [
    ...sessions
      .filter((s) => s.lessonMinutes === 0 && s.activityMinutes === 0)
      .map((s): SummaryWarning => ({ kind: 'zero-minutes', id: s.id, date: s.date, subject: s.subject })),
    ...expenses
      .filter((e) => e.photoIds.length === 0)
      .map((e): SummaryWarning => ({ kind: 'no-receipt', id: e.id, date: e.date, description: e.description, amountCents: e.amountCents })),
  ].sort(compareWarnings);

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
    warnings,
    fingerprint: fingerprintOf(input.familyName, mine, sessions, input.expenses.filter((e) => position.has(e.sessionId)), input.photoIdsByExpense),
  };
}

const KIND_ORDER = { 'zero-minutes': 0, 'no-receipt': 1 } as const;

/** Date, then zero-minutes before no-receipt, then id. */
function compareWarnings(a: SummaryWarning, b: SummaryWarning): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Oct 18". Formats the Date.UTC calendar date, so the host time zone cannot move the day. */
export function formatMonthDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return monthDay.format(new Date(Date.UTC(y, m - 1, d)));
}

/** The English warning row text (app screens stay English). */
export function warningText(w: SummaryWarning): string {
  return w.kind === 'no-receipt'
    ? `No receipt: ${w.description}, ${formatCents(w.amountCents)} (${formatMonthDay(w.date)})`
    : `No lesson or activity minutes: ${subjectLabel(w.subject)}, ${formatMonthDay(w.date)}`;
}

/* ---------- Fingerprint ---------- */

/** cyrb53: a deterministic 53-bit string hash. Change detection only. */
function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Hash of the canonical parent-visible data (nested arrays only, so key order cannot matter): the family name,
 * this family's sessions by id (with the student names as printed in the PDF) and the expenses of those sessions by id
 * with sorted photo ids. No instructor name or message text.
 */
function fingerprintOf(
  familyName: string,
  sessions: readonly Session[],
  lines: readonly SummarySessionLine[],
  expenses: readonly Expense[],
  photoIdsByExpense: ReadonlyMap<string, readonly string[]>,
): string {
  const namesOf = new Map(lines.map((l) => [l.id, l.studentNames]));
  const canonical = [
    familyName,
    [...sessions]
      .sort((a, b) => cmp(a.id, b.id))
      .map((s) => [
        s.id, s.date, s.startTime, s.endTime ?? null, s.subject, s.lessonMinutes, s.activityMinutes, s.travelMinutes,
        s.attendees.map((a) => [a.studentId, a.familyId]),
        s.credits.map((c) => [c.familyId, c.lesson, c.activity]),
        namesOf.get(s.id) ?? [],
      ]),
    [...expenses]
      .sort((a, b) => cmp(a.id, b.id))
      .map((e) => [e.id, e.sessionId, e.description, e.amountCents, e.splits.map((x) => [x.familyId, x.cents]), [...(photoIdsByExpense.get(e.id) ?? [])].sort(cmp)]),
  ];
  return cyrb53(JSON.stringify(canonical)).toString(16).padStart(14, '0');
}

/** A 14-character lowercase hex string, as fingerprintOf produces. */
export function isFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{14}$/.test(value);
}

/* ---------- Screen and row rules ---------- */

export interface ScreenParts {
  empty: boolean;
  showSent: boolean;
  showWarnings: boolean;
  showMessage: boolean;
  showShare: boolean;
}

/** The only rule for what the Family Summary shows: a period with no sessions shows none of the parts. */
export function screenParts(summary: FamilySummary): ScreenParts {
  const empty = summary.sessions.length === 0;
  return { empty, showSent: !empty, showWarnings: !empty && summary.warnings.length > 0, showMessage: !empty, showShare: !empty };
}

/** "Weekly · Oct 12 – 18" or "Monthly · October 2026", ending " · No sessions" when the period has none. */
export function summaryRowSecondLine(familyPeriod: Period, period: SummaryPeriod, hasSessions: boolean, todayYmd: string): string {
  const base = `${familyPeriod === 'weekly' ? 'Weekly' : 'Monthly'} \u00b7 ${rangeLabel(period, period.kind, todayYmd)}`;
  return hasSessions ? base : `${base} \u00b7 No sessions`;
}

/** ASCII-folded family slug, then the period: 'smith-2026-10-12-2026-10-18.pdf' or 'smith-2026-09.pdf'. */
export function pdfFileName(familyName: string, period: SummaryPeriod): string {
  const slug =
    foldTurkishAscii(familyName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'aile';
  return period.kind === 'week' ? `${slug}-${period.start}-${period.end}.pdf` : `${slug}-${period.start.slice(0, 7)}.pdf`;
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
