import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { createFamily } from '../src/data/families';
import { createStudent } from '../src/data/students';
import { createSession, deleteSession } from '../src/data/sessions';
import { expenseTotalsBySession, EMPTY_PAYLOAD } from '../src/data/expenses';
import { parseAmountToCents } from '../src/domain/money';
import { sessionRowText, type SessionFields } from '../src/domain/session';
import { blankForm, formToInput, setAttendees, upsertExpense } from '../src/domain/sessionForm';
import type { Attendee } from '../src/domain/types';

let a1: Attendee;

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
  const famA = await createFamily('Test Family A');
  const s1 = await createStudent({ familyId: famA.id, name: 'Test Student A1' });
  a1 = { studentId: s1.id, familyId: famA.id };
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
