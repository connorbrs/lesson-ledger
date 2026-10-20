/**
 * Turkish parent-facing labels (D-01, D-04). Pure: every label comes from Intl 'tr-TR' with timeZone 'UTC'
 * over a Date.UTC calendar date, so the host time zone can never move a day.
 */
import type { PeriodKind, PeriodRange } from './dates';
import type { Subject } from './types';

export const SUBJECT_TR: Record<Subject, string> = { swim: 'Yüzme', math: 'Matematik' };

const shortDate = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const longMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', timeZone: 'UTC' });

const utcDate = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const partsOf = (f: Intl.DateTimeFormat, ymd: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(utcDate(ymd))) out[p.type] = p.value;
  return out;
};

/** "Pzt 12 Eki": weekday first (the tr-TR default order puts it last, so the parts are assembled here). */
export function formatSessionDateTr(ymd: string): string {
  const p = partsOf(shortDate, ymd);
  return `${p.weekday} ${p.day} ${p.month}`;
}

const monthTr = (ymd: string): string => partsOf(longMonth, ymd).month;
const dayOf = (ymd: string): number => Number(ymd.slice(8));

/** "12–18 Ekim 2026", "28 Eylül – 4 Ekim 2026", "28 Aralık 2026 – 3 Ocak 2027", month "Ekim 2026". */
export function formatPeriodLabelTr(kind: PeriodKind, range: PeriodRange): string {
  const { start, end } = range;
  const y1 = start.slice(0, 4);
  if (kind === 'month') return `${monthTr(start)} ${y1}`;
  const y2 = end.slice(0, 4);
  if (y1 !== y2) return `${dayOf(start)} ${monthTr(start)} ${y1} – ${dayOf(end)} ${monthTr(end)} ${y2}`;
  if (start.slice(5, 7) === end.slice(5, 7)) return `${dayOf(start)}–${dayOf(end)} ${monthTr(end)} ${y1}`;
  return `${dayOf(start)} ${monthTr(start)} – ${dayOf(end)} ${monthTr(end)} ${y1}`;
}

const FOLD: Record<string, string> = {
  Ş: 'S', ş: 's', Ğ: 'G', ğ: 'g', İ: 'I', ı: 'i', Ç: 'C', ç: 'c', Ö: 'O', ö: 'o', Ü: 'U', ü: 'u',
};

/** Replaces the twelve Turkish letters, preserving case. The caller lowercases afterwards (lowercasing İ first would add a combining dot). */
export function foldTurkishAscii(text: string): string {
  return text.replace(/[ŞşĞğİıÇçÖöÜü]/g, (c) => FOLD[c]);
}
