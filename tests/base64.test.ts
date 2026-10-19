import { describe, expect, it } from 'vitest';
import { base64DecodedLength, base64ToBytes, bytesToBase64, isBase64 } from '../src/domain/base64';

const sample = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) % 256);

describe('base64 helpers', () => {
  it.each([0, 1, 2, 3, 4, 1000, 32768, 32769, 300000])('encode and decode match Buffer for %i bytes', (n) => {
    const bytes = sample(n);
    const text = bytesToBase64(bytes);
    expect(text).toBe(Buffer.from(bytes).toString('base64'));
    // The empty string is not valid on decode (a photo entry is never empty); every other size round-trips.
    if (n === 0) return expect(base64ToBytes(text)).toBeNull();
    expect(base64ToBytes(text)).toEqual(bytes);
    expect(base64DecodedLength(text)).toBe(n);
  });

  it.each([
    ['empty', ''],
    ['three characters', 'abc'],
    ['bad character', 'ab@d'],
    ['padding in the middle', 'abc=d'],
    ['only padding', '===='],
    ['trailing newline', 'QUJD\n'],
    ['three padding characters', 'A==='],
    ['not a string', 42],
  ])('rejects %s', (_n, value) => {
    expect(base64ToBytes(value as string)).toBeNull();
    expect(isBase64(value)).toBe(false);
  });

  it('accepts valid padding', () => {
    expect(isBase64('QQ==')).toBe(true);
    expect(isBase64('QUI=')).toBe(true);
    expect(isBase64('QUJD')).toBe(true);
  });
});
