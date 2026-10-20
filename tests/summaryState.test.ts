import { describe, expect, it } from 'vitest';
import type { PeriodRecord } from '../src/domain/types';
import { formatSentAt, MARK_FAILED, sentAction, sentFooterText, sentStatus, statusPill, statusValueText } from '../src/domain/summaryState';

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
