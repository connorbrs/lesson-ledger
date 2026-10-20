import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
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
import { photoFailureCaption } from '../domain/photos';
import { applyShareInput, equalShareTexts, initialShareState, splitIsOverridden, type ShareState } from '../domain/split';
import { EXPENSE_DESCRIPTION_MAX } from '../domain/types';
import { prepareReceipts, type PhotoErrorCode } from '../pwa/photos';
import { Alert, AmountField, Group, InputRow, NavBar, PushLayer, Row, Screen, useAnimatedClose } from './components';
import type { PhotoStage } from './receiptPhotos';
import { ReceiptsGroup } from './ReceiptsGroup';
import { ReceiptViewer } from './ReceiptViewer';
import { SplitGroup } from './SplitGroup';

/** Pushed Expense editor. Save stages the draft in the session form; nothing is written here (D-01). */
export function ExpenseEditor(props: {
  initial: ExpenseDraft | null;
  backLabel: string;
  inSheet?: boolean;
  /** The session's two families (pick order) when a two-family swim expense can be split; else null. */
  splitFamilyIds: [string, string] | null;
  /** Photos staged in memory until the session saves; shared with the caller (the Log tab or Edit Session). */
  stage: PhotoStage;
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
  // Receipts: the draft holds only photo ids; the bytes live in props.stage until the session saves.
  const [photoIds, setPhotoIds] = useState<string[]>(() => [...(initial?.photoIds ?? [])]);
  const [processing, setProcessing] = useState(0);
  const [caption, setCaption] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null); // index of the open Receipt viewer
  const adding = useRef(false); // one batch at a time
  const stopped = useRef(false); // the editor is leaving: stop before the next file
  const added = useRef(new Set<string>()); // ids staged during this editor session
  const saved = useRef(false);
  const removedEarlier = useRef(new Set<string>()); // removed photos staged before this editor opened; dropped from stage on Save
  const saving = useRef(false);
  const confirming = useRef(false); // a double-tapped alert button runs once
  const amountCents = parseAmountToCents(amountText);
  const splits = props.splitFamilyIds ? (share?.splits ?? null) : null;
  const canSave = canSaveExpense({ amountText, description, processing, shareError: share?.error != null });

  // Leaving without saving drops the photos this editor session staged; the in-flight batch stops before its next file.
  useEffect(
    () => () => {
      stopped.current = true;
      if (!saved.current) for (const id of added.current) props.stage.delete(id);
    },
    [],
  );

  async function addFiles(files: File[]) {
    if (adding.current || stopped.current) return;
    adding.current = true;
    const failures = { tooLarge: 0, unreadable: 0 };
    const fail = (code: PhotoErrorCode) => {
      if (code === 'too-large') failures.tooLarge += 1;
      else failures.unreadable += 1;
      setProcessing((n) => n - 1);
    };
    let createdAt = Date.now();
    setProcessing(files.length);
    await prepareReceipts(files, {
      isCancelled: () => stopped.current,
      onPhoto: (photo) => {
        const id = crypto.randomUUID();
        props.stage.set(id, { blob: photo.blob, width: photo.width, height: photo.height, createdAt: createdAt++ });
        added.current.add(id);
        setPhotoIds((ids) => [...ids, id]);
        setProcessing((n) => n - 1);
      },
      onFailure: fail,
    });
    adding.current = false;
    if (stopped.current) return;
    setProcessing(0);
    setCaption(photoFailureCaption(failures));
  }

  function save() {
    if (saving.current || closing || !canSave) return;
    const cents = parseAmountToCents(amountText);
    const text = validateExpenseText(description);
    if (cents === null || cents <= 0 || !text.ok) return;
    saving.current = true;
    saved.current = true;
    props.onSave({
      id: initial?.id ?? crypto.randomUUID(),
      description: text.value,
      amountCents: cents,
      splits,
      photoIds,
      createdAt: initial?.createdAt ?? Date.now(),
    });
    for (const id of removedEarlier.current) props.stage.delete(id);
    close();
  }

  /** Stages a photo's removal. The stored row is deleted by the session save, not here. */
  function removePhoto(id: string) {
    setPhotoIds((ids) => ids.filter((p) => p !== id));
    if (added.current.delete(id)) props.stage.delete(id);
    else removedEarlier.current.add(id); // stays in stage so discarding this editor restores it
  }

  function back() {
    if (closing) return;
    if (expenseEditorDirty(initial, amountText, description, props.splitFamilyIds ? splits : undefined, photoIds)) setDiscardOpen(true);
    else {
      stopped.current = true;
      close();
    }
  }

  function discard() {
    if (confirming.current) return;
    confirming.current = true;
    stopped.current = true;
    setDiscardOpen(false);
    close();
  }

  function confirmDelete() {
    if (confirming.current || !initial) return;
    confirming.current = true;
    setDeleteOpen(false);
    // The expense is going away: free every staged photo it held, current or removed in this editor (unstaged ids are ignored).
    for (const id of photoIds) props.stage.delete(id);
    for (const id of removedEarlier.current) props.stage.delete(id);
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
          <ReceiptsGroup
            photoIds={photoIds}
            stage={props.stage}
            processing={processing}
            caption={caption}
            onAddFiles={(files) => void addFiles(files)}
            onOpen={setViewer}
          />
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
            <Group danger>
              <Row tone="destructive" onClick={() => setDeleteOpen(true)}>
                Delete Expense
              </Row>
            </Group>
          )}
        </Screen>
      </PushLayer>
      {viewer !== null && (
        <ReceiptViewer photoIds={photoIds} index={viewer} stage={props.stage} inSheet={props.inSheet} onRemove={removePhoto} onClosed={() => setViewer(null)} />
      )}
      {alerts && createPortal(alerts, document.querySelector('.app') ?? document.body)}
    </>
  );
}
