# Phase 2: Session Logging & Backup - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Log a session in a few taps (date, optional start time, subject, 1–2 students, lesson/activity/travel minutes, per-family full/half credit for two-family swim), view sessions by week or month, edit and delete them, export a full backup file via the iOS share sheet, restore it all-or-nothing, and show a "last backup N days ago" reminder. Covers LOG-01..08, DATA-02..04. No expenses/receipts (Phase 3), no summaries or overview (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Logging flow
- **D-01:** "Log" is the FIRST tab and the app opens on it, with the form ready to fill (tab bar becomes Log · Sessions · People · Settings).
- **D-02:** The form pre-fills from the LAST logged session: same student(s), subject and lesson/activity/travel minutes; date = today. Before any session exists, fall back to empty students and the student's default subject (Phase 1 D-06) once a student is picked.
- **D-03:** Minutes are entered with presets 30 / 45 / 60 plus a numeric field (any whole number). Activity and travel default to 0 when there is no previous session.
- **D-04:** After Save: a brief "Logged ✓" confirmation, stay on the Log tab, form resets to the pre-filled state for the next session.
- **D-05:** Travel minutes are always visible on the form (instructor-only; never on family summaries).

### Session details
- **D-06:** Each session has a date and an OPTIONAL start time (used to order same-day sessions). No per-session note. — **Reversibility:** costly — `sessions` row shape in Dexie (`startTime` nullable field) and backup format.

### Sessions list
- **D-07:** Sessions tab has a Week / Month toggle (weeks Mon–Sun, calendar months) with ‹ › to move between periods; defaults to the current week.
- **D-08:** Rows are compact: date (and start time if set) · student name(s) · subject, with lesson + activity time on the right in the "1.5 h (1:30)" format; travel and per-family credit are shown only inside the session (edit view). Tapping a row opens it for edit; delete is inside the edit view with the standard confirm alert (iOS "Cancel" / destructive "Delete Session").

### Backup & reminder
- **D-09:** Settings gets a "Backup" group: "Back Up Now" (builds one file and opens the iOS share sheet — Save to Files / iCloud Drive) and "Restore from Backup…" (file picker, validation, confirm alert warning that everything is replaced). — **Reversibility:** one-way — the backup file format (with an `attachments` slot from day one for Phase 3 receipts and a `schemaVersion`) is a published contract that future restores must keep reading.
- **D-10:** "Last backup N days ago" shows as a small line on the Log tab AND in Settings → Backup. Quiet until 7 days; after 7 days (or never backed up once a session exists) it is highlighted with a "Back Up Now" button on the Log tab.
- **D-11:** Restore is validated before anything is touched; a corrupt or unrecognised file is rejected with existing data untouched; a valid file replaces everything or nothing (single transaction).

### Carried forward (locked earlier)
- Half credit is exact (22.5 min), chosen per family per session, separately for lesson and activity minutes; math = exactly one student; siblings in one session count once for their family; activity-only sessions allowed (REQUIREMENTS LOG-03..07, PROJECT Key Decisions).
- Weeks Mon–Sun; hours displayed "1.5 h (1:30)" via one shared formatter.
- Session rows must use `attendees: {studentId}[]` (the student delete guard in src/data/students.ts reads it; `SessionRow` in src/data/db.ts).
- Native iOS look, teal accent, iOS-native Cancel/Save labels (Phase 1 UI-SPEC).

- **D-12:** Backup container is a single JSON file (`schemaVersion` + `attachments` slot), no new package — user decision 2026-10-19 at plan check. Phase 3 may introduce zip under a new schemaVersion while restore keeps reading v1.

### Claude's Discretion
- Exact backup file name and extension (e.g. `lesson-ledger-backup-YYYY-MM-DD.json` or `.zip`), zip vs JSON (research recommends fflate zip; JSON acceptable while there are no photos — but keep the attachments slot).
- Visual layout of the per-family credit controls (only shown for two-family swim sessions).
- Where the "Logged ✓" confirmation appears (toast vs inline).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — constraints, Key Decisions (half credit exact, splits, formats)
- `.planning/REQUIREMENTS.md` — LOG-01..08, DATA-02..04
- `.planning/ROADMAP.md` §Phase 2 — success criteria and device spike (share-sheet backup round trip)

### Prior phase
- `.planning/phases/01-installable-app-roster/01-CONTEXT.md` — D-06 default subject, D-04 DB name
- `.planning/phases/01-installable-app-roster/01-UI-SPEC.md` — design tokens, components, copy rules, iOS-native label exception
- `.planning/phases/01-installable-app-roster/01-SPIKE-RESULTS.md` — iOS 26.6.1 device facts
- `.planning/phases/01-installable-app-roster/01-VERIFICATION.md` — Phase 2 contract notes (session row shape)

### Research
- `.planning/research/SUMMARY.md` — pitfalls 3–6 (backup integrity, credit reconciliation, rounding, dates/TZ), fflate, Web Share
- `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` — data model, period function, backup design

### Backlog
- `.planning/ROADMAP.md` Phase 999.1 — reword the Archived blocked-family note for students with lesson history (now reachable once sessions exist)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/db.ts`: Dexie schema v1 already has `sessions: 'id, date, subject'` and `SessionRow { attendees: {studentId}[] }` — extend the row type (fields typed in Phase 2); avoid a schema version bump unless an index is needed.
- `src/data/live.ts` (`useLive`), `src/data/students.ts` (`studentHasHistory`), `src/domain/validate.ts`, `src/domain/roster.ts` (period labels).
- `src/ui/components.tsx`: Screen, NavBar (`bare` for tab roots), Group, Row, Sheet, Alert, SegmentedControl, PushLayer, `saveErrorMessage`, `useInertBehind`.
- `src/pwa/storage.ts` patterns for Settings rows; `src/ui/Settings.tsx` gets the Backup group.

### Established Patterns
- Pure `domain/` (no Dexie/DOM), `data/` is the only Dexie importer; UUIDs; integer minutes; local YYYY-MM-DD dates; all writes in single transactions with validation first; busy-ref double-tap guards; Vitest + fake-indexeddb for data tests (no DOM test env).

### Integration Points
- Tab bar in `src/ui/App.tsx` (add Log first, Sessions second).
- Phase 1 delete guard depends on session `attendees[].studentId`.

</code_context>

<specifics>
## Specific Ideas

- The app should open ready to log right after a lesson — speed is the core value.
- Backup goes to Files / iCloud Drive via the share sheet (user accepted the file leaving the phone).

</specifics>

<deferred>
## Deferred Ideas

- Per-session private note — declined for now (user chose start time only).

</deferred>

---

*Phase: 02-session-logging-backup*
*Context gathered: 2026-10-19*
