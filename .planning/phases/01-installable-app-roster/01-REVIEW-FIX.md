---
phase: 01-installable-app-roster
fixed_at: 2026-10-19T00:23:00Z
review_path: .planning/phases/01-installable-app-roster/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-19
**Source review:** .planning/phases/01-installable-app-roster/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, WR-01..WR-06; Info skipped by scope)
- Fixed: 7
- Skipped: 0

**Verification location:** all gates ran in the main checkout (branch `main`), not an isolated worktree. `workflow.use_worktrees` is not set to false, but a hand-rolled worktree has no `node_modules`, and the caller asked for direct commits on `main`. After the last fix: `npm test` (84 tests passed), `npm run build` (tsc and vite build) and `node scripts/check-dist.mjs` (14 checks OK) all passed.

## Fixed Issues

### CR-01: Restoring a student whose family is archived makes the student disappear from every screen

**Files modified:** `src/data/students.ts`, `src/ui/Archived.tsx`, `src/ui/styles.css`, `tests/roster.test.ts`
**Commit:** c0a4905
**Applied fix:** Chose the simpler option (refuse, do not cascade). `restoreStudent` now throws `RosterError('family-missing')` inside its transaction when the parent family is archived or missing. The Archived screen shows the family name under each archived student, and disables "Restore Student" with the caption "Restore the family first" while the family is archived (this also covers IN-02). Test added: archive student, archive family, restore is rejected; after restoring the family, the student restores.

### WR-01: `updateStudent` silently resets `defaultSubject` and wipes `notes` when those fields are omitted

**Files modified:** `src/data/students.ts`, `tests/roster.test.ts`
**Commit:** f3eff44
**Applied fix:** `updateStudent` now takes `Partial<StudentInput>`. Inside the transaction, omitted fields fall back to the stored values before validation. Existing call sites pass all fields and behave as before. Test added: updating only `name` keeps subject, notes and family, and an invalid name is still rejected.

### WR-02: `deleteStudent` history guard fails open on a shape contract that nothing enforces

**Files modified:** `src/data/db.ts`, `src/data/students.ts`, `tests/roster.test.ts`
**Commit:** fb7393e
**Applied fix:** Added a minimal `SessionRow` type (`attendees: { studentId: string }[]`) and typed the `sessions` table with it, so renaming the field breaks the build. No new schema or index was added. `hasAttendee` now fails closed: a row whose `attendees` is not an array counts as history. The existing test dropped its `as never` cast; a new test shows a session with an unrecognised shape blocks the delete. Phase 2 still has to extend `SessionRow` and may add the indexed query then.

### WR-03: Update flow can hang forever in "Updating App…" with no way out

**Files modified:** `src/pwa/useAppUpdate.ts`
**Commit:** b82c99b
**Applied fix:** Added an 8 second watchdog. If no reload follows `updateServiceWorker(true)`, it sets `failed` and clears `applying`. The `catch` path clears the timer. "Not Now" is already shown whenever `applying` is false, so it returns after a failure. The existing import-boundary test still passes. Status: fixed, requires human verification on device (timer and reload behaviour cannot be exercised by the unit tests).

### WR-04: Failures are swallowed or mislabelled in several UI paths

**Files modified:** `src/ui/Archived.tsx`, `src/ui/FamilySheet.tsx`, `src/ui/StudentSheet.tsx`, `src/ui/components.tsx`, `src/ui/App.tsx`
**Commit:** 9ebe1f7
**Applied fix:** Archived shows a shared "Couldn't restore" alert line when a restore fails. Added `saveErrorMessage(e)` in `components.tsx`, which gives specific copy for `family-missing` and `not-found` and keeps the storage wording for other errors. Both sheets now keep `saveError: string | null` instead of a boolean. The app error boundary logs the caught error with `console.error` so non-database bugs are diagnosable; its on-screen copy is unchanged.

### WR-05: `useLive` keeps showing the previous query result after `deps` change

**Files modified:** `src/data/live.ts`, `src/ui/StudentSheet.tsx`
**Commit:** 6b27d1d
**Applied fix:** `useLive` now clears `value` and `error` when `deps` change. To keep the family picker list from blanking during its close animation, `StudentSheet` was split into two queries: the active family list (no deps) and the chosen family (deps `[familyId]`). Status: fixed, requires human verification of the family picker flow on device (no DOM test environment exists in this project).

### WR-06: Underlying content is not hidden from assistive tech behind sheets, pushed screens and alerts

**Files modified:** `src/ui/components.tsx`
**Commit:** 49f1c1b
**Applied fix:** Added a `useInertBehind` hook used by `Sheet`, `PushLayer` and `Alert`. While mounted, each marks its sibling elements `inert` and restores them on unmount. `PushLayer` leaves `.tab-bar` usable because the tab bar sits above pushed screens and stays interactive. `Alert` moves focus to its first button (the least destructive one in both alerts) and returns focus to the opener on close. Status: fixed, requires human verification with VoiceOver on device.

---

_Fixed: 2026-10-19_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
