import { useEffect, useRef, useState } from 'preact/hooks';
import { saveMessage } from '../data/periodRecords';
import { MESSAGE_MAX, recordId } from '../domain/periodRecord';
import { periodKey, renderMessageTr, type FamilySummary } from '../domain/summary';
import { draftBasis, messageView, MESSAGE_FOOTER, SAVE_FAILED, STALE_BANNER, type MessageDraft } from '../domain/summaryState';
import type { PeriodRecord } from '../domain/types';
import { CheckIcon, Group } from './components';

const FLASH_MS = 1500;

/** The editable Turkish message. Unsaved text lives in the app's drafts; the stored message changes only through Save Message. */
export function MessageGroup(props: {
  summary: FamilySummary;
  record: PeriodRecord | undefined;
  instructorName: string | null | undefined;
  draft: MessageDraft | null;
  onDraftChange: (id: string, draft: MessageDraft | null) => void;
  onRebuildRequest: () => void;
}) {
  const { summary, record, draft, onDraftChange } = props;
  const id = recordId(summary.familyId, periodKey(summary.period));
  const view = messageView({ generated: renderMessageTr(summary, props.instructorName), record, fingerprint: summary.fingerprint, draft });

  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(false);
  const timers = useRef<number[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);

  // The box grows with its text so it never scrolls inside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [view.text]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const flash = (set: (v: boolean) => void) => {
    set(true);
    timers.current.push(window.setTimeout(() => set(false), FLASH_MS));
  };

  const save = async () => {
    if (saving.current || !view.canSave || !draft) return;
    saving.current = true;
    setSaveFailed(false);
    try {
      await saveMessage(summary.familyId, periodKey(summary.period), view.text, draft.basedOn);
      onDraftChange(id, null);
      flash(setSaved);
    } catch {
      setSaveFailed(true);
    } finally {
      saving.current = false;
    }
  };

  return (
    <Group header="Message" footer={MESSAGE_FOOTER}>
      {view.stale && (
        <div class="row banner-row">
          <span class="row-label">{STALE_BANNER}</span>
          <button type="button" class="text-button" onClick={props.onRebuildRequest}>
            Rebuild Message
          </button>
        </div>
      )}
      <textarea
        ref={ref}
        class="message-box"
        lang="tr"
        autocorrect="off"
        spellcheck={false}
        aria-label="Message to parents"
        maxLength={MESSAGE_MAX}
        value={view.text}
        onInput={(e) => onDraftChange(id, { text: e.currentTarget.value, rebuilt: false, basedOn: draftBasis({ record, fingerprint: summary.fingerprint, draft }) })}
      />
      {saveFailed && <p class="label caption-error">{SAVE_FAILED}</p>}
      <button type="button" class="row save-row" disabled={!view.canSave} onClick={save}>
        <span class="row-label save-label">
          {saved ? (
            <>
              <CheckIcon />
              Saved
            </>
          ) : (
            'Save Message'
          )}
        </span>
      </button>
    </Group>
  );
}
