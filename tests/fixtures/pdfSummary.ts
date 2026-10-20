import { buildFamilySummary, summaryPeriod, type FamilySummary, type SummaryInput } from '../../src/domain/summary';
import type { Expense, Session } from '../../src/domain/types';

export const noPhotos = async () => {
  throw new Error('no photo expected');
};

export function trSession(over: Partial<Session> & Pick<Session, 'id' | 'date'>): Session {
  return {
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
  };
}

export function trSummary(over: { sessions?: Session[]; expenses?: Expense[]; photos?: Record<string, string[]>; familyName?: string; names?: Record<string, string> } = {}): FamilySummary {
  const input: SummaryInput = {
    familyId: 'smith',
    familyName: over.familyName ?? 'Smith',
    period: summaryPeriod('week', '2026-10-12'),
    sessions: over.sessions ?? [trSession({ id: 's1', date: '2026-10-12', lessonMinutes: 45, activityMinutes: 15 })],
    expenses: over.expenses ?? [],
    photoIdsByExpense: new Map(Object.entries(over.photos ?? {})),
    studentNames: over.names ?? { ava: 'Ava' },
  };
  return buildFamilySummary(input);
}
