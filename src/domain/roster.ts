import type { DefaultSubject, Period } from './types';

/** Result of a guarded hard delete. */
export type DeleteResult = { ok: true } | { ok: false; reason: 'has-students' | 'has-history' | 'not-found' };

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Case-insensitive name order; ties by createdAt ascending, then id, so the order is stable. */
export function compareRoster(
  a: { name: string; createdAt: number; id: string },
  b: { name: string; createdAt: number; id: string },
): number {
  return collator.compare(a.name, b.name) || a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function periodLabel(period: Period): string {
  return period === 'weekly' ? 'Weekly · Monday to Sunday' : 'Monthly · calendar month';
}

const plural = new Intl.PluralRules('en');

export function studentCountLabel(count: number): string {
  return `${count} ${plural.select(count) === 'one' ? 'student' : 'students'}`;
}

export function subjectLabel(subject: DefaultSubject): string {
  return subject === 'swim' ? 'Swim' : subject === 'math' ? 'Math' : 'Both';
}

/** The note under an archived family that cannot be deleted (backlog 999.1: lesson history wins over the other two). */
export function blockedFamilyNote(f: { hasArchivedStudents: boolean; hasArchivedStudentWithHistory: boolean; hasSessions?: boolean }): string {
  if (f.hasArchivedStudentWithHistory) return "This family has archived students with lesson history, so it can't be deleted.";
  if (f.hasSessions) return "This family has lesson history, so it can't be deleted.";
  if (f.hasArchivedStudents) return 'This family still has students. Delete its archived students first.';
  return 'This family still has active students. Restore it to manage them.';
}
