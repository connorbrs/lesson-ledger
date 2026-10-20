import { useEffect, useState } from 'preact/hooks';
import { getInstructorName } from '../data/instructor';
import { useLive } from '../data/live';
import { loadFamilyView } from '../data/summary';
import { rangeLabel, todayLocal } from '../domain/dates';
import { recordId } from '../domain/periodRecord';
import { canGoNext, isDefaultPeriod, periodKey, periodReturnLabel, renderMessageTr, screenParts, shiftSummaryPeriod, warningText } from '../domain/summary';
import { DISCARD_TITLE, messageView, REBUILD_MESSAGE, REBUILD_TITLE, type MessageDraft } from '../domain/summaryState';
import { MessageGroup } from './MessageGroup';
import { SentGroup } from './SentGroup';
import { ShareFooter } from './ShareFooter';
import { Alert, ChevronIcon, Group, NavBar, PushLayer, Screen, useAnimatedClose, WarningIcon } from './components';

/**
 * A family's summary for one period. Unsaved message text is held by the app (drafts, keyed by record id) so it survives
 * moving between periods and switching tabs. Share PDF pre-builds the PDF in a lazy chunk (D-18).
 */
export function FamilySummaryScreen(props: {
  familyId: string;
  drafts: ReadonlyMap<string, MessageDraft>;
  onDraftChange: (id: string, draft: MessageDraft | null) => void;
  onClosed: () => void;
}) {
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  // The period's start date; null means the family's default (most recent complete) period.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const today = todayLocal();
  const view = useLive(() => loadFamilyView(props.familyId, anchor, today), [props.familyId, anchor, today]);
  // undefined while loading: the PDF waits for the name so the header is never built twice.
  const instructorName = useLive(getInstructorName);

  // The family was deleted or is gone: leave the screen.
  useEffect(() => {
    if (view === null) close();
  }, [view]);

  if (!view) return null;
  const { summary, defaultPeriod, record } = view;
  const { period } = summary;
  const parts = screenParts(summary);
  const label = rangeLabel(period, period.kind, today);
  const id = recordId(summary.familyId, periodKey(period));
  const draft = props.drafts.get(id) ?? null;
  const generated = renderMessageTr(summary);
  const mv = messageView({ generated, record, fingerprint: summary.fingerprint, draft });
  // Back asks first only when a visible message box holds unsaved edits.
  const back = () => (parts.showMessage && mv.dirty ? setDiscardOpen(true) : close());
  const step = (delta: number) => {
    const next = shiftSummaryPeriod(period, delta);
    setAnchor(isDefaultPeriod(next, defaultPeriod) ? null : next.start);
  };

  // The alerts are siblings of the pushed layer so it becomes inert behind them (as in ArchivedScreen).
  return (
    <>
      <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
        <Screen nav={<NavBar title={summary.familyName} back={{ label: 'Summaries', onClick: back }} />}>
          <div class="period-controls">
            <div class="period-nav">
              <button type="button" class="period-step prev" aria-label="Previous period" onClick={() => step(-1)}>
                <ChevronIcon />
              </button>
              <h2 class="heading period-label">{label}</h2>
              <button type="button" class="period-step" aria-label="Next period" disabled={!canGoNext(period, defaultPeriod)} onClick={() => step(1)}>
                <ChevronIcon />
              </button>
            </div>
            {!isDefaultPeriod(period, defaultPeriod) && (
              <button type="button" class="text-button period-return" onClick={() => setAnchor(null)}>
                {periodReturnLabel(period.kind)}
              </button>
            )}
          </div>
          {parts.empty ? (
            <div class="empty">
              <h2 class="heading">No sessions in {label}</h2>
              <p>Nothing to send for {summary.familyName} in this period.</p>
            </div>
          ) : (
            <>
              {parts.showSent && <SentGroup summary={summary} record={record} />}
              {parts.showWarnings && (
                <Group header="Check before sending" footer="Warnings never block Copy or Share.">
                  {summary.warnings.map((w) => (
                    <div key={`${w.kind}-${w.id}`} class="row warning-row">
                      <WarningIcon />
                      <span class="row-label">{warningText(w)}</span>
                    </div>
                  ))}
                </Group>
              )}
              {parts.showMessage && (
                <MessageGroup summary={summary} record={record} draft={draft} onDraftChange={props.onDraftChange} onRebuildRequest={() => setRebuildOpen(true)} />
              )}
            </>
          )}
          {parts.showShare && <ShareFooter summary={summary} instructorName={instructorName} />}
        </Screen>
      </PushLayer>
      {rebuildOpen && (
        <Alert
          title={REBUILD_TITLE}
          message={REBUILD_MESSAGE}
          buttons={[
            { label: 'Cancel', tone: 'accent', onClick: () => setRebuildOpen(false) },
            {
              label: 'Rebuild Message',
              tone: 'destructive',
              strong: true,
              onClick: () => {
                setRebuildOpen(false);
                props.onDraftChange(id, { text: generated, rebuilt: true });
              },
            },
          ]}
        />
      )}
      {discardOpen && (
        <Alert
          title={DISCARD_TITLE}
          buttons={[
            { label: 'Keep Editing', tone: 'accent', onClick: () => setDiscardOpen(false) },
            {
              label: 'Discard Changes',
              tone: 'destructive',
              strong: true,
              onClick: () => {
                setDiscardOpen(false);
                props.onDraftChange(id, null);
                close();
              },
            },
          ]}
        />
      )}
    </>
  );
}
