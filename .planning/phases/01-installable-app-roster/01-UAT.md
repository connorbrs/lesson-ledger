---
status: complete
phase: 01-installable-app-roster
source: [01-VERIFICATION.md]
started: 2026-10-19T00:00:00Z
updated: 2026-10-19T09:27:21.693Z
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

### 11. Delete archived records on the phone (HV-A/HV-B, gap G-01-10)
expected: On the Archived screen (light and dark), an archived student with no lessons shows Delete Student; confirming asks "Delete “{name}”?" with Cancel / Delete Student and removes it; the family's note then turns into Delete Family, which removes the family too; nothing behind the popup can be tapped; when nothing archived is left it returns to People.
result: pass

### 12. Blocked-family note wording (HV-D)
expected: Decide: keep "This family still has students. Delete its archived students first." for all cases (lesson history only exists from Phase 2), or reword it for students that have lessons in Phase 2.
result: skipped
reason: "Deferred follow-up: reword the blocked-family note for archived students with lesson history when Phase 2 adds sessions"

## Summary

total: 12
passed: 10
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps
- gap_id: G-01-10
  truth: "Archived families and students with no lesson history can be deleted from the Archived screen, so a family whose only students are archived (and have no history) can be fully removed"
  status: resolved
  resolved_by: 01-05-PLAN.md
  resolved_at: 2026-10-19
  reason: "User reported: W-1 decision — add Delete for archived records with no history (currently the Archived screen has only Restore, so the 'Remove them before deleting the family' footer is a dead end)"
  severity: minor
  test: 10
  root_cause: "src/ui/Archived.tsx offers only Restore Family / Restore Student; deleteStudent/deleteFamily (src/data/students.ts, src/data/families.ts) are only reachable from the edit sheets of ACTIVE records. deleteFamily blocks on any student (active or archived), so a family whose students are all archived can never be deleted. Diagnosed from 01-VERIFICATION.md W-1 (orchestrator, no debug session needed)."
  artifacts:
    - path: "src/ui/Archived.tsx"
      issue: "no delete action for archived families/students"
    - path: "src/data/families.ts"
      issue: "deleteFamily refuses while any student exists, including archived no-history students"
  missing:
    - "Delete Student on archived students with no history (confirm alert, reuse deleteStudent guard)"
    - "Delete Family on archived families with no students (confirm alert, reuse deleteFamily guard); footer explains to delete the archived students first when blocked"
    - "Amend 01-04 prohibition P-d wording: cold-launch activation of a waiting update after a full force-quit is accepted platform behaviour (user decision 2026-10-19)"
  debug_session: ""

## Decisions

- P-d (APP-05): accepted 2026-10-19 — after a full force-quit, iOS activates the waiting service worker on the next cold launch without a tap; no reload happens while the app is open and no input or data is lost. Amend the 01-04 prohibition wording accordingly.
- P-a, P-b, P-c, P-e: signed off as pass.

## Deferred Follow-Ups

- test: 12
  idea: "Reword the Archived blocked-family note ('Delete its archived students first') for archived students that have lesson history, once Phase 2 adds sessions"
  deferred_at: 2026-10-19
