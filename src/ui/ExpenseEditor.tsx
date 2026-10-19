import { useRef, useState } from 'preact/hooks';
import { amountCaption, canSaveExpense, validateExpenseText, type ExpenseDraft } from '../domain/expense';
import { centsToInput, parseAmountToCents } from '../domain/money';
import { EXPENSE_DESCRIPTION_MAX } from '../domain/types';
import { AmountField, Group, InputRow, NavBar, PushLayer, Screen, useAnimatedClose } from './components';

/** Pushed Expense editor. Save stages the draft in the session form; nothing is written here (D-01). */
export function ExpenseEditor(props: {
  initial: ExpenseDraft | null;
  backLabel: string;
  inSheet?: boolean;
  onSave: (draft: ExpenseDraft) => void;
  onClosed: () => void;
}) {
  const { initial } = props;
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  const [amountText, setAmountText] = useState(initial ? centsToInput(initial.amountCents) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [touched, setTouched] = useState(false);
  const saving = useRef(false);
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

  return (
    <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
      <Screen
        inSheet={props.inSheet}
        nav={
          <NavBar
            inSheet={props.inSheet}
            title={initial ? 'Expense' : 'New Expense'}
            back={{ label: props.backLabel, onClick: close }}
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
      </Screen>
    </PushLayer>
  );
}
