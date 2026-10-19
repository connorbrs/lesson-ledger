import { useEffect } from 'preact/hooks';
import { listArchivedFamilies, restoreFamily } from '../data/families';
import { useLive } from '../data/live';
import { Group, Row } from './components';

export function Archived(props: { onEmpty: () => void }) {
  const data = useLive(async () => ({ families: await listArchivedFamilies() }));

  // When the last archived record is restored, pop back to People.
  useEffect(() => {
    if (data && data.families.length === 0) props.onEmpty();
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
    </>
  );
}
