---
phase: 01-installable-app-roster
plan: 04
subsystem: pwa
tags: [pwa, service-worker, persistent-storage, update-prompt, safari-banner, preact, vitest, device-acceptance]

requires:
  - phase: 01-installable-app-roster
    provides: base-path PWA build with vite-plugin-pwa (prompt mode), UI shell and tab bar, device spike results (safari-tab-data separate)
provides:
  - Single-flight helper, standalone detection, persistent-storage request and usage read with timeout, byte formatting
  - useAppUpdate hook over the service-worker update lifecycle (no data-layer imports)
  - Settings tab (Storage and About groups, Build row), Safari-tab banner, Update banner, Records error screen
  - __BUILD_ID__ build constant; check-dist C12 to C14
  - Temporary device-check harness removed from src and dist
  - Recorded on-device acceptance on iPhone 14 Pro, iOS 26.6.1
affects: [phase-2, phase-3, phase-4]

plan_head_before: d937b9f3f89c16d24cfc5e6954dc95c4c638aa80
plan_head_after: 8891d94fbe95938c699a5f881b37c9c19c8e4025
commits: 6

actuals:
  tokens: 5400
  tasks: 4
  commits: 6

tech-stack:
  added: []
  patterns:
    - "PWA functions take their environment (storage, window) as an optional parameter defaulting to the real global, so tests need no global stubbing"
    - "ensurePersistence is wrapped in singleFlight so app mount and Settings mount share one persist() request"
    - "Service-worker registration comes only from the virtual:pwa-register/preact hook; update check runs on visibilitychange because a home-screen app rarely navigates"
    - "Tab-root screens render NavBar with a bare prop so no empty 44px row sits under the status area"

key-files:
  created:
    - src/pwa/singleFlight.ts
    - src/pwa/standalone.ts
    - src/pwa/storage.ts
    - src/pwa/useAppUpdate.ts
    - src/vite-env.d.ts
    - src/ui/Settings.tsx
    - src/ui/Status.tsx
    - scripts/build-id.mjs
    - scripts/build-id.d.mts
    - tests/pwa.test.ts
  modified:
    - src/ui/App.tsx
    - src/ui/components.tsx
    - src/ui/styles.css
    - src/main.tsx
    - vite.config.ts
    - scripts/check-dist.mjs
  deleted:
    - src/spike.tsx

key-decisions:
  - "Build identifier logic lives in scripts/build-id.mjs so vite.config.ts and tests share one source; value is the first 6 chars of GITHUB_SHA, else git short hash, else dev"
  - "Update prompt governs only updates while the app stays open; after a full force-quit the waiting worker activates on next launch (standard service-worker lifecycle), so Not Now does not survive a force-quit"
  - "Tab-root NavBar uses a bare prop and CSS (.nav-bar.bare, .screen:has(> .nav-bar.bare) > .scroll) instead of an empty row, fixed after device feedback"

requirements-completed: [APP-02, APP-04, APP-05, DATA-01]

duration: ~21min wall clock (includes the user's device-acceptance session)
completed: 2026-10-19
status: complete
---

# Phase 1 Plan 04: PWA Runtime, Settings and Device Acceptance Summary

**Persistent-storage request and Settings status, Safari-tab warning, one-tap update prompt, Records error screen and a Build row, with the device-check harness removed and the whole phase accepted on a real iPhone 14 Pro (iOS 26.6.1).**

## Accomplishments

- Task 1 (TDD): `singleFlight`, `isStandalone`, `ensurePersistence` (never throws, one `persist()` for concurrent callers), `readUsage` (null after 2 seconds), `formatBytes`, and `useAppUpdate` (visibilitychange update check, single-flight apply, Not Now). `tests/pwa.test.ts` covers all of them plus the import boundary that keeps `useAppUpdate.ts` away from `src/data`, Dexie and `indexedDB`.
- Task 2: Settings with Storage (Persistent storage, Storage used) and About (Build) groups, `SafariBanner`, `UpdateBanner`, `RecordsError`, App-level `useErrorBoundary` that replaces only the content area, `ensurePersistence` on mount, `__BUILD_ID__` define, check-dist C12 (single registration path) and C13 (UI strings).
- Task 3: `src/spike.tsx` deleted, `main.tsx` renders App only, check-dist C14 (harness absent from dist).
- Task 4: user deployed, ran the on-device acceptance below; one UI defect found and fixed.
- No new packages were installed.

## Task Commits

1. Task 1 RED: `ac0b987` test(01-04) failing tests for the PWA runtime modules
2. Task 1 GREEN: `3345a6f` feat(01-04) PWA runtime modules
3. Task 2: `d39a08b` feat(01-04) Settings, banners, Records error, build id
4. Task 3: `7544b65` chore(01-04) remove the device-check harness, add check-dist C14
5. Task 4 marker: `571e648` chore(01) update-prompt marker build (empty commit made by the user to prove the update prompt)
6. Device-acceptance fix: `8891d94` fix(01-04) remove empty nav row on tab roots

## Device acceptance

Device: iPhone 14 Pro, iOS 26.6.1. Run by the user after pushing 01-02 to 01-04 work to `main` (remote main was at `571e648` for the update test).

| Key | Result | Note |
|-----|--------|------|
| build-before | not reported (user confirmed pass) | Part 1: reopening showed the tab-bar app; Settings showed Build, Persistent storage and Storage used |
| build-after | not reported (user confirmed pass) | Differed from build-before; the user's pass of Part 2 depends on it |
| update-banner | ok | Update available card appeared after the marker deploy |
| update-applied | ok | Update App applied the update and the Build value changed |
| not-now | ok, with note | Not Now hid the card. After a force-quit and reopen the waiting update had already installed automatically, so the card did not reappear. See platform note below |
| safari-banner | ok | After closing the Safari tabs and reopening (see below) |
| standalone-no-banner | ok | Installed app shows no strip |
| zoom-200 | ok | No horizontal scroll at 200% in Safari |
| offline-with-data | ok | Force-quit, airplane mode, reopen: opened with families intact (APP-02 observed on device) |
| safe-area | ok-after-fix, pending on-phone confirmation | User reported "the top notch is a bit too thick"; fixed in `8891d94`; the fix is not on the phone until the next push |
| dark-mode | ok | App follows the system appearance |
| persistent-storage | Granted | Spike reading: `persisted()` true |
| storage-used | not reported | |

**Platform note on Not Now.** The plan text expected the Update available card to return after a force-quit. On iOS the standard service-worker lifecycle applies: when every client is closed (force-quit), the waiting worker activates on the next launch, so the update installs without a prompt and the card has nothing to show. No data is lost, because an update swaps only the app shell. The prompt governs updates while the app stays open, and the prohibition "no update or reload without a tap on Update App" holds for the running app (no reload while it is open). The plan's step 8 wording ("the card returns") is therefore not literally true after a force-quit; Not Now hides the card for the rest of the session only.

**Safari-tab banner and a stale cache.** Initially the Safari tab showed no "You're in Safari" strip because Safari still served the cached Plan 02 build, whose service worker has no update UI. The live site was confirmed (by the orchestrator, in a fresh browser) to show the strip; after the user closed the Safari tabs and reopened, the strip appeared and the check passed. This is the same stale-worker behavior the update prompt exists to address for later deploys; it affected only the first move off the Plan 02 build.

Required acceptance criteria: update-banner, update-applied, offline-with-data and standalone-no-banner are ok. build-before and build-after exact values were not reported, so the "build-after differs from build-before" criterion rests on the user's report that the update applied and the build changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty 44px nav row on tab roots made the top bar too tall**
- **Found during:** Task 4 (device acceptance; user reported "the top notch is a bit too thick")
- **Issue:** Tab-root screens (People, Settings) rendered the nav bar with an empty 44px row beneath the status-bar inset, so the header looked too tall on a notched phone.
- **Fix:** Added a `bare` prop to `NavBar`; `.nav-bar.bare` drops the empty row and `.screen:has(> .nav-bar.bare) > .scroll` adjusts the scroll area. Verified at 375 px in the browser pane; `npm test` 81/81, build ok, check-dist 14/14.
- **Files modified:** src/ui/App.tsx, src/ui/components.tsx, src/ui/styles.css
- **Commit:** 8891d94 (made by the orchestrator, recorded here)
- **Status:** not yet on the phone; the user confirms after the next push.

**Total deviations:** 1 auto-fixed (bug found during device acceptance). **Impact:** none on scope.

### Plan wording that did not match platform behavior

Step 8 of Task 4 expected the card to return after a force-quit (see the platform note above). Treated as a documentation correction, not a code defect.

## Authentication Gates

None. Task 4 was a human-action checkpoint (push and operate the phone), handled as normal flow.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths or storage surfaces. T-01-15 (Build row, visibilitychange check and marker deploy proven on device), T-01-16 (footers follow `persisted()`; Not granted copy never claims protection), T-01-17 (`updateServiceWorker` is called only from `src/pwa/useAppUpdate.ts`) and T-01-18 (Safari-tab banner shown whenever not standalone, confirmed on device) are mitigated as planned.

## Open Items

- Safe-area: confirm on the phone that the top bar is no longer too thick, after the user's next push of `8891d94`.
- Exact Build values and the Storage used reading were not reported.
- Fresh-install behavior and the multi-day eviction question (APP-03, RESEARCH A7) remain observation items under 01-SPIKE-RESULTS.md Follow-up.

## Verification

- `npm test`: 4 files, 81 tests pass
- `npm run build`: tsc clean, Vite build OK
- `node scripts/check-dist.mjs`: 14 checks pass (C12 single registration, C13 UI strings, C14 harness absent)
- `grep -rniE "spike" src` finds nothing; `grep -rn "updateServiceWorker" src/ui` finds nothing

## Self-Check: PASSED

- All created source, script and test files exist on disk; `src/spike.tsx` is gone.
- Commits ac0b987, 3345a6f, d39a08b, 7544b65, 571e648 and 8891d94 are ancestors of HEAD.
