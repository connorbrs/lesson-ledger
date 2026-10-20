# Roadmap: Lesson Log

## Overview

Lesson Log goes from an empty GitHub Pages URL to a trusted tool for sending parents correct hours. Phase 1 gets an installable, offline-first app with the family and student roster onto the iPhone. Phase 2 makes the core loop real: log a session in seconds, with the shared-swim credit rules, and put backup and restore in place as soon as real data exists. Phase 3 adds expenses and receipt photos, after backup is proven and before the PDF depends on them. Phase 4 delivers the payoff: per-family summaries as pasteable text and a PDF with receipts, plus the instructor's own overview totals. Each phase ends with something usable on the phone and checked on a real device, because the main unknowns are iOS behaviors, not application logic.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Installable App & Roster** - Home-screen offline app with families, students and storage status (completed 2026-10-19)
- [x] **Phase 2: Session Logging & Backup** - Quick session entry with shared-swim credit, plus backup and restore (completed 2026-10-19)
- [ ] **Phase 3: Expenses & Receipts** - Expenses with receipt photos and shared-expense splitting
- [ ] **Phase 4: Family Summaries & Overview** - Per-family text and PDF summaries, plus personal overview totals

## Phase Details

### Phase 1: Installable App & Roster

**Goal:** As a private instructor, I want to install the app and set up my families and students, so that I have an offline roster ready.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: APP-01, APP-02, APP-03, APP-04, APP-05, FAM-01, FAM-02, FAM-03, FAM-04, DATA-01
**Success Criteria** (what must be TRUE):
  1. User can open the GitHub Pages URL in Safari, choose Add to Home Screen, and launch the app full screen with its own icon, with no Apple developer account and no expiry or re-install
  2. With airplane mode on, user can force-quit and relaunch the home-screen app and it still opens and works, with previously entered families and students intact
  3. If user opens the URL in a Safari tab, they see a warning that their data lives in the home-screen app; after a new version is deployed, the home-screen app tells them an update is available and one tap applies it
  4. User can create, edit and archive families (name used on summaries, reporting period weekly Mon-Sun or monthly calendar month) and students (each belonging to one family); archived records are hidden from active lists but keep their history, and only records with no history can be hard-deleted
  5. Settings shows whether persistent storage was granted and how much storage is used

**Plans**: 5/5 plans complete

Plans:
- [x] 01-05-PLAN.md — Gap closure G-01-10: Delete for archived records with no history

**Wave 1**
- [x] 01-01-PLAN.md — Walking skeleton: pinned toolchain, a family persisted end-to-end, installable precached build with the clock icon

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Go live on GitHub Pages and run the early iPhone device spike

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Roster: validation, family and student repos with delete guards, People, Family, Student and Archived UI

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — Storage status, Safari-tab banner, update prompt, Records error, harness removal, final on-device acceptance

**UI hint**: yes
**Device spike**: On a real iPhone: install from the live URL, go offline and relaunch, read `persisted()` and `estimate()` over several days, round-trip a ~2 MB JPEG Blob through IndexedDB, and deploy a marker build to test the update prompt in standalone mode.

### Phase 2: Session Logging & Backup

**Goal:** As a private instructor, I want to log a session in seconds and back up my data, so that hours are accurate and never lost.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07, LOG-08, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. User can log a session in a few taps: date defaults to today, then subject, student(s), and lesson, activity and travel minutes; the form pre-fills the last-used student, subject and minutes, takes Start, Finish and Duration (Finish defaults to now), hides archived students, and accepts a session with only activity minutes
  2. A math session accepts exactly one student; a swim session accepts one or two students, possibly from different families, and two siblings from the same family count once for that family; for a two-family swim session, user chooses per family whether lesson minutes count full or half, and separately whether activity minutes count full or half, and sees the credited minutes per family
  3. User can view sessions by period and edit or delete any session
  4. User can export a full backup as one file via the iOS share sheet from the home-screen app, and the home screen shows "last backup N days ago"
  5. User can restore from a backup file: a corrupt or unrecognised file is rejected with existing data untouched, and a valid file replaces everything or nothing

**Plans**: 3/3 plans complete

Plans:

**Wave 1**
- [x] 02-01-PLAN.md — Log a session: row shape, validation and credit rules, local dates, shared hour formatter, Log tab with pre-fill and per-family credit, Student picker, four-tab bar

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Sessions by week or month, Edit Session sheet with discard and delete, backlog 999.1 note reword

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Backup contract decision, validated all-or-nothing restore, Back Up Now share sheet, Log reminder, device round trip

**UI hint**: yes
**Device spike**: On a real iPhone: share a backup file via the share sheet from the home-screen app, pick it back through the file picker, and verify a full round trip. The backup format should carry an attachments slot from day one so Phase 3 receipts need no format change.

### Phase 3: Expenses & Receipts

**Goal:** As a private instructor, I want to attach expenses and receipt photos to sessions, so that families see what I paid.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Success Criteria** (what must be TRUE):
  1. User can add one or more expenses (amount, description) to a swim or math session
  2. User can attach zero or more receipt photos to an expense from the camera or the photo library, see them as thumbnails, and still see them offline after relaunch
  3. For a shared session, an expense is split equally between the families by default, user can override the split per expense, and the amounts always add up exactly to the expense total
  4. User can edit or delete an expense and its receipt photos, and deleting leaves no orphaned photos behind
  5. Receipt photos are included in a backup and reappear intact after a restore (completes the receipt half of DATA-02/DATA-03 from Phase 2)

**Plans**: 5/5 plans executed

Plans:

**Wave 1**
- [x] 03-01-PLAN.md — Domain and data tracer: an expense (amount, description) saved with a session in one transaction, totalled for the Sessions row and cascade-deleted; complete update, shares and no-orphan rules with tested save, caption and footer predicates

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — Log tab UI: Expenses group, Expense editor, Log Session saves expenses, "Expenses $12.50" Sessions row line

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — Edit Session sheet loads, edits and deletes expenses (counted delete alert), plus the two-family split override

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-04-PLAN.md — Receipt photos: sequential downscale pipeline, Receipts group and thumbnails, viewer and Remove Photo

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03-05-PLAN.md — Backup version 2 with receipt photos, validated restore of version 1 and 2 (closes WR-02), 150 MB cap with an OK-only alert, on-device check

**UI hint**: yes
**Device spike**: On a real iPhone from the home-screen app: camera capture and library pick, HEIC photos from the library, portrait and landscape orientation, and memory behavior with about 20 receipts.

### Phase 4: Family Summaries & Overview

**Goal:** As a private instructor, I want to send families correct summaries and see my own totals, so that billing and my records are right.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SUM-01, SUM-02, SUM-03, SUM-04, SUM-05, SUM-06, SUM-07, SUM-08, VIEW-01, VIEW-02
**Success Criteria** (what must be TRUE):
  1. User can pick a family and period (defaulting to that family's most recent complete week or month) and see lesson hours and activity hours separately, travel excluded, with sessions and expenses itemized and every hour value shown like "1.5 h (1:30)"
  2. User can copy the summary as a plain-text message and paste it into Messages
  3. User can generate a PDF of the summary including receipt images and share it through the iOS share sheet from the home-screen app (download fallback), and its totals are identical to the text summary
  4. Before sending, user sees warnings for expenses without a receipt and sessions with zero minutes; user can mark the period as sent, and editing a session or expense in it afterwards flags the period as changed since sent
  5. User can see their own lesson, activity and travel totals per week and per month, broken down by student, family and subject, where subject totals count actual time once and family/student totals use credited time

**Plans**: TBD
**UI hint**: yes
**Device spike**: On a real iPhone from the home-screen app: `navigator.share` with a PDF to Messages and Mail, a monthly PDF with 30+ receipts, and jsPDF memory on the oldest supported phone. If jsPDF fails on device, swap to pdf-lib inside the PDF module only.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Installable App & Roster | 5/5 | Complete    | 2026-10-19 |
| 2. Session Logging & Backup | 3/3 | Complete    | 2026-10-19 |
| 3. Expenses & Receipts | 5/5 | In Progress | - |
| 4. Family Summaries & Overview | 0/TBD | Not started | - |

## Backlog

### Phase 999.1: Follow-up — Phase 01 deferred UAT follow-up: Test 12 (BACKLOG)

**Goal:** Resolve the UAT checkpoint deferred during Phase 01 verification
**Source phase:** 01
**Deferred at:** 2026-10-19 during /gsd-verify-work 1 session completion
**Follow-ups:**
- [ ] Test 12: Reword the Archived blocked-family note ('Delete its archived students first') for archived students that have lesson history, once Phase 2 adds sessions (deferred 2026-10-19)
