import { listActiveFamilies } from '../data/families';
import { useLive } from '../data/live';
import { listActiveStudents } from '../data/students';
import { togglePick } from '../domain/sessionForm';
import type { Attendee, DefaultSubject, Subject } from '../domain/types';
import { CheckIcon, Group, NavBar, PushLayer, Screen, useAnimatedClose } from './components';

/** Pushed picker for a session's students. Taps apply at once; Back returns to the parent. */
export function StudentPicker(props: {
  attendees: Attendee[];
  subject: Subject;
  onChange: (attendees: Attendee[], tappedDefault: DefaultSubject) => void;
  backLabel: string;
  inSheet?: boolean;
  onClosed: () => void;
}) {
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  const data = useLive(async () => ({ families: await listActiveFamilies(), students: await listActiveStudents() }));

  return (
    <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
      <Screen inSheet={props.inSheet} nav={<NavBar inSheet={props.inSheet} title="Students" back={{ label: props.backLabel, onClick: close }} />}>
        {props.inSheet && <div class="sheet-body-top" />}
        {data && data.students.length === 0 && (
          <div class="empty">
            <h2 class="heading">No active students</h2>
            <p>Add a student on the People tab to log a session for them. Archived students are not listed here.</p>
          </div>
        )}
        {data &&
          data.families.map((family) => {
            const students = data.students.filter((s) => s.familyId === family.id);
            if (students.length === 0) return null;
            return (
              <Group key={family.id} header={family.name}>
                {students.map((s) => {
                  const selected = props.attendees.some((a) => a.studentId === s.id);
                  const blocked = !selected && props.subject === 'swim' && props.attendees.length >= 2;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      class={`row${blocked ? ' tone-secondary' : ''}`}
                      aria-pressed={selected}
                      onClick={() => props.onChange(togglePick(props.subject, props.attendees, { studentId: s.id, familyId: s.familyId }), s.defaultSubject)}
                    >
                      <span class="picker-row-name clamp2">{s.name}</span>
                      {selected && (
                        <span class="picker-row-check">
                          <CheckIcon />
                        </span>
                      )}
                    </button>
                  );
                })}
              </Group>
            );
          })}
        {data && data.students.length > 0 && (
          <div class="group-footer">
            {props.subject === 'swim' ? 'Swim takes up to two students.' : 'Math takes one student. Choosing another replaces this one.'}
          </div>
        )}
      </Screen>
    </PushLayer>
  );
}
