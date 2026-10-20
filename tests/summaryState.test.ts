import { describe, expect, it } from 'vitest';
import type { PeriodRecord } from '../src/domain/types';
import {
  COPY_FAILED,
  DISCARD_TITLE,
  formatSentAt,
  MARK_FAILED,
  MESSAGE_FOOTER,
  messageView,
  REBUILD_MESSAGE,
  REBUILD_TITLE,
  SAVE_FAILED,
  sentAction,
  sentFooterText,
  sentStatus,
  STALE_BANNER,
  statusPill,
  statusValueText,
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

describe('messageView (D-08, D-09, D-16)', () => {
  const G = 'Smith ailesi\n\nToplam ders 1 saat (1:00)';
  const S = 'Edited by hand';
  const saved = record({ message: S, messageFingerprint: F1, messageSavedAt: 5 });

  it('no record, no draft: the generated text, nothing to save', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: null })).toEqual({ text: G, stale: false, canSave: false, dirty: false });
  });

  it('no record, an edited draft: the draft, savable and dirty', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: 'X', rebuilt: false } })).toEqual({ text: 'X', stale: false, canSave: true, dirty: true });
  });

  it('a draft equal to the generated text is neither savable nor dirty', () => {
    expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: G, rebuilt: false } })).toEqual({ text: G, stale: false, canSave: false, dirty: false });
  });

  it('a blank draft cannot be saved but is still dirty', () => {
    for (const blank of ['', '   ', '\n \t']) {
      expect(messageView({ generated: G, record: undefined, fingerprint: F1, draft: { text: blank, rebuilt: false } })).toMatchObject({ text: blank, canSave: false, dirty: true });
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

  it('stale with an edit in progress: the draft and the banner hidden', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: 'Y', rebuilt: false } })).toEqual({ text: 'Y', stale: false, canSave: true, dirty: true });
  });

  it('a draft equal to the saved text is not a change', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: S, rebuilt: false } })).toMatchObject({ canSave: false, dirty: false });
  });

  it('rebuilt while stale: the generated text, savable and dirty even when it equals the saved text', () => {
    expect(messageView({ generated: G, record: saved, fingerprint: F2, draft: { text: G, rebuilt: true } })).toEqual({ text: G, stale: false, canSave: true, dirty: true });
    const same = record({ message: G, messageFingerprint: F1, messageSavedAt: 5 });
    expect(messageView({ generated: G, record: same, fingerprint: F2, draft: { text: G, rebuilt: true } })).toEqual({ text: G, stale: false, canSave: true, dirty: true });
  });

  it('ignores warnings: the result has exactly four fields and none disables Copy (D-16)', () => {
    const plain = messageView({ generated: G, record: undefined, fingerprint: F1, draft: null });
    const withWarnings = messageView({ generated: G, record: undefined, fingerprint: F1, draft: null, warnings: [{ kind: 'x' }] } as never);
    expect(withWarnings).toEqual(plain);
    expect(Object.keys(plain).sort()).toEqual(['canSave', 'dirty', 'stale', 'text']);
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
