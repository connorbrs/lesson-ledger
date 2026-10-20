/**
 * The family summary PDF (D-01, D-10 to D-13). The only file that imports jspdf, and only through a dynamic
 * import, so the engine is a separate lazy chunk that never loads with the app. Swapping the engine (pdf-lib)
 * touches this file alone.
 *
 * Every string and layout rule comes from the pure content module; photo bytes arrive through the injected
 * loader, so this module knows nothing about the database or the UI.
 */
import type { jsPDF } from 'jspdf';
import {
  PDF_LABELS,
  PDF_SUBLINE,
  PdfBuildError,
  pdfHeaderText,
  pdfPeriodLabel,
  pdfTotalsLines,
  sessionRowCells,
  type LoadPhoto,
} from '../domain/pdfContent';
import type { FamilySummary } from '../domain/summary';
import { BOLD_BASE64 } from './fonts/NotoSans-Bold';
import { REGULAR_BASE64 } from './fonts/NotoSans-Regular';

export interface BuildPdfOptions {
  /** False writes uncompressed streams, so tests can read the text. Default true. */
  compress?: boolean;
}

export interface BuiltPdf {
  blob: Blob;
  pageCount: number;
}

const FONT = 'NotoSans';
const MARGIN = 48;
const CONTENT_WIDTH = 516;
const BODY_PT = 10;
const LINE = BODY_PT * 1.3;
const PAD = 4;
const SESSION_COLUMNS = [80, 72, 164, 100, 100] as const;

/** Builds the PDF for one family and period from the summary model (never from the edited message text). */
export async function buildSummaryPdf(
  summary: FamilySummary,
  instructorName: string | null,
  _loadPhoto: LoadPhoto,
  options: BuildPdfOptions = {},
): Promise<BuiltPdf> {
  try {
    const { jsPDF: JsPdf } = await import('jspdf');
    const doc = new JsPdf({ unit: 'pt', format: 'letter', compress: options.compress !== false });
    doc.addFileToVFS('NotoSans-Regular.ttf', REGULAR_BASE64);
    doc.addFileToVFS('NotoSans-Bold.ttf', BOLD_BASE64);
    doc.addFont('NotoSans-Regular.ttf', FONT, 'normal');
    doc.addFont('NotoSans-Bold.ttf', FONT, 'bold');

    let y = MARGIN;
    const font = (weight: 'normal' | 'bold', size: number): void => {
      doc.setFont(FONT, weight);
      doc.setFontSize(size);
    };
    const wrap = (text: string, width: number): string[] => doc.splitTextToSize(text, width) as string[];

    font('bold', 16);
    const header = wrap(pdfHeaderText(instructorName, summary.familyName, pdfPeriodLabel(summary)), CONTENT_WIDTH);
    for (const line of header) {
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

    font('bold', 12);
    doc.text(PDF_LABELS.sessions, MARGIN, y + 12);
    y += 12 * 1.3 + 4;
    y = drawRow(doc, y, [PDF_LABELS.date, PDF_LABELS.subject, PDF_LABELS.students, PDF_LABELS.lesson, PDF_LABELS.activity], SESSION_COLUMNS, 'bold');
    for (const line of summary.sessions) y = drawRow(doc, y, sessionRowCells(line), SESSION_COLUMNS, 'normal');
    y += 14;

    font('bold', 12);
    doc.text(PDF_LABELS.totals, MARGIN, y + 12);
    y += 12 * 1.3 + 2;
    font('normal', BODY_PT);
    for (const text of pdfTotalsLines(summary)) {
      doc.text(text, MARGIN + CONTENT_WIDTH, y + BODY_PT, { align: 'right' });
      y += LINE;
    }

    return { blob: doc.output('blob'), pageCount: doc.getNumberOfPages() };
  } catch (e) {
    throw toBuildError(e);
  }
}

/** One table row: wrapped cells at the column widths, a light line under it. Returns the next y. */
function drawRow(doc: jsPDF, top: number, cells: readonly string[], widths: readonly number[], weight: 'normal' | 'bold'): number {
  doc.setFont(FONT, weight);
  doc.setFontSize(BODY_PT);
  const wrapped = cells.map((c, i) => doc.splitTextToSize(c, widths[i] - 2 * PAD) as string[]);
  const lines = Math.max(1, ...wrapped.map((w) => w.length));
  let x = MARGIN;
  wrapped.forEach((w, i) => {
    w.forEach((line, n) => doc.text(line, x + PAD, top + PAD + BODY_PT + n * LINE - 1));
    x += widths[i];
  });
  const bottom = top + lines * LINE + 2 * PAD;
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
