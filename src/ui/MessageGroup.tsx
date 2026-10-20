import { useEffect, useRef, useState } from 'preact/hooks';
import { saveMessage } from '../data/periodRecords';
import { MESSAGE_MAX, recordId } from '../domain/periodRecord';
import { periodKey, renderMessageTr, type FamilySummary } from '../domain/summary';
import { COPY_FAILED, messageView, MESSAGE_FOOTER, SAVE_FAILED, STALE_BANNER, type MessageDraft } from '../domain/summaryState';
import type { PeriodRecord } from '../domain/types';
import { copyText } from '../pwa/clipboard';
import { Group } from './components';

const FLASH_MS = 1500;

/** The editable Turkish message. Unsaved text lives in the app's drafts; the stored message changes only through Save Message. */
export function MessageGroup(props: {
  summary: FamilySummary;
  record: PeriodRecord | undefined;
  draft: MessageDraft | null;
  onDraftChange: (id: string, draft: MessageDraft | null) => void;
  onRebuildRequest: () => void;
}) {
  const { summary, record, draft, onDraftChange } = props;
  const id = recordId(summary.familyId, periodKey(summary.period));
  const view = messageView({ generated: renderMessageTr(summary), record, fingerprint: summary.fingerprint, draft });

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
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

  // Copy starts the clipboard write inside the tap, with the text already in hand.
  const copy = () => {
    setCopyFailed(false);
    void copyText(view.text).then((ok) => {
      if (ok) flash(setCopied);
      else setCopyFailed(true);
    });
  };

  const save = async () => {
    if (saving.current || !view.canSave) return;
    saving.current = true;
    setSaveFailed(false);
    try {
      await saveMessage(summary.familyId, periodKey(summary.period), view.text, summary.fingerprint);
      onDraftChange(id, null);
      flash(setSaved);
    } catch {
      setSaveFailed(true);
    } finally {
      saving.current = false;
    }
  };

  return (
    <Group header="Message" headerAction={{ label: copied ? 'Copied ✓' : 'Copy Message', onClick: copy }} footer={MESSAGE_FOOTER}>
      <span class="visually-hidden" role="status">
        {copied ? 'Copied' : ''}
      </span>
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
        onInput={(e) => onDraftChange(id, { text: e.currentTarget.value, rebuilt: false })}
      />
      {copyFailed && <p class="label caption-error">{COPY_FAILED}</p>}
      {saveFailed && <p class="label caption-error">{SAVE_FAILED}</p>}
      <button type="button" class="row save-row" disabled={!view.canSave} onClick={save}>
        <span class="row-label">{saved ? 'Saved ✓' : 'Save Message'}</span>
      </button>
    </Group>
  );
}
