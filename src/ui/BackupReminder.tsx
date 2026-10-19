import { useState } from 'preact/hooks';
import { readBackupStatus } from '../data/backup';
import { useLive } from '../data/live';
import { backupReminder } from '../domain/backup';
import { useBackup } from './useBackup';

/** Log tab reminder (D-10): hidden, a quiet line, or a card. Never blocks or reorders logging. */
export function BackupReminder() {
  const status = useLive(readBackupStatus);
  const { busy, run } = useBackup();
  const [failed, setFailed] = useState(false);
  if (!status) return null;
  const reminder = backupReminder(status, Date.now());
  if (reminder.kind === 'hidden') return null;
  if (reminder.kind === 'quiet') return <p class="backup-line">{reminder.text}</p>;
  return (
    <section class="backup-card" aria-label="Back up your data">
      <h2 class="backup-card-title">Back up your data</h2>
      <p class="backup-card-body">{reminder.body}</p>
      {failed && <p class="sheet-error" role="alert">Couldn't create the backup. Nothing was changed. Try Back Up Now again.</p>}
      <button
        type="button"
        class="text-button backup-card-action"
        disabled={busy}
        onClick={() => void run().then((r) => setFailed(r === 'failed'))}
      >
        {busy ? 'Preparing Backup…' : 'Back Up Now'}
      </button>
    </section>
  );
}
