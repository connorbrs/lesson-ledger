# Lesson Ledger

## What This Is

A personal iPhone app (installed as a home-screen web app) for a private swim and math instructor to log time spent with students right after each session. It splits each session into lesson time, activity time, and travel time, records activity expenses with receipt photos, and produces per-family hour summaries (a ready-to-paste text plus a PDF with receipts) that the instructor sends to parents, who pay accordingly.

## Core Value

Logging a session right after it ends takes seconds, and the per-family weekly/monthly summary is correct and ready to send — lesson hours and activity hours separated, expenses and receipts included.

## Requirements

### Validated

- ✓ Manage families and students (default subject Swim/Math/Both, private notes), archive/restore, delete only without history — Phase 1
- ✓ Each family has a reporting period: weekly (Mon–Sun) or monthly — Phase 1
- ✓ Works offline, installs to the iPhone home screen, never expires (GitHub Pages PWA, persistent storage granted on iOS 26.6.1) — Phase 1

- ✓ Log a session with Start / Finish / Duration (exact minutes), subject, 1–2 students, activity and travel minutes; Lesson = Duration − Activity — Phase 2
- ✓ Swim sessions with 2 students from different families: per-family Full/Half credit for lesson and activity; math 1-on-1 — Phase 2
- ✓ Sessions list by week/month, newest first; edit and delete sessions — Phase 2
- ✓ Backup to one JSON file via the share sheet and validated all-or-nothing restore; 7-day reminder (receipt photos join backups in Phase 3) — Phase 2

### Active

- [ ] Log activity expenses (amount, description, receipt photo) on a session; shared-session expenses split between the families
- [ ] Generate per-family summary for a period: lesson hours and activity hours separately, plus itemized expenses
- [ ] Summary as copy-pasteable text message
- [ ] Summary as PDF including receipt images, shareable via iOS share sheet (Messages)
- [ ] Personal overview: totals per student / family / subject per week and month, including travel time
- [ ] Edit and delete logged expenses

### Out of Scope

- Rates, money owed, invoicing, payment tracking — parents compute payment from hours; instructor explicitly wants hours only
- Travel time on family summaries — travel is logged for the instructor's own records only, not billed
- Cancellations / no-shows — if no lesson happened, nothing is logged
- Live start/stop timer — logging happens after the session as a quick entry
- Recurring schedule / auto-filled lessons — not requested; quick manual entry is the workflow
- Accounts, login, multi-user, cloud sync server — single personal user on one phone
- Native App Store / Xcode app — would require weekly re-install (free) or $99/yr; PWA chosen instead
- Sending messages automatically — instructor sends via Messages themselves

## Context

- User is a private swim instructor and also tutors secondary-school math.
- Swim lessons sometimes have 2 kids at once (siblings or kids from different families); math is 1-on-1.
- Activities happen before/after lessons and are reported separately because they are paid at a different rate (rate handled by parents, not the app).
- Activities can incur expenses the instructor pays up front; receipts must accompany the summary.
- Currently reports hours to parents by text, weekly or monthly depending on the family.
- Personal use only — one user, one iPhone.

## Constraints

- **Platform**: Progressive Web App added to the iPhone home screen via Safari — free, no 7-day expiry, no Apple developer account
- **Hosting**: Static hosting only (e.g. GitHub Pages) — no backend; all data stays on the phone
- **Storage**: On-device browser storage (IndexedDB) incl. receipt photos — must offer manual backup/export since browser storage is not a guaranteed backup
- **Offline**: Must fully work without network after first load
- **Budget**: $0 ongoing cost

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Home-screen web app (PWA) instead of native iOS | Avoids weekly re-install of free-signed apps and $99/yr developer fee | ✓ Good — verified on iPhone 14 Pro |
| Hours only, no rates/money | Parents compute payment; keeps app simple | — Pending |
| Session = lesson + activity + travel minutes in one entry | Matches how a session actually happens; one quick entry after the lesson | — Pending |
| Shared-lesson split chosen per session (full or half) | Practice varies by situation | — Pending |
| Reporting period configured per family | Some families weekly, some monthly | — Pending |
| Summary as both text and PDF with receipts | Text for the quick message, PDF carries receipt images | — Pending |
| Weekly periods Mon–Sun; monthly = calendar month | User choice | — Pending |
| Hours shown as "1.5 h (1:30)" | Both formats requested | — Pending |
| Half credit chosen per family per session, separately for lesson and activity minutes | Varies by situation | — Pending |
| Half credit kept exact (22.5 min), not rounded | User choice; display rounds only | — Pending |
| Shared expenses split equally by default, override per expense | User choice | — Pending |
| 0..n receipt photos per expense | User choice | — Pending |
| GitHub Pages URL, no custom domain | Personal use; origin must not change once data exists | — Pending |
| Unencrypted backup file may leave the phone (Files/iCloud/Mail) | User accepted | — Pending |
| App renamed Lesson Ledger (was Lesson Log); URL github.io/lesson-ledger | User choice in Phase 1 discussion | — Pending |
| Commit directly to main (solo project) | Deploys from main; simplest for one person | ✓ Good |
| Update prompt; cold-launch activation after force-quit accepted | iOS service-worker lifecycle; no data/input lost | ✓ Good |
| Archived records with no history can be deleted from Archived screen | Avoid dead end (UAT W-1) | ✓ Good |
| Session times as Start/Finish/Duration instead of minute presets | User request after Phase 2 build | ✓ Good |
| Backup is one JSON file (schemaVersion + attachments slot) | No new package; zip possible later | ✓ Good |
| Sessions list newest first | User request | ✓ Good |
| Karpathy coding guidelines apply (multica-ai/andrej-karpathy-skills, already in global CLAUDE.md) | User preference: simplicity, surgical changes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-19 after Phase 2*
