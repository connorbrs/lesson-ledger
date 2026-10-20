---
phase: 04-family-summaries-overview
plan: 04
subsystem: pdf
tags: [jspdf, noto-sans, pdf, receipts, turkish, vitest]

requires:
  - phase: 04-family-summaries-overview
    provides: FamilySummary model, Turkish formatters, pdfFileName (04-01); sent tracking and message (04-03)
provides:
  - jspdf 4.2.1 pinned exactly, behind one lazy module
  - Noto Sans Regular and Bold subsets embedded as generated TypeScript modules with the OFL licence
  - pure PDF content rules (labels, header, rows, totals, footer, receipt plan, contain-fit, error type, photo cap)
  - buildSummaryPdf returning {blob, pageCount}
  - loadReceiptPhoto (stored JPEG bytes and size)
affects: [04-05, 04-06]

actuals:
  tokens: 9850
  tasks: 3
  commits: 2
plan_head_before: 33f9b9d76ee1befdcf901baf7db2d2a104948caa
commits: 2
plan_head_after: 741e64c8b130407e487ad7b4da2dff4c2fa3145d

tech-stack:
  added: [jspdf@4.2.1]
  patterns:
    - "Only src/pdf/summaryPdf.ts imports jspdf, through a dynamic import (type-only static import)"
    - "PDF text is written with an embedded Noto Sans subset; Helvetica cannot draw s-cedilla, g-breve, dotless i"
    - "Photos arrive through an injected loader and are read one at a time"
    - "Tests read text back from an uncompressed PDF by decoding glyph ids through the ToUnicode maps"

key-files:
  created:
    - scripts/make-font-module.mjs
    - src/pdf/summaryPdf.ts
    - src/pdf/fonts/NotoSans-Regular.ts
    - src/pdf/fonts/NotoSans-Bold.ts
    - src/pdf/fonts/OFL.txt
    - src/domain/pdfContent.ts
    - src/data/receipts.ts
    - tests/pdfContent.test.ts
    - tests/summaryPdf.test.ts
    - tests/receipts.test.ts
    - tests/fixtures/jpeg.ts
    - tests/fixtures/pdfSummary.ts
    - tests/fixtures/pdfText.ts
  modified:
    - package.json
    - package-lock.json
    - tests/node-shim.d.ts
    - .planning/phases/03-expenses-receipts/03-SECURITY.md

key-decisions:
  - "A receipt whose bytes do not start with FF D8 FF is photo-unreadable: jsPDF accepts any bytes as a JPEG and would write a broken image"
  - "The caption under a receipt is capped at 3 lines with an ellipsis, so it always fits the 40 pt under the 280 pt image slot"
  - "Both font faces share one glyph order, so the tests decode text with one merged gid map and fail loudly on a conflict"

requirements-completed: [SUM-02, SUM-05, SUM-06]

duration: 16min
completed: 2026-10-19
status: complete
---

# Phase 4 Plan 04: Turkish PDF with Receipts Summary

**A lazy jsPDF 4.2.1 module builds the Turkish family PDF from the same FamilySummary as the message: embedded Noto Sans subsets, hand-drawn session and expense tables that continue across pages, receipts two per page with captions, page footers, and a whole-build failure when any receipt is unreadable or the set is too large.**

## Accomplishments

- Task 1 (blocking-human package approval) was answered "approved" by the user in chat before dispatch ("Approve as planned"). Installed `jspdf@4.2.1` with `--save-exact --ignore-scripts` (22 packages added, 0 vulnerabilities); `fonttools==4.60.2` ran only in a throwaway virtual environment in the scratch folder (deleted afterwards) and the `@expo-google-fonts/noto-sans@0.4.2` tarball was only downloaded and extracted there. `jspdf-autotable` was not installed. Runtime dependencies are exactly dexie, jspdf and preact.
- Font subsets cut with the plan's Unicode set (adds U+2013 and U+2014 beyond the UI-SPEC ranges), kern/liga/calt, no hinting: 27,296 bytes Regular and 27,276 bytes Bold; cmap verified for all required Turkish letters, both dashes and the middle dot. Embedded as generated modules by `scripts/make-font-module.mjs` (usage line, TrueType signature check); `OFL.txt` copied unchanged from `LICENSE_FONT`.
- `pdfContent.ts` (pure): exact Turkish labels, header without a dangling dash for a blank instructor, session and expense row cells, totals lines built with the message's formatters (SUM-06 tested), page footer, receipt caption, `planReceiptPages` (two per page, one heading on the first slot), `containFit`, `PdfBuildError`, `MAX_PDF_PHOTO_BYTES`.
- `summaryPdf.ts`: header and subline, Dersler and Masraflar tables with wrapping rows that never split, repeated "(devam)" headings, totals, receipt pages (always a new page, image contain-fit in 516 by 280, caption below, 320 pt slots), footer on every page after the page count is known, typed failures.
- Visual check: rendered a sample page 1 with macOS `sips`; Turkish glyphs (Ş ş ğ İ ı Ö ü), dashes, right-aligned amounts and the footer drew correctly. Device checks remain with plan 04-06.
- `03-SECURITY.md` T-03-SC row now says the runtime-dependency statement is Phase 3 only and that 04-04 added jspdf 4.2.1 after approval.

## Task Commits

1. Task 1: checkpoint approved by the user in chat (no commit)
2. Task 2 tracer (install, fonts, content rules, one-page PDF, tests, security note): `94dfc99`
3. Task 3 complete PDF (expenses, pagination, receipts, footers, failures, receipt reader): `741e64c`

## Verification

- `npm test`: 25 files, 734 tests passed (24 files and 710 tests after Task 2).
- `TZ=UTC npm test`: 25 files, 734 tests passed.
- `npm run build` and `node scripts/check-dist.mjs`: pass (14 checks). The PDF module is not yet imported by any screen, so the build still shows no PDF chunk; plan 04-05 wires it in and adds the chunk and precache checks.
- Acceptance greps: jspdf is imported only in `src/pdf/summaryPdf.ts` (dynamic import, type-only static import), fonts only imported there, no network code in `src`, no `arrayBuffer` or `createObjectURL` in `src/pdf` or `src/domain`, no "transaction" in `src/data/receipts.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Non-JPEG receipt bytes are rejected**
- **Found during:** Task 3 (failure tests)
- **Issue:** jsPDF does not validate bytes passed as a JPEG; corrupt bytes produced a PDF with a broken receipt image, which T-04-16 ("a PDF with a missing receipt is wrong") forbids.
- **Fix:** A photo whose bytes do not start with FF D8 FF throws `PdfBuildError('photo-unreadable')`; tested.
- **Files modified:** src/pdf/summaryPdf.ts, tests/summaryPdf.test.ts
- **Commit:** 741e64c

**2. [Rule 3 - Blocking] Test helper typings and shared fixtures**
- **Found during:** Task 2
- **Issue:** `writeFileSync` was missing from the minimal Node typings in `tests/node-shim.d.ts`; importing helpers from one test file into another re-registered its tests.
- **Fix:** Added the `writeFileSync` typing; moved the shared summary builders into `tests/fixtures/pdfSummary.ts` and added `tests/fixtures/pdfText.ts`.
- **Commit:** 94dfc99 and 741e64c

TDD note: tests and implementation were committed together per task (as in 04-01), not as separate red and green commits.

## Known Stubs

None. `buildSummaryPdf` has no caller until plan 04-05 adds the Share PDF button; this is intended by the plan.

## Threat Flags

None beyond the plan's threat model. T-04-14 (hostile text), T-04-15 (one-at-a-time photos and cap), T-04-16 (any unreadable receipt fails the build) and T-04-17 (approved, pinned, scripts disabled, throwaway fonttools) are mitigated and tested. The 30+ receipt device run and glyph check in Preview and Mail remain device checks for plan 04-06.

## Self-Check: PASSED

- All listed created files exist; commits 94dfc99 and 741e64c are ancestors of HEAD.
