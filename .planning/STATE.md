---
gsd_state_version: "1.0"
current_phase: 4
current_phase_name: Family Summaries & Overview
current_plan: Not started
status: executing
stopped_at: Completed 04-05-PLAN.md
last_updated: "2026-10-20T01:51:43.517Z"
last_activity: 2026-10-19
last_activity_desc: Phase 3 complete, transitioned to Phase 4
state_head: 9f8bb27df9110b298840643f23a93dc6a8b903aa
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 19
  completed_plans: 18
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** Logging a session right after it ends takes seconds, and the per-family weekly/monthly summary is correct and ready to send — lesson hours and activity hours separated, expenses and receipts included.
**Current focus:** Phase 3 — Expenses & Receipts

## Current Position

Phase: 4 (Family Summaries & Overview) — READY TO EXECUTE
Current Plan: Not started
Total Plans in Phase: 6
Status: Ready to execute
Last activity: 2026-10-19 — Phase 3 complete, transitioned to Phase 4

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | - | - |
| 2 | 3 | - | - |
| 3 | 5 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 1 P01 | 14min | 3 tasks | 18 files |
| Phase 1 P02 | 33min | 5 tasks | 5 files |
| Phase 1 P03 | 9min | 3 tasks | 14 files |
| Phase 1 P04 | 21min | 4 tasks | 17 files |
| Phase 1 P05 | 8min | 3 tasks | 5 files |
| Phase 02 P01 | 4 min | 3 tasks | 19 files |
| Phase 02 P02 | not recorded | 3 tasks | 16 files |
| Phase 2 P3 | not recorded | 4 tasks | 13 files |
| Phase 03 P01 | 25min | 2 tasks | 14 files |
| Phase 03 P02 | 10min | 2 tasks | 8 files |
| Phase 03 P03 | 12min | 2 tasks | 8 files |
| Phase 03 P04 | 14min | 2 tasks | 11 files |
| Phase 3 P05 | 25min | 3 tasks | 11 files |
| Phase 04 P01 | 12min | 3 tasks | 14 files |
| Phase 04 P02 | 20min | 2 tasks | 14 files |
| Phase 04 P03 | 12min | 2 tasks | 12 files |
| Phase 04 P04 | 16min | 3 tasks | 17 files |
| Phase 04 P05 | 14min | 2 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Week starts Monday (Mon–Sun); monthly period = calendar month
- [Init]: Hours display as decimal plus h:mm, e.g. "1.5 h (1:30)", via one formatter used by text, PDF and overview
- [Init]: Half credit chosen per family per session, separately for lesson and activity minutes
- [Init]: Shared expenses split equally by default with per-expense override; 0..n receipts per expense
- [Init]: GitHub Pages URL, no custom domain; families with no sessions in a period get no summary
- [Roadmap]: Backup/restore sits in Phase 2 (before receipts) so real data is protected from the first logged session
- [Roadmap]: Overview folded into Phase 4 with summaries (both read the same credit/period/formatter code)
- [Phase 1]: TypeScript 7.0.2 works for tsc --noEmit; no fallback to 6.x needed
- [Phase 1]: apple-touch-icon root-form href is rewritten by Vite to the /lesson-ledger/ base; no %BASE_URL% needed
- [Phase 1]: Origin fixed at https://connorbrs.github.io/lesson-ledger/ (personal account connorbrs, one-way)
- [Phase 1]: iPhone spike on iOS 26.6.1: persist true, Blob ok, Safari tab and home-screen data separate, offline relaunch ok
- [Phase 1]: Roster validators are strict about defaults; repos apply weekly/both/empty-notes defaults only to undefined input
- [Phase 1]: Student Save requires the chosen family to be in the active list; notes are read and written only in StudentSheet.tsx
- [Phase 1]: [01-04] Update prompt governs updates only while the app stays open; a force-quit lets the waiting service worker activate on next launch (standard lifecycle, no data loss)
- [Phase 1]: [01-04] Tab-root NavBar uses a bare prop instead of an empty 44px row (found at device acceptance)
- [Phase 1]: P-d resolved (HV-10): cold-launch activation of a waiting update after a force-quit is accepted platform behaviour; no reload while app is open
- [Phase 1]: Archived delete: full-width destructive row beneath Restore plus per-family note row; ArchivedDeleteAlert mounted beside PushLayer
- [Phase 02]: FamilyCredit stores lesson/activity as full|half per distinct family; attendees snapshot familyId so siblings count once
- [Phase 02]: Log form date null means today (picking today stores null) so a form left open past midnight saves the new day
- [Phase 02]: Period math uses Date.UTC as a calendar only (host time zone cannot shift a day); anchor-date period state; Week/Month switch keeps the containing period
- [Phase 02]: updateSession keeps a retained attendee's stored familyId and remaps its credit to the snapshot; only new attendees must be active and match family
- [Phase 2]: [02-03] Backup container is JSON (schemaVersion 1); restore is one rw transaction over all data tables plus lastBackupAt; device round trip passed on iPhone 14 Pro iOS 26.6.1 (share sheet and Save to Files work; same-day naming backstop not reported)
- [Phase 03]: Expense amounts parse via BigInt over digit strings (no floats); three decimals rejected, not rounded
- [Phase 03]: Expense and attachment rows use add so an id collision aborts the session transaction; unchanged expense rows are not rewritten
- [Phase 03]: SessionFields renders the Expenses group only when onOpenExpense is provided; Edit Session unchanged until 03-03
- [Phase 03]: Any edit to the expense Amount resets the split to equal; Split group renders after family names load
- [Phase 03]: 03-04: removing an earlier-staged receipt photo stays in the stage until editor Save so Discard restores it; viewer fixes its photo id at open
- [Phase 3]: 03-05: Backup stays one JSON file at schemaVersion 2 with base64 receipt photos; 150 MB cap (decimal) refused before sharing; undecodable photo at restore maps to the damaged alert
- [Phase 04]: creditedMinutes half rounds up to whole minutes (Math.ceil); lines always sum to totals (D-17)
- [Phase 04]: Summary loaders anchor on the period start date; null means the default period
- [Phase 04]: Warnings carry the session or expense id for deterministic ordering
- [Phase 04]: PeriodRecord id is familyId_periodKey (underscore) to stay inside the backup id charset; Dexie v2 only adds periodRecords; backup schemaVersion 3 adds periodRecords and instructorName, v1/v2 restore clears them
- [Phase 04]: Sent status compares fingerprints only; a saved message without a sent mark never produces a pill
- [Phase 04]: Back asks to discard only when the visible message box is dirty
- [Phase 04]: 04-04: a receipt whose bytes are not a JPEG (FF D8 FF) fails the PDF build as photo-unreadable; receipt captions are capped at 3 lines
- [Phase 04]: 04-05: PDF build result is stored with its build key so a stale PDF is never reported ready; jsPDF imported statically inside the lazy summaryPdf module so engine and fonts are one precached chunk

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2+] Still unverified on device: Web Share with files (backup zip, PDF), camera/HEIC, PDF memory. Verified in Phase 1: persist() granted, Blob round trip, offline relaunch, separate Safari storage (iOS 26.6.1, iPhone 14 Pro).
- [Phase 3] Before writing expenses/attachments: fix WR-02 (restore clears expenses/attachments without the backup's check) and add receipt photos to the backup format (new schemaVersion; restore must keep reading v1).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261019-gs0 | Session Start/Finish/Duration times instead of minute presets | 2026-10-19 | 2676f37 | [261019-gs0-session-start-finish-duration-times-inst](./quick/261019-gs0-session-start-finish-duration-times-inst/) |
| 2 | Sessions list newest first | 2026-10-19 | 179db1b | — |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-20T01:51:43.239Z
Stopped at: Completed 04-05-PLAN.md
Resume file: None
