import { describe, expect, it } from 'vitest';
import {
  blankForm,
  changeSubject,
  formFromSession,
  sameForm,
  formToInput,
  lessonMinutesOf,
  needsCreditGroups,
  parseMinutes,
  prefillFromSession,
  setAttendees,
  parseTypedDuration,
  setDuration,
  setFinishTime,
  setStartTime,
  timeCaption,
  togglePick,
  type FormState,
} from '../src/domain/sessionForm';
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
  it('starts with Finish at now, Start 45 minutes earlier, Activity 0, Travel 0, swim and no students', () => {
    expect(blankForm('16:00')).toMatchObject({ startTime: '15:15', endTime: '16:00', duration: 45, activity: '0', travel: '0', subject: 'swim', attendees: [], date: null, subjectTouched: false });
  });
  it('clamps Start at 00:00 and shrinks Duration so Start plus Duration still equals Finish', () => {
    expect(blankForm('00:20')).toMatchObject({ startTime: '00:00', endTime: '00:20', duration: 20 });
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

describe('formToInput date', () => {
  it('a null date means the day of the call, so a form open past midnight saves the new day', () => {
    const f = form({ attendees: [a1] });
    expect(formToInput(f, '2026-10-18')).toMatchObject({ ok: true, value: { date: '2026-10-18' } });
    expect(formToInput(f, '2026-10-19')).toMatchObject({ ok: true, value: { date: '2026-10-19' } });
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
    expect(formToInput(form({ attendees: [a1], activity: '' }), TODAY)).toEqual({ ok: false, code: 'minutes-invalid' });
  });
});

describe('prefillFromSession', () => {
  const last: Session = {
    id: 's1',
    date: '2026-10-12',
    startTime: '16:30',
    endTime: '17:45',
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

  it('copies subject and Activity and Travel, resets date (null), sets Start and Finish from now and the last Duration, credit empty, subject touched', () => {
    const f = prefillFromSession(last, [student('a1', 'A')], '18:00');
    expect(f).toMatchObject({ date: null, startTime: '16:45', endTime: '18:00', duration: 75, subject: 'math', activity: '15', travel: '20', credits: {}, subjectTouched: true });
    expect(f).not.toHaveProperty('lesson');
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

describe('formFromSession', () => {
  const stored: Session = {
    id: 's1',
    date: '2026-10-12',
    startTime: '16:30',
    endTime: '17:45',
    subject: 'swim',
    attendees: [a1, b1],
    credits: [
      { familyId: 'A', lesson: 'half', activity: 'full' },
      { familyId: 'B', lesson: 'full', activity: 'full' },
    ],
    lessonMinutes: 45,
    activityMinutes: 30,
    travelMinutes: 15,
    createdAt: 1,
    updatedAt: 1,
  };

  it('round-trips a stored two-family swim through formToInput to the stored fields', () => {
    const { id, createdAt, updatedAt, ...fields } = stored;
    expect(formToInput(formFromSession(stored), TODAY)).toEqual({ ok: true, value: fields });
  });

  it('round-trips a one-family math session', () => {
    const math: Session = { ...stored, subject: 'math', attendees: [a1], credits: [{ familyId: 'A', lesson: 'full', activity: 'full' }] };
    const { id, createdAt, updatedAt, ...fields } = math;
    expect(formToInput(formFromSession(math), TODAY)).toEqual({ ok: true, value: fields });
  });

  it('a row saved before Finish existed opens with Finish = Start plus Duration, and the save stores it', () => {
    const legacy = { ...stored } as Partial<Session>;
    delete legacy.endTime;
    expect(formFromSession(legacy as Session).endTime).toBe('17:45');
    expect(formToInput(formFromSession(legacy as Session), TODAY)).toMatchObject({ ok: true, value: { endTime: '17:45' } });
  });

  it('sameForm ignores the order students were picked in but not a changed value', () => {
    const f = formFromSession(stored);
    expect(sameForm(f, { ...f, attendees: [...f.attendees].reverse() })).toBe(true);
    expect(sameForm(f, { ...f, activity: '31' })).toBe(false);
  });
});

describe('Start, Finish and Duration sync (D-02, D-03)', () => {
  const base = () => ({ ...blankForm('16:00'), attendees: [a1] }); // Start 15:15, Finish 16:00, Duration 45

  it('setStartTime keeps Duration and moves Finish; null clears Start and Finish', () => {
    expect(setStartTime(base(), '14:00')).toMatchObject({ startTime: '14:00', endTime: '14:45', duration: 45 });
    expect(setStartTime(base(), null)).toMatchObject({ startTime: null, endTime: null });
  });

  it('setFinishTime sets Duration from Start', () => {
    expect(setFinishTime(base(), '15:30')).toMatchObject({ endTime: '15:30', duration: 15 });
  });

  it('a Finish before Start keeps the typed Finish and Duration, blocks Save and shows the Finish caption', () => {
    const f = setFinishTime(base(), '15:00');
    expect(f).toMatchObject({ endTime: '15:00', duration: 45 });
    expect(formToInput(f, TODAY)).toEqual({ ok: false, code: 'time-invalid' });
    expect(timeCaption(f)).toEqual({ row: 'finish', text: "Finish can't be before Start." });
  });

  it('a Finish equal to Start is a zero-minute Duration and saves', () => {
    const f = setFinishTime(base(), '15:15');
    expect(f.duration).toBe(0);
    expect(formToInput(f, TODAY)).toMatchObject({ ok: true, value: { startTime: '15:15', endTime: '15:15', lessonMinutes: 0, activityMinutes: 0 } });
  });

  it('setDuration moves Finish from Start, and with no Start only changes Duration', () => {
    expect(setDuration(base(), 60)).toMatchObject({ endTime: '16:15', duration: 60 });
    expect(setDuration(setStartTime(base(), null), 60)).toMatchObject({ startTime: null, endTime: null, duration: 60 });
  });

  it('parseTypedDuration accepts 0–999 typed minutes and refuses 1234 instead of clipping it', () => {
    expect(parseTypedDuration('')).toBe(0);
    expect(parseTypedDuration('105')).toBe(105);
    expect(parseTypedDuration('999')).toBe(999);
    expect(parseTypedDuration('1234')).toBeNull();
    expect(parseTypedDuration('1:45')).toBeNull();
  });

  it('setDuration ignores values outside whole minutes 0–999', () => {
    const f = base();
    expect(setDuration(f, 1000)).toBe(f);
    expect(setDuration(f, 1234)).toBe(f);
    expect(setDuration(f, -1)).toBe(f);
    expect(setDuration(f, 2.5)).toBe(f);
    expect(setDuration(f, 999)).toMatchObject({ duration: 999 });
  });

  it('a Start past midnight leaves Finish null, blocks Save and shows the midnight caption', () => {
    const f = setStartTime(base(), '23:30');
    expect(f.endTime).toBeNull();
    expect(formToInput(f, TODAY)).toEqual({ ok: false, code: 'time-invalid' });
    expect(timeCaption(f)).toEqual({ row: 'finish', text: "Session can't run past midnight." });
  });

  it('Lesson is Duration minus Activity, stored as lessonMinutes', () => {
    const f = { ...base(), activity: '10' };
    expect(lessonMinutesOf(f)).toBe(35);
    expect(formToInput(f, TODAY)).toMatchObject({ ok: true, value: { lessonMinutes: 35, activityMinutes: 10 } });
  });

  it('Activity above Duration has no Lesson, blocks Save and shows the Activity caption', () => {
    const f = { ...base(), activity: '50' };
    expect(lessonMinutesOf(f)).toBeNull();
    expect(formToInput(f, TODAY)).toEqual({ ok: false, code: 'minutes-invalid' });
    expect(timeCaption(f)).toEqual({ row: 'activity', text: "Activity can't be longer than Duration." });
  });

  it('a valid form has no caption', () => {
    expect(timeCaption(base())).toBeNull();
  });
});
