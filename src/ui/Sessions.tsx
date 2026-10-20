import { useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { expenseTotalsBySession } from '../data/expenses';
import { listSessionsInRange, loadNameMaps } from '../data/sessions';
import { containsDate, formatDayHeader, formatTime12, periodRange, rangeLabel, shiftPeriod, todayLocal, type PeriodKind } from '../domain/dates';
import { groupSessionsByDate, sessionRowText } from '../domain/session';
import type { Session } from '../domain/types';
import { AmountLine, ChevronIcon, Group, SegmentedControl, Skeleton, SubjectTag } from './components';
import { PersonalTotals } from './PersonalTotals';

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
    async () => {
      const sessions = await listSessionsInRange(range.start, range.end);
      return { sessions, names: await loadNameMaps(), expenseTotals: await expenseTotalsBySession(sessions.map((s) => s.id)) };
    },
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
      {!data && <Skeleton />}
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
            <>
            <PersonalTotals key={`${range.start}-${range.end}`} range={range} />
            {groupSessionsByDate(data.sessions).map((day) => (
              <Group key={day.date} header={formatDayHeader(day.date)}>
                {day.sessions.map((s) => {
                  const text = sessionRowText(s, data.names.students, data.expenseTotals[s.id]);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      class="row session-row"
                      aria-label={[text.names, text.meta, text.lesson, text.activity, text.expenses].filter(Boolean).join(', ')}
                      onClick={() => props.onEdit?.(s)}
                    >
                      <span class="session-names">
                        <span class="row-label clamp2">{text.names}</span>
                        <span class="session-meta">
                          <SubjectTag subject={s.subject} />
                          {s.startTime && <span class="figure">{formatTime12(s.startTime)}</span>}
                        </span>
                      </span>
                      <span class="session-amounts">
                        <AmountLine text={text.lesson} />
                        <AmountLine text={text.activity} secondary />
                        {text.expenses && <AmountLine text={text.expenses} secondary />}
                      </span>
                    </button>
                  );
                })}
              </Group>
            ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
