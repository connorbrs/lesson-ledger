import { afterEach, describe, expect, it, vi } from 'vitest';
import updateSource from '../src/pwa/useAppUpdate.ts?raw';
import { singleFlight } from '../src/pwa/singleFlight';
import { isStandalone } from '../src/pwa/standalone';
import { ensurePersistence, formatBytes, readUsage } from '../src/pwa/storage';

afterEach(() => {
  vi.useRealTimers();
});

describe('singleFlight', () => {
  it('shares one in-flight call between concurrent callers', async () => {
    let release!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((res) => (release = res)));
    const run = singleFlight(fn);
    const a = run();
    const b = run();
    release('done');
    expect(await a).toBe('done');
    expect(await b).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs fn again after it settles', async () => {
    const fn = vi.fn(async () => 'x');
    const run = singleFlight(fn);
    await run();
    await run();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects every waiting caller, then runs fn again on the next call', async () => {
    let reject!: (e: Error) => void;
    const fn = vi.fn().mockImplementationOnce(() => new Promise<string>((_, rej) => (reject = rej))).mockResolvedValueOnce('ok');
    const run = singleFlight(fn);
    const a = run();
    const b = run();
    reject(new Error('boom'));
    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    expect(await run()).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('isStandalone', () => {
  const win = (matches: boolean | undefined, standalone?: boolean) =>
    ({
      matchMedia: matches === undefined ? undefined : () => ({ matches }),
      navigator: { standalone },
    }) as unknown as Window;

  it('is true when display-mode standalone matches', () => {
    expect(isStandalone(win(true))).toBe(true);
  });
  it('is true when navigator.standalone is true', () => {
    expect(isStandalone(win(false, true))).toBe(true);
  });
  it('is false when neither is true', () => {
    expect(isStandalone(win(false, false))).toBe(false);
    expect(isStandalone(win(false))).toBe(false);
  });
  it('uses navigator.standalone when matchMedia is missing', () => {
    expect(isStandalone(win(undefined, true))).toBe(true);
    expect(isStandalone(win(undefined, false))).toBe(false);
  });
  it('never throws', () => {
    const throwing = {
      matchMedia: () => {
        throw new Error('nope');
      },
      navigator: {},
    } as unknown as Window;
    expect(isStandalone(throwing)).toBe(false);
  });
});

describe('ensurePersistence', () => {
  it('returns not-supported when storage or its functions are missing', async () => {
    expect(await ensurePersistence(undefined)).toBe('not-supported');
    expect(await ensurePersistence({} as StorageManager)).toBe('not-supported');
    expect(await ensurePersistence({ persist: async () => true } as unknown as StorageManager)).toBe('not-supported');
    expect(await ensurePersistence({ persisted: async () => true } as unknown as StorageManager)).toBe('not-supported');
  });

  it('calls persist() then persisted() and maps the result', async () => {
    const calls: string[] = [];
    const make = (persisted: boolean) =>
      ({
        persist: async () => {
          calls.push('persist');
          return true;
        },
        persisted: async () => {
          calls.push('persisted');
          return persisted;
        },
      }) as unknown as StorageManager;
    expect(await ensurePersistence(make(true))).toBe('granted');
    expect(calls).toEqual(['persist', 'persisted']);
    expect(await ensurePersistence(make(false))).toBe('not-granted');
  });

  it('returns not-granted and never throws when persist() rejects', async () => {
    const storage = {
      persist: async () => {
        throw new Error('denied');
      },
      persisted: async () => false,
    } as unknown as StorageManager;
    expect(await ensurePersistence(storage)).toBe('not-granted');
  });

  it('calls persist() once for concurrent callers and resolves them to the same value', async () => {
    let release!: () => void;
    const persist = vi.fn(() => new Promise<boolean>((res) => (release = () => res(true))));
    const storage = { persist, persisted: async () => true } as unknown as StorageManager;
    const a = ensurePersistence(storage);
    const b = ensurePersistence(storage);
    release();
    expect(await a).toBe('granted');
    expect(await b).toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe('readUsage', () => {
  it('returns usage and quota when estimate resolves with both numbers', async () => {
    const storage = { estimate: async () => ({ usage: 1200000, quota: 5000000 }) } as unknown as StorageManager;
    expect(await readUsage(storage)).toEqual({ usage: 1200000, quota: 5000000 });
  });

  it('returns null when estimate is missing, rejects, or lacks a number', async () => {
    expect(await readUsage(undefined)).toBeNull();
    expect(await readUsage({} as StorageManager)).toBeNull();
    expect(
      await readUsage({
        estimate: async () => {
          throw new Error('x');
        },
      } as unknown as StorageManager),
    ).toBeNull();
    expect(await readUsage({ estimate: async () => ({ usage: 5 }) } as unknown as StorageManager)).toBeNull();
    expect(await readUsage({ estimate: async () => ({ quota: 5 }) } as unknown as StorageManager)).toBeNull();
  });

  it('returns null after the timeout when estimate never answers', async () => {
    vi.useFakeTimers();
    const storage = { estimate: () => new Promise(() => undefined) } as unknown as StorageManager;
    const pending = readUsage(storage, 2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formats with decimal thresholds', () => {
    expect(formatBytes(0, 'en')).toBe('0 kB');
    expect(formatBytes(512000, 'en')).toBe('512 kB');
    expect(formatBytes(1200000, 'en')).toBe('1.2 MB');
    expect(formatBytes(1500000000, 'en')).toBe('1.5 GB');
  });
});

describe('update code import boundary', () => {
  const text = updateSource;
  it('imports nothing from the data layer or dexie and never touches indexedDB', () => {
    expect(text).not.toMatch(/from\s+['"][^'"]*\/data/);
    expect(text).not.toMatch(/from\s+['"]dexie['"]/);
    expect(text).not.toMatch(/indexedDB/);
  });
});
