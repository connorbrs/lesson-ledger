import { formatCents, equalSplit, sumCents } from './money';
import { EXPENSE_DESCRIPTION_MAX, type ExpenseSplit } from './types';
import { codePointLength, normalizeName } from './validate';

/** A JSON-safe expense as held in form state: ids, strings and integers only, no Blob (D-01). */
export interface ExpenseDraft {
  id: string;
  description: string;
  amountCents: number;
  /** null means the equal default for the session's families. */
  splits: ExpenseSplit[] | null;
  photoIds: string[];
  createdAt: number;
}

export interface ResolvedExpense extends Omit<ExpenseDraft, 'splits'> {
  splits: ExpenseSplit[];
}

export type ExpenseTextCheck = { ok: true; value: string } | { ok: false };

/** Required after trim and NFC, at most 80 code points. */
export function validateExpenseText(raw: unknown): ExpenseTextCheck {
  const value = normalizeName(raw);
  if (value === '' || codePointLength(value) > EXPENSE_DESCRIPTION_MAX) return { ok: false };
  return { ok: true, value };
}

const isCents = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;

function equalShares(amountCents: number, familyIds: readonly string[]): ExpenseSplit[] | null {
  if (familyIds.length === 1) return [{ familyId: familyIds[0], cents: amountCents }];
  if (familyIds.length === 2) {
    const [a, b] = equalSplit(amountCents);
    return [
      { familyId: familyIds[0], cents: a },
      { familyId: familyIds[1], cents: b },
    ];
  }
  return null;
}

/**
 * The shares to store for a session's families (pick order). Null override or an override for different
 * families gives the equal split; an override for the same families must be valid, else null.
 */
export function resolveSplits(draft: Pick<ExpenseDraft, 'amountCents' | 'splits'>, familyIds: readonly string[]): ExpenseSplit[] | null {
  if (familyIds.length < 1 || familyIds.length > 2) return null;
  const { splits } = draft;
  const sameFamilies =
    Array.isArray(splits) && splits.length === familyIds.length && familyIds.every((f) => splits.some((s) => s && s.familyId === f));
  if (!sameFamilies) return equalShares(draft.amountCents, familyIds);
  const ordered = familyIds.map((f) => ({ familyId: f, cents: splits.find((s) => s.familyId === f)?.cents as number }));
  if (!ordered.every((s) => isCents(s.cents))) return null;
  return sumCents(ordered.map((s) => s.cents)) === draft.amountCents ? ordered : null;
}

export type ExpensesCheck = { ok: true; value: ResolvedExpense[] } | { ok: false; code: 'expenses-invalid' };

export function validateExpenseDrafts(drafts: readonly ExpenseDraft[], familyIds: readonly string[]): ExpensesCheck {
  const fail = { ok: false, code: 'expenses-invalid' } as const;
  if (!Array.isArray(drafts)) return fail;
  const ids = new Set<string>();
  const photoIds = new Set<string>();
  const value: ResolvedExpense[] = [];
  for (const d of drafts) {
    if (!d || typeof d.id !== 'string' || d.id === '' || ids.has(d.id)) return fail;
    ids.add(d.id);
    const text = validateExpenseText(d.description);
    if (!text.ok) return fail;
    if (!Number.isSafeInteger(d.amountCents) || d.amountCents <= 0) return fail;
    if (typeof d.createdAt !== 'number' || !Number.isFinite(d.createdAt) || d.createdAt < 0) return fail;
    if (!Array.isArray(d.photoIds)) return fail;
    for (const p of d.photoIds) {
      if (typeof p !== 'string' || p === '' || photoIds.has(p)) return fail;
      photoIds.add(p);
    }
    const splits = resolveSplits(d, familyIds);
    if (!splits) return fail;
    value.push({ id: d.id, description: text.value, amountCents: d.amountCents, splits, photoIds: [...d.photoIds], createdAt: d.createdAt });
  }
  return { ok: true, value };
}

export function expenseTotal(list: readonly { amountCents: number }[]): number {
  return sumCents(list.map((e) => e.amountCents));
}

const PLURAL = new Intl.PluralRules('en-US');

export function receiptsLabel(n: number): string {
  if (n === 0) return 'No receipts';
  return `${n} ${PLURAL.select(n) === 'one' ? 'receipt' : 'receipts'}`;
}

/** 'Smith $6.25 · Jones $6.25', or null below two shares. */
export function splitLine(splits: readonly ExpenseSplit[], familyNames: Record<string, string>): string | null {
  if (splits.length < 2) return null;
  return splits.map((s) => `${familyNames[s.familyId] ?? ''} ${formatCents(s.cents)}`.trim()).join(' · ');
}

export function formatExpensesLine(totalCents: number): string {
  return `Expenses ${formatCents(totalCents)}`;
}
