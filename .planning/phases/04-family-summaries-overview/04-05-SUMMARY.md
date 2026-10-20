---
phase: 04-family-summaries-overview
plan: 05
subsystem: ui
tags: [share, pdf, pwa, vite, rolldown, instructor-name, vitest]

requires:
  - phase: 04-family-summaries-overview
    provides: summary model and pdfFileName (04-01), instructor storage (04-02), sent tracking and message (04-03), buildSummaryPdf and loadReceiptPhoto (04-04)
provides:
  - pure PDF and share state rules (build key, button state, action, captions)
  - useSummaryPdf hook that pre-builds the PDF in one lazy, precached chunk
  - sticky Share PDF footer with a synchronous share tap
  - Instructor Name sheet and Settings Instructor group, with instructorFormState
  - dist check C15 (lazy precached PDF chunk, size cap, optional jsPDF libraries absent)
affects: [04-06]

actuals:
  tokens: 7800
  tasks: 2
  commits: 2
plan_head_before: 3ec65715da5c8ab7f28a095c50a097d9434b3e08
commits: 2
plan_head_after: 9f8bb27df9110b298840643f23a93dc6a8b903aa

tech-stack:
  added: []
  patterns:
    - "Async result stored with the key it was built for; a status for another key reads as 'preparing', so a stale PDF can never be shared"
    - "Share tap chains promises and calls shareFile(file) with nothing awaited before it"
    - "jsPDF optional libraries (canvg, dompurify, html2canvas) marked external via build.rolldownOptions"

key-files:
  created:
    - src/ui/useSummaryPdf.ts
    - src/ui/ShareFooter.tsx
    - src/ui/InstructorSheet.tsx
  modified:
    - src/domain/summaryState.ts
    - src/domain/validate.ts
    - src/pdf/summaryPdf.ts
    - src/ui/FamilySummary.tsx
    - src/ui/Settings.tsx
    - src/ui/App.tsx
    - src/ui/styles.css
    - vite.config.ts
    - scripts/check-dist.mjs
    - tests/summaryState.test.ts
    - tests/validation.test.ts

key-decisions:
  - "pdfBuildKey JSON-encodes its fields so a separator inside a value cannot collide, and a missing name differs from the text 'null' or an empty name"
  - "The PDF result is stored together with its key and compared at render, closing the one-render window in which an effect-set 'preparing' would still show the old ready file"
  - "summaryPdf.ts imports jspdf statically; the module itself is reached only by the dynamic import in useSummaryPdf, so engine and fonts are ONE lazy chunk"

requirements-completed: [SUM-05]

duration: 14min
completed: 2026-10-19
status: complete
---

# Phase 4 Plan 05: Share PDF and Instructor Name Summary

**The Family Summary pre-builds its PDF in a single lazy, precached chunk and shares it through the iOS share sheet from a synchronous tap (download fallback), and Settings now has an Instructor name sheet whose value is printed in the PDF header.**

## Accomplishments

- Pure rules in `summaryState.ts`: `pdfBuildKey`, `PdfStatus`, `shareButtonState`, `shareAction`, `pdfFailureCaption`, `shareResultCaption`, `footerCaption` and the three copy constants, all tested (key changes with each input, never takes message text).
- `useSummaryPdf` builds in an effect keyed by the build key through `import('../pdf/summaryPdf')`, wraps the Blob in a `File` named by `pdfFileName`, ignores superseded builds and releases the Blob on cleanup. `ShareFooter` is the sticky bar (spacer measured by ResizeObserver, as in Log); the tap calls `shareFile(file)` with no await, guards against a second tap, and retry rebuilds after a failure.
- `vite.config.ts` marks canvg, dompurify and html2canvas external. The build now emits exactly: entry chunk, workbox-window, and one `summaryPdf` chunk (474 kB, under the 2 MiB cap), which `sw.js` precaches. `scripts/check-dist.mjs` check C15 asserts all of this; C1 to C14 unchanged.
- `instructorFormState` (dirty, canSave, tooLong) with tests; `InstructorSheet` (Cancel/Save, discard dialog, `saveErrorMessage` on failure, double-save guard); Settings gets the Instructor group above Storage; App renders the sheet as a direct child of `.app`.

## Task Commits

1. Task 1 Share PDF, pre-built lazy chunk, captions, C15: `1004787`
2. Task 2 Instructor name group, sheet and form rule: `9f8bb27`

## Verification

- `npm test`: 25 files, 748 tests passed. `TZ=UTC npm test`: 748 passed.
- `npm run build` (tsc plus vite) clean, no warnings; `node scripts/check-dist.mjs`: 15 checks ok including C15.
- Acceptance greps: no `await` in ShareFooter.tsx, no static import of `pdf/summaryPdf` in src, no network APIs in src, runtime dependencies still exactly dexie, jspdf, preact.
- Not verified here: the share sheet, download fallback and offline PDF on the phone (plan 04-06). I did not run the UI in a browser.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsPDF moved from a dynamic to a static import inside summaryPdf.ts**
- **Found during:** Task 1 (build chunk list)
- **Issue:** With jsPDF dynamically imported inside `summaryPdf.ts`, the build produced two PDF chunks (`summaryPdf` and `jspdf.es.min`), but the plan and C15 require exactly one.
- **Fix:** `import { jsPDF } from 'jspdf'` at the top of `summaryPdf.ts` (still the only file importing jspdf; the module is only ever loaded by the dynamic import in `useSummaryPdf`). Header comment updated. The 04-04 tests are unchanged and pass.
- **Files modified:** src/pdf/summaryPdf.ts
- **Commit:** 1004787

**2. [Rule 2 - Missing critical functionality] Stale-PDF window closed by keying the stored result**
- **Found during:** Task 1 (T-04-20)
- **Issue:** Setting 'preparing' inside the effect leaves one render where the previous key's ready file is still shown for new data, so a fast tap could share the old PDF.
- **Fix:** The hook stores `{key, status}` and reports 'preparing' whenever the stored key differs from the current key.
- **Files modified:** src/ui/useSummaryPdf.ts
- **Commit:** 1004787

TDD note: tests and implementation were committed together per task (as in earlier plans), not as separate red and green commits. The Task 1 tests were run red before the implementation; the Task 2 tests were written first but not run red.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-04-20 (stale PDF) is mitigated by the key plus disabled button while preparing; T-04-21 by `validateInstructorName`, `maxLength` and `instructorFormState.tooLong`; T-04-22 by the external list and C15. Network code remains absent (grep gate).

## Self-Check: PASSED

- Created files exist (useSummaryPdf.ts, ShareFooter.tsx, InstructorSheet.tsx); commits 1004787 and 9f8bb27 are ancestors of HEAD.
