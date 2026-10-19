export type Period = 'weekly' | 'monthly';
export type DefaultSubject = 'swim' | 'math' | 'both';

export const NAME_MAX = 60;

export interface Family {
  id: string;
  name: string;
  period: Period;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Student {
  id: string;
  familyId: string;
  name: string;
  defaultSubject: DefaultSubject; // D-06
  notes: string; // D-07: free text, never shown on summaries
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
