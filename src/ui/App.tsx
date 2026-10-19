import { useEffect, useErrorBoundary, useState } from 'preact/hooks';
import type { Family, Session, Student } from '../domain/types';
import { isStandalone } from '../pwa/standalone';
import { ensurePersistence } from '../pwa/storage';
import { useAppUpdate } from '../pwa/useAppUpdate';
import { Archived, ArchivedDeleteAlert, type ArchivedDeleteTarget } from './Archived';
import { setAttendees, upsertExpense, type FormState } from '../domain/sessionForm';
import { ExpenseEditor } from './ExpenseEditor';
import { FamilySheet } from './FamilySheet';
import { NavBar, PushLayer, Screen, TabBar, useAnimatedClose, type TabId } from './components';
import { Log } from './Log';
import { People } from './People';
import { Sessions } from './Sessions';
import { Settings } from './Settings';
import { RecordsError, SafariBanner, UpdateBanner } from './Status';
import { StudentPicker } from './StudentPicker';
import { SessionSheet } from './SessionSheet';
import { StudentSheet } from './StudentSheet';
import './styles.css';

type SheetState =
  | null
  | { kind: 'family'; family?: Family }
  | { kind: 'student'; student?: Student; familyId?: string }
  | { kind: 'session'; session: Session };

function ArchivedScreen(props: { onClosed: () => void }) {
  const { closing, close, onAnimationEnd } = useAnimatedClose(props.onClosed, 310);
  const [pendingDelete, setPendingDelete] = useState<ArchivedDeleteTarget | null>(null);
  // The alert is a sibling of the pushed layer so it ends up a direct child of .app and makes the layer inert (WR-06).
  return (
    <>
      <PushLayer closing={closing} onAnimationEnd={onAnimationEnd}>
        <Screen nav={<NavBar title="Archived" back={{ label: 'People', onClick: close }} />}>
          <Archived onEmpty={close} onDelete={setPendingDelete} />
        </Screen>
      </PushLayer>
      {pendingDelete && <ArchivedDeleteAlert target={pendingDelete} onClose={() => setPendingDelete(null)} />}
    </>
  );
}

export function App() {
  const [tab, setTab] = useState<TabId>('log');
  const [archivedOpen, setArchivedOpen] = useState(false);
  // The Log draft lives here so an unsaved form survives switching tabs.
  const [logDraft, setLogDraft] = useState<FormState | null>(null);
  const [logPickerOpen, setLogPickerOpen] = useState(false);
  // The Expense editor on the Log tab: null (closed) or the expense being edited (id null = new).
  const [logExpense, setLogExpense] = useState<{ id: string | null } | null>(null);
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
        ) : tab === 'log' ? (
          <Log draft={logDraft} setDraft={setLogDraft} onOpenPicker={() => setLogPickerOpen(true)} onOpenExpense={(id) => setLogExpense({ id })} />
        ) : tab === 'sessions' ? (
          <Sessions onLogSession={() => setTab('log')} onEdit={(session) => setSheet({ kind: 'session', session })} />
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
      {!error && logPickerOpen && logDraft && (
        <StudentPicker
          attendees={logDraft.attendees}
          subject={logDraft.subject}
          onChange={(attendees, tappedDefault) => setLogDraft((d) => d && setAttendees(d, attendees, tappedDefault))}
          backLabel="Log"
          onClosed={() => setLogPickerOpen(false)}
        />
      )}
      {!error && logExpense && logDraft && (
        <ExpenseEditor
          key={logExpense.id ?? 'new'}
          initial={logDraft.expenses.find((e) => e.id === logExpense.id) ?? null}
          backLabel="Log"
          onSave={(draft) => setLogDraft((d) => d && upsertExpense(d, draft))}
          onClosed={() => setLogExpense(null)}
        />
      )}
      {!error && archivedOpen && <ArchivedScreen onClosed={() => setArchivedOpen(false)} />}
      <TabBar
        tab={tab}
        onSelect={(next) => {
          setTab(next);
          setArchivedOpen(false);
          setLogPickerOpen(false);
          setLogExpense(null);
        }}
      />
      {!error && sheet?.kind === 'family' && <FamilySheet family={sheet.family} onClosed={() => setSheet(null)} />}
      {!error && sheet?.kind === 'session' && <SessionSheet session={sheet.session} onClosed={() => setSheet(null)} />}
      {!error && sheet?.kind === 'student' && (
        <StudentSheet student={sheet.student} presetFamilyId={sheet.familyId} onClosed={() => setSheet(null)} />
      )}
    </div>
  );
}
