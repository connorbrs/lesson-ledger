---
phase: 03-expenses-receipts
plan: 02
subsystem: ui
tags: [preact, expenses, log-tab, sessions-tab]
status: complete

requires:
  - phase: 03-expenses-receipts
    provides: expense domain predicates, createSession payload, expenseTotalsBySession, FormState.expenses (plan 03-01)
provides:
  - Expenses group in the shared session form (Log tab)
  - Pushed Expense editor (Amount, Description, Save) staging drafts in the form
  - Log Session saving staged expenses with the session in one transaction
  - "Expenses $12.50" line on Sessions rows
affects: [03-03 Edit Session and split, 03-04 photos UI, 03-05 backup]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: aaa4011480f1a54ded85f76d88f30586e770ac7d
commits: 2
plan_head_after: c5c9aacbec87458eba838b966967b69dc0da04ea

tech-stack:
  added: []
  patterns:
    - "Pushed editor mounted at App level beside the Student picker; Save stages into FormState via upsertExpense"
    - "All gating and copy comes from tested pure predicates (canSaveExpense, amountCaption, expensesFooterText)"

key-files:
  created:
    - src/ui/ExpensesGroup.tsx
    - src/ui/ExpenseEditor.tsx
  modified:
    - src/ui/components.tsx
    - src/ui/SessionFields.tsx
    - src/ui/Log.tsx
    - src/ui/App.tsx
    - src/ui/Sessions.tsx
    - src/ui/styles.css

key-decisions:
  - "SessionFields renders the Expenses group only when onOpenExpense is provided, so the Edit Session sheet is unchanged until plan 03-03"
  - "InputRow gained a wideLabel flag (96px label column) rather than a new row component"

requirements-completed: [EXP-01]

duration: 10min
completed: 2026-10-19
---

# Phase 3 Plan 2: Expenses on the Log tab Summary

**Add an expense from the Log tab through a pushed editor, log it with the session in one transaction, and see "Expenses $12.50" on the Sessions row.**

## Accomplishments

- Task 1: AmountField and InputRow options (maxLength, autoCapitalize, wideLabel); ExpensesGroup (clamped description, receipts label, two-family split line, fixed-width amount column, Add Expense, footer from expensesFooterText); ExpenseEditor (Save gated by canSaveExpense, caption from amountCaption after first blur, ref re-entry guard, split kept only when amount unchanged); Log passes draft.expenses to createSession; App mounts the editor, closes it on tab change.
- Task 2: Sessions period live query reads expenseTotalsBySession and renders the third line only when the session has expenses.
- Verification: 393 tests pass, `npm run build` (tsc + vite) and `node scripts/check-dist.mjs` (14 checks) green; "Add Expense" present in the built bundle; no innerHTML sinks.

## Commits

- c81e56b feat(03-02): Expenses group, Expense editor and Log wiring
- c5c9aac feat(03-02): Expenses line on Sessions rows

## Deviations from Plan

None - plan executed exactly as written. No new tests: the plan specifies there is no DOM environment and the behavior lives in plan 03-01's tested predicates. The on-device flow check belongs to plan 03-05.

## Known Stubs

None.

## Threat Flags

None. Descriptions render only as JSX text nodes; no new packages or network code.

## Self-Check: PASSED

ExpensesGroup.tsx and ExpenseEditor.tsx exist; commits c81e56b and c5c9aac are ancestors of HEAD.
