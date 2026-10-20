---
phase: 04-family-summaries-overview
plan: 03
subsystem: summaries
tags: [preact, dexie, clipboard, vitest, pure-domain]

requires:
  - phase: 04-family-summaries-overview
    provides: summary model, fingerprint and loaders (04-01); periodRecords table and the saveMessage / markSent / unmarkSent writers (04-02)
provides:
  - pure sent-status, status text, action and pill rules (sentStatus and friends)
  - pure message box state (messageView) and the exact message UI copy constants
  - clipboard adapter with an injectable environment
  - Sent group, editable Message group, Rebuild and Discard alerts, Summaries row pills
  - per-period unsaved message drafts held in App state
affects: [04-04, 04-05, 04-06]

actuals:
  tokens: 11000
  tasks: 2
  commits: 2
plan_head_before: a69e4ab0c33e43ce85535c40a1c6f7a11fb6f34e
commits: 2
plan_head_after: d83f202d36fffbfb1cca1359f5b776dba781fe08

tech-stack:
  added: []
  patterns:
    - "Every show/hide/enable rule is a tested pure function in src/domain/summaryState.ts; components only render its output"
    - "Loaders read the period record in the same transaction as the rows, so status and summary are one live result"
    - "Clipboard write is started in the tap handler with text already in hand (no await before it)"

key-files:
  created:
    - src/domain/summaryState.ts
    - src/pwa/clipboard.ts
    - src/ui/SentGroup.tsx
    - src/ui/MessageGroup.tsx
    - tests/summaryState.test.ts
    - tests/clipboard.test.ts
  modified:
    - src/data/summary.ts
    - src/ui/FamilySummary.tsx
    - src/ui/Summaries.tsx
    - src/ui/App.tsx
    - src/ui/styles.css
    - tests/summaryData.test.ts

key-decisions:
  - "Sent status compares fingerprints only; a saved message without a sent mark never produces a pill"
  - "Back asks to discard only when the visible message box is dirty (an empty period has no box, so a leftover draft cannot block Back)"
  - "formatSentAt is built from local getters (formatMonthDay + formatTime12), so no ICU narrow no-break space reaches the screen"

requirements-completed: [SUM-04, SUM-07, SUM-08]

duration: 12min
completed: 2026-10-19
status: complete
---

# Phase 4 Plan 03: Mark as Sent and Editable Saved Message Summary

**A family's period can be marked sent, flagged "Changed since sent" by any parent-visible edit (fingerprint compare), and its Turkish message can be edited, saved, copied, rebuilt and discarded without the app ever overwriting the user's text.**

## Accomplishments

- `summaryState.ts`: `sentStatus`, `formatSentAt`, `statusValueText`, `sentAction`, `statusPill`, `sentFooterText`, `messageView` and all message copy constants, pure and tested (state rules, five message states plus blank / equal / stale-with-draft / rebuilt-equals-saved edges, warnings ignored).
- Loaders `loadFamilyView` and `loadSummaryList` now return `record` read in the same transaction; tests prove edit, travel-only edit, revert and family rename flip `sent` / `changed` through the real storage.
- `SentGroup` (the only UI caller of `markSent` / `unmarkSent`) with a synchronous in-flight guard and the failure footer; Summaries rows show the `Sent` / `Changed since sent` pill before the chevron.
- `MessageGroup`: editable Turkish textarea (maxLength 10,000, grows with text), stale banner with Rebuild Message, Copy Message (adapter started synchronously, 1.5 s "Copied" with a status region, failure caption), Save Message (double-tap guard, "Saved" flash, failure caption).
- `FamilySummary`: Rebuild confirm and Discard alerts as siblings of the pushed layer; Back with a dirty box asks first. `App` holds drafts keyed by record id so they survive period arrows and tab switches; a successful save drops the draft.

## Task Commits

1. Task 1 Sent tracking, loaders, pills: `c14eac3`
2. Task 2 Editable saved message, clipboard adapter, alerts, drafts: `d83f202`

## Verification

- `npm test`: 22 files, 694 tests passed (plan 04-02 ended at 20 files, 660). `TZ=UTC npm test` passes. `TZ=Pacific/Kiritimati npm test -- tests/summaryState.test.ts tests/summaryData.test.ts` passes.
- `npm run build` and `node scripts/check-dist.mjs`: pass (14 checks).
- Acceptance greps: only `SentGroup.tsx` references `markSent` in `src/ui`; `MessageGroup.tsx` has no `markSent` / `unmarkSent`; `SentGroup.tsx` has no `copyText`; no `readOnly` left; no `await` in `clipboard.ts`; no Intl time formatting in `summaryState.ts`; no network calls in `src`; runtime dependencies still exactly dexie and preact.
- Interactive behavior (Copy into Messages, banner, Mark as Sent on the phone) is left to plan 04-06 as the plan states.

## Deviations from Plan

None - plan executed as written.

Notes:
- After a successful Save the draft is cleared before the live query re-emits the new record, so the old stored text or stale banner could flash for a frame on a slow device. Not observed in tests; revisit in the on-device check (04-06) if seen.
- The new copy-failure and save-failure captions share one destructive Label class (`caption-error`); the banner row, Save row and pill styles use existing tokens only.

## Known Stubs

None.

## Threat Flags

None. The only new surface (writing plain text to the system clipboard) is the one the plan's threat model covers (T-04-12).

## Self-Check: PASSED

- Files: summaryState.ts, clipboard.ts, SentGroup.tsx, MessageGroup.tsx, summaryState.test.ts, clipboard.test.ts present.
- Commits `c14eac3` and `d83f202` are ancestors of HEAD.
