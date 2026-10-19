import { useEffect } from 'preact/hooks';
import { listArchivedFamilies, restoreFamily } from '../data/families';
import { useLive } from '../data/live';
import { listArchivedStudents, restoreStudent } from '../data/students';
import { Group } from './components';

export function Archived(props: { onEmpty: () => void }) {
  const data = useLive(async () => ({
    families: await listArchivedFamilies(),
    students: await listArchivedStudents(),
  }));

  // When the last archived record is restored, pop back to People.
  useEffect(() => {
    if (data && data.families.length === 0 && data.students.length === 0) props.onEmpty();
  }, [data]);

  return (
    <>
      {data && data.families.length > 0 && (
        <Group header="Families">
          {data.families.map((f) => (
            <div class="row" key={f.id}>
              <span class="row-label clamp2">{f.name}</span>
              <button type="button" class="text-button" onClick={() => void restoreFamily(f.id).catch(() => undefined)}>
                Restore Family
              </button>
            </div>
          ))}
        </Group>
      )}
      {data && data.students.length > 0 && (
        <Group header="Students">
          {data.students.map((s) => (
            <div class="row" key={s.id}>
              <span class="row-label clamp2">{s.name}</span>
              <button type="button" class="text-button" onClick={() => void restoreStudent(s.id).catch(() => undefined)}>
                Restore Student
              </button>
            </div>
          ))}
        </Group>
      )}
    </>
  );
}
