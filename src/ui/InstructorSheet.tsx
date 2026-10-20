import { useRef, useState } from 'preact/hooks';
import { setInstructorName } from '../data/instructor';
import { NAME_MAX } from '../domain/types';
import { instructorFormState } from '../domain/validate';
import { Alert, Group, InputRow, Sheet, saveErrorMessage, useAnimatedClose } from './components';

/** D-10: the instructor name printed at the top of each summary PDF. A blank name is allowed and clears it. */
export function InstructorSheet(props: { name: string | null; onClosed: () => void }) {
  const [input, setInput] = useState(props.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const busy = useRef(false); // synchronous guard: a double tap writes once
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 360);
  const form = instructorFormState(props.name, input);

  async function save() {
    if (busy.current || !form.canSave) return;
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await setInstructorName(input);
      close();
    } catch (e) {
      busy.current = false;
      setSaving(false);
      setSaveError(saveErrorMessage(e));
    }
  }

  return (
    <>
      <Sheet
        title="Instructor Name"
        onCancel={() => (form.dirty ? setDiscardOpen(true) : close())}
        onSave={() => void save()}
        saveDisabled={!form.canSave || saving}
        closing={closing}
        onAnimationEnd={onAnimationEnd}
      >
        {saveError && (
          <p class="sheet-error" role="alert">
            {saveError}
          </p>
        )}
        <Group>
          <InputRow label="Name" value={input} placeholder="e.g. Connor B." autoFocus maxLength={NAME_MAX} autoCapitalize="words" onInput={setInput} />
        </Group>
      </Sheet>
      {discardOpen && (
        <Alert
          title="Discard changes to the instructor name?"
          buttons={[
            { label: 'Keep Editing', tone: 'accent', onClick: () => setDiscardOpen(false) },
            {
              label: 'Discard Changes',
              tone: 'destructive',
              strong: true,
              onClick: () => {
                setDiscardOpen(false);
                close();
              },
            },
          ]}
        />
      )}
    </>
  );
}
