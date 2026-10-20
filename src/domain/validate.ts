import { NAME_MAX, type DefaultSubject, type Period } from './types';

export type RosterErrorCode =
  | 'name-empty'
  | 'name-too-long'
  | 'period-invalid'
  | 'subject-invalid'
  | 'family-missing'
  | 'not-found';

export class RosterError extends Error {
  readonly code: RosterErrorCode;
  constructor(code: RosterErrorCode) {
    super(code);
    this.name = 'RosterError';
    this.code = code;
  }
}

/** Any non-string becomes empty; strings are trimmed and composed to NFC. */
export function normalizeName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().normalize('NFC') : '';
}

/** Length in Unicode code points (an emoji counts as 1, not 2). */
export function codePointLength(s: string): number {
  return [...s].length;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; code: RosterErrorCode };

function checkName(raw: unknown): { ok: true; name: string } | { ok: false; code: RosterErrorCode } {
  const name = normalizeName(raw);
  if (name === '') return { ok: false, code: 'name-empty' };
  if (codePointLength(name) > NAME_MAX) return { ok: false, code: 'name-too-long' };
  return { ok: true, name };
}

const isPeriod = (v: unknown): v is Period => v === 'weekly' || v === 'monthly';
const isSubject = (v: unknown): v is DefaultSubject => v === 'swim' || v === 'math' || v === 'both';

export function validateFamilyInput(input: { name?: unknown; period?: unknown }): Validated<{ name: string; period: Period }> {
  const n = checkName(input.name);
  if (!n.ok) return n;
  if (!isPeriod(input.period)) return { ok: false, code: 'period-invalid' };
  return { ok: true, value: { name: n.name, period: input.period } };
}

export function validateStudentInput(input: {
  familyId?: unknown;
  name?: unknown;
  defaultSubject?: unknown;
  notes?: unknown;
}): Validated<{ familyId: string; name: string; defaultSubject: DefaultSubject; notes: string }> {
  const n = checkName(input.name);
  if (!n.ok) return n;
  if (typeof input.familyId !== 'string' || input.familyId === '') return { ok: false, code: 'family-missing' };
  if (!isSubject(input.defaultSubject)) return { ok: false, code: 'subject-invalid' };
  // D-07: notes are free text with no length cap.
  const notes = typeof input.notes === 'string' ? input.notes : '';
  return { ok: true, value: { familyId: input.familyId, name: n.name, defaultSubject: input.defaultSubject, notes } };
}

/** D-10: the instructor name. Trimmed, NFC, at most NAME_MAX code points; a blank value is allowed and means "no name". */
export function validateInstructorName(raw: unknown): Validated<string | null> {
  const name = normalizeName(raw);
  if (name === '') return { ok: true, value: null };
  if (codePointLength(name) > NAME_MAX) return { ok: false, code: 'name-too-long' };
  return { ok: true, value: name };
}
