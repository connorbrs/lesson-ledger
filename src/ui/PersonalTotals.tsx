import { useState } from 'preact/hooks';
import { loadViewTotals } from '../data/viewTotals';
import { useLive } from '../data/live';
import type { PeriodRange } from '../domain/dates';
import { breakdownFooter, rowLines, showPersonalTotals, TOTALS_FOOTER, viewAmount, type BreakdownKind } from '../domain/viewTotals';
import { AmountLine, ChevronIcon, Group, SegmentedControl, SubjectTag } from './components';

const OPTIONS: { value: BreakdownKind; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'family', label: 'Family' },
  { value: 'subject', label: 'Subject' },
];

/** One cell of the totals strip: the hours large, the h:mm form beneath so the cell holds at 320px. */
function TotalCell(props: { label: string; minutes: number }) {
  const text = viewAmount(props.minutes);
  const split = /^(.+?) (\(.+\))$/.exec(text);
  return (
    <div class="metric">
      <span class="metric-label">{props.label}</span>
      <span class="metric-value figure">{split ? split[1] : text}</span>
      {split && <span class="metric-sub figure">{split[2]}</span>}
    </div>
  );
}

/** The instructor's own totals for the period the Sessions tab shows, with a Student, Family or Subject breakdown. */
export function PersonalTotals(props: { range: PeriodRange }) {
  const [kind, setKind] = useState<BreakdownKind>('student');
  const [open, setOpen] = useState(false);
  const data = useLive(() => loadViewTotals(props.range.start, props.range.end), [props.range.start, props.range.end]);
  if (!data || !showPersonalTotals(data.sessionCount)) return null;

  const { totals } = data;
  const rows = kind === 'student' ? totals.students : kind === 'family' ? totals.families : totals.subjects;
  return (
    <>
      <Group header="Totals" footer={TOTALS_FOOTER}>
        <div class="metric-strip">
          <TotalCell label="Lesson" minutes={totals.lesson} />
          <TotalCell label="Activity" minutes={totals.activity} />
          <TotalCell label="Travel" minutes={totals.travel} />
        </div>
        <button type="button" class="disclosure" aria-expanded={open} aria-controls="totals-breakdown" onClick={() => setOpen(!open)}>
          <span>{open ? 'Hide Breakdown' : 'Show Breakdown'}</span>
          <ChevronIcon />
        </button>
      </Group>
      <div id="totals-breakdown" class={`expand${open ? ' open' : ''}`}>
        <div class="expand-inner">
          <div class="totals-control">
            <SegmentedControl<BreakdownKind> label="Breakdown" options={OPTIONS} value={kind} onChange={setKind} />
          </div>
          <Group footer={breakdownFooter(kind)}>
            {rows.map((r) => {
              const [lesson, activity, travel] = rowLines(r);
              return (
                <div key={r.id} class="row session-row">
                  <span class="session-names">
                    {kind === 'subject' && (r.id === 'swim' || r.id === 'math') ? <SubjectTag subject={r.id} /> : <span class="row-label clamp2">{r.name}</span>}
                    {r.archived && <span class="row-sub">Archived</span>}
                  </span>
                  <span class="session-amounts">
                    <AmountLine text={lesson} />
                    <AmountLine text={activity} secondary />
                    <AmountLine text={travel} secondary />
                  </span>
                </div>
              );
            })}
          </Group>
        </div>
      </div>
    </>
  );
}
