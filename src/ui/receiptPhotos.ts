import { useEffect, useState } from 'preact/hooks';
import { getAttachmentBlob, type NewPhoto } from '../data/expenses';

/**
 * Photos staged in memory by id until their session saves. Kept outside FormState (Pitfall 1): a draft
 * holds only photo ids, so form state stays JSON-safe.
 */
export type PhotoStage = Map<string, NewPhoto>;

/**
 * The object URL for one receipt: undefined while loading, null when no Blob exists or it cannot be read.
 * Staged photos come from the stage, stored ones from the attachments table (read once). One URL per mount,
 * created here and revoked in the effect cleanup. This file is the only place in src/ui that creates object URLs.
 */
export function useReceiptUrl(id: string, stage: PhotoStage): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cleaned = false;
    let made: string | null = null;
    setUrl(undefined);
    void (async () => {
      let blob: Blob | undefined;
      try {
        blob = stage.get(id)?.blob ?? (await getAttachmentBlob(id));
      } catch {
        blob = undefined;
      }
      if (cleaned) return;
      if (!blob) {
        setUrl(null);
        return;
      }
      made = URL.createObjectURL(blob);
      setUrl(made);
    })();
    return () => {
      cleaned = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url;
}
