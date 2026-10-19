# Feature Research

**Domain:** Personal lesson/hours logger for a private instructor (swim + math), with parent-facing hour summaries
**Researched:** 2026-10-18
**Confidence:** MEDIUM overall. Competitor observations come from vendor marketing pages (LOW per the classify-confidence seam, unverified). The scope judgments come from PROJECT.md and are HIGH confidence because they reflect the user's stated requirements.

## How to Read This

This is a single-user tool with a narrow scope. The market for tutor and instructor software is mostly built for businesses (multi-instructor centres, billing, payments, scheduling). Most of those features are explicitly out of scope here. So the useful question is not "what do competitors have?" but "what does a solo instructor who reports hours to parents actually need to avoid friction, and what makes the summary trustworthy?"

The core value in PROJECT.md is: a session is logged in seconds after it ends, and the per-family summary is correct and ready to send. Every category below is judged against that.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the instructor will assume exist. Missing any of these makes the app feel broken or makes the parent summary untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Student records linked to a family | Summaries are per family; a student belongs to exactly one family | LOW | Siblings share a family. A swim session with two kids from different families needs both students resolvable. |
| Family reporting period (weekly or monthly) | Stated requirement; drives what a summary covers | LOW | Decide the weekly start day once (Mon vs Sun) and make it a single constant or setting. Monthly = calendar month. |
| Session entry with date, subject, student(s), lesson/activity/travel minutes | Core record; the whole product rests on it | LOW | Validate: at least one minute field > 0; minutes are non-negative integers; subject is swim or math. Math is always 1 student (enforce in the form, not just in the UI copy). |
| Quick-entry defaults (last-used student, subject, common durations) | Core value is "takes seconds"; re-typing the same student and 45 minutes is the main friction | LOW | Pre-fill from the most recent session; offer one-tap duration presets (e.g. 30/45/60) plus free entry. Biggest UX win for the cost. |
| Session list per week/month with edit and delete | Required; also how the instructor checks what was logged before sending | LOW | Group by period, matching the family reporting period. Show per-session totals so mistakes are visible. |
| Expense entry on a session (amount, description, receipt photo) | Stated requirement; receipts must accompany the summary | MEDIUM | Photo capture via `<input type="file" accept="image/*" capture>`. Downscale on capture (phone photos are multi-MB; storage and PDF size depend on it). |
| Per-family summary for a chosen period: lesson hours and activity hours shown separately | Stated requirement; this is the thing the parent pays from | LOW | Totals must be computed from the same data the itemized list uses, so they can't disagree. Round hours consistently (e.g. show both h:mm and decimal, or pick one; decide now). |
| Itemized session lines in the summary (date, student, subject, lesson/activity minutes) | Parents and the instructor both check a total against line items; without lines the total is unverifiable | LOW | Travel is excluded from family summaries per PROJECT.md, so do not show travel lines at all. |
| Itemized expenses in the summary, with receipts in the PDF | Stated requirement; the reason receipts exist | MEDIUM | Each expense needs a date and description on the line. Receipt images appear in the PDF, one per expense or as an appendix; decide the layout before building. |
| Plain-text summary, copy-pasteable into Messages | Stated requirement; the instructor sends by text | LOW | No markdown, no emoji dependence, short enough to read on a phone. Keep line breaks as the only formatting. |
| PDF summary via iOS share sheet | Stated requirement; the receipt-carrying artifact | MEDIUM | Web Share API with files (`navigator.share({files})`) on iOS Safari; verify support on the target iOS version before committing to it. Fall back to download. |
| Personal overview: totals per student / family / subject per week and month, including travel | Stated requirement; the instructor's own records, including unbilled travel | LOW-MEDIUM | Read-only aggregation. Plain tables are enough; charts are not table stakes. |
| Export/backup to file and restore from it | Stated requirement; browser storage is not a guaranteed backup | MEDIUM | JSON covering sessions, students, families, expenses, and receipt blobs (base64 or a zip). Restore must be a full replace-or-merge with a confirmation. Test the round trip. |
| Offline use after first load, installs to home screen | Stated constraint | MEDIUM | Service worker precache of the app shell; all reads and writes go to IndexedDB. Not a feature to build from scratch, but it is a requirement that governs every other feature. |

### Differentiators (Competitive Advantage)

Not expected by a solo instructor, but they serve the core value. Competitors mostly do not offer them in a single app for this workflow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shared-session credit per family (full or half), chosen per session | Two-kid swim lessons from different families are common and currently a manual calculation. Matching that split in the app removes the main source of error in the summary. | MEDIUM | Already in PROJECT.md. Store the credit as a per-family weight on the session (1.0 or 0.5), not a flag on the session, so summaries multiply rather than branch. |
| Shared-expense split between families | Expenses from a shared session would otherwise be split by hand. | MEDIUM | Needs an explicit rule before building (see Open Questions). Store the split as allocations on the expense so a summary can show each family's share on its own line. |
| Summary "as sent" marker per family and period | Lets the instructor see which periods were already sent, and avoid double-sending or missing one. Prevents the most likely real-world error (forgetting a monthly family). | LOW | Optional. Only a timestamp and period key per family. Does not require notifications. |
| Summary preview that flags problems before sending | Catches sessions with zero lesson minutes, an expense with no receipt, or a family with no sessions in a period that was expected to have some | LOW-MEDIUM | Warnings only; never blocks. Cheap and high value for trust in the summary. |
| Session-level notes (free text) | Optional context for the instructor's own records; not sent to parents | LOW | Keep it out of the parent summary entirely unless asked. Mention this in the summary UI so the instructor knows. |
| One-tap "this week" / "last period" shortcut for the summary | Matches the actual workflow (send a summary at the start of the week or month) | LOW | Pure UX. Default the summary period to the family's most recent complete period. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that are common in tutor and instructor apps but either conflict with the stated scope or add cost without serving the core value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rates, amounts owed, invoices, payment status | Every competitor has them; "what do I charge" is the usual reason to use an app | Explicitly out of scope. Adds rate tables, currency, tax, and state for payment tracking. Parents compute payment from hours. | Hours and expense amounts only; expense amounts are shown because they are reimbursed items, not invoices. |
| Live start/stop timer | Common in time trackers | Out of scope. Logging happens after the session; a timer adds background-state bugs on iOS (tab suspension). | Quick post-session entry with duration presets. |
| Recurring schedule / auto-filled lessons | Schedulers offer it | Out of scope; not requested. Adds a second source of truth for what happened. | Quick-entry defaults from the last session. |
| Cancellation / no-show records | Tutoring tools often track them for billing | Out of scope. If no lesson happened, nothing is logged. | None; do not log. |
| Parent accounts, parent portal, or sending from the app | Centre software offers same-day portals | Requires accounts, a server, and sending infrastructure. Out of scope on every axis. | Copy-paste text and PDF share sheet; the instructor sends from Messages. |
| Automatic reminders or push notifications for missing entries | ClickUp and similar tools push reminders | Web push on iOS requires a home-screen install and a push backend. Out of scope for $0 static hosting. | A "last logged" line on the home view; the instructor checks it. |
| Mileage / distance tracking | Teachworks has a per-lesson mileage field | Not in PROJECT.md. Travel is already logged in minutes, which is what the instructor asked for. Mileage needs distance inputs or GPS. | If wanted later, add a numeric field to the session; do not build routing. |
| Charts, dashboards, analytics beyond totals | Looks good in demos | Adds code and design work with no decision value for a single user checking totals. | Plain period tables with totals. |
| Multi-user, multi-instructor, roles | Centre tools are built around it | Out of scope (single user). | None. |
| Cloud sync or server-side backup | Feels safer than manual export | Out of scope ($0, static hosting, all data on phone). | Manual JSON backup on a schedule the instructor chooses; a visible "last backed up" date. |
| Parent-facing progress notes (AI-generated or otherwise) | Tutor tools market AI-written parent reports | Not requested; the summary is hours, not progress. Generated text would also need review before sending. | Keep the summary numeric; session notes stay private. |

## Feature Dependencies

```
Student  ──belongs to──>  Family  ──has──>  Reporting period (weekly/monthly)
    │                        │
    └──────┐                 │
           v                 v
Session (subject, minutes: lesson/activity/travel, date)
    ├──has──> Student(s)  (1 for math; 1-2 for swim)
    ├──has──> Per-family credit (full 1.0 / half 0.5)   [only meaningful when 2 students]
    └──has──> Expense(s)
                 ├──has──> Amount, description, date, receipt image (IndexedDB blob)
                 └──has──> Allocation to families  [shared sessions only]

Family summary (period)  ──requires──>  Sessions + Expenses + Allocations + Credit weights
    ├──produces──>  Plain-text summary   (no extra dependency)
    └──produces──>  PDF with receipts    ──requires──>  Receipt blobs + PDF generator
                                         ──requires──>  Web Share API with files (iOS check)

Personal overview  ──requires──>  Sessions (all families, incl. travel)
Backup / restore   ──requires──>  Every data model above (build last, but before real data is entered)

"As sent" marker      ──enhances──>  Family summary
Summary warnings      ──enhances──>  Family summary
Quick-entry defaults  ──enhances──>  Session entry
Credit split          ──conflicts──>  Math sessions (math is always 1-on-1; disable the option)
```

### Dependency Notes

- **Session entry requires Student and Family records.** The app cannot log a session until at least one student exists, so the first-run flow is students and families, not sessions.
- **Credit split requires two students in a session.** Store the weight per family on the session; show the control only for swim with two students.
- **Expense allocation requires credit or an explicit split rule.** Shared-expense splits should not be invented per expense. Pick one rule (see Open Questions) and apply it everywhere, so the summary is reproducible.
- **PDF with receipts requires receipt storage.** Receipt images must be stored (compressed) before PDF generation can be tested. Build storage first.
- **Backup/restore depends on the schema.** Build it after the data model is stable, but well before real use, because the restore path is the only recovery from browser-storage loss.
- **Summary correctness depends on the period boundary.** Weekly start day and monthly calendar boundaries must be fixed in one place; every total and every list uses that function.

## MVP Definition

### Launch With (v1)

Minimum to replace the current manual process and send a correct summary.

- [ ] Students and families, with a per-family reporting period. Needed before anything else.
- [ ] Session entry (date, subject, students, lesson/activity/travel minutes), with quick-entry defaults. Core value.
- [ ] Shared swim sessions with full/half credit per family. Common case; currently manual.
- [ ] Session list per period with edit and delete.
- [ ] Expenses on a session with receipt photo; shared-expense rule applied.
- [ ] Per-family summary for a period: lesson and activity hours separately, itemized sessions, itemized expenses.
- [ ] Plain-text summary (copy) and PDF with receipts (share sheet).
- [ ] Backup export and restore (JSON including receipts).
- [ ] Offline shell and home-screen install.

### Add After Validation (v1.x)

Add once the summary has been sent for at least one real period without errors.

- [ ] Personal overview (totals per student / family / subject, per week and month, incl. travel). Useful but not needed to send summaries.
- [ ] "As sent" marker per family and period. Add when the instructor starts missing periods.
- [ ] Summary preview warnings (zero lesson minutes, missing receipts, empty expected period). Add once real data shows which mistakes happen.
- [ ] CSV export of sessions for the instructor's own records. Low cost, useful for taxes or records; not needed for parents.

### Future Consideration (v2+)

- [ ] Mileage field on sessions, if travel cost becomes a question. Needs a decision on whether it is tracked for the instructor only.
- [ ] Reduction of the per-entry steps further, e.g. a shortcut or home-screen widget, only if quick entry is measured as too slow.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Students/families with reporting period | HIGH | LOW | P1 |
| Session entry with quick-entry defaults | HIGH | LOW | P1 |
| Per-family summary (hours, itemized sessions) | HIGH | LOW | P1 |
| Shared-session full/half credit | HIGH | MEDIUM | P1 |
| Expenses with receipt photo | HIGH | MEDIUM | P1 |
| Plain-text summary | HIGH | LOW | P1 |
| PDF with receipts + share sheet | HIGH | MEDIUM | P1 |
| Backup export and restore | HIGH | MEDIUM | P1 |
| Offline shell and home-screen install | HIGH | MEDIUM | P1 |
| Session list with edit/delete | HIGH | LOW | P1 |
| Shared-expense allocation | MEDIUM | MEDIUM | P1 (once the rule is decided) |
| Personal overview totals | MEDIUM | LOW | P2 |
| "As sent" marker | MEDIUM | LOW | P2 |
| Summary preview warnings | MEDIUM | LOW-MEDIUM | P2 |
| CSV export of sessions | LOW | LOW | P3 |
| Mileage field | LOW | LOW | P3 |
| Charts/dashboards | LOW | MEDIUM | Not planned |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Sources are vendor marketing pages found by search; claims are unverified (LOW).

| Feature | Tutor session log apps (e.g. TutorLog, Tutoring Tracker) | Time trackers adapted for tutors (e.g. Timesheet, ClickUp) | Lesson/swim business software (e.g. Teachworks, Poolva Coach, MarketBox) | Our Approach |
|---------|------|------|------|------|
| Session log (date, duration, topic, notes) | Yes | Yes (timer-centric) | Yes (schedule-centric) | Post-session entry with minutes split by type |
| Per-student hour totals | Yes | Yes | Yes | Yes, per family and student |
| Parent-facing summary | Paid PDF progress report | Shared timesheets / weekly summaries | Invoices and statements | Text + PDF, hours only, no progress notes |
| Receipts / expenses | Not seen | Not seen | Not seen; Teachworks has mileage only | Core differentiator: receipts in the PDF |
| Travel time | Not seen | Not seen | Routing (MarketBox), mileage (Teachworks) | Minutes only, excluded from family summary |
| Shared sessions with per-family credit | Not seen | Not seen | Not seen | Core differentiator |
| Rates, invoicing, payments | Often included | Often included | Core feature | Excluded by design |
| Reminders for missing entries | Not seen | Yes (ClickUp) | Not seen | Excluded (needs push backend) |
| Data location | On-device (TutorLog) | Cloud | Cloud | On-device only, manual backup |

**Takeaway:** the closest tool (TutorLog) covers session logs and a paid PDF, but none of the surveyed tools combine receipts, shared-session credit, and travel minutes. That is where this app should differ. Competitors' billing features are the part to ignore.

## Open Questions (Decide Before Requirements Are Final)

1. **Shared-expense rule.** Equal split between families, split by credit weight (full/half), or per-expense choice? The answer changes the data model (allocations) and the summary math. Recommend: default to the same credit weights as the session, with a per-expense override.
2. **Weekly period start day.** Monday or Sunday? Affects every weekly total and list.
3. **Hour display format.** `h:mm`, decimal hours, or both? Parents likely expect one; pick one and use it in both the text and the PDF.
4. **Receipt attachment granularity.** One receipt per expense, or several photos per expense? Affects the PDF layout and storage.
5. **Expenses on swim vs math sessions.** Assumed to be allowed on both; confirm.
6. **Summary for a family with no sessions in a period.** Send a zero summary, or skip? Affects whether the "as sent" marker is needed.
7. **Editing after sending.** If a session is edited after a summary was sent, should the app flag that period? Affects whether "as sent" must store a snapshot.

## Sources

- [TutorLog, Teaching Journal (App Goblin listing)](https://appgoblin.info/apps/6763914691) (vendor listing, unverified)
- [Tutoring Tracker (App Store)](https://apps.apple.com/us/app/-/id6470482089) (vendor listing, unverified)
- [Time Tracking for Tutors (Timesheet)](https://timesheet.io/en/time-tracking-tutors) (vendor page, unverified)
- [Tutors time tracking (ClickUp)](https://clickup.com/p/time-tracking-software/tutors) (vendor page, unverified)
- [Teachworks mileage add-on](https://teachworks.com/addons/mileage-tracker) (vendor page, unverified)
- [Poolva Coach (MWM listing)](https://mwm.ai/apps/poolva-coach/6762731731) (vendor listing, unverified)
- [MarketBox swim school software](https://www.gomarketbox.com/industries/swim-school-software) (vendor page, unverified)
- [TutorTally (App Store)](https://apps.apple.com/app/id6756996116) (vendor listing, unverified; listing text is promotional)
- [Schedly, educators](https://schedly.io/meeting-intelligence/educators) (vendor page, unverified)
- Project requirements: `.planning/PROJECT.md` (HIGH confidence for scope)

---
*Feature research for: private instructor lesson/hours logger with parent summaries*
*Researched: 2026-10-18*
