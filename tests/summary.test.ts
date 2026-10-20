import { describe, expect, it } from 'vitest';
import { creditedMinutes } from '../src/domain/session';
import { buildFamilySummary, renderMessageTr, summaryPeriod, type SummaryInput } from '../src/domain/summary';
import type { Expense, Session } from '../src/domain/types';

describe('credited minutes (D-17)', () => {
  it.each([
    [45, 'half', 23],
    [1, 'half', 1],
    [0, 'half', 0],
    [999, 'half', 500],
    [45, 'full', 45],
  ] as const)('%s %s gives %s', (m, mode, out) => expect(creditedMinutes(m, mode)).toBe(out));

  it('half is a whole number c with 2c - m equal to 0 or 1 for every minute 0 to 999', () => {
    for (let m = 0; m <= 999; m++) {
      const c = creditedMinutes(m, 'half');
      expect(Number.isInteger(c)).toBe(true);
      expect([0, 1]).toContain(2 * c - m);
    }
  });
});

const session = (over: Partial<Session> & Pick<Session, 'id' | 'date'>): Session => ({
  startTime: null,
  endTime: null,
  subject: 'swim',
  attendees: [{ studentId: 'ava', familyId: 'smith' }],
  credits: [{ familyId: 'smith', lesson: 'full', activity: 'full' }],
  lessonMinutes: 0,
  activityMinutes: 0,
  travelMinutes: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const expense = (over: Partial<Expense> & Pick<Expense, 'id' | 'sessionId'>): Expense => ({
  description: 'Pool entry',
  amountCents: 1875,
  splits: [{ familyId: 'smith', cents: 1875 }],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const tracerInput = (): SummaryInput => ({
  familyId: 'smith',
  familyName: 'Smith',
  period: summaryPeriod('week', '2026-10-12'),
  sessions: [
    session({ id: 's2', date: '2026-10-14', subject: 'math', lessonMinutes: 60, activityMinutes: 0, travelMinutes: 20 }),
    session({ id: 's1', date: '2026-10-12', lessonMinutes: 45, activityMinutes: 15, travelMinutes: 10 }),
  ],
  expenses: [expense({ id: 'e1', sessionId: 's1' })],
  photoIdsByExpense: new Map([['e1', ['p1']]]),
  studentNames: { ava: 'Ava' },
});

describe('buildFamilySummary and renderMessageTr', () => {
  it('builds the UI-SPEC example character for character', () => {
    const summary = buildFamilySummary(tracerInput());
    expect(summary.lessonMinutes).toBe(105);
    expect(summary.activityMinutes).toBe(15);
    expect(summary.expenseCents).toBe(1875);
    expect(summary.hasReceipts).toBe(true);
    expect(summary.sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(renderMessageTr(summary)).toBe(
      [
        'Smith ailesi — 12–18 Ekim 2026',
        '',
        'Pzt 12 Eki · Yüzme · ders 0,75 saat (0:45), aktivite 0,25 saat (0:15)',
        'Çar 14 Eki · Matematik · ders 1 saat (1:00), aktivite 0 saat (0:00)',
        '',
        'Toplam ders 1,75 saat (1:45)',
        'Toplam aktivite 0,25 saat (0:15)',
        "Masraflar $18.75 (fişler PDF'te)",
      ].join('\n'),
    );
  });

  it('omits the list and the Masraflar line when there is nothing', () => {
    const summary = buildFamilySummary({ ...tracerInput(), sessions: [], expenses: [] });
    expect(renderMessageTr(summary)).toBe(
      ['Smith ailesi — 12–18 Ekim 2026', '', 'Toplam ders 0 saat (0:00)', 'Toplam aktivite 0 saat (0:00)'].join('\n'),
    );
  });
});
