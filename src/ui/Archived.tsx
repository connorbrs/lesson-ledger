import { useEffect, useState } from 'preact/hooks';
import { getFamily, listArchivedFamilies, restoreFamily } from '../data/families';
import { useLive } from '../data/live';
import { listArchivedStudents, restoreStudent } from '../data/students';
import { Group } from './components';

export function Archived(props: { onEmpty: () => void }) {
  const [failed, setFailed] = useState(false);
  const restore = (action: Promise<unknown>) => {
    setFailed(false);
    action.catch(() => setFailed(true));
  };
  const data = useLive(async () => ({
    families: await listArchivedFamilies(),
    students: await Promise.all(
      (await listArchivedStudents()).map(async (student) => ({ student, family: await getFamily(student.familyId) })),
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
          {data.families.map((f) => (
            <div class="row" key={f.id}>
              <span class="row-label clamp2">{f.name}</span>
              <button type="button" class="text-button" onClick={() => restore(restoreFamily(f.id))}>
                Restore Family
              </button>
            </div>
          ))}
        </Group>
      )}
      {data && data.students.length > 0 && (
        <Group header="Students">
          {data.students.map(({ student: s, family }) => {
            // A student can only be restored under an active family (restoreStudent enforces it).
            const familyArchived = !family || family.archivedAt !== null;
            return (
              <div class="row" key={s.id}>
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
            );
          })}
        </Group>
      )}
    </>
  );
}
