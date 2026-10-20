import { useRef, useState } from 'preact/hooks';
import { markSent, unmarkSent } from '../data/periodRecords';
import { periodKey, type FamilySummary } from '../domain/summary';
import { sentAction, sentFooterText, sentStatus, statusValueText } from '../domain/summaryState';
import type { PeriodRecord } from '../domain/types';
import { Group, Row } from './components';

/**
 * The Status row, the mark action and its footer (D-14). This is the only screen code that marks a period sent:
 * Copy and Share never do. The record comes from the live query, so the status keeps no copy of it.
 */
export function SentGroup(props: { summary: FamilySummary; record: PeriodRecord | undefined }) {
  const { summary, record } = props;
  const status = sentStatus(record, summary.fingerprint);
  const action = sentAction(status);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const run = async () => {
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

  return (
    <Group footer={sentFooterText(failed)} footerError={failed}>
      <div class="row">
        <span class="row-label clamp2">Status</span>
        <span class={`row-value clamp2${status === 'changed' ? ' primary' : ''}`}>{statusValueText(status, record?.sentAt ?? null)}</span>
      </div>
      <Row tone={action.tone === 'accent' ? 'accent' : undefined} onClick={run}>
        {action.label}
      </Row>
    </Group>
  );
}
