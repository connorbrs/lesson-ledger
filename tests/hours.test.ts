import { describe, expect, it } from 'vitest';
import { formatHours, formatMinutes } from '../src/domain/hours';

describe('formatHours', () => {
  it.each([
    [90, '1.5 h (1:30)'],
    [60, '1 h (1:00)'],
    [0, '0 h (0:00)'],
    [45, '0.75 h (0:45)'],
    [1, '0.02 h (0:01)'],
    [22.5, '0.38 h (0:23)'],
    [4.5, '0.08 h (0:05)'],
    [59.5, '0.99 h (1:00)'],
    [999, '16.65 h (16:39)'],
  ])('%s min reads %s', (minutes, text) => expect(formatHours(minutes)).toBe(text));
});

describe('formatMinutes', () => {
  it.each([
    [22.5, '22.5 min'],
    [30, '30 min'],
    [0.5, '0.5 min'],
    [0, '0 min'],
  ])('%s reads %s', (minutes, text) => expect(formatMinutes(minutes)).toBe(text));
});
