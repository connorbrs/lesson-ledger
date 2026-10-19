import { useEffect, useState } from 'preact/hooks';
import { formatDateValue, formatTime12, todayLocal } from '../domain/dates';
import { formatMinutes } from '../domain/hours';
import { creditedMinutes } from '../domain/session';
import { changeSubject, creditFamilies, needsCreditGroups, parseMinutes, type FormCredit, type FormState } from '../domain/sessionForm';
import type { CreditMode, Subject } from '../domain/types';
import { Group, Row, SegmentedControl } from './components';

const PRESETS = ['30', '45', '60'].map((v) => ({ value: v, label: v }));
const CREDIT_OPTIONS: { value: CreditMode; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'half', label: 'Half' },
];

function MinutesBlock(props: { label: string; value: string; onChange: (value: string) => void }) {
  const [touched, setTouched] = useState(false);
  const trimmed = props.value.trim();
  const invalid = parseMinutes(props.value) === null && (trimmed !== '' || touched);
  return (
    <div class="row minutes-block">
      <div class="minutes-line">
        <span class="row-label">{props.label}</span>
        <input
          class="minutes-input"
          type="text"
          inputmode="numeric"
          maxlength={3}
          value={props.value}
          aria-label={`${props.label} minutes`}
          aria-invalid={invalid ? true : undefined}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onBlur={() => setTouched(true)}
        />
        <span class="minutes-suffix">min</span>
      </div>
      <SegmentedControl
        label={`${props.label} presets`}
        options={PRESETS}
        value={PRESETS.some((p) => p.value === trimmed) ? trimmed : ''}
        onChange={props.onChange}
      />
      {invalid && <p class="label minutes-error">Use whole minutes, 0 to 999.</p>}
    </div>
  );
}

/** The form body shared by the Log tab and the Edit Session sheet. */
export function SessionFields(props: {
  form: FormState;
  onChange: (next: FormState) => void;
  names: { students: Record<string, string>; families: Record<string, string> };
  hasActiveStudents: boolean;
  onOpenPicker: () => void;
}) {
  const { form, names } = props;
  // A form left open past midnight must show the new "Today": re-render when the app is shown again.
  const [, setClock] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setClock((n) => n + 1);
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const today = todayLocal();
  const set = (patch: Partial<FormState>) => props.onChange({ ...form, ...patch });
  const studentNames = form.attendees.map((a) => names.students[a.studentId]).filter(Boolean);
  const grouped = needsCreditGroups(form.subject, form.attendees);
  const lesson = parseMinutes(form.lesson);
  const activity = parseMinutes(form.activity);

  const creditOf = (familyId: string): FormCredit => form.credits[familyId] ?? { lesson: 'full', activity: 'full' };
  const setCredit = (familyId: string, field: keyof FormCredit, mode: CreditMode) =>
    set({ credits: { ...form.credits, [familyId]: { ...creditOf(familyId), [field]: mode } } });

  return (
    <>
      <Group header="Session">
        <div class="row">
          <span class="row-label">Date</span>
          <span class="row-value">{formatDateValue(form.date ?? today, today)}</span>
          <input
            class="row-overlay-input"
            type="date"
            aria-label="Date"
            value={form.date ?? today}
            onInput={(e) => e.currentTarget.value && set({ date: e.currentTarget.value === today ? null : e.currentTarget.value })}
          />
        </div>
        <div class="row">
          <span class="row-label">Start</span>
          <span class={`row-value${form.startTime ? ' tone-primary' : ''}`}>{form.startTime ? formatTime12(form.startTime) : 'Not set'}</span>
          {form.startTime && (
            <button type="button" class="text-button clear-start" onClick={() => set({ startTime: null })}>
              Clear Start Time
            </button>
          )}
          <input
            class="row-overlay-input"
            type="time"
            aria-label="Start time"
            value={form.startTime ?? ''}
            onInput={(e) => e.currentTarget.value && set({ startTime: e.currentTarget.value })}
          />
        </div>
        <div class="row">
          <span class="row-label">Subject</span>
          <SegmentedControl<Subject>
            label="Subject"
            options={[
              { value: 'swim', label: 'Swim' },
              { value: 'math', label: 'Math' },
            ]}
            value={form.subject}
            onChange={(subject) => props.onChange(changeSubject(form, subject))}
          />
        </div>
      </Group>
      <Group
        header="Students"
        footer={!props.hasActiveStudents ? 'Add a student on the People tab first.' : grouped ? 'Two families: choose full or half credit for each below.' : undefined}
      >
        <Row chevron value={studentNames.length ? studentNames.join(', ') : props.hasActiveStudents ? 'Choose students' : 'Add a student first'} onClick={props.onOpenPicker}>
          Students
        </Row>
      </Group>
      <Group header="Minutes" footer="Travel is for your records only. It never appears on family summaries.">
        <MinutesBlock label="Lesson" value={form.lesson} onChange={(lesson) => set({ lesson })} />
        <MinutesBlock label="Activity" value={form.activity} onChange={(activity) => set({ activity })} />
        <MinutesBlock label="Travel" value={form.travel} onChange={(travel) => set({ travel })} />
      </Group>
      {grouped &&
        creditFamilies(form.attendees).map((familyId) => {
          const credit = creditOf(familyId);
          return (
            <Group
              key={familyId}
              header={names.families[familyId] ?? ''}
              footer={
                lesson !== null && activity !== null
                  ? `Credited: ${formatMinutes(creditedMinutes(lesson, credit.lesson))} lesson, ${formatMinutes(creditedMinutes(activity, credit.activity))} activity.`
                  : undefined
              }
            >
              {(['lesson', 'activity'] as const).map((field) => (
                <div class="row" key={field}>
                  <span class="row-label">{field === 'lesson' ? 'Lesson' : 'Activity'}</span>
                  <SegmentedControl<CreditMode>
                    label={`${field === 'lesson' ? 'Lesson' : 'Activity'} credit`}
                    options={CREDIT_OPTIONS}
                    value={credit[field]}
                    onChange={(mode) => setCredit(familyId, field, mode)}
                  />
                </div>
              ))}
            </Group>
          );
        })}
    </>
  );
}
