import { describe, expect, it } from 'vitest';
import {
  RosterError,
  codePointLength,
  normalizeName,
  validateFamilyInput,
  validateStudentInput,
} from '../src/domain/validate';

const ok = (name: unknown, period: unknown = 'weekly') => validateFamilyInput({ name, period });

describe('normalizeName', () => {
  it('turns non-strings into the empty string', () => {
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(42)).toBe('');
  });

  it('trims and composes to NFC', () => {
    expect(normalizeName('  Test Family A  ')).toBe('Test Family A');
    expect(normalizeName('é')).toBe('é');
  });
});

describe('codePointLength', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(codePointLength('abc')).toBe(3);
    expect(codePointLength('\u{1F600}'.repeat(60))).toBe(60);
  });
});

describe('validateFamilyInput name rules', () => {
  it.each([undefined, null, '', '   ', 7])('rejects %j with name-empty', (name) => {
    expect(ok(name)).toEqual({ ok: false, code: 'name-empty' });
  });

  it('accepts a 60 code point name', () => {
    const r = ok('a'.repeat(60));
    expect(r.ok).toBe(true);
  });

  it('accepts 60 emoji (120 UTF-16 units) and rejects 61 with name-too-long', () => {
    expect(ok('\u{1F600}'.repeat(60)).ok).toBe(true);
    expect(ok('\u{1F600}'.repeat(61))).toEqual({ ok: false, code: 'name-too-long' });
  });

  it('rejects 61 plain characters with name-too-long', () => {
    expect(ok('a'.repeat(61))).toEqual({ ok: false, code: 'name-too-long' });
  });

  it('stores a decomposed e plus U+0301 equal to the composed U+00E9', () => {
    const r = ok('é');
    expect(r).toEqual({ ok: true, value: { name: 'é', period: 'weekly' } });
  });

  it('trims a leading and trailing space', () => {
    expect(ok(' Test Family A ')).toEqual({ ok: true, value: { name: 'Test Family A', period: 'weekly' } });
  });

  it('counts length after trimming', () => {
    expect(ok(`  ${'a'.repeat(60)}  `).ok).toBe(true);
  });
});

describe('validateFamilyInput period rules', () => {
  it.each([undefined, '', 'daily', null, 'Weekly'])('rejects period %j with period-invalid', (period) => {
    expect(ok('Test Family A', period)).toEqual({ ok: false, code: 'period-invalid' });
  });

  it.each(['weekly', 'monthly'])('accepts %s', (period) => {
    expect(ok('Test Family A', period)).toEqual({ ok: true, value: { name: 'Test Family A', period } });
  });
});

describe('validateStudentInput', () => {
  const base = { familyId: 'fam-1', name: 'Test Student A', defaultSubject: 'both', notes: '' };

  it('accepts a complete input and normalizes the name', () => {
    expect(validateStudentInput({ ...base, name: '  Test Student A ' })).toEqual({ ok: true, value: base });
  });

  it.each([undefined, null, '', '   '])('rejects name %j with name-empty', (name) => {
    expect(validateStudentInput({ ...base, name })).toEqual({ ok: false, code: 'name-empty' });
  });

  it('rejects 61 code points with name-too-long and accepts 60 emoji', () => {
    expect(validateStudentInput({ ...base, name: 'a'.repeat(61) })).toEqual({ ok: false, code: 'name-too-long' });
    expect(validateStudentInput({ ...base, name: '\u{1F600}'.repeat(60) }).ok).toBe(true);
  });

  it.each([undefined, null, ''])('rejects familyId %j with family-missing', (familyId) => {
    expect(validateStudentInput({ ...base, familyId })).toEqual({ ok: false, code: 'family-missing' });
  });

  it.each([undefined, '', 'history', 'Swim'])('rejects defaultSubject %j with subject-invalid', (defaultSubject) => {
    expect(validateStudentInput({ ...base, defaultSubject })).toEqual({ ok: false, code: 'subject-invalid' });
  });

  it.each(['swim', 'math', 'both'])('accepts defaultSubject %s', (defaultSubject) => {
    expect(validateStudentInput({ ...base, defaultSubject }).ok).toBe(true);
  });

  it('defaults notes to empty and stores very long multi-line notes as given', () => {
    expect(validateStudentInput({ ...base, notes: undefined })).toEqual({ ok: true, value: { ...base, notes: '' } });
    const long = 'line one\n'.repeat(5000);
    expect(validateStudentInput({ ...base, notes: long })).toEqual({ ok: true, value: { ...base, notes: long } });
  });
});

describe('RosterError', () => {
  it('carries the code and uses it as the message', () => {
    const e = new RosterError('name-empty');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('name-empty');
    expect(e.message).toBe('name-empty');
  });
});
