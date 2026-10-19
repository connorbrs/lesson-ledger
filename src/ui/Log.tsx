import { useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { createSession } from '../data/sessions';
import { listActiveStudents } from '../data/students';
import { todayLocal } from '../domain/dates';
import { blankForm, formToInput, parseMinutes, type FormState } from '../domain/sessionForm';
import { Group, InputRow, Row, saveErrorMessage } from './components';

/** Task 1 tracer form: students and lesson minutes. SessionFields replaces the body in task 2. */
export function Log(props: { draft: FormState; setDraft: (f: FormState) => void; onOpenPicker: () => void }) {
  const { draft } = props;
  const students = useLive(listActiveStudents);
  const busy = useRef(false); // synchronous guard: a double tap writes once
  const [saveError, setSaveError] = useState<string | null>(null);

  const names = draft.attendees.map((a) => students?.find((s) => s.id === a.studentId)?.name).filter(Boolean);
  const check = formToInput(draft, todayLocal());

  async function save() {
    if (busy.current || !check.ok) return;
    busy.current = true;
    setSaveError(null);
    try {
      await createSession(check.value);
      props.setDraft(blankForm());
    } catch (e) {
      setSaveError(saveErrorMessage(e));
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <h1 class="large-title">Log</h1>
      <Group>
        <Row chevron value={names.length ? names.join(', ') : 'Choose students'} onClick={props.onOpenPicker}>
          Students
        </Row>
      </Group>
      <Group footer={parseMinutes(draft.lesson) === null ? 'Use whole minutes, 0 to 999.' : undefined} footerError>
        <InputRow label="Lesson" value={draft.lesson} placeholder="min" onInput={(lesson) => props.setDraft({ ...draft, lesson })} />
      </Group>
      {saveError && <p class="sheet-error" role="alert">{saveError}</p>}
      <div class="log-actions">
        <button type="button" class="primary-button full" disabled={!check.ok} onClick={() => void save()}>
          Log Session
        </button>
      </div>
    </>
  );
}
