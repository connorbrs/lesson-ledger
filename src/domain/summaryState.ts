/**
 * Pure state rules for the Family Summary: the Sent group, the status pill on the Summaries rows, the editable
 * message box and the Share PDF button, plus the exact UI copy. No database, no clock, no Intl time formatting (D-14, D-15).
 */
import { currentHHMM, formatTime12, localYmdFromMs } from './dates';
import { PdfBuildError } from './pdfContent';
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

/* ---------- The editable message box (D-08, D-09) ---------- */

export const STALE_BANNER = 'Hours changed since you edited this message';
export const REBUILD_TITLE = 'Rebuild this message?';
export const REBUILD_MESSAGE = 'Your edits are replaced with a message from the current hours. Nothing is saved until you tap Save Message.';
export const DISCARD_TITLE = 'Discard changes to this message?';
export const SAVE_FAILED = "Couldn't save the message. Your phone may be low on storage. Nothing was changed. Try again.";
export const COPY_FAILED = "Couldn't copy. Select the text and copy it by hand. Nothing was changed.";
export const MESSAGE_FOOTER = 'Edit any line. Copy uses the text in this box, saved or not. Save Message keeps it for next time.';

/** Unsaved text held by the app. `rebuilt` marks a text that came from Rebuild Message, which is savable even when it equals the saved text. */
export interface MessageDraft {
  text: string;
  rebuilt: boolean;
}

export interface MessageView {
  text: string;
  /** The saved message was written against other hours and the user has not started editing it. */
  stale: boolean;
  canSave: boolean;
  /** The box differs from what is stored (or from the generated text when nothing is stored): leaving needs the discard dialog. */
  dirty: boolean;
}

/**
 * What the message box shows and which actions are on. The stored message is never replaced here: it changes only
 * through Save Message. There is deliberately no warnings input (D-16): warnings never block Copy or Share.
 */
export function messageView(args: { generated: string; record: PeriodRecord | undefined; fingerprint: string; draft: MessageDraft | null }): MessageView {
  const { generated, record, fingerprint, draft } = args;
  const saved = record?.message ?? null;
  const baseline = saved ?? generated;
  const changed = draft !== null && (draft.rebuilt || draft.text !== baseline);
  const text = draft ? draft.text : baseline;
  return {
    text,
    stale: saved !== null && draft === null && record!.messageFingerprint !== fingerprint,
    canSave: changed && text.trim() !== '',
    dirty: changed,
  };
}

/* ---------- Share PDF (D-13, D-16, D-18) ---------- */

export const PDF_FAILED = "Couldn't make the PDF. Nothing was changed. Try again.";
export const PDF_TOO_LARGE = 'This PDF is too large to build on this phone. Nothing was changed. Try a shorter period.';
export const SHARE_FAILED = "Couldn't share the PDF. Nothing was changed. Try again.";

/** The pre-built PDF's state. The file type is structural so this module stays free of DOM globals. */
export type PdfStatus = { kind: 'preparing' } | { kind: 'ready'; file: File } | { kind: 'failed'; error: unknown };

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded' | 'failed';

/**
 * Identity of one PDF build. It holds everything the PDF reads (family, period, the summary fingerprint, the printed
 * name) and a retry counter, and deliberately not the message text: the PDF never reads the message (D-13). Fields are
 * JSON-encoded so no value can imitate a separator, and a missing name differs from any typed name.
 */
export function pdfBuildKey(args: { familyId: string; periodKey: string; fingerprint: string; instructorName: string | null; attempt: number }): string {
  return JSON.stringify([args.familyId, args.periodKey, args.fingerprint, args.instructorName, args.attempt]);
}

/** Warnings never block Share (D-16), so only the PDF status decides the button. */
export function shareButtonState(status: Pick<PdfStatus, 'kind'>): { label: string; disabled: boolean } {
  if (status.kind === 'preparing') return { label: 'Preparing PDF\u2026', disabled: true };
  return { label: 'Share PDF', disabled: false };
}

/** A tap on a ready PDF shares it; after a failed build it rebuilds; while preparing it does nothing. */
export function shareAction(status: Pick<PdfStatus, 'kind'>): 'share' | 'build' | 'none' {
  if (status.kind === 'ready') return 'share';
  if (status.kind === 'failed') return 'build';
  return 'none';
}

export function pdfFailureCaption(error: unknown): string {
  return error instanceof PdfBuildError && error.code === 'too-large' ? PDF_TOO_LARGE : PDF_FAILED;
}

export function shareResultCaption(outcome: ShareOutcome, fileName: string): string | null {
  if (outcome === 'downloaded') return `Downloaded ${fileName}.`;
  if (outcome === 'failed') return SHARE_FAILED;
  return null;
}

export interface FooterCaption {
  text: string;
  tone: 'destructive' | 'secondary';
}

/** The line above the Share PDF button: a build failure, else the last share outcome, else nothing. */
export function footerCaption(args: { status: Pick<PdfStatus, 'kind'> & { error?: unknown }; share: ShareOutcome | null; fileName: string }): FooterCaption | null {
  const { status, share, fileName } = args;
  if (status.kind === 'preparing') return null;
  if (status.kind === 'failed') return { text: pdfFailureCaption(status.error), tone: 'destructive' };
  if (share === null) return null;
  const text = shareResultCaption(share, fileName);
  if (text === null) return null;
  return { text, tone: share === 'failed' ? 'destructive' : 'secondary' };
}
