---
phase: 03-expenses-receipts
verified: 2026-10-19T18:00:00Z
status: passed
score: 5/5 roadmap success criteria verified (EXP-01..05, DATA-02, DATA-03 covered); 1 human item
covered_files: [".planning/phases/03-expenses-receipts/03-01-PLAN.md", ".planning/phases/03-expenses-receipts/03-01-SUMMARY.md", ".planning/phases/03-expenses-receipts/03-02-PLAN.md", ".planning/phases/03-expenses-receipts/03-02-SUMMARY.md", ".planning/phases/03-expenses-receipts/03-03-PLAN.md", ".planning/phases/03-expenses-receipts/03-03-SUMMARY.md", ".planning/phases/03-expenses-receipts/03-04-PLAN.md", ".planning/phases/03-expenses-receipts/03-04-SUMMARY.md", ".planning/phases/03-expenses-receipts/03-05-PLAN.md", ".planning/phases/03-expenses-receipts/03-05-SUMMARY.md", "scripts/make-large-backup.mjs", "src/data/backup.ts", "src/data/db.ts", "src/data/expenses.ts", "src/data/sessions.ts", "src/domain/backup.ts", "src/domain/base64.ts", "src/domain/expense.ts", "src/domain/money.ts", "src/domain/photos.ts", "src/domain/session.ts", "src/domain/sessionForm.ts", "src/domain/split.ts", "src/domain/types.ts", "src/pwa/photos.ts", "src/ui/App.tsx", "src/ui/BackupGroup.tsx", "src/ui/BackupReminder.tsx", "src/ui/BackupTooLargeAlert.tsx", "src/ui/ExpenseEditor.tsx", "src/ui/ExpensesGroup.tsx", "src/ui/Log.tsx", "src/ui/ReceiptViewer.tsx", "src/ui/ReceiptsGroup.tsx", "src/ui/SessionFields.tsx", "src/ui/SessionSheet.tsx", "src/ui/Sessions.tsx", "src/ui/SplitGroup.tsx", "src/ui/components.tsx", "src/ui/receiptPhotos.ts", "src/ui/styles.css", "src/ui/useBackup.ts", "tests/backup.test.ts", "tests/base64.test.ts", "tests/expense.test.ts", "tests/expenses.test.ts", "tests/money.test.ts", "tests/node-shim.d.ts", "tests/photos.test.ts", "tests/split.test.ts"]
covered_digest: "v3:sha256:2b825d50f4101145423efc1b2ffd79d731c984516dcaccaa22ca7be4328ebeca"
behavior_unverified: 0
overrides_applied: 0
gaps: []
human_verification:
  - test: "Open a receipt full size on the iPhone home-screen app and pinch-zoom and pan it"
    expected: "The receipt zooms and pans natively; the Back and Remove Photo controls still work after zooming"
    why_human: "Pinch-zoom is specified in 03-UI-SPEC.md and was deferred to the device by 03-04-SUMMARY.md, but it is not in the 03-05 device checklist the user approved. The viewer uses a plain img with no touch-action override, so it should work, but only a device run proves it"
---

# Phase 3: Expenses & Receipts Verification Report

**Phase Goal:** As a private instructor, I want to attach expenses and receipt photos to sessions, so that families see what I paid.
**Verified:** 2026-10-19
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (roadmap success criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Add one or more expenses (amount, description) to a session | ✓ VERIFIED | `src/ui/ExpensesGroup.tsx` and `src/ui/ExpenseEditor.tsx` wire the Log tab; `src/ui/Log.tsx:63` passes `draft.expenses` to `createSession`; `src/data/sessions.ts` writes the session and expenses in one rw transaction via `writeSessionExpenses`. `tests/expenses.test.ts:43` covers save, the "Expenses $12.50" line and cascade delete |
| 2 | Zero or more receipt photos from camera or library, shown as thumbnails, still visible offline after relaunch | ✓ VERIFIED | `src/ui/ReceiptsGroup.tsx` uses `accept="image/*" multiple` with no capture token, so iOS offers camera and library. `src/pwa/photos.ts` re-encodes with `canvas.toBlob('image/jpeg', 0.8)` and `src/domain/photos.ts` fits the long edge to 1600 px. Photos are Blobs in the Dexie `attachments` table, so they are not network-dependent. Pipeline behavior is covered by `tests/photos.test.ts`. Camera, HEIC, ~20 receipts and offline relaunch were approved on device (03-05-SUMMARY) |
| 3 | Equal split by default for a shared session; per-expense override; shares always sum exactly | ✓ VERIFIED | `src/domain/expense.ts` `resolveSplits` returns equal shares by default and accepts an override only when its cents sum to the amount (`=== draft.amountCents`). `src/domain/split.ts` keeps the other share as total minus the typed one. `src/data/expenses.ts` stores `{familyId, cents}` per family. `tests/split.test.ts:128` property-tests totals 0–300; `tests/expenses.test.ts:161,171,181` cover the odd-cent round trip (WR-02), family reset and wrong-sum rejection |
| 4 | Edit or delete an expense and its photos; delete leaves no orphans | ✓ VERIFIED | `writeSessionExpenses` removes dropped expenses with `attachments.where('expenseId').anyOf(gone).delete()` before `bulkDelete`, and removes dropped photo ids. `deleteSessionExpenses` (called from `deleteSession`) removes attachments then expenses in the same transaction. `tests/expenses.test.ts:125` (expense with photo rows removed; removed photo id deletes only that attachment) and `:237` (deleteSession removes only its own expenses and attachments) |
| 5 | Receipt photos included in backup and intact after restore (DATA-02/DATA-03 receipt half) | ✓ VERIFIED | `src/data/backup.ts` `buildBackup` reads all tables, including attachments, in one read transaction and base64-encodes each photo. `restoreBackup` decodes every photo before the rw transaction and clears and bulk-adds all five tables in one transaction. `src/domain/backup.ts` `parseBackup` validates each attachment (JPEG magic, expense reference, size cap) and rebuilds rows from whitelisted fields. `tests/backup.test.ts:368,436,448` cover round trip with photo bytes, atomicity and receipt atomicity. 140 MB restore and 151 MB refusal approved on device |

**Score:** 5/5 truths verified (0 behavior-unverified; 1 human item below)

### Requirements Cross-Reference

Requirement IDs declared in PLAN frontmatter: 03-01 `[EXP-01, EXP-04, EXP-05]`, 03-02 `[EXP-01]`, 03-03 `[EXP-04, EXP-05]`, 03-04 `[EXP-02, EXP-03, EXP-05]`, 03-05 `[DATA-02, DATA-03]`. Union is EXP-01..EXP-05, DATA-02, DATA-03. All seven are in `.planning/REQUIREMENTS.md`. No Phase 3 requirement in REQUIREMENTS.md is unclaimed by a plan. No orphans.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| EXP-01 | 01, 02 | Add expenses to a session | ✓ SATISFIED | Truth 1 |
| EXP-02 | 04 | Attach zero or more photos from camera or library | ✓ SATISFIED | Truth 2 |
| EXP-03 | 04 | Photos downscaled and stored on the phone | ✓ SATISFIED | 1600 px long edge, JPEG 0.8, stored as Blob in IndexedDB |
| EXP-04 | 01, 03 | Equal split by default, per-expense override | ✓ SATISFIED | Truth 3 |
| EXP-05 | 01, 03, 04 | Edit or delete expenses and photos | ✓ SATISFIED | Truth 4 |
| DATA-02 | 05 | Full backup includes receipt photos | ✓ SATISFIED | Truth 5 |
| DATA-03 | 05 | Restore validated and all-or-nothing, receipts included | ✓ SATISFIED | Truth 5 |

**Traceability note (WARNING, documentation only):** the REQUIREMENTS.md traceability table lists DATA-02 and DATA-03 as Phase 2, Complete. Phase 3 completes their receipt half, as the ROADMAP says. No code change is needed, but the table may mislead an audit.

### Required Artifacts and Key Links

Mechanical checks passed for all five plans: `verify.artifacts` 4/4, 3/3, 3/3, 5/5, 5/5 and `verify.key-links` 3/3, 3/3, 3/3, 3/3, 4/4 (all true). The data-flow chain was checked by reading the code. Expense drafts come from `loadExpenseDrafts` (Dexie). Photo bytes come from `getAttachmentBlob` through `useReceiptUrl`, and staged bytes come from `PhotoStage`. Neither is a static or hardcoded source.

### Anti-Patterns and Debt Markers

- Debt-marker gate: no `TBD`, `FIXME` or `XXX` in `src`, `tests` or `scripts`. No `TODO`, `HACK` or `PLACEHOLDER` in the phase's files. PASS.
- No new runtime packages (dependencies remain dexie and preact). No network code.
- Review-fix status (03-REVIEW-FIX.md): WR-01, WR-02, WR-03, WR-05, IN-01 fixed and the fixes are present in code (`isId` regex and `Map`-based totals in `src/domain/backup.ts` and `src/data/expenses.ts`; `draftFromExpense` odd-cent override in `src/domain/expense.ts`; `updateSession` payload-optional re-resolve in `src/data/sessions.ts`; `confirmDelete` staging cleanup in `src/ui/ExpenseEditor.tsx`).
- WR-04 skipped by documented decision. The 50 MP guard still runs after `img.decode()` (`src/pwa/photos.ts`). The `MAX_SOURCE_BYTES` (25 MB) cap is the real memory gate. The device check with ~20 receipts passed. Advisory, not a gap.
- Out-of-scope review items IN-02 to IN-07 (back during photo processing, oversize restore message, peak restore memory, small-size tool throw, no upper amount bound, duplication) remain open. None blocks a roadmap truth. IN-06 is the one that could matter later: amounts are bounded only by `Number.isSafeInteger`, so totals near 2^53 cents are not guarded.

### Test and Build Evidence (this verifier's own run)

- `npm test`: 16 files, 509/509 passed.
- `npm run build`: exit 0.
- `node scripts/check-dist.mjs`: OK (14 checks).

### Human Verification Required

### 1. Pinch-zoom in the receipt viewer on device

**Test:** On the iPhone home-screen app, open a receipt from the Receipts group, pinch to zoom, pan, then tap Back and Remove Photo.
**Expected:** The image zooms and pans natively. Back and Remove Photo still respond after zooming.
**Why human:** 03-UI-SPEC.md specifies native pinch-zoom and 03-04-SUMMARY.md defers it to the phone. The user-approved 03-05 device checklist does not include it. Code inspection shows a plain `<img>` in `ReceiptViewer.tsx` with the viewport allowing scaling, so the expected result is likely, but no device run has confirmed it.

### Gaps Summary

No gaps. All five roadmap success criteria and all seven requirement IDs are satisfied in code, and the behavior-dependent parts (split sum, cascade delete, atomic restore, photo removal) have passing behavioral tests. The device-only items were approved by the user, except pinch-zoom, which was never on the checklist. Status is `human_needed` because of that one item. Once it is confirmed, the status can move to `passed`.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_


## Human Verification Result

2026-10-20T00:12:58Z: user confirmed on iPhone 14 Pro: pinch-zoom works in the receipt viewer (03-UAT.md test 1: pass). Status moved human_needed → passed.
