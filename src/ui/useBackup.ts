import { useRef, useState } from 'preact/hooks';
import { buildBackup, markBackedUp } from '../data/backup';
import { backupFileName, serializeBackup } from '../domain/backup';
import { shareFile } from '../pwa/share';

export type BackupOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** Back Up Now: build the file, share it (download fallback), then record the backup. Never throws into render. */
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
      const result = await shareFile(file);
      if (result === 'cancelled') return 'cancelled';
      await markBackedUp(Date.now());
      return result;
    } catch {
      return 'failed';
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return { busy, run };
}
