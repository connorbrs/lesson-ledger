import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import type { ExpensePayload, NewPhoto } from '../src/data/expenses';
import { archiveFamily, createFamily, updateFamily } from '../src/data/families';
import { markSent, saveMessage } from '../src/data/periodRecords';
import { createSession, listSessions, updateSession } from '../src/data/sessions';
import { createStudent } from '../src/data/students';
import { loadFamilyView, loadSummaryInput, loadSummaryList } from '../src/data/summary';
import { periodKey, renderMessageTr } from '../src/domain/summary';
import { sentStatus } from '../src/domain/summaryState';

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

describe('sent status through the real loaders (SUM-08, T-04-10)', () => {
  const TODAY = '2026-10-19';

  async function sentSmith() {
    const { smith, ava } = await seedSmith();
    const before = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(before.record).toBeUndefined();
    const key = periodKey(before.summary.period);
    await markSent(smith.id, key, before.summary.fingerprint, 1_000);
    return { smith, ava, key };
  }

  const fieldsOf = (s: Awaited<ReturnType<typeof listSessions>>[number]) => ({
    date: s.date, startTime: s.startTime, endTime: s.endTime, subject: s.subject,
    attendees: s.attendees, credits: s.credits,
    lessonMinutes: s.lessonMinutes, activityMinutes: s.activityMinutes, travelMinutes: s.travelMinutes,
  });

  it('has no record before a mark and the stored record after markSent', async () => {
    const { smith, key } = await sentSmith();
    const view = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(view.record).toMatchObject({ familyId: smith.id, periodKey: key, sentAt: 1_000, sentFingerprint: view.summary.fingerprint });
    expect(sentStatus(view.record, view.summary.fingerprint)).toBe('sent');
  });

  it('a saved message alone is not a sent mark', async () => {
    const { smith } = await seedSmith();
    const v = (await loadFamilyView(smith.id, null, TODAY))!;
    await saveMessage(smith.id, periodKey(v.summary.period), 'Merhaba', v.summary.fingerprint);
    const after = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(after.record?.message).toBe('Merhaba');
    expect(sentStatus(after.record, after.summary.fingerprint)).toBe('not-sent');
  });

  it('changes to changed after a session edit and back to sent after reverting it', async () => {
    const { smith } = await sentSmith();
    const [first] = (await listSessions()).filter((s) => s.date === '2026-10-12');
    await updateSession(first.id, { ...fieldsOf(first), lessonMinutes: 30, activityMinutes: 30 });
    const edited = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(sentStatus(edited.record, edited.summary.fingerprint)).toBe('changed');
    expect(edited.summary.fingerprint).not.toBe(edited.record!.sentFingerprint);

    await updateSession(first.id, fieldsOf(first));
    const reverted = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(sentStatus(reverted.record, reverted.summary.fingerprint)).toBe('sent');
  });

  it('a travel-only edit is changed', async () => {
    const { smith } = await sentSmith();
    const [first] = (await listSessions()).filter((s) => s.date === '2026-10-12');
    await updateSession(first.id, { ...fieldsOf(first), travelMinutes: 25 });
    const view = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(sentStatus(view.record, view.summary.fingerprint)).toBe('changed');
  });

  it('a family rename is changed', async () => {
    const { smith } = await sentSmith();
    await updateFamily(smith.id, { name: 'Smythe', period: 'weekly' });
    const view = (await loadFamilyView(smith.id, null, TODAY))!;
    expect(sentStatus(view.record, view.summary.fingerprint)).toBe('changed');
  });

  it('loadSummaryList rows carry the record of the default period', async () => {
    const { smith } = await sentSmith();
    const brown = await createFamily('Brown');
    const list = await loadSummaryList(TODAY);
    const row = list.find((r) => r.familyId === smith.id)!;
    expect(row.record).toMatchObject({ familyId: smith.id, sentAt: 1_000 });
    expect(sentStatus(row.record, row.summary.fingerprint)).toBe('sent');
    expect(list.find((r) => r.familyId === brown.id)!.record).toBeUndefined();
  });
});
