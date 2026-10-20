/**
 * The one shared hour formatter (reused by Phase 4 text, PDF and overview totals).
 * Minutes are whole (credited time rounds half up to a whole minute, D-17), but the work is still done in
 * integer half-minutes: no floating-point division, and ties round half up.
 */
const halfMinutes = (minutes: number): number => Math.floor(minutes * 2 + 0.5);

export interface HoursParts {
  whole: number;
  /** Trimmed fraction digits ("5" for .50, "25" for .25); empty when there is none. */
  frac: string;
  /** "h:mm" to the whole minute. */
  hm: string;
}

/** The rounding core shared by the English and Turkish formatters: decimal hours to 2 places and h:mm. */
export function hoursParts(minutes: number): HoursParts {
  const half = halfMinutes(minutes);
  const hundredths = Math.floor((half * 100 + 60) / 120);
  const whole = Math.floor(hundredths / 100);
  const frac = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  const total = Math.floor((half + 1) / 2);
  const hm = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return { whole, frac, hm };
}

/** "1.5 h (1:30)": decimal hours to 2 places (trailing zeros trimmed) and h:mm to the whole minute. */
export function formatHours(minutes: number): string {
  const { whole, frac, hm } = hoursParts(minutes);
  return `${frac ? `${whole}.${frac}` : whole} h (${hm})`;
}

/** Parent-facing variant (D-02): decimal comma and the word saat, "1,5 saat (1:30)". Same rounding as formatHours. */
export function formatHoursTr(minutes: number): string {
  const { whole, frac, hm } = hoursParts(minutes);
  return `${frac ? `${whole},${frac}` : whole} saat (${hm})`;
}

/** Credited minutes: up to one decimal, trailing ".0" dropped ("22.5 min", "30 min"). */
export function formatMinutes(minutes: number): string {
  const tenths = Math.floor(minutes * 10 + 0.5);
  return `${tenths % 10 === 0 ? tenths / 10 : `${Math.floor(tenths / 10)}.${tenths % 10}`} min`;
}
