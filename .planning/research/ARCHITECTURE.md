# Architecture Research

**Domain:** Offline-first iPhone PWA — private lesson/hours logger with receipt photos, per-family text and PDF summaries, and JSON/zip backup
**Researched:** 2026-10-18
**Confidence:** MEDIUM overall. HIGH for the general offline-PWA structure and data model. MEDIUM for iOS storage behavior (mixed evidence). LOW for PDF file sharing through the iOS share sheet until it is tested on a device.

## Recommendations at a Glance

1. **Pure domain core, thin shell.** All rules (credit factor, period boundaries, expense split, summary math, validation) live in plain TypeScript with no DOM, IndexedDB, or network imports. Unit-test this layer; it is where "the summary is correct" is won or lost.
2. **One summary model, two renderers.** Build a single `FamilySummary` object per family per period. The text message and the PDF are both rendered from it. They never have separate calculation code.
3. **IndexedDB via a thin wrapper, all tables defined in schema v1.** Include `attachments` and `meta` from day one so the backup code covers every table and schema churn stays at zero.
4. **Hours are stored as integer minutes, money as integer cents, dates as local `YYYY-MM-DD` strings, IDs as UUIDs.** No floats for money, no UTC bucketing, no auto-increment IDs. Restore and merge depend on this.
5. **Receipts live in their own store and are downscaled at capture.** List and overview screens never load image bytes. Summaries and PDFs load only the receipts they show.
6. **Summaries are derived, never stored as the source of truth.** Only raw session and expense records are persisted.
7. **Build order puts risky iOS behavior first.** Verify home-screen install, offline boot, storage persistence, and camera input on the real phone in phase 1, and verify PDF sharing before committing to the summary-PDF phase.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  UI  (screens + components; the only layer that renders)            │
│  Log · Sessions · Families/Students · Summaries · Overview · Backup │
└───────┬─────────────────────┬──────────────────────┬───────────────┘
        │ live reads          │ pure calls           │ actions
        ▼                     ▼                      ▼
┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐
│ Data layer       │  │ Domain core (pure) │  │ Output / IO          │
│ repos + Dexie    │◄─│ validate, credit,  │─►│ summaryText          │
│ transactions     │  │ periods, allocate, │  │ summaryPdf (+receipts)│
│ attachments(Blob)│  │ summary, overview  │  │ share (Web Share)    │
└───────▲──────────┘  └────────────────────┘  │ backup zip / restore │
        │                                     │ receipt downscale    │
        └─────────────────────────────────────┴──────────┬───────────┘
                                                         │
┌────────────────────────────────────────────────────────▼───────────┐
│ PWA shell: service worker precache · manifest · storage.persist()   │
└────────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** `UI → {domain, data, output}`, `output → domain`, `data → types only`, `domain → types only`. Nothing imports upward. Domain never imports Dexie, DOM, or `fetch`.

### Component Responsibilities

| Component | Responsibility | Talks to | Notes |
|-----------|----------------|----------|-------|
| **UI screens** | Forms, lists, period picker, share buttons | Domain (validate/compute), Data (repos + live queries), Output | No business rules inline |
| **Domain core** | Types; `validateSession`; `creditFactor`; `periodFor(family, date)`; `allocateCents`; `buildFamilySummary`; `buildOverview` | Nothing (pure) | Fully unit-testable with Vitest/Jest in Node |
| **Data layer (repos)** | Dexie schema; CRUD per entity; cascades in one transaction; `liveQuery` wrappers for UI | Dexie/IndexedDB only | The only code that knows table names |
| **Attachments** | Store receipt Blobs; return metadata without Blobs; create/revoke object URLs | Data layer | Blob lives in its own table |
| **Media pipeline** | Take the `<input type=file>` result, decode, downscale, re-encode to JPEG, return dimensions and Blob | Attachments | Also normalizes whatever format the picker returns |
| **Summary renderers** | `renderSummaryText(model)` (string); `renderSummaryPdf(model, receiptBlobs)` (Uint8Array via pdf-lib or similar) | Domain (types), Attachments (PDF only) | Text and PDF read the same model |
| **Share adapter** | `navigator.canShare({files})` → `navigator.share`; fallbacks to clipboard (text) or `<a download>` (file) | Browser APIs | Isolated because iOS behavior is the riskiest part |
| **Backup/restore** | Snapshot all tables in one read transaction → zip (`backup.json` + `attachments/`); validate `schemaVersion`; restore in one read-write transaction | Data layer (all tables), Domain (validation) | Restore is all-or-nothing |
| **PWA shell** | Precache app assets; manifest; apple-touch-icon; update-available prompt; `navigator.storage.persist()` and `estimate()` | Browser APIs | Must work with zero network after first load |

---

## Data Model

### Tables (Dexie schema v1, all defined up front)

```ts
db.version(1).stores({
  families:    'id, name',           // Family
  students:    'id, familyId',       // Student
  sessions:    'id, date, subject',  // Session; attendees and familyCredit embedded
  expenses:    'id, sessionId',      // Expense; allocations embedded
  attachments: 'id, expenseId',      // Receipt; Blob stored in the row
  meta:        'key'                 // schemaVersion, lastBackupAt, prefs
});
```

Only indexed fields appear in the store string. Embedded arrays are not indexed, which is fine at this scale (on the order of 10^4 sessions for a decade of use). Revisit only if a measured query is slow.

### Entities

```ts
type Subject = 'swim' | 'math';
type Credit  = 'full' | 'half';          // factor 1 or 0.5 (see credit rules below)

interface Family {
  id: string;                            // UUID
  name: string;
  period: 'weekly' | 'monthly';          // reporting period, per family
  createdAt: number; updatedAt: number;
}

interface Student {
  id: string;
  familyId: string;
  name: string;
  archived?: boolean;                    // archive instead of delete to keep history intact
  createdAt: number; updatedAt: number;
}

interface Session {
  id: string;
  date: string;                          // local calendar date 'YYYY-MM-DD'
  subject: Subject;
  lessonMin: number;                     // integer >= 0
  activityMin: number;                   // integer >= 0
  travelMin: number;                     // integer >= 0; instructor's records only
  attendees: { studentId: string; familyId: string }[];   // swim: 1-2; math: exactly 1
  familyCredit: { familyId: string; credit: Credit }[];   // one entry per distinct family in attendees
  createdAt: number; updatedAt: number;
}

interface Expense {
  id: string;
  sessionId: string;                     // date comes from the session, not stored twice
  description: string;
  amountCents: number;                   // integer
  allocations: { familyId: string; cents: number }[];     // stored; sum === amountCents
  createdAt: number; updatedAt: number;
}

interface Attachment {                   // receipt photo
  id: string;
  expenseId: string;
  mime: 'image/jpeg';
  width: number; height: number;
  bytes: number;
  blob: Blob;
  createdAt: number;
}
```

### Modeling rules and why

| Rule | Why |
|------|-----|
| **Credit is per family per session** (`familyCredit`), not per student | Matches the requirement wording ("each family is credited full or half"). Siblings in one session get one credit entry, so no double counting. |
| **`familyId` is snapshotted onto each attendee at log time** | Denormalization on purpose. If a student is later moved to another family, past sessions still belong to the family that was billed. |
| **Credit factor is derived, not stored as a float** | `full → 1`, `half → 0.5`. 0.5 is exact in IEEE 754, so credited minutes stay exact through sums. Round only once, for display. |
| **Store raw minutes, apply credit at summary time** | Lets the credit be changed on a session without rewriting its minutes, and keeps the raw instructor time available for the overview. |
| **Expense date = session date** | One fewer field to drift out of sync. Expenses are logged on a session by requirement. |
| **Allocations are materialized and stored** | What the parent was told is what is stored. A later edit to session credit should not silently change an already-sent expense share. Computed once at save with largest-remainder rounding, then user-editable. |
| **Summaries are derived, not stored** | Single source of truth. Only an optional `sentSummaries` snapshot table would be added later (see open questions). |
| **Receipts in their own table** | Session and expense lists never load image bytes. Blob reads happen only for PDF generation. |
| **Cascade delete in one transaction** | Deleting a session deletes its expenses and their attachments atomically. No orphans. |

### Derived shapes (computed, never persisted)

```ts
interface PeriodRef {
  kind: 'weekly' | 'monthly';
  key: string;                           // '2026-W42' (ISO week, Monday start) or '2026-10'
  start: string; end: string;            // inclusive 'YYYY-MM-DD'
}

interface FamilySummary {                // one per family per period; feeds BOTH text and PDF
  familyId: string;
  familyName: string;
  period: PeriodRef;
  lessonMin: number;                     // credited; may be x.5
  activityMin: number;                   // credited; may be x.5
  lessons: {                             // itemized session lines
    date: string; subject: Subject; studentNames: string[];
    lessonMin: number; activityMin: number;   // already credited for this family
  }[];
  expenses: {                            // itemized, this family's allocation only
    date: string; description: string; cents: number; receiptIds: string[];
  }[];
  expenseTotalCents: number;
}

interface OverviewRow {                  // personal overview; per bucket x dimension
  bucket: string;                        // week or month key
  dimension: 'student' | 'family' | 'subject';
  key: string;
  lessonMin: number; activityMin: number; travelMin: number;
}
```

### Core computations (pure functions in domain/)

- `creditFactor(credit)`: `full → 1`, `half → 0.5`.
- `creditedMinutes(session, familyId)`: applies the family's factor to lesson and activity minutes. Travel is never credited to families.
- `periodFor(family, dateStr)`: ISO-week or calendar-month key and inclusive range. Pure string/date math on `YYYY-MM-DD`; avoid `new Date('YYYY-MM-DD')`, which parses as UTC and shifts the day in US timezones.
- `allocateCents(total, families)`: equal split among distinct families, largest-remainder rounding so the parts sum exactly to the total. Used at save time; the user can override.
- `buildFamilySummary(data, familyId, period)`: filters sessions by `date` range using the family's attendees, applies credit, pulls the stored allocations for that family.
- `buildOverview(data, period kind)`: groups raw minutes by bucket and dimension. See open questions for the attribution rules.

---

## Recommended Project Structure

```
src/
├── domain/                 # pure TS; no DOM/Dexie/fetch imports
│   ├── types.ts            # entities + derived shapes above
│   ├── credit.ts           # creditFactor, creditedMinutes
│   ├── periods.ts          # periodFor, ISO week / month ranges
│   ├── validate.ts         # math = 1 attendee; swim 1-2; credit entries match families
│   ├── allocate.ts         # allocateCents (largest remainder)
│   ├── summary.ts          # buildFamilySummary → FamilySummary
│   └── overview.ts         # buildOverview → OverviewRow[]
├── data/                   # the only layer that touches Dexie
│   ├── db.ts               # Dexie schema v1 (+ future versions appended, never edited)
│   ├── families.ts         # repos per entity
│   ├── students.ts
│   ├── sessions.ts         # save/delete session; cascades in one tx
│   ├── expenses.ts
│   ├── attachments.ts      # metadata queries; blob get; URL lifecycle
│   └── live.ts             # liveQuery wrappers consumed by UI
├── media/
│   └── receipts.ts         # file → decode → downscale → JPEG Blob
├── output/
│   ├── summaryText.ts      # FamilySummary → string
│   ├── summaryPdf.ts       # FamilySummary + receipt blobs → Uint8Array
│   ├── share.ts            # Web Share adapter with fallbacks
│   └── overviewCsv.ts      # optional; only if asked for
├── backup/
│   ├── export.ts           # read all tables → zip
│   ├── restore.ts          # unzip → validate → single rw transaction
│   └── manifest.ts         # schemaVersion + shape validation
├── pwa/
│   ├── register.ts         # SW registration, update prompt
│   └── storage.ts          # persist() request, estimate() for settings screen
└── ui/
    ├── screens/            # Log, Sessions, Families, Summaries, Overview, Backup
    └── components/

public/
├── manifest.webmanifest    # display: standalone; start_url; icons
└── apple-touch-icon.png    # 180x180; iOS uses this for the home-screen icon

tests/
├── domain/                 # the bulk of automated tests (pure, fast)
├── data/                   # Dexie tests with fake-indexeddb
└── fixtures/               # sample backups, including a restore-compat fixture
```

### Structure Rationale

- **`domain/` has no runtime dependencies,** so the most error-prone logic (credit, rounding, periods) is testable without a browser.
- **`data/` is the only Dexie importer,** so a storage change (or a Dexie upgrade) touches one folder.
- **`output/` depends only on `domain/` and attachments,** which keeps text and PDF in sync by construction.
- **`backup/` reads through the data layer,** so a new table that is missing from export is a visible code change, not a silent gap.

---

## Architectural Patterns

### Pattern 1: Pure domain core with thin UI shell

**What:** All arithmetic and rules are pure functions over plain objects. UI calls them and renders the results.
**When to use:** Always here. The app's core value is "the summary is correct."
**Trade-offs:** A little more files than inlining logic in components. For one screen it would be overkill, but there are ten.

**Example:**
```ts
// domain/credit.ts
export const creditFactor = (c: Credit): number => (c === 'full' ? 1 : 0.5);

// domain/summary.ts
export function buildFamilySummary(
  data: { sessions: Session[]; expenses: Expense[]; students: Student[]; families: Family[] },
  familyId: string,
  period: PeriodRef,
): FamilySummary { /* pure */ }
```

### Pattern 2: One summary model, two renderers

**What:** `buildFamilySummary` produces the model once. `renderSummaryText` and `renderSummaryPdf` are separate, dumb formatters.
**When to use:** Any time the same numbers appear in more than one output.
**Trade-offs:** The model has to carry everything either renderer needs (for example, receipt IDs), which is a small cost.

### Pattern 3: Dexie `liveQuery` as the reactive state

**What:** Screens subscribe to queries. When a repo writes, every screen showing that data updates automatically.
**When to use:** Single-user app with local data. A global state library adds nothing here.
**Trade-offs:** Tightly coupled to Dexie. Acceptable because the data layer is isolated in `data/`.

### Pattern 4: Attachments in their own store, loaded lazily

**What:** Receipts are separate rows. Metadata loads with the expense list. Blobs load only for display of a single receipt or for PDF build.
**When to use:** Any app storing binary media in IndexedDB.
**Trade-offs:** Two reads instead of one for the PDF path. This avoids loading tens of megabytes on every screen change.

**Object-URL hygiene:** create `URL.createObjectURL(blob)` for display, revoke it on component unmount, and never keep URLs in the store.

### Pattern 5: Single-transaction writes for cascades and restore

**What:** Any multi-table write (session delete with expenses and attachments; restore of all tables) runs inside one Dexie `rw` transaction across the affected tables.
**When to use:** Always for cascades and restore. Restore is the place where a half-finished write would be the worst outcome.
**Trade-offs:** Long restores hold the transaction. At this data size that is well under a second; measure on the phone.

### Pattern 6: Versioned schema from day one

**What:** Schema v1 defines every table, including empty `attachments` and `meta` if the UI for them has not shipped. Future changes are new `db.version(n)` blocks with upgrade functions. Shipped versions are never edited.
**When to use:** From the first commit. Data on the phone is the only copy.
**Trade-offs:** None worth mentioning. The backup format must carry `schemaVersion` and the restore code must refuse unknown versions loudly.

### Pattern 7: App shell precache with explicit update

**What:** The service worker precaches the built app shell (hashed JS/CSS/HTML/icons). When a new build is deployed, the app shows an "update available, reload" prompt rather than swapping assets under the user mid-session.
**When to use:** Offline-first PWA on static hosting (GitHub Pages).
**Trade-offs:** Users may need to relaunch to get updates. For one user on one phone this is fine and avoids mid-form breakage.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing records in localStorage

**What people do:** Put sessions or receipts in `localStorage` because it is easy.
**Why it's wrong:** It is synchronous, capped at about 5 MB per origin, and has no Blob support. Receipts blow the cap quickly.
**Do this instead:** IndexedDB for records, Blobs for images.

### Anti-Pattern 2: Base64 receipts in one big JSON backup

**What people do:** `JSON.stringify` the whole database with base64 images inside.
**Why it's wrong:** Base64 inflates binary by about 33% and roughly doubles peak memory during serialize and parse. On an iPhone Safari tab, a large backup can fail outright.
**Do this instead:** A zip with `backup.json` (records, attachment IDs and metadata) plus `attachments/<id>.jpg` binaries. Streamed or chunked where the library supports it.

### Anti-Pattern 3: Persisting the computed summary as truth

**What people do:** Save the generated summary per family per period and edit it later.
**Why it's wrong:** Two sources of truth drift apart. A session edit silently leaves a stale summary.
**Do this instead:** Derive summaries from raw records every time. If "what was sent" must be frozen, store a timestamped snapshot as a separate, explicitly named record.

### Anti-Pattern 4: Bucketing dates through UTC timestamps

**What people do:** Store `Date.now()` and group by calendar day or week in UTC.
**Why it's wrong:** A session logged at 9 pm local can land on the next day, so it falls into the wrong week or month.
**Do this instead:** Store the local calendar date as `YYYY-MM-DD`. Compare these strings lexicographically (they sort correctly), and never parse them with `new Date(string)`.

### Anti-Pattern 5: Floats for money, auto-increment IDs

**What people do:** `amount: 12.5` and `id: ++counter`.
**Why it's wrong:** Floats drift when summed and split. Auto-increment IDs collide when a backup is restored onto a phone that has its own records.
**Do this instead:** `amountCents` as integers; `crypto.randomUUID()` for IDs.

### Anti-Pattern 6: Two code paths for text and PDF

**What people do:** Write the text summary and the PDF generator separately, each with its own totals logic.
**Why it's wrong:** They will disagree. The parent receives both.
**Do this instead:** Shared `FamilySummary` (Pattern 2) and a test that asserts the totals in both outputs match.

### Anti-Pattern 7: Deleting families or students that have history

**What people do:** Hard-delete a student who has past sessions.
**Why it's wrong:** Past summaries and overview totals lose their names or break.
**Do this instead:** Archive (`archived: true`) and keep the IDs. Block hard delete if sessions reference the entity, or only allow it for entities with no history.

### Anti-Pattern 8: Editing a shipped Dexie schema in place

**What people do:** Add a field to `db.version(1)` after data exists.
**Why it's wrong:** Existing phones keep the old schema, and the upgrade never runs. Data becomes inconsistent.
**Do this instead:** Append `db.version(2).stores(...).upgrade(...)`. Never modify a version that has shipped.

---

## Data Flow

### Key Flows

**1. Log a session (the core loop, must take seconds):**
```
Log form ──► validateSession (domain) ──► sessions.save (data, one tx)
                                              │
                    liveQuery re-emits ◄──────┘
Sessions list, overview, and family summaries that depend on the data update.
```

**2. Capture a receipt on an expense:**
```
<input type=file accept="image/*" capture>
  ──► media/receipts.downscale (decode → canvas → JPEG ≤ ~1600px long edge)
  ──► attachments.put (one tx with expense save; Blob stored)
  ──► UI shows thumbnail via object URL (revoked on unmount)
```

**3. Family summary (text and PDF):**
```
User picks family + period (period key derived from family.period, or chosen)
  ──► read families, students, sessions in range, expenses for those sessions,
      attachment METADATA only (no Blobs)
  ──► buildFamilySummary (pure) → FamilySummary
  ──► text:  renderSummaryText → share.text (navigator.share) or copy
  ──► PDF:   load Blobs for receipts in THIS summary only
             → renderSummaryPdf → Uint8Array → File
             → share.files (navigator.share with files) or <a download> fallback
```

**4. Backup export:**
```
read transaction over ALL tables (consistent snapshot)
  ──► backup/export: backup.json (schemaVersion, records, attachment metadata)
      + attachments/<id>.jpg
  ──► zip → File → share sheet ("Save to Files") or download
  ──► meta.lastBackupAt updated
```

**5. Restore:**
```
pick zip → backup/manifest validates schemaVersion and shape (refuse unknown or newer)
  ──► user confirms "replace all data"
  ──► single rw transaction over ALL tables: clear, then bulk put
  ──► app reloads data; UI re-subscribes via liveQuery
```

**6. Offline boot:**
```
Home-screen launch ──► service worker serves precached shell (no network)
  ──► app opens Dexie (local) ──► liveQuery renders from IndexedDB
  ──► storage.persist() requested once; result shown in Settings
```

---

## Scaling Considerations

This is a single-user, single-device app. Compute is trivial. **Storage is the only real scaling axis.**

| Concern | Rough estimate (assumption, verify) | Approach |
|---------|-------------------------------------|----------|
| Session and expense records | Hundreds of bytes each; 10^4 sessions is single-digit MB | Nothing special. No indexes beyond those listed. |
| Receipt photos | Roughly 150-400 KB per receipt at 1280-1600 px JPEG q≈0.75-0.8; 1,000 receipts is in the hundreds of MB | Downscale at capture. Show `navigator.storage.estimate()` in Settings. Keep receipts out of list queries. |
| Backup size | Dominated by receipts | Zip with binary attachments (see Anti-Pattern 2). Consider incremental backup only if full backups get slow. |
| iOS storage quota | Unverified (see Confidence and Gaps) | Request persistence; surface usage; keep backups current. |

### Scaling Priorities

1. **First bottleneck: receipt storage and PDF memory.** Decoding and embedding many full-resolution JPEGs in one PDF can exhaust memory in an iPhone Safari tab. Mitigate with capture-time downscale and by building PDFs one family at a time, on demand.
2. **Second bottleneck: backup/restore memory.** Mitigated by the zip layout in Anti-Pattern 2.
3. **Not a bottleneck:** list rendering, overview aggregation, and summary math at single-user volumes.

---

## Build Order and Dependencies

### Dependency graph

```
domain core (types, credit, periods, allocate, validate)
  └── data: Dexie schema v1 (ALL tables) + repos
        ├── families + students ───────────────┐
        │     └── sessions (log/edit/delete) ──┼── overview (sessions only)
        │           ├── backup/restore ◄───────┘   (needs every table; land early)
        │           └── expenses + attachments + media pipeline
        │                 └── summary model → text → PDF + share
        └── PWA shell (SW, manifest, storage) ── independent; but gates everything on iOS
```

### Suggested phase structure (input to roadmap)

| Phase | Scope | Depends on | Why this position |
|-------|-------|------------|-------------------|
| **1. Foundation** | PWA shell + offline precache; Dexie schema v1 (all tables); families and students CRUD; domain core for credit, periods, validation; settings screen with persist/estimate | Nothing | Lock the data contract. Front-load iOS risk: home-screen install, offline cold start, persist result, IndexedDB survival after relaunch. |
| **2. Session logging** | Quick-entry form; subject, date, minutes, attendees, per-family credit; edit and delete; sessions list | 1 | Core loop. Enforces the math-is-1-on-1 and swim 1-2 rules. |
| **3. Backup and restore** | Zip export; validated, single-transaction restore; round-trip test; share-sheet check on phone | 1, 2 (should land before expenses so photos are protected from day one) | Highest data-loss risk is the single phone. Testing restore while the data set is small is cheap. |
| **4. Personal overview** | Weekly/monthly totals per student, family, and subject, including travel | 2 | Uses sessions only, so it can land before receipts. Open attribution questions must be answered first. |
| **5. Expenses and receipts** | Expense entry on a session; receipt capture and downscale; allocation with override; cascade delete | 2, attachments in 1 | Introduces the media pipeline in isolation before the PDF depends on it. |
| **6. Family summaries** | Period picker; `FamilySummary`; copy-paste text; PDF with receipts; share sheet | 2, 5 | Core value. Ship text first (low risk) and PDF second (highest iOS risk), so text is usable even if the PDF share path misbehaves. |

**Phase ordering rationale:**
- Schema and PWA foundations come first because every later phase relies on them, and iOS behavior is cheapest to discover early.
- Backup comes before receipts because receipts are the largest and most valuable data, and a backup tested on a small data set is easy to trust later.
- Summaries come last because they depend on everything. Their rules are the most important, so the domain tests should be written in phase 2 and extended, not written for the first time in phase 6.

### Research flags for roadmap

| Phase | Needs deeper research? | Why |
|-------|------------------------|-----|
| 1 | **Yes (device spike)** | iOS storage eviction and `persist()` behavior for home-screen apps is mixed in sources. Verify on the actual phone: install, go offline, relaunch, check `persisted()`. |
| 3 | Light | Pick a zip library that works in iOS Safari and check memory with a realistic number of receipts. Confirm `navigator.share({files})` for `.zip` on device. |
| 5 | **Yes (device spike)** | Camera-capture input from a home-screen web app, and HEIC or large-image decode and downscale memory on iPhone. |
| 6 | **Yes (device spike)** | `navigator.share` with a PDF file on current iOS Safari could not be confirmed from current sources. Test Messages and Mail targets. Test pdf-lib (or equivalent) embedding several receipt JPEGs in one PDF. |
| 2, 4 | No | Standard form and aggregation patterns. The open questions below need answers from the user, not research. |

---

## Open Questions and Assumptions to Confirm

These are decisions the architecture depends on. They are not researched answers. Each affects stored data, so they should be settled before phase 2 writes its schema-dependent code.

1. **Credit meaning.** This document assumes `half` means the family's lesson and activity minutes are multiplied by 0.5 for that session, and that each family's credit is independent (both can be `full`, or one `full` and one `half`). Confirm this, and whether the same factor applies to activity minutes.
2. **Travel on 2-student sessions.** Assumed to be instructor-only and not billed. For the personal overview, is travel attributed to students (credited like lesson minutes) or shown only at the session or subject level?
3. **Overview counting rule.** Does per-subject overview use raw instructor minutes (no credit, so a 2-student swim counts once), while per-student and per-family overview use credited minutes? Assumed yes. Confirm, because the alternative double-counts.
4. **Default expense split.** Equal across distinct families in the session (assumed), or proportional to credit (full = 1, half = 0.5)? The stored allocation makes either possible; only the default changes.
5. **Week start and hour format.** Assumed ISO week (Monday start) and decimal hours rounded to two decimals at display time only. Confirm which format parents expect (for example, `1.25 h` or `1 h 15 min`).
6. **Sibling case.** Two students from the same family in one session are assumed to produce one `familyCredit` entry for that family.
7. **Delete versus archive.** Assumed archive for families and students with history, and hard delete only for unused records.
8. **Sent-summary snapshots.** Not in the core requirement. If the instructor wants proof of what was sent and when, a `sentSummaries` snapshot table would be added as a new Dexie version. Decide now whether it is in scope; it is cheaper to add it in phase 6 than to retrofit later.
9. **Backup reminder.** Not in the active requirements, but storage persistence on iOS is uncertain (see Integration Points). A "last backup was N days ago" hint on the home screen would be a small addition. Confirm whether to include it.

---

## Integration Points

### Platform APIs (iOS Safari, home-screen web app)

| API | Used for | Confidence | Notes |
|-----|----------|------------|-------|
| Service Worker + Cache Storage | Offline app shell | HIGH | Standard. Test specifically in home-screen mode, not only in Safari tabs. |
| IndexedDB | All records and Blobs | HIGH for records; MEDIUM for large Blob volumes | Store Blobs directly; no need for a separate file store. Storage ceiling on iOS is unverified (see below). |
| `navigator.storage.persist()` / `persisted()` / `estimate()` | Request eviction exemption; show usage | MEDIUM | Sources say home-screen web apps have their own usage counter, separate from Safari's 7-day rule, and that `persist()` is granted by heuristic, so it is not guaranteed. A WebKit bug (232302) reports a home-screen app losing service worker, cache, and IndexedDB data after a week of non-use on iOS 15 (closed WONTFIX). Treat backups as the real safety net. |
| Web Share with files (`navigator.canShare({files})`) | Send PDF and zip via the share sheet | LOW for PDF; MEDIUM for zip | Web Share Level 2 with files was usable by default from iOS 15 per WebKit bug reports. No current source confirmed PDF sharing from Safari or home-screen apps. Device test required; fallback is `<a download>` plus "Save to Files". |
| `<input type="file" accept="image/*" capture="environment">` | Receipt photos | MEDIUM | Verify camera launch and returned format from the home-screen app on the phone. Re-encode to JPEG on capture regardless of input format. |
| Web App Manifest + `apple-touch-icon` | Home-screen install and icon | HIGH | iOS does not offer an install prompt. Installation is manual: Share, then Add to Home Screen. Provide a 180x180 `apple-touch-icon` link. |

### External services

None. No backend, no accounts, no sync (per PROJECT.md constraints).

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ domain | Direct function calls; pure inputs and outputs | Domain never reads storage. UI passes data in. |
| UI ↔ data | Repo functions for writes; `liveQuery` for reads | No component touches Dexie directly. |
| domain ↔ output | Output takes `FamilySummary` and returns strings or bytes | Output does not compute totals. |
| data ↔ backup | Backup reads and writes through the same table handles | Backup must list every table; a test asserts that the export key set equals the schema table set. |
| PWA shell ↔ app | Update event from SW registration to a UI prompt | Never reload silently mid-form. |

---

## Gaps and Items Needing Phase-Specific Research

- **iOS storage ceiling and eviction for home-screen apps.** Sources are mixed and partly dated. The phase-1 device spike should record real `estimate()` values and `persisted()` results over several days.
- **PDF share sheet on iOS.** Unconfirmed for current iOS (see Integration Points). Phase-6 device spike.
- **PDF library choice and memory.** Candidate libraries include pdf-lib and jsPDF. Choice belongs to STACK.md, but embedding many JPEGs on an iPhone needs a measured spike in phase 6.
- **Schema choices depend on the credit semantics confirmed in open question 1.** The data model above assumes the per-family `familyCredit` design.

---

## Sources

Sources consulted during this research (search results, not full reads, unless noted). Confidence for items marked MEDIUM or LOW reflects that gap.

- Apple Developer Forums, "Safari iOS PWA Data Persistence Beyond 7 Days": https://developer.apple.com/forums/thread/710157 (community discussion; MEDIUM)
- WebKit Bugzilla, "Service worker and storage deleted after 7 days on Web application added to Home Screen" (RESOLVED WONTFIX): https://bugs.webkit.org/show_bug.cgi?id=232302 (MEDIUM; iOS 15-era report)
- WebKit, "Updates to Storage Policy": https://webkit.org/?p=14403 (vendor statement on home-screen app counters and persistence; MEDIUM)
- MDN/W3C storage quotas and eviction criteria: https://docs.w3cub.com/dom/storage_api/storage_quotas_and_eviction_criteria (reference mirror; MEDIUM)
- web.dev, "Integrate with the OS sharing UI with the Web Share API": https://web.dev/articles/web-share (vendor docs; HIGH for API shape, LOW for Safari PDF behavior)
- WebKit Bugzilla 198606 and 231995 (Web Share file support history; dated; LOW-MEDIUM)
- IndexedDB storage limits and Blob behavior on iOS: search results only (rxdb.info and PouchDB FAQ mentions; unverified claims of a 500 MB cap in older iOS betas, which should not be relied on; LOW)

Architecture patterns (pure domain core, one model with two renderers, lazy attachment storage, single-transaction cascades, versioned Dexie schema, app-shell precache with update prompt) are from general offline-first and local-first practice and were not sourced from a single document. Confidence HIGH for the patterns; library-specific behavior (for example, `liveQuery`, Blob storage in Dexie) should be verified in STACK.md.

---
*Architecture research for: offline-first iPhone PWA lesson/hours logger*
*Researched: 2026-10-18*
