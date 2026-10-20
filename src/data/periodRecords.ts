import { PeriodRecordError, isRecordEmpty, recordId, validateMessage } from '../domain/periodRecord';
import { isFingerprint, parsePeriodKey } from '../domain/summary';
import type { PeriodRecord } from '../domain/types';
import { db } from './db';

/**
 * The only writers of periodRecords outside restore (D-08, D-14). Each validates first, then runs ONE read-write
 * transaction over families and periodRecords, requires the family and puts or deletes one row. Copy and Share never
 * call markSent. A failed call changes nothing.
 */

function checkKey(periodKey: string): void {
  if (parsePeriodKey(periodKey) === null) throw new PeriodRecordError('period-invalid');
}

function checkFingerprint(fingerprint: string): void {
  if (!isFingerprint(fingerprint)) throw new PeriodRecordError('fingerprint-invalid');
}

export function getPeriodRecord(familyId: string, periodKey: string): Promise<PeriodRecord | undefined> {
  return db.periodRecords.get(recordId(familyId, periodKey));
}

async function change(familyId: string, periodKey: string, edit: (prior: PeriodRecord | undefined, now: number) => Omit<PeriodRecord, 'id' | 'familyId' | 'periodKey' | 'updatedAt'>): Promise<PeriodRecord | undefined> {
  const id = recordId(familyId, periodKey);
  return db.transaction('rw', db.families, db.periodRecords, async () => {
    if (!(await db.families.get(familyId))) throw new PeriodRecordError('family-missing');
    const prior = await db.periodRecords.get(id);
    const now = Date.now();
    const fields = edit(prior, now);
    if (isRecordEmpty(fields)) {
      await db.periodRecords.delete(id);
      return undefined;
    }
    const next: PeriodRecord = { id, familyId, periodKey, ...fields, updatedAt: Math.max(now, (prior?.updatedAt ?? -1) + 1) };
    await db.periodRecords.put(next);
    return next;
  });
}

const messageOf = (p: PeriodRecord | undefined) => ({
  message: p?.message ?? null,
  messageFingerprint: p?.messageFingerprint ?? null,
  messageSavedAt: p?.messageSavedAt ?? null,
});
const sentOf = (p: PeriodRecord | undefined) => ({ sentAt: p?.sentAt ?? null, sentFingerprint: p?.sentFingerprint ?? null });

/** Saves the edited message exactly as typed, with the fingerprint of the data it was written against. Keeps a sent mark. */
export async function saveMessage(familyId: string, periodKey: string, text: string, fingerprint: string): Promise<PeriodRecord> {
  checkKey(periodKey);
  checkFingerprint(fingerprint);
  const m = validateMessage(text);
  if (!m.ok) throw new PeriodRecordError(m.code);
  const saved = await change(familyId, periodKey, (prior, now) => ({ message: m.value, messageFingerprint: fingerprint, messageSavedAt: now, ...sentOf(prior) }));
  return saved!;
}

/** Marks the period sent at the given fingerprint. Keeps a saved message. */
export async function markSent(familyId: string, periodKey: string, fingerprint: string, at: number = Date.now()): Promise<PeriodRecord> {
  checkKey(periodKey);
  checkFingerprint(fingerprint);
  const sent = await change(familyId, periodKey, (prior) => ({ ...messageOf(prior), sentAt: at, sentFingerprint: fingerprint }));
  return sent!;
}

/** Clears the sent mark. Keeps the message; deletes the row when no message is left. */
export async function unmarkSent(familyId: string, periodKey: string): Promise<void> {
  checkKey(periodKey);
  await change(familyId, periodKey, (prior) => ({ ...messageOf(prior), sentAt: null, sentFingerprint: null }));
}
