import { createPortal } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { readBackupStatus, restoreBackup } from '../data/backup';
import { useLive } from '../data/live';
import {
  countPhrases,
  countsText,
  daysAgoText,
  formatBackupDate,
  MAX_BACKUP_BYTES,
  parseBackup,
  restoreFailureFor,
  type BackupFailure,
  type BackupFile,
} from '../domain/backup';
import { BackupTooLargeAlert } from './BackupTooLargeAlert';
import { Alert, Group, Row } from './components';
import { useBackup } from './useBackup';

const DEFAULT_FOOTER = 'Backup saves everything on this phone as one file, including receipt photos and summary edits. Restoring replaces everything on this phone.';
const BACKUP_FAILED = "Couldn't create the backup. Nothing was changed. Try Back Up Now again.";
const RESTORE_FAILED = "Couldn't restore this backup. Nothing was changed. Try again.";

const INVALID_MESSAGE: Record<BackupFailure, string> = {
  'not-backup': "This file isn't a Lesson Ledger backup. Nothing was changed. Choose another file.",
  damaged: "This backup file is damaged and can't be read. Nothing was changed. Choose another file.",
  'newer-version': 'This backup was made by a newer version of Lesson Ledger. Update the app, then try again. Nothing was changed.',
};

const countsOf = (file: BackupFile) => ({
  families: file.families.length,
  students: file.students.length,
  sessions: file.sessions.length,
  expenses: file.expenses.length,
  photos: file.attachments.length,
});

type AlertState = null | { kind: 'invalid'; code: BackupFailure } | { kind: 'confirm'; file: BackupFile };

/** Settings Backup group (D-09) and the restore gate (D-11): validate, confirm, then replace everything in one transaction. */
export function BackupGroup() {
  const status = useLive(readBackupStatus);
  const backup = useBackup();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [tooLarge, setTooLarge] = useState(false);
  const picking = useRef(false);
  const replacing = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  async function backUp() {
    const outcome = await backup.run();
    if (outcome === 'failed') setResult({ ok: false, text: BACKUP_FAILED });
    else if (outcome === 'too-large') {
      setResult(null);
      setTooLarge(true);
    } else if (outcome !== 'cancelled') setResult(null);
  }

  async function onPick(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const file = el.files?.[0];
    el.value = ''; // the same file can be picked again
    if (!file || picking.current) return;
    picking.current = true;
    setChecking(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) return setAlert({ kind: 'invalid', code: 'not-backup' });
      let text: string;
      try {
        text = await file.text();
      } catch {
        return setAlert({ kind: 'invalid', code: 'damaged' });
      }
      const parsed = parseBackup(text, file.size);
      setAlert(parsed.ok ? { kind: 'confirm', file: parsed.file } : { kind: 'invalid', code: parsed.code });
    } finally {
      picking.current = false;
      setChecking(false);
    }
  }

  async function replace(file: BackupFile) {
    if (replacing.current) return;
    replacing.current = true;
    setRestoring(true);
    let next: AlertState = null;
    try {
      await restoreBackup(file);
      setResult({ ok: true, text: `Restored. ${countsText(countsOf(file))} are on this phone.` });
    } catch (e) {
      // An undecodable photo means the file is damaged; the existing damaged alert says so. Anything else keeps the generic line.
      const failure = restoreFailureFor(e);
      if (failure) next = { kind: 'invalid', code: failure };
      else setResult({ ok: false, text: RESTORE_FAILED });
    } finally {
      replacing.current = false;
      setRestoring(false);
      setAlert(next);
    }
  }

  const chooseAnother = () => {
    setAlert(null);
    input.current?.click();
  };

  const layer =
    alert?.kind === 'invalid' ? (
      <Alert
        title="Can't restore this file."
        message={INVALID_MESSAGE[alert.code]}
        buttons={[
          { label: 'Cancel', tone: 'accent', onClick: () => setAlert(null) },
          { label: 'Choose Another File', tone: 'accent', strong: true, onClick: chooseAnother },
        ]}
      />
    ) : alert?.kind === 'confirm' ? (
      <Alert
        title="Replace everything with this backup?"
        message={`Backup from ${formatBackupDate(alert.file.createdAt)}: ${countPhrases(countsOf(alert.file)).join(', ')}. Everything on this phone is replaced. This can't be undone.`}
        buttons={[
          { label: 'Cancel', tone: 'accent', disabled: restoring, onClick: () => setAlert(null) },
          { label: 'Replace Everything', tone: 'destructive', strong: true, disabled: restoring, onClick: () => void replace(alert.file) },
        ]}
      />
    ) : null;

  return (
    <>
      <Group
        header="Backup"
        footer={result ? result.text : DEFAULT_FOOTER}
        footerError={result !== null && !result.ok}
      >
        <input ref={input} type="file" class="visually-hidden" accept=".json,application/json" tabIndex={-1} aria-hidden="true" onChange={(e) => void onPick(e)} />
        <Row value={status ? daysAgoText(status.lastBackupAt, Date.now()) : ''}>Last backup</Row>
        <Row tone="accent" disabled={backup.busy} onClick={() => void backUp()}>
          {backup.busy ? 'Preparing Backup…' : 'Back Up Now'}
        </Row>
        <Row disabled={checking} onClick={() => input.current?.click()}>
          {checking ? 'Checking Backup…' : 'Restore from Backup…'}
        </Row>
      </Group>
      {layer && createPortal(layer, document.querySelector('.app') ?? document.body)}
      {tooLarge && <BackupTooLargeAlert onClose={() => setTooLarge(false)} />}
    </>
  );
}
