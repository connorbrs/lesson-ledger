---
phase: 03-expenses-receipts
plan: 01
subsystem: database
tags: [dexie, indexeddb, money, cents, expenses, vitest]
status: complete

requires:
  - phase: 02-logging-sessions
    provides: sessions table, createSession/updateSession/deleteSession, FormState, sessionRowText
provides:
  - Integer-cents money module (parse, format, equal and override split)
  - Expense domain rules (drafts, share resolution, validation, save/caption/footer predicates)
  - Typed expenses and attachments rows (schema still version 1)
  - Photo-capable expense payload written in the session's single transaction, with cascade delete
  - FormState.expenses with upsertExpense/removeExpense; sessionRowText expenses line
affects: [03-02 Log tab, 03-03 Edit Session and split, 03-04 photos, 03-05 backup, 04 summaries]

actuals:
  tokens: 28000
  tasks: 2
  commits: 5
plan_head_before: 903f6a8a8caaca022139c852c08c7d8439005300
commits: 5
plan_head_after: c8c7f32ffd9957a8558ba3b070f294873a9cb7a3

tech-stack:
  added: []
  patterns:
    - "Expense drafts are JSON-safe (ids, strings, integers) so sameForm detects changes; photo bytes travel separately in ExpensePayload.photos"
    - "Explicit per-family shares stored in cents; families-changed override resets to equal on save"
    - "Data module writes inside the caller's transaction and uses only Dexie calls"

key-files:
  created:
    - src/domain/money.ts
    - src/domain/expense.ts
    - src/data/expenses.ts
    - tests/money.test.ts
    - tests/expense.test.ts
    - tests/expenses.test.ts
  modified:
    - src/domain/types.ts
    - src/domain/session.ts
    - src/domain/sessionForm.ts
    - src/data/db.ts
    - src/data/sessions.ts
    - tests/sessions.test.ts
    - tests/sessionForm.test.ts
    - tests/backup.test.ts

key-decisions:
  - "Amounts parsed with BigInt over the digit strings (no float parsing or rounding); three decimals are rejected, not rounded"
  - "New expense and attachment rows use add, so an id collision aborts the whole transaction"
  - "Unchanged expense rows are not rewritten, so updatedAt only moves on real edits"

requirements-completed: [EXP-01, EXP-04, EXP-05]

duration: 25min
completed: 2026-10-19
---

# Phase 3 Plan 1: Expenses data foundation Summary

**Integer-cents expenses with explicit per-family shares, saved, updated and cascade-deleted inside the session transaction, with photo rows supported from day one.**

## Accomplishments

- Tracer (task 1): form state to validation to Dexie in one transaction, read back as "Expenses $12.50", removed with its session.
- Task 2: update diff (add, edit, remove, photo add/remove, unchanged rows untouched), share reset/reject rules, retained-attendee family remap, draft loading in createdAt order, and the pure `canSaveExpense`, `amountCaption`, `expensesFooterText` predicates.
- Tests: 290 baseline to 393 passing; `npm run build` and `scripts/check-dist.mjs` green.

## Commits

- 70e02d9 test: failing money and tracer tests (RED)
- ee98229 feat: tracer (GREEN)
- 5839227 test: failing task 2 tests (RED)
- 0d87203 feat: update diff, shares, predicates (GREEN)
- c8c7f32 refactor: comment reword so the no-Blob-reading grep gate is clean

## Deviations from Plan

**1. [Rule 3 - Blocking] tests/backup.test.ts type error after typing the tables**
- **Found during:** Task 1 build
- **Issue:** `db[table].add({ id: 'x' })` no longer typechecks now that expenses/attachments rows are typed.
- **Fix:** cast the fake row `as never` (the test only needs a non-empty table to prove the fail-closed backup). Backup behavior is unchanged; plan 03-05 replaces the fail-closed rule.
- **Commit:** ee98229

**2. [Test-only] Removed an invalid table case** in tests/expenses.test.ts: an "override with a wrong sum" case used a family id that differs from the session's, which correctly resets to equal. The same-families wrong-sum rejection is covered by dedicated create and update tests.

No other deviations. TDD followed with separate RED and GREEN commits per task.

## Known Stubs

None.

## Threat Flags

None. No network code, no new runtime packages (dependencies remain dexie and preact).

## Self-Check: PASSED

Files money.ts, expense.ts, expenses.ts and all test files exist; commits 70e02d9, ee98229, 5839227, 0d87203, c8c7f32 are ancestors of HEAD.
