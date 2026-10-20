import { db } from './db';
import { listActiveFamilies } from './families';
import { shiftPeriod, periodRange } from '../domain/dates';
import { buildFamilySummary, summaryPeriod, type FamilySummary, type SummaryInput, type SummaryPeriod } from '../domain/summary';
import type { Family, Period } from '../domain/types';

/** Read-only loaders: stored rows are read in one transaction and turned into the pure summary model. */

const READ_TABLES = () => [db.families, db.students, db.sessions, db.expenses, db.attachments] as const;

async function readSummaryInput(family: Family, period: SummaryPeriod): Promise<SummaryInput> {
  return db.transaction('r', READ_TABLES(), async () => {
    const sessions = await db.sessions
      .where('date')
      .between(period.start, period.end, true, true)
      .filter((s) => s.attendees.some((a) => a.familyId === family.id))
      .toArray();
    const expenses = sessions.length > 0 ? await db.expenses.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray() : [];

    // Only ids and createdAt are kept: no Blob content is read.
    const photos = new Map<string, { id: string; createdAt: number }[]>();
    if (expenses.length > 0) {
      await db.attachments
        .where('expenseId')
        .anyOf(expenses.map((e) => e.id))
        .each((a) => {
          const list = photos.get(a.expenseId);
          if (list) list.push({ id: a.id, createdAt: a.createdAt });
          else photos.set(a.expenseId, [{ id: a.id, createdAt: a.createdAt }]);
        });
    }
    const photoIdsByExpense = new Map<string, string[]>();
    for (const [expenseId, list] of photos) {
      list.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      photoIdsByExpense.set(expenseId, list.map((p) => p.id));
    }

    const studentIds = [...new Set(sessions.flatMap((s) => s.attendees.filter((a) => a.familyId === family.id).map((a) => a.studentId)))];
    const students = studentIds.length > 0 ? await db.students.bulkGet(studentIds) : [];
    const studentNames: Record<string, string> = {};
    for (const st of students) if (st) studentNames[st.id] = st.name;

    return { familyId: family.id, familyName: family.name, period, sessions, expenses, photoIdsByExpense, studentNames };
  });
}

/** The summary input for one family and period, or undefined when the family is missing. */
export async function loadSummaryInput(familyId: string, period: SummaryPeriod): Promise<SummaryInput | undefined> {
  const family = await db.families.get(familyId);
  return family ? readSummaryInput(family, period) : undefined;
}

const kindOf = (p: Period) => (p === 'weekly' ? 'week' : 'month');

/** The most recent complete week or month before today, per the family's period setting (SUM-01). */
function defaultPeriodFor(p: Period, todayYmd: string): SummaryPeriod {
  const kind = kindOf(p);
  return { kind, ...periodRange(kind, shiftPeriod(kind, todayYmd, -1)) };
}

export interface FamilyView {
  kind: 'week' | 'month';
  defaultPeriod: SummaryPeriod;
  summary: FamilySummary;
}

/** The family's summary for the period containing anchorYmd, or its default period when anchorYmd is null. Null when the family is gone. */
export async function loadFamilyView(familyId: string, anchorYmd: string | null, todayYmd: string): Promise<FamilyView | null> {
  return db.transaction('r', READ_TABLES(), async () => {
    const family = await db.families.get(familyId);
    if (!family) return null;
    const kind = kindOf(family.period);
    const defaultPeriod = defaultPeriodFor(family.period, todayYmd);
    const period = anchorYmd === null ? defaultPeriod : summaryPeriod(kind, anchorYmd);
    return { kind, defaultPeriod, summary: buildFamilySummary(await readSummaryInput(family, period)) };
  });
}

export interface SummaryListItem {
  familyId: string;
  name: string;
  kind: Period;
  period: SummaryPeriod;
  summary: FamilySummary;
}

/** One item per active family in People order, each at its default period. */
export async function loadSummaryList(todayYmd: string): Promise<SummaryListItem[]> {
  return db.transaction('r', READ_TABLES(), async () => {
    const items: SummaryListItem[] = [];
    for (const family of await listActiveFamilies()) {
      const period = defaultPeriodFor(family.period, todayYmd);
      items.push({ familyId: family.id, name: family.name, kind: family.period, period, summary: buildFamilySummary(await readSummaryInput(family, period)) });
    }
    return items;
  });
}
