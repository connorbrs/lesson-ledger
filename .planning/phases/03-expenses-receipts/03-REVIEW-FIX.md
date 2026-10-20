---
phase: 03-expenses-receipts
fixed_at: 2026-10-19T17:10:00Z
review_path: .planning/phases/03-expenses-receipts/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-10-19
**Source review:** .planning/phases/03-expenses-receipts/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01..WR-05, plus IN-01 as a trivial mapping change)
- Fixed: 5
- Skipped: 1 (WR-04, code fix deferred to the device spike; an explanatory comment was committed)

**Verification:** run inside the isolated review-fix worktree (node_modules cloned from the main checkout): `npm test` 509/509 passed, `npm run build` clean, `node scripts/check-dist.mjs` OK (14 checks). Not reproducible from the worktree after teardown; re-run in the main checkout after the fast-forward.

## Fixed Issues

### WR-01: A restored backup can use `__proto__` as a row id and crash the Sessions tab

**Files modified:** `src/domain/backup.ts`, `src/data/expenses.ts`, `src/data/sessions.ts`, `tests/backup.test.ts`, `tests/expenses.test.ts`
**Commit:** eb8c94e
**Applied fix:** `isId` now requires `^[A-Za-z0-9_-]{1,64}$` and rejects `__proto__`. `expenseTotalsBySession` groups through a `Map` and returns a prototype-less object, and `loadNameMaps` returns prototype-less maps, so ids such as `__proto__` or `constructor` stay plain data even if one reaches storage by another route. Regression tests: totals and name maps with `__proto__`/`constructor` ids; `parseBackup` rejects `__proto__`, a spaced id, an over-long id and an empty id while accepting the same backup under an ordinary id. Both new tests fail without the fix.

### WR-02: Re-picking students in Edit Session silently moves an odd cent between families

**Files modified:** `src/domain/expense.ts`, `tests/expense.test.ts`, `tests/expenses.test.ts`
**Commit:** d0c359a
**Applied fix:** The review's suggestion (compare against the equal split in the "current order") is not computable inside `draftFromExpense`, which runs at load time before any re-pick. Instead, `draftFromExpense` now collapses to `null` only when the equal split is order-free (single family, or both shares identical). An odd-cent two-family split is kept as an explicit override, and `resolveSplits` already maps an override by family id, so re-picking the same families in either order preserves each family's cents. Editing the amount in the expense editor still re-derives the default (the editor opens with its own `initialShareState`). Existing test "gives null splits for the equal default" was narrowed to an even amount. New tests cover the domain and the load-then-re-pick round trip through `updateSession`; both fail without the fix. Logic fix: requires human verification.

### WR-03: `updateSession` makes the expense payload optional, so family changes can leave invalid split rows

**Files modified:** `src/data/sessions.ts`, `tests/expenses.test.ts`
**Commit:** 4b7ac62
**Applied fix:** Took the reviewer's second option. When `payload` is omitted, the stored drafts are loaded inside the same rw transaction and run through `writeSessionExpenses` against the new families, so shares are re-resolved and photos (already stored) are kept. The parameter stays optional because about 15 Phase 2 tests call it without a payload. Regression test: change families without a payload and check that the split is re-derived and the attachment survives; it fails without the fix. Logic fix: requires human verification.

### WR-05: Photos staged for a deleted Log-tab expense stay in memory until the next successful save

**Files modified:** `src/ui/ExpenseEditor.tsx`
**Commit:** 5fea7d2
**Applied fix:** `confirmDelete` now removes the expense's current `photoIds` and any ids removed earlier in this editor (`removedEarlier`) from `props.stage` before calling `onDelete`. Unstaged (stored) ids are no-ops. No automated test: the suite has no DOM or component harness (node environment only).

### IN-01: `expenses-invalid` and `photo-missing` fall through to the "low on storage" message

**Files modified:** `src/ui/components.tsx`
**Commit:** 5dc3f93
**Applied fix:** `sessionSaveErrorMessage` maps both codes to the reviewer's suggested copy. No automated test (UI copy only).

## Skipped Issues

### WR-04: The 50 MP pixel guard runs only after the full bitmap is decoded

**File:** `src/pwa/photos.ts:87-92`
**Reason:** Bounding the decode means switching to `createImageBitmap` with a resize target read from the file header. That changes the decode and EXIF-orientation path, cannot be exercised in the node test environment, and its real ceiling is a device-spike item (D-08). Shipping it untested risks sideways receipts. The reviewer's alternative was taken: a comment now documents that the guard is advisory and `MAX_SOURCE_BYTES` is the real memory gate (commit 0945cff, comment only).
**Original issue:** The 50 MP guard runs after `img.decode()` has produced the full-size bitmap, so it does not protect decode memory.

---

_Fixed: 2026-10-19_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
