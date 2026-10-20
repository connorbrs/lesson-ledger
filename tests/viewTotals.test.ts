import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { archiveFamily, createFamily } from '../src/data/families';
import { createSession } from '../src/data/sessions';
import { archiveStudent, createStudent } from '../src/data/students';
import { loadViewTotals } from '../src/data/viewTotals';
import { formatHours } from '../src/domain/hours';
import { pdfTotalsLines, sessionRowCells } from '../src/domain/pdfContent';
import { renderMessageTr } from '../src/domain/summary';
import type { Session } from '../src/domain/types';
import {
  breakdownFooter,
  computeViewTotals,
  rowLines,
  showPersonalTotals,
  TOTALS_FOOTER,
  viewAmount,
  type NameInfo,
  type ViewRow,
} from '../src/domain/viewTotals';
import { trSession, trSummary } from './fixtures/pdfSummary';

const names = (o: Record<string, string>, archived: string[] = []): Map<string, NameInfo> =>
  new Map(Object.entries(o).map(([id, name]) => [id, { name, archived: archived.includes(id) }]));

const FAM = names({ fa: 'Alpha', fb: 'Beta' });
const STU = names({ sa: 'Ava', sb: 'Ben' });

const swim = (over: Partial<Session> & Pick<Session, 'id'>): Session =>
  trSession({ date: '2026-10-12', ...over });

const sharedSwim = swim({
  id: 'x1',
  lessonMinutes: 45,
  activityMinutes: 15,
  travelMinutes: 20,
  attendees: [
    { studentId: 'sa', familyId: 'fa' },
    { studentId: 'sb', familyId: 'fb' },
  ],
  credits: [
    { familyId: 'fa', lesson: 'half', activity: 'full' },
    { familyId: 'fb', lesson: 'full', activity: 'full' },
  ],
});

const rowOf = (rows: ViewRow[], id: string) => rows.find((r) => r.id === id)!;

describe('computeViewTotals', () => {
  it('shared swim: actual totals once, credited family and student rows (T-04-23)', () => {
    const t = computeViewTotals({ sessions: [sharedSwim], students: STU, families: FAM });
    expect([t.lesson, t.activity, t.travel]).toEqual([45, 15, 20]);
    expect(t.subjects).toEqual([{ id: 'swim', name: 'Swim', archived: false, lesson: 45, activity: 15, travel: 20 }]);
    expect(rowOf(t.families, 'fa')).toMatchObject({ lesson: 23, activity: 15, travel: 20 });
    expect(rowOf(t.families, 'fb')).toMatchObject({ lesson: 45, activity: 15, travel: 20 });
    expect(rowOf(t.families, 'fa').lesson + rowOf(t.families, 'fb').lesson).toBe(68);
    expect(rowOf(t.students, 'sa')).toMatchObject({ lesson: 23, activity: 15, travel: 20 });
    expect(rowOf(t.students, 'sb')).toMatchObject({ lesson: 45, activity: 15, travel: 20 });
  });

  it('siblings of one family count once in the family row and in each student row', () => {
    const s = swim({
      id: 'x2',
      lessonMinutes: 60,
      attendees: [
        { studentId: 'sa', familyId: 'fa' },
        { studentId: 'sb', familyId: 'fa' },
      ],
      credits: [{ familyId: 'fa', lesson: 'full', activity: 'full' }],
    });
    const t = computeViewTotals({ sessions: [s], students: STU, families: FAM });
    expect(t.lesson).toBe(60);
    expect(t.families).toHaveLength(1);
    expect(t.families[0].lesson).toBe(60);
    expect(rowOf(t.students, 'sa').lesson).toBe(60);
    expect(rowOf(t.students, 'sb').lesson).toBe(60);
  });

  it('sums credited whole minutes across sessions (23 + 23 = 46)', () => {
    const two = [sharedSwim, { ...sharedSwim, id: 'x3', date: '2026-10-13' }];
    const t = computeViewTotals({ sessions: two, students: STU, families: FAM });
    expect(rowOf(t.families, 'fa').lesson).toBe(46);
    expect(formatHours(46)).toBe('0.77 h (0:46)');
  });

  it('subject rows: fixed Swim then Math order, absent when there are no sessions', () => {
    const math = swim({ id: 'm1', subject: 'math', lessonMinutes: 30 });
    const both = computeViewTotals({ sessions: [math, sharedSwim], students: STU, families: FAM });
    expect(both.subjects.map((r) => r.name)).toEqual(['Swim', 'Math']);
    expect(both.subjects[0].lesson).toBe(45);
    const onlyMath = computeViewTotals({ sessions: [math], students: STU, families: FAM });
    expect(onlyMath.subjects.map((r) => r.name)).toEqual(['Math']);
    expect(onlyMath.subjects[0]).toMatchObject({ lesson: 30, activity: 0, travel: 0 });
  });

  it('sorts rows case-insensitively and numeric-aware, ties by id, and flags archived', () => {
    const ids = ['s1', 's2', 's3', 's4'];
    const stu = names({ s1: 'Child 10', s2: 'Child 2', s3: 'Ben', s4: 'ava' }, ['s2']);
    const sessions = ids.map((id) => swim({ id: `q${id}`, lessonMinutes: 10, attendees: [{ studentId: id, familyId: 'fa' }] }));
    const t = computeViewTotals({ sessions, students: stu, families: names({ fa: 'Alpha' }, ['fa']) });
    expect(t.students.map((r) => r.name)).toEqual(['ava', 'Ben', 'Child 2', 'Child 10']);
    expect(t.students.map((r) => r.archived)).toEqual([false, false, true, false]);
    expect(t.families[0].archived).toBe(true);

    const same = names({ b: 'Same', a: 'Same' });
    const tie = computeViewTotals({
      sessions: ['a', 'b'].map((id) => swim({ id: `t${id}`, lessonMinutes: 5, attendees: [{ studentId: id, familyId: 'fa' }] })),
      students: same,
      families: FAM,
    });
    expect(tie.students.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('an empty period has zero totals, no rows and no section', () => {
    const t = computeViewTotals({ sessions: [], students: STU, families: FAM });
    expect(t).toEqual({ lesson: 0, activity: 0, travel: 0, students: [], families: [], subjects: [] });
    expect(showPersonalTotals(0)).toBe(false);
    expect(showPersonalTotals(1)).toBe(true);
  });

  it('a missing credit counts as full', () => {
    const s = swim({ id: 'n1', lessonMinutes: 45, credits: [] });
    const t = computeViewTotals({ sessions: [s], students: STU, families: FAM });
    expect(t.families[0].lesson).toBe(45);
  });
});

describe('display texts', () => {
  it('formats amounts and lines', () => {
    expect(viewAmount(0)).toBe('none');
    expect(viewAmount(90)).toBe('1.5 h (1:30)');
    expect(rowLines({ lesson: 90, activity: 30, travel: 0 })).toEqual(['Lesson 1.5 h (1:30)', 'Activity 0.5 h (0:30)', 'Travel none']);
  });

  it('has the exact footers', () => {
    const credited = 'Family and student rows use credited time. On a shared swim they can add up to more than the total.';
    expect(breakdownFooter('student')).toBe(credited);
    expect(breakdownFooter('family')).toBe(credited);
    expect(breakdownFooter('subject')).toBe('Subject rows count actual time once.');
    expect(TOTALS_FOOTER).toBe('Travel appears in this view only. Family summaries never include it.');
  });
});

describe('travel never reaches parent-facing output (T-04-24)', () => {
  it('shows 13 travel minutes in the personal totals only', () => {
    const s = trSession({ id: 'r1', date: '2026-10-12', lessonMinutes: 45, activityMinutes: 15, travelMinutes: 13 });
    const totals = computeViewTotals({ sessions: [s], students: names({ ava: 'Ava' }), families: names({ smith: 'Smith' }) });
    expect(rowLines(totals).join('\n')).toContain('0.22 h (0:13)');
    expect(rowLines(totals.students[0]).join('\n')).toContain('0.22 h (0:13)');

    const summary = trSummary({ sessions: [s] });
    const parentFacing = [
      renderMessageTr(summary),
      ...sessionRowCells(summary.sessions[0]),
      ...pdfTotalsLines(summary),
    ].join('\n');
    expect(parentFacing).not.toContain('0,22 saat (0:13)');
    expect(parentFacing).not.toContain('0:13');
  });
});

describe('loadViewTotals', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();
  });

  const full = (familyId: string) => ({ familyId, lesson: 'full' as const, activity: 'full' as const });

  async function seed() {
    const smith = await createFamily('Smith');
    const jones = await createFamily('Jones');
    const ava = await createStudent({ familyId: smith.id, name: 'Ava' });
    const joe = await createStudent({ familyId: jones.id, name: 'Joe' });
    const log = (date: string, lesson: number, who: { s: { id: string }; f: { id: string } }) =>
      createSession({
        date, startTime: null, endTime: null, subject: 'swim',
        attendees: [{ studentId: who.s.id, familyId: who.f.id }], credits: [full(who.f.id)],
        lessonMinutes: lesson, activityMinutes: 0, travelMinutes: 5,
      });
    const a = { s: ava, f: smith };
    const j = { s: joe, f: jones };
    await log('2026-10-11', 100, a); // day before the range
    await log('2026-10-12', 10, a); // first day
    await log('2026-10-18', 20, j); // last day, included
    await log('2026-10-19', 400, a); // next day, excluded
    return { smith, jones, ava, joe };
  }

  it('matches computeViewTotals over the rows in range, edges inclusive', async () => {
    const { smith, jones, ava, joe } = await seed();
    const week = await loadViewTotals('2026-10-12', '2026-10-18');
    expect(week.sessionCount).toBe(2);
    expect(week.totals).toEqual(
      computeViewTotals({
        sessions: await db.sessions.where('date').between('2026-10-12', '2026-10-18', true, true).toArray(),
        students: names({ [ava.id]: 'Ava', [joe.id]: 'Joe' }),
        families: names({ [smith.id]: 'Smith', [jones.id]: 'Jones' }),
      }),
    );
    expect(week.totals.lesson).toBe(30);
    expect(week.totals.travel).toBe(10);

    const month = await loadViewTotals('2026-10-01', '2026-10-31');
    expect(month.sessionCount).toBe(4);
    expect(month.totals.lesson).toBe(530);
  });

  it('keeps archived students and families with their history, flagged', async () => {
    const { smith, ava } = await seed();
    await archiveStudent(ava.id);
    await archiveFamily(smith.id);
    const week = await loadViewTotals('2026-10-12', '2026-10-18');
    expect(week.totals.students.find((r) => r.id === ava.id)).toMatchObject({ name: 'Ava', archived: true, lesson: 10 });
    expect(week.totals.families.find((r) => r.id === smith.id)).toMatchObject({ name: 'Smith', archived: true });
    expect(week.totals.families.find((r) => r.name === 'Jones')!.archived).toBe(false);
  });

  it('returns zeros for an empty period', async () => {
    const r = await loadViewTotals('2026-01-05', '2026-01-11');
    expect(r.sessionCount).toBe(0);
    expect(showPersonalTotals(r.sessionCount)).toBe(false);
  });
});
