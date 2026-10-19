import { db } from './db';
import { draftFromExpense, validateExpenseDrafts, type ExpenseDraft } from '../domain/expense';
import { sumCents } from '../domain/money';
import { SessionError } from '../domain/session';
import type { Expense, ExpenseSplit } from '../domain/types';

/** A receipt photo staged in memory until its session saves. */
export interface NewPhoto {
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

/** What a session save carries for its expenses: JSON-safe drafts plus the staged photo bytes by photo id. */
export interface ExpensePayload {
  expenses: ExpenseDraft[];
  photos: ReadonlyMap<string, NewPhoto>;
}

export const EMPTY_PAYLOAD: ExpensePayload = { expenses: [], photos: new Map() };

const sameSplits = (a: ExpenseSplit[], b: ExpenseSplit[]) =>
  a.length === b.length && a.every((s, i) => s.familyId === b[i].familyId && s.cents === b[i].cents);

/**
 * Makes the session's stored expenses and photos equal the payload. Must run inside the caller's rw
 * transaction (students, families, sessions, expenses, attachments). Only Dexie calls happen here: no
 * image decoding or Blob content reading (Pitfall 4). Any throw aborts the caller's transaction.
 */
export async function writeSessionExpenses(sessionId: string, familyIds: readonly string[], payload: ExpensePayload): Promise<void> {
  const checked = validateExpenseDrafts(payload.expenses, familyIds);
  if (!checked.ok) throw new SessionError('expenses-invalid');
  const stored = await db.expenses.where('sessionId').equals(sessionId).toArray();
  const storedById = new Map(stored.map((e) => [e.id, e]));
  const keep = new Set(checked.value.map((e) => e.id));

  const gone = stored.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (gone.length > 0) {
    await db.attachments.where('expenseId').anyOf(gone).delete();
    await db.expenses.bulkDelete(gone);
  }

  const now = Date.now();
  for (const e of checked.value) {
    const prior = storedById.get(e.id);
    if (prior) {
      if (prior.description !== e.description || prior.amountCents !== e.amountCents || !sameSplits(prior.splits, e.splits)) {
        await db.expenses.put({
          ...prior,
          description: e.description,
          amountCents: e.amountCents,
          splits: e.splits,
          updatedAt: Math.max(now, prior.updatedAt + 1),
        });
      }
    } else {
      await db.expenses.add({
        id: e.id,
        sessionId,
        description: e.description,
        amountCents: e.amountCents,
        splits: e.splits,
        createdAt: e.createdAt,
        updatedAt: now,
      });
    }

    const have = new Set((await db.attachments.where('expenseId').equals(e.id).primaryKeys()) as string[]);
    const want = new Set(e.photoIds);
    const drop = [...have].filter((id) => !want.has(id));
    if (drop.length > 0) await db.attachments.bulkDelete(drop);
    for (const photoId of e.photoIds) {
      if (have.has(photoId)) continue;
      const photo = payload.photos.get(photoId);
      if (!photo) throw new SessionError('photo-missing');
      if (photo.blob.type !== 'image/jpeg' || !Number.isInteger(photo.width) || photo.width <= 0 || !Number.isInteger(photo.height) || photo.height <= 0) {
        throw new SessionError('expenses-invalid');
      }
      await db.attachments.add({
        id: photoId,
        expenseId: e.id,
        blob: photo.blob,
        mime: 'image/jpeg',
        width: photo.width,
        height: photo.height,
        createdAt: photo.createdAt,
      });
    }
  }
}

/** Removes every expense of a session and every photo they own. Runs inside the caller's rw transaction. */
export async function deleteSessionExpenses(sessionId: string): Promise<void> {
  const ids = (await db.expenses.where('sessionId').equals(sessionId).primaryKeys()) as string[];
  if (ids.length === 0) return;
  await db.attachments.where('expenseId').anyOf(ids).delete();
  await db.expenses.bulkDelete(ids);
}

/** Total cents per session; sessions without expenses are absent. */
export async function expenseTotalsBySession(sessionIds: readonly string[]): Promise<Record<string, number>> {
  const rows: Expense[] = await db.expenses.where('sessionId').anyOf(sessionIds).toArray();
  const bySession: Record<string, number[]> = {};
  for (const r of rows) (bySession[r.sessionId] ??= []).push(r.amountCents);
  return Object.fromEntries(Object.entries(bySession).map(([id, list]) => [id, sumCents(list)]));
}

/**
 * The drafts a session's expenses edit as, ordered by createdAt then id, each with photo ids ordered by
 * attachment createdAt then id. Only ids and createdAt of the photo rows are used; no Blob is read.
 */
export async function loadExpenseDrafts(sessionId: string, familyIds: readonly string[]): Promise<ExpenseDraft[]> {
  const rows = (await db.expenses.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const drafts: ExpenseDraft[] = [];
  for (const row of rows) {
    const photos: { id: string; createdAt: number }[] = [];
    await db.attachments
      .where('expenseId')
      .equals(row.id)
      .each((a) => photos.push({ id: a.id, createdAt: a.createdAt }));
    photos.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    drafts.push(draftFromExpense(row, photos.map((p) => p.id), familyIds));
  }
  return drafts;
}

/** The stored receipt Blob, or undefined. No write transaction. */
export async function getAttachmentBlob(id: string): Promise<Blob | undefined> {
  return (await db.attachments.get(id))?.blob;
}
