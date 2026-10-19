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
