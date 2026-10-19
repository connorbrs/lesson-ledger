/** Local calendar dates as YYYY-MM-DD strings. Built from local getters and integer math, never from UTC conversion. */

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function todayLocal(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Strict real-date check for YYYY-MM-DD, leap years included. */
export function isValidYmd(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** HH:MM, 00:00 to 23:59. */
export function isValidTime(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

const dateFormat = (withYear: boolean) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

/** "Today" for today, else "Mon, Oct 12" (year appended when not the current year). Formats in UTC from the parsed parts, so the host time zone cannot shift it. */
export function formatDateValue(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'Today';
  const [y, m, d] = ymd.split('-').map(Number);
  return dateFormat(ymd.slice(0, 4) !== todayYmd.slice(0, 4)).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "16:30" to "4:30 PM". */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "HH:MM" to minutes since midnight. The caller has already validated the string. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minutes since midnight to "HH:MM"; null outside 0 to 1439, so a time past midnight is null. */
export function minutesToTime(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return null;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** The local hour and minute as "HH:MM", seconds dropped. */
export function currentHHMM(now: Date = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Minutes as h:mm with unpadded hours: 47 gives "0:47", 105 gives "1:45". */
export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

/* ---------- Periods (Mon-Sun weeks, calendar months) ---------- */

export type PeriodKind = 'week' | 'month';
export interface PeriodRange {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Whole days since 1970-01-01. UTC is used only as a calendar here, so no host time zone can shift a day. */
const dayNumber = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const ymdOf = (n: number): string => {
  const t = new Date(n * DAY_MS);
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
/** Monday = 0 through Sunday = 6. 1970-01-01 (day 0) was a Thursday. */
const weekdayIndex = (n: number): number => (((n + 3) % 7) + 7) % 7;

/** The Monday-to-Sunday week or the calendar month that contains `anchor`. */
export function periodRange(kind: PeriodKind, anchor: string): PeriodRange {
  if (kind === 'week') {
    const start = dayNumber(anchor) - weekdayIndex(dayNumber(anchor));
    return { start: ymdOf(start), end: ymdOf(start + 6) };
  }
  const [y, m] = anchor.split('-').map(Number);
  const ym = anchor.slice(0, 7);
  return { start: `${ym}-01`, end: `${ym}-${pad(daysInMonth(y, m))}` };
}

/** Moves the anchor one period. A week is 7 days; a month keeps the day, clamped to the target month's length. */
export function shiftPeriod(kind: PeriodKind, anchor: string, delta: number): string {
  if (kind === 'week') return ymdOf(dayNumber(anchor) + 7 * delta);
  const [y, m, d] = anchor.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${pad(ny, 4)}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

const shortDay = (ymd: string) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8))}`;

/** "Oct 19 – 25", "Oct 27 – Nov 2", "October 2026"; a week outside the current year gets ", YYYY" (on both ends when it crosses a year). */
export function rangeLabel(range: PeriodRange, kind: PeriodKind, todayYmd: string): string {
  const y1 = range.start.slice(0, 4);
  if (kind === 'month') return `${MONTHS_LONG[Number(range.start.slice(5, 7)) - 1]} ${y1}`;
  const y2 = range.end.slice(0, 4);
  if (y1 !== y2) return `${shortDay(range.start)}, ${y1} – ${shortDay(range.end)}, ${y2}`;
  const sameMonth = range.start.slice(5, 7) === range.end.slice(5, 7);
  const body = sameMonth ? `${shortDay(range.start)} – ${Number(range.end.slice(8))}` : `${shortDay(range.start)} – ${shortDay(range.end)}`;
  return y1 === todayYmd.slice(0, 4) ? body : `${body}, ${y1}`;
}

/** Inclusive on both ends. */
export const containsDate = (range: PeriodRange, ymd: string): boolean => range.start <= ymd && ymd <= range.end;

/** "Mon, Oct 19" (no year: the period label carries it). */
export function formatDayHeader(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${WEEKDAYS[weekdayIndex(dayNumber(ymd))]}, ${MONTHS[m - 1]} ${d}`;
}

/** The local calendar date of an epoch-ms instant. */
export const localYmdFromMs = (ms: number): string => todayLocal(new Date(ms));

/** Whole local calendar days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier). */
export const daysBetween = (fromYmd: string, toYmd: string): number => dayNumber(toYmd) - dayNumber(fromYmd);
