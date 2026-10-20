import { describe, expect, it } from 'vitest';
import { PdfBuildError } from '../src/domain/pdfContent';
import type { PeriodRecord } from '../src/domain/types';
import {
  COPY_FAILED,
  DISCARD_TITLE,
  draftBasis,
  footerCaption,
  formatSentAt,
  MARK_FAILED,
  MESSAGE_FOOTER,
  messageView,
  PDF_FAILED,
  PDF_TOO_LARGE,
  pdfBuildKey,
  pdfFailureCaption,
  REBUILD_MESSAGE,
  REBUILD_TITLE,
  sendChecklist,
  sendChecklistLabel,
  SAVE_FAILED,
  SHARE_FAILED,
  shareAction,
  shareButtonState,
  shareResultCaption,
  sentAction,
  sentFooterText,
  sentStatus,
  STALE_BANNER,
  statusPill,
  statusValueText,
  summaryRowStatus,
} from '../src/domain/summaryState';

const F1 = 'a1b2c3d4e5f60a';
const F2 = '0123456789abcd';

const record = (over: Partial<PeriodRecord>): PeriodRecord => ({
  id: 'fam_W2026-10-12',
  familyId: 'fam',
  periodKey: 'W2026-10-12',
  message: null,
  messageFingerprint: null,
  messageSavedAt: null,
  sentAt: null,
  sentFingerprint: null,
  updatedAt: 1,
  ...over,
});

// Local-constructor instants so the tests hold in every time zone.
const at = (h: number, m: number) => new Date(2026, 9, 19, h, m).getTime();

describe('sentStatus (D-14, D-15, SUM-08)', () => {
  it('is not-sent without a record', () => {
    expect(sentStatus(undefined, F1)).toBe('not-sent');
  });

  it('is not-sent for a record with only a saved message', () => {
    expect(sentStatus(record({ message: 'x', messageFingerprint: F1, messageSavedAt: 5 }), F1)).toBe('not-sent');
    expect(sentStatus(record({ message: 'x', messageFingerprint: F1, messageSavedAt: 5 }), F2)).toBe('not-sent');
  });

  it('is sent when sentAt is set and the fingerprints match', () => {
    expect(sentStatus(record({ sentAt: 10, sentFingerprint: F1 }), F1)).toBe('sent');
  });

  it('is changed when sentAt is set and the fingerprints differ', () => {
    expect(sentStatus(record({ sentAt: 10, sentFingerprint: F1 }), F2)).toBe('changed');
  });
});

describe('formatSentAt', () => {
  it('formats local date and 12-hour time', () => {
    expect(formatSentAt(at(14, 40))).toBe('Oct 19, 2:40 PM');
    expect(formatSentAt(at(0, 5))).toBe('Oct 19, 12:05 AM');
    expect(formatSentAt(at(12, 0))).toBe('Oct 19, 12:00 PM');
  });

  it('uses a plain space before AM/PM (no narrow no-break space)', () => {
    expect(formatSentAt(at(9, 3))).not.toMatch(/[  ]/);
  });
});

describe('statusValueText', () => {
  it('not-sent gives Not sent', () => expect(statusValueText('not-sent', null)).toBe('Not sent'));
  it('sent gives the date and time', () => expect(statusValueText('sent', at(14, 40))).toBe('Sent Oct 19, 2:40 PM'));
  it('changed gives no date', () => expect(statusValueText('changed', at(14, 40))).toBe('Changed since sent'));
});

describe('sentAction', () => {
  it('maps each status to its label, kind and tone', () => {
    expect(sentAction('not-sent')).toEqual({ label: 'Mark as Sent', kind: 'mark', tone: 'accent' });
    expect(sentAction('changed')).toEqual({ label: 'Mark as Sent Again', kind: 'mark', tone: 'accent' });
    expect(sentAction('sent')).toEqual({ label: 'Mark as Not Sent', kind: 'unmark', tone: 'neutral' });
  });
});

describe('statusPill and sentFooterText', () => {
  it('pill is null, Sent or Changed since sent', () => {
    expect(statusPill('not-sent')).toBeNull();
    expect(statusPill('sent')).toBe('Sent');
    expect(statusPill('changed')).toBe('Changed since sent');
  });

  it('footer text', () => {
    expect(sentFooterText(false)).toBe('Marking as sent records this only. Copy and Share never mark it.');
    expect(sentFooterText(true)).toBe("Couldn't mark as sent. Nothing was changed. Try again.");
    expect(MARK_FAILED).toBe("Couldn't mark as sent. Nothing was changed. Try again.");
  });
});

describe('summaryRowStatus', () => {
  it('shows Not sent and the warning count only when the period has sessions', () => {
    expect(summaryRowStatus({ hasSessions: true, status: 'not-sent', warningCount: 0 })).toEqual({ pill: 'Not sent', warnings: null });
    expect(summaryRowStatus({ hasSessions: true, status: 'not-sent', warningCount: 1 })).toEqual({ pill: 'Not sent', warnings: '1 warning' });
    expect(summaryRowStatus({ hasSessions: true, status: 'not-sent', warningCount: 2 })).toEqual({ pill: 'Not sent', warnings: '2 warnings' });
    expect(summaryRowStatus({ hasSessions: false, status: 'not-sent', warningCount: 3 })).toEqual({ pill: null, warnings: null });
  });

  it('keeps the Sent and Changed since sent pills', () => {
    expect(summaryRowStatus({ hasSessions: true, status: 'sent', warningCount: 0 })).toEqual({ pill: 'Sent', warnings: null });
    expect(summaryRowStatus({ hasSessions: true, status: 'changed', warningCount: 1 })).toEqual({ pill: 'Changed since sent', warnings: '1 warning' });
    expect(summaryRowStatus({ hasSessions: false, status: 'sent', warningCount: 0 }).pill).toBe('Sent');
  });
});

describe('messageView (D-08, D-09, D-16)', () => {
  const G = 'Smith ailesi\n\nToplam ders 1 saat (1:00)';
  const S = 'Edited by hand';
  const saved = record({ message: S, messageFingerprint: F1, messageSavedAt: 5 });

  it('no record, no draft: the generated text, nothing to save', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: null })).toEqual({ text: G, stale: false, canSave: false, dirty: false });
  });

  it('no record, an edited draft: the draft, savable and dirty', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: 'X', rebuilt: false, basedOn: F1 } })).toEqual({ text: 'X', stale: false, canSave: true, dirty: true });
  });

  it('a draft equal to the generated text is neither savable nor dirty', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: G, rebuilt: false, basedOn: F1 } })).toEqual({ text: G, stale: false, canSave: false, dirty: false });
  });

  it('a blank draft cannot be saved but is still dirty', () => {
    for (const blank of ['', '   ', '\n \t']) {
      expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: blank, rebuilt: false, basedOn: F1 } })).toMatchObject({ text: blank, canSave: false, dirty: true });
    }
  });

  it('saved and the fingerprint unchanged: the saved text, not stale', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F1, draft: null })).toEqual({ text: S, stale: false, canSave: false, dirty: false });
  });

  it('saved but the hours changed: the saved text with the banner, never the generated text', () => {
    const v = messageView({ generated: G, record: saved, fingerprint: F2, draft: null });
    expect(v).toEqual({ text: S, stale: true, canSave: false, dirty: false });
    expect(v.text).not.toBe(G);
  });

  it('stale with an edit in progress on the old text: the draft and the banner stay (CR-01)', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: 'Y', rebuilt: false, basedOn: F1 } })).toEqual({ text: 'Y', stale: true, canSave: true, dirty: true });
  });

  it('a draft written against older hours is stale when the hours change underneath it, even with no saved message (CR-01)', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F2, draft: { text: 'X', rebuilt: false, basedOn: F1 } })).toMatchObject({ text: 'X', stale: true });
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: 'X', rebuilt: false, basedOn: F1 } })).toMatchObject({ stale: false });
  });

  it('a draft based on the current hours is not stale even when the saved message is old', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: 'Y', rebuilt: false, basedOn: F2 } })).toMatchObject({ stale: false });
  });

  it('a draft equal to the saved text is not a change', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: S, rebuilt: false, basedOn: F1 } })).toMatchObject({ canSave: false, dirty: false, stale: true });
  });

  it('rebuilt while stale: the generated text, savable and dirty even when it equals the saved text', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: G, rebuilt: true, basedOn: F2 } })).toEqual({ text: G, stale: false, canSave: true, dirty: true });
    const same = record({ message: G, messageFingerprint: F1, messageSavedAt: 5 });
    expect(messageView({ generated: G, record: same, fingerprint: F2, draft: { text: G, rebuilt: true, basedOn: F2 } })).toEqual({ text: G, stale: false, canSave: true, dirty: true });
  });

  it('ignores warnings: the result has exactly four fields and none disables Copy (D-16)', () => {
    const plain = messageView({ generated: G, record: undefined, fingerprint: F1, draft: null });
    const withWarnings = messageView({ generated: G, record: undefined, fingerprint: F1, draft: null, warnings: [{ kind: 'x' }] } as never);
    expect(withWarnings).toEqual(plain);
    expect(Object.keys(plain).sort()).toEqual(['canSave', 'dirty', 'stale', 'text']);
  });
});

describe('draftBasis (CR-01)', () => {
  const saved = record({ message: 'Edited', messageFingerprint: F1, messageSavedAt: 5 });
  it('a first edit of a saved message is based on the saved message fingerprint, not the current one', () => {
    expect(draftBasis({ record: saved, fingerprint: F2, draft: null })).toBe(F1);
  });
  it('a first edit with nothing saved is based on the current fingerprint', () => {
    expect(draftBasis({ record: undefined, fingerprint: F2, draft: null })).toBe(F2);
    expect(draftBasis({ record: record({ sentAt: 3, sentFingerprint: F1 }), fingerprint: F2, draft: null })).toBe(F2);
  });
  it('an edit in progress keeps its own basis', () => {
    expect(draftBasis({ record: saved, fingerprint: F2, draft: { text: 'x', rebuilt: false, basedOn: F2 } })).toBe(F2);
    expect(draftBasis({ record: undefined, fingerprint: F2, draft: { text: 'x', rebuilt: false, basedOn: F1 } })).toBe(F1);
  });
});

describe('copy constants', () => {
  it('match the UI-SPEC wording', () => {
    expect(STALE_BANNER).toBe('Hours changed since you edited this message');
    expect(REBUILD_TITLE).toBe('Rebuild this message?');
    expect(REBUILD_MESSAGE).toBe('Your edits are replaced with a message from the current hours. Nothing is saved until you tap Save Message.');
    expect(DISCARD_TITLE).toBe('Discard changes to this message?');
    expect(SAVE_FAILED).toBe("Couldn't save the message. Your phone may be low on storage. Nothing was changed. Try again.");
    expect(COPY_FAILED).toBe("Couldn't copy. Select the text and copy it by hand. Nothing was changed.");
    expect(MESSAGE_FOOTER).toBe('Edit any line. Copy uses the text in this box, saved or not. Save Message keeps it for next time.');
  });
});

describe('pdfBuildKey', () => {
  const base = { familyId: 'f1', periodKey: 'w:2026-10-12', fingerprint: 'abc123', instructorName: 'Connor B.' as string | null, attempt: 0 };
  it('is equal for equal inputs', () => {
    expect(pdfBuildKey({ ...base })).toBe(pdfBuildKey({ ...base }));
  });
  it('differs when any one input differs', () => {
    const k = pdfBuildKey(base);
    expect(pdfBuildKey({ ...base, familyId: 'f2' })).not.toBe(k);
    expect(pdfBuildKey({ ...base, periodKey: 'w:2026-10-19' })).not.toBe(k);
    expect(pdfBuildKey({ ...base, fingerprint: 'abc124' })).not.toBe(k);
    expect(pdfBuildKey({ ...base, instructorName: 'Connor' })).not.toBe(k);
    expect(pdfBuildKey({ ...base, instructorName: null })).not.toBe(k);
    expect(pdfBuildKey({ ...base, attempt: 1 })).not.toBe(k);
  });
  it('tells null apart from a name that spells null or an empty name', () => {
    const a = pdfBuildKey({ ...base, instructorName: null });
    expect(pdfBuildKey({ ...base, instructorName: 'null' })).not.toBe(a);
    expect(pdfBuildKey({ ...base, instructorName: '' })).not.toBe(a);
  });
  it('cannot be fooled by a separator inside a field', () => {
    expect(pdfBuildKey({ ...base, familyId: 'a|b', periodKey: 'c' })).not.toBe(pdfBuildKey({ ...base, familyId: 'a', periodKey: 'b|c' }));
  });
});

describe('share button state and action', () => {
  it('maps the PDF status to the button', () => {
    expect(shareButtonState({ kind: 'preparing' })).toEqual({ label: 'Preparing PDF\u2026', disabled: true });
    expect(shareButtonState({ kind: 'ready' })).toEqual({ label: 'Share PDF', disabled: false });
    expect(shareButtonState({ kind: 'failed' })).toEqual({ label: 'Share PDF', disabled: false });
  });
  it('shares when ready, rebuilds when failed, does nothing while preparing', () => {
    expect(shareAction({ kind: 'ready' })).toBe('share');
    expect(shareAction({ kind: 'failed' })).toBe('build');
    expect(shareAction({ kind: 'preparing' })).toBe('none');
  });
});

describe('PDF and share captions', () => {
  it('names a too-large PDF and uses the generic copy for every other failure', () => {
    expect(pdfFailureCaption(new PdfBuildError('too-large'))).toBe(PDF_TOO_LARGE);
    expect(PDF_TOO_LARGE).toBe('This PDF is too large to build on this phone. Nothing was changed. Try a shorter period.');
    for (const e of [new PdfBuildError('photo-unreadable'), new PdfBuildError('build-failed'), new Error('x'), 'boom', null, undefined]) {
      expect(pdfFailureCaption(e)).toBe(PDF_FAILED);
    }
    expect(PDF_FAILED).toBe("Couldn't make the PDF. Nothing was changed. Try again.");
  });
  it('shows nothing after a share or a cancel, the file name after a download, and the failure copy', () => {
    expect(shareResultCaption('shared', 'a.pdf')).toBeNull();
    expect(shareResultCaption('cancelled', 'a.pdf')).toBeNull();
    expect(shareResultCaption('downloaded', 'smith-2026-10-12-2026-10-18.pdf')).toBe('Downloaded smith-2026-10-12-2026-10-18.pdf.');
    expect(shareResultCaption('failed', 'a.pdf')).toBe(SHARE_FAILED);
    expect(SHARE_FAILED).toBe("Couldn't share the PDF. Nothing was changed. Try again.");
  });
  it('footerCaption: PDF failure first (destructive), then the share outcome, nothing while preparing', () => {
    expect(footerCaption({ status: { kind: 'preparing' }, share: 'failed', fileName: 'a.pdf' })).toBeNull();
    expect(footerCaption({ status: { kind: 'failed', error: new PdfBuildError('too-large') }, share: null, fileName: 'a.pdf' })).toEqual({ text: PDF_TOO_LARGE, tone: 'destructive' });
    expect(footerCaption({ status: { kind: 'failed', error: new Error('x') }, share: 'downloaded', fileName: 'a.pdf' })).toEqual({ text: PDF_FAILED, tone: 'destructive' });
    expect(footerCaption({ status: { kind: 'ready' }, share: 'downloaded', fileName: 'a.pdf' })).toEqual({ text: 'Downloaded a.pdf.', tone: 'secondary' });
    expect(footerCaption({ status: { kind: 'ready' }, share: 'failed', fileName: 'a.pdf' })).toEqual({ text: SHARE_FAILED, tone: 'destructive' });
    expect(footerCaption({ status: { kind: 'ready' }, share: 'shared', fileName: 'a.pdf' })).toBeNull();
    expect(footerCaption({ status: { kind: 'ready' }, share: 'cancelled', fileName: 'a.pdf' })).toBeNull();
    expect(footerCaption({ status: { kind: 'ready' }, share: null, fileName: 'a.pdf' })).toBeNull();
  });
});

describe('sendChecklist', () => {
  const stages = (args: Parameters<typeof sendChecklist>[0]) => sendChecklist(args).map((s) => [s.title, s.tone, s.detail]);

  it('starts with nothing saved or sent: checked, generated, not sent', () => {
    expect(stages({ warningCount: 0, record: undefined, fingerprint: F1 })).toEqual([
      ['Checked', 'done', 'No warnings'],
      ['Message', 'idle', 'Generated'],
      ['Sent', 'idle', 'Not sent'],
    ]);
  });

  it('counts warnings in amber with the singular and plural forms', () => {
    expect(sendChecklist({ warningCount: 1, record: undefined, fingerprint: F1 })[0]).toMatchObject({ tone: 'attention', detail: '1 warning' });
    expect(sendChecklist({ warningCount: 3, record: undefined, fingerprint: F1 })[0]).toMatchObject({ tone: 'attention', detail: '3 warnings' });
  });

  it('shows a saved message as Saved while its fingerprint is current, Out of date once the hours changed', () => {
    const saved = record({ message: 'Merhaba', messageFingerprint: F1 });
    expect(sendChecklist({ warningCount: 0, record: saved, fingerprint: F1 })[1]).toMatchObject({ tone: 'done', detail: 'Saved' });
    expect(sendChecklist({ warningCount: 0, record: saved, fingerprint: F2 })[1]).toMatchObject({ tone: 'attention', detail: 'Out of date' });
  });

  it('judges an unsaved edit by the fingerprint it was written against', () => {
    const draft = { text: 'x', rebuilt: false, basedOn: F1 };
    expect(sendChecklist({ warningCount: 0, record: undefined, fingerprint: F1, draft })[1].detail).toBe('Generated');
    expect(sendChecklist({ warningCount: 0, record: undefined, fingerprint: F2, draft })[1].detail).toBe('Out of date');
    const saved = record({ message: 'Merhaba', messageFingerprint: F2 });
    expect(sendChecklist({ warningCount: 0, record: saved, fingerprint: F2, draft })[1].detail).toBe('Out of date');
  });

  it('shows the sent date, Changed since sent, and a message-only record as Not sent', () => {
    const sent = record({ sentAt: at(14, 40), sentFingerprint: F1 });
    expect(sendChecklist({ warningCount: 0, record: sent, fingerprint: F1 })[2]).toMatchObject({ tone: 'done', detail: 'Sent Oct 19' });
    expect(sendChecklist({ warningCount: 0, record: sent, fingerprint: F2 })[2]).toMatchObject({ tone: 'attention', detail: 'Changed since sent' });
    const messageOnly = record({ message: 'Merhaba', messageFingerprint: F1 });
    expect(sendChecklist({ warningCount: 0, record: messageOnly, fingerprint: F1 })[2]).toMatchObject({ tone: 'idle', detail: 'Not sent' });
  });

  it('reads as one sentence for screen readers', () => {
    expect(sendChecklistLabel(sendChecklist({ warningCount: 2, record: undefined, fingerprint: F1 }))).toBe(
      'Checked: 2 warnings. Message: Generated. Sent: Not sent.',
    );
  });
});
