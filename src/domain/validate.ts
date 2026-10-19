// RED-phase stub: replaced by the real implementation in the GREEN commit.
export class RosterError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
const nope = (): never => {
  throw new Error('not implemented');
};
export const normalizeName = (_raw: unknown): string => nope();
export const codePointLength = (_s: string): number => nope();
export const validateFamilyInput = (_input: unknown): never => nope();
export const validateStudentInput = (_input: unknown): never => nope();
