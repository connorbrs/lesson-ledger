---
phase: 01-installable-app-roster
plan: 02
subsystem: infra
tags: [github-pages, github-actions, pwa, ios, device-spike, indexeddb]

requires:
  - phase: 01-installable-app-roster
    provides: Base-path-correct (/lesson-ledger/) PWA build, Dexie database, check-dist.mjs build checks
provides:
  - GitHub Pages deploy workflow (test, build, check-dist, publish dist/) with least-privilege permissions
  - Live app at https://connorbrs.github.io/lesson-ledger/ (page, manifest.webmanifest and sw.js all HTTP 200)
  - Temporary ?spike device-check page (storage info and 2 MB Blob round trip), reachable via a Device check link
  - 01-SPIKE-RESULTS.md with recorded on-device iOS findings (iOS 26.6.1)
affects: [01-03, 01-04, phase-2, phase-3]

plan_head_before: 32998c27c778168b95fc51161a42570cf5c00846
plan_head_after: d0a0add8504dbd69f4470cdd01c0e5b814a3c8ac

actuals:
  tokens: 1984
  tasks: 5
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Deploy workflow uses only actions/* at current majors (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5); no secrets"
    - "Device-check page is lazy-loaded via dynamic import so it gets its own chunk and can be deleted cleanly in Plan 04"

key-files:
  created:
    - .github/workflows/deploy.yml
    - src/spike.tsx
    - .planning/phases/01-installable-app-roster/01-SPIKE-RESULTS.md
  modified:
    - src/main.tsx
    - src/ui/App.tsx

key-decisions:
  - "Origin fixed by user choice: personal-account, GitHub username connorbrs, so the permanent origin is https://connorbrs.github.io/lesson-ledger/ (D-03, one-way)"
  - "Safari tab and home-screen app keep separate data on iOS 26.6.1, so Plan 04 ships the UI-SPEC Safari-tab banner sentence as written"
  - "The real iOS version is 26.6.1; the OS 18_7 token in the user agent is Safari's frozen UA value, not the OS version"

patterns-established:
  - "Device facts live in 01-SPIKE-RESULTS.md as eleven key: value lines that later plans grep"

requirements-completed: [APP-01, APP-02, APP-03]

coverage:
  - id: D1
    description: "Deploy workflow runs npm ci, npm test, npm run build and check-dist, then publishes dist/ to GitHub Pages"
    requirement: APP-03
    verification:
      - kind: other
        ref: "GitHub Actions latest run conclusion=success at head 86f55e0 (orchestrator-verified)"
        status: pass
    human_judgment: false
  - id: D2
    description: "App is live at the confirmed origin; page, manifest and service worker return HTTP 200"
    requirement: APP-03
    verification:
      - kind: other
        ref: "orchestrator fetch of /, /manifest.webmanifest, /sw.js; manifest name Lesson Ledger"
        status: pass
    human_judgment: false
  - id: D3
    description: "Installed from Safari with no developer account, opened full screen, relaunched offline with data intact, icon correct"
    requirement: APP-01
    verification: []
    human_judgment: true
    rationale: "Observed on a physical iPhone by the user (Task 4, Parts B to D); no automation can drive the device"
  - id: D4
    description: "Device spike findings recorded (persist, estimate, Blob round trip, Safari versus home-screen data separation)"
    requirement: APP-02
    verification:
      - kind: other
        ref: "grep -c of the eleven keys in 01-SPIKE-RESULTS.md prints 11"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-10-18
status: complete
---

# Phase 1 Plan 02: Deploy and iPhone Device Spike Summary

**Walking Skeleton is live on GitHub Pages at connorbrs.github.io/lesson-ledger, and an iPhone spike on iOS 26.6.1 confirmed persist() true, IndexedDB Blob round trip, separate Safari-versus-home-screen data, and offline relaunch with data intact.**

## Performance

- **Duration:** 33 min (wall clock, includes the human checkpoints)
- **Started:** 2026-10-18T23:04-07:00
- **Completed:** 2026-10-18
- **Tasks:** 5 (2 auto, 1 blocking-human decision, 2 human-action)
- **Files modified:** 5

## Accomplishments

- Added `.github/workflows/deploy.yml`: triggers on push to main and manual dispatch, permissions limited to contents read, pages write and id-token write, no secrets, only `actions/*` actions. Majors used: checkout v7, setup-node v7 (Node 24), upload-pages-artifact v5, deploy-pages v5.
- Added the temporary `?spike` device-check page (`src/spike.tsx`) with user agent, standalone flags, persist()/persisted(), estimate(), family count, and a 2 MB Blob write/read-back/delete; lazy-loaded from `src/main.tsx` and linked from `src/ui/App.tsx` as "Device check".
- Origin confirmed by the user before anything was created or pushed (personal-account, `connorbrs`); repo created, Pages source set to GitHub Actions, first deploy green, live URLs verified.
- User ran the on-device spike; results recorded in `01-SPIKE-RESULTS.md` with no BLOCKER implications.

## Task Commits

1. **Task 1: Deploy workflow and device-check page** - `86f55e0` (feat)
2. **Task 2: Origin decision (blocking-human)** - no commit (user chose personal-account, connorbrs)
3. **Task 3: Create repo, enable Pages, push (human-action)** - no commit (orchestrator added `origin`; user created repo, set Pages source, pushed; live URLs and Actions run verified)
4. **Task 4: iPhone device spike (human-action)** - no commit (results supplied by user)
5. **Task 5: Record spike results** - `d0a0add` (docs)

## Device Spike Findings (see 01-SPIKE-RESULTS.md)

| Finding | Result |
|---------|--------|
| iOS version | 26.6.1 (UA's "OS 18_7" is the frozen token) |
| Home-screen persist()/persisted() | true / true |
| Home-screen estimate | 231471 bytes used of 41231686042 quota |
| Blob round trip (Safari, home-screen) | ok, ok |
| Safari tab versus home-screen data | separate |
| Airplane-mode relaunch after force-quit | ok, Home Test still listed |
| Icon, full screen | ok, ok |
| Not reported | device-model, numeric safari-tab-persisted |

## Decisions Made

- Origin is `https://connorbrs.github.io/lesson-ledger/`; this is one-way, because the iPhone stores data per origin.
- Plan 04 may ship the UI-SPEC Safari-tab banner sentence about separate data as written.
- The Settings storage footer for the persisted state is the one expected on this device; Phase 2 backup remains the protection regardless.

## Deviations from Plan

None - plan executed exactly as written. Two spike fields (device-model, numeric safari-tab-persisted) were not reported by the user; they are recorded as "not reported" in the results file and do not affect any later plan.

## Auth Gates

Tasks 2 to 4 were planned human checkpoints (account decision, GitHub repo creation and push, on-device checks), not failures.

## Issues Encountered

None.

## Known Stubs

None. `src/spike.tsx` is intentionally temporary and is scheduled for removal in Plan 04 (gated).

## Threat Flags

None. The `?spike` page reads only device/storage facts and writes only a deletable Blob row, as planned (T-01-08).

## Next Phase Readiness

- Plans 03 and 04 can read `01-SPIKE-RESULTS.md`. Plan 04 must remove `src/spike.tsx`, the `Device check` link and the dynamic import from `main.tsx`.
- Open follow-up: observe persisted()/estimate over several days (RESEARCH A7) and append to the Follow-up section.
- Public repo note: `.planning/` is publicly readable on GitHub (T-01-06, accepted).

## Self-Check: PASSED

- FOUND: .github/workflows/deploy.yml, src/spike.tsx, 01-SPIKE-RESULTS.md
- FOUND commits: 86f55e0, d0a0add
