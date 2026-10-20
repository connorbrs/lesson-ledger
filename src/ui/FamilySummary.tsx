import { useEffect, useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { loadFamilyView } from '../data/summary';
import { rangeLabel, todayLocal } from '../domain/dates';
import { canGoNext, isDefaultPeriod, periodReturnLabel, renderMessageTr, screenParts, shiftSummaryPeriod, warningText } from '../domain/summary';
import { ChevronIcon, Group, NavBar, PushLayer, Screen, useAnimatedClose, WarningIcon } from './components';

/** The read-only Turkish message; grows with its text so the box never scrolls inside. */
function MessageBox(props: { text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [props.text]);
  return (
    <textarea
      ref={ref}
      class="message-box"
      lang="tr"
      autocorrect="off"
      spellcheck={false}
      aria-label="Message to parents"
      readOnly
      value={props.text}
    />
  );
}

/** A family's summary for one period. Plan 04-03 adds the Sent group and editing; plan 04-05 adds Share PDF. */
export function FamilySummaryScreen(props: { familyId: string; onClosed: () => void }) {
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  // The period's start date; null means the family's default (most recent complete) period.
  const [anchor, setAnchor] = useState<string | null>(null);
  const today = todayLocal();
  const view = useLive(() => loadFamilyView(props.familyId, anchor, today), [props.familyId, anchor, today]);

  // The family was deleted or is gone: leave the screen.
  useEffect(() => {
    if (view === null) close();
  }, [view]);

  if (!view) return null;
  const { summary, defaultPeriod } = view;
  const { period } = summary;
  const parts = screenParts(summary);
  const label = rangeLabel(period, period.kind, today);
  const step = (delta: number) => {
    const next = shiftSummaryPeriod(period, delta);
    setAnchor(isDefaultPeriod(next, defaultPeriod) ? null : next.start);
  };

  return (
    <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
      <Screen nav={<NavBar title={summary.familyName} back={{ label: 'Summaries', onClick: close }} />}>
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
              <Group header="Message">
                <MessageBox text={renderMessageTr(summary)} />
              </Group>
            )}
          </>
        )}
      </Screen>
    </PushLayer>
  );
}
