import { useEffect, useRef, useState } from 'preact/hooks';
import { getInstructorName } from '../data/instructor';
import { useLive } from '../data/live';
import { loadFamilyView } from '../data/summary';
import { rangeLabel, todayLocal } from '../domain/dates';
import { recordId } from '../domain/periodRecord';
import { canGoNext, isDefaultPeriod, periodKey, periodReturnLabel, renderMessageTr, screenParts, shiftSummaryPeriod, warningText } from '../domain/summary';
import { DISCARD_TITLE, messageView, REBUILD_MESSAGE, REBUILD_TITLE, sendChecklist, sentAction, sentStatus, type MessageDraft } from '../domain/summaryState';
import { MessageGroup } from './MessageGroup';
import { SendChecklist, StatusGlyph } from './SendChecklist';
import { SentGroup, useMarkSent } from './SentGroup';
import { ShareFooter } from './ShareFooter';
import { Alert, ChevronIcon, Group, NavBar, PushLayer, Screen, Skeleton, useAnimatedClose } from './components';

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
  const live = useLive(() => loadFamilyView(props.familyId, anchor, today), [props.familyId, anchor, today]);
  // useLive resets to undefined while the next period loads. Keep showing the last loaded view meanwhile, so the screen
  // stays mounted (no replayed push animation, no lost Copied/Saved flashes, PDF status or open alerts). null means gone.
  const lastView = useRef(live);
  if (live) lastView.current = live;
  const view = live === null ? null : live ?? lastView.current;
  // undefined while loading: the PDF waits for the name so the header is never built twice.
  const instructorName = useLive(getInstructorName);
  const markSent = useMarkSent();

  // The family was deleted or is gone: leave the screen.
  useEffect(() => {
    if (live === null) close();
  }, [live]);

  if (live === null) return null;
  if (!view) {
    // First load: the pushed screen is already in place, so the push animation plays once and content follows.
    return (
      <>
        <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
          <Screen nav={<NavBar title="Summary" back={{ label: 'Summaries', onClick: close }} />}>
            <Skeleton />
          </Screen>
        </PushLayer>
      </>
    );
  }
  const { summary, defaultPeriod, record } = view;
  const { period } = summary;
  const parts = screenParts(summary);
  const label = rangeLabel(period, period.kind, today);
  const id = recordId(summary.familyId, periodKey(period));
  const draft = props.drafts.get(id) ?? null;
  const generated = renderMessageTr(summary, instructorName);
  const mv = messageView({ generated, record, fingerprint: summary.fingerprint, draft });
  // Back asks first only when a visible message box holds unsaved edits.
  const sentNow = sentAction(sentStatus(record, summary.fingerprint));
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
              <SendChecklist stages={sendChecklist({ warningCount: summary.warnings.length, record, fingerprint: summary.fingerprint, draft })} />
              {parts.showSent && <SentGroup summary={summary} record={record} failed={markSent.failed} onRun={(a) => void markSent.run(summary, a)} />}
              {parts.showWarnings && (
                <Group header="Check before sending" footer="Warnings never block Copy or Share.">
                  {summary.warnings.map((w) => (
                    <div key={`${w.kind}-${w.id}`} class="row warning-row">
                      <StatusGlyph tone="attention" />
                      <span class="row-label">{warningText(w)}</span>
                    </div>
                  ))}
                </Group>
              )}
              {parts.showMessage && (
                <MessageGroup summary={summary} record={record} instructorName={instructorName} draft={draft} onDraftChange={props.onDraftChange} onRebuildRequest={() => setRebuildOpen(true)} />
              )}
            </>
          )}
          {parts.showShare && (
            <ShareFooter
              summary={summary}
              instructorName={instructorName}
              messageText={mv.text}
              markAction={sentNow.kind === 'mark' ? sentNow : null}
              onMark={() => void markSent.run(summary, sentNow)}
            />
          )}
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
                props.onDraftChange(id, { text: generated, rebuilt: true, basedOn: summary.fingerprint });
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
