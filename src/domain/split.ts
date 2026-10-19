import { centsToInput, equalSplit, formatCents, parseAmountToCents, sumCents } from './money';
import type { ExpenseSplit } from './types';

/** Why a typed share was rejected: not dollars and cents, or more than the whole expense. */
export interface ShareError {
  index: 0 | 1;
  kind: 'invalid' | 'above-total';
}

/**
 * The editor's split inputs once a share has been typed. `texts` are what the two fields show;
 * `splits` is the override to store (null: the equal default, or an error is showing).
 */
export interface ShareState {
  texts: [string, string];
  splits: ExpenseSplit[] | null;
  error: ShareError | null;
}

export function equalShareTexts(total: number): [string, string] {
  const [a, b] = equalSplit(total);
  return [centsToInput(a), centsToInput(b)];
}

/** Field texts for stored shares (matched to families by id, in pick order); null is the equal split. */
export function shareTextsFor(total: number, familyIds: readonly [string, string], splits: readonly ExpenseSplit[] | null): [string, string] {
  if (splits === null) return equalShareTexts(total);
  const cents = familyIds.map((f) => splits.find((s) => s.familyId === f)?.cents ?? 0);
  return [centsToInput(cents[0]), centsToInput(cents[1])];
}

/**
 * One field was typed. The edited text stays as typed; a valid input sets that family's share and the
 * other becomes total minus it, so the pair always sums to the total. Equal values mean the default (null).
 */
export function applyShareInput(
  total: number,
  familyIds: readonly [string, string],
  current: readonly [string, string],
  index: 0 | 1,
  text: string,
): ShareState {
  const other = index === 0 ? 1 : 0;
  const keep = (error: ShareError): ShareState => {
    const texts: [string, string] = [current[0], current[1]];
    texts[index] = text;
    return { texts, splits: null, error };
  };
  const typed = parseAmountToCents(text);
  if (typed === null) return keep({ index, kind: 'invalid' });
  if (typed > total) return keep({ index, kind: 'above-total' });
  const rest = total - typed;
  const cents: [number, number] = [0, 0];
  cents[index] = typed;
  cents[other] = rest;
  const texts: [string, string] = ['', ''];
  texts[index] = text;
  texts[other] = centsToInput(rest);
  const [firstEqual, secondEqual] = equalSplit(total);
  const isEqual = cents[0] === firstEqual && cents[1] === secondEqual;
  return {
    texts,
    splits: isEqual ? null : [{ familyId: familyIds[0], cents: cents[0] }, { familyId: familyIds[1], cents: cents[1] }],
    error: null,
  };
}

export function shareCaption(error: ShareError, total: number): string {
  return error.kind === 'invalid' ? 'Use dollars and cents, like 6.25.' : `A share can't be more than ${formatCents(total)}.`;
}

/**
 * The share state an existing expense opens with. Null when it has no override, when its shares are not
 * exactly these two families' or do not sum to the total, or when they equal the equal split.
 */
export function initialShareState(total: number, familyIds: readonly [string, string], splits: readonly ExpenseSplit[] | null): ShareState | null {
  if (splits === null || splits.length !== 2) return null;
  const ordered = familyIds.map((f) => splits.find((s) => s.familyId === f));
  if (ordered.some((s) => s === undefined)) return null;
  const shares = ordered as ExpenseSplit[];
  if (!shares.every((s) => Number.isSafeInteger(s.cents) && s.cents >= 0)) return null;
  if (sumCents(shares.map((s) => s.cents)) !== total) return null;
  const [a, b] = equalSplit(total);
  if (shares[0].cents === a && shares[1].cents === b) return null;
  return { texts: shareTextsFor(total, familyIds, shares), splits: shares.map((s) => ({ ...s })), error: null };
}

/** True while an unequal override is held: the only time 'Split Equally' is shown. */
export function splitIsOverridden(share: ShareState | null): boolean {
  return share !== null && share.splits !== null;
}
