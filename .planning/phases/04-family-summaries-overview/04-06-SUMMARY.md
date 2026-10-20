---
phase: 04-family-summaries-overview
plan: 06
subsystem: ui
tags: [personal-totals, sessions-tab, dexie, vitest, device-check]

requires:
  - phase: 04-family-summaries-overview
    provides: credit math (creditedMinutes, D-17), formatHours, summary model and Turkish outputs (04-01 to 04-05)
provides:
  - computeViewTotals: period totals plus Student, Family and Subject breakdowns (pure)
  - loadViewTotals: one read transaction over sessions, students and families
  - PersonalTotals section on the Sessions tab
  - regression test that travel never reaches the message, PDF cells or PDF totals
affects: []

actuals:
  tokens: 4600
  tasks: 2
  commits: 2
plan_head_before: 64a70d7c03465ace5e78163e6a06d07eacadbae6
commits: 2
plan_head_after: 82c319f642c6969aa6e625b1e8d5263ddc964ee9

tech-stack:
  added: []
  patterns:
    - "Texts and the show/hide rule for the totals section live in the pure module and are tested; the component only renders them"
    - "Totals section keyed by the visible range so the existing Sessions list code is untouched"

key-files:
  created:
    - src/domain/viewTotals.ts
    - src/data/viewTotals.ts
    - src/ui/PersonalTotals.tsx
    - tests/viewTotals.test.ts
  modified:
    - src/ui/Sessions.tsx
    - src/ui/styles.css

key-decisions:
  - "Student rows use the credit of the attendee's snapshotted familyId; a missing credit counts as full"
  - "Family rows count a family once per session even when siblings attend; student rows each show the family's credited time"

requirements-completed: [VIEW-01, VIEW-02]

duration: 15min
completed: 2026-10-19
status: complete
device_check: deferred-by-user
---

# Phase 4 Plan 6: Personal Totals and Device Check Summary

**Instructor's own Lesson, Activity and Travel totals on the Sessions tab, broken down by student, family and subject from one pure function; the iPhone device check was deferred by the user and is NOT passed.**

## Accomplishments

- `computeViewTotals`: totals and Subject rows are actual minutes counted once per session; Family and Student rows use credited whole minutes (D-17) and the full travel of every attended session. Rows sort by name (case-insensitive, numeric-aware), ties by id; archived flagged.
- `loadViewTotals(start, end)`: one read transaction, inclusive range, archived students and families kept with their history.
- `PersonalTotals` renders the Totals group, the Student | Family | Subject control and the rows between the period controls and the date groups; hidden for an empty period.
- Travel regression (T-04-24): 13 travel minutes appear in personal totals and in none of `renderMessageTr`, `sessionRowCells` or `pdfTotalsLines`.

## Verification

- `npm test`: 761 tests in 26 files pass (13 new); `TZ=UTC npm test` passes; `TZ=Pacific/Kiritimati` passes for tests/viewTotals.test.ts.
- `npm run build` and `node scripts/check-dist.mjs` (15 checks) pass. Runtime dependencies are still dexie, jspdf, preact.

## Task Commits

1. Task 1 domain, loader, tests: 60bc903
2. Task 2 Sessions tab section: 82c319f
3. Task 3 device check: no commit (deferred)

## Task 3: Device check — DEFERRED BY USER (not passed)

The user said (in chat) to do the device checks on the next phase. Nothing was run on the iPhone and none of the checks below is approved. The three device backstop truths (five-tab label fit, 30+ receipt PDF memory, share sheet / Turkish glyphs) remain OPEN, and ROADMAP device spike risks R-share and R-memory are unresolved. Pending human verification, in the home-screen app on the iPhone 14 Pro, using throwaway families "Test Smith" and "Test Jones":

0. Push main, wait for the GitHub Pages deploy, update the app (Settings, About, Build).
1. Settings, Back Up Now, Save to Files (clean-up file for step 15).
2. Five tabs visible, "Summaries" fits; also try Display Zoom / Larger Text.
3. Instructor name: set "Connor B.", clear ("Not set"), set again.
4. Create last full week's data: Smith swim 45+15 with "Pool entry" 18.75 and a photo, Smith math 60, shared swim 45 with Jones half lesson, 20 travel, expense 10.01 with no photo.
5. Summaries: Smith message and "Check before sending" list; Jones lesson reads 0,38 saat (0:23); no travel anywhere.
6. Copy Message and paste into Messages; letters, line breaks and both dashes intact.
7. Edit and Save message; reopen; edit again, Back asks to discard.
8. Change a session's lesson minutes: stale banner; Rebuild Message, confirm, Save.
9. Mark as Sent / Not Sent / Sent; change only travel: "Changed since sent" and "Mark as Sent Again".
10. Share PDF: share sheet (not download), send to Messages and Mail, PDF header, tables, receipt page, footer, and ş ğ ı İ ü ç ö render as real letters.
11. Airplane mode, force-quit, relaunch, Share PDF still works.
12. Jones Monthly with about 30+ receipt photos: note "Preparing PDF…" time, no reload/blank, Share works, page count and file size, any failure wording.
13. Backup round trip (version 3): changes restore (instructor name, saved message, Sent status).
14. Sessions tab, Week: Totals group (travel includes 20), Student/Family/Subject views, Jones family row 0.38 h (0:23), family rows add up to more than Totals, empty week shows no section.
15. Restore the step 1 file.

## Deviations from Plan

None to the code plan. Tests and implementation for Task 1 were written together, so the RED run was not observed separately. Task 3 was not executed because the user deferred it.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or storage surface.

## Self-Check: PASSED

Files src/domain/viewTotals.ts, src/data/viewTotals.ts, src/ui/PersonalTotals.tsx, tests/viewTotals.test.ts exist; commits 60bc903 and 82c319f are on main.
