import { createPortal } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import {
  amountCaption,
  canSaveExpense,
  deleteExpenseMessage,
  expenseEditorDirty,
  validateExpenseText,
  type ExpenseDraft,
} from '../domain/expense';
import { centsToInput, parseAmountToCents } from '../domain/money';
import { EXPENSE_DESCRIPTION_MAX } from '../domain/types';
import { Alert, AmountField, Group, InputRow, NavBar, PushLayer, Row, Screen, useAnimatedClose } from './components';

/** Pushed Expense editor. Save stages the draft in the session form; nothing is written here (D-01). */
export function ExpenseEditor(props: {
  initial: ExpenseDraft | null;
  backLabel: string;
  inSheet?: boolean;
  onSave: (draft: ExpenseDraft) => void;
  /** Stages the removal of an existing expense; the Delete Expense group shows only when given. */
  onDelete?: (id: string) => void;
  onClosed: () => void;
}) {
  const { initial } = props;
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  const [amountText, setAmountText] = useState(initial ? centsToInput(initial.amountCents) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [touched, setTouched] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saving = useRef(false);
  const confirming = useRef(false); // a double-tapped alert button runs once
  const canSave = canSaveExpense({ amountText, description });

  function save() {
    if (saving.current || closing || !canSave) return;
    const cents = parseAmountToCents(amountText);
    const text = validateExpenseText(description);
    if (cents === null || cents <= 0 || !text.ok) return;
    saving.current = true;
    props.onSave({
      id: initial?.id ?? crypto.randomUUID(),
      description: text.value,
      amountCents: cents,
      // An unchanged amount keeps its split; a changed amount resets to the equal default.
      splits: initial && initial.amountCents === cents ? initial.splits : null,
      photoIds: initial?.photoIds ?? [],
      createdAt: initial?.createdAt ?? Date.now(),
    });
    close();
  }

  function back() {
    if (closing) return;
    if (expenseEditorDirty(initial, amountText, description)) setDiscardOpen(true);
    else close();
  }

  function discard() {
    if (confirming.current) return;
    confirming.current = true;
    setDiscardOpen(false);
    close();
  }

  function confirmDelete() {
    if (confirming.current || !initial) return;
    confirming.current = true;
    setDeleteOpen(false);
    props.onDelete?.(initial.id);
    close();
  }

  // The alerts are portaled into .app so everything behind them (the pushed layer, the sheet, the tab bar) is inert.
  const alerts = (discardOpen || deleteOpen) && (
    <>
      {discardOpen && (
        <Alert
          title="Discard changes to this session?"
          buttons={[
            { label: 'Keep Editing', tone: 'accent', strong: true, onClick: () => setDiscardOpen(false) },
            { label: 'Discard Changes', tone: 'destructive', strong: true, onClick: discard },
          ]}
        />
      )}
      {deleteOpen && initial && (
        <Alert
          title="Delete this expense?"
          message={deleteExpenseMessage(initial.photoIds.length)}
          buttons={[
            { label: 'Cancel', tone: 'accent', onClick: () => setDeleteOpen(false) },
            { label: 'Delete Expense', tone: 'destructive', strong: true, onClick: confirmDelete },
          ]}
        />
      )}
    </>
  );

  return (
    <>
      <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
        <Screen
          inSheet={props.inSheet}
          nav={
            <NavBar
              inSheet={props.inSheet}
              title={initial ? 'Expense' : 'New Expense'}
              back={{ label: props.backLabel, onClick: back }}
              right={
                <button type="button" class="text-button strong" disabled={!canSave} onClick={save}>
                  Save
                </button>
              }
            />
          }
        >
          {props.inSheet && <div class="sheet-body-top" />}
          <Group>
            <AmountField
              label="Amount"
              value={amountText}
              hint="0.00"
              caption={amountCaption(amountText, touched)}
              invalid={amountCaption(amountText, touched) !== null}
              autoFocus={!initial}
              onInput={setAmountText}
              onBlur={() => setTouched(true)}
            />
            <InputRow
              label="Description"
              value={description}
              placeholder="e.g. Pool entry fee"
              maxLength={EXPENSE_DESCRIPTION_MAX}
              autoCapitalize="sentences"
              wideLabel
              onInput={setDescription}
            />
          </Group>
          {initial && props.onDelete && (
            <Group>
              <Row tone="destructive" onClick={() => setDeleteOpen(true)}>
                Delete Expense
              </Row>
            </Group>
          )}
        </Screen>
      </PushLayer>
      {alerts && createPortal(alerts, document.querySelector('.app') ?? document.body)}
    </>
  );
}
