import { useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { listActiveStudents } from '../data/students';
import { deleteSession, loadNameMaps, updateSession } from '../data/sessions';
import { todayLocal } from '../domain/dates';
import { formFromSession, formToInput, sameForm, setAttendees, type FormState } from '../domain/sessionForm';
import type { Session } from '../domain/types';
import { Alert, Group, Row, Sheet, sessionSaveErrorMessage, useAnimatedClose } from './components';
import { SessionFields } from './SessionFields';
import { StudentPicker } from './StudentPicker';

/** Edit Session: the Log form for one stored session. Save writes through updateSession; delete sits behind a confirm alert. */
export function SessionSheet(props: { session: Session; onClosed: () => void }) {
  const { session } = props;
  const [initial] = useState(() => formFromSession(session));
  const [form, setForm] = useState<FormState>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [del, setDel] = useState<null | { busy: boolean; failed: boolean }>(null);
  const busy = useRef(false); // synchronous guard: a double-tapped Save or Delete runs once
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 360);
  const people = useLive(async () => ({ names: await loadNameMaps(), active: await listActiveStudents() }));

  const check = formToInput(form, todayLocal());
  const dirty = !sameForm(form, initial);

  async function save() {
    // "Today" is resolved now, not at render: a date cleared back to today is stored as null and must save today.
    const fresh = formToInput(form, todayLocal());
    if (busy.current || !fresh.ok) return;
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateSession(session.id, fresh.value);
      close();
    } catch (e) {
      busy.current = false;
      setSaving(false);
      setSaveError(sessionSaveErrorMessage(e));
    }
  }

  async function confirmDelete() {
    if (busy.current) return;
    busy.current = true;
    setDel({ busy: true, failed: false });
    try {
      const result = await deleteSession(session.id);
      if (result.ok) {
        setDel(null);
        close();
        return;
      }
    } catch {
      // fall through to the failure state
    }
    busy.current = false;
    setDel({ busy: false, failed: true });
  }

  return (
    <>
      <Sheet
        title="Edit Session"
        onCancel={() => (dirty ? setDiscardOpen(true) : close())}
        onSave={() => void save()}
        saveDisabled={!check.ok || saving}
        closing={closing}
        onAnimationEnd={onAnimationEnd}
        overlay={
          pickerOpen && (
            <StudentPicker
              attendees={form.attendees}
              subject={form.subject}
              onChange={(attendees, tappedDefault) => setForm((f) => setAttendees(f, attendees, tappedDefault))}
              backLabel="Edit Session"
              inSheet
              onClosed={() => setPickerOpen(false)}
            />
          )
        }
      >
        {saveError && (
          <p class="sheet-error" role="alert">
            {saveError}
          </p>
        )}
        {people && (
          <SessionFields
            form={form}
            onChange={setForm}
            names={people.names}
            hasActiveStudents={people.active.length > 0}
            onOpenPicker={() => setPickerOpen(true)}
          />
        )}
        <Group>
          <Row tone="destructive" onClick={() => setDel({ busy: false, failed: false })}>
            Delete Session
          </Row>
        </Group>
      </Sheet>
      {discardOpen && (
        <Alert
          title="Discard changes to this session?"
          buttons={[
            { label: 'Keep Editing', tone: 'accent', strong: true, onClick: () => setDiscardOpen(false) },
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
      {del && (
        <Alert
          title="Delete this session?"
          message={del.failed ? "Couldn't delete this session. Nothing was changed. Try again." : "This can't be undone."}
          buttons={[
            { label: 'Cancel', tone: 'accent', onClick: () => setDel(null) },
            {
              label: 'Delete Session',
              tone: 'destructive',
              strong: true,
              disabled: del.busy,
              onClick: () => void confirmDelete(),
            },
          ]}
        />
      )}
    </>
  );
}
