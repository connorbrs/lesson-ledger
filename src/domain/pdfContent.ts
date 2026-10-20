/**
 * What the family PDF says (D-10, D-11, D-13). Pure: no PDF library, no database, no DOM.
 * Every string drawn and every layout decision comes from here, so the PDF numbers are built with the same
 * formatters as the Turkish message and cannot drift from it (SUM-06).
 */
import { formatHoursTr } from './hours';
import { formatCents } from './money';
import type { FamilySummary, SummarySessionLine } from './summary';
import { formatPeriodLabelTr, formatSessionDateTr, SUBJECT_TR } from './turkish';

/** One receipt photo as the PDF engine needs it: the stored JPEG bytes and their pixel size. */
export interface PdfPhoto {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** Reads one photo. Injected, so the PDF module never imports the database. */
export type LoadPhoto = (photoId: string) => Promise<PdfPhoto>;

export type PdfBuildErrorCode = 'too-large' | 'photo-unreadable' | 'build-failed';

export class PdfBuildError extends Error {
  readonly code: PdfBuildErrorCode;
  constructor(code: PdfBuildErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PdfBuildError';
    this.code = code;
  }
}

/** Cap on the summed receipt bytes in one PDF (T-04-15). A reversible constant to tune on the device. */
export const MAX_PDF_PHOTO_BYTES = 60_000_000;

/** The exact Turkish labels (UI-SPEC "PDF labels"). */
export const PDF_LABELS = {
  sessions: 'Dersler',
  sessionsContinued: 'Dersler (devam)',
  expenses: 'Masraflar',
  expensesContinued: 'Masraflar (devam)',
  totals: 'Toplam',
  receipts: 'Fişler',
  date: 'Tarih',
  subject: 'Konu',
  students: 'Öğrenci',
  lesson: 'Ders',
  activity: 'Aktivite',
  description: 'Açıklama',
  fullAmount: 'Toplam',
  familyShare: 'Aile payı',
  totalLesson: 'Toplam ders',
  totalActivity: 'Toplam aktivite',
  totalExpenses: 'Masraflar (aile payı)',
} as const;

export const PDF_SUBLINE = 'Ders ve aktivite süreleri. Yolculuk süresi dahil değildir.';

/** "{Instructor} — {Family} ailesi — {Period}"; the instructor part and its dash are left out when the name is blank. */
export function pdfHeaderText(instructorName: string | null | undefined, familyName: string, periodLabel: string): string {
  const name = (instructorName ?? '').trim();
  const rest = `${familyName} ailesi — ${periodLabel}`;
  return name ? `${name} — ${rest}` : rest;
}

/** The Turkish period label of a summary ("12–18 Ekim 2026"). */
export function pdfPeriodLabel(summary: FamilySummary): string {
  return formatPeriodLabelTr(summary.period.kind, summary.period);
}

/** Date, subject, this family's students, credited lesson, credited activity. */
export function sessionRowCells(line: SummarySessionLine): [string, string, string, string, string] {
  return [
    formatSessionDateTr(line.date),
    SUBJECT_TR[line.subject],
    line.studentNames.join(', '),
    formatHoursTr(line.lessonMinutes),
    formatHoursTr(line.activityMinutes),
  ];
}

/** Totals lines; the expenses line only when this family has expenses. */
export function pdfTotalsLines(summary: FamilySummary): string[] {
  const lines = [
    `${PDF_LABELS.totalLesson} ${formatHoursTr(summary.lessonMinutes)}`,
    `${PDF_LABELS.totalActivity} ${formatHoursTr(summary.activityMinutes)}`,
  ];
  if (summary.expenses.length > 0) lines.push(`${PDF_LABELS.totalExpenses} ${formatCents(summary.expenseCents)}`);
  return lines;
}
