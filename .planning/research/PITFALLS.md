# Pitfalls Research

**Domain:** Offline-first iPhone home-screen PWA on static hosting; single-user personal logging of tutoring/swim sessions, receipt photos, per-family hour summaries as text and PDF, shared via iOS share sheet, with manual backup/restore
**Researched:** 2026-10-18
**Overall confidence:** MEDIUM

**Confidence key used below:**
- **[MEDIUM]** Cross-checked across two or more sources (WebKit storage policy, MDN, WebKit bug reports, Apple Developer Forums). Still verify on the target iPhone.
- **[LOW]** Single or anecdotal developer report, or a claim the search did not confirm. Treat as a hypothesis to test on a real device in home-screen mode.
- **[REASONED]** Follows from arithmetic, date semantics, or the project's own requirements. Not from an external source, but still a real risk.

Tiers follow the `classify-confidence` seam. No web source reached HIGH in this run, so the platform-specific claims are capped at MEDIUM.

**Phase names** below are suggested topics, because the roadmap does not exist yet: **A** foundation (data model, storage, PWA shell, service worker versioning), **B** students/families and session credit rules, **C** expense and photo capture, **D** summaries (text, PDF, share), **E** overview reporting, **F** backup/restore and hardening.

---

## Critical Pitfalls

### Pitfall 1: The phone is the only copy, and browser storage is best-effort

**What goes wrong:**
Every session, expense, and receipt photo lives in IndexedDB on one phone. Browser storage is not guaranteed to survive. Under WebKit's policy, every origin defaults to best-effort storage. Data can be evicted when the overall quota is exceeded, under system storage pressure, or after a period of user inactivity under Intelligent Tracking Prevention. Eviction is least-recently-used per origin. [MEDIUM]

`navigator.storage.persist()` can be requested, but WebKit grants it using heuristics, and the policy post cites being opened as a Home Screen Web App as one such signal. Nothing in the policy guarantees a grant. [MEDIUM]

Safari 13.1 introduced a 7-day deletion rule for script-writable storage. Apple later said home-screen web apps have their own days-of-use counter, which resets with use. Whether `persist()` overrides that counter is not documented. [LOW]

**Why it happens:**
Developers treat IndexedDB as a durable database. The app works perfectly during development, so the eviction path is never exercised.

**Consequences:**
Months of logged hours and receipts disappear. The instructor can no longer prove what was billed to which family. This is the failure the project most needs to avoid, because the summaries are the core value.

**How to avoid:**
- Call `navigator.storage.persist()` on every launch. Read back `navigator.storage.persisted()` and show the result in Settings. Do not assume the grant.
- Show `navigator.storage.estimate()` usage in Settings so growth is visible.
- Build backup/export in phase F, but design its data shape in phase A. Treat backup as the real durability mechanism, not a footnote.
- Add a "last backup was N days ago" reminder that appears in the main UI, not buried in Settings.
- Only show a save as successful after the IndexedDB transaction's `oncomplete` fires, not when the write call returns.

**Warning signs:**
- `persisted()` returns false on the device.
- Last-backup timestamp is more than a few weeks old.
- The instructor reports a family or session "missing" after time away.

**Phase to address:** A (persist call and storage layer), F (backup reminder and restore).

---

### Pitfall 2: Safari and the home-screen app are separate storage, and the origin is shared with other GitHub Pages projects

**What goes wrong:**
A home-screen web app is not part of Safari. It has its own storage and its own days-of-use counter. [MEDIUM] Two consequences follow:

1. The instructor opens the Pages URL in Safari to test, logs a session there, then opens the home-screen icon and sees nothing. Or the reverse: data entered in the home-screen app is not visible in Safari.
2. The storage origin is scheme + host + port. A project site at `username.github.io/<repo>` shares its origin with every other project site under `username.github.io`. A second project using the same database name would read and overwrite this app's data. [REASONED from origin rules]

Changing the hostname or adding a custom domain later also moves the origin. The app then starts empty while the old data sits under the old origin. [REASONED]

**Why it happens:**
Developers assume "the same URL means the same data," which holds in a single browser but not across Safari and an installed home-screen app.

**Consequences:**
Apparent data loss, a second empty copy of the app, or silent collisions with another project on the same origin.

**How to avoid:**
- Pick one canonical entry point: the home-screen app. Detect standalone mode with `window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone`. When the app runs in a Safari tab, show a banner that says the data there is separate.
- Use a distinctive IndexedDB database name (for example `lesson-log-v1`), not a generic one.
- Decide on a custom domain before the first real data is entered, or accept that the origin is fixed to `username.github.io`.
- Treat the backup file as the migration path between Safari and the home-screen app. Restore must work across contexts (see Pitfall 4).
- Keep test fixtures and dev data on a separate origin, such as `localhost` or a second Pages project with a different name.

**Warning signs:**
- A user says "the app is empty" right after adding it to the home screen.
- Data appears that does not belong to this app (another project's database name).
- Data disappears after a domain or path change.

**Phase to address:** A (origin and database naming, standalone detection), F (cross-context restore).

---

### Pitfall 3: Backup and restore that can destroy data or silently corrupt it

**What goes wrong:**
Restore is the moment the app is most likely to lose everything. Common failures:
- Restore clears the existing store, then fails partway through a large import. The user ends with neither the old data nor the new.
- Restore merges two backups that use auto-increment IDs, so records collide or are overwritten.
- A backup made under schema v1 is restored into a v3 app without running migrations.
- Export via `<a download>` silently fails in the home-screen app. [LOW: WebKit reports say the download attribute fails silently in installed apps, and some reports say it is still broken on iOS 17.x]
- Exporting base64-encoded photos inside one JSON document inflates the file by about a third and forces the whole thing through memory at once, which can crash Safari. [REASONED]

**Why it happens:**
Backup is treated as a feature to build last. Its failure modes only show up after months of data, when nothing is being tested.

**Consequences:**
A user who needs the backup most gets a corrupt file or a half-restored app. The app has no other copy of the data to fall back on.

**How to avoid:**
- Use UUIDs for all primary keys from day one. Auto-increment IDs make merge impossible across the Safari-to-home-screen move.
- Put `schemaVersion` in every backup and run the same migrations on restore that the live app uses.
- Validate the entire file before deleting anything: parse, check the schema version, check record counts and a checksum, and confirm every photo referenced by an expense exists in the file.
- Restore in one IndexedDB transaction so it is all-or-nothing. Before a restore replaces data, automatically export a snapshot of the current data.
- For export, prefer `navigator.share({ files: [file] })` so the iOS sheet can "Save to Files." Fall back to a download link only if share is unavailable. Test both in home-screen mode on a device.
- Decide on a container format. A zip of `data.json` plus binary photo files avoids the base64 overhead. A small zip library is an acceptable cost. [REASONED]
- Store photos in their already-compressed form in the backup. Do not recompress on export.
- Round-trip test: export, clear, import, then compare counts, normalized record hashes, and photo byte hashes.

**Warning signs:**
- Restore reports success but record counts differ from the backup manifest.
- Export takes more than a few seconds with a few hundred photos, or the tab reloads during export.
- A backup file made months ago fails to import.

**Phase to address:** A (UUIDs and schemaVersion in the data model), F (export, validated restore, round-trip test).

---

### Pitfall 4: Half/full credit does not reconcile, and the model cannot say why

**What goes wrong:**
A two-student swim session with 60 lesson minutes is logged. Family A is credited full, Family B half. Family A is credited 60 minutes and Family B 30, so the family totals sum to 90 while the instructor spent 60 minutes. The personal overview (actual time) and the family summaries (credited time) then disagree, and a parent or the instructor notices.

The project also leaves open:
- Whether "half" applies to lesson minutes only, or also to activity minutes.
- Whether travel is ever credited. (It is out of family summaries, so the answer is no for family summaries.)
- Whether expense splits follow the same full/half ratio. (Covered in Pitfall 5.)

**Why it happens:**
The credit is modeled as a per-family multiplier applied to a session total, with no clear rule for what the family totals should sum to. Developers pick one reading silently and build on it.

**Consequences:**
Totals on the overview and summaries disagree. Parents may be billed for time that did not happen, or the instructor under-reports. Either way the "correct" summary requirement fails.

**How to avoid:**
- **Ask the user before coding phase B.** Two readings are possible:
  - (a) "Half" is a 50% share, so family credited minutes sum to the session's actual minutes.
  - (b) "Half" is a billed credit, so family totals can sum to more than the session's actual minutes.

  The answer changes the overview totals and the summary totals. Record the decision in PROJECT.md Key Decisions.
- Store raw session minutes once, as the source of truth. Store the per-student, per-session credit mode (full or half) as a separate participant record. Derive family credited minutes at read time. Never store derived credited minutes as truth.
- Validate in the UI and the data layer: the half option appears only for swim sessions with two students. Math is always 1-on-1 and always full.
- Add an invariant test per session, asserting the chosen reconciliation rule.

**Warning signs:**
- The overview's total hours differ from the sum of the session list.
- The family summary shows a family with more hours than its share of the session.

**Phase to address:** B (data model and rule), D and E (tests that check summary and overview totals against the rule).

---

### Pitfall 5: Rounding and money math drift (minutes, half-minutes, expense splits)

**What goes wrong:**
- **Floating-point money.** `parseFloat("19.99") * 100` is `1998.9999999999998`. Summing floats in dollars produces off-by-a-cent totals, which parents notice immediately.
- **Half-minutes.** A 45-minute session credited half is 22.5 minutes. If each family's credit is rounded separately and then summed, the total differs from the rounded total.
- **Hour formatting.** If text and PDF each format hours with their own rounding, one can show 1.33 and the other 1.34 for the same total.
- **Expense splits.** Splitting $10.00 across three families with `10/3` gives $3.33 three times, which totals $9.99. A two-to-one credit split of $10.00 (1000 cents) gives 666.67 and 333.33 cents, which are not whole cents, so the allocation rule must be explicit.
- **Decimal entry.** Locales that use a comma as the decimal separator, and `type="number"` input behavior on iOS, can produce unexpected values if the string is parsed as a float.

**Why it happens:**
Money and time look simple, and rounding only bites when totals are compared across views.

**Consequences:**
A one-cent or one-tenth-hour mismatch between the text summary, the PDF, and the overview destroys trust in the entire app. A family may dispute a total.

**How to avoid:**
- Store minutes as integers and money as integer cents. Never store dollars as floats.
- Parse decimal input from the string into cents without going through float multiplication. Round once at the boundary.
- Compute period totals in integer minutes or cents. Convert to hours only at display, through one shared formatter used by the text summary, the PDF, and the overview.
- For expense splits, use the largest-remainder method. $10.00 across three families gives 334, 333, 333 cents, with ties broken by a stable key such as family ID. The shares sum exactly to the total.
- Decide the expense split basis before coding phase C: equal across participating families, or proportional to credit. Proportional splits need the largest-remainder method even more.
- Decide the half-minute rule once (floor, or round half up) and apply it in one function.

**Warning signs:**
- A total displays differently in the text summary and the PDF.
- A split's shares do not sum to the expense amount.
- A total ends in an unexpected cent value after an edit.

**Phase to address:** B (minute and half-minute rule), C (cent storage and split allocation), D (single formatter for text and PDF).

---

### Pitfall 6: Date and week boundaries and time zones

**What goes wrong:**
- **Date-only strings parse as UTC.** `new Date("2026-10-05")` is UTC midnight. In a US time zone that is the previous evening, so a Monday session appears on Sunday and falls into the wrong week.
- **`toISOString().slice(0, 10)` for the "today" default.** A session logged at 9pm Sunday in New York becomes Monday in UTC. The default date is wrong, and the session lands in the next week.
- **Week definition.** Monday or Sunday start is a choice, and the app must pick one explicitly. Grouping by ISO week number breaks at the year boundary: Dec 29 to Jan 3 can belong to a different ISO week-year than the calendar year suggests.
- **Monthly versus weekly boundaries.** A session on Sep 30 belongs to September for a monthly family and to a week starting Sep 28 for a weekly family. Families on different periods will see the same session in different buckets, which is correct, but only if the bucketing is deliberate.
- **DST.** Durations computed from start and end timestamps give 23- or 25-hour days on DST changeover days. The app should not compute durations from clock times at all, because it logs minutes.

**Why it happens:**
Developers test in one time zone during the day, when the bugs do not appear.

**Consequences:**
Sessions move between weeks or months, so the summary for a period is wrong. The error is silent and only noticed when a parent disputes a number.

**How to avoid:**
- Represent session dates as local calendar dates (`YYYY-MM-DD` strings or year/month/day fields). Never store a session's logical date as a UTC timestamp.
- Use one local-date formatter for the "today" default and for all bucketing. Ban `toISOString().slice(0, 10)` for dates in code review.
- Store `createdAt` and `updatedAt` as timestamps, but never use them for bucketing.
- Pick the week start (Monday or Sunday) and record it in PROJECT.md. Bucket weeks by week-start date key, not ISO week number.
- Test with fixed fake clocks, running the test suite under several `TZ` values (for example `America/Los_Angeles`, `America/New_York`, `Pacific/Auckland`, `UTC`). Include a case logged at 23:30 on a Sunday.

**Warning signs:**
- A session logged on the evening of a Monday appears under Sunday.
- The weekly total changes when the phone's time zone is changed.
- Tests pass locally and fail in CI or on a machine in a different zone.

**Phase to address:** A (date type decision), B (session date entry), D and E (period bucketing tests across time zones).

---

## Moderate Pitfalls

### Pitfall 7: The home-screen app keeps running an old service worker

**What goes wrong:**
An installed home-screen app did not pick up deployed updates, even after it was killed from the app switcher. The only fix reported was a device restart. [LOW: Ionic forum report]

WebKit has said it removes unused service worker registrations and caches after a few weeks, and that web apps must tolerate individual caches or entries being missing. [LOW: search summary of WebKit guidance, no date verified] Developer reports describe a home-screen app losing its service worker and cache after roughly a week of non-use, closed as WONTFIX. [LOW]

**Why it happens:**
Developers test in a Safari tab, where reloads fetch fresh code. The standalone app behaves differently.

**Consequences:**
- An old app runs against a newer IndexedDB schema, or the reverse. Summaries break in a way that looks like a data bug.
- A cache eviction leaves the app with no shell while offline. For an offline-first app this is the core failure.

**How to avoid:**
- Version the cache name per build. Activate the new service worker with `skipWaiting` and `clients.claim`, then show an "Update available, reload" banner the user can act on.
- Call `registration.update()` when the app comes to the foreground (`visibilitychange`), not only on load.
- Keep the app shell small and make the service worker fall back to the network when a cache entry is missing and the device is online. If offline and the shell is gone, show a clear message rather than a blank screen.
- Show the build version in Settings, so the instructor can see which version is running.
- Test the update path on the device: deploy a visible marker, confirm the home-screen app shows it after the documented action, without deleting the app.
- Before any reinstall or re-add of the home-screen icon, export a backup. Do not assume reinstalling is data-neutral.

**Warning signs:**
- The version shown in Settings does not match the latest deploy.
- The app is blank in airplane mode after weeks without opening it online.

**Phase to address:** A (service worker versioning and update flow), F (release checklist).

---

### Pitfall 8: Photo capture, decode memory, orientation, and HEIC

**What goes wrong:**
- **Canvas memory.** Reported total canvas memory budgets are 224 MB on older iOS and 384 MB on iOS 15 and lower, and Safari logs a warning when the budget is exceeded. [LOW: developer reports] A 12-megapixel iPhone photo (about 4032×3024) decodes to roughly 49 MB of RGBA. Two or three held in canvases at once can exceed the budget. Safari also caps canvases at 16,777,216 pixels. [LOW]
- **Orientation.** iPhone photos carry an EXIF orientation tag. A canvas pipeline that ignores or inconsistently applies it produces sideways receipts in the PDF. [REASONED; verify on device]
- **HEIC renaming.** When the `accept` attribute includes `image/heic`, Safari 17+ reported renaming JPEG and PNG uploads to `.heic`. [MEDIUM: Apple Developer Forums thread and WebKit bug 303803, Dec 2025] Restricted type lists can cause HEIC to be transcoded to the first listed type. [LOW: WebKit bug 292350]
- **Picker defaults.** The iOS photo picker can default to converting photos. Users may need to switch the format to "Current" to get originals. [LOW]

**Why it happens:**
Developers test with a desktop JPEG, and the canvas pipeline works fine for one image.

**Consequences:**
A tab reload partway through the receipts for a family, sideways receipts, or files silently renamed.

**How to avoid:**
- Use `accept="image/*"`. Do not list `image/heic`.
- Process images one at a time: decode, downscale, encode, store, then release the canvas (set width and height to 0) and drop references.
- Downscale to a target long edge (around 1600 to 2000 px, JPEG quality around 0.7 to 0.8, to be confirmed by checking that receipt text stays legible). This also keeps the PDF small.
- Verify orientation with a real portrait and landscape photo on the target iOS version. Apply orientation explicitly if the decode path does not.
- Test `capture` before relying on it. Confirm it does not remove the option to pick from the library, since receipts often sit in Photos or Files. [unverified]
- Test HEIC from the library on the target iOS version. Use a HEIC decode fallback only if the native path fails.

**Warning signs:**
- The page reloads after several receipts are added.
- Receipts appear sideways in the PDF.
- Exported photos have a `.heic` extension they should not have.

**Phase to address:** C (capture pipeline), D (PDF uses already-processed images).

---

### Pitfall 9: Photo bloat and quota errors

**What goes wrong:**
iOS 17 and later raised the per-origin quota substantially: up to 60% of disk for browser apps, and home-screen apps get the same limits as browser apps. [MEDIUM: WebKit policy and MDN] Before iOS 17, the origin limit was about 1 GB, and writes beyond it fail in home-screen apps. [MEDIUM: WebKit and MDN, as cited by search]

Raw iPhone photos run several megabytes each. [REASONED] A few hundred uncompressed receipts can approach 1 GB, which is a real risk on older iOS and a sign of waste on newer iOS.

**Why it happens:**
Developers store whatever the input produces. Quota is treated as someone else's problem until a write fails.

**Consequences:**
A write fails halfway through saving an expense. Without atomic writes, the app stores the session but not the receipt, or the receipt without its expense.

**How to avoid:**
- Compress at capture (Pitfall 8), so receipts are small by design.
- Store photos as binary `Blob` or `ArrayBuffer` values in IndexedDB, not base64 strings inside the record. [REASONED]
- Save the session, the expense, and its photo in one transaction. A `QuotaExceededError` aborts all three, leaving no orphan.
- Surface quota errors to the user in plain language, with a next step (back up, then delete old photos).
- Check for orphans in an integrity pass: photos not referenced by any expense, and expenses pointing to a missing photo. Run it on restore and offer it in Settings.
- Delete an expense's photo when the expense is deleted, or record it as an orphan to clean up.

**Warning signs:**
- `estimate()` usage grows faster than expected.
- Orphan count is greater than zero.
- Saving an expense shows a spinner that never resolves.

**Phase to address:** A (blob storage and transaction design), C (capture and atomic save), F (integrity check).

---

### Pitfall 10: Web Share with files and client-side PDF generation

**What goes wrong:**
- **User activation.** `navigator.share()` must run inside a user gesture. If the PDF takes several seconds to generate after the tap, the share call can be rejected. [REASONED; verify on device]
- **Support check.** `navigator.canShare({ files: [pdf] })` must be checked before showing the button. Web Share is supported in Safari since 12.1, but file-sharing support is narrower and the PDF case is not confirmed for Safari. [LOW: web.dev and MDN, not Safari-specific]
- **Memory.** Generating a PDF with full-resolution images holds the image bytes, the document buffer, and any base64 copies in memory at once. Safari can crash or reload the page, and in a home-screen app that looks like a blank screen. [REASONED]
- **Size.** A PDF with many receipts can be too large to send by Messages. The size limit should be tested, not assumed. [unverified]

**Why it happens:**
The share flow is built on a desktop mental model, where share is a function you can call at any time.

**Consequences:**
The share button does nothing, the page crashes on a family with many receipts, or the PDF fails to send.

**How to avoid:**
- Generate the PDF when the summary screen opens, or on an explicit "prepare" tap. Enable the "Share PDF" button only once the Blob is ready. Call `navigator.share()` directly inside the click handler, with the pre-built file.
- Check `canShare` before showing the button. Fall back to sharing the text summary, plus "Save to Files" through the export path.
- Embed already-compressed JPEG bytes directly into the PDF rather than decoding and re-encoding. Libraries such as pdf-lib accept JPEG bytes directly. [REASONED]
- Set a PDF size budget and warn when a summary exceeds it. Test with a family that has 30 or more receipts in a monthly period.
- Test the actual share to Messages on the oldest iOS version you intend to support, on a real device, in home-screen mode.

**Warning signs:**
- The share sheet does not appear, or appears only on the second tap.
- The page reloads when a summary with many receipts is generated.
- Generated PDFs are much larger than the sum of their receipt images.

**Phase to address:** D (summary and share flow), C (already-compressed inputs).

---

## Domain Risks and Product Decisions

These are not technical traps. They change what the app should compute and need a decision before coding.

### Summary changes after it was sent

**What goes wrong:** A summary is texted to a parent on Monday. On Tuesday the instructor edits a session in that week. The summary regenerated later no longer matches what the parent received.

**How to avoid:** Stamp each generated summary with the period and a generated-at time. Consider freezing a copy of what was sent, or show a "changed since sent" indicator. Decide which behavior the user wants.

**Phase to address:** D and E.

### Deleting students, families, or sessions with history

**What goes wrong:** Deleting a family cascades to its sessions and expenses, or leaves orphaned records that break totals.

**How to avoid:** Block deletion of a family with sessions, or use soft delete with an undo. Keep the integrity check from Pitfall 9 running.

**Phase to address:** B (referential rules), F (integrity check).

### Validation of nonsensical entries

**What goes wrong:** Negative minutes, a 900-minute session, or a session with zero lesson, zero activity, and zero travel. Each silently inflates or corrupts totals.

**How to avoid:** Validate minute ranges and require at least one non-zero component. Decide whether an activity-only session is allowed (it is, by the project's own description of activities that happen before or after lessons).

**Phase to address:** B.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store photos as base64 in the record JSON | Simpler code, one JSON export | 33% size overhead, memory spikes on export and restore, crashes with many photos | Never for receipts; acceptable only for a tiny prototype |
| Auto-increment IDs | Easy to write | Backups from two contexts cannot merge; restore collides | Never |
| Store dollars as floats | Quick to implement | Off-by-a-cent totals that parents notice | Never |
| Compute family totals only at read time without a stored rule | Less data to migrate | Silent change when the rule is changed | Acceptable if the rule is documented and tested |
| Skip `schemaVersion` in backups | Less work up front | Old backups cannot be restored after any schema change | Never |
| Call `persist()` once on first run only | Less code | Grant can be lost or never granted; no visibility | Never; call on every launch and surface the result |
| Generate PDF after the share tap | Simpler flow | Share rejected or slow; crash on large summaries | Never |
| Single global `navigator.share` try/catch with no fallback | Less UI | Users with unsupported share get nothing | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Web Share (files) to Messages | Calling share after async work, or assuming PDF support | Prepare the Blob first, call share in the click handler, check `canShare`, test on device |
| File input to Photos | Listing `image/heic` in `accept` | Use `image/*`, test HEIC from the library, verify no renames |
| GitHub Pages hosting | Assuming a project site has its own storage origin | Origin is `username.github.io` for all project sites; use a unique DB name and decide on a custom domain early |
| Service worker and build output | Precaching a hand-written file list that misses hashed build assets | Generate the precache list from the build; verify airplane-mode load after every deploy |
| Third-party libraries from a CDN (PDF, fonts) | Loading from a CDN at runtime breaks offline | Bundle libraries and fonts so they are precached |
| Blob download to Files | Relying on `<a download>` in the home-screen app | Prefer `navigator.share` with a file; test download fallback in standalone mode |
| `navigator.storage` | Treating `persist()` as a guarantee | Read `persisted()` and show it; never assume |
| Clipboard for the text summary | Calling `writeText` outside a gesture | Call it from the tap handler, with a visible confirmation |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full-resolution photos into lists | Scroll jank, memory growth, reload | Store thumbnails separately; load on demand | Dozens of receipts visible at once |
| `URL.createObjectURL` without `revokeObjectURL` | Memory climbs during long home-screen sessions | Revoke when the view unmounts | Long sessions with many photo views |
| Recomputing overview totals over all sessions on each render | Slow screen transitions | Index by family and period key; compute on change | Thousands of sessions (well beyond the expected volume) |
| Writing the whole database on every keystroke | Typing lag, battery drain | Debounce writes; write per saved record | Long edit sessions |
| Exporting by serializing everything in memory | Tab reload on export | Stream or zip per photo | Several hundred photos |
| Generating PDF from full-resolution originals | Crash on the summary screen | Use compressed images from capture | Families with many receipts in one period |

---

## Security and Privacy Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Real student or family data in the repo, fixtures, or screenshots of the public Pages site | Children's names and contact details exposed | Keep demo data synthetic; keep real data only on the phone and in backups |
| Backup file shared through Messages or email without a warning | Children's names, receipts, and family details leave the device | Warn at export; keep the file unencrypted only if the user accepts that. Encryption is a later decision |
| Third-party scripts (analytics, CDN fonts) in the app | Leakage of usage data, and offline breakage | No analytics; bundle assets |
| Shared origin with another project on `username.github.io` | Another app can read or overwrite data | Unique DB name (Pitfall 2) |
| PDF and text summaries stored in Cache Storage | Old summaries persist on device with family data | Keep generated summaries in memory or as ephemeral Blobs; do not cache them |

Risk level: medium overall. The data never leaves the phone except through the user's deliberate share action, so the main risk is the backup file and the shared origin.

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Too many required fields in session entry | Logging takes minutes, so it is skipped | Default date to today, default subject and student to the last used, make travel and activity optional |
| Silent save failure | Instructor believes a session is saved when it is not | Show an explicit saved confirmation after the transaction completes |
| Opening in Safari with no warning | Data appears missing | Banner in Safari: "Use the home-screen app" |
| Summary text without the period label | Parent reads a total with no date range | Always include period start and end in the text |
| Receipts shown in the PDF with no description | Parent cannot match a receipt to an expense | Print amount and description next to each receipt image |
| Hours shown as decimals only | Confusion, for example 1.5 read as 1 hour 5 minutes | Pick one format (decimal hours or h:mm) and use it everywhere, or show both in the text |
| No visible backup status | Instructor forgets to back up until it is too late | Last-backup date visible on the home screen |

---

## "Looks Done But Isn't" Checklist

- [ ] **Offline:** Often missing a precached asset. Verify: after a fresh deploy and after a restart, enable airplane mode in the home-screen app and open every screen, including receipt photos and PDF generation.
- [ ] **Persistence:** `persist()` is called, but the result is not checked. Verify: `persisted()` shows true in Settings on the device home-screen app, not only in Safari.
- [ ] **Backup:** Export works, but restore was never tried. Verify: export on one device, restore into a clean install, compare record counts and photo hashes.
- [ ] **Restore safety:** Restore clears data first. Verify: force a failure midway through a restore (for example, a truncated file) and confirm the previous data is intact.
- [ ] **Share:** The button appears in Safari but not in the home-screen app. Verify: send a PDF with two receipts to Messages from the home-screen app on the device.
- [ ] **Orientation and legibility:** Receipts look right on the phone but sideways in the PDF. Verify: portrait and landscape receipt photos in the generated PDF.
- [ ] **Dates:** The week total is right on a weekday and wrong late on Sunday. Verify: sessions logged at 23:30 Sunday in three time zones land in the correct week.
- [ ] **Credit rule:** Two-student half/full sessions do not reconcile. Verify: the invariant test passes for every combination of full and half.
- [ ] **Money:** The text total and the PDF total differ by a cent. Verify: a three-way split of an odd amount sums exactly to the total in both outputs.
- [ ] **Update:** The app still shows the old build after a deploy. Verify: deploy a marker change and confirm the home-screen app updates through the documented action.
- [ ] **Quota:** A forced write failure leaves a partial expense. Verify: a forced quota error leaves no session, expense, or photo behind.
- [ ] **Edited after sent:** The regenerated summary silently differs from the text already sent. Verify: a changed-since-sent indicator or a frozen copy exists.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Data evicted or lost | HIGH without a backup; LOW with one | Restore the latest backup file. If none exists, the data is gone. The only mitigation is backup cadence. |
| Stale service worker | LOW | Ship a new cache version. If the app is stuck, export a backup first, then reinstall the home-screen icon. |
| Corrupt backup file | MEDIUM | Restore from the previous backup. The automatic pre-restore snapshot covers the case where the restore itself was the problem. |
| Total mismatch found | LOW | Fix the single formatter or the single rule function. Totals are derived from minutes and cents, so no stored data needs correcting. |
| Orphan photos or expenses | LOW | Run the integrity check and delete orphan blobs, after confirming them in a backup. |
| Share fails on device | LOW | Fall back to text plus Save to Files, then fix the activation or size issue. |
| Data written to the wrong origin or DB name | HIGH | Export from the old origin, which may require opening the old URL, then restore into the new one. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Best-effort storage and eviction | A, F | `persisted()` shown in Settings on device; backup reminder appears when stale |
| 2. Safari vs home-screen storage; shared origin | A | Standalone detection banner works; DB name unique; second-context test documented |
| 3. Backup and restore integrity | A (schema design), F | Round-trip test passes; failed restore leaves data intact |
| 4. Half/full credit reconciliation | B | Decision recorded in PROJECT.md; invariant test passes |
| 5. Rounding and money | B, C, D | Three-way split sums exactly; text and PDF totals match |
| 6. Date and week boundaries | A, B, D, E | Tests pass under multiple `TZ` values; Sunday 23:30 case covered |
| 7. Stale service worker | A, F | Marker deploy visible on device after the documented update action |
| 8. Photo decode, orientation, HEIC | C | Portrait and landscape receipts correct; HEIC from library works |
| 9. Photo bloat and quota | A, C, F | Forced quota error leaves no partial save; integrity check reports zero orphans |
| 10. Web Share and PDF memory | C, D | Share to Messages works from home-screen app; large summary does not crash |
| Summary changed after sent | D, E | Changed-since-sent indicator or frozen copy |
| Deleting families with history | B, F | Deletion blocked or soft-deleted; integrity check passes |

---

## Open Questions to Resolve Before Coding

These are assumptions the research could not settle. Each one changes the data model or the summary output.

1. **Half credit:** Do family credited minutes sum to the session's actual minutes (reading a), or can they exceed it (reading b)? Does "half" apply to activity minutes as well as lesson minutes?
2. **Expense split basis:** Equal across participating families, or proportional to credit?
3. **Week start:** Monday or Sunday? Are monthly periods calendar months?
4. **Rounding:** How are half-minutes rounded? Is the display format decimal hours or h:mm?
5. **Entry point:** Will the instructor ever use the Safari tab, or only the home-screen app? This decides how much effort goes into the Safari banner and the cross-context restore.
6. **Minimum iOS version:** Affects quota behavior, Web Share support, and HEIC handling. Pick one before phase C.
7. **Backup privacy:** Is the backup file allowed to leave the phone through Messages or Mail, given that it contains children's names?

---

## Sources

- WebKit, "Updates to Storage Policy" (storage defaults, persistence heuristics, quotas for iOS 17, eviction triggers): https://webkit.org/blog/14403/updates-to-storage-policy/ (fetched; the 7-day rule is not described in this post)
- MDN, "Storage quotas and eviction criteria" (corroborates the 60%/15% quota split): https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Apple Developer Forums, "Safari iOS PWA Data Persistence Beyond 7 Days": https://developer.apple.com/forums/thread/710157
- WebKit Bugzilla 211775 (7-day rule and home-screen apps): https://bugs.webkit.org/show_bug.cgi?id=211775
- WebKit Bugzilla 190269 (service worker cache not shared with home-screen app): https://bugs.webkit.org/show_bug.cgi?id=190269
- Ionic forum, "Angular Service Workers not work on standalone iOS" (stale updates in standalone mode): https://forum.ionicframework.com/t/ionic-v4-pwa-angular-service-workers-not-work-on-standalone-ios/161051
- Apple Developer Forums, "Total canvas memory use exceeds the maximum limit (224 MB)": https://developer.apple.com/forums/thread/112218
- pqina, "Total Canvas Memory Use Exceeds The Maximum Limit": https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/
- pqina, "Canvas Area Exceeds The Maximum Limit": https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/
- Apple Developer Forums, "Safari 17+: Image file got automatically converted to HEIC extension": https://developer.apple.com/forums/thread/743049
- WebKit Bugzilla 303803 (accept list renaming to HEIC, Dec 2025): https://bugs.webkit.org/show_bug.cgi?id=303803
- WebKit Bugzilla 267277 (HEIC transcoding alignment with macOS): https://bugs.webkit.org/show_bug.cgi?id=267277
- WebKit Bugzilla 292350 (restricted accept lists transcode HEIC): https://bugs.webkit.org/show_bug.cgi?id=292350
- Apple Developer Forums, "How to influence 'Automatic' format selection of photos in iOS Safari photo picker?": https://developer.apple.com/forums/thread/743037
- Apple Developer Forums, "Impossible to download a file on PWA": https://developer.apple.com/forums/thread/95911
- Apple Developer Forums, "How to download locally generated text in a PWA?": https://developer.apple.com/forums/thread/119017
- web.dev, "Share files" (canShare pattern, HTTPS requirement): https://web.dev/articles/files/share-files
- MDN, "Navigator: share() method": https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- heic-normalize (HEIC fallback option, not verified in use): https://libraries.io/npm/heic-normalize
- Date and week semantics, floating-point money, largest-remainder allocation, and DST behavior: engineering reasoning, not externally sourced ([REASONED] tags above).

---
*Pitfalls research for: offline-first iPhone home-screen PWA, personal session/expense logging with photo receipts, PDF/text summaries, and backup*
*Researched: 2026-10-18*
