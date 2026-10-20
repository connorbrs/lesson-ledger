/**
 * What the family PDF says (D-10, D-11, D-13). Pure: no PDF library, no database, no DOM.
 * Every string drawn and every layout decision comes from here, so the PDF numbers are built with the same
 * formatters as the Turkish message and cannot drift from it (SUM-06).
 */
import { formatHoursTr } from './hours';
import { formatCents } from './money';
import type { FamilySummary, SummaryExpenseLine, SummarySessionLine } from './summary';
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

/* ---------- Expenses, receipts and page footer ---------- */

/** Date, description, full amount, this family's share. */
export function expenseRowCells(line: SummaryExpenseLine): [string, string, string, string] {
  return [formatSessionDateTr(line.date), line.description, formatCents(line.amountCents), formatCents(line.shareCents)];
}

/** "{Family} ailesi — {Period} · Sayfa {n} / {N}". */
export function pdfPageFooter(familyName: string, periodLabel: string, page: number, pageCount: number): string {
  return `${familyName} ailesi — ${periodLabel} · Sayfa ${page} / ${pageCount}`;
}

/** "{description} — {full amount}", plus " ({k}/{n})" only when the expense has more than one photo. */
export function receiptCaption(description: string, amountCents: number, k: number, n: number): string {
  return `${description} — ${formatCents(amountCents)}${n > 1 ? ` (${k}/${n})` : ''}`;
}

export interface ReceiptSlot {
  expenseId: string;
  photoId: string;
  caption: string;
  /** True for exactly one slot in a plan: the first (the "Fişler" heading is on the first receipt page only). */
  showHeading: boolean;
}

/** Receipt photos in expense order then photo order, two slots per page. No photos gives no pages (D-12). */
export function planReceiptPages(summary: FamilySummary): ReceiptSlot[][] {
  const slots: ReceiptSlot[] = [];
  for (const e of summary.expenses) {
    e.photoIds.forEach((photoId, i) => {
      slots.push({ expenseId: e.id, photoId, caption: receiptCaption(e.description, e.amountCents, i + 1, e.photoIds.length), showHeading: slots.length === 0 });
    });
  }
  const pages: ReceiptSlot[][] = [];
  for (let i = 0; i < slots.length; i += 2) pages.push(slots.slice(i, i + 2));
  return pages;
}

export interface FitBox {
  /** Offsets inside the box. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Contain-fit: the largest size with the photo's aspect ratio that fits the box (never beyond it), centred. */
export function containFit(width: number, height: number, boxWidth: number, boxHeight: number): FitBox {
  if (!(width > 0) || !(height > 0)) return { x: 0, y: 0, width: boxWidth, height: boxHeight };
  const scale = Math.min(boxWidth / width, boxHeight / height);
  const w = width * scale;
  const h = height * scale;
  return { x: (boxWidth - w) / 2, y: (boxHeight - h) / 2, width: w, height: h };
}
