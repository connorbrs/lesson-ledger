---
phase: 01-installable-app-roster
plan: 03
subsystem: ui
tags: [preact, dexie, indexeddb, validation, roster, tdd, css-tokens, ios-native-ui]

requires:
  - phase: 01-installable-app-roster
    provides: Dexie schema v1 (families, students, sessions), useLive hook, createFamily/listActiveFamilies tracer, base-path PWA build and check-dist
provides:
  - Pure validation (trim, NFC, 60 code point names, period and subject enums, RosterError codes) and roster ordering and labels
  - Family and student repos with single-transaction writes, idempotent archive and restore, and delete guards checked inside the delete transaction
  - UI-SPEC shell: design tokens (light and dark), tab bar, People tab, Family sheet, Student sheet, family picker, Archived screen, delete and discard alerts
  - UI-SPEC amended to Lesson Ledger name, clock icon, three-segment control and the Student fields
affects: [01-04, phase-2, phase-3, phase-4]

plan_head_before: aa267e139ce38edf64a2538efb7b7c74a2b96f61
plan_head_after: ff86e2fcb00209d21ce18b1d4828fcd1165395c3

actuals:
  tokens: 28270
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Validators in src/domain are pure; every repo write calls them first, then runs one db.transaction over every table it reads or writes"
    - "Create defaults (period weekly, subject both, notes empty) apply only to undefined input so empty and unknown values still reach the validator"
    - "Archived and active lists filter archivedAt in memory (null is not a valid IndexedDB key) and sort with compareRoster"
    - "Sheets and pushed screens play their exit animation through useAnimatedClose (animationend plus a timer backstop)"
    - "A synchronous useRef guard sits in front of the saving state so a double tap writes once"

key-files:
  created:
    - src/domain/validate.ts
    - src/domain/roster.ts
    - src/data/students.ts
    - tests/validation.test.ts
    - tests/roster.test.ts
    - src/ui/styles.css
    - src/ui/components.tsx
    - src/ui/People.tsx
    - src/ui/FamilySheet.tsx
    - src/ui/StudentSheet.tsx
    - src/ui/Archived.tsx
  modified:
    - src/data/families.ts
    - src/ui/App.tsx
    - .planning/phases/01-installable-app-roster/01-UI-SPEC.md

key-decisions:
  - "DeleteResult lives in src/domain/roster.ts so both repos share it without a data-to-data import"
  - "Validators are strict about defaults (undefined period or subject is invalid); the repos apply the weekly and both defaults"
  - "Student Save requires the chosen family to be in the active list; a family archived while the sheet is open reads as Choose Family"
  - "Private notes are touched only in StudentSheet.tsx; the CSS class for the field is note-field so the grep gate over src/ui finds one path"
  - "Straight apostrophes are used in copy exactly as the UI-SPEC and plan write it; only the quotation marks around names are curly"

requirements-completed: [FAM-01, FAM-02, FAM-03, FAM-04]

coverage:
  - id: D1
    description: "Name rules: empty, whitespace-only, null, 60 code points (including 60 emoji) accepted, 61 rejected, decomposed e plus U+0301 stored as U+00E9"
    requirement: FAM-01
    verification:
      - kind: unit
        ref: "tests/validation.test.ts#validateFamilyInput name rules"
        status: pass
    human_judgment: false
  - id: D2
    description: "Family create, update, archive and restore are validated, single-transaction and idempotent; two identical creates make two records"
    requirement: FAM-01
    verification:
      - kind: unit
        ref: "tests/roster.test.ts#family repo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Period is weekly or monthly with the exact labels; ordering is case-insensitive with deterministic tie-breaks"
    requirement: FAM-02
    verification:
      - kind: unit
        ref: "tests/roster.test.ts#roster ordering and labels"
        status: pass
      - kind: unit
        ref: "tests/validation.test.ts#validateFamilyInput period rules"
        status: pass
    human_judgment: false
  - id: D4
    description: "Students belong to exactly one active family, default to Both with empty notes, archive and restore idempotently, same-name students stay separate"
    requirement: FAM-03
    verification:
      - kind: unit
        ref: "tests/roster.test.ts#student repo"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delete is allowed only without history (family with any student, student with any session is blocked) and the delete-versus-create race never leaves a student under a missing family"
    requirement: FAM-04
    verification:
      - kind: unit
        ref: "tests/roster.test.ts#family repo (refuses to delete a family with an active student or only an archived student)"
        status: pass
      - kind: unit
        ref: "tests/roster.test.ts#student repo (deletes a student with no sessions and blocks one with a session)"
        status: pass
      - kind: unit
        ref: "tests/roster.test.ts#concurrency"
        status: pass
    human_judgment: false
  - id: D6
    description: "Notes render only inside the Student sheet; grep over src/ui finds .notes in StudentSheet.tsx only; no raw-HTML injection and no external URLs in src/ui"
    requirement: FAM-03
    verification:
      - kind: other
        ref: "grep -rl '\\.notes' src/ui; grep -rnE 'dangerouslySet|\\.inner(HTML|Text)' src; grep -rn 'https://' src/ui"
        status: pass
    human_judgment: false
  - id: D7
    description: "People, Family sheet, Student sheet, picker, Archived and alerts look and behave like the UI-SPEC at 375 and 430 px in light and dark, with keyboard focus on open and correct slide motion"
    requirement: FAM-01
    verification:
      - kind: other
        ref: "npm run build (tsc strict) and check-dist pass; the UI was not rendered in a browser in this run"
        status: pass
    human_judgment: true
    rationale: "Visual layout, spacing, color, motion and iOS keyboard focus need a browser or device; the two plan human-check blocks are harvested at end-of-phase verification"
  - id: D8
    description: "UI-SPEC carries Lesson Ledger on all eight lines, the clock icon sentence, the three-segment control line and the Student sheet fields and copy"
    requirement: FAM-03
    verification:
      - kind: other
        ref: "grep counts: Lesson Log 0, Lesson Ledger 9, two-line wave glyph 0, Segmented control: 2 segments 0"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-19
status: complete
---

# Phase 1 Plan 03: Roster Logic and UI Summary

**Tested roster rules (trim, NFC, 60 code point names, idempotent archive, delete guards checked inside the delete transaction) plus the full native-feel UI: tab bar, People, Family and Student sheets, family picker, Archived screen, with the UI-SPEC amended to Lesson Ledger, the clock icon and the Student fields.**

## Accomplishments

- Task 1 (TDD): `validate.ts` and `roster.ts` are pure (no Dexie, no Preact). `families.ts` was rewritten and `students.ts` added; every write validates first and then runs one `db.transaction` over each table it touches. Create-student and update-student check the family inside the same transaction, and `deleteFamily` and `deleteStudent` run their guards in the delete transaction. The `Promise.allSettled` race test (10 rounds) lands in one of the two consistent states every time. 64 tests pass, including the 4 tracer tests.
- Task 2: `styles.css` carries every token from the UI-SPEC (light and dark, spacing, radii, type roles, safe areas, reduced-motion fallback), `components.tsx` the shared pieces and icons, and the People tab, Family sheet (validation captions after blur, save-failed copy, discard alert, archive, guarded delete with failure state) and Archived screen. Tab bar shows People and Settings only; Settings renders its large title.
- Task 3: Student sheet with Name, Family row and pushed family picker (active families only, accent check, pops back if the list empties), Swim / Math / Both control (Both preselected), auto-growing Private Notes field with no cap, archive and guarded delete. People now lists student rows, the count footer and Add Student with the family preset. Archived restores students. UI-SPEC amended in place.
- No new packages were installed.

## Task Commits

1. Task 1 RED: `d49ee2d` test(01-03) failing tests plus throwing stubs
2. Task 1 GREEN: `25a3b57` feat(01-03) validation, ordering, labels, guarded repos
3. Task 2: `2bbf276` feat(01-03) UI shell and families slice
4. Task 3: `ff86e2f` feat(01-03) students slice and UI-SPEC amendments

## TDD Gate Compliance

- **RED:** `d49ee2d`. Target test `tests/validation.test.ts > validateFamilyInput name rules > accepts a 60 code point name`, run as `npx vitest run tests/validation.test.ts -t "accepts a 60 code point name" --reporter=tap-flat` (exit 1). `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`, no report errors). The full-suite TAP report could not be parsed because Vitest prints multi-line assertion diffs, so the single-target rerun was recorded instead. The full suite failed 58 of 64 tests before implementation. semanticAssessment: the target executed and failed on the throwing `validateFamilyInput` stub ("not implemented"), the planned behavior being absent; no syntax, import or fixture fault.
- **GREEN:** `25a3b57`. All 64 tests pass.
- **REFACTOR:** none needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test helper defaulted an undefined period**
- **Found during:** Task 1 GREEN run
- **Issue:** `ok(name, period = 'weekly')` in `tests/validation.test.ts` turned the `undefined` period case into `'weekly'`, so the "undefined gives period-invalid" case could not fail.
- **Fix:** The helper now defaults only when the argument is omitted.
- **Files modified:** tests/validation.test.ts
- **Commit:** 25a3b57

**2. [Rule 3 - Blocking] RED needed throwing stubs**
- **Found during:** Task 1 RED
- **Issue:** Tests that import modules that do not exist fail at load, which the RED gate classifies as invalid RED.
- **Fix:** The RED commit includes throwing stubs for `validate.ts`, `roster.ts` and `students.ts`, replaced in the GREEN commit.
- **Files modified:** src/domain/validate.ts, src/domain/roster.ts, src/data/students.ts
- **Commit:** d49ee2d

**Total deviations:** 2 auto-fixed (1 bug in a test helper, 1 blocking). **Impact:** none on scope.

## Notes for Later Plans

- `App.tsx` was replaced wholesale as the plan says, which removed the temporary "Device check" link. `?spike` still works by URL; Plan 04 still has to delete `src/spike.tsx` and the dynamic import in `src/main.tsx`.
- Phase 2 contract: `studentHasHistory` reads `attendees[].studentId` on `sessions` rows; the test inserts a raw row to exercise it.
- Plan 04 supplies the Records error boundary, the nav error row and the Settings groups that this plan's UI considerations point to.

## Issues Encountered

- The UI could not be rendered here: no browser is installed and no DOM test library is in the project (adding one would be an unapproved package). Verification for Tasks 2 and 3 is `tsc --noEmit` (strict), the Vite build, `check-dist` (11 checks) and the grep gates. The two `<human-check>` blocks (375 and 430 px, light and dark, focus on open, slide motion, textarea growth) are left for end-of-phase verification, as the plan states. Focus on sheet open uses a programmatic `focus()` after mount, which iOS may not honor as a keyboard-opening gesture; confirm on the device.
- A formatter appears to rewrite files after they are written (line counts grew and escapes such as `·` became literal characters). Behavior is unchanged.

## Authentication Gates

None.

## Known Stubs

None. "No students yet" is the real empty state, not a placeholder.

## Threat Flags

None. No new network endpoints or storage surfaces; T-01-10 (no raw-HTML injection, grep gate clean), T-01-11 (validators in every repo write, tested without the UI), T-01-12 (notes only in StudentSheet.tsx, grep prints one path) and T-01-13 (no cascade, guards inside the delete transaction, Promise.all race test) are mitigated as planned.

## Verification

- `npm test`: 3 files, 64 tests pass
- `npm run build`: tsc clean, Vite build OK
- `node scripts/check-dist.mjs`: `check-dist: OK (11 checks)`
- `grep -rl "\.notes" src/ui` prints only `src/ui/StudentSheet.tsx`
- Task acceptance greps: tokens (00707A, 5FD3DE, C2001F, FF6B63) each present; dark scheme, reduced motion and both safe-area insets present; `No families yet` in People.tsx; `Weekly · Monday to Sunday` in roster.ts; no `dangerouslySet` or `.innerHTML`; no `https://` in src/ui; `Lesson Log` 0 and `Lesson Ledger` 9 in the UI-SPEC; `two-line wave glyph` 0; `Segmented control: 2 segments` 0

## Self-Check: PASSED

- All 14 listed source and test files plus the amended UI-SPEC exist on disk.
- Commits d49ee2d, 25a3b57, 2bbf276 and ff86e2f are ancestors of HEAD.
