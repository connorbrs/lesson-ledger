---
status: testing
phase: 01-installable-app-roster
source: [01-VERIFICATION.md]
started: 2026-10-19T00:00:00Z
updated: 2026-10-19T00:00:00Z
---

## Current Test

number: 1
name: Roster walkthrough (HV-1)
expected: |
  Add/edit/archive/restore families and students work as described in 01-VERIFICATION.md HV-1; name validation captions appear; notes only in the Student sheet; nothing clipped in light and dark.
awaiting: user response

## Tests

### 1. Roster walkthrough (HV-1)
expected: Family and student create/edit/archive/restore work; blank and 61-character names show captions and keep Save disabled; notes appear only in the Student sheet; "Delete Family" on a family with students shows the blocked footer; nothing clipped in light and dark.
result: [pending]

### 2. Records error path and Settings block (HV-2)
expected: Forced database-open failure shows "Can't open your records" with a full-width Retry button and the tab bar still visible; Settings shows Storage and Build values, never blanks.
result: [pending]

### 3. Storage used value on the phone (HV-3)
expected: Settings shows Storage used as a value like "1.2 MB" (not blank, not Unavailable) and Persistent storage Granted.
result: [pending]

### 4. Students survive an airplane-mode relaunch (HV-4)
expected: A student created in the installed app is still listed under its family after airplane mode + force-quit + relaunch.
result: [pending]

### 5. Update watchdog (HV-5, WR-03)
expected: Tapping Update App either reloads onto the new build or, within about 8 seconds, shows "Couldn't update…" with Not Now visible.
result: [pending]

### 6. Family picker shows the new family immediately (HV-6, WR-05)
expected: Editing a student and picking a different family shows the chosen family with no flash of the old one.
result: [pending]

### 7. VoiceOver: content behind overlays is unreachable (HV-7, WR-06)
expected: With VoiceOver, content behind a sheet, the Archived screen and the Delete alert cannot be reached; alert focus lands on Cancel and returns to the opener on close.
result: [pending]

### 8. Interrupted update keeps data (HV-8)
expected: Tap Update App, force-quit immediately, relaunch in airplane mode: the app opens on either build with families and students intact.
result: [pending]

### 9. Top bar no longer too thick (HV-9, fix 8891d94)
expected: People and Settings headers have no empty band under the Dynamic Island; a Family sheet is not clipped.
result: [pending]

### 10. Prohibition sign-offs and decisions (HV-10, W-1)
expected: P-a, P-b, P-c, P-e pass; decide P-d (cold-launch update activation: accept as platform behaviour or open a gap) and W-1 (archived-record delete dead end: add delete for archived no-history records, or reword the footer).
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
