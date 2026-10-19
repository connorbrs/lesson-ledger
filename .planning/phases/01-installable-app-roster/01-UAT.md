---
status: complete
phase: 01-installable-app-roster
source: [01-VERIFICATION.md]
started: 2026-10-19T00:00:00Z
updated: 2026-10-19T09:02:44.595Z
---

## Current Test

[testing complete]

## Tests

### 1. Roster walkthrough (HV-1)
expected: Family and student create/edit/archive/restore work; blank and 61-character names show captions and keep Save disabled; notes appear only in the Student sheet; "Delete Family" on a family with students shows the blocked footer; nothing clipped in light and dark.
result: pass

### 2. Records error path and Settings block (HV-2)
expected: Forced database-open failure shows "Can't open your records" with a full-width Retry button and the tab bar still visible; Settings shows Storage and Build values, never blanks.
result: pass

### 3. Storage used value on the phone (HV-3)
expected: Settings shows Storage used as a value like "1.2 MB" (not blank, not Unavailable) and Persistent storage Granted.
result: pass

### 4. Students survive an airplane-mode relaunch (HV-4)
expected: A student created in the installed app is still listed under its family after airplane mode + force-quit + relaunch.
result: pass

### 5. Update watchdog (HV-5, WR-03)
expected: Tapping Update App either reloads onto the new build or, within about 8 seconds, shows "Couldn't update…" with Not Now visible.
result: pass

### 6. Family picker shows the new family immediately (HV-6, WR-05)
expected: Editing a student and picking a different family shows the chosen family with no flash of the old one.
result: pass

### 7. VoiceOver: content behind overlays is unreachable (HV-7, WR-06)
expected: With VoiceOver, content behind a sheet, the Archived screen and the Delete alert cannot be reached; alert focus lands on Cancel and returns to the opener on close.
result: pass

### 8. Interrupted update keeps data (HV-8)
expected: Tap Update App, force-quit immediately, relaunch in airplane mode: the app opens on either build with families and students intact.
result: pass

### 9. Top bar no longer too thick (HV-9, fix 8891d94)
expected: People and Settings headers have no empty band under the Dynamic Island; a Family sheet is not clipped.
result: pass

### 10. Prohibition sign-offs and decisions (HV-10, W-1)
expected: P-a, P-b, P-c, P-e pass; decide P-d (cold-launch update activation: accept as platform behaviour or open a gap) and W-1 (archived-record delete dead end: add delete for archived no-history records, or reword the footer).
result: issue
reported: "P-a, P-b, P-c, P-e pass. P-d: accept cold-launch update activation as platform behaviour. W-1: add Delete for archived records with no history."
severity: minor

## Summary

total: 10
passed: 9
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps
- gap_id: G-01-10
  truth: "Archived families and students with no lesson history can be deleted from the Archived screen, so a family whose only students are archived (and have no history) can be fully removed"
  status: failed
  reason: "User reported: W-1 decision — add Delete for archived records with no history (currently the Archived screen has only Restore, so the 'Remove them before deleting the family' footer is a dead end)"
  severity: minor
  test: 10
  artifacts: []
  missing: []

## Decisions

- P-d (APP-05): accepted 2026-10-19 — after a full force-quit, iOS activates the waiting service worker on the next cold launch without a tap; no reload happens while the app is open and no input or data is lost. Amend the 01-04 prohibition wording accordingly.
- P-a, P-b, P-c, P-e: signed off as pass.
