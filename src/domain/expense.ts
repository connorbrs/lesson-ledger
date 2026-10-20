import { equalSplit, formatCents, parseAmountToCents, sumCents } from './money';
import { EXPENSE_DESCRIPTION_MAX, type Expense, type ExpenseSplit } from './types';
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

/**
 * The draft a stored expense edits as. Shares equal to the equal split become null, so the default keeps
 * following the amount, except an odd-cent split between two families: its extra cent depends on pick
 * order, so the stored shares are kept as an override and re-picking the same families never moves it.
 */
export function draftFromExpense(expense: Expense, photoIds: readonly string[], familyIds: readonly string[]): ExpenseDraft {
  const equal = equalShares(expense.amountCents, familyIds);
  const orderFree = equal !== null && equal.every((s) => s.cents === equal[0].cents);
  const isEqual =
    equal !== null &&
    orderFree &&
    equal.length === expense.splits.length &&
    equal.every((s, i) => s.familyId === expense.splits[i].familyId && s.cents === expense.splits[i].cents);
  return {
    id: expense.id,
    description: expense.description,
    amountCents: expense.amountCents,
    splits: isEqual ? null : expense.splits.map((s) => ({ ...s })),
    photoIds: [...photoIds],
    createdAt: expense.createdAt,
  };
}

/** Rewrites the family ids of non-null splits through the map (unmapped ids unchanged). */
export function remapSplitFamilies(drafts: readonly ExpenseDraft[], remap: ReadonlyMap<string, string>): ExpenseDraft[] {
  return drafts.map((d) => (d.splits === null ? d : { ...d, splits: d.splits.map((s) => ({ ...s, familyId: remap.get(s.familyId) ?? s.familyId })) }));
}

export interface SaveGate {
  amountText: string;
  description: string;
  /** Photos still being processed. */
  processing?: number;
  /** A share caption is showing. */
  shareError?: boolean;
}

/** The expense editor's Save is enabled only when this is true. */
export function canSaveExpense({ amountText, description, processing = 0, shareError = false }: SaveGate): boolean {
  const cents = parseAmountToCents(amountText);
  return cents !== null && cents > 0 && validateExpenseText(description).ok && processing === 0 && shareError !== true;
}

/** The caption under the amount field, or null. A blank untouched field stays quiet. */
export function amountCaption(text: string, touched: boolean): string | null {
  if (text.trim() === '' && !touched) return null;
  const cents = parseAmountToCents(text);
  if (cents === null) return 'Use dollars and cents, like 12.50.';
  return cents === 0 ? 'Amount must be more than $0.00.' : null;
}

export function expensesFooterText(expenses: readonly { amountCents: number }[]): string {
  return expenses.length === 0 ? 'Expenses are saved with this session.' : `Total ${formatCents(expenseTotal(expenses))}.`;
}

const plural = (n: number, one: string, many: string) => `${n} ${PLURAL.select(n) === 'one' ? one : many}`;

/** The Delete Session alert message: names the expenses and receipt photos that go with it (D-05). */
export function sessionDeleteMessage(counts: { expenses: number; photos: number }): string {
  if (counts.expenses === 0) return "This can't be undone.";
  const what = plural(counts.expenses, 'expense', 'expenses');
  const photos = counts.photos > 0 ? ` and ${plural(counts.photos, 'receipt photo', 'receipt photos')}` : '';
  return `This also deletes ${what}${photos}. This can't be undone.`;
}

/** The Delete Expense alert message, or undefined when the expense has no photos. */
export function deleteExpenseMessage(photos: number): string | undefined {
  return photos === 0 ? undefined : `This also deletes ${plural(photos, 'receipt photo', 'receipt photos')}.`;
}

const sameShares = (a: readonly ExpenseSplit[] | null, b: readonly ExpenseSplit[] | null) =>
  a === null || b === null ? a === b : a.length === b.length && a.every((s, i) => s.familyId === b[i].familyId && s.cents === b[i].cents);

/**
 * True when Back from the Expense editor must ask before closing. Splits and photo ids are compared only
 * when given (null splits means the equal default).
 */
export function expenseEditorDirty(
  initial: ExpenseDraft | null,
  amountText: string,
  description: string,
  splits?: readonly ExpenseSplit[] | null,
  photoIds?: readonly string[],
): boolean {
  if (initial === null) return amountText.trim() !== '' || description.trim() !== '' || (splits ?? null) !== null || (photoIds ?? []).length > 0;
  if (parseAmountToCents(amountText) !== initial.amountCents) return true;
  if (normalizeName(description) !== initial.description) return true;
  if (splits !== undefined && !sameShares(splits, initial.splits)) return true;
  if (photoIds !== undefined && (photoIds.length !== initial.photoIds.length || photoIds.some((p, i) => p !== initial.photoIds[i]))) return true;
  return false;
}
