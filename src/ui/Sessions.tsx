import { useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { listSessionsInRange, loadNameMaps } from '../data/sessions';
import { containsDate, formatDayHeader, periodRange, rangeLabel, shiftPeriod, todayLocal, type PeriodKind } from '../domain/dates';
import { groupSessionsByDate, sessionRowText } from '../domain/session';
import type { Session } from '../domain/types';
import { ChevronIcon, Group, SegmentedControl } from './components';

const KIND_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** Sessions by Monday-to-Sunday week or calendar month (D-07), as compact rows grouped by date (D-08). */
export function Sessions(props: { onLogSession: () => void; onEdit?: (session: Session) => void }) {
  const [kind, setKind] = useState<PeriodKind>('week');
  // The anchor is any date inside the shown period; switching Week and Month keeps the period that contains it.
  const [anchor, setAnchor] = useState(() => todayLocal());
  const today = todayLocal();
  const range = periodRange(kind, anchor);
  const data = useLive(
    async () => ({ sessions: await listSessionsInRange(range.start, range.end), names: await loadNameMaps() }),
    [range.start, range.end],
  );
  const unit = kind === 'week' ? 'week' : 'month';

  return (
    <>
      <h1 class="large-title">Sessions</h1>
      <div class="period-controls">
        <SegmentedControl<PeriodKind> label="Period" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <div class="period-nav">
          <button type="button" class="period-step prev" aria-label={`Previous ${unit}`} onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))}>
            <ChevronIcon />
          </button>
          <h2 class="heading period-label">{rangeLabel(range, kind, today)}</h2>
          <button type="button" class="period-step" aria-label={`Next ${unit}`} onClick={() => setAnchor(shiftPeriod(kind, anchor, 1))}>
            <ChevronIcon />
          </button>
        </div>
        {!containsDate(range, today) && (
          <button type="button" class="text-button period-return" onClick={() => setAnchor(today)}>
            {kind === 'week' ? 'This Week' : 'This Month'}
          </button>
        )}
      </div>
      {data && (
        <div key={`${kind}-${range.start}`} class="period-fade">
          {data.sessions.length === 0 ? (
            <div class="empty">
              <h2 class="heading">{kind === 'week' ? 'No sessions this week' : 'No sessions this month'}</h2>
              <p>Sessions you log for this period appear here.</p>
              <button type="button" class="primary-button" onClick={props.onLogSession}>
                Log a Session
              </button>
            </div>
          ) : (
            groupSessionsByDate(data.sessions).map((day) => (
              <Group key={day.date} header={formatDayHeader(day.date)}>
                {day.sessions.map((s) => {
                  const text = sessionRowText(s, data.names.students);
                  return (
                    <button key={s.id} type="button" class="row session-row" onClick={() => props.onEdit?.(s)}>
                      <span class="session-names">
                        <span class="row-label clamp2">{text.names}</span>
                        <span class="row-sub">{text.meta}</span>
                      </span>
                      <span class="session-amounts">
                        <span>{text.lesson}</span>
                        <span class="tone-secondary">{text.activity}</span>
                      </span>
                    </button>
                  );
                })}
              </Group>
            ))
          )}
        </div>
      )}
    </>
  );
}
