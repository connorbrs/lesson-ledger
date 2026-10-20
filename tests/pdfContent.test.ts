import { describe, expect, it } from 'vitest';
import {
  containFit,
  expenseRowCells,
  PDF_LABELS,
  PDF_SUBLINE,
  pdfHeaderText,
  pdfPageFooter,
  pdfPeriodLabel,
  pdfTotalsLines,
  planReceiptPages,
  receiptCaption,
  sessionRowCells,
} from '../src/domain/pdfContent';
import { renderMessageTr } from '../src/domain/summary';
import { trSession, trSummary } from './fixtures/pdfSummary';

const tracer = () =>
  trSummary({ sessions: [trSession({ id: 's1', date: '2026-10-12', lessonMinutes: 45, activityMinutes: 15 }), trSession({ id: 's2', date: '2026-10-14', subject: 'math', lessonMinutes: 60 })] });

describe('pdfHeaderText (D-10)', () => {
  it('joins instructor, family and period', () => {
    expect(pdfHeaderText('Connor B.', 'Smith', '12–18 Ekim 2026')).toBe('Connor B. — Smith ailesi — 12–18 Ekim 2026');
  });
  it.each([null, undefined, '', '   '])('leaves out the instructor and its dash for %j', (name) => {
    expect(pdfHeaderText(name, 'Smith', '12–18 Ekim 2026')).toBe('Smith ailesi — 12–18 Ekim 2026');
  });
});

describe('PDF labels (UI-SPEC, exact)', () => {
  it('has the exact Turkish text', () => {
    expect(PDF_LABELS).toMatchObject({
      sessions: 'Dersler',
      expenses: 'Masraflar',
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
      sessionsContinued: 'Dersler (devam)',
      expensesContinued: 'Masraflar (devam)',
    });
    expect(PDF_SUBLINE).toBe('Ders ve aktivite süreleri. Yolculuk süresi dahil değildir.');
  });
});

describe('sessionRowCells and totals', () => {
  it('gives credited time cells', () => {
    expect(sessionRowCells(tracer().sessions[0])).toEqual(['Pzt 12 Eki', 'Yüzme', 'Ava', '0,75 saat (0:45)', '0,25 saat (0:15)']);
  });

  it('lists the lesson and activity totals, and expenses only when there are some', () => {
    expect(pdfTotalsLines(tracer())).toEqual(['Toplam ders 1,75 saat (1:45)', 'Toplam aktivite 0,25 saat (0:15)']);
  });

  it('adds the family share of expenses', () => {
    const s = trSummary({
      sessions: [trSession({ id: 's1', date: '2026-10-12', lessonMinutes: 45, activityMinutes: 15 })],
      expenses: [{ id: 'e1', sessionId: 's1', description: 'Pool entry', amountCents: 1875, splits: [{ familyId: 'smith', cents: 1875 }], createdAt: 1, updatedAt: 1 }],
    });
    expect(pdfTotalsLines(s)).toContain('Masraflar (aile payı) $18.75');
  });

  it('SUM-06: every amount in the PDF totals also appears in the message', () => {
    const s = trSummary({
      sessions: [trSession({ id: 's1', date: '2026-10-12', lessonMinutes: 45, activityMinutes: 15 }), trSession({ id: 's2', date: '2026-10-14', lessonMinutes: 22, activityMinutes: 7 })],
      expenses: [{ id: 'e1', sessionId: 's1', description: 'Pool entry', amountCents: 123456, splits: [{ familyId: 'smith', cents: 123456 }], createdAt: 1, updatedAt: 1 }],
    });
    const message = renderMessageTr(s);
    for (const line of pdfTotalsLines(s)) expect(message).toContain(line.replace('Masraflar (aile payı)', 'Masraflar'));
  });

  it('uses the Turkish period label', () => {
    expect(pdfPeriodLabel(tracer())).toBe('12–18 Ekim 2026');
  });
});

describe('expense rows, footer and captions (D-11, D-13)', () => {
  it('expenseRowCells gives date, description, full amount and this family share', () => {
    expect(expenseRowCells({ id: 'e1', sessionId: 's1', date: '2026-10-12', description: 'Pool entry', amountCents: 1875, shareCents: 938, photoIds: [] })).toEqual([
      'Pzt 12 Eki',
      'Pool entry',
      '$18.75',
      '$9.38',
    ]);
  });

  it('pdfPageFooter', () => {
    expect(pdfPageFooter('Smith', '12–18 Ekim 2026', 2, 3)).toBe('Smith ailesi — 12–18 Ekim 2026 · Sayfa 2 / 3');
  });

  it('receiptCaption numbers the photos only when there are several', () => {
    expect(receiptCaption('Pool entry', 1875, 1, 1)).toBe('Pool entry — $18.75');
    expect(receiptCaption('Pool entry', 1875, 2, 3)).toBe('Pool entry — $18.75 (2/3)');
  });
});

const withPhotos = (counts: number[]) =>
  trSummary({
    expenses: counts.map((_, i) => ({
      id: `e${i + 1}`,
      sessionId: 's1',
      description: `Expense ${i + 1}`,
      amountCents: 1000 + i,
      splits: [{ familyId: 'smith', cents: 1000 + i }],
      createdAt: i + 1,
      updatedAt: 1,
    })),
    photos: Object.fromEntries(counts.map((n, i) => [`e${i + 1}`, Array.from({ length: n }, (_, k) => `p${i + 1}-${k + 1}`)])),
  });

describe('planReceiptPages (D-12)', () => {
  it('has no pages without photos', () => {
    expect(planReceiptPages(withPhotos([0, 0]))).toEqual([]);
    expect(planReceiptPages(trSummary())).toEqual([]);
  });

  it('puts one photo on one page of one slot', () => {
    const pages = planReceiptPages(withPhotos([1]));
    expect(pages.map((p) => p.length)).toEqual([1]);
    expect(pages[0][0]).toEqual({ expenseId: 'e1', photoId: 'p1-1', caption: 'Expense 1 — $10.00', showHeading: true });
  });

  it('packs two per page in expense order then photo order', () => {
    const pages = planReceiptPages(withPhotos([2, 1]));
    expect(pages.map((p) => p.map((s) => s.photoId))).toEqual([['p1-1', 'p1-2'], ['p2-1']]);
    expect(pages[0][1].caption).toBe('Expense 1 — $10.00 (2/2)');
  });

  it('five photos give three pages', () => {
    expect(planReceiptPages(withPhotos([3, 2])).map((p) => p.length)).toEqual([2, 2, 1]);
  });

  it('exactly one slot has the heading, and it is the first', () => {
    const slots = planReceiptPages(withPhotos([3, 2])).flat();
    expect(slots.filter((s) => s.showHeading)).toHaveLength(1);
    expect(slots[0].showHeading).toBe(true);
  });
});

describe('containFit', () => {
  const ratio = (f: { width: number; height: number }) => f.width / f.height;

  it('fills the height of a wide photo and centres it horizontally', () => {
    const f = containFit(1600, 900, 516, 280);
    expect(f.height).toBeCloseTo(280, 5);
    expect(f.width).toBeCloseTo(497.78, 1);
    expect(f.x).toBeCloseTo((516 - f.width) / 2, 5);
    expect(f.y).toBeCloseTo(0, 5);
    expect(Math.abs(ratio(f) - 1600 / 900)).toBeLessThan(0.01);
  });

  it('is height-limited for a tall photo', () => {
    const f = containFit(900, 1600, 516, 280);
    expect(f.height).toBeCloseTo(280, 5);
    expect(f.width).toBeCloseTo(157.5, 1);
    expect(Math.abs(ratio(f) - 900 / 1600)).toBeLessThan(0.01);
  });

  it('scales a small photo up only to the box, never beyond', () => {
    const f = containFit(32, 18, 516, 280);
    expect(f.width).toBeLessThanOrEqual(516 + 1e-9);
    expect(f.height).toBeLessThanOrEqual(280 + 1e-9);
    expect(Math.abs(ratio(f) - 32 / 18)).toBeLessThan(0.01);
  });

  it('is width-limited when the photo is wider than the box shape', () => {
    const f = containFit(4000, 500, 516, 280);
    expect(f.width).toBeCloseTo(516, 5);
    expect(f.y).toBeGreaterThan(0);
  });
});
