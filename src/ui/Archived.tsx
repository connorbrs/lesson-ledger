import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { deleteFamily, getFamily, hasFamilyHistory, listArchivedFamilies, restoreFamily } from '../data/families';
import { useLive } from '../data/live';
import { deleteStudent, listArchivedStudents, restoreStudent, studentHasHistory } from '../data/students';
import { Alert, Group, Row } from './components';

export interface ArchivedDeleteTarget {
  kind: 'family' | 'student';
  id: string;
  name: string;
}

/** Confirm alert for a hard delete. Mounted by the screen (a sibling of the pushed layer), never inside the list. */
export function ArchivedDeleteAlert(props: { target: ArchivedDeleteTarget; onClose: () => void }) {
  const { target, onClose } = props;
  const [state, setState] = useState({ busy: false, failed: false });
  const busy = useRef(false);

  async function confirmDelete() {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, failed: false });
    try {
      const result = target.kind === 'student' ? await deleteStudent(target.id) : await deleteFamily(target.id);
      if (result.ok) {
        onClose();
        return;
      }
    } catch {
      // fall through to the failure state
    }
    busy.current = false;
    setState({ busy: false, failed: true });
  }

  return (
    <Alert
      title={`Delete “${target.name}”?`}
      message={state.failed ? `Couldn't delete “${target.name}”. Nothing was changed.` : "This can't be undone."}
      buttons={[
        { label: 'Cancel', tone: 'accent', onClick: onClose },
        {
          label: target.kind === 'student' ? 'Delete Student' : 'Delete Family',
          tone: 'destructive',
          strong: true,
          disabled: state.busy,
          onClick: () => void confirmDelete(),
        },
      ]}
    />
  );
}

export function Archived(props: { onEmpty: () => void; onDelete: (target: ArchivedDeleteTarget) => void }) {
  const [failed, setFailed] = useState(false);
  const restore = (action: Promise<unknown>) => {
    setFailed(false);
    action.catch(() => setFailed(true));
  };
  const data = useLive(async () => ({
    families: await Promise.all(
      (await listArchivedFamilies()).map(async (family) => ({ family, hasStudents: await hasFamilyHistory(family.id) })),
    ),
    students: await Promise.all(
      (await listArchivedStudents()).map(async (student) => ({
        student,
        family: await getFamily(student.familyId),
        hasHistory: await studentHasHistory(student.id),
      })),
    ),
  }));

  // When the last archived record is restored, pop back to People.
  useEffect(() => {
    if (data && data.families.length === 0 && data.students.length === 0) props.onEmpty();
  }, [data]);

  return (
    <>
      {failed && (
        <p class="sheet-error" role="alert">
          Couldn't restore. Nothing was changed. Try again.
        </p>
      )}
      {data && data.families.length > 0 && (
        <Group header="Families">
          {data.families.map(({ family: f, hasStudents }) => (
            <Fragment key={f.id}>
              <div class="row">
                <span class="row-label clamp2">{f.name}</span>
                <button type="button" class="text-button" onClick={() => restore(restoreFamily(f.id))}>
                  Restore Family
                </button>
              </div>
              {!hasStudents ? (
                <Row tone="destructive" onClick={() => props.onDelete({ kind: 'family', id: f.id, name: f.name })}>
                  Delete Family
                </Row>
              ) : (
                <div class="row">
                  <span class="row-label row-sub">
                    {data.students.some(({ student }) => student.familyId === f.id)
                      ? 'This family still has students. Delete its archived students first.'
                      : 'This family still has active students. Restore it to manage them.'}
                  </span>
                </div>
              )}
            </Fragment>
          ))}
        </Group>
      )}
      {data && data.students.length > 0 && (
        <Group header="Students">
          {data.students.map(({ student: s, family, hasHistory }) => {
            // A student can only be restored under an active family (restoreStudent enforces it).
            const familyArchived = !family || family.archivedAt !== null;
            return (
              <Fragment key={s.id}>
                <div class="row">
                  <span class="row-label clamp2">
                    {s.name}
                    <span class="row-sub">
                      {family?.name}
                      {familyArchived && ' · Restore the family first'}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="text-button"
                    disabled={familyArchived}
                    onClick={() => restore(restoreStudent(s.id))}
                  >
                    Restore Student
                  </button>
                </div>
                {!hasHistory && (
                  <Row tone="destructive" onClick={() => props.onDelete({ kind: 'student', id: s.id, name: s.name })}>
                    Delete Student
                  </Row>
                )}
              </Fragment>
            );
          })}
        </Group>
      )}
    </>
  );
}
