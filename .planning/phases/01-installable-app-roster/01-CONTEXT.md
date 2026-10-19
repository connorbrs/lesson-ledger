# Phase 1: Installable App & Roster - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A free, offline-capable home-screen web app (PWA on GitHub Pages) that installs on the user's iPhone and holds the roster: families (name, weekly/monthly period) and students (name, family, default subject, private notes), with archive/restore, a Safari-tab warning, an update prompt, and storage status in Settings. Covers APP-01..05, FAM-01..04, DATA-01. No session logging, expenses, summaries or backup in this phase.

</domain>

<decisions>
## Implementation Decisions

### App name, icon, URL
- **D-01:** The app is named **Lesson Ledger** (home-screen label, manifest `name`/`short_name`, page title, all UI copy, later summaries/PDFs). Replace every "Lesson Log" in user-facing copy, including `01-UI-SPEC.md` strings (e.g. "Lesson Log couldn't open its storage…", update/Safari banners). Planning docs may keep the old name in history.
- **D-02:** Icon motif: a stylised **clock or ledger book** (time logging), drawn in the teal accent (#00707A) with white, iOS-style rounded square. Claude designs the actual artwork (SVG source → 180×180 apple-touch-icon + manifest sizes).
- **D-03:** URL matches the name: `https://<github-user>.github.io/lesson-ledger/`. Vite `base`, manifest `start_url`/`scope` and service-worker scope = `/lesson-ledger/`. — **Reversibility:** one-way — changing the origin/path after real data exists starts the home-screen app with empty storage (data is per-origin); a backup/restore would be needed to move.
- **D-04:** IndexedDB name uses the new name, e.g. `lesson-ledger-v1` (unique per research pitfall 2: all GitHub Pages project sites share one origin).

### Student & family details
- **D-05:** Family = one free-text **name** (exactly what appears on summaries, e.g. "Smith family" or "Anna (Mia's mom)") + reporting period (weekly Mon–Sun / monthly). No separate parent-name field, no phone.
- **D-06:** Student = name + family + **default subject**: Swim, Math, or Both. Phase 2's Log screen uses it to pre-pick the subject (Both → falls back to last-used). Add a Swim/Math/Both segmented control to the Student sheet (extends the UI-SPEC Student sheet; follow its segmented-control spec). — **Reversibility:** costly — field is part of Dexie schema v1 and Phase 2 quick-entry logic.
- **D-07:** Students have an optional **private notes** field (multi-line, free text, e.g. "afraid of deep end"). Never shown on summaries/PDFs. Families have no notes field.

### Getting the roster in
- **D-08:** Starting roster is small (under 10 families). Entry is **one by one** in the app (Add Family → Add Student) as specified in the UI-SPEC. No bulk import, no "save & add another".

### Device
- **D-09:** User's iPhone model/iOS version is unknown. Target the **current iOS (assume iOS 18+)**; the Phase 1 device spike records the actual iOS version and `persisted()`/`estimate()` results. UI degrades to "Not supported"/"Unavailable" per UI-SPEC rather than breaking.

### Claude's Discretion
- Icon artwork details within D-02.
- Hosting setup steps (GitHub account/repo creation and Pages deploy are the user's to perform; GitHub CLI `gh` is not installed on this Mac — plan a manual or GitHub Actions deploy with clear user steps).
- Exact notes-field layout in the Student sheet (follow UI-SPEC grouped-row style; multi-line, 17px to avoid iOS zoom).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract
- `.planning/phases/01-installable-app-roster/01-UI-SPEC.md` — approved UI contract (layout, tokens, copy, states). D-01 renames its copy; D-06/D-07 add fields to its Student sheet.

### Project scope
- `.planning/PROJECT.md` — constraints (PWA, static hosting, $0, offline), key decisions
- `.planning/REQUIREMENTS.md` — APP-01..05, FAM-01..04, DATA-01
- `.planning/ROADMAP.md` §Phase 1 — success criteria and device spike

### Research
- `.planning/research/SUMMARY.md` — stack (Vite 8, Preact 11, TS, Dexie 4, vite-plugin-pwa 2), pitfalls 1/2/6/7, Phase 1 device spike
- `.planning/research/STACK.md` — versions, GitHub Pages base/scope rule
- `.planning/research/PITFALLS.md` — storage persistence, shared-origin DB naming, SW update in standalone
- `.planning/research/ARCHITECTURE.md` — domain core / data layer split, Dexie schema v1 (define all tables up front)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield; no source code exists yet.

### Established Patterns
- None yet. Follow the research architecture: pure `domain/` core (no DOM/Dexie imports), `data/` as the only Dexie importer, UUID ids, local `YYYY-MM-DD` dates.

### Integration Points
- Dexie schema v1 should define all tables (families, students, sessions, expenses, attachments, meta) now so later phases don't need risky migrations; students table includes `defaultSubject` and `notes`.

</code_context>

<specifics>
## Specific Ideas

- Native iOS feel (Apple's own apps as reference), teal accent, tab bar with People + Settings only in Phase 1 — all locked in the UI-SPEC.
- Family name doubles as the greeting/label on summaries, so it is free text.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-installable-app-roster*
*Context gathered: 2026-10-18*
