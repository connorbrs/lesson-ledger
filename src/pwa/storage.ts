import { singleFlight } from './singleFlight';

export type PersistStatus = 'granted' | 'not-granted' | 'not-supported';

const defaultStorage = (): StorageManager | undefined => globalThis.navigator?.storage;

/**
 * Ask the browser for persistent storage and report whether it was granted.
 * Single-flight: concurrent callers share one persist() request. Never throws.
 */
export const ensurePersistence = singleFlight(
  async (storage: StorageManager | undefined = defaultStorage()): Promise<PersistStatus> => {
    if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') return 'not-supported';
    try {
      await storage.persist();
      return (await storage.persisted()) ? 'granted' : 'not-granted';
    } catch {
      return 'not-granted';
    }
  },
);

/** Read storage usage and quota; null when unavailable, failing, or not answered within timeoutMs. */
export async function readUsage(
  storage: StorageManager | undefined = defaultStorage(),
  timeoutMs = 2000,
): Promise<{ usage: number; quota: number } | null> {
  if (!storage || typeof storage.estimate !== 'function') return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const est = await Promise.race([storage.estimate(), timeout]);
    if (est && typeof est.usage === 'number' && typeof est.quota === 'number') {
      return { usage: est.usage, quota: est.quota };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Decimal (1000-based) size such as "1.2 MB". */
export function formatBytes(bytes: number, locale?: string): string {
  const [unit, divisor] = bytes < 1_000_000 ? (['kilobyte', 1e3] as const) : bytes < 1_000_000_000 ? (['megabyte', 1e6] as const) : (['gigabyte', 1e9] as const);
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(bytes / divisor);
}
