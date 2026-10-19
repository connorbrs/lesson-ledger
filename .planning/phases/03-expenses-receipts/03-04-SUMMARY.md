---
phase: 03-expenses-receipts
plan: 04
subsystem: ui
tags: [preact, receipts, photos, canvas, vitest]
status: complete

requires:
  - phase: 03-expenses-receipts
    provides: createSession/updateSession photo payload and attachment diff, getAttachmentBlob, canSaveExpense, expenseEditorDirty, Expense editor with Split (plans 03-01 to 03-03)
provides:
  - Pure photo rules (constants, fitLongEdge, JPEG magic check, failure captions) in src/domain/photos.ts
  - Sequential receipt pipeline over an injected environment (prepareReceipt, prepareReceipts, defaultPhotoEnv, PhotoError) in src/pwa/photos.ts
  - PhotoStage (Map outside FormState) and the useReceiptUrl hook, the only object-URL creator in src/ui
  - Receipts group in the Expense editor (thumbnails, processing tiles, Add Photo tile, failure caption)
  - Receipt viewer with Remove Photo confirm; removal staged and deleted by the session save
affects: [03-05 backup and device check, 04 summaries and PDF]

actuals:
  tokens: 7400
  tasks: 2
  commits: 4
plan_head_before: e2d01b8a3dcc8cf80c1ff8a5d7f5338be2537595
commits: 4
plan_head_after: 46cb4afe60ba1319450618463557e71b71a6dfe6

tech-stack:
  added: []
  patterns:
    - "Browser image work is a PhotoEnv (decode, encode) injected into a pure sequence; tests drive it with fakes, the real canvas path is isolated in defaultPhotoEnv"
    - "Staged photo bytes live in a Map keyed by photo id beside FormState; drafts carry only ids, so the existing dirty and discard logic covers photos"
    - "One object URL per photo per mount, created in an effect and revoked in its cleanup, in a single file"

key-files:
  created:
    - src/domain/photos.ts
    - src/pwa/photos.ts
    - src/ui/receiptPhotos.ts
    - src/ui/ReceiptsGroup.tsx
    - src/ui/ReceiptViewer.tsx
    - tests/photos.test.ts
  modified:
    - src/ui/ExpenseEditor.tsx
    - src/ui/SessionSheet.tsx
    - src/ui/Log.tsx
    - src/ui/App.tsx
    - src/ui/styles.css

key-decisions:
  - "Removing a photo staged earlier (not in this editor session) leaves it in the stage until the editor Save, so discarding the editor restores it; photos staged in this editor session are dropped immediately"
  - "Viewer fixes its photo id, number and total at open, so the 310 ms close animation does not flash a different photo after removal"
  - "Viewer footer row sits on the surface color (not black) so the destructive text keeps contrast in light mode; only the photo surround is #000000"

requirements-completed: [EXP-02, EXP-03, EXP-05]

duration: 14min
completed: 2026-10-19
---

# Phase 3 Plan 4: Receipt photos Summary

**Receipt photos can be picked or taken, downscaled one at a time to a 1600 px JPEG, shown as thumbnails, opened full size and removed, and are written with the session in one transaction.**

## Accomplishments

- Task 1 (TDD): `fitLongEdge`, `hasJpegMagic`, `photoFailureCaption` and the five constants (pure); `prepareReceipt` and `prepareReceipts` over a `PhotoEnv`. Tests prove the in-flight decode count never exceeds 1, an oversized source never reaches decode, `release` runs once on success and on every failure after a decode, and error mapping (decode failure, null or non-JPEG or empty encode, over-cap result, pixel cap). UI: `ReceiptsGroup` (single hidden `accept="image/*" multiple` input, no capture or HEIC token), `useReceiptUrl`, editor wiring (batch guard, createdAt strictly increasing, staged ids dropped on leave, Save gated by `canSaveExpense` processing), and staging Maps owned by App (Log tab) and the session sheet; `stage.clear()` only after a successful Log save.
- Task 2: `ReceiptViewer` (push layer outside the scrolling Screen, black surround, Remove Photo alert with Cancel and Remove, image failure line with Remove still available) and editor `removePhoto` staging.
- Tests 415 to 442 (27 new in tests/photos.test.ts); `npm run build` and `node scripts/check-dist.mjs` (14 checks) green. No package added (dependencies are still exactly dexie and preact).

## Commits

- beef522 test: failing receipt photo pipeline tests (RED)
- 6132392 feat: receipt photo constants and sequential pipeline (GREEN)
- df93a77 feat: receipt photos in the Expense editor, staged and saved with the session
- 46cb4af feat: Receipt viewer with Remove Photo confirm

## Deviations from Plan

None - plan executed exactly as written. (The Task 1 commit passes a no-op to `onOpen` until Task 2 wires the viewer in a separate commit, as the task split implies.)

## Known Stubs

None.

## Threat Flags

None. T-03-07 to T-03-10 mitigations are implemented as planned (size and pixel caps, sequential decode with finally-release, canvas re-encode only, JPEG type and magic check, URL revoke in one file, no new package). The re-encode dropping EXIF and the sideways-orientation behavior are platform assumptions to observe in the plan 03-05 device check.

## Device-check backstops (plan 03-05)

Camera and library pick, HEIC decode, portrait orientation, about 20 receipts memory, EXIF stripped on the stored JPEG, offline relaunch thumbnails, and pinch-zoom in the viewer are untestable here and remain for the phone.

## Self-Check: PASSED

Files exist (src/domain/photos.ts, src/pwa/photos.ts, src/ui/receiptPhotos.ts, src/ui/ReceiptsGroup.tsx, src/ui/ReceiptViewer.tsx, tests/photos.test.ts); commits beef522, 6132392, df93a77, 46cb4af are on main.
