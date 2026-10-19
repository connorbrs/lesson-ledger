# Project Research Summary

**Project:** Lesson log (private instructor's session, hours, and receipt logger, installed as an iPhone home-screen PWA)
**Domain:** Offline-first personal PWA on iOS Safari; IndexedDB records and receipt photos; client-side PDF with embedded images; Web Share; manual backup
**Researched:** 2026-10-18
**Confidence:** MEDIUM

## Executive Summary

This is a single-user, single-device tool. Its core value, per PROJECT.md, is that a session is logged in seconds after it ends and the per-family summary (hours, itemized sessions, receipts) is correct and ready to send. Experts building this shape of app use a static PWA with local IndexedDB storage, no backend, a pure domain layer for the money and time rules, and one summary model rendered to both text and PDF. Commercial tutor and swim-school tools are mostly built around billing, invoicing, and multi-user scheduling; those features are out of scope and should be ignored. The closest matching feature set (receipts in the PDF, shared-session credit, travel minutes excluded from family totals) is not offered by any surveyed tool, which is the real differentiation.

The recommended stack is small: Vite 8, Preact 11, TypeScript, Dexie 4 (IndexedDB), jsPDF 4 for the PDF, fflate for zip backup, and vite-plugin-pwa for the offline shell. Data is stored as integer minutes, integer cents, local `YYYY-MM-DD` dates, and UUIDs. Summaries are derived from raw records every time and never stored as the source of truth. Build order puts the riskiest iOS behaviors (home-screen install, offline cold start, storage persistence, camera input, PDF share) first, tested on a real phone before the features that depend on them.

The key risks are data loss and silent arithmetic errors, not technical complexity. The phone is the only copy of the data and iOS browser storage is best-effort, so backup and restore must be built early and round-trip tested. Shared-session credit and expense splits can produce totals that do not reconcile, so the credit semantics and split rule must be decided before the schema is written. Dates must never be bucketed through UTC. The text summary and PDF must come from the same model and formatter so a parent never receives two different totals.

## Key Findings

### Recommended Stack
- **TypeScript 7.0.2** (fallback `^6`): type safety for money, time, and PDF code. Pin to 6 if an editor or lint plugin lags.
- **Vite 8.3.4**: static build to `dist/` for GitHub Pages. Node ^20.19 or >=22.12 on the build machine only.
- **Preact 11.0.1** with `@preact/preset-vite`: about 3 KB, React-compatible API.
- **Dexie 4.4.6**: IndexedDB schema versions, indexed queries, `liveQuery`, native Blob storage.
- **jsPDF 4.2.1**: per-family PDF with text and JPEG receipts; `doc.output('blob')` feeds `navigator.share`. Fallback: pdf-lib 1.17.1 (unmaintained since 2021).
- **fflate 0.8.3**: zip for backup (`backup.json` plus `attachments/*.jpg`), avoiding base64 inflation.
- **vite-plugin-pwa 2.0.0** with `workbox-build` and `workbox-window` ^7.4.1 (required peers): precaches the app shell.
- **Web Share API** (platform): `navigator.canShare({ files })` then `navigator.share({ files })`; text via clipboard or `navigator.share({ text })`.

**Do not use:** localStorage for records or images; html2canvas or html2pdf.js; Capacitor or Cordova; Firebase or Supabase; CRA; moment or dayjs; Cache API for user photos; `beforeinstallprompt` (not supported on iOS).

### Expected Features

**Must have (v1):** students and families with a per-family reporting period; session entry (date, subject swim or math, students, lesson/activity/travel minutes) with quick-entry defaults and 30/45/60 presets; session list per period with edit and delete; expenses with receipt photo (downscaled at capture); per-family summary with lesson and activity hours shown separately (travel excluded), itemized sessions, and itemized expenses; plain-text summary (clipboard, period label included); PDF with receipts via share sheet, with download fallback; backup export and validated restore; offline shell and home-screen install.

**Should have (differentiators, v1 once rules are settled):** shared-session credit per family (full 1.0 or half 0.5), stored per family on the session; math is always 1-on-1 and full credit. Shared-expense allocation between families, stored on the expense.

**Defer (v1.x / v2+):** personal overview (totals per student, family, subject, per week and month, including travel); "as sent" marker; summary preview warnings; CSV export; mileage field (v2+).

**Do not build:** rates, invoices, payment status; live timer; recurring schedule; cancellation records; parent accounts or portal; in-app sending; push reminders; charts; multi-user; cloud sync; AI-generated parent notes. Session notes stay private and out of the parent summary.

### Architecture Approach

A pure domain core (no DOM, Dexie, or fetch imports) holds all rules: credit factor, period boundaries, validation, expense allocation, summary building. The data layer is the only code importing Dexie. Output renderers take one `FamilySummary` model and produce text or PDF bytes; they never compute totals. The share adapter isolates the riskiest iOS behavior.

**Major components:**
1. **Domain core** (`domain/`): `creditFactor`, `creditedMinutes`, `periodFor`, `validateSession`, `allocateCents` (largest remainder), `buildFamilySummary`, `buildOverview`. Unit-tested in Node.
2. **Data layer** (`data/`): Dexie schema v1 with all tables (`families`, `students`, `sessions`, `expenses`, `attachments`, `meta`), repos, cascade deletes in one `rw` transaction, `liveQuery` wrappers.
3. **Media pipeline and attachments**: file to decode, downscale (about 1600 px long edge, JPEG about 0.8), Blob. Metadata loads with lists; Blobs load only for one receipt or PDF build. Revoke object URLs on unmount.
4. **Summary renderers** (`output/`): `renderSummaryText(model)` and `renderSummaryPdf(model, receiptBlobs)`.
5. **Share adapter**: `canShare` then `share`; fallbacks to clipboard (text) or `<a download>` (file).
6. **Backup and restore**: read all tables in one transaction to zip; restore validates `schemaVersion` and shape, then replaces everything in one `rw` transaction.
7. **PWA shell**: precache, manifest, 180x180 apple-touch-icon, update prompt, `storage.persist()` and `estimate()` shown in Settings.

**Key patterns:** integer minutes and cents; local `YYYY-MM-DD` dates; `crypto.randomUUID()` IDs; derived summaries; allocations materialized at save time; append-only Dexie versions; `familyId` snapshotted onto each attendee at log time.

### Critical Pitfalls

1. **Phone is the only copy; browser storage is best-effort.** Call `storage.persist()` on every launch and read `persisted()` into Settings; show `estimate()`; show "last backup N days ago" on the home screen; build backup early.
2. **Safari and the home-screen app have separate storage; all GitHub Pages project sites share `username.github.io`.** Use a distinctive DB name (for example `lesson-log-v1`); detect standalone mode and warn in a Safari tab; decide on a custom domain before real data is entered.
3. **Backup or restore destroys or corrupts data.** UUIDs everywhere; `schemaVersion` in every backup; validate the whole file before deleting anything; restore in one transaction; automatic pre-restore snapshot; round-trip test on the phone; no base64 receipts in JSON.
4. **Half or full credit does not reconcile.** A two-student 60-minute session with one family full and one half yields 90 credited minutes from 60 actual. Decide the rule before Phase 2; store raw minutes and derive credit at read time; invariant test per session.
5. **Rounding and money drift.** Integer minutes and cents; parse decimal input from strings; largest-remainder allocation with a stable tie-break (so $10.00 across three families gives 334, 333, 333 cents); one shared hour formatter for text, PDF, and overview; test that text and PDF totals match.
6. **Date and week boundaries.** `new Date('YYYY-MM-DD')` parses as UTC; `toISOString().slice(0, 10)` is wrong in the evening. Use local date strings and one period function; bucket by week-start date key; run tests under several `TZ` values, including a 23:30 Sunday case.

**Also important:** stale service worker in standalone mode (version the cache, explicit update prompt, show build version); HEIC and canvas memory (`accept="image/*"` only, one photo at a time, verify EXIF orientation); Web Share after async work (prepare PDF on one tap, call `navigator.share` directly in the next click handler); quota failures (save session, expense, and photo in one transaction; orphan integrity check).

## Implications for Roadmap

### Phase 1: Foundation and iOS device spike
**Rationale:** Every later phase depends on the data contract and PWA shell; iOS behavior is cheapest to learn now.
**Delivers:** Vite and Preact app with precache; manifest and apple-touch-icon; Dexie schema v1 with all tables, UUIDs, `meta` with `schemaVersion`; domain core for periods (one week-start function), credit factor, validation; families and students CRUD with archive for entities with history; Settings showing `persist()`, `estimate()`, build version; standalone detection and Safari banner; unique DB name; time-zone test harness.
**Addresses:** students and families with period; offline shell and install.
**Avoids:** Pitfalls 1, 2, 6, 7.
**Device spike (required):** install, go offline, relaunch, check `persisted()`; 2 MB JPEG Blob round trip in Dexie; record `estimate()` over several days.

### Phase 2: Session logging and credit rules
**Rationale:** Core loop; carries the credit and validation rules every summary depends on. Blocked on decisions D1, D2, D4, D5, D8, D9.
**Delivers:** quick-entry form with last-used defaults and presets; subject, date, students, minutes; per-family credit for swim with two students; math forced to one student and full credit; session list with edit, delete, per-session totals; credit invariant tests.
**Avoids:** Pitfalls 4, 5; nonsense-entry validation.
**Research flag:** none; standard patterns once rules are decided.

### Phase 3: Backup and restore
**Rationale:** The phone is the only copy; test restore while data is small and before receipts make it large. ARCHITECTURE's order (backup before receipts) is adopted over PITFALLS' "backup last" because data-loss risk dominates; PITFALLS' schema requirements are met in Phase 1.
**Delivers:** zip export via fflate; validated single-transaction restore; automatic pre-restore snapshot; "last backed up" on home screen; round-trip test; export via `navigator.share({ files })` with download fallback, tested in standalone mode.
**Avoids:** Pitfalls 3, 1, 2.
**Research flag:** light. Zip library behavior in iOS Safari; `navigator.share` with `.zip` on device.

### Phase 4: Expenses and receipts
**Rationale:** Media pipeline in isolation before the PDF depends on it; receipts are the largest data and are protected by Phase 3.
**Delivers:** expense entry (integer cents, description, date from session); receipt capture via `<input type="file" accept="image/*">`; one-at-a-time downscale and JPEG re-encode; lazy thumbnails; shared-expense allocation with largest remainder and per-expense override; atomic save of session, expense, and photo; cascade delete in one transaction.
**Avoids:** Pitfalls 8, 9, 5.
**Device spike (required):** camera capture and library pick from home-screen app; HEIC from library; portrait and landscape orientation; memory with 20 receipts.
**Blocked on:** D3 (split rule), D6, D7.

### Phase 5: Family summaries (text first, then PDF)
**Rationale:** Core value; text first because it is low risk and usable even if PDF share misbehaves; PDF carries the highest iOS risk.
**Delivers:** period picker defaulting to most recent complete period; `buildFamilySummary` as single model; `renderSummaryText` with period label and clipboard copy; `renderSummaryPdf` with jsPDF, receipts embedded as compressed JPEG, amount and description beside each receipt; "Prepare PDF" tap then "Share PDF" tap; `canShare` check with fallbacks; text-and-PDF totals test.
**Avoids:** Pitfall 10, Pitfall 5 (single formatter), summary-changed-after-sent.
**Device spike (required):** `navigator.share` with a PDF to Messages and Mail from the home-screen app; PDF with 30+ receipts in a monthly period; jsPDF memory on the oldest supported iPhone. If jsPDF fails on device, swap to pdf-lib with `embedJpg` on the same Blobs (contained in the PDF module).
**Blocked on:** D10, D11.

### Phase 6: Overview, sent-marker, integrity (post-validation)
**Rationale:** Not needed to send summaries; FEATURES defers until a real period has been sent without errors.
**Delivers:** personal overview tables (week and month; student, family, subject; travel included); "as sent" marker and optional snapshot; summary preview warnings; orphan integrity check in Settings; optional CSV export.
**Avoids:** overview and summary disagreement (Pitfall 4); orphans (Pitfall 9).
**Blocked on:** D8, D11, D18.

### Phase Ordering Rationale
- Data contract and iOS risks first; schema is expensive to change once real data exists.
- Credit rules before any summary; they change stored data and totals.
- Backup before receipts; the phone is the only copy and receipts are the largest data.
- Text before PDF; PDF share is the least certain iOS behavior.
- Overview deferred; depends only on sessions, so it can move earlier if the instructor wants it.

### Research Flags
**Needs device spike or deeper research:** Phase 1 (storage eviction and `persist()` for home-screen apps); Phase 3 (zip in iOS Safari; `share` with `.zip`); Phase 4 (camera capture from home-screen app; HEIC decode memory); Phase 5 (`navigator.share` with PDF on current iOS Safari; jsPDF memory with many receipts).
**Standard patterns (skip research-phase):** Phase 2 (form and validation; rules come from the user); Phase 6 (read-only aggregation).

## Decisions Needed From the User

Consolidated and deduplicated from all four files. Items marked **blocking** must be answered before Phase 2 writes schema-dependent code.

- **D1 (blocking, Phase 2). Shared-session credit semantics.** (a) "Half" is a 50% share, so family credited minutes sum to real minutes; or (b) "half" is a billed credit, so totals can exceed real minutes. Does the factor apply to activity minutes too?
- **D2 (blocking, Phase 2). Sibling case.** Two students from the same family in one session produce one credit entry for that family? Assumed yes.
- **D3 (blocking, Phase 4). Shared-expense split rule.** Equal across families in the session; proportional to credit (full 1, half 0.5); or per-expense choice?
- **D4 (blocking, Phase 2). Week start and period definition.** Monday or Sunday for weekly; calendar months for monthly.
- **D5 (Phase 2). Hour display format and half-minute rounding.** `h:mm`, decimal, or both; floor or round-half-up, applied in one function.
- **D6 (Phase 4). Receipts per expense.** One or several photos.
- **D7 (Phase 4). Expenses on math sessions.** Assumed allowed; confirm.
- **D8 (Phase 2). Travel and overview attribution.** Travel instructor-only (assumed). Per-subject uses raw minutes; per-student and per-family use credited minutes (assumed).
- **D9 (Phase 2). Activity-only sessions.** Allowed (assumed).
- **D10 (Phase 5). Family with no sessions in a period.** Send a zero summary or skip?
- **D11 (Phases 5–6). Editing after a summary was sent.** Flag "changed since sent," or freeze a snapshot?
- **D12 (Phase 1). Delete versus archive.** Archive families and students with history (assumed); hard delete only unused records.
- **D13 (Phase 1). Entry point.** Will the instructor ever use the Safari tab, or only the home-screen app?
- **D14 (Phase 1). Custom domain.** Decide before real data is entered; changing origin starts the app empty.
- **D15 (Phase 1). Minimum iOS version.** Affects quota, Web Share, HEIC.
- **D16 (Phase 3). Backup privacy.** Can the backup file leave the phone through Messages or Mail (it contains children's names)?
- **D17 (Phase 3). Backup reminder on home screen.** Recommended; not in active requirements.
- **D18 (Phase 6). Sent-summary snapshots and as-sent marker.** Overlaps D11.

## Conflicts Between Research Files
- **PDF library.** STACK recommends jsPDF; ARCHITECTURE and PITFALLS describe pdf-lib. *Resolution:* jsPDF default, pdf-lib as documented fallback; confirmed by Phase 5 spike.
- **Backup timing.** PITFALLS puts backup last; ARCHITECTURE puts it at Phase 3. *Resolution:* ARCHITECTURE's order, with PITFALLS' schema requirements met in Phase 1.
- **Overview timing.** ARCHITECTURE puts overview at Phase 4; FEATURES defers to v1.x. *Resolution:* FEATURES (Phase 6); ARCHITECTURE's placement is valid if wanted sooner.
- **iOS storage quota.** PITFALLS cites up to 60% of disk on iOS 17+; ARCHITECTURE calls the ceiling unverified. *Resolution:* treat as unverified; record real `estimate()` values in the Phase 1 spike.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Versions verified against npm registry. iOS behavior (Web Share with files, Blob round trip, persist) unverified on device. Some peer versions unchecked. |
| Features | MEDIUM | Scope HIGH (PROJECT.md). Competitor observations LOW (vendor pages). |
| Architecture | MEDIUM | Patterns and data model HIGH; iOS storage, Blob volumes, PDF share MEDIUM to LOW until device-tested. |
| Pitfalls | MEDIUM | Storage and HEIC cross-checked across WebKit, MDN, Apple forums. Several LOW (single reports) or REASONED (date and money logic). |

**Overall confidence:** MEDIUM. Domain rules are well understood; iOS-specific behavior is the main unknown and is cheap to test early.

### Gaps to Address
- iOS storage ceiling and eviction for home-screen apps: record `estimate()` and `persisted()` over several days in Phase 1. Backup is the safety net regardless.
- `navigator.share` with PDF and zip on current iOS Safari: unconfirmed. Phase 5 and Phase 3 spikes.
- Camera capture and HEIC from home-screen app: Phase 4 spike; confirm `capture` does not remove the library option.
- Blob round trip in Dexie on iOS: WebKit Bug 268037 resolved in Safari 17.x; test on target iOS in Phase 1.
- PDF memory with many receipts: no measured number; Phase 5 spike with 20–30 receipts on the oldest supported phone.
- Service worker update in standalone mode: reports are LOW; Phase 1 update-path test with a marker deploy.
- The user decisions D1–D18: the true gaps. More research cannot resolve them.

## Sources

### Primary (HIGH)
- npm registry JSON, fetched 2026-10-18 (vite, vite-plugin-pwa, dexie, jspdf, typescript, preact, fflate, pdf-lib)
- PROJECT.md (scope and requirements)

### Secondary (MEDIUM)
- WebKit, "Updates to Storage Policy": https://webkit.org/blog/14403/updates-to-storage-policy/
- MDN: Storage quotas and eviction criteria; Navigator.canShare(); Navigator.share()
- web.dev, Web Share API: https://web.dev/articles/web-share
- Apple, Safari 15 release notes (Web Share Level 2 file sharing)
- Vite 8 announcement (March 2026): https://vite.dev/blog/announcing-vite8.html
- WebKit Bugzilla 268037, 303803, 292350, 232302

### Tertiary (LOW, validate on device)
- Apple Developer Forums: thread 710157 (PWA persistence beyond 7 days), 112218 (canvas memory), 743049 (HEIC renaming), 743037 (photo picker format), 95911 and 119017 (PWA download)
- Ionic forum: stale service worker in standalone iOS mode
- Competitor vendor pages (TutorLog, Tutoring Tracker, Timesheet, ClickUp, Teachworks, Poolva Coach, MarketBox, TutorTally, Schedly): unverified

---
*Research completed: 2026-10-18*
*Ready for roadmap: yes, once blocking decisions D1–D4 are answered or explicitly deferred*
