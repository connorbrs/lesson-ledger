import { describe, expect, it } from 'vitest';
import { formatDateValue, formatTime12, isValidTime, isValidYmd, todayLocal } from '../src/domain/dates';

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

describe('formatDateValue, formatTime12, isValidTime', () => {
  it('reads Today for today and a short weekday date otherwise', () => {
    expect(formatDateValue('2026-10-19', '2026-10-19')).toBe('Today');
    expect(formatDateValue('2026-10-12', '2026-10-19')).toBe('Mon, Oct 12');
  });
  it('appends the year when it is not the current year', () => {
    expect(formatDateValue('2027-10-12', '2026-10-19')).toBe('Tue, Oct 12, 2027');
  });
  it('formats 12-hour times', () => {
    expect(formatTime12('16:30')).toBe('4:30 PM');
    expect(formatTime12('00:05')).toBe('12:05 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
  });
  it('validates HH:MM', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:5')).toBe(false);
  });
});
