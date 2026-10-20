import { useRef, useState } from 'preact/hooks';
import { markSent, unmarkSent } from '../data/periodRecords';
import { periodKey, type FamilySummary } from '../domain/summary';
import { sentAction, sentFooterText, sentStatus, statusValueText, type SentAction } from '../domain/summaryState';
import type { PeriodRecord } from '../domain/types';
import { Group, Row } from './components';

/**
 * Marking and unmarking, shared by the Status group at the top and the send actions in the footer. This is the only
 * screen code that marks a period sent: Copy and Share never do.
 */
export function useMarkSent() {
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const run = async (summary: FamilySummary, action: SentAction) => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      const key = periodKey(summary.period);
      if (action.kind === 'mark') await markSent(summary.familyId, key, summary.fingerprint);
      else await unmarkSent(summary.familyId, key);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };
  return { failed, run };
}

/**
 * The Status row and its footer (D-14); once sent, also the Mark as Not Sent undo. Marking sent itself is in the footer
 * next to Share and Copy. The record comes from the live query, so the status keeps no copy of it.
 */
export function SentGroup(props: { summary: FamilySummary; record: PeriodRecord | undefined; failed: boolean; onRun: (action: SentAction) => void }) {
  const { summary, record } = props;
  const status = sentStatus(record, summary.fingerprint);
  const action = sentAction(status);

  return (
    <Group footer={sentFooterText(props.failed)} footerError={props.failed}>
      <div class="row">
        <span class="row-label clamp2">Status</span>
        <span class={`row-value clamp2${status === 'changed' ? ' attention' : status === 'sent' ? ' done figure' : ''}`}>{statusValueText(status, record?.sentAt ?? null)}</span>
      </div>
      {action.kind === 'unmark' && <Row onClick={() => props.onRun(action)}>{action.label}</Row>}
    </Group>
  );
}
