/** Pure rules for the saved message and the sent mark (D-08, D-18). No database, no clock. */
import type { PeriodRecord } from './types';

/** D-18: a saved message is at most this many code points. */
export const MESSAGE_MAX = 10_000;

export type PeriodRecordErrorCode = 'period-invalid' | 'fingerprint-invalid' | 'message-empty' | 'message-too-long' | 'family-missing';

export class PeriodRecordError extends Error {
  readonly code: PeriodRecordErrorCode;
  constructor(code: PeriodRecordErrorCode) {
    super(code);
    this.name = 'PeriodRecordError';
    this.code = code;
  }
}

/** `${familyId}_${periodKey}`: the underscore keeps the id inside the backup id charset. */
export const recordId = (familyId: string, periodKey: string): string => `${familyId}_${periodKey}`;

export type MessageCheck = { ok: true; value: string } | { ok: false; code: 'message-empty' | 'message-too-long' };

/**
 * A message must be non-blank after trimming and at most MESSAGE_MAX code points. The text is stored exactly as
 * typed. A string over twice the cap in UTF-16 units is refused on length before it is spread into code points.
 */
export function validateMessage(raw: unknown): MessageCheck {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, code: 'message-empty' };
  if (raw.length > MESSAGE_MAX * 2) return { ok: false, code: 'message-too-long' };
  if ([...raw].length > MESSAGE_MAX) return { ok: false, code: 'message-too-long' };
  return { ok: true, value: raw };
}

/** A record with neither a saved message nor a sent mark is deleted, never stored. */
export const isRecordEmpty = (r: Pick<PeriodRecord, 'message' | 'sentAt'>): boolean => r.message === null && r.sentAt === null;
