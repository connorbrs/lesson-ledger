import { describe, expect, it } from 'vitest';
import { copyText, type ClipboardEnv } from '../src/pwa/clipboard';

describe('copyText', () => {
  it('returns true and hands the exact text to the clipboard', async () => {
    const got: string[] = [];
    const env: ClipboardEnv = { writeText: async (t) => void got.push(t) };
    expect(await copyText('Merhaba', env)).toBe(true);
    expect(got).toEqual(['Merhaba']);
  });

  it('starts the write synchronously, before any microtask runs', () => {
    const got: string[] = [];
    const env: ClipboardEnv = { writeText: async (t) => void got.push(t) };
    const pending = copyText('Merhaba', env);
    expect(got).toEqual(['Merhaba']);
    return pending;
  });

  it('returns false when the write is rejected', async () => {
    const env: ClipboardEnv = { writeText: () => Promise.reject(new Error('NotAllowedError')) };
    expect(await copyText('x', env)).toBe(false);
  });

  it('returns false when the write throws synchronously', async () => {
    const env: ClipboardEnv = {
      writeText: () => {
        throw new Error('boom');
      },
    };
    expect(await copyText('x', env)).toBe(false);
  });

  it('returns false and does not throw when there is no clipboard', async () => {
    expect(await copyText('x', {})).toBe(false);
  });
});
