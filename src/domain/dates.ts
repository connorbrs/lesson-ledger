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
