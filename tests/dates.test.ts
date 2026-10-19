import { describe, expect, it } from 'vitest';
import { containsDate, currentHHMM, formatDateValue, formatDayHeader, formatDuration, formatTime12, isValidTime, isValidYmd, minutesToTime, periodRange, rangeLabel, shiftPeriod, timeToMinutes, todayLocal } from '../src/domain/dates';

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

describe('periodRange', () => {
  it('gives the Monday-to-Sunday week that contains the anchor', () => {
    expect(periodRange('week', '2026-10-21')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });
  it('keeps Sunday in its week and starts the next week on Monday', () => {
    expect(periodRange('week', '2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(periodRange('week', '2026-10-26').start).toBe('2026-10-26');
  });
  it('gives the calendar month, leap years included', () => {
    expect(periodRange('month', '2026-10-31')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodRange('month', '2026-02-10').end).toBe('2026-02-28');
    expect(periodRange('month', '2028-02-10').end).toBe('2028-02-29');
  });
  it('puts the last day of a month and the first of the next in different month ranges', () => {
    expect(periodRange('month', '2026-10-31').end < periodRange('month', '2026-11-01').start).toBe(true);
  });
});

describe('shiftPeriod', () => {
  it('moves a week by 7 days across a year end', () => {
    expect(shiftPeriod('week', '2026-12-28', 1)).toBe('2027-01-04');
    expect(shiftPeriod('week', '2026-10-19', -1)).toBe('2026-10-12');
  });
  it('moves a month across December and January, clamping the day', () => {
    expect(shiftPeriod('month', '2026-12-15', 1)).toBe('2027-01-15');
    expect(shiftPeriod('month', '2026-01-15', -1)).toBe('2025-12-15');
    expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('rangeLabel', () => {
  const TODAY = '2026-10-19';
  it('reads a week within a month, across months, and a month', () => {
    expect(rangeLabel({ start: '2026-10-19', end: '2026-10-25' }, 'week', TODAY)).toBe('Oct 19 – 25');
    expect(rangeLabel({ start: '2026-10-26', end: '2026-11-01' }, 'week', TODAY)).toBe('Oct 26 – Nov 1');
    expect(rangeLabel({ start: '2026-10-01', end: '2026-10-31' }, 'month', TODAY)).toBe('October 2026');
  });
  it('appends the year once for a week outside the current year', () => {
    expect(rangeLabel({ start: '2025-10-13', end: '2025-10-19' }, 'week', TODAY)).toBe('Oct 13 – 19, 2025');
  });
  it('shows the year on both ends for a week that crosses a year end', () => {
    expect(rangeLabel({ start: '2026-12-28', end: '2027-01-03' }, 'week', TODAY)).toBe('Dec 28, 2026 – Jan 3, 2027');
  });
});

describe('containsDate and formatDayHeader', () => {
  const week = { start: '2026-10-19', end: '2026-10-25' };
  it('is inclusive on both ends', () => {
    expect(containsDate(week, '2026-10-19')).toBe(true);
    expect(containsDate(week, '2026-10-25')).toBe(true);
    expect(containsDate(week, '2026-10-18')).toBe(false);
    expect(containsDate(week, '2026-10-26')).toBe(false);
  });
  it('reads group headers without a year', () => {
    expect(formatDayHeader('2026-10-19')).toBe('Mon, Oct 19');
    expect(formatDayHeader('2026-10-18')).toBe('Sun, Oct 18');
    expect(formatDayHeader('2028-02-29')).toBe('Tue, Feb 29');
  });
});

describe('Start, Finish and Duration helpers', () => {
  it('timeToMinutes and minutesToTime convert HH:MM, and minutesToTime is null outside the day', () => {
    expect(timeToMinutes('16:30')).toBe(990);
    expect(minutesToTime(990)).toBe('16:30');
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(1439)).toBe('23:59');
    expect(minutesToTime(1440)).toBeNull();
    expect(minutesToTime(-1)).toBeNull();
  });
  it('currentHHMM reads the local hour and minute and drops the seconds', () => {
    expect(currentHHMM(new Date(2026, 9, 19, 9, 5, 59))).toBe('09:05');
  });
  it('formatDuration gives h:mm with unpadded hours', () => {
    expect([0, 47, 105, 999].map(formatDuration)).toEqual(['0:00', '0:47', '1:45', '16:39']);
  });
});
