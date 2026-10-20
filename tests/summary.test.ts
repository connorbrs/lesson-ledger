import { describe, expect, it } from 'vitest';
import { creditedMinutes } from '../src/domain/session';
import {
  buildFamilySummary,
  canGoNext,
  defaultPeriod,
  formatMonthDay,
  isDefaultPeriod,
  isFingerprint,
  parsePeriodKey,
  pdfFileName,
  periodKey,
  periodReturnLabel,
  renderMessageTr,
  screenParts,
  shiftSummaryPeriod,
  summaryPeriod,
  summaryRowSecondLine,
  warningText,
  type SummaryInput,
} from '../src/domain/summary';
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

const WEEK = summaryPeriod('week', '2026-10-12');

describe('period keys (SUM-01)', () => {
  it('writes and parses keys', () => {
    expect(periodKey(WEEK)).toBe('W2026-10-12');
    expect(periodKey(summaryPeriod('month', '2026-10-20'))).toBe('M2026-10');
    expect(parsePeriodKey('W2026-10-12')).toEqual(WEEK);
    expect(parsePeriodKey('M2026-10')).toEqual({ kind: 'month', start: '2026-10-01', end: '2026-10-31' });
  });

  it.each(['W2026-10-13', 'W2026-02-30', 'W2026-10-12 ', 'W2026-10-12\n', 'M2026-13', 'M2026-00', 'M2026-1', 'M2026-10-01', 'X2026-10', ''])(
    'rejects %j',
    (key) => expect(parsePeriodKey(key)).toBeNull(),
  );

  it('rejects non-strings', () => {
    for (const v of [null, undefined, 5, {}, ['W2026-10-12']]) expect(parsePeriodKey(v as unknown as string)).toBeNull();
  });

  it('round-trips 200 weeks and 60 months', () => {
    let w = WEEK;
    for (let i = 0; i < 200; i++) {
      expect(parsePeriodKey(periodKey(w))).toEqual(w);
      w = shiftSummaryPeriod(w, 1);
    }
    let m = summaryPeriod('month', '2024-01-15');
    for (let i = 0; i < 60; i++) {
      expect(parsePeriodKey(periodKey(m))).toEqual(m);
      m = shiftSummaryPeriod(m, 1);
    }
  });
});

describe('default period (SUM-01)', () => {
  it.each([
    ['weekly', '2026-10-19', '2026-10-12', '2026-10-18'],
    ['weekly', '2026-10-18', '2026-10-05', '2026-10-11'],
    ['weekly', '2026-01-01', '2025-12-22', '2025-12-28'],
    ['monthly', '2026-10-19', '2026-09-01', '2026-09-30'],
    ['monthly', '2026-03-31', '2026-02-01', '2026-02-28'],
    ['monthly', '2026-01-15', '2025-12-01', '2025-12-31'],
  ] as const)('%s on %s', (kind, today, start, end) => {
    expect(defaultPeriod(kind, today)).toEqual({ kind: kind === 'weekly' ? 'week' : 'month', start, end });
  });

  it('shifts, compares and gates next', () => {
    const def = defaultPeriod('weekly', '2026-10-19');
    const back = shiftSummaryPeriod(def, -1);
    expect(back.start).toBe('2026-10-05');
    expect(canGoNext(def, def)).toBe(false);
    expect(canGoNext(back, def)).toBe(true);
    expect(isDefaultPeriod(def, def)).toBe(true);
    expect(isDefaultPeriod(back, def)).toBe(false);
    expect(isDefaultPeriod(summaryPeriod('month', '2026-10-12'), def)).toBe(false);
  });
});

describe('ordering, filtering and privacy', () => {
  it('orders sessions by date, start time (untimed last), createdAt and ignores input order', () => {
    const input = tracerInput();
    const extra = [
      session({ id: 'a', date: '2026-10-12', startTime: '09:00', lessonMinutes: 10, createdAt: 5 }),
      session({ id: 'b', date: '2026-10-12', startTime: null, lessonMinutes: 10, createdAt: 2 }),
      session({ id: 'c', date: '2026-10-12', startTime: null, lessonMinutes: 10, createdAt: 3 }),
    ];
    const all = [...input.sessions, ...extra];
    const reversed = buildFamilySummary({ ...input, sessions: [...all].reverse() });
    expect(buildFamilySummary({ ...input, sessions: all }).sessions.map((s) => s.id)).toEqual(['a', 's1', 'b', 'c', 's2']);
    expect(reversed.sessions.map((s) => s.id)).toEqual(['a', 's1', 'b', 'c', 's2']);
  });

  it('orders expenses by their session then createdAt then id', () => {
    const input = tracerInput();
    const expenses = [
      expense({ id: 'x2', sessionId: 's2', createdAt: 1 }),
      expense({ id: 'x1b', sessionId: 's1', createdAt: 5 }),
      expense({ id: 'x1a', sessionId: 's1', createdAt: 5 }),
      expense({ id: 'x1c', sessionId: 's1', createdAt: 2 }),
    ];
    expect(buildFamilySummary({ ...input, expenses }).expenses.map((e) => e.id)).toEqual(['x1c', 'x1a', 'x1b', 'x2']);
  });

  it('keeps one family only: other names, students and shares never appear', () => {
    const shared = session({
      id: 'sh',
      date: '2026-10-13',
      lessonMinutes: 45,
      activityMinutes: 15,
      attendees: [
        { studentId: 'zed', familyId: 'jones' },
        { studentId: 'ava', familyId: 'smith' },
      ],
      credits: [
        { familyId: 'jones', lesson: 'half', activity: 'full' },
        { familyId: 'smith', lesson: 'full', activity: 'full' },
      ],
    });
    const other = session({ id: 'oth', date: '2026-10-13', attendees: [{ studentId: 'zed', familyId: 'jones' }], credits: [{ familyId: 'jones', lesson: 'full', activity: 'full' }], lessonMinutes: 30 });
    const shareExp = expense({ id: 'se', sessionId: 'sh', amountCents: 1001, splits: [{ familyId: 'jones', cents: 501 }, { familyId: 'smith', cents: 500 }] });
    const otherExp = expense({ id: 'oe', sessionId: 'oth', description: 'Secret', amountCents: 777, splits: [{ familyId: 'jones', cents: 777 }] });
    const input: SummaryInput = {
      familyId: 'smith',
      familyName: 'Smith',
      period: WEEK,
      sessions: [shared, other],
      expenses: [shareExp, otherExp],
      photoIdsByExpense: new Map(),
      studentNames: { ava: 'Ava', zed: 'Zed' },
    };
    const summary = buildFamilySummary(input);
    expect(summary.sessions.map((s) => s.id)).toEqual(['sh']);
    expect(summary.sessions[0].studentNames).toEqual(['Ava']);
    expect(summary.expenseCents).toBe(500);
    expect(summary.lessonMinutes).toBe(45);
    const blob = JSON.stringify(summary) + renderMessageTr(summary);
    expect(blob).not.toMatch(/Jones|Zed|Secret|501|777/);
  });

  it('counts siblings once', () => {
    const input = tracerInput();
    const sib = session({
      id: 'sib',
      date: '2026-10-15',
      lessonMinutes: 30,
      attendees: [{ studentId: 'ava', familyId: 'smith' }, { studentId: 'ben', familyId: 'smith' }],
    });
    const summary = buildFamilySummary({ ...input, sessions: [sib], expenses: [], studentNames: { ava: 'Ava', ben: 'Ben' } });
    expect(summary.lessonMinutes).toBe(30);
    expect(summary.sessions[0].studentNames).toEqual(['Ava', 'Ben']);
  });

  it('ignores sessions outside the period', () => {
    const input = tracerInput();
    const out = session({ id: 'out', date: '2026-10-19', lessonMinutes: 60 });
    expect(buildFamilySummary({ ...input, sessions: [...input.sessions, out] }).sessions.map((s) => s.id)).toEqual(['s1', 's2']);
  });
});

describe('rounding sums (D-17, SUM-06)', () => {
  const halfSession = (id: string, date: string): Session =>
    session({
      id,
      date,
      lessonMinutes: 45,
      attendees: [{ studentId: 'ava', familyId: 'smith' }, { studentId: 'zed', familyId: 'jones' }],
      credits: [{ familyId: 'smith', lesson: 'half', activity: 'full' }, { familyId: 'jones', lesson: 'full', activity: 'full' }],
    });

  it('lines of 23 and 23 total 46', () => {
    const input = { ...tracerInput(), sessions: [halfSession('h1', '2026-10-12'), halfSession('h2', '2026-10-13')], expenses: [] };
    const summary = buildFamilySummary(input);
    expect(summary.sessions.map((s) => s.lessonMinutes)).toEqual([23, 23]);
    expect(summary.lessonMinutes).toBe(46);
    const text = renderMessageTr(summary);
    expect(text).toContain('ders 0,38 saat (0:23)');
    expect(text).toContain('Toplam ders 0,77 saat (0:46)');
  });

  it('line sums equal totals for generated minute lists', () => {
    for (let n = 1; n < 40; n++) {
      const sessions = Array.from({ length: n }, (_, i) =>
        session({
          id: `g${i}`,
          date: '2026-10-12',
          createdAt: i,
          lessonMinutes: (i * 37 + n) % 200,
          activityMinutes: (i * 11) % 90,
          attendees: [{ studentId: 'ava', familyId: 'smith' }, { studentId: 'zed', familyId: 'jones' }],
          credits: [{ familyId: 'smith', lesson: i % 2 ? 'half' : 'full', activity: 'half' }, { familyId: 'jones', lesson: 'full', activity: 'full' }],
        }),
      );
      const s = buildFamilySummary({ ...tracerInput(), sessions, expenses: [] });
      expect(s.sessions.reduce((a, l) => a + l.lessonMinutes, 0)).toBe(s.lessonMinutes);
      expect(s.sessions.reduce((a, l) => a + l.activityMinutes, 0)).toBe(s.activityMinutes);
    }
  });
});

describe('warnings (D-16, SUM-07)', () => {
  it('flags zero minutes even with travel, and not when activity exists or half credit rounds up', () => {
    const input = tracerInput();
    const sessions = [
      session({ id: 'z', date: '2026-10-12', travelMinutes: 30 }),
      session({ id: 'act', date: '2026-10-13', activityMinutes: 15 }),
      session({
        id: 'half',
        date: '2026-10-14',
        lessonMinutes: 1,
        attendees: [{ studentId: 'ava', familyId: 'smith' }, { studentId: 'zed', familyId: 'jones' }],
        credits: [{ familyId: 'smith', lesson: 'half', activity: 'half' }, { familyId: 'jones', lesson: 'full', activity: 'full' }],
      }),
    ];
    const w = buildFamilySummary({ ...input, sessions, expenses: [] }).warnings;
    expect(w.map((x) => [x.kind, x.id])).toEqual([['zero-minutes', 'z']]);
  });

  it('flags an expense without photos, sorted by date then zero-minutes before no-receipt then id', () => {
    const input = tracerInput();
    const sessions = [
      session({ id: 'z', date: '2026-10-12', subject: 'swim' }),
      session({ id: 'm', date: '2026-10-15', subject: 'math', lessonMinutes: 30 }),
      session({ id: 'n', date: '2026-10-12', lessonMinutes: 30 }),
    ];
    const expenses = [
      expense({ id: 'eb', sessionId: 'n', description: 'B', amountCents: 500, splits: [{ familyId: 'smith', cents: 500 }] }),
      expense({ id: 'ea', sessionId: 'n', description: 'A', amountCents: 500, splits: [{ familyId: 'smith', cents: 500 }] }),
      expense({ id: 'ec', sessionId: 'm', description: 'C', amountCents: 500, splits: [{ familyId: 'smith', cents: 500 }] }),
      expense({ id: 'ed', sessionId: 'm', description: 'D', amountCents: 500, splits: [{ familyId: 'smith', cents: 500 }] }),
    ];
    const w = buildFamilySummary({ ...input, sessions, expenses, photoIdsByExpense: new Map([['ed', ['p']]]) }).warnings;
    expect(w.map((x) => `${x.kind}:${x.id}`)).toEqual(['zero-minutes:z', 'no-receipt:ea', 'no-receipt:eb', 'no-receipt:ec']);
  });

  it('writes the warning text', () => {
    const input = tracerInput();
    const sessions = [session({ id: 'z', date: '2026-10-18', subject: 'swim' }), session({ id: 'm', date: '2026-10-17', subject: 'math' })];
    const expenses = [expense({ id: 'e', sessionId: 'z', description: 'Pool entry fee', amountCents: 1250, splits: [{ familyId: 'smith', cents: 1250 }] })];
    const w = buildFamilySummary({ ...input, sessions, expenses }).warnings;
    expect(w.map(warningText)).toEqual([
      'No lesson or activity minutes: Math, Oct 17',
      'No lesson or activity minutes: Swim, Oct 18',
      'No receipt: Pool entry fee, $12.50 (Oct 18)',
    ]);
  });

  it('formatMonthDay does not depend on the host time zone', () => {
    expect(formatMonthDay('2026-10-18')).toBe('Oct 18');
    expect(formatMonthDay('2026-01-01')).toBe('Jan 1');
  });
});

describe('Masraflar line', () => {
  it('is absent without expenses, plain without photos, parenthetical with any photo', () => {
    const input = tracerInput();
    const none = renderMessageTr(buildFamilySummary({ ...input, expenses: [] }));
    expect(none).not.toContain('Masraflar');
    const plain = expense({ id: 'p', sessionId: 's1', amountCents: 501, splits: [{ familyId: 'smith', cents: 501 }] });
    expect(renderMessageTr(buildFamilySummary({ ...input, expenses: [plain], photoIdsByExpense: new Map() })).split('\n').pop()).toBe('Masraflar $5.01');
    const withPhoto = renderMessageTr(buildFamilySummary({ ...input, expenses: [plain], photoIdsByExpense: new Map([['p', ['x']]]) }));
    expect(withPhoto.split('\n').pop()).toBe("Masraflar $5.01 (fişler PDF'te)");
  });

  it('counts the photos of a shared expense for both families but not expenses of sessions not attended', () => {
    const sh = session({
      id: 'sh',
      date: '2026-10-13',
      lessonMinutes: 30,
      attendees: [{ studentId: 'ava', familyId: 'smith' }, { studentId: 'zed', familyId: 'jones' }],
      credits: [{ familyId: 'smith', lesson: 'full', activity: 'full' }, { familyId: 'jones', lesson: 'full', activity: 'full' }],
    });
    const base = { period: WEEK, sessions: [sh], expenses: [expense({ id: 'se', sessionId: 'sh', amountCents: 1000, splits: [{ familyId: 'smith', cents: 500 }, { familyId: 'jones', cents: 500 }] })], photoIdsByExpense: new Map([['se', ['p']]]), studentNames: {} };
    expect(buildFamilySummary({ ...base, familyId: 'smith', familyName: 'Smith' }).hasReceipts).toBe(true);
    expect(buildFamilySummary({ ...base, familyId: 'jones', familyName: 'Jones' }).hasReceipts).toBe(true);
    expect(buildFamilySummary({ ...base, familyId: 'third', familyName: 'Third' }).expenses).toEqual([]);
  });
});

describe('fingerprint (D-09, D-15, D-18)', () => {
  const fp = (input: SummaryInput) => buildFamilySummary(input).fingerprint;
  const base = (): SummaryInput => {
    const input = tracerInput();
    return { ...input, studentNames: { ava: 'Ava' } };
  };

  it('is 14 lowercase hex characters', () => {
    expect(isFingerprint(fp(base()))).toBe(true);
    for (const v of ['0123456789abcd', 'abcdefabcdefab']) expect(isFingerprint(v)).toBe(true);
    for (const v of ['0123456789abc', '0123456789abcde', '0123456789ABCD', '0123456789abcg', 5, null, undefined]) expect(isFingerprint(v)).toBe(false);
  });

  it('is stable for identical and shuffled data', () => {
    const a = base();
    const shuffled: SummaryInput = { ...a, sessions: [...a.sessions].reverse(), expenses: [...a.expenses].reverse() };
    expect(fp(shuffled)).toBe(fp(a));
    expect(fp(base())).toBe(fp(a));
  });

  const edits: [string, (i: SummaryInput) => SummaryInput][] = [
    ['lessonMinutes', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, lessonMinutes: 46 } : s)) })],
    ['activityMinutes', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, activityMinutes: 16 } : s)) })],
    ['travelMinutes', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, travelMinutes: 11 } : s)) })],
    ['date', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, date: '2026-10-13' } : s)) })],
    ['startTime', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, startTime: '10:00' } : s)) })],
    ['subject', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, subject: 'math' as const } : s)) })],
    ['attendee', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, attendees: [{ studentId: 'ben', familyId: 'smith' }] } : s)) })],
    ['credit mode', (i) => ({ ...i, sessions: i.sessions.map((s) => (s.id === 's1' ? { ...s, credits: [{ familyId: 'smith', lesson: 'half' as const, activity: 'full' as const }] } : s)) })],
    ['added session', (i) => ({ ...i, sessions: [...i.sessions, session({ id: 's3', date: '2026-10-16', lessonMinutes: 5 })] })],
    ['deleted session', (i) => ({ ...i, sessions: i.sessions.filter((s) => s.id !== 's2') })],
    ['added expense', (i) => ({ ...i, expenses: [...i.expenses, expense({ id: 'e2', sessionId: 's2' })] })],
    ['expense amount', (i) => ({ ...i, expenses: i.expenses.map((e) => ({ ...e, amountCents: 1876, splits: [{ familyId: 'smith', cents: 1876 }] })) })],
    ['expense description', (i) => ({ ...i, expenses: i.expenses.map((e) => ({ ...e, description: 'Pool' })) })],
    ['expense split', (i) => ({ ...i, expenses: i.expenses.map((e) => ({ ...e, splits: [{ familyId: 'smith', cents: 1000 }, { familyId: 'jones', cents: 875 }] })) })],
    ['photo added', (i) => ({ ...i, photoIdsByExpense: new Map([['e1', ['p1', 'p2']]]) })],
    ['photo removed', (i) => ({ ...i, photoIdsByExpense: new Map() })],
    ['family rename', (i) => ({ ...i, familyName: 'Smyth' })],
  ];
  it.each(edits)('changes after a change of %s, and reverting restores it', (_name, edit) => {
    const a = base();
    expect(fp(edit(a))).not.toBe(fp(a));
    expect(fp(a)).toBe(fp(base()));
  });

  it('does not change for a student rename, other families, outside the period or the studentNames map', () => {
    const a = base();
    expect(fp({ ...a, studentNames: { ava: 'Avery' } })).toBe(fp(a));
    const jonesOnly = session({ id: 'j', date: '2026-10-13', lessonMinutes: 5, attendees: [{ studentId: 'zed', familyId: 'jones' }], credits: [{ familyId: 'jones', lesson: 'full', activity: 'full' }] });
    const outside = session({ id: 'o', date: '2026-10-25', lessonMinutes: 5 });
    expect(fp({ ...a, sessions: [...a.sessions, jonesOnly, outside] })).toBe(fp(a));
  });

  it('is deterministic for a pinned input', () => {
    expect(fp(base())).toMatch(/^[0-9a-f]{14}$/);
    expect(fp(base())).toBe(fp(base()));
  });
});

describe('screen and row predicates', () => {
  const summaryWith = (sessions: Session[], expenses: Expense[] = []) =>
    buildFamilySummary({ ...tracerInput(), sessions, expenses, photoIdsByExpense: new Map() });

  it('screenParts hides everything with zero sessions', () => {
    expect(screenParts(summaryWith([]))).toEqual({ empty: true, showSent: false, showWarnings: false, showMessage: false, showShare: false });
  });
  it('shows warnings only when they exist', () => {
    const ok = session({ id: 'a', date: '2026-10-12', lessonMinutes: 30 });
    expect(screenParts(summaryWith([ok]))).toEqual({ empty: false, showSent: true, showWarnings: false, showMessage: true, showShare: true });
    const zero = session({ id: 'b', date: '2026-10-13' });
    expect(screenParts(summaryWith([ok, zero])).showWarnings).toBe(true);
  });
  it('writes the row second line and the return label', () => {
    expect(summaryRowSecondLine('weekly', WEEK, true, '2026-10-19')).toBe('Weekly \u00b7 Oct 12 \u2013 18');
    expect(summaryRowSecondLine('weekly', WEEK, false, '2026-10-19')).toBe('Weekly \u00b7 Oct 12 \u2013 18 \u00b7 No sessions');
    expect(summaryRowSecondLine('monthly', summaryPeriod('month', '2026-09-01'), true, '2026-10-19')).toBe('Monthly \u00b7 September 2026');
    expect(periodReturnLabel('week')).toBe('Last Week');
    expect(periodReturnLabel('month')).toBe('Last Month');
  });
});

describe('pdfFileName', () => {
  it.each([
    ['Smith', WEEK, 'smith-2026-10-12-2026-10-18.pdf'],
    ['Smith', summaryPeriod('month', '2026-09-10'), 'smith-2026-09.pdf'],
    ['İş Ağı Öğrenci', WEEK, 'is-agi-ogrenci-2026-10-12-2026-10-18.pdf'],
    ['Şahin', WEEK, 'sahin-2026-10-12-2026-10-18.pdf'],
    ['../x/y', WEEK, 'x-y-2026-10-12-2026-10-18.pdf'],
    ['***', WEEK, 'aile-2026-10-12-2026-10-18.pdf'],
  ])('%s', (name, period, out) => {
    const file = pdfFileName(name, period);
    expect(file).toBe(out);
    expect(file).toMatch(/^[a-z0-9-]+\.pdf$/);
  });
});
