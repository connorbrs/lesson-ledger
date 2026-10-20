/**
 * The family summary PDF (D-01, D-10 to D-13). The only file that imports jspdf. This module is reached only through
 * a dynamic import (src/ui/useSummaryPdf.ts), so the engine and the fonts form ONE lazy chunk that never loads with
 * the app. Swapping the engine (pdf-lib) touches this file alone.
 *
 * Every string and layout rule comes from the pure content module; photo bytes arrive through the injected
 * loader, so this module knows nothing about the database or the UI.
 */
import { jsPDF } from 'jspdf';
import {
  containFit,
  expenseRowCells,
  MAX_PDF_PHOTO_BYTES,
  PDF_LABELS,
  PDF_SUBLINE,
  PdfBuildError,
  pdfHeaderText,
  pdfPageFooter,
  pdfPeriodLabel,
  pdfTotalsLines,
  planReceiptPages,
  sessionRowCells,
  type LoadPhoto,
} from '../domain/pdfContent';
import type { FamilySummary } from '../domain/summary';
import { BOLD_BASE64 } from './fonts/NotoSans-Bold';
import { REGULAR_BASE64 } from './fonts/NotoSans-Regular';

export interface BuildPdfOptions {
  /** False writes uncompressed streams, so tests can read the text. Default true. */
  compress?: boolean;
  /** Overrides MAX_PDF_PHOTO_BYTES (tests only). */
  maxPhotoBytes?: number;
  /** Checked before the build starts and before each receipt is read; true stops the build with a 'cancelled' PdfBuildError. */
  isCancelled?: () => boolean;
}

export interface BuiltPdf {
  blob: Blob;
  pageCount: number;
}

type Align = 'left' | 'right';

const FONT = 'NotoSans';
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = 516;
/** Content may not pass this y (the bottom margin starts here). */
const BOTTOM = PAGE_HEIGHT - MARGIN;
const BODY_PT = 10;
const HEADING_PT = 12;
const LINE = BODY_PT * 1.3;
const PAD = 4;
const SESSION_COLUMNS = [80, 72, 164, 100, 100] as const;
const EXPENSE_COLUMNS = [80, 236, 100, 100] as const;
const SLOT_HEIGHT = 320;
const IMAGE_HEIGHT = 280;
const CAPTION_LINES = 3;

/** Builds the PDF for one family and period from the summary model (never from the edited message text). */
export async function buildSummaryPdf(
  summary: FamilySummary,
  instructorName: string | null,
  loadPhoto: LoadPhoto,
  options: BuildPdfOptions = {},
): Promise<BuiltPdf> {
  const checkCancelled = (): void => {
    if (options.isCancelled?.()) throw new PdfBuildError('cancelled');
  };
  try {
    checkCancelled();
    const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: options.compress !== false });
    doc.addFileToVFS('NotoSans-Regular.ttf', REGULAR_BASE64);
    doc.addFileToVFS('NotoSans-Bold.ttf', BOLD_BASE64);
    doc.addFont('NotoSans-Regular.ttf', FONT, 'normal');
    doc.addFont('NotoSans-Bold.ttf', FONT, 'bold');

    const periodLabel = pdfPeriodLabel(summary);
    let y = MARGIN;

    const font = (weight: 'normal' | 'bold', size: number): void => {
      doc.setFont(FONT, weight);
      doc.setFontSize(size);
    };
    const wrap = (text: string, width: number): string[] => doc.splitTextToSize(text, width) as string[];
    const newPage = (): void => {
      doc.addPage();
      y = MARGIN;
    };

    /* Header and subline */
    font('bold', 16);
    for (const line of wrap(pdfHeaderText(instructorName, summary.familyName, periodLabel), CONTENT_WIDTH)) {
      y += 16 * 1.3;
      doc.text(line, MARGIN, y - 4);
    }
    y += 6;
    font('normal', BODY_PT);
    for (const line of wrap(PDF_SUBLINE, CONTENT_WIDTH)) {
      doc.text(line, MARGIN, y + BODY_PT);
      y += LINE;
    }
    y += 12;

    const headingHeight = HEADING_PT * 1.3 + 4;
    const heading = (text: string): void => {
      font('bold', HEADING_PT);
      doc.text(text, MARGIN, y + HEADING_PT);
      y += headingHeight;
    };

    /** A table with a heading, a header row and wrapped rows; a row never splits, and a new page repeats "(devam)". */
    const table = (
      title: string,
      continued: string,
      headers: readonly string[],
      widths: readonly number[],
      aligns: readonly Align[],
      rows: readonly (readonly string[])[],
    ): void => {
      const headerHeight = measureRow(doc, headers, widths, 'bold');
      const firstHeight = rows.length > 0 ? measureRow(doc, rows[0], widths, 'normal') : 0;
      if (y + headingHeight + headerHeight + firstHeight > BOTTOM) newPage();
      heading(title);
      y = drawRow(doc, y, headers, widths, aligns, 'bold');
      for (const row of rows) {
        if (y + measureRow(doc, row, widths, 'normal') > BOTTOM) {
          newPage();
          heading(continued);
          y = drawRow(doc, y, headers, widths, aligns, 'bold');
        }
        y = drawRow(doc, y, row, widths, aligns, 'normal');
      }
      y += 14;
    };

    table(
      PDF_LABELS.sessions,
      PDF_LABELS.sessionsContinued,
      [PDF_LABELS.date, PDF_LABELS.subject, PDF_LABELS.students, PDF_LABELS.lesson, PDF_LABELS.activity],
      SESSION_COLUMNS,
      ['left', 'left', 'left', 'left', 'left'],
      summary.sessions.map(sessionRowCells),
    );

    if (summary.expenses.length > 0) {
      table(
        PDF_LABELS.expenses,
        PDF_LABELS.expensesContinued,
        [PDF_LABELS.date, PDF_LABELS.description, PDF_LABELS.fullAmount, PDF_LABELS.familyShare],
        EXPENSE_COLUMNS,
        ['left', 'left', 'right', 'right'],
        summary.expenses.map(expenseRowCells),
      );
    }

    /* Totals */
    const totals = pdfTotalsLines(summary);
    if (y + headingHeight + totals.length * LINE > BOTTOM) newPage();
    heading(PDF_LABELS.totals);
    font('normal', BODY_PT);
    for (const text of totals) {
      doc.text(text, MARGIN + CONTENT_WIDTH, y + BODY_PT, { align: 'right' });
      y += LINE;
    }

    /* Receipts: one photo at a time, released before the next */
    const cap = options.maxPhotoBytes ?? MAX_PDF_PHOTO_BYTES;
    let photoBytes = 0;
    for (const page of planReceiptPages(summary)) {
      newPage();
      for (const slot of page) {
        if (slot.showHeading) heading(PDF_LABELS.receipts);
        const top = y;
        let photo: Awaited<ReturnType<LoadPhoto>> | undefined;
        checkCancelled();
        try {
          photo = await loadPhoto(slot.photoId);
        } catch {
          throw new PdfBuildError('photo-unreadable');
        }
        // jsPDF accepts any bytes as a JPEG and writes a broken image; a receipt that is not a JPEG is unreadable (T-04-16).
        if (photo.bytes.length < 4 || photo.bytes[0] !== 0xff || photo.bytes[1] !== 0xd8 || photo.bytes[2] !== 0xff) {
          throw new PdfBuildError('photo-unreadable');
        }
        photoBytes += photo.bytes.length;
        if (photoBytes > cap) throw new PdfBuildError('too-large');
        const fit = containFit(photo.width, photo.height, CONTENT_WIDTH, IMAGE_HEIGHT);
        doc.addImage(photo.bytes, 'JPEG', MARGIN + fit.x, top + fit.y, fit.width, fit.height, slot.photoId, 'NONE');
        photo = undefined;
        font('normal', BODY_PT);
        let captionY = top + IMAGE_HEIGHT + 4;
        for (const line of captionLines(wrap(slot.caption, CONTENT_WIDTH))) {
          captionY += LINE;
          doc.text(line, MARGIN, captionY - 3);
        }
        y = top + SLOT_HEIGHT;
      }
    }

    /* Footer on every page, drawn once the page count is known */
    const pageCount = doc.getNumberOfPages();
    font('normal', 8);
    for (let n = 1; n <= pageCount; n++) {
      doc.setPage(n);
      doc.text(pdfPageFooter(summary.familyName, periodLabel, n, pageCount), PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN / 2, { align: 'center' });
    }

    return { blob: doc.output('blob'), pageCount };
  } catch (e) {
    throw toBuildError(e);
  }
}

/** At most CAPTION_LINES lines; the last one ends with an ellipsis when text was cut. */
function captionLines(lines: string[]): string[] {
  if (lines.length <= CAPTION_LINES) return lines;
  const kept = lines.slice(0, CAPTION_LINES);
  kept[CAPTION_LINES - 1] = `${kept[CAPTION_LINES - 1].replace(/\s+$/, '')}…`;
  return kept;
}

function wrapCells(doc: jsPDF, cells: readonly string[], widths: readonly number[], weight: 'normal' | 'bold'): string[][] {
  doc.setFont(FONT, weight);
  doc.setFontSize(BODY_PT);
  return cells.map((c, i) => doc.splitTextToSize(c, widths[i] - 2 * PAD) as string[]);
}

/** The height of one row: the tallest wrapped cell plus the padding. */
function measureRow(doc: jsPDF, cells: readonly string[], widths: readonly number[], weight: 'normal' | 'bold'): number {
  const lines = Math.max(1, ...wrapCells(doc, cells, widths, weight).map((w) => w.length));
  return lines * LINE + 2 * PAD;
}

/** One table row: wrapped cells at the column widths, a light line under it. Returns the next y. */
function drawRow(
  doc: jsPDF,
  top: number,
  cells: readonly string[],
  widths: readonly number[],
  aligns: readonly Align[],
  weight: 'normal' | 'bold',
): number {
  const wrapped = wrapCells(doc, cells, widths, weight);
  let x = MARGIN;
  wrapped.forEach((lines, i) => {
    lines.forEach((line, n) => {
      const baseline = top + PAD + BODY_PT + n * LINE - 1;
      if (aligns[i] === 'right') doc.text(line, x + widths[i] - PAD, baseline, { align: 'right' });
      else doc.text(line, x + PAD, baseline);
    });
    x += widths[i];
  });
  const bottom = top + measureRow(doc, cells, widths, weight);
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, bottom, MARGIN + CONTENT_WIDTH, bottom);
  return bottom;
}

function toBuildError(e: unknown): PdfBuildError {
  if (e instanceof PdfBuildError) return e;
  if (e instanceof RangeError) return new PdfBuildError('too-large');
  return new PdfBuildError('build-failed', e instanceof Error ? e.message : undefined);
}
