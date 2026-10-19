import { describe, expect, it } from 'vitest';
import { centsToInput, equalSplit, formatCents, overrideSplit, parseAmountToCents, sumCents } from '../src/domain/money';

describe('parseAmountToCents', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['$6', 600],
    ['6.', 600],
    ['.5', 50],
    ['0', 0],
    [' 7.25 ', 725],
    ['0.05', 5],
    ['$12.50', 1250],
  ])('parses %j as %j', (text, cents) => {
    expect(parseAmountToCents(text)).toBe(cents);
  });

  it.each(['', '.', '$', '1.005', '1,000', '-5', '+5', '1e3', 'abc', '1.2.3', '$$5', '5 0', '9999999999999999999'])('rejects %j', (text) => {
    expect(parseAmountToCents(text)).toBeNull();
  });

  it('accepts the largest safe-integer cents value and rejects one digit more', () => {
    const max = String(Number.MAX_SAFE_INTEGER); // 9007199254740991 cents
    const text = `${max.slice(0, -2)}.${max.slice(-2)}`;
    expect(parseAmountToCents(text)).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseAmountToCents(`${max}.00`)).toBeNull();
    expect(parseAmountToCents(`${max.slice(0, -2)}0.${max.slice(-2)}`)).toBeNull();
  });
});

describe('formatCents and centsToInput', () => {
  it.each([
    [1250, '$12.50'],
    [100000, '$1,000.00'],
    [5, '$0.05'],
    [0, '$0.00'],
    [123456789, '$1,234,567.89'],
  ])('formats %j as %j', (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });
  it('renders editable text', () => {
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(5)).toBe('0.05');
  });
  it('sums', () => {
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(sumCents([])).toBe(0);
  });
});

describe('equalSplit and overrideSplit', () => {
  it('gives the odd cent to the first share', () => {
    expect(equalSplit(1001)).toEqual([501, 500]);
  });
  it('is exact for every total from 0 to 2000', () => {
    for (let t = 0; t <= 2000; t++) {
      const [a, b] = equalSplit(t);
      expect(a + b).toBe(t);
      expect(a - b).toBeLessThanOrEqual(1);
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });
  it('overrides', () => {
    expect(overrideSplit(1001, 700)).toEqual([700, 301]);
    expect(overrideSplit(1001, 0)).toEqual([0, 1001]);
    expect(overrideSplit(1001, 1001)).toEqual([1001, 0]);
    expect(overrideSplit(1001, 1002)).toBeNull();
    expect(overrideSplit(1001, -1)).toBeNull();
    expect(overrideSplit(1001, 1.5)).toBeNull();
  });
});
