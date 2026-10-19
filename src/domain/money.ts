/** Money is integer cents, never floats (D-02). Everything here is exact integer arithmetic. */

const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * '12', '12.5', '$12.50', '6.' and '.5' parse; three decimals, commas, signs, exponents and anything
 * whose cents are not a safe integer give null. Never rounds.
 */
export function parseAmountToCents(raw: string): number | null {
  let t = raw.trim();
  if (t.startsWith('$')) t = t.slice(1);
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const whole = m[1];
  const fraction = m[2] ?? '';
  if (whole === '' && fraction === '') return null;
  const cents = BigInt(whole === '' ? '0' : whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return cents <= MAX_CENTS ? Number(cents) : null;
}

/** '$12.50', '$1,000.00', '$0.05' from non-negative integer cents. */
export function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${grouped}.${String(rest).padStart(2, '0')}`;
}

/** Editable text for an amount field: '12.50' (no symbol, no separators). */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export function sumCents(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Two shares that sum to the total; any odd cent goes to the first (pick order). */
export function equalSplit(total: number): [number, number] {
  const first = total - Math.floor(total / 2);
  return [first, total - first];
}

/** The first family's share is chosen; the second gets the rest. Null unless 0 <= aCents <= total (safe integers). */
export function overrideSplit(total: number, aCents: number): [number, number] | null {
  if (!Number.isSafeInteger(aCents) || aCents < 0 || aCents > total) return null;
  return [aCents, total - aCents];
}
