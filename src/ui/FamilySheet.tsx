import { useRef, useState } from 'preact/hooks';
import { archiveFamily, createFamily, deleteFamily, hasFamilyHistory, updateFamily } from '../data/families';
import { useLive } from '../data/live';
import type { Family, Period } from '../domain/types';
import { validateFamilyInput } from '../domain/validate';
import { Alert, Group, InputRow, Row, SegmentedControl, Sheet, saveErrorMessage, useAnimatedClose } from './components';

export function FamilySheet(props: { family?: Family; onClosed: () => void }) {
  const { family } = props;
  const [name, setName] = useState(family?.name ?? '');
  const [period, setPeriod] = useState<Period>(family?.period ?? 'weekly');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [del, setDel] = useState<null | { busy: boolean; failed: boolean }>(null);
  const busy = useRef(false); // synchronous guard: a double tap writes once
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 360);
  const hasStudents = useLive(() => (family ? hasFamilyHistory(family.id) : false), [family?.id]);

  const check = validateFamilyInput({ name, period });
  const nameError = !check.ok && (check.code === 'name-empty' || check.code === 'name-too-long') ? check.code : null;
  const nameCaption = touched && nameError ? (nameError === 'name-empty' ? 'Enter a name.' : 'Use 60 characters or fewer.') : undefined;
  const dirty = name !== (family?.name ?? '') || period !== (family?.period ?? 'weekly');
  const trimmed = name.trim();

  async function save() {
    if (busy.current || !check.ok) return;
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (family) await updateFamily(family.id, check.value);
      else await createFamily(check.value.name, check.value.period);
      close();
    } catch (e) {
      busy.current = false;
      setSaving(false);
      setSaveError(saveErrorMessage(e));
    }
  }

  async function archive() {
    if (busy.current || !family) return;
    busy.current = true;
    setSaveError(null);
    try {
      await archiveFamily(family.id);
      close();
    } catch (e) {
      busy.current = false;
      setSaveError(saveErrorMessage(e));
    }
  }

  async function confirmDelete() {
    if (!family || busy.current) return;
    busy.current = true;
    setDel({ busy: true, failed: false });
    try {
      const result = await deleteFamily(family.id);
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
        title={family ? 'Edit Family' : 'New Family'}
        onCancel={() => (dirty ? setDiscardOpen(true) : close())}
        onSave={() => void save()}
        saveDisabled={!check.ok || saving}
        closing={closing}
        onAnimationEnd={onAnimationEnd}
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
            placeholder="Family name"
            autoFocus
            invalid={touched && nameError !== null}
            onInput={setName}
            onBlur={() => setTouched(true)}
          />
        </Group>
        <Group footer="Weekly runs Monday to Sunday. Monthly is the calendar month.">
          <div class="row">
            <span class="row-label">Period</span>
            <SegmentedControl<Period>
              label="Period"
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              value={period}
              onChange={setPeriod}
            />
          </div>
        </Group>
        {family && (
          <Group footer="Archiving hides this family and its students from the roster. Their history is kept.">
            <Row onClick={() => void archive()}>Archive Family</Row>
          </Group>
        )}
        {family && hasStudents === false && (
          <Group danger>
            <Row tone="destructive" onClick={() => setDel({ busy: false, failed: false })}>
              Delete Family
            </Row>
          </Group>
        )}
        {family && hasStudents === true && (
          <section class="section">
            <p class="group-footer">This family can't be deleted while it has students or lesson history.</p>
          </section>
        )}
      </Sheet>
      {discardOpen && (
        <Alert
          title={trimmed ? `Discard changes to “${trimmed}”?` : 'Discard changes to this family?'}
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
      {del && family && (
        <Alert
          title={`Delete “${family.name}”?`}
          message={del.failed ? `Couldn't delete “${family.name}”. Nothing was changed.` : "This can't be undone."}
          buttons={[
            { label: 'Cancel', tone: 'accent', onClick: () => setDel(null) },
            { label: 'Delete Family', tone: 'destructive', strong: true, disabled: del.busy, onClick: () => void confirmDelete() },
          ]}
        />
      )}
    </>
  );
}
