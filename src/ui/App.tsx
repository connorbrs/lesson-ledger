import { useEffect, useErrorBoundary, useState } from 'preact/hooks';
import type { Family, Student } from '../domain/types';
import { isStandalone } from '../pwa/standalone';
import { ensurePersistence } from '../pwa/storage';
import { useAppUpdate } from '../pwa/useAppUpdate';
import { Archived } from './Archived';
import { FamilySheet } from './FamilySheet';
import { NavBar, PushLayer, Screen, TabBar, useAnimatedClose, type TabId } from './components';
import { People } from './People';
import { Settings } from './Settings';
import { RecordsError, SafariBanner, UpdateBanner } from './Status';
import { StudentSheet } from './StudentSheet';
import './styles.css';

type SheetState =
  | null
  | { kind: 'family'; family?: Family }
  | { kind: 'student'; student?: Student; familyId?: string };

function ArchivedScreen(props: { onClosed: () => void }) {
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  return (
    <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
      <Screen nav={<NavBar title="Archived" back={{ label: 'People', onClick: close }} />}>
        <Archived onEmpty={close} />
      </Screen>
    </PushLayer>
  );
}

export function App() {
  const [tab, setTab] = useState<TabId>('people');
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const update = useAppUpdate();
  // Any render error below (including a database that cannot open, rethrown by useLive) replaces only the content area.
  const [error] = useErrorBoundary((e) => console.error('Lesson Ledger render error:', e));

  // iOS Safari only applies :active styles when a touch listener exists on the document.
  useEffect(() => {
    const noop = () => undefined;
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);

  // Ask for persistent storage once per launch. Not awaited: it must never block rendering.
  useEffect(() => {
    void ensurePersistence();
  }, []);

  return (
    <div class="app">
      <Screen nav={<NavBar bare />}>
        {!isStandalone() && <SafariBanner />}
        {update.needRefresh && (
          <UpdateBanner applying={update.applying} failed={update.failed} onUpdate={update.apply} onNotNow={update.notNow} />
        )}
        {error ? (
          <RecordsError />
        ) : tab === 'people' ? (
          <People
            onAddFamily={() => setSheet({ kind: 'family' })}
            onEditFamily={(family) => setSheet({ kind: 'family', family })}
            onAddStudent={(familyId) => setSheet({ kind: 'student', familyId })}
            onEditStudent={(student) => setSheet({ kind: 'student', student })}
            onOpenArchived={() => setArchivedOpen(true)}
          />
        ) : (
          <Settings />
        )}
      </Screen>
      {!error && archivedOpen && <ArchivedScreen onClosed={() => setArchivedOpen(false)} />}
      <TabBar
        tab={tab}
        onSelect={(next) => {
          setTab(next);
          setArchivedOpen(false);
        }}
      />
      {!error && sheet?.kind === 'family' && <FamilySheet family={sheet.family} onClosed={() => setSheet(null)} />}
      {!error && sheet?.kind === 'student' && (
        <StudentSheet student={sheet.student} presetFamilyId={sheet.familyId} onClosed={() => setSheet(null)} />
      )}
    </div>
  );
}
