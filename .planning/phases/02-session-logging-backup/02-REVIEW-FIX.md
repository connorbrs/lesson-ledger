---
phase: 02-session-logging-backup
fixed_at: 2026-10-19T18:33:53Z
review_path: /Users/connorbaris/Desktop/Lesson Ledger App/.planning/phases/02-session-logging-backup/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-19T18:33:53Z
**Source review:** /Users/connorbaris/Desktop/Lesson Ledger App/.planning/phases/02-session-logging-backup/02-REVIEW.md
**Iteration:** 1

**Scope:** CR-01, CR-02, CR-03, WR-03 (as directed). WR-01 and WR-02 and the Info items are recorded below but were not in this run's fix scope.

**Summary:**
- Findings in scope: 4
- Fixed: 4 (each marked "requires human verification", see note below)
- Skipped: 0

**Working location:** Fixes were committed directly on `main` in the main checkout (`/Users/connorbaris/Desktop/Lesson Ledger App`), as the run instructions allowed. The worktree isolation step was not used: `workflow.use_worktrees` is not set in `.planning/config.json`, and a fresh worktree has no `node_modules`, so the project gates (`npm test`, `npm run build`, `check-dist`) could not run there.

## Fixed Issues

### CR-01: Session saved with a stale date after midnight

**Files modified:** `src/ui/Log.tsx`, `src/ui/SessionFields.tsx`, `src/ui/SessionSheet.tsx`, `tests/sessionForm.test.ts`
**Commit:** fe473b3
**Applied fix:** `Log.save()` and `SessionSheet.save()` now call `formToInput(form, todayLocal())` at save time and write that value. The render-time `check` only gates the button. Edit Session needed the same change because picking today in the date input stores `date: null`. `SessionFields` re-renders on `visibilitychange` and `focus`, so the "Today" label refreshes. A regression test checks that a null date resolves to the day passed in.
**Verification:** Tier 1 (re-read), Tier 2 (`tsc --noEmit` clean), 264 tests pass. Rollover and label refresh need an on-device check.
**Status:** fixed: requires human verification

### CR-02: Deleting a family with session history creates an unrestorable backup

**Files modified:** `src/data/families.ts`, `src/domain/roster.ts`, `src/ui/Archived.tsx`, `src/ui/FamilySheet.tsx`, `tests/sessions.test.ts`
**Commit:** 7e04936
**Applied fix:** `deleteFamily` runs inside a transaction that includes `sessions`. It returns `has-history` when any session's attendee or credit references the family (`familyHasSessions`). `hasFamilyHistory` includes the same check, so the Archived "Delete Family" row and the FamilySheet delete row agree with `deleteFamily`. The blocked notes now say "lesson history" for this case instead of "still has students". Tests: the orphaned-history family is refused with `has-history`, and deletes once its session is deleted.
**Verification:** Tier 1, Tier 2 (`tsc` clean), tests pass (including 2 new).
**Status:** fixed: requires human verification

### CR-03: Students of an archived family are logged and cannot be deselected

**Files modified:** `src/data/sessions.ts`, `src/data/students.ts`, `src/ui/Log.tsx`, `src/ui/components.tsx`, `tests/sessions.test.ts`
**Commit:** d5c6f55
**Applied fix:** A shared `attendeeIsEligible` rule requires an active student whose family is active and still the family the session names. `createSession` applies it to every attendee. `updateSession` applies it only to newly added attendees, so retained attendees keep their history. The Log form draws its students from the new `listSessionEligibleStudents()`, so prefill and draft sync both drop students of archived families. The save-error copy now says "student or family".
**Verification:** Tier 1, Tier 2 (`tsc` clean), tests pass (3 new: create rejection, update retained-vs-new, and prefill exclusion).
**Status:** fixed: requires human verification

### WR-03: A future-dated backup silences the reminder

**Files modified:** `src/data/backup.ts`, `tests/backup.test.ts`
**Commit:** f77bf2f
**Applied fix:** `restoreBackup` stores `Math.min(file.createdAt, Date.now())` as the last-backup time, a one-line clamp. The file still restores in full. Chosen over rejecting the file, which would block a legitimate restore from a phone with a wrong clock.
**Verification:** Tier 1, Tier 2 (`tsc` clean), new test restores a file dated 10 days ahead and checks the stored time is between the start of the test and now.
**Status:** fixed: requires human verification

## Resolved Outside This Run

### WR-01: Backup recorded as done after an unverified download fallback

**Status:** resolved by device evidence (not a code change in this run).
Verified on iPhone 14 Pro: Back Up Now opened the share sheet, Save to Files worked, and the restore round trip passed.

### WR-02: Restore wipes receipt tables that the backup refuses to capture

**Status:** deferred to Phase 3 (receipts). This must be fixed before Phase 3 writes expenses or attachments. Today nothing writes `expenses` or `attachments`, so the gap is latent.

## Info Items

IN-01, IN-02, and IN-03 were not in fix scope and are skipped in this run.

## Verification

- Gates run in the main checkout after the last fix (`/Users/connorbaris/Desktop/Lesson Ledger App`, branch `main`):
  - `npm test`: 10 files, 264 tests pass (257 before this run; 7 new tests).
  - `npm run build`: `tsc --noEmit` and `vite build` pass; precache 10 entries.
  - `node scripts/check-dist.mjs`: 14 of 14 checks OK.
- Syntax check (`tsc --noEmit`) ran after each fix; no errors were introduced.
- Each finding was committed separately, with the changed files listed in each commit.
- The working tree is clean except the untracked `.planning/milestone.lock`, which was left alone. Nothing was pushed. REVIEW-FIX.md is not committed.

---

_Fixed: 2026-10-19T18:33:53Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
