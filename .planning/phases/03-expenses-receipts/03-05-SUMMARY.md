---
phase: 03-expenses-receipts
plan: 05
subsystem: backup
tags: [backup, base64, indexeddb, dexie, vitest, ios-device-check]
status: complete

requires:
  - phase: 03-expenses-receipts
    provides: expenses and attachments tables, receipt photo rules (MAX_STORED_PHOTO_BYTES, hasJpegMagic, MAX_PHOTO_DIMENSION), validateExpenseText (plans 03-01 to 03-04)
provides:
  - Backup contract schemaVersion 2 (one JSON file with expenses and base64 receipt photos); version 1 files still restore
  - Strict base64 helpers (src/domain/base64.ts)
  - Validation of every expense and photo entry before any write; whitelisted row rebuild
  - Atomic restore of all five tables plus lastBackupAt (WR-02 closed)
  - 150 MB cap with pre-encode too-large refusal and a single-button alert on both Back Up Now entry points
  - scripts/make-large-backup.mjs developer tool for the 140 MB and 151 MB device check
affects: [04 summaries and PDF]

actuals:
  tokens: 70000
  tasks: 3
  commits: 2
plan_head_before: bceecf2d2c27f951b8b867c591fcdc3283f9ba28
commits: 2
plan_head_after: 0ac03af5db0e304082fa6c7fdb4252825b9fcf98

tech-stack:
  added: []
  patterns:
    - "Export reads every table in one read transaction, then encodes photos one at a time outside it"
    - "Restore decodes every photo to a Blob before the single rw transaction; a table with no source fails before anything is cleared"
    - "Parse rebuilds rows from whitelisted fields; the per-photo cap is judged on string length before characters are scanned"

key-files:
  created:
    - src/domain/base64.ts
    - src/ui/BackupTooLargeAlert.tsx
    - scripts/make-large-backup.mjs
    - tests/base64.test.ts
    - tests/node-shim.d.ts
  modified:
    - src/domain/backup.ts
    - src/data/backup.ts
    - src/ui/useBackup.ts
    - src/ui/BackupGroup.tsx
    - src/ui/BackupReminder.tsx
    - tests/backup.test.ts

key-decisions:
  - "Backup stays one JSON file at schemaVersion 2 with base64 photos; no zip, no new package (D-06, one-way)"
  - "MAX_BACKUP_BYTES is 150,000,000 decimal bytes; export refuses on the projected size and on the final File size (D-08)"
  - "An undecodable photo at restore time maps to the existing damaged alert via the pure restoreFailureFor"

requirements-completed: [DATA-02, DATA-03]

duration: ~25min
completed: 2026-10-19
---

# Phase 3 Plan 5: Backup with receipts and device check Summary

**The one-file backup now carries every expense and receipt photo (schemaVersion 2), restores old and new files all-or-nothing after validating every entry, refuses above 150 MB, and the whole phase passed the iPhone check.**

## Accomplishments

- Task 1: `base64.ts` (strict encode, decode, length), version 2 contract and validation in `domain/backup.ts`, `buildBackup` with photos and the size pre-check, `restoreBackup` that decodes photos first and replaces all five tables in one transaction. Closes Phase 2 review item WR-02.
- Task 2: Settings footer, restore confirm and success copy with expense and receipt photo counts; too-large outcome and OK-only alert from both Back Up Now entry points; invalid-photo at restore mapped to the damaged alert; `make-large-backup.mjs` developer tool (tested with a 2 MB run).
- Tests 442 to 504 (62 new). `npm run build` and `node scripts/check-dist.mjs` (14 checks) green; `TZ=Pacific/Auckland` run of tests/backup.test.ts green. No package added (dependencies still exactly dexie and preact); no network code.
- Task 3 (device check, iPhone 14 Pro home-screen app): user reported "approved - all steps matched". All ten steps matched expectations with no failures: expense basics, camera (portrait and landscape upright), library multi-select and HEIC, about 20 receipts without reload, offline, remove photo, split, delete session, backup with receipts through the share sheet and restore, and the 140 MB restore and 151 MB refusal. This closes the four device backstop truths (thumbnail memory, share and file picker, HEIC decode, 150 MB restore).

## Commits

- 1335be0 feat: backup schemaVersion 2 with receipts, strict validation, atomic restore
- 0ac03af feat: receipt-aware backup screens, too-large refusal, large-backup tool

## Deviations from Plan

**1. [Rule 3 - Blocking] No Node typings** - tsc includes tests and there is no `@types/node`; added `tests/node-shim.d.ts` with minimal typings for `Buffer` and the `node:` modules the tests use, instead of installing a package.

**2. TDD order** - the implementation was written before the backup tests, so Task 1 has no separate RED commit; the tests cover every behavior bullet and all pass.

**3. base64 size 0** - `base64ToBytes('')` is null as specified, so the size-0 case checks encode only.

**4. No UI test for the hook** - the repo has no DOM test environment, so the `useBackup` too-large outcome and alert wiring is covered by type checking and the built bundle, while the pure parts (`restoreFailureFor`, the too-large error, the cap) are unit tested.

## Known Stubs

None.

## Threat Flags

None. All T-03-11 to T-03-16 mitigations are implemented as planned; T-03-15 (plaintext backup) remains accepted.

## Self-Check: PASSED

- FOUND: src/domain/base64.ts, src/ui/BackupTooLargeAlert.tsx, scripts/make-large-backup.mjs, tests/base64.test.ts
- FOUND commits: 1335be0, 0ac03af
