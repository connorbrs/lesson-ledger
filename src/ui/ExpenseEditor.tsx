import { createPortal } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { loadNameMaps } from '../data/sessions';
import {
  amountCaption,
  canSaveExpense,
  deleteExpenseMessage,
  expenseEditorDirty,
  validateExpenseText,
  type ExpenseDraft,
} from '../domain/expense';
import { centsToInput, parseAmountToCents } from '../domain/money';
import { applyShareInput, equalShareTexts, initialShareState, splitIsOverridden, type ShareState } from '../domain/split';
import { EXPENSE_DESCRIPTION_MAX } from '../domain/types';
import { Alert, AmountField, Group, InputRow, NavBar, PushLayer, Row, Screen, useAnimatedClose } from './components';
import { SplitGroup } from './SplitGroup';

/** Pushed Expense editor. Save stages the draft in the session form; nothing is written here (D-01). */
export function ExpenseEditor(props: {
  initial: ExpenseDraft | null;
  backLabel: string;
  inSheet?: boolean;
  /** The session's two families (pick order) when a two-family swim expense can be split; else null. */
  splitFamilyIds: [string, string] | null;
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
  const names = useLive(loadNameMaps);
  // null is the equal default; otherwise the typed share texts (and the override they make, unless one is invalid).
  const [share, setShare] = useState<ShareState | null>(() =>
    props.splitFamilyIds && initial ? initialShareState(initial.amountCents, props.splitFamilyIds, initial.splits) : null,
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saving = useRef(false);
  const confirming = useRef(false); // a double-tapped alert button runs once
  const amountCents = parseAmountToCents(amountText);
  const splits = props.splitFamilyIds ? (share?.splits ?? null) : null;
  const canSave = canSaveExpense({ amountText, description, shareError: share?.error != null });

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
      splits,
      photoIds: initial?.photoIds ?? [],
      createdAt: initial?.createdAt ?? Date.now(),
    });
    close();
  }

  function back() {
    if (closing) return;
    if (expenseEditorDirty(initial, amountText, description, props.splitFamilyIds ? splits : undefined)) setDiscardOpen(true);
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
              onInput={(text) => {
              setAmountText(text);
              setShare(null); // a changed amount resets the split to equal
            }}
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
          {props.splitFamilyIds && names && (
            <SplitGroup
              familyIds={props.splitFamilyIds}
              familyNames={names.families}
              texts={share?.texts ?? equalShareTexts(amountCents ?? 0)}
              error={share?.error ?? null}
              total={amountCents ?? 0}
              overridden={splitIsOverridden(share)}
              onInput={(index, text) =>
                props.splitFamilyIds &&
                setShare((cur) =>
                  applyShareInput(amountCents ?? 0, props.splitFamilyIds as [string, string], cur?.texts ?? equalShareTexts(amountCents ?? 0), index, text),
                )
              }
              onSplitEqually={() => setShare(null)}
            />
          )}
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
