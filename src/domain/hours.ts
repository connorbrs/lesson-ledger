/**
 * The one shared hour formatter (reused by Phase 4 text, PDF and overview totals).
 * Minutes may be whole or an exact half (half credit), so the work is done in integer half-minutes:
 * no floating-point division, and ties round half up.
 */
const halfMinutes = (minutes: number): number => Math.floor(minutes * 2 + 0.5);

/** "1.5 h (1:30)": decimal hours to 2 places (trailing zeros trimmed) and h:mm to the whole minute. */
export function formatHours(minutes: number): string {
  const half = halfMinutes(minutes);
  const hundredths = Math.floor((half * 100 + 60) / 120);
  const whole = Math.floor(hundredths / 100);
  const frac = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  const total = Math.floor((half + 1) / 2);
  const hm = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return `${frac ? `${whole}.${frac}` : whole} h (${hm})`;
}

/** Credited minutes: up to one decimal, trailing ".0" dropped ("22.5 min", "30 min"). */
export function formatMinutes(minutes: number): string {
  const tenths = Math.floor(minutes * 10 + 0.5);
  return `${tenths % 10 === 0 ? tenths / 10 : `${Math.floor(tenths / 10)}.${tenths % 10}`} min`;
}
