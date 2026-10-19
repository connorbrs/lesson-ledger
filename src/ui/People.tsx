import { listActiveFamilies, listArchivedFamilies } from '../data/families';
import { useLive } from '../data/live';
import { periodLabel } from '../domain/roster';
import type { Family } from '../domain/types';
import { Group, Row } from './components';

export function People(props: {
  onAddFamily: () => void;
  onEditFamily: (family: Family) => void;
  onOpenArchived: () => void;
}) {
  const data = useLive(async () => ({
    active: await listActiveFamilies(),
    archivedCount: (await listArchivedFamilies()).length,
  }));

  return (
    <>
      <h1 class="large-title">People</h1>
      {/* Nothing renders until the first query resolves: no spinner (UI-SPEC loading). */}
      {data && data.active.length === 0 && (
        <div class="empty">
          <h2 class="heading">No families yet</h2>
          <p>Add a family, then add the students in it. Tap Add Family to start.</p>
          <button type="button" class="primary-button" onClick={props.onAddFamily}>
            Add Family
          </button>
        </div>
      )}
      {data &&
        data.active.map((family) => (
          <Group
            key={family.id}
            header={family.name}
            headerAction={{ label: 'Edit Family', onClick: () => props.onEditFamily(family) }}
            footer={periodLabel(family.period)}
          >
            <Row tone="secondary">No students yet</Row>
          </Group>
        ))}
      {data && data.active.length > 0 && (
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
