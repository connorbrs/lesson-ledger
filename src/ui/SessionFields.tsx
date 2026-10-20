import { useEffect, useState } from 'preact/hooks';
import { formatDateValue, formatDuration, formatTime12, todayLocal } from '../domain/dates';
import { formatMinutes } from '../domain/hours';
import { creditedMinutes } from '../domain/session';
import {
  changeSubject,
  creditFamilies,
  lessonMinutesOf,
  needsCreditGroups,
  parseMinutes,
  parseTypedDuration,
  setDuration,
  setFinishTime,
  setStartTime,
  timeCaption,
  type FormCredit,
  type FormState,
} from '../domain/sessionForm';
import type { CreditMode, Subject } from '../domain/types';
import { Group, Row, SegmentedControl } from './components';
import { ExpensesGroup } from './ExpensesGroup';

const CREDIT_OPTIONS: { value: CreditMode; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'half', label: 'Half' },
];

/** Activity and Travel: whole minutes typed as text, one cell of the Minutes strip. Its error shows under the strip. */
function MinutesCell(props: { label: string; value: string; invalid: boolean; onChange: (value: string) => void; onBlur: () => void }) {
  return (
    <label class={`metric${props.invalid ? ' invalid' : ''}`}>
      <span class="metric-label">{props.label}</span>
      <span class="metric-entry">
        <input
          class="metric-input figure"
          style={{ width: `${Math.max(1, props.value.length) + 0.5}ch` }}
          type="text"
          inputmode="numeric"
          maxlength={3}
          value={props.value}
          aria-label={`${props.label} minutes`}
          aria-invalid={props.invalid ? true : undefined}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onBlur={props.onBlur}
        />
        <span class="metric-unit">min</span>
      </span>
    </label>
  );
}

/** "4:00 PM" as a large figure with a small meridiem, so a 12-hour time fits a third of the phone. */
function ClockTime(props: { value: string }) {
  const [time, meridiem] = formatTime12(props.value).split(' ');
  return (
    <>
      {time}
      {meridiem && <span class="metric-unit"> {meridiem}</span>}
    </>
  );
}

const invalidMinutes = (text: string, touched: boolean) => parseMinutes(text) === null && (text.trim() !== '' || touched);

/** The form body shared by the Log tab and the Edit Session sheet. */
export function SessionFields(props: {
  form: FormState;
  onChange: (next: FormState) => void;
  names: { students: Record<string, string>; families: Record<string, string> };
  hasActiveStudents: boolean;
  onOpenPicker: () => void;
  /** Opens the Expense editor (null = new). Without it the form shows no Expenses group. */
  onOpenExpense?: (id: string | null) => void;
}) {
  const { form, names } = props;
  // Duration text while the field is focused (plain minutes); null shows the h:mm display.
  const [durationText, setDurationText] = useState<string | null>(null);
  const [touched, setTouched] = useState({ activity: false, travel: false });
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
  const lesson = lessonMinutesOf(form);
  const activity = parseMinutes(form.activity);
  const caption = timeCaption(form);
  const finishCaption = caption?.row === 'finish' ? caption.text : null;
  const activityCaption = caption?.row === 'activity' ? caption.text : null;
  const activityInvalid = invalidMinutes(form.activity, touched.activity);
  const travelInvalid = invalidMinutes(form.travel, touched.travel);
  const minutesError =
    activityInvalid || travelInvalid ? `${activityInvalid ? 'Activity' : 'Travel'}: use whole minutes, 0 to 999.` : activityCaption;
  const minutesFooter = minutesError ?? 'Lesson is Duration minus Activity. Travel is for your records only. It never appears on family summaries.';

  const creditOf = (familyId: string): FormCredit => form.credits[familyId] ?? { lesson: 'full', activity: 'full' };
  const setCredit = (familyId: string, field: keyof FormCredit, mode: CreditMode) =>
    set({ credits: { ...form.credits, [familyId]: { ...creditOf(familyId), [field]: mode } } });

  return (
    <>
      <Group header="Session" footer={finishCaption ?? undefined} footerError={finishCaption !== null}>
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
        <div class="metric-strip">
          <div class="metric">
            <span class="metric-label">
              Start
              {form.startTime && (
                <button type="button" class="metric-action" onClick={() => props.onChange(setStartTime(form, null))}>
                  Clear
                </button>
              )}
            </span>
            <span class={`metric-value figure${form.startTime ? '' : ' unset'}`}>{form.startTime ? <ClockTime value={form.startTime} /> : 'Not set'}</span>
            <input
              class="row-overlay-input"
              type="time"
              aria-label="Start time"
              value={form.startTime ?? ''}
              onInput={(e) => e.currentTarget.value && props.onChange(setStartTime(form, e.currentTarget.value))}
            />
          </div>
          <div class="metric">
            <span class="metric-label">Finish</span>
            {form.startTime ? (
              <>
                <span class={`metric-value figure${form.endTime ? '' : ' unset'}`}>{form.endTime ? <ClockTime value={form.endTime} /> : 'Not set'}</span>
                <input
                  class="row-overlay-input"
                  type="time"
                  aria-label="Finish time"
                  value={form.endTime ?? ''}
                  onInput={(e) => e.currentTarget.value && props.onChange(setFinishTime(form, e.currentTarget.value))}
                />
              </>
            ) : (
              <span class="metric-value unset">Set Start first</span>
            )}
          </div>
          <label class="metric">
            <span class="metric-label">Duration</span>
            <input
              class="metric-input figure"
              type="text"
              inputmode="numeric"
              value={durationText ?? formatDuration(form.duration)}
              aria-label="Duration in minutes"
              onFocus={(e) => {
                // While editing, the field shows plain minutes; on blur it shows h:mm again.
                setDurationText(String(form.duration));
                const input = e.currentTarget;
                requestAnimationFrame(() => input.select());
              }}
              onBlur={() => setDurationText(null)}
              onInput={(e) => {
                const minutes = parseTypedDuration(e.currentTarget.value);
                if (minutes === null) {
                  // Over 999 minutes or not digits: refuse the keystroke and keep the previous value.
                  e.currentTarget.value = durationText ?? String(form.duration);
                  return;
                }
                setDurationText(e.currentTarget.value.trim());
                props.onChange(setDuration(form, minutes));
              }}
            />
          </label>
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
      <Group header="Minutes" footer={minutesFooter} footerError={minutesError !== null}>
        <div class="metric-strip">
          <div class="metric derived">
            <span class="metric-label">Lesson</span>
            <span class={`metric-value figure${lesson === null ? ' unset' : ''}`}>{lesson === null ? 'Not set' : formatDuration(lesson)}</span>
          </div>
          <MinutesCell
            label="Activity"
            value={form.activity}
            invalid={activityInvalid || activityCaption !== null}
            onChange={(activity) => set({ activity })}
            onBlur={() => setTouched((t) => ({ ...t, activity: true }))}
          />
          <MinutesCell
            label="Travel"
            value={form.travel}
            invalid={travelInvalid}
            onChange={(travel) => set({ travel })}
            onBlur={() => setTouched((t) => ({ ...t, travel: true }))}
          />
        </div>
      </Group>
      {grouped &&
        creditFamilies(form.attendees).map((familyId) => {
          const credit = creditOf(familyId);
          return (
            <Group
              key={familyId}
              header={names.families[familyId] ?? ''}
              nameHeader
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
      {props.onOpenExpense && (
        <ExpensesGroup expenses={form.expenses} familyIds={creditFamilies(form.attendees)} familyNames={names.families} onOpen={props.onOpenExpense} />
      )}
    </>
  );
}
