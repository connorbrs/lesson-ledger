import { useEffect, useRef, useState } from 'preact/hooks';
import { loadReceiptPhoto } from '../data/receipts';
import { createSerialRunner } from '../domain/serial';
import { type FamilySummary, pdfFileName, periodKey } from '../domain/summary';
import { type PdfStatus, pdfBuildKey } from '../domain/summaryState';

/** One build at a time across the app, so superseded builds never overlap while holding receipt photos (WR-02). */
const runSerial = createSerialRunner();

/**
 * Pre-builds the family PDF while the summary is open (D-18), so the Share tap can call the share sheet at once.
 * `instructorName` undefined means the name is still loading: nothing is built and the status stays 'preparing'.
 * The result is stored with the key it was built for, so a PDF for older data is never reported as ready for newer data
 * (T-04-20), and a superseded build is stopped before its next receipt is read and its result ignored. Message text is not an input (D-13).
 */
export function useSummaryPdf(summary: FamilySummary, instructorName: string | null | undefined, enabled: boolean): { status: PdfStatus; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; status: PdfStatus } | null>(null);
  const latest = useRef(summary);
  latest.current = summary;

  const key =
    enabled && instructorName !== undefined
      ? pdfBuildKey({ familyId: summary.familyId, periodKey: periodKey(summary.period), fingerprint: summary.fingerprint, instructorName, attempt })
      : null;

  useEffect(() => {
    if (key === null || instructorName === undefined) return;
    let cancelled = false;
    const source = latest.current;
    // The only reference to the PDF module in src/ui: a dynamic import keeps the engine and fonts in their own chunk.
    // Queued behind any build still running; one that was superseded while waiting never starts.
    runSerial(async () => {
      if (cancelled) return null;
      const m = await import('../pdf/summaryPdf');
      return m.buildSummaryPdf(source, instructorName, loadReceiptPhoto, { isCancelled: () => cancelled });
    })
      .then((built) => {
        if (built === null || cancelled) return;
        const file = new File([built.blob], pdfFileName(source.familyName, source.period), { type: 'application/pdf' });
        setResult({ key, status: { kind: 'ready', file } });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key, status: { kind: 'failed', error } });
      });
    return () => {
      cancelled = true;
      setResult(null); // release the Blob of the superseded or closed build
    };
  }, [key]);

  const status: PdfStatus = result !== null && result.key === key ? result.status : { kind: 'preparing' };
  return { status, retry: () => setAttempt((n) => n + 1) };
}
