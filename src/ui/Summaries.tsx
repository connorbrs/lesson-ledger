import { useLive } from '../data/live';
import { loadSummaryList } from '../data/summary';
import { todayLocal } from '../domain/dates';
import { summaryRowSecondLine } from '../domain/summary';
import { sendChecklist, sentStatus, summaryRowStatus } from '../domain/summaryState';
import { ChevronIcon, Group, Skeleton } from './components';
import { MiniChecklist } from './SendChecklist';

/** One row per active family at its most recent complete period (SUM-01). Reads local data only. */
export function Summaries(props: { onOpen: (familyId: string) => void }) {
  const today = todayLocal();
  const rows = useLive(() => loadSummaryList(today), [today]);

  return (
    <>
      <h1 class="large-title">Summaries</h1>
      {!rows && <Skeleton />}
      {rows &&
        (rows.length === 0 ? (
          <div class="empty">
            <h2 class="heading">No active families</h2>
            <p>Add a family on the People tab to see its summary here.</p>
          </div>
        ) : (
          <Group footer="Each family's most recent complete week or month. Families with no sessions are listed but have nothing to send.">
            {rows.map((r) => {
              const { pill, warnings } = summaryRowStatus({
                hasSessions: r.summary.sessions.length > 0,
                status: sentStatus(r.record, r.summary.fingerprint),
                warningCount: r.summary.warnings.length,
              });
              const stages = sendChecklist({ warningCount: r.summary.warnings.length, record: r.record, fingerprint: r.summary.fingerprint });
              return (
                <button key={r.familyId} type="button" class="row summary-row" onClick={() => props.onOpen(r.familyId)}>
                  <span class="session-names">
                    <span class="row-label clamp2">{r.name}</span>
                    <span class="row-sub">{summaryRowSecondLine(r.kind, r.period, r.summary.sessions.length > 0, today)}</span>
                    {(pill || warnings) && (
                      <span class="summary-status-text">
                        {warnings && <span class="attention">{warnings}</span>}
                        {warnings && pill && ' · '}
                        {pill && <span class={pill === 'Sent' ? 'done' : pill === 'Changed since sent' ? 'attention' : ''}>{pill}</span>}
                      </span>
                    )}
                  </span>
                  {(pill || warnings) && <MiniChecklist stages={stages} />}
                  <ChevronIcon />
                </button>
              );
            })}
          </Group>
        ))}
    </>
  );
}
