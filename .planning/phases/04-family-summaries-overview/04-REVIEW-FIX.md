---
phase: 04-family-summaries-overview
fixed_at: 2026-10-19T00:00:00Z
review_path: .planning/phases/04-family-summaries-overview/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Source review:** .planning/phases/04-family-summaries-overview/04-REVIEW.md
**Scope:** critical_warning (CR-01, WR-01, WR-02, WR-03). Info findings were out of scope.
**Verification ran in:** the main checkout (no worktree). Gate: `npm test && TZ=UTC npm test && npm run build && node scripts/check-dist.mjs`, green (771 tests, 15 dist checks).

## Fixed Issues

### CR-01: Message drafts carry no fingerprint (fixed: requires human verification, logic change)

**Files modified:** `src/domain/summaryState.ts`, `src/ui/MessageGroup.tsx`, `src/ui/FamilySummary.tsx`, `tests/summaryState.test.ts`
**Commit:** bf38ad4
**Applied fix:** `MessageDraft` gains `basedOn` (the fingerprint the text was written against). `messageView.stale` is now `draft.basedOn !== fingerprint` when a draft exists, else the saved message's fingerprint check. New pure `draftBasis` picks the basis for a first edit (the saved message's fingerprint, else the current one; an edit in progress keeps its own). Save stores `draft.basedOn`, so stale text is never re-stamped as current. Rebuild sets `basedOn` to the current fingerprint. Tests cover both flows from the review.

### WR-01: Fingerprint omits student names the PDF prints

**Files modified:** `src/domain/summary.ts`, `tests/summary.test.ts`
**Commit:** 3bb39e5
**Applied fix:** `fingerprintOf` now includes each session's student names as printed (this family's attendees only). A rename flags "Changed since sent" and invalidates the pre-built PDF key. The old "does not change for a student rename" test was inverted. Renaming a student who is not in the family's sessions still does not change it. Note: fingerprints stored before this change will read as changed/stale once.

### WR-02: Superseded PDF builds are never aborted

**Files modified:** `src/pdf/summaryPdf.ts`, `src/ui/useSummaryPdf.ts`, `src/domain/pdfContent.ts`, `src/domain/serial.ts` (new), `tests/summaryPdf.test.ts`, `tests/serial.test.ts` (new)
**Commit:** 423dabb
**Applied fix:** `buildSummaryPdf` takes `isCancelled` and checks it at the start and before each receipt read, throwing `PdfBuildError('cancelled')`. Builds run through a module-level serial runner (`createSerialRunner`), so only one build loads receipts at a time, and a build superseded while queued never starts. The effect already ignores results and errors from cancelled builds. The 60 MB cap was left unchanged (needs device measurement).

### WR-03: Every period step unmounts the Family Summary screen

**Files modified:** `src/ui/FamilySummary.tsx`
**Commit:** 404fa24
**Applied fix:** The screen keeps the last loaded view in a ref and renders it while `useLive` reloads for the new period. It returns null only before the first load, and still closes when the family is gone (`live === null`). No automated test (UI behaviour, not a pure predicate). Known trade-off: two very fast taps on a period arrow before the next period loads both step from the previous period.

## Skipped Issues

None.

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
