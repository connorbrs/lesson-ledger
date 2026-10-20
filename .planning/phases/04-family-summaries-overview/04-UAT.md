---
status: testing
phase: 04-family-summaries-overview
source: [04-VERIFICATION.md, 04-06-SUMMARY.md]
started: 2026-10-20T05:49:13Z
updated: 2026-10-20T05:49:13Z
---

## Current Test

number: 1
name: Five tabs fit
expected: |
  Push main, update the app (Settings → About shows the new build). Five tabs show; "Summaries" label fits.
awaiting: user response

## Tests

### 1. Five tabs fit
expected: Push main, update the app (Settings → About shows the new build). Five tabs show; "Summaries" label fits.
result: [pending]

### 2. Instructor name
expected: Settings → Instructor: set, clear (shows "Not set"), set again.
result: [pending]

### 3. Turkish message content
expected: Log the test sessions (Test Smith swim 45+15 with $18.75 receipt expense, math 60; shared swim 45 with Test Jones on Half, 20 travel, $10.01 no-photo expense). Summaries → Test Smith shows warnings list and a Turkish message ("Pzt 12 Eki", "Yüzme", "0,75 saat (0:45)"), no travel; Test Jones lesson reads "0,38 saat (0:23)".
result: [pending]

### 4. Copy into Messages
expected: Copy Message and paste into a Messages draft: Turkish letters, line breaks and dashes intact.
result: [pending]

### 5. Saved message and stale banner
expected: Edit + Save persists after reopening; Back with unsaved edits asks to discard; changing a session's minutes shows "Hours changed since you edited this message"; Rebuild Message (confirm) updates it.
result: [pending]

### 6. Sent tracking
expected: Mark as Sent shows a Sent pill; Not Sent undoes; changing only travel shows "Changed since sent" on the row and in the summary.
result: [pending]

### 7. Share PDF
expected: Share PDF opens the iOS share sheet (not a download); sends to Messages and Mail; PDF has header, session/expense/total sections, receipt page with caption, page footer; ş ğ ı İ ü ç ö render as real letters.
result: [pending]

### 8. Offline PDF
expected: Airplane mode, force-quit, relaunch: Share PDF still works.
result: [pending]

### 9. Big monthly PDF
expected: Monthly family with ~30+ receipt photos: note Preparing PDF time; app does not reload/blank; share works; note page count and size.
result: [pending]

### 10. Backup v3 round trip
expected: Back Up Now, then change instructor name / sent mark / saved message, restore: everything returns. Finally restore the pre-test backup.
result: [pending]

### 11. Personal totals
expected: Sessions → Week → test week: Totals include the 20 travel; Student / Family / Subject views; empty week shows no totals. Period arrows switch without flicker.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
