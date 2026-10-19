---
phase: 02-session-logging-backup
plan: 03
subsystem: database
tags: [dexie, indexeddb, backup, json, restore, web-share, preact, vitest]
requires:
  - phase: 02-01
    provides: Session row shape, validateSessionFields, local-date helpers, sessions repo
  - phase: 02-02
    provides: Sessions period view and Edit Session sheet (rows the backup must round-trip)
provides:
  - Backup file contract (JSON, format 'lesson-ledger-backup', schemaVersion 1, reserved expenses and attachments slots)
  - buildBackup (single read transaction, fails closed if expenses or attachments hold rows)
  - parseBackup (whole-file validation with whitelisted row rebuild and referential checks)
  - restoreBackup (one rw transaction over all data tables plus lastBackupAt)
  - shareFile adapter (share sheet, AbortError as cancel, download fallback)
  - Settings Backup group with restore validation and confirm alerts
  - Log tab backup reminder (quiet line, then card from 7 days or never backed up)
affects: [03 receipts (must raise schemaVersion and fill the attachments slot), 04 summaries]

# Actuals (#2632) — chars/4 over the changed lines of the realized diff
actuals:
  tokens: 9583
  tasks: 4
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Validate the whole backup file before any write; restore is one rw transaction over every data table plus meta"
    - "Restored rows are rebuilt field by field from whitelisted keys, never merged or spread from file objects"
    - "Browser APIs injected as env parameters (shareFile, like readUsage) so tests pass fakes"
    - "Restore alerts mount through a portal into .app so content behind them is inert"

key-files:
  created:
    - src/domain/backup.ts
    - src/data/backup.ts
    - src/pwa/share.ts
    - src/ui/useBackup.ts
    - src/ui/BackupGroup.tsx
    - src/ui/BackupReminder.tsx
    - tests/backup.test.ts
    - tests/share.test.ts
  modified:
    - src/domain/dates.ts
    - src/ui/Settings.tsx
    - src/ui/Log.tsx
    - src/ui/components.tsx
    - src/ui/styles.css

key-decisions:
  - "Backup container is JSON now (Task 1 decision, 02-CONTEXT D-12); no new package, so the dependency set stays exactly dexie and preact. A Phase 3 zip container would be a schemaVersion 2 with the JSON reader kept forever."
  - "Restore alerts mount via createPortal from preact/compat into .app (about 11 KB JS; gzip 52 to 56 kB) instead of as direct app-root children, so content behind the alert is inert."
  - "Restore sets Last backup to the file's createdAt, so a restore on a fresh phone does not show 'No backup yet.'"
  - "Export fails closed (BackupError 'unsupported-data') if expenses or attachments hold any row, so Phase 3 must design binary photo export deliberately rather than silently dropping receipts."
  - "Restore ids and createdAt are preserved, so the Sessions ordering is identical before backup and after restore."

patterns-established:
  - "Pattern 1: parseBackup reuses the app's own write validators (validateFamilyInput, validateStudentInput, validateSessionFields), so restore cannot admit a row the app would refuse to write"
  - "Pattern 2: restoreBackup uses bulkAdd (not put) inside the transaction, so a duplicate id fails loudly and rolls everything back"
  - "Pattern 3: shareFile returns 'shared' | 'downloaded' | 'cancelled'; only shared or downloaded marks the backup as taken"

requirements-completed: [DATA-02, DATA-03, DATA-04]

coverage:
  - id: D1
    description: "Backup export builds one JSON file from all data tables in a single read transaction, sorted by id, identical across unchanged exports except createdAt"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "npm test -- tests/backup.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Restore validates the whole file (format, schemaVersion, every row, unique ids, referential integrity, hostile keys) before any write and rejects corrupt, empty, oversized or newer files with data untouched"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "npm test -- tests/backup.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Restore replaces all five data tables and lastBackupAt in one rw transaction; an injected duplicate-id failure rolls everything back"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "npm test -- tests/backup.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Back Up Now opens the iOS share sheet; cancel changes nothing; non-abort share errors fall back to a download"
    requirement: "DATA-02"
    verification:
      - kind: unit
        ref: "npm test -- tests/share.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "device round trip on iPhone 14 Pro, iOS 26.6.1 (home-screen app): share sheet opened, Save to Files worked"
        status: pass
    human_judgment: true
    rationale: "The share sheet and Save to Files behave only on the real device; the user confirmed both on the phone."
  - id: D5
    description: "Settings Backup group (Last backup, Back Up Now, Restore from Backup…) with the validation and Replace Everything confirm alerts"
    requirement: "DATA-03"
    verification:
      - kind: manual_procedural
        ref: "device round trip: Restore from Backup… picked the saved file, Replace Everything brought the throwaway session back; a non-backup file was rejected with nothing changed"
        status: pass
    human_judgment: true
    rationale: "File picker behaviour and alert layout are device-only."
  - id: D6
    description: "Log reminder: hidden before the first session, quiet at 0 to 6 days, card at 7 or more days or when never backed up; never blocks Log Session"
    requirement: "DATA-04"
    verification:
      - kind: unit
        ref: "npm test -- tests/backup.test.ts"
        status: pass
    human_judgment: true
    rationale: "Card layout against the sticky footer and 200% zoom behaviour are visual, device-only checks; the day-count rule is unit tested."

# Metrics
duration: not recorded
completed: 2026-10-19
status: complete
---

# Phase 2: Session Logging & Backup, Plan 03 Summary

**One-file JSON backup through the iOS share sheet, all-or-nothing restore after full validation, and a Log reminder for stale backups; the device round trip passed on iPhone 14 Pro (iOS 26.6.1)**

## Performance

- **Duration:** not recorded (this run was a continuation; the device check was done by the user)
- **Started:** not recorded
- **Completed:** 2026-10-19
- **Tasks:** 4 of 4 (Task 1 decision pre-answered as json; Task 4 completed by the user)
- **Files modified:** 13

## Accomplishments

- Backup file contract fixed as JSON with format marker and schemaVersion 1; expenses and attachments are reserved empty arrays for Phase 3
- `buildBackup` reads every data table in one read transaction, so a racing student and session write can never produce a dangling reference
- `parseBackup` validates the whole file with the app's own write validators, unique ids, referential integrity, and whitelisted row rebuilding (hostile keys such as `__proto__` never reach storage); oversized files are rejected before being read
- `restoreBackup` clears and bulk-adds all five data tables plus `lastBackupAt` in one rw transaction; a duplicate id rolls everything back
- `shareFile` treats AbortError as a cancel, falls back to a download on other failures, and only a shared or downloaded backup marks Last backup
- Settings Backup group, restore validation and confirm alerts, and the Log reminder (quiet line, then card) are in place without blocking Log Session
- Device round trip passed: Back Up Now opened the share sheet, Save to Files worked, a throwaway session was deleted and restored with Replace Everything, and a non-backup file was rejected with nothing changed

## Task Commits

Each task was committed atomically:

1. **Task 1: Decide the backup file container** - n/a (decision, pre-answered `json`, recorded in 02-CONTEXT D-12; no code)
2. **Task 2: Backup contract and headless round trip** - `6a3240e` (feat)
3. **Task 3: Back Up Now, Restore from Backup…, and the Log reminder** - `cccf3d6` (feat)
4. **Task 4: Device round trip** - n/a (human-action, completed by the user on the phone; no code)

**Plan metadata:** recorded in the docs commit that follows this summary (`docs(02-03): complete backup and restore plan`).

_Measured commit range (ledger, protocol 0c): plan_head_before `17c2bbd`, plan_head_after `cccf3d6`, commits 2 (`git rev-list --count 17c2bbd..HEAD`)._

## Files Created/Modified

- `src/domain/backup.ts` - backup constants, BackupError, serializeBackup, parseBackup, backupFileName, formatBackupDate, daysAgoText, backupReminder, countsText (pure)
- `src/data/backup.ts` - buildBackup, restoreBackup, readBackupStatus, markBackedUp over Dexie
- `src/pwa/share.ts` - shareFile with AbortError-as-cancel and download fallback, env injected
- `src/ui/useBackup.ts` - Back Up Now hook (re-entry guard, build, share, mark backed up)
- `src/ui/BackupGroup.tsx` - Settings Backup group, restore file pick, validation and confirm alerts
- `src/ui/BackupReminder.tsx` - Log tab quiet line and highlighted card
- `src/ui/Settings.tsx` - mounts BackupGroup between Storage and About; storage footer now reads "Back up from Settings, then Backup."
- `src/ui/Log.tsx` - mounts BackupReminder after the form groups
- `src/ui/components.tsx` - Row gained an optional `disabled` prop for busy states
- `src/ui/styles.css` - card and hidden file input styles from existing tokens
- `src/domain/dates.ts` - localYmdFromMs and daysBetween (integer civil-day arithmetic)
- `tests/backup.test.ts` - contract, validation rejections (table-driven, data unchanged), atomic failure, round trip, day counts, file name
- `tests/share.test.ts` - every shareFile branch with fakes

## Decisions Made

- JSON container, not zip: no new package, so the runtime dependencies stay exactly `dexie` and `preact`. Phase 3 can add a zip container under schemaVersion 2 while restore keeps reading this JSON.
- Restore alerts mount through `createPortal` (preact/compat) into `.app`, not as direct app-root children as the plan first described. Cost: about 11 KB JS, gzip 52 to 56 kB. Benefit: everything behind the alert is inert.
- Restore sets Last backup to the file's `createdAt`, so restoring on a fresh phone does not nag with "No backup yet."
- Export fails closed while expenses or attachments hold rows, so Phase 3 must design photo export deliberately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Row needed a disabled state for busy rows**
- **Found during:** Task 3 (Backup group busy labels)
- **Issue:** Back Up Now and Restore rows must be disabled while their work runs; the shared Row component had no disabled prop
- **Fix:** Added an optional `disabled` prop and `.row:disabled` style to `Row` in src/ui/components.tsx
- **Files modified:** src/ui/components.tsx, src/ui/styles.css
- **Verification:** Test suite passes (257 tests); busy states render disabled on the device
- **Committed in:** cccf3d6 (Task 3 commit)

**2. [Rule 3 - Blocking] Date helpers needed for local-day counting**
- **Found during:** Task 2 (daysAgoText and backupReminder)
- **Issue:** Day counts must use local calendar days; dates.ts had no local-ymd-from-ms or day-difference helper
- **Fix:** Added localYmdFromMs and daysBetween to src/domain/dates.ts on integer civil-day arithmetic; exported countPhrases
- **Files modified:** src/domain/dates.ts
- **Verification:** tests/backup.test.ts passes under TZ=America/Los_Angeles and TZ=Pacific/Auckland (per executor report)
- **Committed in:** 6a3240e (Task 2 commit)

Mount location for the restore alerts (createPortal into `.app`) was a planned-approach change recorded under Decisions Made, not a rule deviation.

---

**Total deviations:** 2 auto-fixed (2 blocking, both Rule 3)
**Impact on plan:** Both were needed to implement the planned behaviour. No scope creep.

## Device Round Trip (Task 4, human-action)

- **Device:** iPhone 14 Pro, iOS 26.6.1, home-screen app
- **Step 1 (Back Up Now):** the iOS share sheet opened (not the download fallback); Save to Files works; Last backup showed Today
- **Steps 2 and 3 (delete, then restore):** completed; the throwaway session was back after Replace Everything, and Settings showed the "Restored. …" line
- **Step 4 (non-backup file):** completed; the file was rejected with nothing changed
- **Step 5 (same-day file naming, optional):** not reported. The backstop "Two backups made the same day" is left as **not reported**, not as verified.

Task 4's device result closes the device round-trip truth for share and file pick. The same-day naming backstop remains open for a future check.

## Issues Encountered

None.

## Known Stubs

None. The changed files contain no placeholder data flowing to the UI; the stub-pattern matches in the diff are ordinary null checks and empty-object initialisers.

## Deferred Items

- Same-day backup file naming (Files asks Keep Both or Replace) was not reported on the device. Recheck at the next device session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backup and restore are in place for the sessions, families and students data. Phase 3 (receipts) must raise schemaVersion and fill the `attachments` slot; `buildBackup` currently fails closed on any expense or attachment row, so receipts cannot be silently dropped from a backup.
- Remaining Phase 2 work: none in plan 03; check Phase 2 completion against ROADMAP.md after the state updates.
- Device: Web Share with files is now verified on iPhone 14 Pro (iOS 26.6.1) for the JSON backup. PDF share remains to be checked in Phase 4.

---
*Phase: 02-session-logging-backup*
*Completed: 2026-10-19*
