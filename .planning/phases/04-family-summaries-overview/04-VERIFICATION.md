---
phase: 04-family-summaries-overview
verified: 2026-10-19T22:50:00Z
status: human_needed
score: 11/12 must-haves verified (1 present but behavior unverified, 0 failed)
covered_files:
  - ".planning/phases/04-family-summaries-overview/04-01-PLAN.md"
  - ".planning/phases/04-family-summaries-overview/04-01-SUMMARY.md"
  - ".planning/phases/04-family-summaries-overview/04-02-PLAN.md"
  - ".planning/phases/04-family-summaries-overview/04-02-SUMMARY.md"
  - ".planning/phases/04-family-summaries-overview/04-03-PLAN.md"
  - ".planning/phases/04-family-summaries-overview/04-03-SUMMARY.md"
  - ".planning/phases/04-family-summaries-overview/04-04-PLAN.md"
  - ".planning/phases/04-family-summaries-overview/04-04-SUMMARY.md"
  - ".planning/phases/04-family-summaries-overview/04-05-PLAN.md"
  - ".planning/phases/04-family-summaries-overview/04-05-SUMMARY.md"
  - ".planning/phases/04-family-summaries-overview/04-06-PLAN.md"
  - ".planning/phases/04-family-summaries-overview/04-06-SUMMARY.md"
  - "package-lock.json"
  - "package.json"
  - "scripts/check-dist.mjs"
  - "scripts/make-font-module.mjs"
  - "src/data/backup.ts"
  - "src/data/db.ts"
  - "src/data/families.ts"
  - "src/data/instructor.ts"
  - "src/data/periodRecords.ts"
  - "src/data/receipts.ts"
  - "src/data/summary.ts"
  - "src/data/viewTotals.ts"
  - "src/domain/backup.ts"
  - "src/domain/hours.ts"
  - "src/domain/pdfContent.ts"
  - "src/domain/periodRecord.ts"
  - "src/domain/serial.ts"
  - "src/domain/session.ts"
  - "src/domain/summary.ts"
  - "src/domain/summaryState.ts"
  - "src/domain/turkish.ts"
  - "src/domain/types.ts"
  - "src/domain/validate.ts"
  - "src/domain/viewTotals.ts"
  - "src/pdf/fonts/NotoSans-Bold.ts"
  - "src/pdf/fonts/NotoSans-Regular.ts"
  - "src/pdf/fonts/OFL.txt"
  - "src/pdf/summaryPdf.ts"
  - "src/pwa/clipboard.ts"
  - "src/ui/App.tsx"
  - "src/ui/BackupGroup.tsx"
  - "src/ui/FamilySummary.tsx"
  - "src/ui/InstructorSheet.tsx"
  - "src/ui/MessageGroup.tsx"
  - "src/ui/PersonalTotals.tsx"
  - "src/ui/SentGroup.tsx"
  - "src/ui/Sessions.tsx"
  - "src/ui/Settings.tsx"
  - "src/ui/ShareFooter.tsx"
  - "src/ui/Summaries.tsx"
  - "src/ui/components.tsx"
  - "src/ui/styles.css"
  - "src/ui/useSummaryPdf.ts"
  - "tests/backup.test.ts"
  - "tests/clipboard.test.ts"
  - "tests/fixtures/jpeg.ts"
  - "tests/fixtures/pdfSummary.ts"
  - "tests/fixtures/pdfText.ts"
  - "tests/node-shim.d.ts"
  - "tests/pdfContent.test.ts"
  - "tests/periodRecords.test.ts"
  - "tests/receipts.test.ts"
  - "tests/serial.test.ts"
  - "tests/sessions.test.ts"
  - "tests/summary.test.ts"
  - "tests/summaryData.test.ts"
  - "tests/summaryPdf.test.ts"
  - "tests/summaryState.test.ts"
  - "tests/tracer.test.ts"
  - "tests/turkish.test.ts"
  - "tests/validation.test.ts"
  - "tests/viewTotals.test.ts"
  - "vite.config.ts"
covered_digest: "v3:sha256:9aa3695a6083d294d891361bf8ffa714034ecb371608fed68c3f415e346b54ec"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "SUM-05 / ROADMAP SC3: Share PDF opens the iOS share sheet with the PDF attached; where files cannot be shared it downloads instead"
    test: "On the iPhone 14 Pro home-screen app, open a Family Summary with sessions, tap Share PDF, send to Messages and Mail, then open the share sheet again and cancel it"
    expected: "The share sheet opens (not a download) with the PDF attached; Messages and Mail receive it with Turkish letters intact; cancel changes nothing and downloads nothing"
    why_human: "navigator.share and canShare exist only in iOS Safari. No test exercises the sheet; the code path is only proven up to the injected share call (tests/share.test.ts)"
human_verification:
  - test: "Share PDF on the iPhone (see behavior_unverified_items)"
    expected: "Share sheet opens with the PDF; Messages and Mail receive it; cancel does nothing"
    why_human: "iOS share sheet is device-only"
  - test: "Turkish glyphs in the PDF on the iPhone: ş ğ ı İ Ş Ğ ç ö ü, en dash and em dash, in the header, rows and receipt captions"
    expected: "Real letters and dashes, no underscores, no digit substitutions, no empty boxes"
    why_human: "Embedded font cmap contains every needed codepoint and tests/summaryPdf.test.ts checks the drawn text, but on-device rendering is unverified (04-06 Task 3 step 10)"
  - test: "Monthly PDF with 30 or more receipt photos on the iPhone 14 Pro (create Test Jones, about 30 photos)"
    expected: "Preparing PDF finishes; Share works; the app does not reload or go blank; note build time, page count and file size; check the 60 MB cap (MAX_PDF_PHOTO_BYTES) against real photos"
    why_human: "Memory behavior on an older iPhone is device-only (04-04 and 04-06 backstop truths)"
  - test: "Five-tab bar on the iPhone 14 Pro, plus Display Zoom or Larger Text (320 px equivalent): the Summaries label"
    expected: "Summaries fits its tab without truncation at both sizes"
    why_human: "Layout at device widths (04-06 backstop truth)"
  - test: "Copy Message, then paste into Messages"
    expected: "Pasted text matches the box exactly, including line breaks and both dashes; Copy works on a real tap"
    why_human: "Clipboard behavior in iOS Safari is device-only (SUM-04)"
  - test: "Airplane mode: force-quit and relaunch the home-screen app, open a Family Summary, Share PDF"
    expected: "Summary and PDF build and share without network"
    why_human: "Offline behavior on device; code makes no network call and check-dist C15 confirms the PDF chunk is precached"
  - test: "Message flows on the device (CR-01 fix): edit and Save; change a session's lesson minutes; banner shows; Rebuild Message with confirm; Back with unsaved edits asks to discard"
    expected: "Banner appears only when hours changed after the message basis; Save stores the basis fingerprint; Rebuild and discard behave as the dialogs say"
    why_human: "Draft lifecycle across tabs and periods is covered by pure tests but not by an end-to-end UI run"
  - test: "Mark as Sent, then edit a session in that period, then revert it; check the Summaries row pill and the Family Summary Status row"
    expected: "Sent, then Changed since sent (row and summary), then Sent again after the revert"
    why_human: "End-to-end UI flow; the data behavior is covered by tests/summaryData.test.ts"
  - test: "Backup v3 round trip on the iPhone (04-06 steps 13 and 15): instructor name, saved message and Sent status survive backup and restore"
    expected: "Restored values match; restoring the step-1 file works"
    why_human: "Real file save and restore on the phone"
  - test: "Step through the period arrows on a Family Summary several times"
    expected: "The screen stays up with no replayed slide-in animation and no flicker (WR-03 fix has no automated test)"
    why_human: "UI rendering behavior"
  - test: "Sessions tab, Week view: Totals group (travel includes 20 minutes), Student, Family and Subject breakdowns, empty week hides the section"
    expected: "Totals match the logged sessions; Jones family row reads 0.38 h (0:23) for half credit on a 45-minute shared swim"
    why_human: "Visual check of the breakdown control and rows on device"
  - test: "Decision W1 (not a device check): accept that the on-screen summary shows expenses as one total line (D-07) and Turkish hour format (D-02) as meeting ROADMAP SC1, SUM-02 and SUM-03, or request itemized expenses and the English format on screen"
    expected: "A recorded decision"
    why_human: "Requirement wording versus locked context decisions"
  - test: "Decision W2 (not a device check): fix 04-REVIEW IN-01 now (a sent mark on a period whose sessions are all deleted or moved cannot be unmarked) or accept it"
    expected: "A recorded decision"
    why_human: "Edge case left unfixed by the review fix round"
re_verification: null
---

# Phase 4: Family Summaries & Overview Verification Report

**Phase Goal:** As a private instructor, I want to send families correct summaries and see my own totals, so that billing and my records are right.
**Verified:** 2026-10-19
**Status:** human_needed
**Re-verification:** No (initial verification)

## Verdict

No must-have FAILED. No BLOCKER. The codebase delivers every ROADMAP success criterion and all ten requirement IDs. The status is `human_needed` because of (a) the device-only checks the user deferred (04-06 Task 3, not run), and (b) two WARNING decisions for the user (W1, W2). The phase goal is achieved in code; it is not yet proven on the iPhone.

## Goal Achievement

Truths come from the ROADMAP Phase 4 success criteria, with plan must_haves folded in where they add detail.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / SUM-01, SUM-02, SUM-03: pick a family and period (default = most recent complete week or month); lesson and activity shown separately, travel excluded, sessions itemized | ✓ VERIFIED (W1) | `defaultPeriod` (src/domain/summary.ts) uses the period before today; `loadSummaryList` and `Summaries.tsx` list one row per active family; `FamilySummary.tsx` steps with `shiftSummaryPeriod` and `canGoNext`; `buildFamilySummary` filters by attendee and date and never reads travel. See W1 for the on-screen format and expense detail |
| 2 | SC2 / SUM-04: copy the summary as plain text | ✓ VERIFIED | `MessageGroup.tsx` `copy()` passes `view.text` to `copyText` (src/pwa/clipboard.ts), which starts `writeText` synchronously; `tests/clipboard.test.ts`. Paste into Messages is in the human list |
| 3 | SC3 / SUM-05, SUM-06: PDF with receipts, Turkish header, tables, receipt pages, footer; totals identical to the message | ✓ VERIFIED | `src/pdf/summaryPdf.ts` draws sessions, expenses, totals and receipts two per page (`planReceiptPages`); photos are read one at a time with a cap; `tests/summaryPdf.test.ts` checks the drawn text, every Turkish letter and both dashes (ToUnicode), and "keeps the PDF totals equal to the message totals". Totals come from `formatHoursTr` and `formatCents` on the same `FamilySummary` (`pdfTotalsLines`, `renderMessageTr`) |
| 4 | SC3 (share): Share PDF opens the iOS share sheet, download fallback | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `ShareFooter.tsx` calls `shareFile(file)` synchronously in the tap; `src/pwa/share.ts` cancels on AbortError and downloads otherwise (`tests/share.test.ts`). The sheet itself is iOS-only; see behavior_unverified_items |
| 5 | SC4a / SUM-07: warnings for no-receipt expenses and zero-minute sessions; never block Copy or Share | ✓ VERIFIED | `buildFamilySummary` builds `warnings`; `FamilySummary.tsx` shows the "Check before sending" group; `messageView` takes no warnings input (D-16); `tests/summary.test.ts` covers the warning rules |
| 6 | SC4b / SUM-08: mark a period sent; an edit to a session or expense flags "Changed since sent"; reverting clears it | ✓ VERIFIED | `sentStatus` (src/domain/summaryState.ts); `markSent` and `unmarkSent` (src/data/periodRecords.ts) are the only writers, one transaction each. `tests/summaryData.test.ts` (around line 130) runs markSent, then a session edit ("changed"), then the revert ("sent") against the real database. A travel-only edit and a family rename also flag |
| 7 | SC5a / VIEW-01: own Lesson, Activity and Travel totals per week and per month | ✓ VERIFIED | `Sessions.tsx` renders `PersonalTotals` for the visible Week or Month range; `loadViewTotals` reads one transaction; `tests/viewTotals.test.ts` includes "shows 13 travel minutes in the personal totals only" |
| 8 | SC5b / VIEW-02: breakdown by student, family and subject; subject counts actual time once; family and student use credited time | ✓ VERIFIED | `computeViewTotals` (src/domain/viewTotals.ts): subject rows sum actual minutes; family and student rows use `creditedMinutes`; siblings counted once per family. Tests cover the shared-swim example (45 minutes, half and full, rows 23 and 45) |
| 9 | D-17 / SUM-06: half credit is `Math.ceil(minutes / 2)`, all credited values whole | ✓ VERIFIED | `creditedMinutes` in src/domain/session.ts; test "half is a whole number c with 2c - m equal to 0 or 1 for every minute 0 to 999" |
| 10 | D-02 / D-18: Turkish hours "1,5 saat (1:30)" from the shared rounding core; app screens keep "1.5 h (1:30)" | ✓ VERIFIED (W1) | `hoursParts` in src/domain/hours.ts; `formatHours` and `formatHoursTr` both call it. Hand-checked: 0 gives "0 saat (0:00)", 15 gives "0,25 saat (0:15)", 23 gives "0,38 saat (0:23)", 90 gives "1,5 saat (1:30)" |
| 11 | Travel never reaches parent-facing output | ✓ VERIFIED | `renderMessageTr`, `sessionRowCells`, `pdfTotalsLines` have no travel input; T-04-24 regression test in tests/viewTotals.test.ts |
| 12 | Backup v3 carries saved messages, sent marks and the instructor name; restore of v1 or v2 clears them; family delete cascades | ✓ VERIFIED | `BACKUP_SCHEMA_VERSION = 3` (src/domain/backup.ts); `restoreBackup` clears every non-meta table, then sets or deletes `instructorName`; tests/backup.test.ts "restoring a version 1 file over receipts" asserts `periodRecords` count 0; v3 round trip test present; `deleteFamily` removes `periodRecords` (src/data/families.ts) |

**Score:** 11/12 truths verified (1 present but behavior unverified: truth 4). Truths 1 and 10 carry warning W1.

Device-only backstop truths (plan must_haves tagged `verification: backstop`, so not VERIFIED on code evidence): five-tab label fit (04-06), 30+ receipt PDF memory (04-04 and 04-06), share sheet and Turkish glyphs on device (04-06 ROADMAP device spike). These are listed in human_verification.

## Requirements Coverage

Cross-referenced from PLAN frontmatter against .planning/REQUIREMENTS.md (Phase 4 rows). All ten IDs are claimed by at least one plan and none is orphaned.

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| SUM-01 | 04-01 | ✓ SATISFIED | Default period, picker, Summaries list (truth 1) |
| SUM-02 | 04-01, 04-04 | ✓ SATISFIED (W1) | Sessions itemized in text and PDF; expenses itemized in PDF; text shows expense total only (D-07) |
| SUM-03 | 04-01 | ✓ SATISFIED (W1) | Shared `hoursParts` core; Turkish variant per D-02; two exported formatters |
| SUM-04 | 04-03 | ✓ SATISFIED | Copy Message, plus the paste check on device |
| SUM-05 | 04-04, 04-05 | ✓ SATISFIED (generation); ⚠️ share delivery human-needed | PDF generation tested; share sheet on device |
| SUM-06 | 04-01, 04-04 | ✓ SATISFIED | One computation, shared formatters, PDF totals test |
| SUM-07 | 04-01, 04-03 | ✓ SATISFIED | Warnings group; never blocks Copy or Share |
| SUM-08 | 04-02, 04-03 | ✓ SATISFIED | Sent state, changed flag (integration test), backup v3 |
| VIEW-01 | 04-06 | ✓ SATISFIED | Personal totals per week and month |
| VIEW-02 | 04-06 | ✓ SATISFIED | Student, Family and Subject breakdowns |

Deferred requirements (VIEW-03 CSV export, SUM-09 frozen snapshot) are v2 in REQUIREMENTS.md and out of scope.

## Warnings (non-blocking; decision requested)

**W1. On-screen format versus SC1 / SUM-02 / SUM-03 wording.** ROADMAP SC1 says every hour value reads like "1.5 h (1:30)" and that sessions and expenses are itemized. The Family Summary screen shows the message text, which uses "1,5 saat (1:30)" (D-02) and lists expenses as one "Masraflar" total line (D-07). Itemized expenses appear only in the PDF. SUM-03 says "one formatter everywhere", while there are two exported formatters sharing one rounding core. Both choices are locked in 04-CONTEXT.md, so this is an interpretation to confirm, not a defect. Options: accept, or change the on-screen message.

**W2. Sent mark cannot be cleared on an emptied period (review IN-01, not fixed).** `screenParts` sets `showSent: !empty`. If every session in a sent period is deleted or moved, the Summaries row keeps "Changed since sent" and "Mark as Not Sent" is unreachable. The orphan record also stays in future backups. Suggested fix: show `SentGroup` when `record.sentAt != null`, even for an empty period.

## Anti-Patterns and Info (not counted)

- No TBD, FIXME, XXX, TODO, HACK or PLACEHOLDER markers in any phase 4 changed file (debt-marker gate passes).
- 04-REVIEW IN-02 (unfixed): a share outcome caption is matched by file name, so it can survive a rebuild for changed data.
- 04-REVIEW IN-03 (unfixed): characters outside the Noto Latin subset (for example emoji or Cyrillic in names) are dropped silently in the PDF but kept in the message text.
- 04-REVIEW IN-04 (unfixed): a three-line receipt caption can touch the next slot's photo. Visual check on device.
- The fingerprint omits the instructor name, which the PDF header prints. A later name change will not flag "Changed since sent". SUM-08 wording covers sessions and expenses only, so this is noted, not a gap.
- 04-REVIEW CR-01, WR-01, WR-02 and WR-03 are fixed (commits bf38ad4, 3bb39e5, 423dabb, 404fa24). WR-03 is a UI change with no automated test; it is in the human list.

## Behavioral Spot-Checks

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full suite, default timezone | `npm test` | 27 files, 771 tests passed | ✓ PASS |
| Full suite, UTC | `TZ=UTC npm test` | 27 files, 771 tests passed | ✓ PASS |
| Production build | `npm run build` | exit 0; precache 11 entries (716 KiB) | ✓ PASS |
| Dist checks | `node scripts/check-dist.mjs` | 15 of 15 ok, including C15 (lazy PDF chunk precached, jsPDF optional libraries absent) | ✓ PASS |
| Turkish glyph coverage in embedded fonts | parsed the cmap of both base64 font modules | ş Ş ğ Ğ ı İ ç Ç ö Ö ü Ü, en dash, em dash, middot and ellipsis all present in Regular and Bold | ✓ PASS (coverage only; rendering is a human check) |
| Dependency pin | `package.json` | jspdf pinned at "4.2.1" (no caret); checkpoint approval recorded in 04-04-SUMMARY | ✓ PASS |
| Network calls in src | grep for fetch, XMLHttpRequest, sendBeacon, WebSocket | none | ✓ PASS |
| Probe execution | none declared for this phase | N/A | N/A |

Working tree: clean (`git status` empty) at verification time. Nothing was committed by this verifier.

## Human Verification Required

See the `human_verification` frontmatter list. It contains the deferred 04-06 Task 3 device checks (not run by the user), the share and glyph device checks, the 30+ receipt memory check, the five-tab fit, offline checks, the CR-01 draft flows, the WR-03 navigation check, and the decisions W1 and W2.

## Gaps Summary

No gaps block goal achievement. W1 and W2 are warnings. The phase goal is met in code, and the remaining work is device verification plus the W1 and W2 decisions.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
