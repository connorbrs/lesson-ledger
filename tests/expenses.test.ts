import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { createFamily } from '../src/data/families';
import { createStudent } from '../src/data/students';
import { createSession, deleteSession, updateSession } from '../src/data/sessions';
import { EMPTY_PAYLOAD, expenseTotalsBySession, getAttachmentBlob, loadExpenseDrafts, type ExpensePayload, type NewPhoto } from '../src/data/expenses';
import type { ExpenseDraft } from '../src/domain/expense';
import { parseAmountToCents } from '../src/domain/money';
import { sessionRowText, type SessionFields } from '../src/domain/session';
import { blankForm, formToInput, setAttendees, upsertExpense } from '../src/domain/sessionForm';
import type { Attendee } from '../src/domain/types';

let a1: Attendee, a2: Attendee, b1: Attendee;

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
  const famA = await createFamily('Test Family A');
  const famB = await createFamily('Test Family B');
  const s1 = await createStudent({ familyId: famA.id, name: 'Test Student A1' });
  const s2 = await createStudent({ familyId: famA.id, name: 'Test Student A2' });
  const s3 = await createStudent({ familyId: famB.id, name: 'Test Student B1' });
  a1 = { studentId: s1.id, familyId: famA.id };
  a2 = { studentId: s2.id, familyId: famA.id };
  b1 = { studentId: s3.id, familyId: famB.id };
});

const fields = (attendees: Attendee[]): SessionFields => ({
  date: '2026-10-19',
  startTime: null,
  endTime: null,
  subject: 'swim',
  attendees,
  credits: [...new Set(attendees.map((a) => a.familyId))].map((familyId) => ({ familyId, lesson: 'full' as const, activity: 'full' as const })),
  lessonMinutes: 45,
  activityMinutes: 0,
  travelMinutes: 0,
});

describe('tracer', () => {
  it('saves an expense with its session in one transaction, reads Expenses $12.50, and cascades on delete', async () => {
    let form = setAttendees(blankForm('10:00'), [a1]);
    const cents = parseAmountToCents('12.50');
    expect(cents).toBe(1250);
    form = upsertExpense(form, { id: 'e1', description: 'Pool entry', amountCents: cents as number, splits: null, photoIds: [], createdAt: 1 });
    const input = formToInput({ ...form, startTime: null, endTime: null }, '2026-10-19');
    if (!input.ok) throw new Error(input.code);
    const session = await createSession(input.value, { expenses: form.expenses, photos: new Map() });

    const rows = await db.expenses.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'e1', sessionId: session.id, amountCents: 1250, description: 'Pool entry' });
    expect(rows[0].splits).toEqual([{ familyId: a1.familyId, cents: 1250 }]);

    const totals = await expenseTotalsBySession([session.id]);
    expect(totals).toEqual({ [session.id]: 1250 });
    expect(sessionRowText(session, { [a1.studentId]: 'Test Student A1' }, totals[session.id]).expenses).toBe('Expenses $12.50');

    expect(await deleteSession(session.id)).toEqual({ ok: true });
    expect(await db.expenses.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
  });

  it('rejects a zero-amount expense with expenses-invalid and stores nothing', async () => {
    const draft = { id: 'e1', description: 'Free', amountCents: 0, splits: null, photoIds: [], createdAt: 1 };
    await expect(createSession(fields([a1]), { expenses: [draft], photos: new Map() })).rejects.toMatchObject({ code: 'expenses-invalid' });
    expect(await db.sessions.count()).toBe(0);
    expect(await db.expenses.count()).toBe(0);
  });

  it('creates without a payload as before', async () => {
    const s = await createSession(fields([a1]), EMPTY_PAYLOAD);
    expect(await db.expenses.count()).toBe(0);
    expect(s.id).toHaveLength(36);
  });
});

const draft = (id: string, amountCents: number, over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  id, description: `Item ${id}`, amountCents, splits: null, photoIds: [], createdAt: 10, ...over,
});
const jpeg = (...extra: number[]) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...extra])], { type: 'image/jpeg' });
const photo = (createdAt = 1, ...extra: number[]): NewPhoto => ({ blob: jpeg(...extra), width: 800, height: 600, createdAt });
const payload = (expenses: ExpenseDraft[], photos: Record<string, NewPhoto> = {}): ExpensePayload => ({ expenses, photos: new Map(Object.entries(photos)) });
const bytes = async (b: Blob) => [...new Uint8Array(await b.arrayBuffer())];
const snapshot = async () => ({
  sessions: await db.sessions.toArray(),
  expenses: await db.expenses.toArray(),
  attachments: (await db.attachments.toArray()).map((a) => a.id),
});

describe('updateSession with a payload', () => {
  it('adds, edits, removes and keeps expenses in one transaction', async () => {
    const s = await createSession(fields([a1]), payload([draft('e1', 1000), draft('e2', 500)]));
    const before = new Map((await db.expenses.toArray()).map((e) => [e.id, e]));
    await updateSession(s.id, fields([a1]), payload([draft('e1', 1000), draft('e3', 300), draft('e2', 700, { description: 'Edited' })]));
    const after = new Map((await db.expenses.toArray()).map((e) => [e.id, e]));
    expect([...after.keys()].sort()).toEqual(['e1', 'e2', 'e3']);
    expect(after.get('e1')).toEqual(before.get('e1')); // unchanged row not rewritten
    expect(after.get('e2')).toMatchObject({ amountCents: 700, description: 'Edited', splits: [{ familyId: a1.familyId, cents: 700 }] });
    expect(after.get('e2')!.updatedAt).toBeGreaterThan(before.get('e2')!.updatedAt);
    await updateSession(s.id, fields([a1]), payload([draft('e1', 1000)]));
    expect((await db.expenses.toArray()).map((e) => e.id)).toEqual(['e1']);
  });

  it('omitting the payload leaves expenses and attachments untouched', async () => {
    const s = await createSession(fields([a1]), payload([draft('e1', 1000, { photoIds: ['p1'] })], { p1: photo() }));
    const before = await snapshot();
    await updateSession(s.id, { ...fields([a1]), lessonMinutes: 60 });
    const after = await snapshot();
    expect(after.expenses).toEqual(before.expenses);
    expect(after.attachments).toEqual(before.attachments);
  });

  it('removes an expense with all its photo rows, and a removed photo id deletes that attachment only', async () => {
    const s = await createSession(fields([a1]), payload([draft('e1', 1000, { photoIds: ['p1', 'p2'] }), draft('e2', 100, { photoIds: ['p3'] })], { p1: photo(1), p2: photo(2), p3: photo(3) }));
    await updateSession(s.id, fields([a1]), payload([draft('e1', 1000, { photoIds: ['p1'] }), draft('e2', 100, { photoIds: ['p3'] })]));
    expect((await db.attachments.toArray()).map((a) => a.id).sort()).toEqual(['p1', 'p3']);
    await updateSession(s.id, fields([a1]), payload([draft('e1', 1000, { photoIds: ['p1'] })]));
    expect((await db.attachments.toArray()).map((a) => a.id)).toEqual(['p1']);
    await updateSession(s.id, fields([a1]), payload([]));
    expect(await db.expenses.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
  });

  it('adds a new photo with its bytes intact', async () => {
    const s = await createSession(fields([a1]), payload([draft('e1', 1000)]));
    await updateSession(s.id, fields([a1]), payload([draft('e1', 1000, { photoIds: ['p1'] })], { p1: photo(7, 1, 2, 3) }));
    const blob = await getAttachmentBlob('p1');
    expect(blob?.type).toBe('image/jpeg');
    expect(await bytes(blob!)).toEqual([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    expect(await getAttachmentBlob('nope')).toBeUndefined();
    expect(await db.attachments.get('p1')).toMatchObject({ expenseId: 'e1', mime: 'image/jpeg', width: 800, height: 600, createdAt: 7 });
  });
});

describe('shares', () => {
  it('stores 501 and 500 for a two-family swim at 1001 cents', async () => {
    await createSession(fields([a1, b1]), payload([draft('e1', 1001)]));
    const row = (await db.expenses.toArray())[0];
    expect(row.splits).toEqual([{ familyId: a1.familyId, cents: 501 }, { familyId: b1.familyId, cents: 500 }]);
  });

  it('an override survives an unrelated edit', async () => {
    const splits = [{ familyId: a1.familyId, cents: 700 }, { familyId: b1.familyId, cents: 301 }];
    const s = await createSession(fields([a1, b1]), payload([draft('e1', 1001, { splits })]));
    await updateSession(s.id, { ...fields([a1, b1]), lessonMinutes: 60 }, payload([draft('e1', 1001, { splits })]));
    expect((await db.expenses.toArray())[0].splits).toEqual(splits);
  });

  it('resets an override to the equal split when the session families change', async () => {
    const splits = [{ familyId: a1.familyId, cents: 700 }, { familyId: b1.familyId, cents: 301 }];
    const s = await createSession(fields([a1, b1]), payload([draft('e1', 1001, { splits })]));
    const famC = await createFamily('Test Family C');
    const c = await createStudent({ familyId: famC.id, name: 'Test Student C1' });
    const c1 = { studentId: c.id, familyId: famC.id };
    await updateSession(s.id, fields([a1, c1]), payload([draft('e1', 1001, { splits })]));
    expect((await db.expenses.toArray())[0].splits).toEqual([{ familyId: a1.familyId, cents: 501 }, { familyId: famC.id, cents: 500 }]);
  });

  it('rejects a same-families override whose shares do not sum, changing nothing', async () => {
    const s = await createSession(fields([a1, b1]), payload([draft('e1', 1001)]));
    const before = await snapshot();
    const splits = [{ familyId: a1.familyId, cents: 700 }, { familyId: b1.familyId, cents: 302 }];
    await expect(updateSession(s.id, fields([a1, b1]), payload([draft('e1', 1001, { splits })]))).rejects.toMatchObject({ code: 'expenses-invalid' });
    expect(await snapshot()).toEqual(before);
  });

  it('remaps an override keyed by a moved family to the stored attendee snapshot', async () => {
    const s = await createSession(fields([a1]), payload([draft('e1', 1250)]));
    await db.students.update(a1.studentId, { familyId: b1.familyId });
    const moved = { studentId: a1.studentId, familyId: b1.familyId };
    const splits = [{ familyId: b1.familyId, cents: 1250 }];
    await updateSession(s.id, fields([moved]), payload([draft('e1', 1250, { splits })]));
    expect((await db.expenses.toArray())[0].splits).toEqual([{ familyId: a1.familyId, cents: 1250 }]);
  });

  it('every stored share family is a family of the session', async () => {
    const s = await createSession(fields([a1, b1]), payload([draft('e1', 1001)]));
    const families = new Set(s.attendees.map((a) => a.familyId));
    for (const e of await db.expenses.toArray()) expect(e.splits.every((x) => families.has(x.familyId))).toBe(true);
  });
});

describe('atomic failure', () => {
  const cases: [string, ExpensePayload, string][] = [
    ['zero amount', payload([draft('e1', 0)]), 'expenses-invalid'],
    ['blank description', payload([draft('e1', 100, { description: '  ' })]), 'expenses-invalid'],
    ['duplicate expense id', payload([draft('e1', 100), draft('e1', 200)]), 'expenses-invalid'],
    ['duplicate photo id across expenses', payload([draft('e1', 100, { photoIds: ['p'] }), draft('e2', 100, { photoIds: ['p'] })], { p: photo() }), 'expenses-invalid'],
    ['photo id absent from the staged photos', payload([draft('e1', 100, { photoIds: ['p'] })]), 'photo-missing'],
    ['override with a wrong sum', payload([draft('e1', 100, { splits: [{ familyId: 'x', cents: 1 }] })]), 'expenses-invalid'],
    ['non-JPEG photo', payload([draft('e1', 100, { photoIds: ['p'] })], { p: { ...photo(), blob: new Blob([new Uint8Array([1])], { type: 'image/png' }) } }), 'expenses-invalid'],
  ];

  it.each(cases)('create with %s stores nothing', async (_name, bad, code) => {
    const before = await snapshot();
    await expect(createSession(fields([a1]), bad)).rejects.toMatchObject({ code });
    expect(await snapshot()).toEqual(before);
  });

  it.each(cases)('update with %s changes nothing', async (_name, bad, code) => {
    const s = await createSession(fields([a1]), payload([draft('keep', 500, { photoIds: ['pk'] })], { pk: photo() }));
    const before = await snapshot();
    await expect(updateSession(s.id, { ...fields([a1]), lessonMinutes: 90 }, bad)).rejects.toMatchObject({ code });
    expect(await snapshot()).toEqual(before);
  });

  it('a wrong-sum override on the same families rejects on create', async () => {
    const splits = [{ familyId: a1.familyId, cents: 1 }, { familyId: b1.familyId, cents: 1 }];
    const before = await snapshot();
    await expect(createSession(fields([a1, b1]), payload([draft('e1', 100, { splits })]))).rejects.toMatchObject({ code: 'expenses-invalid' });
    expect(await snapshot()).toEqual(before);
  });
});

describe('delete and race', () => {
  it('deleteSession removes only its own expenses and attachments', async () => {
    const s1 = await createSession(fields([a1]), payload([draft('e1', 100, { photoIds: ['p1'] })], { p1: photo() }));
    await createSession(fields([a2]), payload([draft('e2', 200, { photoIds: ['p2'] })], { p2: photo() }));
    await deleteSession(s1.id);
    expect((await db.expenses.toArray()).map((e) => e.id)).toEqual(['e2']);
    expect((await db.attachments.toArray()).map((a) => a.id)).toEqual(['p2']);
  });

  it.each(['update-first', 'delete-first'] as const)('an update racing a delete leaves no orphans (%s)', async (order) => {
    const s = await createSession(fields([a1]), payload([draft('e1', 100, { photoIds: ['p1'] })], { p1: photo() }));
    const update = () => updateSession(s.id, fields([a1]), payload([draft('e1', 100, { photoIds: ['p1'] }), draft('e2', 50, { photoIds: ['p2'] })], { p2: photo() }));
    const remove = () => deleteSession(s.id);
    await Promise.allSettled(order === 'update-first' ? [update(), remove()] : [remove(), update()]);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.expenses.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
  });
});

describe('loadExpenseDrafts and totals', () => {
  it('orders drafts by createdAt then id and photos by createdAt then id', async () => {
    const s = await createSession(
      fields([a1]),
      payload(
        [draft('b', 200, { createdAt: 5, photoIds: ['p2', 'p1', 'p3'] }), draft('a', 100, { createdAt: 5 }), draft('c', 300, { createdAt: 1 })],
        { p1: photo(2), p2: photo(1), p3: photo(2) },
      ),
    );
    const drafts = await loadExpenseDrafts(s.id, [a1.familyId]);
    expect(drafts.map((d) => d.id)).toEqual(['c', 'a', 'b']);
    expect(drafts[2].photoIds).toEqual(['p2', 'p1', 'p3']);
    expect(drafts[2].splits).toBeNull();
    expect(await expenseTotalsBySession([s.id])).toEqual({ [s.id]: 600 });
  });

  it('totals omit sessions without expenses', async () => {
    const s = await createSession(fields([a1]));
    expect(await expenseTotalsBySession([s.id])).toEqual({});
  });
});
