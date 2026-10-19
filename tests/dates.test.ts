import { describe, expect, it } from 'vitest';
import { isValidYmd, todayLocal } from '../src/domain/dates';

describe('todayLocal', () => {
  it('reads the local calendar date late on a Sunday', () => {
    expect(todayLocal(new Date(2026, 9, 18, 23, 30))).toBe('2026-10-18');
  });
  it('reads the local calendar date just after midnight on a Monday', () => {
    expect(todayLocal(new Date(2026, 9, 19, 0, 30))).toBe('2026-10-19');
  });
});

describe('isValidYmd', () => {
  it.each(['2026-10-19', '2028-02-29', '2026-12-31'])('accepts %s', (s) => expect(isValidYmd(s)).toBe(true));
  it.each(['2026-02-29', '2026-13-01', '2026-1-5', '', '2026-00-10', '2026-04-31', '1900-02-29'])('rejects "%s"', (s) =>
    expect(isValidYmd(s)).toBe(false),
  );
});
