import { useEffect, useRef, useState } from 'preact/hooks';
import { copyText } from '../pwa/clipboard';
import { shareFile } from '../pwa/share';
import type { FamilySummary } from '../domain/summary';
import { COPY_FAILED, footerCaption, type SentAction, type ShareOutcome, shareAction, shareButtonState } from '../domain/summaryState';
import { CheckIcon } from './components';
import { useSummaryPdf } from './useSummaryPdf';

const FLASH_MS = 1500;

/**
 * Sticky send bar: Share PDF, then Copy Message and Mark as Sent (the actions that end a send, together at the bottom).
 * The PDF The PDF is pre-built (useSummaryPdf), so the tap hands the finished file to the share sheet with
 * no asynchronous step first: Safari ties the share sheet to the tap. This file chains promises and never suspends before the share call.
 */
export function ShareFooter(props: {
  summary: FamilySummary;
  instructorName: string | null | undefined;
  messageText: string;
  /** Mark as Sent or Mark as Sent Again; null once sent (Mark as Not Sent sits in the Status group). */
  markAction: SentAction | null;
  onMark: () => void;
}) {
  const { status, retry } = useSummaryPdf(props.summary, props.instructorName, true);
  const [shared, setShared] = useState<{ fileName: string; outcome: ShareOutcome } | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const footer = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const sharing = useRef(false); // a second tap cannot start a second share while one is open

  // Keep the last content reachable above the sticky footer.
  useEffect(() => {
    const el = footer.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFooterHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Copy starts the clipboard write inside the tap, with the text already in hand.
  const copy = () => {
    setCopyFailed(false);
    void copyText(props.messageText).then((ok) => {
      if (!ok) return setCopyFailed(true);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), FLASH_MS);
    });
  };

  const button = shareButtonState(status);
  // A share outcome belongs to the file it was for; a rebuilt PDF for other data starts clean.
  const outcome = status.kind === 'ready' && shared !== null && shared.fileName === status.file.name ? shared.outcome : null;
  const caption = footerCaption({ status, share: outcome, fileName: shared?.fileName ?? '' });

  const onTap = () => {
    const action = shareAction(status);
    if (action === 'build') {
      setShared(null);
      retry();
      return;
    }
    if (action !== 'share' || status.kind !== 'ready' || sharing.current) return;
    const file = status.file;
    sharing.current = true;
    shareFile(file)
      .then((outcome) => setShared({ fileName: file.name, outcome }))
      .catch(() => setShared({ fileName: file.name, outcome: 'failed' }))
      .then(() => {
        sharing.current = false;
      });
    setShared(null);
  };

  return (
    <>
      <div style={{ height: footerHeight }} aria-hidden="true" />
      <div ref={footer} class="summary-footer">
        {copyFailed && (
          <p class="sheet-error" role="alert">
            {COPY_FAILED}
          </p>
        )}
        {caption && (
          <p class={caption.tone === 'destructive' ? 'sheet-error' : 'footer-secondary'} role={caption.tone === 'destructive' ? 'alert' : undefined}>
            {caption.text}
          </p>
        )}
        <button type="button" class="primary-button" disabled={button.disabled} onClick={onTap}>
          {button.label}
        </button>
        <div class="footer-actions">
          <button type="button" class="secondary-button" onClick={copy}>
            {copied ? (
              <>
                <CheckIcon />
                Copied
              </>
            ) : (
              'Copy Message'
            )}
          </button>
          {props.markAction && (
            <button type="button" class="secondary-button" onClick={props.onMark}>
              {props.markAction.label}
            </button>
          )}
        </div>
        <span class="visually-hidden" role="status">
          {copied ? 'Copied' : status.kind === 'preparing' ? 'Preparing PDF' : ''}
        </span>
      </div>
    </>
  );
}
