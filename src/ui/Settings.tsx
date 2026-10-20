import { useEffect, useState } from 'preact/hooks';
import { getInstructorName } from '../data/instructor';
import { useLive } from '../data/live';
import { ensurePersistence, formatBytes, readUsage, type PersistStatus } from '../pwa/storage';
import { BackupGroup } from './BackupGroup';
import { Group, Row } from './components';

const TIMEOUT_MS = 2000;

type Persist = 'checking' | 'unavailable' | PersistStatus;
type Used = 'checking' | 'unavailable' | { usage: number };

const PERSIST_LABEL: Record<Persist, string> = {
  checking: 'Checking…',
  unavailable: 'Unavailable',
  granted: 'Granted',
  'not-granted': 'Not granted',
  'not-supported': 'Not supported',
};

const PERSIST_FOOTER: Partial<Record<Persist, string>> = {
  granted: "iOS is less likely to clear Lesson Ledger's data when storage runs low.",
  'not-granted':
    "iOS has not agreed to protect this app's data, so it could be cleared when storage runs low. Back up from Settings, then Backup.",
  'not-supported': "This version of iOS doesn't report persistent storage.",
};

export function Settings(props: { onEditInstructor: (name: string | null) => void }) {
  const instructor = useLive(getInstructorName);
  const [persist, setPersist] = useState<Persist>('checking');
  const [used, setUsed] = useState<Used>('checking');

  useEffect(() => {
    let live = true;
    // If a read has not answered within 2 seconds the value reads Unavailable; a late answer still replaces it.
    const timer = setTimeout(() => {
      if (!live) return;
      setPersist((p) => (p === 'checking' ? 'unavailable' : p));
      setUsed((u) => (u === 'checking' ? 'unavailable' : u));
    }, TIMEOUT_MS);
    void ensurePersistence().then((s) => live && setPersist(s));
    void readUsage(undefined, TIMEOUT_MS).then((u) => live && setUsed(u ? { usage: u.usage } : 'unavailable'));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  const persistFooter = PERSIST_FOOTER[persist];
  const anyUnavailable = persist === 'unavailable' || used === 'unavailable';

  return (
    <>
      <h1 class="large-title">Settings</h1>
      <Group header="Instructor" footer="Printed at the top of each summary PDF. Leave it blank to leave it off.">
        <Row chevron value={instructor === undefined ? '' : (instructor ?? 'Not set')} onClick={() => props.onEditInstructor(instructor ?? null)} disabled={instructor === undefined}>
          Instructor name
        </Row>
      </Group>
      <Group
        header="Storage"
        footer={
          (persistFooter || anyUnavailable) && (
            <>
              {persistFooter && <span class="footer-line">{persistFooter}</span>}
              {anyUnavailable && <span class="footer-line">Unavailable on this iOS version.</span>}
            </>
          )
        }
      >
        <Row value={PERSIST_LABEL[persist]} valueAttention={persist === 'not-granted'}>
          Persistent storage
        </Row>
        <Row figure value={typeof used === 'object' ? formatBytes(used.usage) : used === 'checking' ? 'Checking…' : 'Unavailable'}>
          Storage used
        </Row>
      </Group>
      <BackupGroup />
      <Group header="About">
        <Row figure value={__BUILD_ID__}>Build</Row>
      </Group>
    </>
  );
}
