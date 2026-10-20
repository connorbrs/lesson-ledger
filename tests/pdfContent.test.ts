import { describe, expect, it } from 'vitest';
import { PDF_LABELS, PDF_SUBLINE, pdfHeaderText, pdfPeriodLabel, pdfTotalsLines, sessionRowCells } from '../src/domain/pdfContent';
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
