import { describe, expect, it } from 'vitest';
import { equalSplit } from '../src/domain/money';
import {
  applyShareInput,
  equalShareTexts,
  initialShareState,
  shareCaption,
  shareTextsFor,
  splitIsOverridden,
} from '../src/domain/split';

const A = 'fam-a';
const B = 'fam-b';
const ids: [string, string] = [A, B];

describe('equalShareTexts', () => {
  it('gives the odd cent to the first share', () => {
    expect(equalShareTexts(1001)).toEqual(['5.01', '5.00']);
    expect(equalShareTexts(0)).toEqual(['0.00', '0.00']);
    expect(equalShareTexts(1250)).toEqual(['6.25', '6.25']);
  });
});

describe('shareTextsFor', () => {
  it('is the equal split for null and the stored shares in family order otherwise', () => {
    expect(shareTextsFor(1001, ids, null)).toEqual(['5.01', '5.00']);
    expect(
      shareTextsFor(1001, ids, [
        { familyId: B, cents: 301 },
        { familyId: A, cents: 700 },
      ]),
    ).toEqual(['7.00', '3.01']);
  });
});

describe('applyShareInput', () => {
  const cur: [string, string] = ['5.01', '5.00'];
  it('typing the first share fills the second', () => {
    expect(applyShareInput(1001, ids, cur, 0, '7')).toEqual({
      texts: ['7', '3.01'],
      splits: [
        { familyId: A, cents: 700 },
        { familyId: B, cents: 301 },
      ],
      error: null,
    });
  });
  it('typing the second share fills the first', () => {
    const r = applyShareInput(1001, ids, cur, 1, '3.01');
    expect(r.texts).toEqual(['7.00', '3.01']);
    expect(r.splits).toEqual([
      { familyId: A, cents: 700 },
      { familyId: B, cents: 301 },
    ]);
    expect(r.error).toBeNull();
  });
  it('typing the equal values gives the equal default (null splits)', () => {
    const r = applyShareInput(1001, ids, cur, 0, '5.01');
    expect(r.splits).toBeNull();
    expect(r.error).toBeNull();
    expect(r.texts).toEqual(['5.01', '5.00']);
    expect(applyShareInput(1001, ids, cur, 1, '5').splits).toBeNull();
  });
  it('accepts zero and the full total', () => {
    const zero = applyShareInput(1001, ids, cur, 0, '0');
    expect(zero.texts[1]).toBe('10.01');
    expect(zero.splits).toEqual([
      { familyId: A, cents: 0 },
      { familyId: B, cents: 1001 },
    ]);
    const full = applyShareInput(1001, ids, cur, 0, '10.01');
    expect(full.texts[1]).toBe('0.00');
    expect(full.splits?.[1].cents).toBe(0);
  });
  it('rejects a share above the total and keeps the other text', () => {
    const r = applyShareInput(1001, ids, cur, 0, '10.02');
    expect(r.error).toEqual({ index: 0, kind: 'above-total' });
    expect(r.splits).toBeNull();
    expect(r.texts).toEqual(['10.02', '5.00']);
  });
  it.each(['abc', '6.255', ''])('rejects %j as invalid', (text) => {
    const r = applyShareInput(1001, ids, cur, 1, text);
    expect(r.error).toEqual({ index: 1, kind: 'invalid' });
    expect(r.splits).toBeNull();
    expect(r.texts).toEqual(['5.01', text]);
  });
});

describe('shareCaption', () => {
  it('uses the two UI-SPEC sentences', () => {
    expect(shareCaption({ index: 0, kind: 'invalid' }, 1250)).toBe('Use dollars and cents, like 6.25.');
    expect(shareCaption({ index: 0, kind: 'above-total' }, 1250)).toBe("A share can't be more than $12.50.");
  });
});

describe('initialShareState', () => {
  const over = [
    { familyId: A, cents: 700 },
    { familyId: B, cents: 301 },
  ];
  it('is null for no override, other families, a wrong sum or the equal split', () => {
    expect(initialShareState(1001, ids, null)).toBeNull();
    expect(initialShareState(1001, ids, [{ familyId: A, cents: 700 }, { familyId: 'zzz', cents: 301 }])).toBeNull();
    expect(initialShareState(1001, ids, [{ familyId: A, cents: 700 }])).toBeNull();
    expect(initialShareState(1001, ids, [{ familyId: A, cents: 700 }, { familyId: B, cents: 300 }])).toBeNull();
    expect(initialShareState(1001, ids, [{ familyId: A, cents: 501 }, { familyId: B, cents: 500 }])).toBeNull();
  });
  it('holds the texts and splits of a stored override', () => {
    expect(initialShareState(1001, ids, over)).toEqual({ texts: ['7.00', '3.01'], splits: over, error: null });
  });
  it('orders shares by family pick order', () => {
    expect(initialShareState(1001, ids, [over[1], over[0]])?.splits).toEqual(over);
  });
});

describe('splitIsOverridden', () => {
  const cur: [string, string] = ['5.01', '5.00'];
  it('is true only while override splits are held', () => {
    expect(splitIsOverridden(null)).toBe(false);
    expect(splitIsOverridden({ texts: cur, splits: null, error: null })).toBe(false);
    expect(splitIsOverridden({ texts: cur, splits: null, error: { index: 0, kind: 'invalid' } })).toBe(false);
    expect(splitIsOverridden(applyShareInput(1001, ids, cur, 0, '7'))).toBe(true);
    expect(splitIsOverridden(applyShareInput(1001, ids, cur, 0, '5.01'))).toBe(false);
  });
});

describe('typed shares', () => {
  it('shares always sum to the total', () => {
    for (let total = 0; total <= 300; total++) {
      const equal = equalSplit(total);
      expect(equal[0] + equal[1]).toBe(total);
      const cur = equalShareTexts(total);
      for (let typed = 0; typed <= total + 2; typed++) {
        for (const index of [0, 1] as const) {
          const text = (typed / 100).toFixed(2);
          const r = applyShareInput(total, ids, cur, index, text);
          if (typed > total) {
            expect(r.error?.kind).toBe('above-total');
            expect(r.splits).toBeNull();
            continue;
          }
          expect(r.error).toBeNull();
          const cents = r.splits ? r.splits.map((s) => s.cents) : equal;
          expect(cents[0] + cents[1]).toBe(total);
          expect(cents[index]).toBe(typed);
        }
      }
      for (const bad of ['abc', '', '1.005']) {
        const r = applyShareInput(total, ids, cur, 0, bad);
        expect(r.error).not.toBeNull();
        expect(r.splits).toBeNull();
      }
    }
  });
});
