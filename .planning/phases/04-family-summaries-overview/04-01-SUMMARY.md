---
phase: 04-family-summaries-overview
plan: 01
subsystem: summaries
tags: [preact, dexie, intl-tr-TR, vitest, pure-domain]

requires:
  - phase: 03-expenses-receipts
    provides: stored expenses with per-family splits and receipt attachments
provides:
  - whole-minute half credit (D-17)
  - Turkish hours formatter, Turkish date/period labels, ASCII fold
  - pure family summary model (periods, message, warnings, fingerprint, predicates, PDF file name)
  - one-transaction read loaders for the summary input, family view and Summaries list
  - Summaries tab and a read-only Family Summary screen
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

actuals:
  tokens: 16300
  tasks: 3
  commits: 3
plan_head_before: 46c53244185a6da724390f97b1e156f91063affa
commits: 3
plan_head_after: dc105b014134c717b8110711b275ed0815e3616b

tech-stack:
  added: []
  patterns:
    - "One pure computation (buildFamilySummary) feeds message, PDF and totals"
    - "Intl tr-TR with timeZone UTC and formatToParts; no host time zone or clock in domain"
    - "Fingerprint = cyrb53 over canonical nested arrays"

key-files:
  created:
    - src/domain/turkish.ts
    - src/domain/summary.ts
    - src/data/summary.ts
    - src/ui/Summaries.tsx
    - src/ui/FamilySummary.tsx
    - tests/turkish.test.ts
    - tests/summary.test.ts
    - tests/summaryData.test.ts
  modified:
    - src/domain/session.ts
    - src/domain/hours.ts
    - src/domain/types.ts
    - src/ui/components.tsx
    - src/ui/App.tsx
    - src/ui/styles.css

key-decisions:
  - "creditedMinutes half is Math.ceil(minutes / 2), so family lines always add up to totals"
  - "loadFamilyView takes the period start date as its anchor (null = default period); the UI stores that start date"
  - "Warnings carry an id (session or expense id) so they sort deterministically and key list rows"
  - "nav-title gained overflow ellipsis (global, harmless to existing one-line titles) to meet the one-line family name rule"

requirements-completed: [SUM-01, SUM-02, SUM-03, SUM-06, SUM-07]

duration: 12min
completed: 2026-10-19
status: complete
---

# Phase 4 Plan 01: Family Summary Model and Summaries Tab Summary

**One pure family-summary model renders the exact Turkish parent message from rows read in a single transaction, shown on a new Summaries tab with period navigation and warnings.**

## Accomplishments

- Half credit now rounds up to a whole minute everywhere `creditedMinutes` is read (45 gives 23); stored rows are untouched.
- `hoursParts` shared rounding core; `formatHoursTr` matches `formatHours` for every whole minute 0 to 999; `tests/hours.test.ts` unmodified.
- `turkish.ts`: weekday-first dates ("Pzt 12 Eki"), four period label shapes, subject names, ASCII fold.
- `summary.ts`: period keys and strict parse, default period, warnings, fingerprint, privacy-safe per-family model, `renderMessageTr` (UI-SPEC example matches character for character), `screenParts`, `summaryRowSecondLine`, `pdfFileName`.
- `data/summary.ts`: `loadSummaryInput`, `loadFamilyView`, `loadSummaryList` in one read transaction, no Blob content read.
- UI: five-tab bar, Summaries list (empty/loading states), Family Summary push layer (period nav, warnings group, read-only auto-growing Turkish message box).

## Task Commits

1. Task 1 tracer: `32109b8`
2. Task 2 complete model: `009aeb1`
3. Task 3 UI: `dc105b0`

## Verification

- `npm test`: 19 files, 598 tests passed (baseline 16 files, 509).
- `TZ=UTC npm test`: pass. Summary/turkish/data tests also pass under Pacific/Kiritimati and Pacific/Pago_Pago.
- `npm run build` and `node scripts/check-dist.mjs`: pass (14 checks).
- Acceptance greps: no dexie import in `src/domain`, no network calls, runtime dependencies still exactly dexie and preact, no clock or host locale in the pure modules.

## Deviations from Plan

None - plan executed as written. Notes:

- The `.nav-title` ellipsis rule (one-line family name in the nav bar) required a small CSS addition to an existing class; no visible change to other titles.
- TDD commits were squashed per task (tests and implementation in one commit per task) per the plan's one-commit-per-task instruction.

## Known Stubs

None. The message box is intentionally read-only in this plan; plan 04-03 adds editing/Copy/Sent and plan 04-05 adds Share PDF.

## Threat Flags

None. No new network, auth or storage surface; the schema stays at version 1.

## Self-Check: PASSED

- Files created exist (domain, data, ui, tests) and commits 32109b8, 009aeb1, dc105b0 are ancestors of HEAD.
