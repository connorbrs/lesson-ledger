---
phase: 01-installable-app-roster
plan: 05
subsystem: ui
tags: [preact, archived, delete, alert, fam-04, gap-closure]

requires:
  - phase: 01-installable-app-roster
    provides: Archived screen, deleteStudent/deleteFamily guards, Alert component with inert-behind logic, delete-failed copy
provides:
  - Delete Student and Delete Family rows on the Archived screen (shown only where the existing guards allow it)
  - Blocked-family note rows on the Archived screen
  - ArchivedDeleteAlert, a shared confirm alert mounted beside the pushed layer
  - "archived delete path" tests over the unchanged delete guards
  - 01-04-PLAN.md P-d wording (accepted cold-launch activation) and UI-SPEC copy for the Archived delete rows
affects: [phase-2]

plan_head_before: e66cbb8cd422caa5644dfb830e87e46cc2be0645
plan_head_after: d130417f98a4152e7eba642dfcfb72465a1cbae1
commits: 3

actuals:
  tokens: 4604
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Confirm alerts for a pushed screen are mounted by the screen as a sibling of PushLayer so they become a direct child of .app and the Alert inert logic covers the pushed layer and tab bar"
    - "UI hides Delete only as a convenience; deleteStudent and deleteFamily remain the single source of the delete rules"

key-files:
  created: []
  modified:
    - src/ui/Archived.tsx
    - src/ui/App.tsx
    - tests/roster.test.ts
    - .planning/phases/01-installable-app-roster/01-04-PLAN.md
    - .planning/phases/01-installable-app-roster/01-UI-SPEC.md

key-decisions:
  - "Delete is a full-width destructive Row beneath the record's Restore row, not a second trailing button (no CSS change)"
  - "The blocked-family text is a per-family note row, not a Group footer, because the Families group lists several families"
  - "P-d resolution (recorded as the HV-10 resolution, 2026-10-19): activation of a waiting service-worker update on the next cold launch after a full force-quit is accepted platform behaviour; no reload while the app is open. Written into the 01-04 APP-05 prohibition and Update available truth."

patterns-established:
  - "ArchivedDeleteAlert: busy ref plus state, same shape as FamilySheet confirmDelete, reused delete-failed copy"

requirements-completed: [FAM-04]

coverage:
  - id: D1
    description: "Archived student with no sessions can be deleted from the Archived screen through a confirm alert using the existing guard"
    requirement: "FAM-04"
    verification:
      - kind: unit
        ref: "tests/roster.test.ts#deletes an archived student with no sessions, then its emptied archived family"
        status: pass
    human_judgment: false
  - id: D2
    description: "Archived student with a session, and its archived family, stay undeletable"
    requirement: "FAM-04"
    verification:
      - kind: unit
        ref: "tests/roster.test.ts#keeps an archived student with a session, and its archived family, undeletable"
        status: pass
    human_judgment: false
  - id: D3
    description: "Archived family with no students shows Delete Family; with students it shows the blocked note, which turns into Delete Family live after the last student is deleted"
    requirement: "FAM-04"
    verification:
      - kind: other
        ref: "npm run build (tsc) plus check-dist bundle contains 'Delete its archived students first'"
        status: pass
    human_judgment: true
    rationale: "Row layout, note wrapping at 375/430 px, dark mode and live note-to-row transition need eyes; no DOM test environment exists"
  - id: D4
    description: "Delete alert is a direct child of the app root: list, Back button and tab bar are inert behind it, focus lands on Cancel and returns to the opener"
    verification: []
    human_judgment: true
    rationale: "VoiceOver behaviour on the installed app cannot be automated"
  - id: D5
    description: "01-04-PLAN.md records the P-d decision; UI-SPEC carries the Archived delete copy"
    verification:
      - kind: other
        ref: "grep gates from Task 3 acceptance criteria"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-19
status: complete
---

# Phase 1 Plan 05: Delete Archived Records Summary

**Archived students with no sessions and archived families with no students can now be hard-deleted from the Archived screen through a confirm alert that reuses the unchanged deleteStudent/deleteFamily guards, closing gap G-01-10.**

## Performance

- **Duration:** about 8 min
- **Tasks:** 3 of 3
- **Files modified:** 5 (no file created or deleted)

## Accomplishments

- Task 1 (tracer): `Archived` takes an `onDelete` prop; each archived student with no history gets a destructive "Delete Student" row under its Restore row. `ArchivedDeleteAlert` (title Delete "name"?, "This can't be undone.", Cancel plus Delete Student/Delete Family, failed copy reused) is mounted by `ArchivedScreen` in `App.tsx` as a sibling of `PushLayer`. Two roster tests pin the archived-student-then-archived-family delete path and the blocked history case.
- Task 2: each archived family carries `hasStudents`; no students gives a "Delete Family" row, otherwise a note row ("This family still has students. Delete its archived students first." when any of its students is archived, "This family still has active students. Restore it to manage them." otherwise). The live query turns the note into the Delete Family row after the last student is deleted. The existing `onEmpty` path pops back to People; no new pop-back code.
- Task 3: 01-04-PLAN.md APP-05 prohibition and "When a new service worker is waiting" truth now record the 2026-10-19 P-d decision; 01-UI-SPEC.md gained the two blocked-family copy rows, the extended "Delete action labels" row and the Archived screen-map text.

## P-d resolution (HV-10)

P-d (APP-05) is resolved as accepted platform behaviour, per the user's 2026-10-19 decision in UAT test 10: after a full force-quit iOS activates a waiting service worker on the next cold launch without a tap; nothing is open then, so no input or data is lost. While the app is open nothing applies an update or reloads without Update App.

## Task Commits

1. Task 1 (tracer): `a9febeb` feat(01-05): delete archived no-history students from the Archived screen
2. Task 2: `e93fa7a` feat(01-05): delete archived families with no students, blocked-family note
3. Task 3: `d130417` docs(01-05): record P-d decision in 01-04 plan and Archived delete copy in UI-SPEC

## Verification

- `npm test`: 86 passed (baseline 84, plus the two "archived delete path" tests); `npm run build` (tsc plus vite) and `node scripts/check-dist.mjs` (14 checks) pass; `grep -l "Delete its archived students first" dist/assets/*.js` prints one path.
- sha256 of `src/data/families.ts`, `src/data/students.ts`, `src/ui/components.tsx`, `src/ui/styles.css` match the recorded hashes; `git diff` shows no change to them.
- `grep -rnE "dangerouslySet|\.inner(HTML|Text)" src` finds nothing; `grep -rl "\.notes" src/ui` prints only `src/ui/StudentSheet.tsx`; `footer=` count in Archived.tsx is 0.
- Task 3 greps pass. One literal difference: the criterion `grep -c "accepted platform behaviour"` (at least 2) counts 1 case-sensitively because the prohibition statement begins "Accepted platform behaviour" as the plan's own wording prescribes; `grep -ci` counts 2 (prohibition and truth). The new truth line and both statement lines remain well-formed quoted scalars (regex gates pass); a YAML parser was not available to double-check.
- Pending human checks (harvested at end-of-phase verification, gap G-01-10): the narrow-viewport row/alert/dark-mode check and the installed-app VoiceOver check for the new alert.

## Deviations from Plan

None - plan executed exactly as written. Roster tests use the `attendees: [{ studentId }]` session row shape (as in the existing delete test), matching the plan's "attendees array" wording.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or storage surface; names render through JSX text only (T-01-21 grep gates clean).

## Issues Encountered

None.

## Self-Check: PASSED

- src/ui/Archived.tsx, src/ui/App.tsx, tests/roster.test.ts, 01-04-PLAN.md, 01-UI-SPEC.md modified and committed; commits a9febeb, e93fa7a, d130417 are ancestors of HEAD.
