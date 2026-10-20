import { listActiveFamilies, listArchivedFamilies } from '../data/families';
import { useLive } from '../data/live';
import { listActiveStudents, listArchivedStudents } from '../data/students';
import { periodLabel, studentCountLabel } from '../domain/roster';
import type { Family, Student } from '../domain/types';
import { Group, Row, Skeleton } from './components';

export function People(props: {
  onAddFamily: () => void;
  onEditFamily: (family: Family) => void;
  onAddStudent: (familyId: string) => void;
  onEditStudent: (student: Student) => void;
  onOpenArchived: () => void;
}) {
  const data = useLive(async () => ({
    families: await listActiveFamilies(),
    students: await listActiveStudents(),
    archivedCount: (await listArchivedFamilies()).length + (await listArchivedStudents()).length,
  }));

  return (
    <>
      <h1 class="large-title">People</h1>
      {/* Until the first query resolves, a quiet skeleton panel stands in. */}
      {!data && <Skeleton />}
      {data && data.families.length === 0 && (
        <div class="empty">
          <h2 class="heading">No families yet</h2>
          <p>Add a family, then add the students in it. Tap Add Family to start.</p>
          <button type="button" class="primary-button" onClick={props.onAddFamily}>
            Add Family
          </button>
        </div>
      )}
      {data &&
        data.families.map((family) => {
          const students = data.students.filter((s) => s.familyId === family.id);
          return (
            <Group
              key={family.id}
              header={family.name}
              nameHeader
              headerAction={{ label: 'Edit Family', onClick: () => props.onEditFamily(family) }}
              footer={
                <>
                  <span class="footer-line">{periodLabel(family.period)}</span>
                  {students.length > 0 && <span class="footer-line">{studentCountLabel(students.length)}</span>}
                </>
              }
            >
              {students.length === 0 && <Row tone="secondary">No students yet</Row>}
              {students.map((s) => (
                <Row key={s.id} chevron onClick={() => props.onEditStudent(s)}>
                  {s.name}
                </Row>
              ))}
              <Row tone="accent" onClick={() => props.onAddStudent(family.id)}>
                Add Student
              </Row>
            </Group>
          );
        })}
      {data && data.families.length > 0 && (
        <Group>
          <Row tone="accent" onClick={props.onAddFamily}>
            Add Family
          </Row>
        </Group>
      )}
      {data && data.archivedCount > 0 && (
        <Group>
          <Row chevron onClick={props.onOpenArchived}>
            Archived
          </Row>
        </Group>
      )}
    </>
  );
}
