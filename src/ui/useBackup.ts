import { useRef, useState } from 'preact/hooks';
import { buildBackup, markBackedUp } from '../data/backup';
import { backupFileName, BackupError, MAX_BACKUP_BYTES, serializeBackup } from '../domain/backup';
import { shareFile } from '../pwa/share';

export type BackupOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed' | 'too-large';

/**
 * Back Up Now: build the file, share it (download fallback), then record the backup. Never throws into render.
 * 'too-large' (D-08): the projected size or the final file is over the cap; nothing is shared and Last backup is untouched.
 */
export function useBackup() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function run(): Promise<BackupOutcome> {
    if (running.current) return 'cancelled';
    running.current = true;
    setBusy(true);
    try {
      const now = Date.now();
      const file = new File([serializeBackup(await buildBackup(now))], backupFileName(new Date(now)), { type: 'application/json' });
      if (file.size > MAX_BACKUP_BYTES) return 'too-large';
      const result = await shareFile(file);
      if (result === 'cancelled') return 'cancelled';
      await markBackedUp(Date.now());
      return result;
    } catch (e) {
      return e instanceof BackupError && e.code === 'too-large' ? 'too-large' : 'failed';
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return { busy, run };
}
