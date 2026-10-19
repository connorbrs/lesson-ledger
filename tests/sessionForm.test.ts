import { describe, expect, it } from 'vitest';
import { blankForm, changeSubject, formToInput, needsCreditGroups, parseMinutes, prefillFromSession, setAttendees, togglePick, type FormState } from '../src/domain/sessionForm';
import type { Attendee, Session, Student } from '../src/domain/types';

const a1: Attendee = { studentId: 'a1', familyId: 'A' };
const a2: Attendee = { studentId: 'a2', familyId: 'A' };
const b1: Attendee = { studentId: 'b1', familyId: 'B' };
const TODAY = '2026-10-19';

const form = (over: Partial<FormState>): FormState => ({ ...blankForm(), ...over });

describe('parseMinutes', () => {
  it.each([
    ['45', 45],
    [' 7 ', 7],
    ['0', 0],
    ['999', 999],
  ])('"%s" gives %s', (text, n) => expect(parseMinutes(text)).toBe(n));
  it.each(['1000', '', '1.5', '-1', 'abc'])('"%s" gives null', (text) => expect(parseMinutes(text)).toBeNull());
});

describe('blankForm', () => {
  it('starts with Lesson 45, Activity 0, Travel 0, swim and no students', () => {
    expect(blankForm()).toMatchObject({ lesson: '45', activity: '0', travel: '0', subject: 'swim', attendees: [], date: null, startTime: null, subjectTouched: false });
  });
});

describe('togglePick', () => {
  it('swim toggles on and off and ignores a third student', () => {
    const one = togglePick('swim', [], a1);
    const two = togglePick('swim', one, b1);
    expect(two).toEqual([a1, b1]);
    expect(togglePick('swim', two, a2)).toEqual([a1, b1]);
    expect(togglePick('swim', two, a1)).toEqual([b1]);
  });
  it('math replaces the selection', () => {
    expect(togglePick('math', [a1], b1)).toEqual([b1]);
  });
});

describe('changeSubject and setAttendees', () => {
  it('math with two attendees keeps the first picked and marks the subject touched', () => {
    const next = changeSubject(form({ attendees: [a1, b1] }), 'math');
    expect(next.attendees).toEqual([a1]);
    expect(next.subjectTouched).toBe(true);
  });
  it('the first student picked on an untouched form takes their Default Subject; Both becomes Swim', () => {
    expect(setAttendees(blankForm(), [a1], 'math').subject).toBe('math');
    expect(setAttendees(blankForm(), [a1], 'both').subject).toBe('swim');
    expect(setAttendees(blankForm(), [a1], 'swim').subject).toBe('swim');
  });
  it('does not override a subject the user already tapped, or a later pick', () => {
    expect(setAttendees(form({ subjectTouched: true }), [a1], 'math').subject).toBe('swim');
    expect(setAttendees(form({ attendees: [a1] }), [a1, b1], 'math').subject).toBe('swim');
  });
  it('drops credits for a family that left the attendees', () => {
    const f = form({ attendees: [a1, b1], credits: { A: { lesson: 'half', activity: 'full' }, B: { lesson: 'full', activity: 'full' } } });
    expect(Object.keys(setAttendees(f, [a1]).credits)).toEqual(['A']);
  });
});

describe('formToInput credits', () => {
  const half = { A: { lesson: 'half' as const, activity: 'full' as const } };
  it('gives one entry per distinct family in pick order; two siblings give one', () => {
    const r = formToInput(form({ attendees: [a1, a2] }), TODAY);
    expect(r.ok && r.value.credits).toEqual([{ familyId: 'A', lesson: 'full', activity: 'full' }]);
    const two = formToInput(form({ attendees: [b1, a1] }), TODAY);
    expect(two.ok && two.value.credits.map((c) => c.familyId)).toEqual(['B', 'A']);
  });
  it('Half survives for two families on swim and is forced to Full after changing the subject to math', () => {
    const swim = form({ attendees: [a1, b1], credits: half });
    const kept = formToInput(swim, TODAY);
    expect(kept.ok && kept.value.credits[0]).toEqual({ familyId: 'A', lesson: 'half', activity: 'full' });
    const math = formToInput(changeSubject(swim, 'math'), TODAY);
    expect(math.ok && math.value.credits).toEqual([{ familyId: 'A', lesson: 'full', activity: 'full' }]);
  });
  it('shows credit groups only for a two-family swim', () => {
    expect(needsCreditGroups('swim', [a1, b1])).toBe(true);
    expect(needsCreditGroups('swim', [a1, a2])).toBe(false);
    expect(needsCreditGroups('math', [a1])).toBe(false);
  });
});

describe('formToInput', () => {
  it('uses today when the date is null and the typed date otherwise', () => {
    const r = formToInput(form({ attendees: [a1] }), TODAY);
    expect(r.ok && r.value.date).toBe(TODAY);
    const s = formToInput(form({ attendees: [a1], date: '2026-10-12' }), TODAY);
    expect(s.ok && s.value.date).toBe('2026-10-12');
  });
  it('rejects no students and invalid minutes', () => {
    expect(formToInput(blankForm(), TODAY)).toEqual({ ok: false, code: 'students-invalid' });
    expect(formToInput(form({ attendees: [a1], travel: '1000' }), TODAY)).toEqual({ ok: false, code: 'minutes-invalid' });
    expect(formToInput(form({ attendees: [a1], lesson: '' }), TODAY)).toEqual({ ok: false, code: 'minutes-invalid' });
  });
});

describe('prefillFromSession', () => {
  const last: Session = {
    id: 's1',
    date: '2026-10-12',
    startTime: '16:30',
    subject: 'math',
    attendees: [a1],
    credits: [{ familyId: 'A', lesson: 'full', activity: 'full' }],
    lessonMinutes: 60,
    activityMinutes: 15,
    travelMinutes: 20,
    createdAt: 1,
    updatedAt: 1,
  };
  const student = (id: string, familyId: string, archivedAt: number | null = null): Student => ({
    id,
    familyId,
    name: id,
    defaultSubject: 'both',
    notes: '',
    archivedAt,
    createdAt: 1,
    updatedAt: 1,
  });

  it('copies subject and minutes as text, resets date (null) and start time, credit empty, subject touched', () => {
    const f = prefillFromSession(last, [student('a1', 'A')]);
    expect(f).toMatchObject({ date: null, startTime: null, subject: 'math', lesson: '60', activity: '15', travel: '20', credits: {}, subjectTouched: true });
    expect(f.attendees).toEqual([a1]);
  });
  it('drops a student who is archived (not in the active list) and gives no attendees for a math session whose student is gone', () => {
    expect(prefillFromSession(last, []).attendees).toEqual([]);
    const two = { ...last, subject: 'swim' as const, attendees: [a1, b1] };
    expect(prefillFromSession(two, [student('b1', 'B')]).attendees).toEqual([b1]);
  });
  it('uses the student current family', () => {
    expect(prefillFromSession(last, [student('a1', 'C')]).attendees).toEqual([{ studentId: 'a1', familyId: 'C' }]);
  });
  it('a pre-filled form saves with date today', () => {
    const r = formToInput(prefillFromSession(last, [student('a1', 'A')]), TODAY);
    expect(r.ok && r.value.date).toBe(TODAY);
  });
});
