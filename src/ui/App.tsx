import { useEffect, useErrorBoundary, useState } from 'preact/hooks';
import type { MessageDraft } from '../domain/summaryState';
import type { Family, Session, Student } from '../domain/types';
import { isStandalone } from '../pwa/standalone';
import { ensurePersistence } from '../pwa/storage';
import { useAppUpdate } from '../pwa/useAppUpdate';
import { Archived, ArchivedDeleteAlert, type ArchivedDeleteTarget } from './Archived';
import { creditFamilies, needsCreditGroups, removeExpense, setAttendees, upsertExpense, type FormState } from '../domain/sessionForm';
import { ExpenseEditor } from './ExpenseEditor';
import { FamilySheet } from './FamilySheet';
import { InstructorSheet } from './InstructorSheet';
import { FamilySummaryScreen } from './FamilySummary';
import { NavBar, PushLayer, Screen, TabBar, useAnimatedClose, type TabId } from './components';
import { Log } from './Log';
import { People } from './People';
import type { PhotoStage } from './receiptPhotos';
import { Sessions } from './Sessions';
import { Settings } from './Settings';
import { Summaries } from './Summaries';
import { RecordsError, SafariBanner, UpdateBanner } from './Status';
import { StudentPicker } from './StudentPicker';
import { SessionSheet } from './SessionSheet';
import { StudentSheet } from './StudentSheet';
import './styles.css';

type SheetState =
  | null
  | { kind: 'family'; family?: Family }
  | { kind: 'student'; student?: Student; familyId?: string }
  | { kind: 'session'; session: Session }
  | { kind: 'instructor'; name: string | null };

/** The two families of a two-family swim form, in pick order, else null (no Split group). */
function splitPair(form: FormState): [string, string] | null {
  const ids = creditFamilies(form.attendees);
  return needsCreditGroups(form.subject, form.attendees) ? [ids[0], ids[1]] : null;
}

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
  // The family whose summary is open (a push layer over the Summaries tab), or null.
  const [summaryFamilyId, setSummaryFamilyId] = useState<string | null>(null);
  // Unsaved message text per family and period (keyed by record id); survives period changes and tab switches.
  const [messageDrafts, setMessageDrafts] = useState<ReadonlyMap<string, MessageDraft>>(() => new Map());
  const setMessageDraft = (id: string, draft: MessageDraft | null) =>
    setMessageDrafts((prev) => {
      const next = new Map(prev);
      if (draft) next.set(id, draft);
      else next.delete(id);
      return next;
    });
  // The Log draft lives here so an unsaved form survives switching tabs.
  const [logDraft, setLogDraft] = useState<FormState | null>(null);
  // Receipt photos staged for the Log tab's session; written with it on Log Session.
  const [logStage] = useState<PhotoStage>(() => new Map());
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
          <Log draft={logDraft} setDraft={setLogDraft} stage={logStage} onOpenPicker={() => setLogPickerOpen(true)} onOpenExpense={(id) => setLogExpense({ id })} />
        ) : tab === 'sessions' ? (
          <Sessions onLogSession={() => setTab('log')} onEdit={(session) => setSheet({ kind: 'session', session })} />
        ) : tab === 'summaries' ? (
          <Summaries onOpen={setSummaryFamilyId} />
        ) : tab === 'people' ? (
          <People
            onAddFamily={() => setSheet({ kind: 'family' })}
            onEditFamily={(family) => setSheet({ kind: 'family', family })}
            onAddStudent={(familyId) => setSheet({ kind: 'student', familyId })}
            onEditStudent={(student) => setSheet({ kind: 'student', student })}
            onOpenArchived={() => setArchivedOpen(true)}
          />
        ) : (
          <Settings onEditInstructor={(name) => setSheet({ kind: 'instructor', name })} />
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
          splitFamilyIds={splitPair(logDraft)}
          stage={logStage}
          onSave={(draft) => setLogDraft((d) => d && upsertExpense(d, draft))}
          onDelete={(id) => setLogDraft((f) => f && removeExpense(f, id))}
          onClosed={() => setLogExpense(null)}
        />
      )}
      {!error && archivedOpen && <ArchivedScreen onClosed={() => setArchivedOpen(false)} />}
      {!error && summaryFamilyId && <FamilySummaryScreen key={summaryFamilyId} familyId={summaryFamilyId} drafts={messageDrafts} onDraftChange={setMessageDraft} onClosed={() => setSummaryFamilyId(null)} />}
      <TabBar
        tab={tab}
        onSelect={(next) => {
          setTab(next);
          setArchivedOpen(false);
          setSummaryFamilyId(null);
          setLogPickerOpen(false);
          setLogExpense(null);
        }}
      />
      {!error && sheet?.kind === 'family' && <FamilySheet family={sheet.family} onClosed={() => setSheet(null)} />}
      {!error && sheet?.kind === 'instructor' && <InstructorSheet name={sheet.name} onClosed={() => setSheet(null)} />}
      {!error && sheet?.kind === 'session' && <SessionSheet session={sheet.session} onClosed={() => setSheet(null)} />}
      {!error && sheet?.kind === 'student' && (
        <StudentSheet student={sheet.student} presetFamilyId={sheet.familyId} onClosed={() => setSheet(null)} />
      )}
    </div>
  );
}
