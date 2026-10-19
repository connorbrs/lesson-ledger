---
phase: 03-expenses-receipts
plan: 03
subsystem: ui
tags: [preact, expenses, edit-session, split, vitest]
status: complete

requires:
  - phase: 03-expenses-receipts
    provides: loadExpenseDrafts, updateSession payload, canSaveExpense, resolveSplits, Expense editor and Expenses group (plans 03-01, 03-02)
provides:
  - Edit Session sheet that loads its expenses before rendering, edits/deletes them, and saves them with the session in one transaction
  - Delete Expense and discard alerts inside the Expense editor
  - Counted Delete Session alert (expenses and receipt photos named)
  - Pure two-family split-input rules and the Split group (type one share, the other fills in)
affects: [03-04 photos UI, 03-05 backup, 04 summaries]

actuals:
  tokens: 9000
  tasks: 2
  commits: 5
plan_head_before: 22f2639b9ad2c561320c9aec9c0dbd479459ac2c
commits: 5
plan_head_after: 647a499cce4d49f222384c2c8a77bd533fdd50ce

tech-stack:
  added: []
  patterns:
    - "Loader/body split: the sheet renders nothing until the first live emission is captured in a ref, so the initial form already holds the stored expenses (Pitfall 2)"
    - "Editor alerts are portaled into .app so the pushed layer, sheet and tab bar are inert behind them"
    - "Split state is null (equal default) or {texts, splits, error}; the other share is always total minus the typed one"

key-files:
  created:
    - src/domain/split.ts
    - src/ui/SplitGroup.tsx
    - tests/split.test.ts
  modified:
    - src/domain/expense.ts
    - src/ui/SessionSheet.tsx
    - src/ui/ExpenseEditor.tsx
    - src/ui/App.tsx
    - tests/expense.test.ts

key-decisions:
  - "Any edit to the Amount field resets the split to equal (simple and matches the spec's 'changing the amount resets')"
  - "SplitGroup keeps its own 'left once' flags so a blank untouched share stays quiet, while Save is still disabled by the share error"
  - "The Split group renders only after family names have loaded, avoiding a flash of empty labels"

requirements-completed: [EXP-04, EXP-05]

duration: 12min
completed: 2026-10-19
---

# Phase 3 Plan 3: Edit Session expenses and the Split group Summary

**Edit Session now loads, edits, deletes and saves a session's expenses in one transaction with a counted delete alert, and a two-family swim expense can be split unequally with shares that always sum to the total.**

## Accomplishments

- Task 1: `sessionDeleteMessage`, `deleteExpenseMessage` and `expenseEditorDirty` (pure, tested). `SessionSheet` is now a loader plus `SessionSheetBody`; the form is built from `formFromSession(session, drafts)` so an untouched sheet is not dirty. The Expense editor opens as a pushed layer in the sheet overlay, gains a Delete Expense group (existing expenses) with the "Delete this expense?" alert, and asks "Discard changes to this session?" on Back when `expenseEditorDirty` says so. The Log tab editor also gets `onDelete`.
- Task 2: `src/domain/split.ts` (`equalShareTexts`, `shareTextsFor`, `applyShareInput`, `shareCaption`, `initialShareState`, `splitIsOverridden`) with a property test over totals 0 to 300 ("shares always sum to the total"). `SplitGroup` shows for a two-family swim only, with the Split Equally header action visible only while overridden. The editor gates Save on share errors via `canSaveExpense`, and saved splits are `share?.splits ?? null`.
- Tests: 393 to 415 passing; `npm run build` (tsc + vite) and `node scripts/check-dist.mjs` (14 checks) green.

## Commits

- 170d918 test: failing delete message and dirty-check tests (RED)
- 0c459df feat: Edit Session loads, edits and deletes expenses
- 9b6ec08 test: failing split input tests (RED)
- 67250ad feat: pure split-input rules (GREEN)
- 647a499 feat: Split group in the Expense editor

## Deviations from Plan

None - plan executed as written. `expenseEditorDirty` for a new expense (null initial) additionally treats non-null splits or any photo ids as dirty; the plan's examples all still hold.

## Known Stubs

None. Photos are intentionally an empty map in the save payloads until plan 03-04, as the plan states.

## Threat Flags

None. No new packages or network code; all text renders as JSX text nodes.

## Self-Check: PASSED

src/domain/split.ts, src/ui/SplitGroup.tsx, tests/split.test.ts exist; commits 170d918, 0c459df, 9b6ec08, 67250ad, 647a499 are ancestors of HEAD.
