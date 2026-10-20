import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import type { ExpensePayload, NewPhoto } from '../src/data/expenses';
import { archiveFamily, createFamily } from '../src/data/families';
import { createSession } from '../src/data/sessions';
import { createStudent } from '../src/data/students';
import { loadFamilyView, loadSummaryInput, loadSummaryList } from '../src/data/summary';
import { renderMessageTr } from '../src/domain/summary';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

const full = (familyId: string) => ({ familyId, lesson: 'full' as const, activity: 'full' as const });

const jpeg = (seed: number): NewPhoto => {
  const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i < 4 ? [0xff, 0xd8, 0xff, 0xe0][i] : (i * 7 + seed * 13) % 256));
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), width: 40, height: 30, createdAt: 1_000 + seed };
};

const receiptPayload = (): ExpensePayload => ({
  expenses: [{ id: 'e-1', description: 'Pool entry', amountCents: 1875, splits: null, photoIds: ['p-1'], createdAt: 10 }],
  photos: new Map([['p-1', jpeg(1)]]),
});

async function seedSmith() {
  const smith = await createFamily('Smith');
  const ava = await createStudent({ familyId: smith.id, name: 'Ava' });
  await createSession(
    {
      date: '2026-10-12', startTime: '16:00', endTime: '17:00', subject: 'swim',
      attendees: [{ studentId: ava.id, familyId: smith.id }], credits: [full(smith.id)],
      lessonMinutes: 45, activityMinutes: 15, travelMinutes: 10,
    },
    receiptPayload(),
  );
  await createSession({
    date: '2026-10-14', startTime: null, endTime: null, subject: 'math',
    attendees: [{ studentId: ava.id, familyId: smith.id }], credits: [full(smith.id)],
    lessonMinutes: 60, activityMinutes: 0, travelMinutes: 0,
  });
  return { smith, ava };
}

describe('summary loaders', () => {
  it('tracer: stored rows become the exact Turkish message', async () => {
    const { smith } = await seedSmith();
    const view = await loadFamilyView(smith.id, null, '2026-10-19');
    expect(view).not.toBeNull();
    expect(view!.kind).toBe('week');
    expect(view!.defaultPeriod).toEqual({ kind: 'week', start: '2026-10-12', end: '2026-10-18' });
    expect(view!.summary.period).toEqual(view!.defaultPeriod);
    expect(view!.summary.lessonMinutes).toBe(105);
    expect(view!.summary.activityMinutes).toBe(15);
    expect(view!.summary.expenseCents).toBe(1875);
    expect(view!.summary.hasReceipts).toBe(true);
    expect(view!.summary.sessions).toHaveLength(2);
    expect(renderMessageTr(view!.summary)).toBe(
      [
        'Smith ailesi — 12–18 Ekim 2026',
        '',
        'Pzt 12 Eki · Yüzme · ders 0,75 saat (0:45), aktivite 0,25 saat (0:15)',
        'Çar 14 Eki · Matematik · ders 1 saat (1:00), aktivite 0 saat (0:00)',
        '',
        'Toplam ders 1,75 saat (1:45)',
        'Toplam aktivite 0,25 saat (0:15)',
        "Masraflar $18.75 (fişler PDF'te)",
      ].join('\n'),
    );
  });

  it('returns null for a missing family and undefined input', async () => {
    expect(await loadFamilyView('nope', null, '2026-10-19')).toBeNull();
    expect(await loadSummaryInput('nope', { kind: 'week', start: '2026-10-12', end: '2026-10-18' })).toBeUndefined();
  });

  it('lists only active families in People order with their default periods', async () => {
    const { smith } = await seedSmith();
    const brown = await createFamily('Brown', 'monthly');
    const old = await createFamily('Archived One');
    await archiveFamily(old.id);
    const list = await loadSummaryList('2026-10-19');
    expect(list.map((r) => r.name)).toEqual(['Brown', 'Smith']);
    expect(list[0]).toMatchObject({ familyId: brown.id, kind: 'monthly', period: { kind: 'month', start: '2026-09-01', end: '2026-09-30' } });
    expect(list[1]).toMatchObject({ familyId: smith.id, kind: 'weekly', period: { kind: 'week', start: '2026-10-12', end: '2026-10-18' } });
    expect(list[1].summary.sessions).toHaveLength(2);
    expect(list[0].summary.sessions).toHaveLength(0);
  });
});
