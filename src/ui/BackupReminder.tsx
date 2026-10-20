import { useState } from 'preact/hooks';
import { readBackupStatus } from '../data/backup';
import { useLive } from '../data/live';
import { backupReminder } from '../domain/backup';
import { BackupTooLargeAlert } from './BackupTooLargeAlert';
import { useBackup, type BackupOutcome } from './useBackup';

/** Log tab reminder (D-10): hidden, a quiet line, or a card. Never blocks or reorders logging. */
export function BackupReminder() {
  const status = useLive(readBackupStatus);
  const { busy, run } = useBackup();
  const [outcome, setOutcome] = useState<BackupOutcome | null>(null);
  if (!status) return null;
  const reminder = backupReminder(status, Date.now());
  if (reminder.kind === 'hidden') return null;
  if (reminder.kind === 'quiet') return <p class="backup-line">{reminder.text}</p>;
  return (
    <section class="status-panel backup" aria-label="Back up your data">
      <h2 class="heading">Back up your data</h2>
      <p>{reminder.body}</p>
      {outcome === 'failed' && <p class="sheet-error" role="alert">Couldn't create the backup. Nothing was changed. Try Back Up Now again.</p>}
      <button
        type="button"
        class="text-button"
        disabled={busy}
        onClick={() => void run().then(setOutcome)}
      >
        {busy ? 'Preparing Backup…' : 'Back Up Now'}
      </button>
      {outcome === 'too-large' && <BackupTooLargeAlert onClose={() => setOutcome(null)} />}
    </section>
  );
}
