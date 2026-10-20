import { useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { listActiveStudents } from '../data/students';
import { loadExpenseDrafts } from '../data/expenses';
import { deleteSession, loadNameMaps, updateSession } from '../data/sessions';
import { todayLocal } from '../domain/dates';
import { sessionDeleteMessage, type ExpenseDraft } from '../domain/expense';
import {
  creditFamilies,
  formFromSession,
  formToInput,
  needsCreditGroups,
  removeExpense,
  sameForm,
  setAttendees,
  upsertExpense,
  type FormState,
} from '../domain/sessionForm';
import type { Session } from '../domain/types';
import { Alert, Group, Row, Sheet, sessionSaveErrorMessage, useAnimatedClose } from './components';
import { ExpenseEditor } from './ExpenseEditor';
import type { PhotoStage } from './receiptPhotos';
import { SessionFields } from './SessionFields';
import { StudentPicker } from './StudentPicker';

/**
 * Edit Session. Loads the session's stored expenses once BEFORE the form renders (Pitfall 2), so the first
 * render's form already holds them: an untouched sheet is not dirty and Save cannot run before the load ends.
 */
export function SessionSheet(props: { session: Session; onClosed: () => void }) {
  const { session } = props;
  const loaded = useLive(() => loadExpenseDrafts(session.id, creditFamilies(session.attendees)), [session.id]);
  const first = useRef<ExpenseDraft[] | null>(null);
  if (first.current === null && loaded !== undefined) first.current = loaded; // later live emissions are ignored
  if (first.current === null) return null;
  return <SessionSheetBody session={session} drafts={first.current} onClosed={props.onClosed} />;
}

/** The Log form for one stored session. Save writes through updateSession; delete sits behind a confirm alert. */
function SessionSheetBody(props: { session: Session; drafts: ExpenseDraft[]; onClosed: () => void }) {
  const { session } = props;
  const [initial] = useState(() => formFromSession(session, props.drafts));
  const [form, setForm] = useState<FormState>(initial);
  // Receipt photos staged in memory; written with the session when Save runs.
  const [stage] = useState<PhotoStage>(() => new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  // The open Expense editor: null (closed) or the expense being edited (id null = new).
  const [expenseOpen, setExpenseOpen] = useState<{ id: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [del, setDel] = useState<null | { busy: boolean; failed: boolean }>(null);
  const busy = useRef(false); // synchronous guard: a double-tapped Save or Delete runs once
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 360);
  const people = useLive(async () => ({ names: await loadNameMaps(), active: await listActiveStudents() }));

  const families = creditFamilies(form.attendees);
  const splitIds: [string, string] | null = needsCreditGroups(form.subject, form.attendees) ? [families[0], families[1]] : null;
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
      await updateSession(session.id, fresh.value, { expenses: form.expenses, photos: stage });
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
          pickerOpen ? (
            <StudentPicker
              attendees={form.attendees}
              subject={form.subject}
              onChange={(attendees, tappedDefault) => setForm((f) => setAttendees(f, attendees, tappedDefault))}
              backLabel="Edit Session"
              inSheet
              onClosed={() => setPickerOpen(false)}
            />
          ) : (
            expenseOpen && (
              <ExpenseEditor
                key={expenseOpen.id ?? 'new'}
                initial={form.expenses.find((e) => e.id === expenseOpen.id) ?? null}
                backLabel="Edit Session"
                inSheet
                splitFamilyIds={splitIds}
                stage={stage}
                onSave={(draft) => setForm((f) => upsertExpense(f, draft))}
                onDelete={(id) => setForm((f) => removeExpense(f, id))}
                onClosed={() => setExpenseOpen(null)}
              />
            )
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
            onOpenExpense={(id) => setExpenseOpen({ id })}
          />
        )}
        <Group danger>
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
          message={
            del.failed
              ? "Couldn't delete this session. Nothing was changed. Try again."
              : sessionDeleteMessage({
                  expenses: initial.expenses.length,
                  photos: initial.expenses.reduce((n, e) => n + e.photoIds.length, 0),
                })
          }
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
