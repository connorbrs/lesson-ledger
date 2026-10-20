import { useState } from 'preact/hooks';
import { loadViewTotals } from '../data/viewTotals';
import { useLive } from '../data/live';
import type { PeriodRange } from '../domain/dates';
import { breakdownFooter, rowLines, showPersonalTotals, TOTALS_FOOTER, viewAmount, type BreakdownKind } from '../domain/viewTotals';
import { Group, Row, SegmentedControl } from './components';

const OPTIONS: { value: BreakdownKind; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'family', label: 'Family' },
  { value: 'subject', label: 'Subject' },
];

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
        <Row value={viewAmount(totals.lesson)}>Lesson</Row>
        <Row value={viewAmount(totals.activity)}>Activity</Row>
        <Row value={viewAmount(totals.travel)}>Travel</Row>
        <button type="button" class="row tone-accent" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span class="row-label">{open ? 'Hide Breakdown' : 'Show Breakdown'}</span>
        </button>
      </Group>
      {open && (
        <>
        <div class="totals-control">
          <SegmentedControl<BreakdownKind> label="Breakdown" options={OPTIONS} value={kind} onChange={setKind} />
        </div>
        <Group footer={breakdownFooter(kind)}>
          {rows.map((r) => {
            const [lesson, activity, travel] = rowLines(r);
            return (
              <div key={r.id} class="row session-row">
                <span class="session-names">
                  <span class="row-label clamp2">{r.name}</span>
                  {r.archived && <span class="row-sub">Archived</span>}
                </span>
                <span class="session-amounts">
                  <span>{lesson}</span>
                  <span class="tone-secondary">{activity}</span>
                  <span class="tone-secondary">{travel}</span>
                </span>
              </div>
            );
          })}
        </Group>
        </>
      )}
    </>
  );
}
