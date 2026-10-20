---
phase: 04-family-summaries-overview
plan: 02
subsystem: storage-backup
tags: [dexie, indexeddb, backup, schemaVersion-3, vitest]

requires:
  - phase: 04-family-summaries-overview
    provides: parsePeriodKey and isFingerprint from plan 04-01
provides:
  - Dexie version 2 with the periodRecords table (additive, version 1 untouched)
  - PeriodRecord type, pure message rules (cap 10,000 code points), the only writers saveMessage / markSent / unmarkSent
  - instructor name store in the meta table
  - backup schemaVersion 3 with periodRecords and instructorName, validated on read; v1 and v2 files read forever
  - deleteFamily cascade for period records
affects: [04-03, 04-04, 04-05, 04-06]

actuals:
  tokens: 12400
  tasks: 2
  commits: 2
plan_head_before: a6f91b70b26c48918410a65c446a08e9cdf145a1
commits: 2
plan_head_after: 38a606e875ebaf1db6b1a0253239a91f94f8ee76

tech-stack:
  added: []
  patterns:
    - "Additive Dexie version: version(1) never edited, version(2) adds one table"
    - "Records validated on read by rebuilding rows from whitelisted fields, id equation recomputed"

key-files:
  created:
    - src/domain/periodRecord.ts
    - src/data/periodRecords.ts
    - src/data/instructor.ts
    - tests/periodRecords.test.ts
  modified:
    - src/domain/types.ts
    - src/domain/validate.ts
    - src/domain/backup.ts
    - src/data/db.ts
    - src/data/backup.ts
    - src/data/families.ts
    - src/ui/BackupGroup.tsx
    - tests/backup.test.ts
    - tests/sessions.test.ts
    - tests/tracer.test.ts

key-decisions:
  - "PeriodRecord id is familyId_periodKey (underscore), inside the backup id charset"
  - "A record write goes through one private change() helper so all three writers share the family check, updatedAt bump and delete-when-empty rule"
  - "Version 1 and 2 files must carry neither periodRecords rows nor an instructor name; restoring them clears both (D-18)"

requirements-completed: [SUM-08]

duration: 20min
completed: 2026-10-19
status: complete
---

# Phase 4 Plan 02: Period Records, Instructor Name and Backup v3 Summary

**A saved message, a sent mark and the instructor name now live in Dexie version 2 and travel in a validated schemaVersion 3 backup that restores them exactly, while v1 and v2 files still restore (clearing them).**

## Accomplishments

- Dexie moves to version 2 by adding `periodRecords` ('id, familyId'); a database written by a separate Dexie instance at version 1 opens with its rows intact and an empty new table.
- `saveMessage`, `markSent`, `unmarkSent` validate first (period key, fingerprint, message), then run one transaction over families and periodRecords; a row with neither message nor sent mark is deleted.
- `setInstructorName` / `getInstructorName` in the meta table (trim, NFC, 60 code points, blank clears).
- Backup contract version 3: `buildBackup` reads the name in the same read transaction and names `periodRecords` explicitly; `restoreBackup` replaces records and the name in the same single transaction; `parseBackup` validates every record and the name before any write.
- `deleteFamily` removes the family's records in its transaction, so an export never names a deleted family.
- Settings Backup footer updated to the UI-SPEC amendment wording.

## Task Commits

1. Task 1 tracer (type, rules, Dexie v2, writers, name, backup v3 build/parse/restore, schema assertion updates): `1439e02`
2. Task 2 contract completion (damage table, literal v1/v2 files, clearing restores, atomic record restore, cap and guard tests, cascade, footer): `38a606e`

## Verification

- `npm test`: 20 files, 660 tests passed (plan 04-01 ended at 19 files, 598 tests).
- `TZ=UTC npm test`: pass. `TZ=Pacific/Auckland npm test -- tests/backup.test.ts`: pass.
- `npm run build` and `node scripts/check-dist.mjs`: pass (14 checks).
- Acceptance greps: no dexie import in `src/domain`, no network calls in `src`, runtime dependencies exactly dexie and preact, `scripts/make-large-backup.mjs` untouched and its schemaVersion 2 test still passes.

## Deviations from Plan

None - plan executed as written. Notes:

- The full record validation (cap, fingerprints, all-or-nothing field groups, version rules) was written in task 1's `parsePeriodRecord` rather than split across the two tasks; task 2 added the tests that pin each rule.
- Two existing damage-table cases ("version 1 carrying expenses/attachments") now also delete the new keys so they still fail for the reason they name.
- TDD commits squashed per task (one commit per task) per the plan.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or file surface beyond the planned backup fields (T-04-04 to T-04-09 mitigated as listed in the plan).

## Self-Check: PASSED

- Created files exist (periodRecord.ts, periodRecords.ts, instructor.ts, periodRecords.test.ts); commits 1439e02 and 38a606e are ancestors of HEAD.
