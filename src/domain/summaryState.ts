/**
 * Pure state rules for the Family Summary: the Sent group, the status pill on the Summaries rows and the editable
 * message box, plus the exact UI copy. No database, no clock, no Intl time formatting (D-14, D-15).
 */
import { currentHHMM, formatTime12, localYmdFromMs } from './dates';
import { formatMonthDay } from './summary';
import type { PeriodRecord } from './types';

/* ---------- Sent tracking ---------- */

export type SentStatus = 'not-sent' | 'sent' | 'changed';

export const MARK_FAILED = "Couldn't mark as sent. Nothing was changed. Try again.";
const SENT_FOOTER = 'Marking as sent records this only. Copy and Share never mark it.';

/**
 * The only rule for sent status. No record, or a record without a sent mark (a saved message alone), is not sent.
 * A sent mark is current while its fingerprint equals the summary's; any parent-visible change makes it 'changed',
 * and reverting the change returns it to 'sent'.
 */
export function sentStatus(record: PeriodRecord | undefined, fingerprint: string): SentStatus {
  if (!record || record.sentAt === null) return 'not-sent';
  return record.sentFingerprint === fingerprint ? 'sent' : 'changed';
}

/** "Oct 19, 2:40 PM" from the local date and time of the instant. Built from local getters, never Intl time formatting. */
export function formatSentAt(ms: number): string {
  return `${formatMonthDay(localYmdFromMs(ms))}, ${formatTime12(currentHHMM(new Date(ms)))}`;
}

export function statusValueText(status: SentStatus, sentAt: number | null): string {
  if (status === 'changed') return 'Changed since sent';
  if (status === 'sent' && sentAt !== null) return `Sent ${formatSentAt(sentAt)}`;
  return 'Not sent';
}

export interface SentAction {
  label: string;
  kind: 'mark' | 'unmark';
  tone: 'accent' | 'neutral';
}

export function sentAction(status: SentStatus): SentAction {
  if (status === 'sent') return { label: 'Mark as Not Sent', kind: 'unmark', tone: 'neutral' };
  return { label: status === 'changed' ? 'Mark as Sent Again' : 'Mark as Sent', kind: 'mark', tone: 'accent' };
}

/** The Summaries row pill: none, 'Sent' or 'Changed since sent'. */
export function statusPill(status: SentStatus): 'Sent' | 'Changed since sent' | null {
  if (status === 'sent') return 'Sent';
  if (status === 'changed') return 'Changed since sent';
  return null;
}

export function sentFooterText(failed: boolean): string {
  return failed ? MARK_FAILED : SENT_FOOTER;
}
