import { describe, expect, it } from 'vitest';
import { shareFile, type ShareEnv } from '../src/pwa/share';

const file = new File(['{}'], 'lesson-ledger-backup-2026-10-19.json', { type: 'application/json' });
const domError = (name: string) => Object.assign(new Error(name), { name });

function env(over: Partial<ShareEnv>): ShareEnv & { downloads: File[] } {
  const downloads: File[] = [];
  return { downloads, download: (f) => void downloads.push(f), ...over };
}

describe('shareFile', () => {
  it('returns shared when the share sheet completes, without downloading', async () => {
    const e = env({ canShare: () => true, share: async () => undefined });
    expect(await shareFile(file, e)).toBe('shared');
    expect(e.downloads).toEqual([]);
  });

  it('returns cancelled on AbortError and does not download', async () => {
    const e = env({ canShare: () => true, share: async () => Promise.reject(domError('AbortError')) });
    expect(await shareFile(file, e)).toBe('cancelled');
    expect(e.downloads).toEqual([]);
  });

  it.each(['NotAllowedError', 'TypeError'])('falls back to a download on %s', async (name) => {
    const e = env({ canShare: () => true, share: async () => Promise.reject(domError(name)) });
    expect(await shareFile(file, e)).toBe('downloaded');
    expect(e.downloads).toEqual([file]);
  });

  it('downloads when canShare is missing, false, or throws', async () => {
    for (const over of [{}, { canShare: () => false, share: async () => undefined }, { canShare: () => { throw new Error('x'); }, share: async () => undefined }]) {
      const e = env(over);
      expect(await shareFile(file, e)).toBe('downloaded');
      expect(e.downloads).toEqual([file]);
    }
  });

  it('rejects when the download itself throws', async () => {
    await expect(shareFile(file, { download: () => { throw new Error('blocked'); } })).rejects.toThrow('blocked');
  });
});
