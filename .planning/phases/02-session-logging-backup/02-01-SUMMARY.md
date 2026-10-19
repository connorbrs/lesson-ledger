---
phase: 02-session-logging-backup
plan: 01
subsystem: ui
tags: [preact, dexie, vitest, session-logging, local-dates, credit-math]
requires:
  - phase: 01-installable-app-roster
    provides: Dexie schema v1 (sessions table), roster data layer, tab/sheet/push UI components
provides:
  - Session row shape (D-06) and typed SessionRow, no schema bump
  - Pure rules - validateSessionFields, creditedMinutes, local-date helpers, the one shared hour formatter, form state
  - sessions repo - createSession, listSessions, getLastSession, loadNameMaps
  - Log tab (pre-fill, presets, per-family credit, sticky Log Session footer, Logged confirmation), Student picker, first flat Sessions list, four-tab bar
affects: [02-02 sessions period view and edit sheet, 02-03 backup, 04 summaries]
status: complete
commits: 3
plan_head_before: abc350b1b53c8519a568cc7a86b846980667f8d5
plan_head_after: ba210d8adf7ba2c25e48448fc54308dc351de0c7
actuals:
  tokens: 14500
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Form state is a pure FormState in domain/; formToInput is the single path to the repo and runs validateSessionFields"
    - "Half credit stored as a mode (full|half) per family; creditedMinutes derives exact minutes, never rounded"
    - "Hour formatting in integer half-minutes (no Math.round, no float division)"
    - "Log draft lives in App (null until first pre-fill) so it survives tab switches"
key-files:
  created:
    - src/domain/session.ts
    - src/domain/sessionForm.ts
    - src/domain/dates.ts
    - src/domain/hours.ts
    - src/data/sessions.ts
    - src/ui/Log.tsx
    - src/ui/SessionFields.tsx
    - src/ui/StudentPicker.tsx
    - src/ui/Sessions.tsx
    - tests/sessions.test.ts
    - tests/dates.test.ts
    - tests/hours.test.ts
    - tests/sessionForm.test.ts
  modified:
    - src/domain/types.ts
    - src/data/db.ts
    - src/ui/App.tsx
    - src/ui/components.tsx
    - src/ui/styles.css
    - tests/roster.test.ts
key-decisions:
  - "FamilyCredit stores lesson/activity as CreditMode per distinct family; attendees snapshot familyId (siblings count once)"
  - "Form date null means today, and picking today's date in the native wheel stores null, so a form left open past midnight saves the new day"
  - "Archived or moved students are pruned from the open Log draft by an effect in Log (familyId refreshed from the live roster)"
  - "Busy ref stays held through the 1.5 s Logged state so a double tap writes exactly one session"
requirements-completed: [LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07]
duration: 4 min
completed: 2026-10-19
coverage:
  - id: D1
    description: "createSession stores a validated session in one transaction; rejection table stores nothing; the Phase 1 delete guard now sees real sessions"
    requirement: "LOG-01"
    verification:
      - kind: unit
        ref: "tests/sessions.test.ts#createSession"
        status: pass
    human_judgment: false
  - id: D2
    description: "Math takes exactly one student, swim one or two; picker toggle/replace rules"
    requirement: "LOG-03"
    verification:
      - kind: unit
        ref: "tests/sessionForm.test.ts#togglePick"
        status: pass
      - kind: unit
        ref: "tests/sessions.test.ts#rejections store nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two-family swim gets per-family Full/Half credit; siblings produce one entry; half is exact"
    requirement: "LOG-05"
    verification:
      - kind: unit
        ref: "tests/sessionForm.test.ts#formToInput credits"
        status: pass
      - kind: unit
        ref: "tests/sessions.test.ts#keeps Half for a two-family swim"
        status: pass
    human_judgment: false
  - id: D4
    description: "Shared hour formatter and local-date helpers are correct under two time zones"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "tests/hours.test.ts"
        status: pass
      - kind: unit
        ref: "TZ=America/Los_Angeles npm test -- tests/dates.test.ts; TZ=Pacific/Auckland npm test -- tests/dates.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Log form pre-fills from the last session and resets after save (pure logic)"
    requirement: "LOG-02"
    verification:
      - kind: unit
        ref: "tests/sessionForm.test.ts#prefillFromSession"
        status: pass
      - kind: unit
        ref: "tests/sessions.test.ts#getLastSession"
        status: pass
    human_judgment: false
  - id: D6
    description: "Log screen on device - native date/time wheels, numeric keypad, sticky footer clearing the tab bar and home indicator at 375/430 px, Logged check timing, light and dark"
    requirement: "LOG-01"
    verification: []
    human_judgment: true
    rationale: "Native pickers, iOS keypad, sticky layout against the home indicator and confirmation timing are device-only (UI-SPEC backstop)"
---

# Phase 2 Plan 1: Session Logging Summary

**Log tab with last-session pre-fill, 30/45/60 minute presets, exact per-family full/half credit for two-family swims, and a validated sessions repo, on pure local-date and integer-minute rules.**

## Performance

- **Duration:** 4 min (2026-10-19T10:12:15Z to 10:16:22Z)
- **Tasks:** 3 (1 tracer, 2 auto/tdd)
- **Files:** 13 created, 6 modified

## Accomplishments

- **Tracer (3d7eb88):** session row shape (D-06), `validateSessionFields`, `createSession`/`listSessions`/`loadNameMaps`, local-date helpers, four-tab bar with Log as launch tab, Student picker, flat Sessions list; `studentHasHistory`/`deleteStudent` now proven against a real `createSession` row.
- **Full fields (2554311):** Date/Start native-wheel overlay rows with Clear Start Time, Subject, three Minutes blocks with 30/45/60 presets and the whole-minutes caption, conditional per-family credit groups with the exact "Credited:" footer, picker footers and empty state, the single integer-arithmetic hour formatter.
- **Speed loop (ba210d8):** `getLastSession`, `prefillFromSession`, App-held draft, one-time pre-fill, sticky footer measured with ResizeObserver, "Logged ✓" for 1.5 s with scroll-to-top and reset, `sessionSaveErrorMessage`.
- Verification: `npm test` (169 passed), `npm run build`, `node scripts/check-dist.mjs` (14 checks) all pass; date tests also pass under TZ=America/Los_Angeles and TZ=Pacific/Auckland. Acceptance greps clean (no toISOString, no Math.round in hours.ts, no raw-HTML sinks, no network code, runtime deps still dexie and preact, `db.version(` count 1).

## Task Commits

1. Task 1 (tracer) - `3d7eb88` feat(02-01)
2. Task 2 - `2554311` feat(02-01)
3. Task 3 - `ba210d8` feat(02-01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 1 fixture rows no longer type-check against the typed SessionRow**
- **Found during:** Task 1 (`npm run build`)
- **Issue:** tests/roster.test.ts inserted partial rows `{ id, attendees: [{ studentId }] }`; the stricter `Attendee` type (adds familyId) made `tsc` fail.
- **Fix:** cast the two fixture rows `as never`, as the file already does for its malformed-row fixture. Behavior unchanged.
- **Files modified:** tests/roster.test.ts
- **Commit:** 3d7eb88

**2. [Rule 2 - Missing critical] Keep draft attendees in sync with the live roster, including family**
- **Found during:** Task 3
- **Issue:** the plan prunes archived students from the draft; a student moved to another family while the draft is open would also fail createSession with student-missing.
- **Fix:** the same effect refreshes each attendee's familyId from the live roster.
- **Files modified:** src/ui/Log.tsx
- **Commit:** ba210d8

**3. [Plan adjustment] Student picker no longer auto-closes when no students remain**
- The Task 1 draft auto-popped the picker on an empty roster; Task 2 removed it so the UI-SPEC empty state (heading and body, Back returns) is reachable. No behavior outside the spec.

**Total deviations:** 3 (1 blocking, 1 missing-critical, 1 plan adjustment). **Impact:** none on scope.

## Authentication Gates

None.

## Known Stubs

None. Sessions.tsx is an intentionally minimal flat list, replaced by the period view in plan 02-02 (stated in the plan).

## Threat Flags

None. No network code, no new storage surface, no schema change (Dexie still version 1).

## Issues Encountered

None. Device-only checks (native wheels, numeric keypad, sticky footer against the home indicator, Logged timing) remain for on-device verification (coverage D6, `human_judgment: true`).

## Next Phase Readiness

Ready for 02-02: `SessionFields`, `StudentPicker` (with `inSheet`), `sessionSaveErrorMessage`, `formToInput`, `listSessions` and `loadNameMaps` are the reusable pieces for the period view and Edit Session sheet.

## Self-Check: PASSED

- All created files exist on disk; commits 3d7eb88, 2554311, ba210d8 are on `main`; `npm test`, `npm run build`, `node scripts/check-dist.mjs` pass.
