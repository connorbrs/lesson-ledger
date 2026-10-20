# Phase 4: Family Summaries & Overview - Research

**Researched:** 2026-10-19
**Domain:** jsPDF 4.2.1 PDF with an embedded Turkish font, Turkish parent-facing text, Dexie v2, backup v3, iOS Web Share of a PDF
**Confidence:** MEDIUM. HIGH for the jsPDF API, glyphs, bundle and precache (checked in shipped source and runtime output). MEDIUM for memory and share (Node measurements; device spike still needed). LOW for Safari activation timing.

## Summary

Phase 4 has three hard problems: one computation module that every output reads (SUM-06), a PDF that renders Turkish correctly, and a persistence model that detects "changed since sent" without false alarms.

The PDF question is settled by measurement. Built-in Helvetica cannot draw the Turkish letters. jsPDF writes single-byte WinAnsi codes for them, so `ş` appears as `_`, `ı` as `1`, `İ` as `0`, and `Ş` as `^`, with no error. An embedded Noto Sans subset (Regular and Bold, about 27 KB each) fixes this. The subset must include the en dash and em dash, which the UI spec's Latin-1 / Latin Extended-A description leaves out.

Three choices follow. The PDF module loads lazily, because jsPDF's ES bundle is 343,605 bytes raw against a current app chunk of 198,570 bytes. "Changed since sent" and the stale-message banner compare a content **fingerprint**, not `updatedAt` watermarks, because watermarks miss deletes and receipt changes and fire on no-op saves. The PDF is **pre-built** when the summary opens, so the Share tap calls `navigator.share` with no `await` before it.

**Primary recommendation:** add `jspdf@4.2.1` (exact pin), load it only inside `src/pdf/`, embed a vendored Noto Sans Regular and Bold subset (with U+2013 and U+2014) as base64 in a TypeScript module inside that chunk, and compute all totals, warnings, message text and the fingerprint in one pure `src/domain/summary.ts`.

## User Constraints (from CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

Copied verbatim from `.planning/phases/04-family-summaries-overview/04-CONTEXT.md`.

### Locked Decisions

## Implementation Decisions

### Language and number format (everything parents see)
- **D-01:** The text message and the PDF are in **Turkish**. The app's own screens stay English.
- **D-02:** Hours in Turkish output use a decimal comma and the word "saat", plus h:mm, e.g. **"1,5 saat (1:30)"**, "0,75 saat (0:45)". This is the parent-facing variant of the SUM-03 shared formatter: same rounding, different locale string. The app's screens keep "1.5 h (1:30)".
- **D-03:** Amounts stay **"$12.50"**: dollar sign with a decimal point, even inside Turkish text.
- **D-04:** Dates and months use Turkish names through `Intl` 'tr-TR', e.g. "13–19 Ekim 2026" and "Pzt 13 Eki".

### Text message
- **D-05:** Content is a line per session plus totals. Each session line has the date, subject and lesson and activity time, e.g. "Pzt 13 Eki · Yüzme · ders 0,75 saat (0:45), aktivite 0,25 saat (0:15)". Then lesson and activity totals. Travel is never included.
- **D-06:** Half-credit shared swim sessions show **credited time only**, with no "shared" or "half" note. Totals use credited time.
- **D-07:** Expenses show as the **total only**, e.g. "Masraflar $18.75 (fişler PDF'te)" ("receipts are in the PDF"). The family's share of split expenses counts toward the total.
- **D-08:** **Editable message per family and period.** The app fills a text box with the generated Turkish message. The user can edit any part, and Save stores that edited text for that family and period. Copy copies the box's current text. — **Reversibility:** costly — new stored record (family + period → edited text), and it must join the backup format.
- **D-09:** If a session or expense in that period changes after the message was saved, keep the user's text and show a banner, "Hours changed since you edited this message", with a **Rebuild Message** button. The app never silently overwrites the user's text.

### PDF
- **D-10:** Header: the instructor's name, family and period, e.g. "Connor B. — Smith ailesi — 13–19 Ekim 2026". The instructor name is entered once in Settings (new setting).
- **D-11:** Body: a session table (date, subject, student, lesson, activity) using credited time, then an expense list showing this family's share of each, then lesson, activity and expense totals. Built from data, not from the edited message text.
- **D-12:** Receipts: **two per page**, each with its expense description and amount as a caption.
- **D-13:** SUM-06 means the PDF totals and the *generated* message totals come from one computation. If the user edits numbers in the saved message, that's their own text; the D-09 banner covers data changes only.

### Sent tracking and warnings
- **D-14:** A **"Mark as Sent"** button records that the family's period was sent (timestamp). Copy and Share never mark it automatically. — **Reversibility:** costly — new stored record, and it joins the backup format.
- **D-15:** Editing a session or expense in a sent period flags it **"changed since sent"**. The flag shows on the family's row in the summaries list and inside the summary.
- **D-16:** Warnings for an expense with no receipt or a session with zero minutes appear as a list at the top of the summary. They **never block** Copy or Share.

### Claude's Discretion (area not discussed)
- **Where it lives:** a new **Summaries** tab, so the tabs become Log · Sessions · Summaries · People · Settings. It shows the list of active families with their default period: the most recent complete week or month (Mon–Sun), based on each family's `period` setting. A row opens that family's summary, with ‹ › to move between periods. VIEW-01/02 (personal totals) go in the Sessions tab, which already has a Week/Month toggle: a totals section with student, family and subject breakdowns. Subject totals count actual time once; family and student totals use credited time. Travel is included in this personal view only. The UI-SPEC confirms the layout.
- **Backup:** instructor name, saved message edits and sent records must be in the backup. This needs a new schemaVersion 3, and restore must still read v1 and v2. — **Reversibility:** one-way — a published backup contract, the same rule as Phase 3 D-06. The planner treats this as an extension of the already-approved single-file format, not a new user decision.
- **PDF library:** jsPDF 4.2.1, per CLAUDE.md, which allows this new package. Fallback is pdf-lib inside the PDF module only (ROADMAP device spike). Turkish characters (ş, ğ, ı, İ, ç, ö, ü) must render: jsPDF's built-in fonts lack them, so an embedded font is likely needed. The researcher confirms this.

### Deferred Ideas (OUT OF SCOPE)

## Deferred Ideas
- Translating the app's own screens into Turkish (its own phase if wanted).
- VIEW-03 CSV export; SUM-09 frozen snapshot of what was sent (v2 requirements).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUM-01 | Pick family and period; default is the most recent complete week or month for the family's `period` | Default-period rule reuses `periodRange` and `shiftPeriod` (`src/domain/dates.ts`) |
| SUM-02 | Lesson and activity hours separately, travel excluded, itemized sessions and expenses | `buildFamilySummary` model; credited half-minute integers (Credit Math) |
| SUM-03 | Hours as decimal plus h:mm, one formatter | Shared rounding core in `hours.ts`; Turkish variant (Turkish Formatting) |
| SUM-04 | Copy summary as plain text | Pure renderer; Copy handler stays synchronous (Pitfall 9) |
| SUM-05 | PDF with receipt images, iOS share sheet, download fallback | Lazy jsPDF module; reuse `shareFile` (PDF Build and Share) |
| SUM-06 | Text and PDF totals identical | One model feeds both renderers (Architecture, Pattern 1) |
| SUM-07 | Warnings for expense without receipt and session with zero minutes | Warnings computed in the model (Pattern 1) |
| SUM-08 | Mark as sent; later edit flags "changed since sent" | Fingerprint stored at Mark time (Data Model) |
| VIEW-01 | Own totals per week and month: lesson, activity, travel | `src/domain/viewTotals.ts`; Sessions tab reuses `periodRange` |
| VIEW-02 | Breakdown by student, family, subject; subject counts actual time once, family and student use credited time | Credit Math |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Family summary model (hours, totals, warnings, fingerprint) | Browser (pure domain) | Database (read) | One computation for text, PDF and banner (SUM-06, D-13) |
| Turkish message text | Browser | Database (saved edits) | Generated locally; the edited copy is stored in Dexie |
| PDF build | Browser (lazy module) | Database (receipt Blobs via data layer) | No backend; receipts stay on the phone |
| Share PDF | Browser / OS share sheet | Browser download (fallback) | `navigator.share` with a File; `shareFile` already has the fallback |
| Saved message, sent record, instructor name | Database (Dexie v2) | Backup file (schema v3) | D-08, D-10, D-14 |
| Embedded Turkish font | Static asset in the lazy PDF chunk | Service worker precache | Offline requirement |
| Personal totals (VIEW) | Browser (pure domain) | Database (read) | Same credit rules as the summary |

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jspdf | 4.2.1 (exact pin, like `dexie` and `preact` in `package.json`) | Text, pages, embedded TTF, JPEG pass-through, Blob output | Named in CLAUDE.md. Published 2026-03-17, MIT, ~9.4M weekly downloads. Deps: `@babel/runtime ^7.28.6`, `fflate ^0.8.1`, `fast-png ^6.2.0` [VERIFIED: npm registry, 2026-10-19] |
| dexie | 4.4.6 (installed) | `periodRecords` table via `version(2)` | Already the only importer in `src/data/` [VERIFIED: package.json] |

Install (after approval; no other packages): `npm install jspdf@4.2.1 --save-exact`.

**Alternatives:**

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| jsPDF | pdf-lib 1.17.1 | Fallback inside `src/pdf/` only. Gate OK, but last published 2021-11-06 |
| jspdf-autotable | Hand-drawn tables | **Excluded.** Gate SUS (published 2026-10-15). Fixed widths and a repeating header are simple to draw |
| Noto Sans | Built-in Helvetica | Silently corrupts Turkish letters (Turkish Glyphs). Not usable |
| Noto Sans subset | Full Noto TTF (~630 KB each) | Works, but adds ~1.26 MB to precache |

**Dev-only, one-off (not in the repo):** fontTools 4.60.2 (`pyftsubset`) for the subset; macOS `base64` for the TS module.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| jspdf@4.2.1 | npm | published 2026-03-17 | 9,412,068/wk | github.com/parallax/jsPDF | OK | Approved (CLAUDE.md) |
| fflate (dep) | npm | publishedAt 2026-05-16 | 60,637,624/wk | github.com/101arrowz/fflate | OK | Approved (transitive) |
| fast-png (dep) | npm | published 2025-12-18 | 8,341,570/wk | github.com/image-js/fast-png | OK | Approved (transitive) |
| pdf-lib@1.17.1 | npm | published 2021-11-06 | 11,473,039/wk | github.com/Hopding/pdf-lib | OK | Not installed; fallback |
| jspdf-autotable@5.0.9 | npm | published 2026-10-15 | 2,609,896/wk | github.com/simonbengtsson/jsPDF-AutoTable | SUS (`too-new`) | REMOVED from plan |
| @expo-google-fonts/noto-sans@0.4.2 | npm (font source, not installed) | not recorded | n/a | Expo wrapper, MIT; font OFL-1.1 | OK | TTF source only |

Gate: `node ~/.claude/gsd-core/bin/gsd-tools.cjs query package-legitimacy check --ecosystem npm <pkgs>` [VERIFIED: gate output, 2026-10-19]. No SLOP verdicts.

**Security register:** `03-SECURITY.md` T-03-SC says "`package.json` runtime dependencies are exactly dexie and preact". Adding jsPDF changes that; update T-03-SC when it lands.

## Architecture Patterns

### Module layout

```
src/domain/
  hours.ts       # extract hoursParts(halfMinutes); add formatHoursTr (formatHours output unchanged)
  summary.ts     # NEW pure: period keys, buildFamilySummary, renderMessageTr, warnings, fingerprint, pdfFileName
  viewTotals.ts  # NEW pure: VIEW-01/02
  turkish.ts     # NEW pure: tr-TR labels via formatToParts
src/data/
  periodRecords.ts  # NEW Dexie reads/writes for records and summary inputs
  instructor.ts     # NEW meta get/set 'instructorName'
src/pdf/
  summaryPdf.ts     # NEW: only file importing jspdf; dynamic import; buildSummaryPdf(model, instructorName, loadPhoto)
  fonts/NotoSans-Regular.ts, NotoSans-Bold.ts   # NEW generated base64 modules
  fonts/OFL.txt                                 # NEW licence copied from LICENSE_FONT
src/ui/  Summaries.tsx, FamilySummary.tsx, PersonalTotals.tsx, InstructorSheet.tsx (NEW); Settings.tsx (Instructor group first)
src/ui/components.tsx: TabId union (line 126) gains 'summaries'
```

### Data flow

```
Summaries / FamilySummary (Preact)  ── useLive (src/data/live.ts)
  │ plain rows: sessions in period, expenses, attachment ids (primaryKeys only, no Blobs)
  ▼
domain/summary.ts  buildFamilySummary → { sessions, expenses, totalsHalf, warnings, fingerprint, hasReceipts }
  │                                   │
  ▼                                   ▼
renderMessageTr (text box)        pdf/summaryPdf.ts (lazy jspdf; photos read one at a time)
  │                                   │ Blob (prebuilt)
  ▼                                   ▼
Copy: writeText in the tap        Share PDF: shareFile(new File([blob], name, {type:'application/pdf'}))
```

### Pattern 1: one model, three readers (SUM-06, D-13)
`buildFamilySummary` alone decides: which sessions belong to the family (attendee's `familyId`); credited lesson and activity in integer half-minutes; each family's expense share (`splits`); warnings; the fingerprint. The PDF never reads the saved message (D-11).

Warnings (UI-SPEC): expense with no `photoIds` → "No receipt: {description}, {amount} ({Mon D})". Family's credited lesson and activity both zero → "No lesson or activity minutes: {Subject}, {Mon D}". Credited zero equals entered zero, since `creditedMinutes` returns `minutes / 2` for half and half of a non-zero integer is at least 0.5 [VERIFIED: `src/domain/session.ts:80-82`].

### Pattern 2: pure model, thin renderers
Only `src/pdf/summaryPdf.ts` knows jsPDF. Swapping to pdf-lib changes that one file.

### Pattern 3: pre-build, then share synchronously (Pitfall 9)
Build the PDF in an effect keyed on `fingerprint + instructorName` when the summary opens; show "Preparing PDF…" (disabled) until ready. On tap, call `shareFile` with no `await` before it: `canShare` and `env.share` run before the first `await` in `shareFile` [VERIFIED: `src/pwa/share.ts:34-44`]. Release the Blob on close.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| PDF writer | Own writer | jsPDF 4.2.1 | JPEG pass-through verified |
| TrueType subsetting | A subsetter | fontTools once; jsPDF subsets glyphs used at output [VERIFIED: `dist/jspdf.es.js:21896`] | Vendored file only needs the character set |
| Turkish names | Name tables | `Intl` tr-TR with `formatToParts`, `timeZone: 'UTC'` | CLDR data (verified) |
| Hours rounding | Second routine | Shared core in `hours.ts` | One rule (D-02) |
| Content hash | Crypto | 53-bit deterministic hash (cyrb53-style) | Change detection only; `crypto.subtle` is async |
| Tables | Table engine | Hand-drawn rows with `splitTextToSize` | Fixed widths 80/72/164/100/100 = 516 pt |
| Filename folding | NFD stripping | Explicit Turkish map before lowercasing (Pitfall 10) | NFD does not handle `ı` |

## Turkish Glyphs and the Embedded Font

**Built-in Helvetica (verified).** jsPDF 4.2.1 writes `/Encoding /WinAnsiEncoding` for Helvetica. Bytes it writes for test strings [VERIFIED: runtime, `jspdf@4.2.1`, scratch test 2026-10-19]:

| Input | Tj bytes | Drawn by a WinAnsi viewer |
|-------|----------|---------------------------|
| `ç ö ü` | `e7 20 f6 20 fc` | ç ö ü (correct) |
| `ş` (U+015F) | `01 5f` | `_` (0x01 unused) |
| `ı` (U+0131) | `01 31` | `1` |
| `İ` / `Ş` | `01 30` / `01 5e` | `0` / `^` |
| `—` (U+2014) | `97` | — (WinAnsi 0x97, correct) |

The WinAnsi table entries are from PDF 32000 Annex D [ASSUMED: standard reference, not fetched this session].

**Embedded font (verified at byte and text level).** Noto Sans subsets embedded with `addFileToVFS` and `addFont`: output has `/FontFile2`, `/Identity-H` and `/ToUnicode`; PDF 20,174 bytes. The ToUnicode map gives back U+015F, U+011F, U+0131, U+0130, U+015E and U+011E from the Tj glyph IDs (self-consistent text extraction). Glyph shapes were not rasterized: this machine has no PDF rasterizer. Shapes need a device check (A6).

**Subset.** Source: `@expo-google-fonts/noto-sans@0.4.2` (`400Regular/NotoSans_400Regular.ttf`, `700Bold/NotoSans_700Bold.ttf`), 629,024 and 630,968 bytes. Command (run once, output committed):
```bash
pyftsubset NotoSans_400Regular.ttf --unicodes="U+0000-00FF,U+0100-017F,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026" --layout-features='kern,liga,calt' --no-hinting --output-file=NotoSans-Regular.subset.ttf
```
Result: 27,296 bytes Regular, 27,276 bytes Bold, 329 glyphs; `ş ğ ı İ Ş Ğ ç ö ü Ç Ö Ü — – ·` all present [VERIFIED: fonttools 4.60.2 cmap].

**Coverage gap in UI-SPEC.** The spec's "Basic Latin, Latin-1 and Latin Extended-A" excludes U+2013 (en dash in "13–19 Ekim") and U+2014 (em dash in the PDF header). Include both, as above.

**Licence.** `LICENSE_FONT`: "Copyright 2022 The Noto Project Authors" under SIL OFL 1.1. No Reserved Font Name is declared in the copyright line, so subsetting is permitted [VERIFIED: LICENSE_FONT lines 1, 33]. Ship the OFL text as `src/pdf/fonts/OFL.txt`.

**Location.** A generated TS module, `NotoSans-Regular.ts` (`export const REGULAR_BASE64 = "…"`), made with `base64 -i NotoSans-Regular.subset.ttf` (about 36.4 KB each, ≈72.8 KB both). It sits in the lazy PDF chunk, so it is precached and offline-safe. jsPDF's VFS path needs base64 (or a binary string starting `\x00\x01\x00\x00`) [VERIFIED: `dist/jspdf.es.js:21219-21226`].

## Data Model and Backup v3

### Dexie v2
Keep `DB_NAME = 'lesson-ledger-v1'` (`src/data/db.ts:4`); `check-dist` C7 requires it. Do not edit `version(1)` (`db.ts:29` comment). Add:
```ts
db.version(2).stores({ periodRecords: 'id, familyId' });
```
Dexie's `stores()` specifies "tables to be added, altered or deleted in this version", so unchanged tables are not repeated [CITED: https://dexie.org/docs/Version/Version.stores()].

Record (one per family and period):
```ts
export interface PeriodRecord {
  id: string;                          // `${familyId}_${periodKey}`
  familyId: string;
  periodKey: string;                   // 'W2026-10-12' (week from Monday) or 'M2026-10' (month)
  message: string | null;              // D-08 saved edited text
  messageFingerprint: string | null;   // fingerprint at Save (D-09)
  messageSavedAt: number | null;
  sentAt: number | null;               // D-14
  sentFingerprint: string | null;      // fingerprint at Mark (D-15)
  updatedAt: number;
}
```
The id must match the backup validator `/^[A-Za-z0-9_-]{1,64}$/` (`src/domain/backup.ts:76`). A `:` or `|` separator would make every record "damaged" at restore. A 36-character UUID plus `_W2026-10-12` is 48 characters. Delete a row when it has neither `message` nor `sentAt`.

### Fingerprint, not `updatedAt` (SUM-08, D-09, D-15)
Watermarks fail on the current write paths:
- Deleting a session leaves nothing behind: `deleteSession` removes the row and bumps nothing (`src/data/sessions.ts:73-80`).
- Receipt add or remove does not touch the expense row; `writeSessionExpenses` only `put`s an expense when description, amount or splits change (`src/data/expenses.ts:48-55`), and receipts live in `attachments` (`:69-89`).
- A save with no change still bumps `updatedAt` (`src/data/sessions.ts:59`), so false alarms.

Fingerprint the parent-visible data of the period for family F: sessions in the period with F among attendees (sorted by id: date, startTime, endTime, subject, lessonMinutes, activityMinutes, travelMinutes, attendees, credits); their expenses (sorted by id: description, amountCents, splits, sorted photoIds); the family name. Exclude student names, instructor name and message text. Hash the canonical JSON with a 53-bit hash.
- `messageFingerprint` ≠ current → stale banner (D-09). Rebuild does not change it; Save does.
- `sentFingerprint` ≠ current → "Changed since sent" (D-15). Reverting an edit clears the flag.

### Backup schema v3 (one-way contract)
Current: `BACKUP_FORMAT = 'lesson-ledger-backup'`, `BACKUP_SCHEMA_VERSION = 2` (`src/domain/backup.ts:18-19`).
- Set `BACKUP_SCHEMA_VERSION = 3`. Add `periodRecords: PeriodRecord[]` and `instructorName: string | null`.
- For `version < 3`, both must be absent, empty or null. This matches the v1 check at `backup.ts:217-219`.
- Restoring v1 or v2 clears `periodRecords` and the instructor name ("Restoring replaces everything on this phone", UI-SPEC). Confirm (Open Question 5).

Traps:
- `buildBackup` returns named fields only (`src/data/backup.ts:41-50`). A new table read by `dataTables()` is **silently dropped** unless added to the return value.
- `dataTables()` excludes `meta` (`backup.ts:17`). Read `instructorName` inside the same read transaction by adding `db.meta` to the list at `backup.ts:27`.
- `restoreBackup` throws for a table with no source (`backup.ts:74`), a tripwire on the restore side. Add `periodRecords` to `sources`; set or delete `meta.instructorName` in the existing rw transaction (`backup.ts:75` already includes `db.meta`).
- Check referential integrity on read: each `periodRecords.familyId` must be a family in the file.

## Credit Math (VIEW-01, VIEW-02, SUM-02)

Stored rules: `creditedMinutes` is `mode === 'half' ? minutes / 2 : minutes` (`src/domain/session.ts:80-82`); half credit only exists for a two-family swim (`session.ts:69-74`); `FamilyCredit` has one entry per family (`src/domain/types.ts:35-40`).

Store and sum credited time as **half-minutes**: `2 × minutes` for full, `1 × minutes` for half. Sums stay integers; divide by 2 for display. `halfMinutes` in `hours.ts:6` computes `Math.floor(minutes * 2 + 0.5)`, so `formatHours(halfTotal / 2)` is exact.

| Quantity | Definition |
|----------|-----------|
| Summary lesson / activity (SUM-02) | Σ over sessions where F attends, credited half-minutes for F's mode |
| Summary expenses (D-07) | Σ of F's `splits[].cents` |
| Summary travel | Never shown |
| Family row, personal (VIEW-02) | Family's credited lesson/activity; **full** travel for each session F attends (Assumption 7) |
| Student row, personal | Family's credited time for sessions the student attended (Assumption 8) |
| Subject row, personal | Σ **actual** minutes per subject, each session once |
| Top "Totals" group | Recommended: actual minutes once, equal to the subject rows. UI-SPEC wording is ambiguous; confirm |

Example: one swim, 45 minutes, family A half and B full. Swim = 45; A = 22.5; B = 45; A + B = 67.5 > 45. This is why the footer says rows can exceed the total.

## Turkish Formatting

**Hours (D-02).** Extract the rounding core from `hours.ts:6-16`; the Turkish variant only changes separator and unit word. Keep `tests/hours.test.ts` passing.
```ts
export function formatHoursTr(minutes: number): string {  // "1,5 saat (1:30)"
  const { whole, frac, hm } = hoursParts(minutes);        // shared rounding
  return `${frac ? `${whole},${frac}` : whole} saat (${hm})`;
}
```
Verified with the existing `formatHours` logic copied from `hours.ts` [VERIFIED: runtime, 2026-10-19]: 0 → `0 saat (0:00)`; 15 → `0,25 saat (0:15)`; 22.5 → `0,38 saat (0:23)`; 45 → `0,75 saat (0:45)`; 60 → `1 saat (1:00)`; 105 → `1,75 saat (1:45)`. All match UI-SPEC.

Amounts: `formatCents` (`src/domain/money.ts:22-27`) gives "$12.50" and "$1,000.00" (D-03).

**Dates (D-04)** [VERIFIED: Node 24.22.0, ICU 78.3, `timeZone: 'UTC'`]:
- Raw `tr-TR` short format puts the weekday last: `12 Eki Pzt`. Build "Pzt 12 Eki" from `formatToParts`.
- Weekdays: `Pzt, Sal, Çar, Per, Cum, Cmt, Paz`.
- Long months: `Ocak … Eylül, Ekim, Kasım, Aralık`. Short: `Oca … Eyl, Eki, Kas, Ara`.
- 2026-10-12 is a Monday (`getUTCDay() === 1`), consistent with UI-SPEC examples.
- iOS Safari ICU not run [ASSUMED: same CLDR data; A3].

**Filename.** Map `Ş→S ş→s Ğ→G ğ→g İ→I ı→i Ç→C ç→c Ö→O ö→o Ü→U ü→u` first, then lowercase, then replace other runs with `-`. Verified: `İş Ağı Öğrenci` → `is-agi-ogrenci`. Lowercasing first would turn `İ` into `i` + U+0307, and NFD leaves `ı` alone.

## PDF Build, Memory and Share

**API used, verified in `jspdf@4.2.1` (tarball `dist/jspdf.es.js`):**
- `addFileToVFS(name, base64)`: `:22183-22186`.
- `addFont(postScriptName, fontName, fontStyle)`: `:4989-5000`; default encoding `Identity-H` for TTF (`:4997`).
- `addImage(Uint8Array, 'JPEG', x, y, w, h, alias, compression)`: Uint8Array skips conversion (`:9406-9410`); `processJPEG` keeps DCT bytes, no re-encode (`:14700`).
- `splitTextToSize`, `getTextWidth`, `setPage`, `internal.getNumberOfPages()`, `output('blob')` (`:3434`), `compress` option: present.
- Page is 612 × 792 pt for `format: 'letter'` [VERIFIED: runtime].

**Bundle.** `dist/jspdf.es.min.js`: 343,605 bytes raw, 109,495 gzip. Current app index chunk: 198,570 bytes raw [VERIFIED: `dist/assets`]. Load with `const { jsPDF } = await import('jspdf');` inside `src/pdf/` only. Vite emitting a separate chunk for that import is standard behaviour [ASSUMED: confirm in `dist/`].

**Memory (Node, indicative; not iPhone).** Receipt-sized JPEG, 1600 × 900, quality 80 (`sips -Z 1600 -s formatOptions 80`), 323,021 bytes. 30 photos (9.2 MB), one per page, then `output`:
- Heap growth after `addImage`: ~15.4 MB. After output: ~19.0 MB (PDF 9.3 MB). Build ~57 ms.
- 60 photos (18.5 MB): ~37.7 MB after output. GC noise is high.

Rule of thumb: peak ≈ 2 × photo bytes plus output [ASSUMED for iPhone; A4].

Design: read one receipt Blob at a time (`new Uint8Array(await blob.arrayBuffer())`); use the photo id as `alias` (otherwise jsPDF hashes the bytes for an alias and shares image objects); build per family on demand; an unreadable receipt throws and fails the whole build (UI-SPEC).

**Share on iOS.**
- `shareFile` (`src/pwa/share.ts:34-52`): AbortError → `cancelled`; other refusal or no support → download. Reuse unchanged.
- The backup path awaits `buildBackup` before `shareFile` (`src/ui/useBackup.ts:22-24`), and STATE.md records the Phase 2 device check: "share sheet and Save to Files work".
- WebKit: transient activation lasts "a few seconds, maybe", its exact length is not observable, awaiting async work "lets the timer keep running, so it can lapse", and `navigator.share()` consumes activation [CITED: https://webkit.org/blog/13862/the-user-activation-api/]. A longer PDF build makes the await risk worse than for backup.
- MDN: `canShare()` returns false if permission is not granted; the page says nothing on PDF or iOS file types [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare].
- Whether iOS `canShare({files})` is true for `application/pdf` is unconfirmed [ASSUMED: A1].

## PWA and Bundle Impact

| Item | Fact | Source |
|------|------|--------|
| Precache glob | `**/*.{js,css,html,png,svg,webmanifest}` | `vite.config.ts:27` |
| Per-file precache cap | 2,097,152 bytes default; larger entries are skipped with a warning | `workbox-build/build/schema/GenerateSWOptions.json`; `vite-plugin-pwa/dist/chunk-G4TAN34B.js:45` |
| `.ttf` in precache | Not matched; PDF would fail offline | `vite.config.ts:27` |
| Added precache | jsPDF 343,605 + font module ~72,800 ≈ 416 KB raw | sizes above |

Keep the font in a TS module. If a binary TTF is chosen instead, add `ttf` to `globPatterns`. Add a `check-dist` check: the PDF chunk is in `sw.js` and no precache entry exceeds 2 MiB (today a skipped file is silent).

## Common Pitfalls

1. **Helvetica corrupts Turkish letters silently.** `ş ı İ Ş` draw as `_ 1 0 ^`; `ğ Ğ` have no WinAnsi code. Use the embedded font for all PDF text.
2. **Dashes missing from the subset.** U+2013 and U+2014 are outside the UI-SPEC ranges. Include them.
3. **`jspdf-autotable`.** SUS. Hand-draw.
4. **`.ttf` not precached.** Offline PDF breaks. Put the font in the TS module, or add `ttf` to `globPatterns` (`vite.config.ts:27`).
5. **Eager jsPDF import.** +343,605 bytes raw on first load. Use dynamic import.
6. **Composite id with `:` or `|`.** Backup validator rejects every record (`backup.ts:76`).
7. **New table missing from export.** `buildBackup` returns named fields only (`backup.ts:41-50`).
8. **Instructor name read outside the snapshot.** Read `meta` inside the backup read transaction.
9. **`await` between tap and share.** Safari may reject `navigator.share` with `NotAllowedError`. Community reports describe this after an await [ASSUMED: unconfirmed; risk signal]. `shareFile` would then download. Pre-build; keep Copy synchronous (`navigator.clipboard.writeText` with text already in state).
10. **Turkish case in filename.** `'İ'.toLowerCase()` gives `i` + U+0307 (`69 307`); `ı` does not decompose. Use the explicit map first.
11. **Rounding mismatch.** Two 22.5-minute lines each show `0,38 saat (0:23)` (sum 0:46); the exact total shows `0,75 saat (0:45)`. Open Question 1.
12. **Intl default order.** `12 Eki Pzt`; assemble from parts.
13. **Local-time date math.** Use `timeZone: 'UTC'` and `Date.UTC` as `dates.ts` does (`src/domain/dates.ts:29`, `:79`). Test: `TZ=Pacific/Kiritimati`, `TZ=Pacific/Pago_Pago`, `TZ=America/Los_Angeles` on `npx vitest run`.
14. **Editing `version(1)`** or renaming the DB breaks installs (`db.ts:4`, `:29`).
15. **jsPDF 2.x / 3.x snippets.** Check every call against 4.2.1 source.
16. **Lazy chunk after an update.** An old chunk name can 404 offline mid-session. Start the import when the summary opens; accept a rare generic PDF error.

## Code Example (verified shape)

```ts
// jspdf@4.2.1: addFileToVFS dist/jspdf.es.js:22183, addFont :4989, addImage :9406; runtime test 2026-10-19
const { jsPDF } = await import('jspdf');
const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
doc.addFileToVFS('NotoSans-Regular.ttf', REGULAR_BASE64);
doc.addFileToVFS('NotoSans-Bold.ttf', BOLD_BASE64);
doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
doc.setFont('NotoSans', 'bold');
doc.setFontSize(16);
doc.text('Connor B. — Smith ailesi — 13–19 Ekim 2026', 48, 60);
doc.addImage(new Uint8Array(await blob.arrayBuffer()), 'JPEG', 48, 100, 516, 280, photoId, 'NONE');
const pdf = doc.output('blob');  // new File([pdf], name, { type: 'application/pdf' }) → shareFile
```

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `canShare({files})` is true for `application/pdf` on iOS Safari home-screen app | Share on iOS | Download instead of share sheet. Device check |
| A2 | A pre-built PDF lets the Share tap call `navigator.share` in time | Pattern 3 | Share refused; download. Device check |
| A3 | iOS Intl tr-TR output matches Node ICU 78 | Turkish Formatting | Wrong month or weekday on device |
| A4 | Peak iPhone memory ≈ 2 × photo bytes; 30 receipts fit on the oldest supported iPhone | PDF Build | Fall back to pdf-lib in `src/pdf/` (ROADMAP) |
| A5 | Real receipts are about 300 KB (one sample: 323,021 bytes) | PDF Build | Larger PDFs |
| A6 | Embedded glyphs look right on iOS Preview/Mail/Files | Turkish Glyphs | Visual glyph fault. Device check |
| A7 | Vite emits a separate chunk for `import('jspdf')` and workbox precaches it | PDF Build | Initial size or offline PDF. Check `dist/` |
| A8 | Safari rejects `navigator.share` after await (community reports) | Pitfall 9 | Pre-build removes the question |
| A9 | Recommendation: travel-only and family-name edits flag "changed since sent" | Data Model | User decision (Open Question 2, 3) |

## Open Questions (RESOLVED)

1. **Rounding in the message.** Two 22.5-minute lines sum to 0:46 but the total reads 0:45. Options: accept (totals from the exact integer sum, SUM-06), or show `h:mm` only on half-credit lines. Decide. **RESOLVED (user):** CONTEXT D-17 — half credit rounds UP to whole minutes; lines sum to totals.
2. **Travel-only edits flag "changed since sent".** ROADMAP criterion 4 says any session edit flags. Recommend yes (literal rule). Alternative: exclude travel from the fingerprint. **RESOLVED:** CONTEXT D-18 — yes.
3. **Family rename flags the period.** Family name is in the message and PDF headers. Recommend yes. **RESOLVED:** CONTEXT D-18 — yes.
4. **"(fişler PDF'te)" scope.** UI-SPEC says "the period". Recommend this family's expenses, since that is what the PDF shows. **RESOLVED:** CONTEXT D-18 — this family's expenses only.
5. **Restore of v1/v2 clears instructor name and sent records.** Recommend yes, matching the Settings footer copy. **RESOLVED:** CONTEXT D-18 — yes.
6. **Build trigger.** UI-SPEC implies building on tap. Recommend building on open (Pattern 3). Same copy and states; trigger changes. Confirm, since it departs from the spec wording. **RESOLVED:** CONTEXT D-18 — build on open.
7. **Message length cap.** Not specified. Suggest 10,000 characters, enforced on save and restore. **RESOLVED:** CONTEXT D-18 — 10,000 chars.
8. **"Fişler" heading on continued pages.** UI-SPEC has no "(devam)" for receipts. Recommend first receipt page only. **RESOLVED:** CONTEXT D-18 — first receipt page only.
9. **Device spike before ship (not blocking the plan):** PDF share to Messages and Mail (A1, A2); monthly PDF with 30+ receipts on the oldest supported iPhone (A4); glyph shapes in Preview (A6); tr-TR dates on device (A3). **RESOLVED:** device checkpoint at end of phase (not blocking the plan).

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build, tests | ✓ | v24.22.0 (`engines >= 22.12.0`) | — |
| npm | Install | ✓ | 11.19.1 | — |
| Python venv + fonttools | One-off subset | ✓ | fonttools 4.60.2 | Subset elsewhere |
| macOS `sips` | Test JPEG | ✓ (run) | system | — |
| macOS `base64` | Font module | not run | system | — |
| PDF rasterizer | Glyph shapes | ✗ | — | Device check (A6) |
| iPhone (iOS 26.x) | Share, memory, glyphs | not available here | — | Manual checkpoint (OQ 9) |

No blocking gaps for the plan; the device spike is a manual checkpoint.

## Security Domain

Enabled (`security_enforcement` true; ASVS level 1, `.planning/config.json`).

| ASVS | Applies | Control |
|------|---------|---------|
| V2 / V3 / V4 | no | Single-user, local, no login or sessions |
| V5 Input validation | yes | Instructor name ≤ `NAME_MAX = 60` (`src/domain/types.ts:4`); message cap (OQ 7); backup id and referential checks (`backup.ts:76`) |
| V6 Cryptography | no | Fingerprint is change detection, not security |
| V8 Data protection | yes | PDF and backup carry names and receipts; plaintext backup accepted (`03-SECURITY.md` T-03-15). PDF share is user-initiated; no network code |
| V12 Files | yes | ASCII filename slug; strip separators |

Threats: crafted backup with unknown families (referential check before any write); oversized message (cap; 150 MB backup cap, `backup.ts:21`); text injection into PDF (jsPDF writes glyph IDs, no markup; keep Preact text rendering, T-03-04); filename tricks (slug); jsPDF supply chain (gate OK, exact pin, autotable excluded).

## Sources

**Primary (HIGH):**
- `npm view jspdf@4.2.1` and tarball `jspdf-4.2.1.tgz` (scratch extract): `dist/jspdf.es.js`, `dist/jspdf.es.min.js`, `package.json`. [VERIFIED]
- Package-legitimacy gate output for jspdf, fflate, fast-png, pdf-lib, jspdf-autotable, @expo-google-fonts/noto-sans, @fontsource/noto-sans. [VERIFIED]
- Repo files read this session: `src/domain/{hours,session,dates,money,expense,types,photos,backup}.ts`, `src/data/{db,backup,expenses,sessions,families,live}.ts`, `src/pwa/share.ts`, `src/ui/{useBackup,App,Sessions}.tsx`, `vite.config.ts`, `scripts/check-dist.mjs`, `package.json`, `.planning/config.json`. [VERIFIED]
- `LICENSE_FONT` and TTF from `@expo-google-fonts/noto-sans@0.4.2`. [VERIFIED]
- workbox-build schema default and vite-plugin-pwa message (node_modules). [VERIFIED]

**Secondary (MEDIUM):**
- [WebKit: The User Activation API](https://webkit.org/blog/13862/the-user-activation-api/) [CITED]
- [MDN: Navigator.canShare()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare) [CITED]
- [Dexie: Version.stores()](https://dexie.org/docs/Version/Version.stores()) [CITED]
- WebKit bug and community search results on Safari share after await [risk signal only; low authority]

**Runtime checks, this session (2026-10-19):** jsPDF Helvetica bytes and font dictionary; embedded Noto Sans subset output and text extraction; receipt JPEG memory run; Intl tr-TR outputs (Node ICU 78.3); `formatHours` logic on spec examples; fonttools 4.60.2 subset and cmap.

## Metadata

**Confidence breakdown:**
- Standard stack and legitimacy: HIGH.
- Glyph encoding and embedding: HIGH for bytes and text extraction; MEDIUM for shapes (A6).
- Data model, backup and credit math: HIGH (derived from current write and backup code, cited with lines).
- Turkish formatting: HIGH for Node; MEDIUM for iOS (A3).
- Memory and share on iPhone: LOW-MEDIUM (A1, A2, A4, A5, A8).

**Skipped:** Validation Architecture (`workflow.nyquist_validation` is `false`). Runtime State Inventory (not a rename or migration phase).

**Research date:** 2026-10-19
**Valid until:** 2026-11-18. Re-check jsPDF releases if the phase slips.
