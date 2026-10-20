import { describe, expect, it } from 'vitest';
import {
  amountCaption,
  canSaveExpense,
  deleteExpenseMessage,
  draftFromExpense,
  expenseEditorDirty,
  expenseTotal,
  expensesFooterText,
  formatExpensesLine,
  receiptsLabel,
  remapSplitFamilies,
  resolveSplits,
  sessionDeleteMessage,
  splitLine,
  validateExpenseDrafts,
  validateExpenseText,
  type ExpenseDraft,
} from '../src/domain/expense';
import type { Expense } from '../src/domain/types';

const d = (over: Partial<ExpenseDraft> = {}): ExpenseDraft => ({ id: 'e1', description: 'Pool entry', amountCents: 1001, splits: null, photoIds: [], createdAt: 1, ...over });

describe('validateExpenseText', () => {
  it('trims and normalizes, requires text, caps at 80 code points', () => {
    expect(validateExpenseText('  Pool entry ')).toEqual({ ok: true, value: 'Pool entry' });
    expect(validateExpenseText('é')).toEqual({ ok: true, value: 'é' });
    expect(validateExpenseText('   ').ok).toBe(false);
    expect(validateExpenseText('a'.repeat(80)).ok).toBe(true);
    expect(validateExpenseText('a'.repeat(81)).ok).toBe(false);
    expect(validateExpenseText('😀'.repeat(80)).ok).toBe(true);
    expect(validateExpenseText('😀'.repeat(81)).ok).toBe(false);
  });
});

describe('resolveSplits', () => {
  it('is null for zero or three families', () => {
    expect(resolveSplits(d(), [])).toBeNull();
    expect(resolveSplits(d(), ['a', 'b', 'c'])).toBeNull();
  });
  it('gives one family the full amount and two families an equal split with the odd cent first', () => {
    expect(resolveSplits(d(), ['a'])).toEqual([{ familyId: 'a', cents: 1001 }]);
    expect(resolveSplits(d(), ['a', 'b'])).toEqual([
      { familyId: 'a', cents: 501 },
      { familyId: 'b', cents: 500 },
    ]);
  });
  it('keeps a valid override in pick order', () => {
    const splits = [
      { familyId: 'b', cents: 301 },
      { familyId: 'a', cents: 700 },
    ];
    expect(resolveSplits(d({ splits }), ['a', 'b'])).toEqual([
      { familyId: 'a', cents: 700 },
      { familyId: 'b', cents: 301 },
    ]);
  });
  it('resets an override for different families to the equal split', () => {
    const splits = [
      { familyId: 'a', cents: 700 },
      { familyId: 'x', cents: 301 },
    ];
    expect(resolveSplits(d({ splits }), ['a', 'b'])).toEqual([
      { familyId: 'a', cents: 501 },
      { familyId: 'b', cents: 500 },
    ]);
  });
  it('is null for a same-families override with a wrong sum or a negative share', () => {
    expect(resolveSplits(d({ splits: [{ familyId: 'a', cents: 700 }, { familyId: 'b', cents: 302 }] }), ['a', 'b'])).toBeNull();
    expect(resolveSplits(d({ splits: [{ familyId: 'a', cents: -1 }, { familyId: 'b', cents: 1002 }] }), ['a', 'b'])).toBeNull();
  });
});

describe('validateExpenseDrafts', () => {
  const ok = (drafts: ExpenseDraft[]) => validateExpenseDrafts(drafts, ['a']).ok;
  it('accepts a valid draft and normalizes the description', () => {
    const r = validateExpenseDrafts([d({ description: '  Pool  ' })], ['a']);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.value[0]).toMatchObject({ description: 'Pool', splits: [{ familyId: 'a', cents: 1001 }] });
  });
  it('accepts 1 cent and rejects 0', () => {
    expect(ok([d({ amountCents: 1 })])).toBe(true);
    expect(ok([d({ amountCents: 0 })])).toBe(false);
    expect(ok([d({ amountCents: 1.5 })])).toBe(false);
  });
  it('rejects blank description, duplicate ids, duplicate photo ids across drafts, empty ids and bad createdAt', () => {
    expect(ok([d({ description: ' ' })])).toBe(false);
    expect(ok([d(), d()])).toBe(false);
    expect(ok([d({ photoIds: ['p'] }), d({ id: 'e2', photoIds: ['p'] })])).toBe(false);
    expect(ok([d({ photoIds: ['p', 'p'] })])).toBe(false);
    expect(ok([d({ id: '' })])).toBe(false);
    expect(ok([d({ createdAt: -1 })])).toBe(false);
    expect(ok([d({ createdAt: NaN })])).toBe(false);
  });
  it('rejects when the families are not one or two', () => {
    expect(validateExpenseDrafts([d()], [])).toEqual({ ok: false, code: 'expenses-invalid' });
  });
  it('accepts an empty list', () => {
    expect(validateExpenseDrafts([], ['a'])).toEqual({ ok: true, value: [] });
  });
});

describe('draftFromExpense', () => {
  const row = (splits: Expense['splits'], amountCents = 1001): Expense => ({ id: 'e1', sessionId: 's', description: 'x', amountCents, splits, createdAt: 5, updatedAt: 5 });
  it('gives null splits for an even equal default and for one family', () => {
    expect(draftFromExpense(row([{ familyId: 'a', cents: 500 }, { familyId: 'b', cents: 500 }], 1000), [], ['a', 'b']).splits).toBeNull();
    expect(draftFromExpense(row([{ familyId: 'a', cents: 1001 }]), [], ['a']).splits).toBeNull();
  });
  it('keeps an odd-cent two-family split as stored, so re-picking the same families in another order moves no cent (WR-02)', () => {
    const stored = [{ familyId: 'a', cents: 501 }, { familyId: 'b', cents: 500 }];
    const draft = draftFromExpense(row(stored), [], ['a', 'b']);
    expect(draft.splits).toEqual(stored);
    expect(resolveSplits(draft, ['b', 'a'])).toEqual([{ familyId: 'b', cents: 500 }, { familyId: 'a', cents: 501 }]);
    expect(resolveSplits(draft, ['a', 'b'])).toEqual(stored);
  });
  it('keeps a stored override and carries photo ids', () => {
    const splits = [{ familyId: 'a', cents: 700 }, { familyId: 'b', cents: 301 }];
    const draft = draftFromExpense(row(splits), ['p1', 'p2'], ['a', 'b']);
    expect(draft.splits).toEqual(splits);
    expect(draft.photoIds).toEqual(['p1', 'p2']);
    expect(draft).toMatchObject({ id: 'e1', description: 'x', amountCents: 1001, createdAt: 5 });
  });
});

describe('remapSplitFamilies', () => {
  it('rewrites mapped ids, leaves unmapped ids and null splits alone', () => {
    const drafts = [d({ splits: [{ familyId: 'x', cents: 1 }, { familyId: 'y', cents: 1000 }] }), d({ id: 'e2' })];
    const out = remapSplitFamilies(drafts, new Map([['x', 'a']]));
    expect(out[0].splits).toEqual([{ familyId: 'a', cents: 1 }, { familyId: 'y', cents: 1000 }]);
    expect(out[1].splits).toBeNull();
  });
});

describe('labels', () => {
  it('receiptsLabel', () => {
    expect(receiptsLabel(0)).toBe('No receipts');
    expect(receiptsLabel(1)).toBe('1 receipt');
    expect(receiptsLabel(3)).toBe('3 receipts');
  });
  it('splitLine', () => {
    const names = { a: 'Smith', b: 'Jones' };
    expect(splitLine([{ familyId: 'a', cents: 625 }, { familyId: 'b', cents: 625 }], names)).toBe('Smith $6.25 · Jones $6.25');
    expect(splitLine([{ familyId: 'a', cents: 625 }], names)).toBeNull();
  });
  it('formatExpensesLine and expenseTotal', () => {
    expect(formatExpensesLine(1250)).toBe('Expenses $12.50');
    expect(expenseTotal([{ amountCents: 1 }, { amountCents: 2 }])).toBe(3);
  });
});

describe('canSaveExpense', () => {
  const base = { amountText: '12.50', description: 'Pool entry' };
  it('is true for valid fields', () => expect(canSaveExpense(base)).toBe(true));
  it.each(['', '0', '0.00', 'abc', '1.005'])('is false for amount %j', (amountText) => expect(canSaveExpense({ ...base, amountText })).toBe(false));
  it.each(['', '   '])('is false for description %j', (description) => expect(canSaveExpense({ ...base, description })).toBe(false));
  it('is false while a photo is processing', () => {
    expect(canSaveExpense({ ...base, processing: 1 })).toBe(false);
    expect(canSaveExpense({ ...base, processing: 0 })).toBe(true);
  });
  it('is false while a share caption is showing', () => {
    expect(canSaveExpense({ ...base, shareError: true })).toBe(false);
    expect(canSaveExpense({ ...base, shareError: false })).toBe(true);
  });
});

describe('amountCaption', () => {
  const bad = 'Use dollars and cents, like 12.50.';
  it('stays quiet while blank and untouched', () => expect(amountCaption('', false)).toBeNull());
  it('asks for dollars and cents', () => {
    expect(amountCaption('', true)).toBe(bad);
    expect(amountCaption('abc', false)).toBe(bad);
    expect(amountCaption('1.005', false)).toBe(bad);
  });
  it('rejects zero', () => {
    expect(amountCaption('0', false)).toBe('Amount must be more than $0.00.');
    expect(amountCaption('0.00', true)).toBe('Amount must be more than $0.00.');
  });
  it('is null for a valid amount', () => expect(amountCaption('12.50', true)).toBeNull());
});

describe('expensesFooterText', () => {
  it('reads the saved-with-session line for none and the total otherwise', () => {
    expect(expensesFooterText([])).toBe('Expenses are saved with this session.');
    expect(expensesFooterText([{ amountCents: 1250 }])).toBe('Total $12.50.');
    expect(expensesFooterText([{ amountCents: 1250 }, { amountCents: 5 }])).toBe('Total $12.55.');
    expect(expensesFooterText([{ amountCents: 100000 }])).toBe('Total $1,000.00.');
  });
});

describe('sessionDeleteMessage', () => {
  it('names only what goes, singular at one', () => {
    expect(sessionDeleteMessage({ expenses: 0, photos: 0 })).toBe("This can't be undone.");
    expect(sessionDeleteMessage({ expenses: 1, photos: 0 })).toBe("This also deletes 1 expense. This can't be undone.");
    expect(sessionDeleteMessage({ expenses: 2, photos: 3 })).toBe("This also deletes 2 expenses and 3 receipt photos. This can't be undone.");
    expect(sessionDeleteMessage({ expenses: 2, photos: 1 })).toBe("This also deletes 2 expenses and 1 receipt photo. This can't be undone.");
    expect(sessionDeleteMessage({ expenses: 1, photos: 1 })).toBe("This also deletes 1 expense and 1 receipt photo. This can't be undone.");
  });
});

describe('deleteExpenseMessage', () => {
  it('is absent without photos and counts them otherwise', () => {
    expect(deleteExpenseMessage(0)).toBeUndefined();
    expect(deleteExpenseMessage(1)).toBe('This also deletes 1 receipt photo.');
    expect(deleteExpenseMessage(3)).toBe('This also deletes 3 receipt photos.');
  });
});

describe('expenseEditorDirty', () => {
  it('an untouched odd-cent equal split stored explicitly is not a change', () => {
    const stored = { id: 'e1', description: 'Snacks', amountCents: 1001, splits: [{ familyId: 'f1', cents: 501 }, { familyId: 'f2', cents: 500 }], photoIds: [], createdAt: 1 };
    expect(expenseEditorDirty(stored, '10.01', 'Snacks', null, [])).toBe(false);
    expect(expenseEditorDirty({ ...stored, splits: [{ familyId: 'f1', cents: 700 }, { familyId: 'f2', cents: 301 }] }, '10.01', 'Snacks', null, [])).toBe(true);
  });

  it('a new expense is dirty once anything is typed', () => {
    expect(expenseEditorDirty(null, '', '')).toBe(false);
    expect(expenseEditorDirty(null, '5', '')).toBe(true);
    expect(expenseEditorDirty(null, '', 'Pool')).toBe(true);
  });
  it('an existing draft is dirty only on a real change', () => {
    const draft = d({ amountCents: 1250, description: 'Pool entry' });
    expect(expenseEditorDirty(draft, '12.50', 'Pool entry')).toBe(false);
    expect(expenseEditorDirty(draft, '12.5', '  Pool entry ')).toBe(false);
    expect(expenseEditorDirty(draft, '13', 'Pool entry')).toBe(true);
    expect(expenseEditorDirty(draft, 'abc', 'Pool entry')).toBe(true);
    expect(expenseEditorDirty(draft, '12.50', 'Pool fee')).toBe(true);
  });
  it('compares splits when given', () => {
    const over = [{ familyId: 'A', cents: 700 }, { familyId: 'B', cents: 301 }];
    expect(expenseEditorDirty(d(), '10.01', 'Pool entry', null)).toBe(false);
    expect(expenseEditorDirty(d(), '10.01', 'Pool entry', over)).toBe(true);
    expect(expenseEditorDirty(d({ splits: over }), '10.01', 'Pool entry', over.map((s) => ({ ...s })))).toBe(false);
    expect(expenseEditorDirty(d({ splits: over }), '10.01', 'Pool entry', null)).toBe(true);
  });
  it('compares photo ids in content and order when given', () => {
    const draft = d({ photoIds: ['a', 'b'] });
    expect(expenseEditorDirty(draft, '10.01', 'Pool entry', undefined, ['a', 'b'])).toBe(false);
    expect(expenseEditorDirty(draft, '10.01', 'Pool entry', undefined, ['b', 'a'])).toBe(true);
    expect(expenseEditorDirty(draft, '10.01', 'Pool entry', undefined, ['a'])).toBe(true);
  });
});
