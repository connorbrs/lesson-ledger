import { useEffect, useRef, useState } from 'preact/hooks';
import { useLive } from '../data/live';
import { createSession, getLastSession, loadNameMaps } from '../data/sessions';
import { listActiveStudents } from '../data/students';
import { todayLocal } from '../domain/dates';
import { blankForm, formToInput, prefillFromSession, setAttendees, type FormState } from '../domain/sessionForm';
import { BackupReminder } from './BackupReminder';
import { sessionSaveErrorMessage } from './components';
import { SessionFields } from './SessionFields';

const LOGGED_MS = 1500;

export function Log(props: { draft: FormState | null; setDraft: (f: FormState) => void; onOpenPicker: () => void }) {
  const { draft } = props;
  const data = useLive(async () => ({ active: await listActiveStudents(), names: await loadNameMaps(), last: await getLastSession() }));
  const busy = useRef(false); // synchronous guard: a double tap writes once; held until "Logged" clears
  const root = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const ready = draft !== null && data !== undefined;

  useEffect(() => () => clearTimeout(timer.current), []);

  // D-02: the first time Log opens, pre-fill from the last session (or start blank).
  useEffect(() => {
    if (draft === null && data) props.setDraft(data.last ? prefillFromSession(data.last, data.active) : blankForm());
  }, [data, draft === null]);

  // A student archived (or moved to another family) on People while the draft is open cannot be saved.
  useEffect(() => {
    if (!draft || !data) return;
    const byId = new Map(data.active.map((s) => [s.id, s]));
    const next = draft.attendees.filter((a) => byId.has(a.studentId)).map((a) => ({ studentId: a.studentId, familyId: byId.get(a.studentId)!.familyId }));
    if (next.length === draft.attendees.length && next.every((a, i) => a.familyId === draft.attendees[i].familyId)) return;
    props.setDraft(setAttendees(draft, next));
  }, [data?.active, draft?.attendees]);

  // Keep the last Minutes row reachable above the sticky footer.
  useEffect(() => {
    const el = footer.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFooterHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  if (!draft || !data) return <h1 class="large-title">Log</h1>;

  const check = formToInput(draft, todayLocal());

  async function save() {
    // "Today" is resolved now, not at render: a form left open past midnight saves the day it was logged.
    if (!draft || busy.current || !data) return;
    const fresh = formToInput(draft, todayLocal());
    if (!fresh.ok) return;
    busy.current = true;
    setSaveError(null);
    try {
      const saved = await createSession(fresh.value);
      props.setDraft(prefillFromSession(saved, data.active));
      root.current?.closest('.scroll')?.scrollTo({ top: 0 });
      setLogged(true);
      timer.current = window.setTimeout(() => {
        setLogged(false);
        busy.current = false;
      }, LOGGED_MS);
    } catch (e) {
      busy.current = false;
      setSaveError(sessionSaveErrorMessage(e));
    }
  }

  return (
    <div ref={root}>
      <h1 class="large-title">Log</h1>
      <SessionFields
        form={draft}
        onChange={props.setDraft}
        names={data.names}
        hasActiveStudents={data.active.length > 0}
        onOpenPicker={props.onOpenPicker}
      />
      <BackupReminder />
      <div style={{ height: footerHeight }} aria-hidden="true" />
      <div ref={footer} class="log-footer">
        {saveError && <p class="sheet-error" role="alert">{saveError}</p>}
        <button type="button" class="primary-button" disabled={logged || !check.ok} onClick={() => void save()}>
          {logged ? 'Logged ✓' : 'Log Session'}
        </button>
        <span class="visually-hidden" role="status">{logged ? 'Session logged' : ''}</span>
      </div>
    </div>
  );
}
