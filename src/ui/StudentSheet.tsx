import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { getFamily, listActiveFamilies } from '../data/families';
import { useLive } from '../data/live';
import {
  archiveStudent,
  createStudent,
  deleteStudent,
  studentHasHistory,
  updateStudent,
} from '../data/students';
import type { DefaultSubject, Family, Student } from '../domain/types';
import { validateStudentInput } from '../domain/validate';
import {
  Alert,
  CheckIcon,
  Group,
  InputRow,
  NavBar,
  PushLayer,
  Row,
  Screen,
  SegmentedControl,
  Sheet,
  saveErrorMessage,
  useAnimatedClose,
} from './components';

/** Pushed screen inside the Student sheet: active families only, accent check on the chosen one. */
function FamilyPicker(props: {
  families: Family[];
  selectedId: string;
  backLabel: string;
  onSelect: (id: string) => void;
  onClosed: () => void;
}) {
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);

  // If the last active family is archived while the picker is open, pop back.
  useEffect(() => {
    if (props.families.length === 0) close();
  }, [props.families.length]);

  return (
    <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
      <Screen
        inSheet
        nav={<NavBar inSheet title="Family" back={{ label: props.backLabel, onClick: close }} />}
      >
        <div class="sheet-body-top" />
        <Group>
          {props.families.map((f) => (
            <button
              key={f.id}
              type="button"
              class="row"
              aria-current={f.id === props.selectedId ? 'true' : undefined}
              onClick={() => {
                props.onSelect(f.id);
                close();
              }}
            >
              <span class="picker-row-name clamp2">{f.name}</span>
              {f.id === props.selectedId && (
                <span class="picker-row-check">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </Group>
      </Screen>
    </PushLayer>
  );
}

function NotesRow(props: { value: string; onInput: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with content; no cap and no counter (D-07).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <label class="row input-row note-field">
      <textarea
        ref={ref}
        rows={1}
        value={props.value}
        placeholder="Private notes"
        aria-label="Private notes"
        autocapitalize="sentences"
        onInput={(e) => props.onInput(e.currentTarget.value)}
      />
    </label>
  );
}

export function StudentSheet(props: { student?: Student; presetFamilyId?: string; onClosed: () => void }) {
  const { student } = props;
  const initial = {
    name: student?.name ?? '',
    familyId: student?.familyId ?? props.presetFamilyId ?? '',
    subject: student?.defaultSubject ?? ('both' as DefaultSubject),
    notes: student?.notes ?? '',
  };
  const [name, setName] = useState(initial.name);
  const [familyId, setFamilyId] = useState(initial.familyId);
  const [subject, setSubject] = useState<DefaultSubject>(initial.subject);
  const [notes, setNotes] = useState(initial.notes);
  const [nameTouched, setNameTouched] = useState(false);
  const [familyTouched, setFamilyTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [del, setDel] = useState<null | { busy: boolean; failed: boolean }>(null);
  const busy = useRef(false); // synchronous guard: a double tap writes once
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 360);

  const data = useLive(
    async () => ({
      active: await listActiveFamilies(),
      chosen: familyId ? await getFamily(familyId) : undefined,
    }),
    [familyId],
  );
  const hasHistory = useLive(() => (student ? studentHasHistory(student.id) : false), [student?.id]);

  const active = data?.active ?? [];
  const noActiveFamily = data !== undefined && active.length === 0;
  // Only an active family counts as chosen (the picker lists active families only).
  const chosen = data?.chosen && active.some((f) => f.id === data.chosen?.id) ? data.chosen : undefined;

  const check = validateStudentInput({ familyId: chosen?.id, name, defaultSubject: subject, notes });
  const nameError = !check.ok && (check.code === 'name-empty' || check.code === 'name-too-long') ? check.code : null;
  const nameCaption =
    nameTouched && nameError ? (nameError === 'name-empty' ? 'Enter a name.' : 'Use 60 characters or fewer.') : undefined;
  const familyCaption = noActiveFamily ? 'Add a family first.' : familyTouched && !chosen ? 'Choose a family.' : undefined;
  const dirty =
    name !== initial.name || familyId !== initial.familyId || subject !== initial.subject || notes !== initial.notes;
  const trimmed = name.trim();

  async function save() {
    if (busy.current || !check.ok) return;
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (student) await updateStudent(student.id, check.value);
      else await createStudent(check.value);
      close();
    } catch (e) {
      busy.current = false;
      setSaving(false);
      setSaveError(saveErrorMessage(e));
    }
  }

  async function archive() {
    if (busy.current || !student) return;
    busy.current = true;
    setSaveError(null);
    try {
      await archiveStudent(student.id);
      close();
    } catch (e) {
      busy.current = false;
      setSaveError(saveErrorMessage(e));
    }
  }

  async function confirmDelete() {
    if (!student || busy.current) return;
    busy.current = true;
    setDel({ busy: true, failed: false });
    try {
      const result = await deleteStudent(student.id);
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

  const title = student ? 'Edit Student' : 'New Student';

  return (
    <>
      <Sheet
        title={title}
        onCancel={() => (dirty ? setDiscardOpen(true) : close())}
        onSave={() => void save()}
        saveDisabled={!check.ok || saving}
        closing={closing}
        onAnimationEnd={onAnimationEnd}
        overlay={
          pickerOpen && (
            <FamilyPicker
              families={active}
              selectedId={chosen?.id ?? ''}
              backLabel={title}
              onSelect={setFamilyId}
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
        <Group footer={nameCaption} footerError>
          <InputRow
            label="Name"
            value={name}
            placeholder="Student name"
            autoFocus
            invalid={nameTouched && nameError !== null}
            onInput={setName}
            onBlur={() => setNameTouched(true)}
          />
        </Group>
        <Group footer={familyCaption} footerError>
          <Row
            chevron
            value={chosen ? chosen.name : 'Choose Family'}
            onClick={() => {
              setFamilyTouched(true);
              if (!noActiveFamily) setPickerOpen(true);
            }}
          >
            Family
          </Row>
        </Group>
        <Group footer="Used to pre-pick the subject when you log a session.">
          <div class="row">
            <span class="row-label">Default Subject</span>
            <SegmentedControl<DefaultSubject>
              label="Default Subject"
              options={[
                { value: 'swim', label: 'Swim' },
                { value: 'math', label: 'Math' },
                { value: 'both', label: 'Both' },
              ]}
              value={subject}
              onChange={setSubject}
            />
          </div>
        </Group>
        <Group header="Private Notes" footer="Only you can see these. They never appear on summaries.">
          <NotesRow value={notes} onInput={setNotes} />
        </Group>
        {student && (
          <Group footer="Archiving hides this student from quick entry. Their history is kept.">
            <Row onClick={() => void archive()}>Archive Student</Row>
          </Group>
        )}
        {student && hasHistory === false && (
          <Group>
            <Row tone="destructive" onClick={() => setDel({ busy: false, failed: false })}>
              Delete Student
            </Row>
          </Group>
        )}
        {student && hasHistory === true && (
          <section class="section">
            <div class="group-footer">This has sessions, so it can only be archived.</div>
          </section>
        )}
      </Sheet>
      {discardOpen && (
        <Alert
          title={trimmed ? `Discard changes to “${trimmed}”?` : 'Discard changes to this student?'}
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
      {del && student && (
        <Alert
          title={`Delete “${student.name}”?`}
          message={
            del.failed ? `Couldn't delete “${student.name}”. Nothing was changed.` : "This can't be undone."
          }
          buttons={[
            { label: 'Cancel', tone: 'accent', onClick: () => setDel(null) },
            {
              label: 'Delete Student',
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
