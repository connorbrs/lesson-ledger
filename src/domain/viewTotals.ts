import { formatHours } from './hours';
import { creditedMinutes } from './session';
import type { Session, Subject } from './types';

/** Minutes for one row of the instructor's own view. Travel is read here only: it never reaches a parent-facing output. */
export interface ViewRow {
  id: string;
  name: string;
  archived: boolean;
  lesson: number;
  activity: number;
  travel: number;
}

export interface ViewTotals {
  /** Actual entered minutes, once per session (equals the sum of the subject rows). */
  lesson: number;
  activity: number;
  travel: number;
  students: ViewRow[];
  families: ViewRow[];
  subjects: ViewRow[];
}

export interface NameInfo {
  name: string;
  archived: boolean;
}

export interface ViewTotalsInput {
  sessions: readonly Session[];
  students: ReadonlyMap<string, NameInfo>;
  families: ReadonlyMap<string, NameInfo>;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const byNameThenId = (a: ViewRow, b: ViewRow): number => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const SUBJECT_ORDER: readonly Subject[] = ['swim', 'math'];
const SUBJECT_NAME: Record<Subject, string> = { swim: 'Swim', math: 'Math' };

function bump(rows: Map<string, ViewRow>, id: string, info: NameInfo | undefined, lesson: number, activity: number, travel: number): void {
  let row = rows.get(id);
  if (!row) {
    row = { id, name: info?.name ?? '', archived: info?.archived ?? false, lesson: 0, activity: 0, travel: 0 };
    rows.set(id, row);
  }
  row.lesson += lesson;
  row.activity += activity;
  row.travel += travel;
}

/**
 * VIEW-01, VIEW-02: the period's totals and the three breakdowns. Totals and Subject rows are actual minutes, once per
 * session. Family and Student rows use each family's credited minutes (D-17: half rounds up to a whole minute) and the
 * full travel of every session attended. Rows with no sessions never appear.
 */
export function computeViewTotals(input: ViewTotalsInput): ViewTotals {
  let lesson = 0;
  let activity = 0;
  let travel = 0;
  const students = new Map<string, ViewRow>();
  const families = new Map<string, ViewRow>();
  const subjects = new Map<Subject, ViewRow>();

  for (const s of input.sessions) {
    lesson += s.lessonMinutes;
    activity += s.activityMinutes;
    travel += s.travelMinutes;
    bump(subjects as Map<string, ViewRow>, s.subject, { name: SUBJECT_NAME[s.subject], archived: false }, s.lessonMinutes, s.activityMinutes, s.travelMinutes);

    const creditOf = (familyId: string) => {
      const c = s.credits.find((x) => x.familyId === familyId);
      return {
        lesson: creditedMinutes(s.lessonMinutes, c?.lesson ?? 'full'),
        activity: creditedMinutes(s.activityMinutes, c?.activity ?? 'full'),
      };
    };
    const seen = new Set<string>();
    for (const a of s.attendees) {
      const c = creditOf(a.familyId);
      bump(students, a.studentId, input.students.get(a.studentId), c.lesson, c.activity, s.travelMinutes);
      if (!seen.has(a.familyId)) {
        seen.add(a.familyId);
        bump(families, a.familyId, input.families.get(a.familyId), c.lesson, c.activity, s.travelMinutes);
      }
    }
  }

  return {
    lesson,
    activity,
    travel,
    students: [...students.values()].sort(byNameThenId),
    families: [...families.values()].sort(byNameThenId),
    subjects: SUBJECT_ORDER.filter((k) => subjects.has(k)).map((k) => subjects.get(k)!),
  };
}

/** Zero reads 'none'; otherwise the shared hour form "1.5 h (1:30)". */
export function viewAmount(minutes: number): string {
  return minutes === 0 ? 'none' : formatHours(minutes);
}

export function rowLines(row: Pick<ViewRow, 'lesson' | 'activity' | 'travel'>): [string, string, string] {
  return [`Lesson ${viewAmount(row.lesson)}`, `Activity ${viewAmount(row.activity)}`, `Travel ${viewAmount(row.travel)}`];
}

export type BreakdownKind = 'student' | 'family' | 'subject';

export function breakdownFooter(kind: BreakdownKind): string {
  return kind === 'subject'
    ? 'Subject rows count actual time once.'
    : 'Family and student rows use credited time. On a shared swim they can add up to more than the total.';
}

export const TOTALS_FOOTER = 'Travel appears in this view only. Family summaries never include it.';

/** The whole totals section is hidden when the period has no sessions. */
export function showPersonalTotals(sessionCount: number): boolean {
  return sessionCount > 0;
}
