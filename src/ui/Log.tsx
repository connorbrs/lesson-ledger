import { useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { createSession, loadNameMaps } from '../data/sessions';
import { listActiveStudents } from '../data/students';
import { todayLocal } from '../domain/dates';
import { blankForm, formToInput, type FormState } from '../domain/sessionForm';
import { saveErrorMessage } from './components';
import { SessionFields } from './SessionFields';

export function Log(props: { draft: FormState; setDraft: (f: FormState) => void; onOpenPicker: () => void }) {
  const { draft } = props;
  const data = useLive(async () => ({ active: await listActiveStudents(), names: await loadNameMaps() }));
  const busy = useRef(false); // synchronous guard: a double tap writes once
  const [saveError, setSaveError] = useState<string | null>(null);
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
      {data && (
        <SessionFields
          form={draft}
          onChange={props.setDraft}
          names={data.names}
          hasActiveStudents={data.active.length > 0}
          onOpenPicker={props.onOpenPicker}
        />
      )}
      {saveError && <p class="sheet-error" role="alert">{saveError}</p>}
      <div class="log-actions">
        <button type="button" class="primary-button full" disabled={!check.ok} onClick={() => void save()}>
          Log Session
        </button>
      </div>
    </>
  );
}
