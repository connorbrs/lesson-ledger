---
phase: 01-installable-app-roster
verified: 2026-10-19T08:55:53Z
status: human_needed
score: 15/21 must-haves verified (5 present but behavior unverified, 1 uncertain; 1 truth deferred to Phase 4 and excluded from the count)
behavior_unverified: 5
overrides_applied: 0
covered_files: [".github/workflows/deploy.yml", ".gitignore", ".planning/phases/01-installable-app-roster/01-01-PLAN.md", ".planning/phases/01-installable-app-roster/01-01-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-02-PLAN.md", ".planning/phases/01-installable-app-roster/01-02-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-03-PLAN.md", ".planning/phases/01-installable-app-roster/01-03-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-04-PLAN.md", ".planning/phases/01-installable-app-roster/01-04-SUMMARY.md", "assets/icon.svg", "index.html", "package.json", "scripts/build-id.d.mts", "scripts/build-id.mjs", "scripts/check-dist.mjs", "scripts/generate-icons.mjs", "src/data/db.ts", "src/data/families.ts", "src/data/live.ts", "src/data/students.ts", "src/domain/roster.ts", "src/domain/types.ts", "src/domain/validate.ts", "src/main.tsx", "src/pwa/singleFlight.ts", "src/pwa/standalone.ts", "src/pwa/storage.ts", "src/pwa/useAppUpdate.ts", "src/ui/App.tsx", "src/ui/Archived.tsx", "src/ui/FamilySheet.tsx", "src/ui/People.tsx", "src/ui/Settings.tsx", "src/ui/Status.tsx", "src/ui/StudentSheet.tsx", "src/ui/components.tsx", "src/ui/styles.css", "src/vite-env.d.ts", "tests/pwa.test.ts", "tests/roster.test.ts", "tests/tracer.test.ts", "tests/validation.test.ts", "tsconfig.json", "vite.config.ts"]
covered_digest: "v3:sha256:7eb5c5ccb41ab72308b843e0d00886810a1ee408f2cb379bab026eaafbf7f0f1"
deferred:
  - truth: "FAM-02 weekly (Mon-Sun) and monthly (calendar month) periods are adjacent with no overlap or gap"
    addressed_in: "Phase 4"
    evidence: "Phase 4 success criterion 1: period defaults to the family's most recent complete week or month, and summaries compute those periods. Phase 1 stores and labels the setting only (periodLabel in src/domain/roster.ts)."
coincidental_reliance_items:
  - truth: "A student with any session cannot be hard-deleted (FAM-04 history guard)"
    reason: fixture-only
    harden: "No Phase 1 production code writes session rows. The guard's test inserts a hand-written sessions row with attendees[].studentId. Phase 2 must write sessions in that shape through its own repo, and should add a test through that path."
behavior_unverified_items:
  - truth: "Update watchdog: a stuck Updating App spinner recovers to a Couldn't update message after 8 seconds (WR-03)"
    test: "On an installed build, with a new version deployed, tap Update App and watch whether the card reloads or times out. Optionally simulate a dropped skip-waiting message in a scratch copy."
    expected: "Either the app reloads onto the new build, or within about 8 seconds the card shows Couldn't update. Close Lesson Ledger and reopen it, with Not Now visible again."
    why_human: "The timer and reload path depend on the service-worker lifecycle and cannot be exercised by the unit tests (no DOM or service-worker harness in this project)."
  - truth: "Changing the family in the Student sheet picker never shows the previous family for a frame (useLive resets on deps change, WR-05)"
    test: "Open Edit Student, tap the Family row, pick a different family. Then add a student with the picker opened while only one family is archived."
    expected: "The Family row shows the newly chosen family with no flash of the old one. If the last active family is archived while the picker is open, the picker pops back and the sheet reads Add a family first."
    why_human: "Interaction and timing behavior; no automated coverage."
  - truth: "Covered content is inert to VoiceOver and keyboard while a sheet, pushed screen or alert is open, and Alert focus moves to its first button (WR-06)"
    test: "With VoiceOver on, open Edit Student (sheet), open Archived (pushed screen), and open the Delete alert. Swipe through the content behind each."
    expected: "Content behind each overlay is not reachable. Focus lands on the Alert's least destructive button and returns to the opener on close."
    why_human: "Assistive-technology behavior; no automated coverage."
  - truth: "An interrupted update (force-quit while Update App is applying) leaves the app launching on either build with all records intact"
    test: "Install the marker build, tap Update App, and force-quit immediately. Relaunch in airplane mode and open Settings and People."
    expected: "The app opens on the old or the new build, with families and students intact and the Build row matching the build that loaded."
    why_human: "Only observable on a device; the unit test proves only the import boundary (src/pwa/useAppUpdate.ts does not import the data layer)."
  - truth: "The Records error screen replaces the content area when the database cannot open or a live query fails, with the tab bar still visible, and Retry Opening Records works"
    test: "In a scratch copy, force the database open to fail (for example, a DB name conflict), run npm run dev, open http://localhost:5173/lesson-ledger/ at 390 px, and tap Retry Opening Records."
    expected: "Heading Can't open your records, the body copy 'Nothing has been changed', a full-width Retry Opening Records button, and the tab bar visible. Retry reloads and the same screen remains if the failure persists."
    why_human: "The error boundary path is wired (src/ui/App.tsx, src/ui/Status.tsx) but no test forces a database failure, and the 01-04 human-check block that covers it was harvested to this step."
uncertain_items:
  - truth: "Safe-area clearance: after fix 8891d94 the top bar is no longer too tall, and the nav bar, tab bar and sheets are not clipped at 375 and 430 px in standalone portrait"
    test: "Pull the latest deploy on the iPhone 14 Pro, reopen Lesson Ledger from the Home Screen, and check the People and Settings headers, then open a Family sheet."
    expected: "Top bar height matches the phone's status area with no empty row. Nothing is clipped at the top or bottom."
    why_human: "The user reported the defect on the phone, and the fix is deployed. Re-confirmation on the phone is still pending."
human_verification:
  - test: "Harvested 01-03 human-check block: at 375 px and 430 px in light and dark, add Test Family A, edit it to Monthly, archive it, open Archived, restore it. Try a blank name and a 61-character name. Then add Test Student A (Math, multi-line private note), edit it to Both, archive it, restore it from Archived, archive the family and confirm its student disappears from People, and try Delete Family on a family with a student."
    expected: "Empty state first, with one Add Family button. The group shows the name header, Edit Family, and the footer 'Monthly · calendar month' after the edit. Archive hides it and the Archived row appears; restore returns it. Blank and over-long names show the two captions and keep Save disabled. The note appears only inside the Student sheet. Delete Family is replaced by the 'still has students' footer. The picker shows an accent check and pops back on selection. Nothing is clipped; the tab bar sits above the bottom edge."
    why_human: "Visual layout, spacing, colour, touch targets and which screens show the note are judgments that grep and unit tests cannot make. The 01-04 phone acceptance did not cover roster editing."
  - test: "Harvested 01-04 human-check block (desktop browser, 390 px): open the People tab and Settings in light and dark. Confirm the 'You're in Safari' strip and Show Install Steps expansion. Confirm Settings shows Persistent storage, Storage used (never blank) and Build. Then force the Records error and tap Retry Opening Records."
    expected: "Strip appears in a non-standalone browser, and Show Install Steps expands three lines in place. Settings Storage group has values, not blanks. Records error shows the heading, body and full-width button with the tab bar still present."
    why_human: "Banner and screen appearance, expansion behaviour and the forced-error path are visual and interaction checks."
  - test: "On the iPhone (installed app): open Settings and read the Storage used value. Also read Persistent storage."
    expected: "Storage used shows a value such as '1.2 MB' (not Unavailable, not blank). Persistent storage shows Granted, as recorded on 2026-10-19."
    why_human: "The final device acceptance recorded Granted but did not record the Storage used value. The value path is covered by unit tests of readUsage and formatBytes, not by a rendered check."
  - test: "On the iPhone (installed app), create a student under an existing family, leave the app in airplane mode, force-quit, and relaunch. Confirm the student is listed under its family."
    expected: "The student appears under its family after relaunch, not only the family."
    why_human: "The device acceptance recorded families surviving the airplane-mode relaunch. Students use the same IndexedDB store, but the device check did not cover them."
  - test: "Judgment-tier prohibition P-d (01-04, APP-05): the app must not apply a service-worker update or reload without the user tapping Update App. On the phone, the waiting worker activated on the next launch after a full force-quit, with no tap. Decide whether this is acceptable."
    expected: "Decision recorded: either (a) accept as documented platform behaviour, since no reload happens while the app is open and a cold launch has no unsaved input, and amend the prohibition wording in 01-04-PLAN.md to match, or (b) treat the prohibition as violated and open a gap."
    why_human: "The prohibition is judgment-tier. The literal wording is broader than the rationale. Per the verification rules, a flagged prohibition needs an explicit human resolution. The verifier recommends (a) but does not decide it."
  - test: "Judgment-tier prohibition sign-offs (interactive verify). Confirm each of the following."
    expected: "P-a (01-01, APP-03, no data transmitted off device): static scan of src and index.html found no fetch, XMLHttpRequest, sendBeacon, WebSocket or third-party script. The only external string in the bundle is a Dexie error-message link (tinyurl), not a network call. Suggested resolution: pass. P-b (01-01, FAM-01, no real names in repo, tests or bundle): fixtures use 'Test Family A' and 'Test Student A', plus short strings 'anna', 'Bea' and 'Cy'. Suggested resolution: pass after confirming those three are synthetic. P-c (01-03, FAM-03, notes never rendered outside the Student sheet): '.notes' is read only in src/ui/StudentSheet.tsx. Suggested resolution: pass. P-e (01-04, DATA-01, no protection claim when not granted): the not-granted footer says iOS has not agreed to protect the data. Suggested resolution: pass."
    why_human: "Judgment-tier prohibitions need an explicit human resolution per item in interactive verification. The evidence above is recorded so each can be signed off quickly."
advisory: []
---

# Phase 1: Installable App & Roster Verification Report

**Phase Goal:** As a private instructor, I want to install the app and set up my families and students, so that I have an offline roster ready.
**Verified:** 2026-10-19T08:55:53Z
**Status:** human_needed
**Re-verification:** No (initial verification)
**Commit verified:** cae9832 (main, identical to the working tree apart from an untracked .planning/milestone.lock)

## Summary

The codebase delivers the phase goal. An installable, offline-first Vite + Preact + Dexie app exists, with a build that passes all 14 dist checks, a family and student roster with validated, transactional, guarded repositories, and the PWA runtime (persistent storage, Safari-tab warning, update prompt). The device acceptance recorded on an iPhone 14 Pro (iOS 26.6.1) covers install, full screen, the icon, offline relaunch with families, the Safari banner, the update flow, 200% zoom, dark mode and persistent storage.

No truth FAILED and no BLOCKER was found. Status is `human_needed` rather than `passed` because:

1. Five must-haves are present and wired but their runtime behavior is not exercised by any test or device check (update watchdog, list reset on deps change, inert and focus handling, interrupted update, Records error path).
2. One must-have is visual and awaits re-confirmation on the phone (safe-area fix).
3. Four judgment-tier prohibitions and one literal prohibition conflict need explicit human sign-off.

Warnings are listed under "Warnings" below and do not change the status.

## Goal Achievement

### Roadmap Success Criteria (phase contract)

| # | Success criterion | Status | Evidence |
| - | ----------------- | ------ | -------- |
| SC1 | Open the URL in Safari, Add to Home Screen, launch full screen with own icon; no developer account, no expiry | VERIFIED | Device: install from GitHub Pages, full screen, clock icon (01-04-SUMMARY, 01-SPIKE-RESULTS). Code: manifest `display: standalone` with `start_url` and `scope` at `/lesson-ledger/` (vite.config.ts); apple-mobile-web-app meta tags and apple-touch-icon in dist (check-dist C8, C11); no paid or signing dependency. Live URL https://connorbrs.github.io/lesson-ledger/ returns 200 for page, manifest and sw.js. |
| SC2 | Airplane mode, force-quit, relaunch: app opens with families and students intact | VERIFIED | Device: airplane-mode relaunch after force-quit opened with families intact (01-SPIKE-RESULTS offline-relaunch, 01-04 offline-with-data). Code: 10 precache entries include index.html and icons (check-dist C3, C10); data in IndexedDB `lesson-ledger-v1`; tracer test "still lists the family after the database is closed and reopened" passes. Students: see human item HV-4. |
| SC3 | Safari-tab warning; home-screen update prompt with one-tap apply | VERIFIED | Device: Safari-tab banner shown in Safari and absent in the installed app; update card appeared after the marker deploy; Update App applied it and the Build row changed. Code: `SafariBanner` rendered when `!isStandalone()` (src/ui/App.tsx); `UpdateBanner` on `needRefresh`; `registerType: 'prompt'`; apply is single-flight (tests/pwa.test.ts). See prohibition P-d for the cold-launch caveat. |
| SC4 | Create, edit and archive families (name and weekly or monthly period) and students (one family each); archived records hidden but history kept; hard delete only without history | VERIFIED | Code: `createFamily`, `updateFamily`, `archiveFamily`, `restoreFamily`, `deleteFamily` (src/data/families.ts) and the student equivalents (src/data/students.ts) are wired from FamilySheet, StudentSheet and Archived. Active lists filter `archivedAt` (People). Delete guards run inside the delete transaction: a family with any student (active or archived) is blocked, and a student with any session is blocked (roster.test.ts). 84/84 tests pass. Visual UI walkthrough is human item HV-1. See warning W-1 on a dead end in the archived-record path. |
| SC5 | Settings shows whether persistent storage was granted and how much storage is used | VERIFIED | Device: Persistent storage Granted (01-04 device acceptance; SPIKE persisted() true). Code: `Settings` calls `ensurePersistence()` and `readUsage()` with a 2 s timeout, `formatBytes` decimal units, Not granted footer says iOS has not agreed to protect data (src/ui/Settings.tsx, src/pwa/storage.ts). The device Storage used value was not recorded: HV-3. |

### Observable Truths (must-haves from PLAN frontmatter, grouped)

Counted truths: 21. VERIFIED: 15. PRESENT_BEHAVIOR_UNVERIFIED: 5. UNCERTAIN: 1. One further truth is deferred and excluded from the count. One set is superseded (below).

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Install from Safari, full screen, clock icon, no account or expiry (SC1) | VERIFIED | See SC1 above. |
| 2 | Airplane-mode relaunch keeps families (SC2) | VERIFIED | See SC2 above. |
| 3 | Safari-tab banner in tab, absent in standalone (01-04 truth; APP-04) | VERIFIED | Device-observed (safari-banner ok, standalone-no-banner ok). Code: src/ui/Status.tsx SafariBanner, App.tsx `!isStandalone()`; isStandalone tests pass. |
| 4 | Update card appears and one tap applies it; Not Now hides it (APP-05) | VERIFIED | Device: update-banner ok, update-applied ok, not-now hides the card for the session. After a full force-quit the card does not return because the update has already activated (documented platform behaviour). Code: src/pwa/useAppUpdate.ts, src/ui/Status.tsx UpdateBanner. |
| 5 | Family create, edit, period (weekly or monthly), archive and restore (FAM-01, FAM-02) | VERIFIED | Code: FamilySheet calls createFamily or updateFamily; period SegmentedControl Weekly and Monthly; periodLabel returns exactly "Weekly · Monday to Sunday" and "Monthly · calendar month" (src/domain/roster.ts). Tests: "family repo" block in roster.test.ts. Visual walkthrough: HV-1. |
| 6 | Student create, edit, archive, restore; one family each; Swim, Math or Both (default Both); private notes (FAM-03) | VERIFIED | Code: StudentSheet calls createStudent or updateStudent; family row lists active families only (FamilyPicker); defaults both and notes empty (students.ts `validated`). Tests: "student repo" block in roster.test.ts. Visual: HV-1. |
| 7 | Hard delete only when no history: family blocked by any student, student blocked by any session (FAM-04) | VERIFIED | roster.test.ts "refuses to delete a family with an active student or only an archived student" and "deletes a student with no sessions and blocks one with a session" pass. UI shows the blocked footer instead of Delete (FamilySheet L119-130, StudentSheet L262-273). Warning W-1 (dead end). Coincidental-reliance advisory on the session fixture. |
| 8 | Validation and data invariants: trim, NFC, 60 code points, idempotent archive and restore, single-transaction writes, delete-versus-create race (FAM-01, FAM-03) | VERIFIED | 84/84 tests pass (4 files). Named race test "never leaves a student pointing at a missing family when delete and create race" re-run alone: passes. validation.test.ts covers the name rules including the 60-emoji and decomposed-é cases. |
| 9 | Settings shows persistent storage status (DATA-01) | VERIFIED | Device: Granted. Code and tests as in SC5. |
| 10 | Settings shows storage used (DATA-01) | VERIFIED | Code: readUsage (2 s timeout, null on failure) and formatBytes are unit-tested (tests/pwa.test.ts "readUsage", "formatBytes"). Rendered device value not recorded: HV-3. |
| 11 | persist() requested once on launch; concurrent callers share one request; never throws (DATA-01) | VERIFIED | App.tsx calls `ensurePersistence()` in an effect on mount. singleFlight-wrapped; tests "calls persist() once for concurrent callers" and "returns not-granted and never throws" pass. |
| 12 | Build: base path, manifest, precache, icons (180 and 512 RGB), iOS head tags, no external URLs, one SW registration path, harness absent (APP-01, APP-02, APP-03) | VERIFIED | Fresh build of HEAD (cae9832) in a scratch copy: tsc clean, vite build OK, PWA precache 10 entries; `check-dist: OK (14 checks)`. Package versions are exact pins (package.json, no ^ or ~). No fetch, XMLHttpRequest, sendBeacon or WebSocket in src. |
| 13 | Running app updates only on the user's tap; no reload while open (APP-05) | VERIFIED | Code: `registerType: 'prompt'`, `injectRegister: false`, update only via `latest.current(true)` inside `apply` (src/pwa/useAppUpdate.ts); no `updateServiceWorker` call outside useAppUpdate.ts. Device: update applied on tap. Cold-launch activation after force-quit is flagged as prohibition P-d. |
| 14 | 200% zoom has no horizontal scroll; dark mode follows the system (01-04 truths) | VERIFIED | Device: zoom-200 ok, dark-mode ok. |
| 15 | Private notes render only inside the Student sheet (FAM-03 prohibition, judgment-tier) | VERIFIED | `.notes` is read only in src/ui/StudentSheet.tsx. Judgment-tier, so sign-off is listed as P-c. |
| 16 | Update watchdog recovers from a stuck "Updating App…" (WR-03) | PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: 8 s timer in src/pwa/useAppUpdate.ts sets `failed` and clears `applying`. No test exercises the timer. HV-5. |
| 17 | useLive drops the previous value and error when deps change; picker does not show a stale family (WR-05) | PRESENT_BEHAVIOR_UNVERIFIED | Present: src/data/live.ts resets value and error before resubscribing; StudentSheet splits the two queries. No test. HV-6. |
| 18 | Covered content is inert behind sheets, pushed screens and alerts; Alert focus moves (WR-06) | PRESENT_BEHAVIOR_UNVERIFIED | Present: `useInertBehind` in src/ui/components.tsx. No test; the fixer flagged it for VoiceOver. HV-7. |
| 19 | An interrupted update leaves all records intact (APP-05 concurrency, backstop) | PRESENT_BEHAVIOR_UNVERIFIED | The import boundary is tested (tests/pwa.test.ts). The interrupted-update behaviour itself is device-only and was not recorded. HV-8. |
| 20 | Records error replaces content on a DB failure, tab bar stays, Retry works (01-04 truth) | PRESENT_BEHAVIOR_UNVERIFIED | Present and wired: App `useErrorBoundary` in src/ui/App.tsx, `RecordsError` in src/ui/Status.tsx. No test forces a DB failure. HV-2. |
| 21 | Safe-area clearance: top bar not too tall after fix 8891d94; nothing clipped at 375 and 430 px (01-04 backstop) | UNCERTAIN | Fix is in the code (`.nav-bar.bare`, `.screen:has(> .nav-bar.bare) > .scroll`). User reported the defect; re-confirmation on the phone is pending. HV-9. |

**Score:** 15 of 21 counted truths VERIFIED (5 PRESENT_BEHAVIOR_UNVERIFIED, 1 UNCERTAIN).

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | FAM-02 adjacency of weekly (Mon-Sun) and monthly periods (backstop truth) | Phase 4 | Phase 4 success criterion 1: summaries default to the family's most recent complete week or month, and compute the period. Phase 1 stores and labels the setting only, per its own must-have. |

### Superseded Must-Haves

| Source | Truth | Disposition |
| ------ | ----- | ----------- |
| 01-02 PLAN | `?spike` device-check page, Device check link, `src/spike.tsx` referenced from `src/main.tsx` and `src/ui/App.tsx` | Removed on purpose in 01-04 (src/spike.tsx deleted, check-dist C14 asserts the harness is absent from dist). The artifact and key-link checks for 01-02 fail for this reason only. Not a gap. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| package.json | Exact-pinned toolchain | VERIFIED | Ten exact pins, matching 01-01 |
| vite.config.ts | base `/lesson-ledger/`, VitePWA prompt mode, manifest | VERIFIED | `verify.artifacts` passed |
| src/data/db.ts | `lesson-ledger-v1`, six tables | VERIFIED | Schema v1, populate writes meta schemaVersion 1 |
| src/data/families.ts, src/data/students.ts | Repos with validation, transactions, guards | VERIFIED | Every write validates first and runs in one transaction |
| src/domain/validate.ts, src/domain/roster.ts | Pure validators, ordering, labels | VERIFIED | Exports match the 01-03 plan |
| src/ui/People.tsx, FamilySheet.tsx, StudentSheet.tsx, Archived.tsx | Roster UI | VERIFIED (wired) | Wired to the repos; visual behaviour in HV-1 |
| src/ui/Settings.tsx, Status.tsx | Storage, Build, banners, Records error | VERIFIED (wired) | Wired to pwa modules; device-observed for banners and Granted |
| src/pwa/useAppUpdate.ts, storage.ts, singleFlight.ts, standalone.ts | PWA runtime | VERIFIED | Unit-tested; watchdog timer behaviour in HV-5 |
| tests/*.test.ts | Unit coverage | VERIFIED | 84 tests in 4 files, all passing |
| .github/workflows/deploy.yml | Test, build, check-dist, then deploy | VERIFIED | Runs npm test, build and check-dist before upload; permissions contents read, pages write, id-token write; no secrets |
| 01-SPIKE-RESULTS.md | Recorded device facts | VERIFIED | Present; 11 keys recorded |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| src/ui/App.tsx | src/data/families.ts | createFamily via FamilySheet, useLive list | WIRED | key-links 01-01 passed |
| src/data/families.ts | src/domain/validate.ts | validateFamilyInput before writes | WIRED | key-links 01-03 passed |
| src/data/students.ts | src/data/db.ts | db.transaction for create, update, delete | WIRED | key-links 01-03 passed |
| src/ui/People.tsx | src/data/live.ts | useLive over active lists | WIRED | key-links 01-03 passed |
| src/ui/StudentSheet.tsx | src/data/students.ts | createStudent, updateStudent, deleteStudent | WIRED | key-links 01-03 passed |
| src/ui/App.tsx | src/pwa/useAppUpdate.ts, storage.ts | update hook, ensurePersistence on mount | WIRED | key-links 01-04 passed |
| vite.config.ts | src/ui/Settings.tsx | `__BUILD_ID__` define | WIRED | key-links 01-04 passed |
| src/main.tsx | src/spike.tsx | dynamic import of harness | NOT WIRED (by design) | Harness removed in 01-04; superseded |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| People.tsx | families, students, archivedCount | useLive over Dexie families and students tables | Yes | FLOWING |
| FamilySheet.tsx | hasStudents | hasFamilyHistory (students table count) | Yes | FLOWING |
| StudentSheet.tsx | activeFamilies, chosenFamily, hasHistory | listActiveFamilies, getFamily, studentHasHistory | Yes | FLOWING |
| Archived.tsx | families, students | listArchivedFamilies, listArchivedStudents, getFamily | Yes | FLOWING |
| Settings.tsx | persist, used | ensurePersistence, readUsage (navigator.storage) | Yes, with fallback to Unavailable or Not supported | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit suite | `npm test` | 4 files, 84 tests passed | PASS |
| Type check | `npx tsc --noEmit` | exit 0 | PASS |
| Build of HEAD (scratch copy) | `npx tsc --noEmit && npx vite build` | exit 0, PWA precache 10 entries | PASS |
| Dist checks of HEAD build | `node scripts/check-dist.mjs` | `check-dist: OK (14 checks)` | PASS |
| Named race test | `npx vitest run tests/roster.test.ts -t "never leaves a student pointing"` | 1 passed, 23 skipped | PASS |
| Live site | `curl` of page, manifest.webmanifest, sw.js | HTTP 200 each | PASS |

The full suite ran once. The named test ran separately to confirm the concurrency behavior.

### Probe Execution

No probes are declared for this phase (not a migration or tooling phase). Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| APP-01 | 01-01, 01-02 | Add to Home Screen, open full screen with icon | SATISFIED | SC1; device-observed |
| APP-02 | 01-01, 01-02, 01-04 | Works fully offline after first load | SATISFIED | SC2; precache checks; device airplane-mode relaunch |
| APP-03 | 01-01, 01-02 | Never expires, no developer account, static hosting | SATISFIED | Live GitHub Pages URL 200; no backend or network calls in src; exact pins |
| APP-04 | 01-04 | Safari-tab warning that data lives in the Home Screen app | SATISFIED | Device: banner in Safari, absent in installed app |
| APP-05 | 01-04 | Told when a new version is available; one-tap update | SATISFIED, with flagged prohibition P-d | Device: card, tap, applied. Cold-launch activation is a human decision |
| FAM-01 | 01-01, 01-03 | Create, edit, archive a family | SATISFIED | Repos and wiring verified; UI walkthrough HV-1 |
| FAM-02 | 01-03 | Weekly (Mon-Sun) or monthly (calendar month) period | SATISFIED | Setting stored, labelled and validated. Adjacency deferred to Phase 4 |
| FAM-03 | 01-03 | Create, edit, archive a student in one family | SATISFIED | Repos and wiring verified; notes privacy P-c |
| FAM-04 | 01-03 | Archived records keep history; only no-history records hard-deleted | SATISFIED, with warning W-1 | Guards tested. No UI path to delete archived no-history records |
| DATA-01 | 01-04 | Persistent storage requested; status and usage in Settings | SATISFIED | Device: Granted. Code and tests for usage. Usage value HV-3 |

**Coverage check:** All 10 requirement IDs in the phase (APP-01 to APP-05, FAM-01 to FAM-04, DATA-01) appear in PLAN frontmatter and in REQUIREMENTS.md Phase 1 traceability. Orphaned requirements: none. Each plan's `requirements:` field maps to REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (all phase files) | - | TBD, FIXME, XXX markers | none | Scan of src, tests, scripts, index.html, vite.config.ts and .github: no matches |
| src/ui/FamilySheet.tsx | 128 | Footer "Remove them before deleting the family" when a student has history or is archived | Warning | Copy promises an action the UI does not offer (see W-1) |
| src/ui/Archived.tsx | 32-70 | Archived rows offer only Restore; no Delete | Warning | Archived no-history records cannot be hard-deleted (see W-1) |
| src/ui/FamilySheet.tsx | 127-130 | Blocked footer for a family with any student, including archived | Info | Intended by 01-03 must-have; see W-1 |
| .github/workflows/deploy.yml | 9-11 | `cancel-in-progress: true` on the Pages concurrency group | Info | Review IN-03; out of the fix scope. Can cancel a queued deploy |
| src/pwa/useAppUpdate.ts | 20 | visibilitychange listener never removed | Info | Review IN-04; duplicates on dev HMR only |
| src/domain/validate.ts, src/data/families.ts | - | `crypto.randomUUID` needs a secure context | Info | Review IN-01; fine on https and localhost; a LAN http dev server would fail |

No placeholder, stub or hardcoded-empty data flows were found. Every rendered list reads from a live Dexie query.

## Warnings

**W-1 (FAM-04 dead end): archived records have no hard-delete path.** Archived rows (src/ui/Archived.tsx) offer only Restore. A family with an archived student (even with no history) shows the footer "This family still has students. Remove them before deleting the family." (src/ui/FamilySheet.tsx), but the user cannot reach or remove an archived student. Result: a family with an archived, no-history student can never be deleted. The 01-03 plan specified the blocked footer for this case, so this is consistent with the plan, but it leaves an unreachable deletion path. Decision needed: (a) offer Delete on archived no-history records in the Archived screen, or (b) accept the dead end and reword the footer. Status stays `human_needed`. Requirement FAM-04 is still met as written.

**W-2 (judgment-tier prohibition, APP-05).** See human item P-d. The truth "Not Now hides the card until the next launch" holds. The prohibition wording "must not apply an update or reload without the user tapping Update App" is violated literally by platform activation on cold relaunch after a force-quit. The reload-while-open rationale is not violated.

**W-3 (superseded wiring checks).** The 01-02 artifact check (src/spike.tsx) and key-link checks fail because the harness was removed by design in 01-04. Recorded as superseded, not a gap.

**W-4 (stale planning metadata).** `.planning/ROADMAP.md` still shows Phase 1 as unchecked and "In Progress" (4/4 plans complete). Housekeeping only.

## Human Verification Required

### HV-1. Roster walkthrough (harvested 01-03 human-check blocks)

**Test:** At 375 px and 430 px, light and dark: add Test Family A, edit it to Monthly, archive it, open Archived, restore it. Try a blank name and a 61-character name. Add Test Student A (Math, multi-line private note), edit to Both, archive, restore from Archived, archive the family and confirm its student disappears from People, then try Delete Family on a family with a student.
**Expected:** The empty state, group header, Edit Family, and the 'Monthly · calendar month' footer appear as described. The name captions appear and Save stays disabled. The note appears only inside the Student sheet. The blocked footer replaces Delete. The picker shows an accent check and pops back. Nothing is clipped.
**Why human:** Visual layout, colour, touch targets and iOS focus behaviour.


### HV-2. Records error path and Settings block (harvested 01-04 human-check block)

**Test:** In a scratch copy, force the database open to fail. Run `npm run dev`, open http://localhost:5173/lesson-ledger/ at 390 px, check the People and Settings tabs in light and dark, and tap Retry Opening Records.
**Expected:** The 'You're in Safari' strip and Show Install Steps expansion appear. Settings shows Storage and Build values, never blanks. The Records error shows the heading, body, and a full-width Retry button with the tab bar still visible.
**Why human:** Appearance, expansion, and the forced-error path.

### HV-3. Storage used value on the phone

**Test:** Open Settings in the installed app and read Storage used.
**Expected:** A value such as "1.2 MB". Not blank, not Unavailable. Persistent storage shows Granted.
**Why human:** The final device acceptance recorded Granted but not the usage value.

### HV-4. Students survive an airplane-mode relaunch

**Test:** On the installed app, create a student under an existing family. Turn on airplane mode, force-quit, relaunch.
**Expected:** The student appears under its family.
**Why human:** Device acceptance covered families only.

### HV-5. Update watchdog (WR-03)

**Test:** With a newer build deployed, tap Update App on the installed app and watch the result. Optionally simulate a dropped skip-waiting message in a scratch copy.
**Expected:** Either the app reloads onto the new build, or within about 8 seconds "Couldn't update. Close Lesson Ledger and reopen it" appears with Not Now visible.
**Why human:** The timer and reload depend on the service-worker lifecycle and cannot be unit-tested here.

### HV-6. Family picker stale-value fix (WR-05)

**Test:** Edit a student, tap the Family row, pick a different family.
**Expected:** The Family row shows the chosen family without a flash of the old one.
**Why human:** Timing and interaction, no automated coverage.

### HV-7. Inert content and focus (WR-06)

**Test:** With VoiceOver on, open a sheet, a pushed screen (Archived), and the Delete alert. Swipe through the content behind each.
**Expected:** Content behind each overlay is unreachable. Alert focus lands on the least destructive button and returns to the opener on close.
**Why human:** Assistive-technology behaviour.

### HV-8. Interrupted update

**Test:** Install the marker build, tap Update App, force-quit immediately, then relaunch in airplane mode and open Settings and People.
**Expected:** The app opens on either build with families and students intact.
**Why human:** Device-only.

### HV-9. Safe-area fix on the phone (fix 8891d94)

**Test:** After the latest deploy, reopen the installed app and check the People and Settings headers. Open a Family sheet.
**Expected:** The top bar matches the status area with no empty row. Nothing is clipped at 375 or 430 px.
**Why human:** The user reported the defect and the fix is deployed. Re-confirmation pending.

### HV-10. Judgment-tier prohibition sign-offs (interactive verify)

Each prohibition needs an explicit resolution. Evidence and suggested resolution:

- **P-a (01-01, APP-03, no data transmitted off device).** Static scan of src and index.html found no fetch, XMLHttpRequest, sendBeacon, WebSocket or third-party script. The only external string in the bundle is a Dexie error-message link (tinyurl), not a network call. Suggested: pass.
- **P-b (01-01, FAM-01, no real names in repo, tests or bundle).** Fixtures use "Test Family A", "Test Student A" and similar. A few short literals ("anna", "Bea", "Cy") appear in tests. Suggested: pass after confirming those are synthetic.
- **P-c (01-03, FAM-03, notes never rendered outside the Student sheet).** `.notes` is read only in src/ui/StudentSheet.tsx. Suggested: pass.
- **P-d (01-04, APP-05, no update or reload without a tap).** On the phone, the waiting worker activated on the next launch after a full force-quit, with no tap. Options: (a) accept as documented platform behaviour, since no reload happens while the app is open and a cold launch has no unsaved input, and amend the wording in 01-04-PLAN.md; or (b) treat as violated and open a gap. The verifier recommends (a) but does not decide it.
- **P-e (01-04, DATA-01, no protection claim when not granted).** The not-granted footer says iOS has not agreed to protect the data. Suggested: pass.

## Gaps Summary

No gaps block the phase goal. The status is `human_needed` for the reasons above. The phase goal is achieved in code and on the device for the install, offline, banner, update, and storage-status parts. The roster works at the data layer and is wired through the UI. Its visual behaviour and the remaining runtime-only checks await human confirmation.

Two items need a decision before the phase is closed: W-1 (the archived-record delete dead end) and P-d (the cold-launch update activation against the APP-05 prohibition).

---

_Verified: 2026-10-19T08:55:53Z_
_Verifier: Claude (gsd-verifier)_
