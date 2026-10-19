export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

/** The browser objects shareFile needs, injected so tests can pass fakes. */
export interface ShareEnv {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
  download: (file: File) => void;
}

const isAbort = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';

function defaultEnv(): ShareEnv {
  const nav = globalThis.navigator;
  return {
    canShare: nav?.canShare?.bind(nav),
    share: nav?.share?.bind(nav),
    download: (file) => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  };
}

/**
 * Opens the share sheet. Cancelling it ('AbortError') changes nothing and does not download.
 * Any other refusal, or no share support, falls back to a download. If the download throws, this rejects.
 */
export async function shareFile(file: File, env: ShareEnv = defaultEnv()): Promise<ShareResult> {
  const data = { files: [file] };
  let canShare = false;
  try {
    canShare = !!env.share && !!env.canShare && env.canShare(data);
  } catch {
    canShare = false;
  }
  if (canShare) {
    try {
      await env.share!(data);
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  env.download(file);
  return 'downloaded';
}
