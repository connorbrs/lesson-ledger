---
status: testing
phase: 02-session-logging-backup
source: [02-VERIFICATION.md]
started: 2026-10-19T00:00:00Z
updated: 2026-10-19T00:00:00Z
---

## Current Test

number: 1
name: Log form on the phone
expected: |
  Date and Start open native wheels, Start/Finish wheels step by 1 minute, Duration (typed minutes, shown h:mm) and Finish stay in sync, Lesson = Duration − Activity, number fields open the keypad, Log Session sits above the tab bar at all times, and "Logged ✓" shows then the form resets pre-filled.
awaiting: user response

## Tests

### 1. Log form on the phone
expected: Date and Start open native wheels, Start/Finish wheels step by 1 minute, Duration (typed minutes, shown h:mm) and Finish stay in sync, Lesson = Duration − Activity, number fields open the keypad, Log Session sits above the tab bar at all times, and "Logged ✓" shows then the form resets pre-filled.
result: [pending]

### 2. Shared swim credit
expected: Two students from different families on a swim session show Full/Half for lesson and for activity per family with credited minutes; two siblings show no credit controls; Math allows only one student.
result: [pending]

### 3. Sessions tab
expected: Week/Month toggle and ‹ › move between periods; rows show date, students, subject and time; at 200% zoom nothing scrolls sideways.
result: [pending]

### 4. Edit, discard and delete on the phone
expected: Tapping a session opens Edit; Cancel with changes asks to discard; Delete Session asks to confirm and removes it; double-tapping Save/Delete/Log Session only acts once.
result: [pending]

### 5. Backup reminder and same-day backups
expected: Log shows the backup line; backing up twice the same day in Files does not silently overwrite (Keep Both / Replace prompt or distinct names).
result: [pending]

### 6. Decision: receipt photos in backups (W1)
expected: Accept that backups include receipt photos starting in Phase 3 (Phase 2 backs up records only and refuses if receipts exist), or reopen now.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
