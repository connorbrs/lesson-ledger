import { useEffect, useRef, useState } from 'preact/hooks';
import { shareFile } from '../pwa/share';
import type { FamilySummary } from '../domain/summary';
import { footerCaption, type ShareOutcome, shareAction, shareButtonState } from '../domain/summaryState';
import { useSummaryPdf } from './useSummaryPdf';

/**
 * Sticky Share PDF bar. The PDF is pre-built (useSummaryPdf), so the tap hands the finished file to the share sheet with
 * no asynchronous step first: Safari ties the share sheet to the tap. This file chains promises and never suspends before the share call.
 */
export function ShareFooter(props: { summary: FamilySummary; instructorName: string | null | undefined }) {
  const { status, retry } = useSummaryPdf(props.summary, props.instructorName, true);
  const [shared, setShared] = useState<{ fileName: string; outcome: ShareOutcome } | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const footer = useRef<HTMLDivElement>(null);
  const sharing = useRef(false); // a second tap cannot start a second share while one is open

  // Keep the last content reachable above the sticky footer.
  useEffect(() => {
    const el = footer.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFooterHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
        {caption && (
          <p class={caption.tone === 'destructive' ? 'sheet-error' : 'footer-secondary'} role={caption.tone === 'destructive' ? 'alert' : undefined}>
            {caption.text}
          </p>
        )}
        <button type="button" class="primary-button" disabled={button.disabled} onClick={onTap}>
          {button.label}
        </button>
        <span class="visually-hidden" role="status">
          {status.kind === 'preparing' ? 'Preparing PDF' : ''}
        </span>
      </div>
    </>
  );
}
