---
phase: 01-installable-app-roster
verified: 2026-10-19T09:21:51Z
status: human_needed
score: 24/27 must-haves verified (3 present, behavior unverified, routed to human; 0 failed)
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 15/21
  gaps_closed:
    - "G-01-10: Archived families and students with no lesson history can be deleted from the Archived screen, so a family whose only students are archived (and have no history) can be fully removed"
  gaps_remaining: []
  regressions: []
covered_files: [".github/workflows/deploy.yml", ".gitignore", ".planning/phases/01-installable-app-roster/01-01-PLAN.md", ".planning/phases/01-installable-app-roster/01-01-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-02-PLAN.md", ".planning/phases/01-installable-app-roster/01-02-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-03-PLAN.md", ".planning/phases/01-installable-app-roster/01-03-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-04-PLAN.md", ".planning/phases/01-installable-app-roster/01-04-SUMMARY.md", ".planning/phases/01-installable-app-roster/01-05-PLAN.md", ".planning/phases/01-installable-app-roster/01-05-SUMMARY.md", "assets/icon.svg", "index.html", "package.json", "scripts/build-id.d.mts", "scripts/build-id.mjs", "scripts/check-dist.mjs", "scripts/generate-icons.mjs", "src/data/db.ts", "src/data/families.ts", "src/data/live.ts", "src/data/students.ts", "src/domain/roster.ts", "src/domain/types.ts", "src/domain/validate.ts", "src/main.tsx", "src/pwa/singleFlight.ts", "src/pwa/standalone.ts", "src/pwa/storage.ts", "src/pwa/useAppUpdate.ts", "src/ui/App.tsx", "src/ui/Archived.tsx", "src/ui/FamilySheet.tsx", "src/ui/People.tsx", "src/ui/Settings.tsx", "src/ui/Status.tsx", "src/ui/StudentSheet.tsx", "src/ui/components.tsx", "src/ui/styles.css", "src/vite-env.d.ts", "tests/pwa.test.ts", "tests/roster.test.ts", "tests/tracer.test.ts", "tests/validation.test.ts", "tsconfig.json", "vite.config.ts"]
covered_digest: "v3:sha256:e8dd6ca148eb397453c01b57701dbf421c16cb107528b3a542dca62698865dcd"
deferred:
  - truth: "FAM-02 weekly (Mon-Sun) and monthly (calendar month) periods are adjacent with no overlap or gap"
    addressed_in: "Phase 4"
    evidence: "Phase 4 success criterion 1: period defaults to the family's most recent complete week or month, and summaries compute those periods. Phase 1 stores and labels the setting only (periodLabel in src/domain/roster.ts)."
coincidental_reliance_items:
  - truth: "A student with any session cannot be hard-deleted (FAM-04 history guard)"
    reason: fixture-only
    harden: "No Phase 1 production code writes session rows. The guard's tests (roster.test.ts 'archived delete path' and 'student repo') insert a hand-written sessions row with attendees[].studentId. Phase 2 must write sessions in that shape through its own repo, and should add a test through that path."
behavior_unverified_items:
  - truth: "Live note-to-row transition: after the last archived student of a family is deleted, the blocked note becomes the Delete Family row on the same screen (01-05 truth 3)"
    test: "On the installed app, open Archived with a family that has one archived no-history student. Delete the student, confirm the Delete Family row appears without leaving the screen."
    expected: "The note disappears and a destructive Delete Family row sits under the family's Restore Family row. The screen does not pop back."
    why_human: "The data path is covered by roster.test.ts, but the reactive re-render of useLive on the Archived screen has no automated coverage."
  - truth: "A refused or throwing delete keeps the alert open with \"Couldn't delete “{name}”. Nothing was changed.\" and removes nothing; Cancel closes it (01-05 truth 4)"
    test: "Hard to force from normal UI: the Delete row is hidden when history exists, so the refusal needs a session written between the row render and the confirm tap. Either force it in a scratch copy, or accept the code-level evidence (Archived.tsx L26-34 keeps busy/failed state and skips onClose on a refused result)."
    expected: "The alert stays up with the failed message, the list is unchanged, and Cancel dismisses it."
    why_human: "The keep-open-on-failure state in ArchivedDeleteAlert has no test, and the path is a race rather than a normal UI action."
  - truth: "The Delete alert is inert behind and focus lands on Cancel, returning to the opener on close (01-05 truth 8, WR-06 extension)"
    test: "With VoiceOver on in the installed app, open Archived, open a Delete Student alert, then swipe through the list, Back button and tab bar. Close the alert with Cancel."
    expected: "Content behind the alert is unreachable. Focus lands on Cancel and returns to the Delete row on close."
    why_human: "Assistive-technology behaviour. The structure is correct (the alert is a direct child of .app, see App.tsx L57 and L26-31), but no automated check can verify VoiceOver."
uncertain_items: []
advisory: []
---

# Phase 1: Installable App & Roster Verification Report

**Phase Goal:** As a private instructor, I want to install the app and set up my families and students, so that I have an offline roster ready.
**Verified:** 2026-10-19T09:21:51Z
**Status:** human_needed
**Re-verification:** Yes, after gap closure (plan 01-05, gap G-01-10). Previous report: 2026-10-19T08:55:53Z, human_needed, 15/21.
**Commit verified:** ce1feca (HEAD, main). Working tree has one untracked file, .planning/milestone.lock, which is not implementation.

## Summary

Gap G-01-10 is closed in code. The Archived screen now offers Delete Student on archived students with no sessions, and Delete Family on archived families with no students. Both route through the unchanged `deleteStudent` and `deleteFamily` guards. The UAT device checks that were open at the last verification (HV-1 to HV-9) are recorded as passed in 01-UAT.md, and the prohibition decisions P-a, P-b, P-c, P-d and P-e are recorded. Status is still `human_needed`, not `passed`, for three reasons:

1. Three must-haves from 01-05 are present and wired but their runtime behaviour is not exercised by a test or a recorded device check: the live note-to-row transition, the failure keep-open path, and VoiceOver inertness behind the new alert. The 01-05 summary records the layout and VoiceOver checks as pending on device.
2. One warning (W-2 below) needs a decision. The blocked-family copy promises a deletion the UI cannot offer when the archived student has lesson history.
3. Only the 01-05 human checks are open. HV-1 to HV-10 are closed by the UAT record and are not re-listed.

No must-have FAILED. No BLOCKER was found. The re-verification evidence gate (verifier-evidence-gate) was not triggered, because no blocker exists to gate.

## Gap Closure Check (G-01-10)

| Gap item | Code evidence | Test evidence | Status |
| -------- | ------------- | ------------- | ------ |
| Delete Student on archived no-history student, confirm removes it | `src/ui/Archived.tsx` L137-141 (row shown when `!hasHistory`); `ArchivedDeleteAlert` L15-53 calls `deleteStudent` on confirm; `src/ui/App.tsx` L28-31 mounts the alert | `roster.test.ts` "deletes an archived student with no sessions, then its emptied archived family" passes | VERIFIED (alert presentation in HV-A) |
| Delete Family on archived family with no students, confirm removes it | `Archived.tsx` L96-99 (row shown when `!hasStudents`); alert calls `deleteFamily` | Same test asserts `deleteFamily` returns `{ ok: true }` and `getFamily` is undefined | VERIFIED |
| Blocked note text and live note-to-row transition | `Archived.tsx` L100-107 (note copy chosen by whether an archived student exists); transition relies on `useLive` re-query | Data state after the last delete is asserted (`hasFamilyHistory` false). Live re-render has no test | PRESENT_BEHAVIOR_UNVERIFIED (human item) |
| Refused or throwing delete keeps alert open, failed copy, Cancel closes | `ArchivedDeleteAlert` L26-34 (failed state, no `onClose` on refusal); copy reuses "Couldn't delete ... Nothing was changed." | Guard refusals are tested (`has-history`, `has-students`). The keep-open UI state is not | PRESENT_BEHAVIOR_UNVERIFIED (human item) |
| Alert is a direct child of app root (inert and focus) | `App.tsx` L26-31 returns the alert beside `PushLayer` inside the `ArchivedScreen` fragment; `App.tsx` L57 `div.app` is the parent | Structural only; VoiceOver not automatable | PRESENT_BEHAVIOR_UNVERIFIED (human item) |
| Hard-delete rules unchanged, no new rules, no note reads | `git diff e66cbb8 ce1feca -- src/data` lists 0 files. Every delete call in `Archived.tsx` is `deleteStudent` or `deleteFamily` (L25). `.notes` is read only in `src/ui/StudentSheet.tsx` | Existing repo and guard tests pass (86/86) | VERIFIED |
| P-d prohibition wording and UI-SPEC copy amended | `01-04-PLAN.md` L96 records "Accepted platform behaviour (user decision 2026-10-19, UAT P-d)"; `01-UI-SPEC.md` L261, L289-292 carry the new copy | grep gates in 01-05 Task 3 | VERIFIED |

## Goal Achievement

### Roadmap Success Criteria (phase contract)

| # | Success criterion | Status | Evidence |
| - | ----------------- | ------ | -------- |
| SC1 | Open the URL in Safari, Add to Home Screen, launch full screen with own icon; no developer account, no expiry | VERIFIED | Device: install, full screen, icon (UAT 1 of the spike and 01-04 acceptance). Code: manifest `display: standalone`, `start_url` and `scope` at `/lesson-ledger/` (vite.config.ts). |
| SC2 | Airplane mode, force-quit, relaunch: app opens with families and students intact | VERIFIED | Device: UAT 4 pass (students survive airplane-mode relaunch). Families recorded in 01-04 acceptance. Code: IndexedDB `lesson-ledger-v1`. |
| SC3 | Safari-tab warning; home-screen update prompt with one-tap apply | VERIFIED | Device: banner in Safari, absent in app; update card applied (UAT 5, 8). Code: `SafariBanner`, `UpdateBanner`, `registerType: 'prompt'`. Cold-launch activation accepted as platform behaviour (P-d). |
| SC4 | Create, edit and archive families and students; archived records hidden but history kept; hard delete only without history | VERIFIED | Code: repos in `src/data/families.ts` and `src/data/students.ts` guard deletes in one transaction. G-01-10 closed: the Archived screen now offers hard delete where the guards allow it. UI walkthrough UAT 1 pass. |
| SC5 | Settings shows whether persistent storage was granted and how much storage is used | VERIFIED | Device: UAT 2 and 3 pass (Storage used value and Granted). Code: `Settings` with `ensurePersistence()` and `readUsage()`. |

### Observable Truths (must-haves from PLAN frontmatter, grouped)

Counted truths: 27 (21 from the original plans, 6 from gap closure 01-05). VERIFIED: 24. PRESENT_BEHAVIOR_UNVERIFIED: 3. UNCERTAIN: 0. One further truth is deferred and excluded from the count.

Truths 1 to 21 are re-checked against the code. Those that were PRESENT_BEHAVIOR_UNVERIFIED or UNCERTAIN in the previous report are now VERIFIED on the strength of the user's recorded device pass in 01-UAT.md. That pass is behavioural evidence from the phone, not a re-run by this verifier.

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Install from Safari, full screen, clock icon, no account or expiry (SC1) | VERIFIED | See SC1. |
| 2 | Airplane-mode relaunch keeps families (SC2) | VERIFIED | See SC2; UAT 4. |
| 3 | Safari-tab banner in tab, absent in standalone (APP-04) | VERIFIED | Device-observed earlier; `App.tsx` `!isStandalone()`. |
| 4 | Update card appears and one tap applies it; Not Now hides it (APP-05) | VERIFIED | Device (UAT 5, 8); P-d accepted (UAT 10). |
| 5 | Family create, edit, period, archive and restore (FAM-01, FAM-02) | VERIFIED | Code and `roster.test.ts` "family repo"; UAT 1 pass. |
| 6 | Student create, edit, archive, restore; one family each; Swim, Math or Both; private notes (FAM-03) | VERIFIED | Code and `roster.test.ts` "student repo"; UAT 1 pass. |
| 7 | Hard delete only when no history; family blocked by any student, student blocked by any session (FAM-04) | VERIFIED | Tests pass. Archived delete path added by 01-05 (see gap table). Coincidental-reliance advisory below. |
| 8 | Validation and data invariants (FAM-01, FAM-03) | VERIFIED | 86/86 tests; race test passes. |
| 9 | Settings shows persistent storage status (DATA-01) | VERIFIED | UAT 3 pass. |
| 10 | Settings shows storage used (DATA-01) | VERIFIED | UAT 3 pass (previously HV-3, now device-recorded). `readUsage` and `formatBytes` unit-tested. |
| 11 | persist() requested once on launch; concurrent callers share one request; never throws (DATA-01) | VERIFIED | `ensurePersistence()` on mount; singleFlight tests pass. |
| 12 | Build: base path, manifest, precache, icons, iOS head tags, no external URLs, harness absent (APP-01 to APP-03) | VERIFIED | Fresh build in scratch dir succeeds (10 precache entries). The previous `check-dist` run (14 checks) was on the prior HEAD and the 01-05 diff does not touch build inputs. |
| 13 | Running app updates only on the user's tap; no reload while open (APP-05) | VERIFIED | `registerType: 'prompt'`, `latest.current(true)` only in `apply`. Cold-launch activation accepted (P-d). |
| 14 | 200% zoom has no horizontal scroll; dark mode follows system (01-04) | VERIFIED | Device: zoom-200, dark-mode pass recorded in 01-04 acceptance. |
| 15 | Private notes render only inside the Student sheet (FAM-03, P-c) | VERIFIED | `.notes` read only in `src/ui/StudentSheet.tsx`. P-c signed off. |
| 16 | Update watchdog recovers from a stuck "Updating App…" (WR-03) | VERIFIED | Was PRESENT_BEHAVIOR_UNVERIFIED. UAT 5 pass. |
| 17 | useLive resets the picker value when deps change; no stale family (WR-05) | VERIFIED | Was PRESENT_BEHAVIOR_UNVERIFIED. UAT 6 pass. |
| 18 | Covered content is inert behind sheets, pushed screens and alerts; focus moves (WR-06) | VERIFIED | Was PRESENT_BEHAVIOR_UNVERIFIED. UAT 7 pass (VoiceOver). |
| 19 | An interrupted update leaves all records intact (APP-05 concurrency) | VERIFIED | Was PRESENT_BEHAVIOR_UNVERIFIED. UAT 8 pass. |
| 20 | Records error replaces content on a DB failure, tab bar stays, Retry works | VERIFIED | Was PRESENT_BEHAVIOR_UNVERIFIED. UAT 2 pass. |
| 21 | Safe-area clearance: top bar not too tall; nothing clipped at 375 and 430 px | VERIFIED | Was UNCERTAIN. UAT 9 pass. Layout at 375 and 430 px for the new 01-05 rows is a separate item (truth G-c, HV-A). |
| G-a | Archived student with no sessions shows Delete Student beneath Restore; confirm removes it (FAM-04, G-01-10) | VERIFIED | Wiring verified (`Archived.tsx` L137-141, `App.tsx` L28-31). Removal proven by "deletes an archived student with no sessions" test. Visual presentation in HV-A. |
| G-b | Archived family with no students shows Delete Family beneath Restore; confirm removes it (FAM-04, G-01-10) | VERIFIED | `Archived.tsx` L96-99. Removal proven by the same archived-delete-path test (`deleteFamily` ok, family gone). |
| G-c | Blocked note becomes the Delete Family row live after the last student is deleted, on the same screen | PRESENT_BEHAVIOR_UNVERIFIED | Data state proven by test. The live re-render has no test. HV-A. |
| G-d | Refused or throwing delete keeps the alert open with the failed copy; removes nothing; Cancel closes | PRESENT_BEHAVIOR_UNVERIFIED | Guard refusals are tested. The keep-open UI state is not. Hard to force on device. HV-C. |
| G-e | Delete alert is a direct child of app root; list, Back and tab bar inert; focus on Cancel and returns to opener | PRESENT_BEHAVIOR_UNVERIFIED | Structure verified (`App.tsx` L26-31 and L57). VoiceOver behaviour pending. HV-B. |
| G-f | Delete goes only through `deleteStudent` and `deleteFamily`; no new data-layer rules; no note reads on the Archived screen (FAM-03/FAM-04 prohibitions) | VERIFIED | `src/data` unchanged by 01-05 (0 files in diff). `Archived.tsx` calls only those two functions. No `.notes` read. The existing `onEmpty` effect (`Archived.tsx` L74-77) covers the emptied-list case. |

**Score:** 24 of 27 counted truths VERIFIED (3 PRESENT_BEHAVIOR_UNVERIFIED, all routed to human verification).

### Deferred Items

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | FAM-02 adjacency of weekly (Mon-Sun) and monthly periods (backstop truth) | Phase 4 | Phase 4 success criterion 1. Phase 1 stores and labels the setting only. |

### Required Artifacts (01-05 scope)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| src/ui/Archived.tsx | Delete rows, blocked note, `ArchivedDeleteAlert`, `ArchivedDeleteTarget` exports | VERIFIED | Exists, substantive (149 lines), wired from `App.tsx` L6 and L28. No debt markers. |
| src/ui/App.tsx | `ArchivedScreen` holds pending target and mounts alert beside `PushLayer` | VERIFIED | `App.tsx` L20-32. |
| tests/roster.test.ts | `archived delete path` describe, two tests | VERIFIED | `roster.test.ts` L316-348. Both pass. |
| 01-04-PLAN.md | P-d decision recorded | VERIFIED | L96 and the "When a new service worker is waiting" truth. |
| 01-UI-SPEC.md | Archived delete copy | VERIFIED | Copy rows at L261, L289-292. |

### Key Link Verification (01-05)

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| src/ui/App.tsx | src/ui/Archived.tsx | `onDelete={setPendingDelete}` and `ArchivedDeleteAlert` | WIRED | `App.tsx` L28 and L31. |
| src/ui/Archived.tsx | src/data/students.ts | `studentHasHistory` gates row; `deleteStudent` on confirm | WIRED | `Archived.tsx` L5, L69, L138, L25. |
| src/ui/Archived.tsx | src/data/families.ts | `hasFamilyHistory` gates row; `deleteFamily` on confirm | WIRED | `Archived.tsx` L3, L63, L97, L25. |

Previous key links (01-01 to 01-04) are unchanged in the 01-05 diff and remain WIRED as recorded in the previous report. The `src/main.tsx` to `src/spike.tsx` link stays NOT WIRED by design (harness removed in 01-04, superseded).

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Archived.tsx | families (with hasStudents), students (with family, hasHistory) | `listArchivedFamilies`, `listArchivedStudents`, `hasFamilyHistory`, `studentHasHistory`, `getFamily` over Dexie | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit suite (run once) | `npm test` | 4 files, 86 tests passed | PASS |
| Type check | `npx tsc --noEmit` | exit 0 | PASS |
| Bundle build (scratch outDir) | `npx vite build --outDir <scratch>/dist-verify` | PWA precache 10 entries; bundle contains "Delete its archived students first" | PASS |
| Live site | not re-run | - | SKIPPED (unchanged by 01-05; the previous report recorded HTTP 200) |

`scripts/check-dist.mjs` was not re-run in this pass. The 01-05 summary records 14 checks passing on its own build. Its inputs were not changed by 01-05 beyond `src/ui`, and the CI deploy workflow re-runs it before upload.

### Probe Execution

No probes are declared for this phase. Skipped.

### Requirements Coverage

All 10 requirement IDs in the phase are declared in PLAN frontmatter and match REQUIREMENTS.md Phase 1 traceability (all marked Complete there). None is orphaned.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| APP-01 | 01-01, 01-02 | Add to Home Screen, open full screen with icon | SATISFIED | SC1; device-observed. |
| APP-02 | 01-01, 01-02, 01-04 | Works fully offline after first load | SATISFIED | SC2; precache; UAT 4 and 8. |
| APP-03 | 01-01, 01-02 | Never expires, no developer account, static hosting | SATISFIED | Live URL; no network calls in src; exact pins. P-a signed off. |
| APP-04 | 01-04 | Safari-tab warning | SATISFIED | Device-observed. |
| APP-05 | 01-04 | Told when a new version is available; one-tap update | SATISFIED | UAT 5, 8. P-d accepted as platform behaviour and recorded in 01-04-PLAN.md. |
| FAM-01 | 01-01, 01-03 | Create, edit, archive a family | SATISFIED | Repos and UI; UAT 1. P-b signed off. |
| FAM-02 | 01-03 | Weekly or monthly period | SATISFIED | Setting stored and labelled. Adjacency deferred to Phase 4. |
| FAM-03 | 01-03 | Create, edit, archive a student in one family | SATISFIED | Repos and UI; UAT 1. P-c signed off. |
| FAM-04 | 01-03, 01-05 | Archived records keep history; only no-history records hard-deleted | SATISFIED | Guards tested. Archived screen now offers hard delete for no-history records (G-01-10, W-1 closed). Copy caveat in W-2. |
| DATA-01 | 01-04 | Persistent storage requested; status and usage in Settings | SATISFIED | UAT 2 and 3; P-e signed off. |

## Warnings

**W-1 (FAM-04 dead end): CLOSED by 01-05.** Archived no-history students and empty archived families can now be deleted from the Archived screen (G-01-10). Evidence in the gap table above.

**W-2 (new, decision needed): blocked-family copy misdirects for a student with lesson history.** `src/ui/Archived.tsx` L103-104 shows "This family still has students. Delete its archived students first." whenever the family has any archived student. It does not check `hasHistory`. If that archived student has a session, no Delete Student row is offered (`Archived.tsx` L137), so the instruction cannot be followed. The family stays undeletable, which is correct under FAM-04. The copy is the problem: it promises an action the UI does not offer for that case. This is the same class of dead end the user reported as W-1. Options:
  (a) Keep the copy as written. The truth wording in 01-05-PLAN.md and the UI-SPEC copy row match it exactly, so this is the spec's literal behaviour.
  (b) Reword only the history case, for example "This family has archived students with lesson history, so it can't be deleted." Changing it means amending the 01-05 truth and the UI-SPEC copy row (UI-SPEC L289).
This does not block the phase goal and does not change FAM-04, which is met as written.

**W-3 (carried, superseded):** The 01-02 artifact and key-link checks for `src/spike.tsx` remain superseded by the 01-04 removal of the harness. Not a gap.

**W-4 (carried, not re-checked):** `.planning/ROADMAP.md` phase status was flagged as stale in the previous report. This pass did not re-check it.

## Human Verification Required

### HV-A. Archived delete rows and live note transition (01-05 D3)

**Test:** On the installed app at 375 px and 430 px, light and dark. Archive a family with one student that has no sessions. On the Archived screen: (1) confirm the archived student shows a destructive "Delete Student" row under its Restore row; (2) tap it and check the alert title "Delete “{name}”?", message "This can't be undone.", buttons Cancel and Delete Student; (3) archive a second family with no students and confirm it shows "Delete Family" under Restore; (4) archive a family with a student that has a session and confirm the note row reads "This family still has students. Delete its archived students first."; (5) with a family that has only one archived no-history student, delete that student and confirm the note becomes the Delete Family row on the same screen without a pop-back.
**Expected:** Rows sit directly under their Restore rows, the alert matches the copy above, the note wraps without clipping, and the live transition happens on the same screen. Nothing is clipped in either theme.
**Why human:** Row layout, text wrapping, the live re-render, and dark mode have no DOM test harness in this project.

### HV-B. VoiceOver on the Delete alert (01-05 D4, WR-06 extension)

**Test:** With VoiceOver on in the installed app, open Archived, open a Delete Student alert, then swipe through the list, the Back button and the tab bar. Close the alert with Cancel. Repeat once with the Delete Family alert.
**Expected:** Content behind the alert is unreachable. Focus lands on Cancel first and returns to the Delete row on close.
**Why human:** Assistive-technology behaviour cannot be automated. The DOM structure is correct (the alert is a direct child of `.app`).

### HV-C. Refused-delete path (01-05 truth 4)

**Test:** The failure branch needs a session written between the row render and the Delete tap. Either force it in a scratch copy (for example, add a session through the console during the alert), or accept the code-level evidence in `Archived.tsx` L26-34.
**Expected:** The alert stays open with "Couldn't delete “{name}”. Nothing was changed.", the list is unchanged, and Cancel dismisses it.
**Why human:** The keep-open state is untested and the path is a race, not a normal UI action. The decision is whether to accept code inspection or run the scratch-copy test.

### HV-D. Decision on W-2 copy

**Test:** Decide whether to keep "Delete its archived students first." for families whose archived student has lesson history (option a), or reword that case (option b, see W-2).
**Expected:** A recorded decision. If option (b), the 01-05 truth and UI-SPEC copy row are amended in the same change.
**Why human:** Product copy decision.

## Gaps Summary

No gap blocks the phase goal. G-01-10 is closed in code, and its unit-level behaviour is proven by the archived-delete-path tests. The phase status is `human_needed`, not `passed`, because of the four open human items above (three from 01-05 device checks, one copy decision). The phase goal is achieved in code and on the device for install, offline use, the Safari banner, update flow, storage status, and the roster, including the archived-record delete path.

---

_Verified: 2026-10-19T09:21:51Z_
_Verifier: Claude (gsd-verifier)_
