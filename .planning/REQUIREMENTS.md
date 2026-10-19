# Requirements: Lesson Log

**Defined:** 2026-10-18
**Core Value:** Logging a session right after it ends takes seconds, and the per-family weekly/monthly summary is correct and ready to send — lesson hours and activity hours separated, expenses and receipts included.

## v1 Requirements

### App & Install

- [x] **APP-01**: User can add the app to the iPhone home screen from Safari and open it like an app (icon, full screen)
- [x] **APP-02**: App works fully offline after first load
- [x] **APP-03**: App never expires and needs no Apple developer account (static GitHub Pages hosting)
- [ ] **APP-04**: When opened in a Safari tab instead of the home-screen app, user sees a warning that data lives in the home-screen app
- [ ] **APP-05**: User is told when a new app version is available and can update with one tap

### Families & Students

- [x] **FAM-01**: User can create, edit and archive a family (name used on summaries)
- [ ] **FAM-02**: User can set each family's reporting period: weekly (Mon–Sun) or monthly (calendar month)
- [ ] **FAM-03**: User can create, edit and archive a student belonging to one family
- [ ] **FAM-04**: Archived families/students keep their history but are hidden from quick entry; only records with no history can be hard-deleted

### Session Logging

- [ ] **LOG-01**: User can log a session in seconds: date (defaults to today), subject (swim or math), student(s), lesson minutes, activity minutes, travel minutes
- [ ] **LOG-02**: Quick entry pre-fills the last-used student/subject/minutes and offers duration presets (30/45/60)
- [ ] **LOG-03**: Math sessions allow exactly one student
- [ ] **LOG-04**: Swim sessions allow one or two students, possibly from different families
- [ ] **LOG-05**: For a two-student swim session from different families, user chooses per family whether lesson minutes count full or half, and separately whether activity minutes count full or half
- [ ] **LOG-06**: Two siblings from the same family in one session count once for that family
- [ ] **LOG-07**: A session may have only activity minutes (zero lesson minutes)
- [ ] **LOG-08**: User can view sessions by period and edit or delete any session

### Expenses & Receipts

- [ ] **EXP-01**: User can add one or more expenses to a session (amount, description), on swim or math sessions
- [ ] **EXP-02**: User can attach any number of receipt photos (zero or more) to an expense, from the camera or photo library
- [ ] **EXP-03**: Receipt photos are downscaled and stored on the phone
- [ ] **EXP-04**: A shared session's expense is split equally between families by default; user can override the split amounts per expense
- [ ] **EXP-05**: User can edit or delete expenses and their receipt photos

### Family Summaries

- [ ] **SUM-01**: User can pick a family and period (defaults to the most recent complete period for that family's weekly/monthly setting)
- [ ] **SUM-02**: Summary shows lesson hours and activity hours separately, travel excluded, with itemized sessions and itemized expenses
- [ ] **SUM-03**: Hours are shown as decimal and h:mm (e.g. "1.5 h (1:30)"), using one formatter everywhere
- [ ] **SUM-04**: User can copy the summary as a plain-text message ready to paste into Messages
- [ ] **SUM-05**: User can generate a PDF of the summary including receipt images and share it via the iOS share sheet (with download fallback)
- [ ] **SUM-06**: Text and PDF summaries always show identical totals
- [ ] **SUM-07**: Before sending, user sees warnings for expenses without a receipt and sessions with zero minutes
- [ ] **SUM-08**: User can mark a family's period as sent; if a session or expense in that period is edited afterwards, the period is flagged as changed since sent

### Personal Overview

- [ ] **VIEW-01**: User can see their own totals per week and per month: lesson, activity and travel time
- [ ] **VIEW-02**: Totals can be broken down per student, per family and per subject (subject totals count actual time once; family/student totals use credited time)

### Data Safety

- [ ] **DATA-01**: App requests persistent storage on launch and shows storage status and usage in Settings
- [ ] **DATA-02**: User can export a full backup (all records + receipt photos) as one file via the share sheet
- [ ] **DATA-03**: User can restore from a backup file; the file is validated before any existing data is replaced, and the restore is all-or-nothing
- [ ] **DATA-04**: Home screen shows "last backup N days ago" as a reminder

## v2 Requirements

- **VIEW-03**: CSV export of sessions for spreadsheets
- **SUM-09**: Frozen snapshot of exactly what was sent for each period
- **DATA-05**: Encrypted backup file

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rates, amounts owed, invoices, payment tracking | Parents compute payment from hours; user wants hours only |
| Travel time on family summaries | Travel is for the instructor's own records, not billed |
| Cancellations / no-shows | If no lesson happened, nothing is logged |
| Live start/stop timer | Logging happens after the session |
| Recurring schedule / auto-filled lessons | Quick manual entry is the workflow |
| Accounts, login, cloud sync, backend | Single user, one phone, $0 cost |
| Native iOS / App Store app | Free signing expires weekly; $99/yr not wanted — PWA chosen |
| Sending messages from the app | User sends via Messages themselves |
| Parent portal, reminders/push, charts, AI notes | Not needed for a personal logger |
| Families with no sessions in a period get a summary | Skipped — nothing to send |
| Custom domain | GitHub Pages URL is fine for personal use |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| APP-01 | Phase 1 | Complete |
| APP-02 | Phase 1 | Complete |
| APP-03 | Phase 1 | Complete |
| APP-04 | Phase 1 | Pending |
| APP-05 | Phase 1 | Pending |
| FAM-01 | Phase 1 | Complete |
| FAM-02 | Phase 1 | Pending |
| FAM-03 | Phase 1 | Pending |
| FAM-04 | Phase 1 | Pending |
| LOG-01 | Phase 2 | Pending |
| LOG-02 | Phase 2 | Pending |
| LOG-03 | Phase 2 | Pending |
| LOG-04 | Phase 2 | Pending |
| LOG-05 | Phase 2 | Pending |
| LOG-06 | Phase 2 | Pending |
| LOG-07 | Phase 2 | Pending |
| LOG-08 | Phase 2 | Pending |
| EXP-01 | Phase 3 | Pending |
| EXP-02 | Phase 3 | Pending |
| EXP-03 | Phase 3 | Pending |
| EXP-04 | Phase 3 | Pending |
| EXP-05 | Phase 3 | Pending |
| SUM-01 | Phase 4 | Pending |
| SUM-02 | Phase 4 | Pending |
| SUM-03 | Phase 4 | Pending |
| SUM-04 | Phase 4 | Pending |
| SUM-05 | Phase 4 | Pending |
| SUM-06 | Phase 4 | Pending |
| SUM-07 | Phase 4 | Pending |
| SUM-08 | Phase 4 | Pending |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-18*
*Last updated: 2026-10-18 after roadmap creation (traceability added)*
