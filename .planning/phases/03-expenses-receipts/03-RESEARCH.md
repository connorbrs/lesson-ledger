# Phase 3: Expenses & Receipts - Research

**Researched:** 2026-10-19
**Domain:** Local expense ledger and receipt photos in IndexedDB (Dexie); canvas downscale on iOS Safari; backup schemaVersion 2 with base64 photos
**Confidence:** HIGH for data model, transactions, money and split math, base64, backup validation (executed in sandbox). MEDIUM for the photo pipeline (device spike required). LOW for iOS canvas memory budgets.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** An "Expenses" section lives in the shared session form (`SessionFields`), so it appears both on the Log tab (before Save) and in the Edit Session sheet. A session and its expenses and photos save together in one transaction. Leaving the form with unsaved expenses uses the existing unsaved-changes handling.
- **D-02:** Currency is US dollars. Amounts are shown as `$12.50`. Store money as integer cents and never as floats, the same way minutes are integers. One fixed symbol, no currency setting. — **Reversibility:** costly — the cents field shape is in the `expenses` rows and the backup format.
- **D-03:** One expense = amount (required, > $0) + description (required, short text). Its date is the session's date; there is no separate expense date.
- **D-04:** Session rows in the Sessions list gain a small extra line, "Expenses $12.50" (the session's total), shown only when the session has expenses.
- **D-05:** Deleting a session that has expenses deletes everything in one transaction. The confirm alert names what goes, e.g. "This also deletes 2 expenses and 3 receipt photos." Deleting a single expense, or a single photo, also leaves no orphan `attachments` rows.
- **D-06:** Keep the single JSON backup file (D-12 from Phase 2). Receipt photos are embedded as base64 in the `attachments` slot under a NEW `schemaVersion` (2). Restore must still accept v1 files. Remove the "fails closed if expenses or attachments exist" export guard and replace it with real export. No zip and no new package. — **Reversibility:** one-way — v2 is a published backup contract that every future restore must keep reading.
- **D-07:** Carried-forward prerequisite (Phase 2 review WR-02). Restore must clear and replace `expenses` and `attachments` in the same transaction as the other tables, and it validates every photo entry (type, size, base64, references) before touching anything.

### Claude's Discretion
- **Receipt photos:** one `<input type="file" accept="image/*">` (iOS offers both Camera and Photo Library). Allow multi-select from the library. Downscale and re-encode to JPEG with Canvas (long edge about 1600 px, quality about 0.8; the researcher confirms values). Respect EXIF orientation and handle HEIC from the library. Show thumbnails in a row on the expense; tap opens the full photo; each photo can be removed. Photos are stored as Blobs in `attachments` (indexed by `expenseId`).
- **Shared split UI:** shown only for two-family swim sessions, the same rule as credit (`needsCreditGroups`). The default is equal. The override is typing one family's share, and the other family's share fills in as total − share. With an equal split of an odd number of cents, the extra cent goes to the first family in pick order. Store each family's cents explicitly so the summaries never recompute the split. The shares must sum exactly to the amount.
- Expense entry layout, empty states and copy go to the UI-SPEC (`/gsd-ui-phase 3`).

### Deferred Ideas (OUT OF SCOPE)
- Zip backup format: possible later under a new schemaVersion if backups grow too large.

### Project constraints honored
Static hosting, no backend, all data on the phone, offline after first load, $0 cost (`.claude/CLAUDE.md`, Constraints). No new package in this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXP-01 | Add one or more expenses (amount, description) to a swim or math session | `expenses` table with `sessionId` index already declared; cascade and validation (Patterns 1-2) |
| EXP-02 | Zero or more receipt photos per expense, from camera or library | `accept="image/*"` with `multiple`; `attachments` indexed by `expenseId`; pipeline (Pattern 4) |
| EXP-03 | Receipt photos downscaled and stored on the phone | `fitLongEdge` executed; JPEG 1600 px / 0.8 starting values; Blob round trip executed in Dexie |
| EXP-04 | Equal split by default; per-expense override; shares sum exactly | `equalSplit` / `overrideSplit` executed exhaustively for 0..2000 cents; stored `splits` in cents |
| EXP-05 | Edit or delete expenses and photos with no orphans | One `rw` transaction over all five tables; cascade executed against fake-indexeddb |
</phase_requirements>

## Summary

Phase 3 fills two placeholder tables that already exist. `expenses` and `attachments` are declared in `db.version(1)` with the indexes this phase needs, so **no Dexie version bump is needed**. Only the row types change, from `IdRow` to real rows. The work has four parts: (1) a staged expense and photo draft that saves with the session in one transaction; (2) a sequential canvas pipeline that downscales each photo before storage; (3) backup schemaVersion 2 carrying photos as base64, with every entry validated before any write; (4) integer-cents money with a stored per-family split.

Three things the planner must get right:

- **Blobs cannot sit in the form object that `sameForm` compares.** `JSON.stringify` turns a Blob into `{}`, so a staged photo would not make the form dirty. Compare photo ids.
- **All photo work (canvas, `toBlob`, `Blob.arrayBuffer()`) must finish before a Dexie transaction opens.** Dexie forbids other async APIs inside a transaction scope.
- **Export must never write a file above `MAX_BACKUP_BYTES`.** Restore would reject it as `not-backup`, which breaks the one-way contract in D-06.

Items only a real iPhone can settle (EXIF orientation path, what HEIC arrives as from the library, canvas memory with about 20 receipts) are tagged `[ASSUMED]` and listed as device-spike checks.

**Primary recommendation:** Add no packages. Store `amountCents` and per-family integer `splits` on `expenses`, and JPEG Blobs on `attachments`. Process photos one at a time (decode, fit, draw, `toBlob('image/jpeg', 0.8)`, release). In backup, carry photos as chunked base64 under `schemaVersion: 2`, and validate every entry in `parseBackup` before the restore transaction opens.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Amount, description, split entry and validation | Browser / Client (`src/domain`) | — | Pure functions; no storage needed |
| Photo decode, EXIF orientation, downscale, JPEG encode | Browser / Client (`src/pwa`) | — | Canvas and image decode exist only in the browser |
| Staged expenses and photos until Save | Browser / Client (UI state) | — | D-01: nothing written until the session saves |
| Atomic save, update and delete with cascade | Database (`src/data`) | — | One `rw` transaction over sessions, expenses, attachments |
| Expense total per session on Sessions rows | Domain sum over a Database read | — | Integer cents summed in domain code |
| Backup base64 encode and decode | Browser (`src/data`) | — | Export and restore share one file |
| Backup validation (type, size, base64, references) | Domain (`src/domain/backup.ts`, pure) | — | Must run before any write (D-07) |

## Standard Stack

### Core (already installed; no additions)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| dexie | 4.4.6 | IndexedDB, Blob storage, indexed deletes | Already the only Dexie importer (`src/data`) |
| fake-indexeddb | 6.2.6 | Test database | Already used via `import 'fake-indexeddb/auto'` in `tests/backup.test.ts` |
| vitest | 5.0.5 | Tests | `environment: 'node'` |
| typescript | 7.0.2 | Type check | `npm run build` runs `tsc --noEmit` |

Sources: `[VERIFIED: package.json, "dexie": "4.4.6", "fake-indexeddb": "6.2.6", "vitest": "5.0.5", "typescript": "7.0.2"]`. Installed versions matched in `node_modules` this session.

### Browser APIs (no package)
- `<input type="file" accept="image/*" multiple>`: camera and library picker. `[ASSUMED]` iOS behavior; UI-SPEC names the menu items.
- `HTMLImageElement.decode()` and `drawImage`; `HTMLCanvasElement.toBlob(cb, 'image/jpeg', 0.8)`; `Blob.arrayBuffer()`; `atob`/`btoa`; `URL.createObjectURL`. All `[ASSUMED]` for iOS behavior; base64 and math verified in Node.
- `createImageBitmap(file, { imageOrientation: 'from-image' })`: alternative decode path, see Pitfall 6.

**Alternatives considered:** fflate zip (ruled out by D-06); a HEIC WASM decoder (add only if the device spike shows native decode fails, as a new package behind the legitimacy gate); `Intl.NumberFormat` for money (matched the manual formatter on 200k samples; manual chosen so the money path needs no ICU call).

**Installation:** none.

## Package Legitimacy Audit

Not applicable. Phase 3 installs no external packages (D-06: "No zip and no new package"). The legitimacy gate was not run. If the device spike forces a HEIC decoder, that becomes a new package and the gate must run first.

## Architecture Patterns

### System flow
```
Log tab / Edit sheet
  FormState: expenses[] (ids, amountCents, splits, photoIds)          [domain, JSON-safe]
  stagedPhotos: Map<photoId, Blob>                                    [UI state, outside sameForm]
    |  pick photos -> src/pwa/photos.ts, strictly one at a time:
    |     decode -> fitLongEdge (domain) -> drawImage -> toBlob JPEG 0.8 -> release canvas
    |  Save -> validate (domain) -> reconcileSplits (domain, pure)
    v
  data/sessions.ts: ONE db.transaction('rw', students, families, sessions, expenses, attachments)
     re-check attendees -> put session -> put/delete expenses -> put/delete attachments
    v
IndexedDB: sessions | expenses(id, sessionId) | attachments(id, expenseId, blob)

Backup export: one read transaction over all tables (Blob handles) -> OUTSIDE it:
               arrayBuffer -> chunked base64 -> JSON text -> File
Restore: parseBackup (pure, every check) -> sync base64 -> Blob, still outside the transaction
         -> ONE rw transaction: clear all data tables, bulkAdd, lastBackupAt
```

### Pattern 1: Data model (no version bump)
- Keep `db.version(1).stores({...})` unchanged. The index strings are `expenses: 'id, sessionId',` and `attachments: 'id, expenseId',` (`src/data/db.ts:28-29`, verified this session).
- Replace the placeholders `expenses: EntityTable<IdRow, 'id'>; // typed in Phase 3` and `attachments: EntityTable<IdRow, 'id'>; // typed in Phase 3` (`src/data/db.ts:17-18`) with real row types.
- Do not add `version(2)`. Dexie says `stores()` need only list indexed properties (`[CITED: https://dexie.org/docs/Version/Version.stores()]`: "NOTE: Unlike SQL, you don't need to specify all properties but only the one you wish to index."). Nothing here alters an index.

Proposed rows (`[ASSUMED]` names, design choices):
```
expenses:    { id, sessionId, description, amountCents, splits: [{ familyId, cents }], createdAt, updatedAt }
attachments: { id, expenseId, blob: Blob, mime: 'image/jpeg', bytes, width, height, createdAt }
```
- `splits` always has at least one entry. A single-family expense stores `{ familyId, cents: amountCents }`, so summaries never recompute a split (CONTEXT: "Store each family's cents explicitly").
- "Entry order" (UI-SPEC) uses `createdAt`, with `id` as tiebreak. Do not rely on Dexie insertion order.

### Pattern 2: Save, update and delete transactions
- Each transaction must list the new tables. `createSession` opens `db.transaction('rw', db.students, db.families, db.sessions, async () => {` (`src/data/sessions.ts:19`); `updateSession` opens the same scope (`src/data/sessions.ts:36`); `deleteSession` opens `db.transaction('rw', db.sessions, async () => {` (`src/data/sessions.ts:63`). Add `db.expenses, db.attachments` to each.
- Cascade on delete, executed against Dexie 4.4.6 and fake-indexeddb 6.2.6 (scratch `exp1-blob.mjs`):
```js
await db.transaction('rw', db.sessions, db.expenses, db.attachments, async () => {
  const expIds = await db.expenses.where('sessionId').equals('s1').primaryKeys();
  await db.attachments.where('expenseId').anyOf(expIds).delete();
  await db.expenses.where('sessionId').equals('s1').delete();
  await db.sessions.delete('s1');
});
// result: attachments [] and only the other session's expense remained; anyOf([]) delete is a no-op
```
- The delete alert count is read before confirm. The transaction re-reads and deletes what it finds, so the alert and the write can differ only if data changed in between.
- `updateSession`: diff stored expense ids against staged ids. Delete attachments of removed expenses and removed photo ids (`where('expenseId').anyOf(...)`), then `bulkDelete` and `put` the rest.
- **Reconcile splits at save (create and update).** If an expense's split families differ from the session's families, reset it to equal. This is the UI-SPEC open item, belonging on the save path.

### Pattern 3: Money and split (`src/domain`, pure)
Executed: 12 valid and 12 invalid inputs (plus `1.005` separately), 200k random formatting samples, exhaustive splits for 0..2000 cents. All passed (scratch `exp2-money.mjs`).
```js
const AMOUNT_RE = /^(\d*)(?:\.(\d{0,2})?)?$/;
export function parseAmountToCents(raw) {            // "6.25" "$6" "6." ".5" -> cents; null when invalid
  if (typeof raw !== 'string') return null;
  let t = raw.trim();
  if (t.startsWith('$')) t = t.slice(1);
  const m = AMOUNT_RE.exec(t);
  if (!m || (m[1] === '' && (m[2] ?? '') === '')) return null;   // "", ".", "$" rejected
  const total = Number(m[1] || '0') * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(total) ? total : null;             // no float; huge input rejected
}
export function formatCents(cents) {                   // "$1,000.00"; exact, no float division
  const c = cents % 100;
  const d = (cents - c) / 100;
  return `$${String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(c).padStart(2, '0')}`;
}
export function equalSplit(total) {                    // odd cent to the first family in pick order
  const first = total - Math.floor(total / 2);
  return [first, total - first];                       // equalSplit(1001) -> [501, 500]
}
export function overrideSplit(total, aCents) {         // typed share for family A; B = total - A
  if (!Number.isSafeInteger(aCents) || aCents < 0 || aCents > total) return null;
  return [aCents, total - aCents];
}
```
- Reject `1.005`, never round it. `parseFloat` then `Math.round(x * 100)` gives 100, not 101.
- The safe-integer guard replaces UI-SPEC's "no cap": any amount a double holds exactly is accepted, and nothing is rounded silently.
- The UI-SPEC examples hold: 1250 gives "$12.50", 100000 gives "$1,000.00", 5 gives "$0.05".

### Pattern 4: Photo pipeline (`src/pwa/photos.ts`; constants and `fitLongEdge` in `src/domain/photos.ts`)
One module holds the constants, as UI-SPEC requires. Starting values come from CONTEXT ("long edge about 1600 px, quality about 0.8"). `.planning/research/PITFALLS.md:264` suggests 1600 to 2000 px and 0.7 to 0.8, to be checked for legibility on device.
```js
// Pure, executed: never upscale; guard zero and non-integer sizes
export function fitLongEdge(w, h, maxLong = 1600) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return null;
  const long = Math.max(w, h);
  if (long <= maxLong) return { w, h };
  const k = maxLong / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
// fitLongEdge(4032, 3024) -> { w: 1600, h: 1200 }; fitLongEdge(1, 10000) -> { w: 1, h: 1600 }
```
```ts
// Browser path: NOT executed. API behavior is [ASSUMED] until the device spike.
export async function prepareReceipt(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();                                   // [ASSUMED] rejects if the platform cannot decode
    const dims = fitLongEdge(img.naturalWidth, img.naturalHeight, 1600);
    if (!dims) throw new Error('unreadable');
    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, dims.w, dims.h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    canvas.width = 0;                                     // release the backing store
    canvas.height = 0;
    if (!blob) throw new Error('encode');                 // toBlob can return null
    return { blob, width: dims.w, height: dims.h };
  } finally {
    img.src = '';
    URL.revokeObjectURL(url);
  }
}
```
- **Sequential, always.** A 4032 × 3024 photo decodes to about 48.8 MB of RGBA (computed). A 24 MP default phone photo is about 97 MB `[ASSUMED]`. Two decoded at once risk the canvas budget (Pitfall 5).
- Map failures to the UI-SPEC captions. A failed photo is not added; the rest of the batch is.
- Thumbnails: `URL.createObjectURL` in an effect keyed by attachment id, revoked on removal and unmount. Never create URLs during render or on each `liveQuery` emission.

### Pattern 5: Backup schemaVersion 2 (`src/domain/backup.ts`, `src/data/backup.ts`)
- `export const BACKUP_SCHEMA_VERSION = 1;` (`src/domain/backup.ts:14`) becomes `2`. `export const MAX_BACKUP_BYTES = 50_000_000;` (`src/domain/backup.ts:15`) stays until Open Question 1 is decided.
- v2 entries: `expenses` as stored rows (no Blob); `attachments` as `{ id, expenseId, mime, width, height, createdAt, data }`, with `data` as base64 (`[ASSUMED]` name).
- **v1 still parses.** Today: `need(arrayOf(doc.expenses).length === 0 && arrayOf(doc.attachments).length === 0);` (`src/domain/backup.ts:141`). Keep that rule for `schemaVersion: 1` only.
- v2 validation, all in `parseBackup`, before any write:
  - Expense: id unique; `sessionId` in the file's sessions; `amountCents` a safe integer > 0; description non-empty after trim, at most 80 code points; `splits` non-empty, family ids unique and each an attendee family of that session, cents safe integers ≥ 0, summing exactly to `amountCents`.
  - Attachment: id unique; `expenseId` in the file's expenses; `mime` exactly `image/jpeg`; `data` matches `^[A-Za-z0-9+/]*={0,2}$` with length a multiple of 4; decoded size at most a per-photo cap (`[ASSUMED]` 10 MB); first three decoded bytes `FF D8 FF`; positive integer width and height.
  - Whitelist fields in each new row parser, as `parseFamily` does. The test "rebuilds rows from whitelisted fields" (`tests/backup.test.ts:193-203`) guards against prototype-pollution keys; extend it to expenses and attachments.
- Restore decodes each photo to a Blob synchronously before `db.transaction` opens, so a decode failure aborts before any write. The existing transaction already covers every data table: `dataTables()` filters `db.tables` (`src/data/backup.ts:8`), and the scope is `await db.transaction('rw', [...tables, db.meta], async () => {` (`src/data/backup.ts:42`). Expenses and attachments clear and write atomically with the rest.
- Remove the export guard `if (rows.expenses.length > 0 || rows.attachments.length > 0) throw new BackupError('unsupported-data');` (`src/data/backup.ts:22`), plus the `as unknown as BackupFile` cast and the `never[]` types (`src/domain/backup.ts:33-34`).
- **Size invariant.** `parseBackup` returns `not-backup` when `size > MAX_BACKUP_BYTES` (`src/domain/backup.ts:125`). Export must pre-check projected size before building the string (sum of `blob.size × 4/3` plus JSON overhead) and fail with a clear message if it would exceed the cap.
- WR-02: `02-REVIEW-FIX.md:70` reads "deferred to Phase 3 (receipts). This must be fixed before Phase 3 writes expenses or attachments." Backup capturing photos closes the gap. Restore then replacing receipts is the stated intent (D-07, and the UI-SPEC copy "Everything on this phone is replaced").

## Don't Hand-Roll

- **Container for photos:** base64 inside the existing JSON. D-06 fixes the format; no zip, no new package.
- **Decimal money:** integer cents with `parseAmountToCents`, never float dollars or `toFixed`.
- **JPEG resize:** canvas `drawImage` plus `toBlob`. No hand-written resampler.
- **HEIC:** platform decode first (`img.decode`). A WASM decoder only if the device spike proves it necessary.
- **UUIDs:** `crypto.randomUUID()`, already used at `src/data/sessions.ts:18`.

## Common Pitfalls

### Pitfall 1: Blobs in the compared form hide edits from dirty tracking
`sameForm` builds its comparison with `JSON.stringify({ ...f, attendees: ... })` (`src/domain/sessionForm.ts:221`). `JSON.stringify({b: new Blob(["x"])})` gives `{"b":{}}` (executed), so an added photo looks like no change and the discard alert never appears. **Prevent:** keep `FormState.expenses` JSON-safe (ids and numbers), with Blobs in a UI-state `Map`. Test "adding a photo makes the sheet dirty".

### Pitfall 2: The edit sheet's `initial` is built synchronously from the session row
`SessionSheet` sets `const [initial] = useState(() => formFromSession(session));` (`src/ui/SessionSheet.tsx:15`). Expenses and photos live in other tables and load asynchronously. An `initial` without them makes every expense look changed, or hides one. **Prevent:** load the session's expenses and photo ids first, then render the form and capture `initial`. Gate Save on the same load.

### Pitfall 3: A table outside the transaction scope
Writing to `db.expenses` inside one of the three current transactions (`src/data/sessions.ts:19`, `:36`, `:63`) fails at runtime `[ASSUMED]`. **Prevent:** add the tables to every scope. Test save, update and delete with expenses so CI catches it.

### Pitfall 4: Awaiting non-Dexie async work inside a transaction
Dexie documents: "IndexedDB will commit a transaction as soon as it isn't used within a tick," and "you MUST NOT call any other async API (at least not wait for it to finish) within a transaction scope." Violations raise `TransactionInactiveError` `[CITED: https://dexie.org/docs/Dexie/Dexie.transaction()]`. **Prevent:** canvas, `toBlob`, `arrayBuffer()` and `img.decode()` all run before the transaction. Inside it, only Dexie calls. Backup reads rows in one transaction and encodes outside it. A Blob handle stays valid after the transaction, since Blobs are immutable.

### Pitfall 5: Canvas and object-URL leaks on iOS
Several decodes at once, or canvases never released, can hit Safari's canvas memory budget. A community report describes "Total canvas memory use exceeds the maximum limit" on iOS 15 beta, caused by live references to canvas objects `[ASSUMED]` (LOW: `https://developer.apple.com/forums/thread/112218`). A maximum canvas area of 16,777,216 px is reported `[ASSUMED]` (LOW: `https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/`). A 1600 × 1200 canvas (1.92 MP) is well under it. **Prevent:** one photo at a time; set canvas size to 0 after use; revoke every object URL; one thumbnail URL per attachment id. **Check:** reload while adding the 10th to 20th photo on device.

### Pitfall 6: EXIF orientation and HEIC on iOS (device only)
Sideways receipts in storage or in the Phase 4 PDF if orientation is not applied.
- `createImageBitmap` with `imageOrientation: 'from-image'` is the default in the spec. A WebKit thread reports that in Safari 15, EXIF orientations 5 to 8 were handled wrongly, and that developers used the `ImageElement` path to work around it as of 2022 `[ASSUMED]` (LOW: `https://bugs.webkit.org/show_bug.cgi?id=231063`, search snippet only, not fetched). iOS 16 to 26 status is unconfirmed.
- `accept` changes what Safari does. WebKit bug 303803 (RESOLVED FIXED, commit 2026-01-08) showed `accept="image/*,image/heic"` converting PNG and JPEG to HEIC. Plain `accept="image/*"` was not affected in its macOS 26.2 test `[CITED: https://bugs.webkit.org/show_bug.cgi?id=303803]`.

**Prevent:** use exactly `accept="image/*"`. No `image/heic`, and no `capture` attribute, which forces the camera and removes the library `[ASSUMED]`. Use the `img` decode path first. **Check on device:** portrait and landscape photos from camera and library, orientation tags 1, 3, 6 and 8, one HEIC library photo. Canvas re-encode should also drop the source EXIF block `[ASSUMED]`, which keeps GPS data out of stored photos.

### Pitfall 7: Export produces a file that restore refuses
Above the cap, `parseBackup` returns `not-backup` (`src/domain/backup.ts:125`). **Prevent:** the Pattern 5 size pre-check (Open Question 1).

### Pitfall 8: Money input edge cases
Three-decimal input (`1.005`), a pasted leading `$`, or long digit strings that are not exact in a double. **Prevent:** `parseAmountToCents` rejects three decimals, strips one leading `$`, and returns null when cents are not a safe integer. `9999999999999999999` is rejected (executed).

### Pitfall 9: Split drift after edits
Amount change, or a session family change while an override exists, leaves stale shares. **Prevent:** an amount change resets to equal in the form; `reconcileSplits` at save resets any expense whose families differ from the session's. Test: override, add a second family, assert the saved split is equal.

### Pitfall 10: Restoring a v1 file clears local receipts
A v1 file has no photos, so restoring it wipes local receipts. This matches replace-everything, and the confirm copy already says "Everything on this phone is replaced". **Prevent:** test that a v1 restore clears local `expenses` and `attachments` in one transaction, and that a failure mid-restore leaves them untouched (mirror `tests/backup.test.ts:260-270`).

### Pitfall 11: Ownership of families with expenses
Splits reference family ids. `deleteFamily` already refuses families with session history (`src/data/families.ts`: `if (await familyHasSessions(id)) return { ok: false, reason: 'has-history' } as const;`, the CR-02 fix). **Prevent:** restrict splits to the session's attendee families in validation, and add one test that a family referenced only by an expense split cannot be deleted.

## Code Examples

### Base64 encode and decode (executed, Node v24.22.0)
```js
const CHUNK = 0x8000;
export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
export function base64ToBytes(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length % 4 !== 0 || !B64_RE.test(s)) return null;
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const decodedLen = (s) => (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
// Verified: matches Buffer base64 for sizes 0, 1, 2, 3, 4, 1000, 32768, 32769, 300000;
// rejects "", "abc", "ab@d", "abc=d", "====", "QUJD\n"
```
Performance on Node 24 (not iPhone): 20 × 300 KB encoded in 24 ms and decoded in 43 ms.

### Blob round trip (executed)
`db.attachments.put({ id: 'a1', expenseId: 'e1', blob, bytes: blob.size })` stored a JPEG Blob that read back with type `image/jpeg`, size 7, bytes `ff d8 ff` intact. `structuredClone(Blob)` also works on Node 24, which fake-indexeddb uses. CI runs Node 24 (`.github/workflows/deploy.yml:20`); `package.json` engines say `>=22.12.0`, which is not verified here (Assumption A11).

## State of the Art

- `FileReader.readAsDataURL` plus prefix stripping is superseded by `Blob.arrayBuffer()` plus chunked `btoa` `[ASSUMED]`.
- **Correction to CLAUDE.md:** it cites WebKit 268037 as "Blob storage in IndexedDB regression, Safari 17.x, resolved", with no scope. The bug report limits it to private browsing, RESOLVED FIXED `[CITED: https://bugs.webkit.org/show_bug.cgi?id=268037]`. The Phase 1 device spike showed a Blob round trip on the home-screen app (`01-SPIKE-RESULTS.md:13`: "blob-roundtrip-home-screen: ok (user reported all passed)").
- `accept="image/*,image/heic"` is superseded by `accept="image/*"` (Pitfall 6).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `accept="image/*" multiple` shows Camera and Library on iOS | Browser APIs, Pattern 4 | Camera or library path missing |
| A2 | `img.decode()` decodes JPEG and HEIC from the library on iOS 26 | Pattern 4, Pitfall 6 | Cannot-read captions for valid photos |
| A3 | `drawImage` honors EXIF orientation on the `img` path, iOS 26 | Pitfall 6 | Sideways receipts in storage and PDF |
| A4 | `toBlob(..., 'image/jpeg', 0.8)` output drops source EXIF | Pitfall 6 | Metadata kept in photos |
| A5 | 1600 px and quality 0.8 keep receipt text legible | Pattern 4 | Tune the constant |
| A6 | A 24 MP default photo decodes to about 97 MB RGBA | Pattern 4 | Memory pressure on older iPhones |
| A7 | Canvas memory budget on iOS 16 to 26 | Pitfall 5 | Reload while adding many photos |
| A8 | About 300 KB per stored photo (20 receipts ≈ 8 MB base64) | Pattern 5, Open Question 1 | Export size estimate wrong |
| A9 | Dexie throws when a table is used outside the transaction scope | Pattern 2, Pitfall 3 | Silent wrong scope if tests skipped |
| A10 | Proposed names (`amountCents`, `splits`, `data`, `mime`) and the 10 MB per-photo cap | Patterns 1, 5 | Renames only; cap is a judgement call |
| A11 | Node 24 `structuredClone` of Blob matches CI; `>=22.12.0` engines unverified | Code Examples | Tests may fail on Node 22 |
| A12 | `createImageBitmap` with `imageOrientation` behaves on iOS 26 | Pitfall 6 | Only if the bitmap path is chosen |

## Open Questions

1. **Export size ceiling.** `MAX_BACKUP_BYTES` is 50,000,000 and restore refuses anything larger. At about 300 KB per photo (A8), the cap holds about 125 photos. Recommendation: keep the cap, pre-check in export, and refuse with a clear message. That needs one new UI-SPEC string ("This backup is too large to save. Nothing was changed."); UI-SPEC has none. Raising the cap is the alternative, but it raises restore memory.
2. **Pixel count versus file size.** UI-SPEC caps source at 25 MB, but decode memory tracks pixels (A6). Recommendation: add a pixel-count check that reuses the "too large" caption, and confirm with the user because it extends UI-SPEC.
3. **Thumbnail memory.** The grid shows 72 px tiles, but each `<img>` may decode the full 1600 px JPEG (about 7.7 MB each, 154 MB for 20). Measure on device with 20 receipts. If it fails, store a 240 px thumbnail Blob per photo, which adds backup size.
4. **Amount cap.** UI-SPEC assumption 3 says "No cap on the amount." The safe-integer guard implements that. Confirm this reading.
5. **HEIC delivery.** Whether iOS hands the page HEIC or JPEG with `accept="image/*"` is device-dependent. If HEIC arrives and `img.decode()` fails, the choice is a decoder package (new dependency, legitimacy gate) or a "cannot read" caption.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, `npm run build`; CI on Node 24 (`.github/workflows/deploy.yml:20`) | Yes | v24.22.0 | — |
| Dexie, fake-indexeddb, vitest | Data and tests | Yes | 4.4.6, 6.2.6, 5.0.5 | — |
| iPhone, home-screen app | Device spike: camera, library, HEIC, orientation, memory | Yes, per STATE.md (iPhone 14 Pro, iOS 26.6.1, Phase 2 round trip) | iOS 26.6.1 | None; tests cannot replace it |

## Security Domain

`.planning/config.json` sets `"security_enforcement": true`, `"security_asvs_level": 1` and `"security_block_on": "high"`.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Sessions / V4 Access Control | no | Single user, one device, no server |
| V5 Input Validation | yes | `parseAmountToCents`; `parseBackup` for every new row (type, range, reference, base64 charset, magic bytes) |
| V6 Cryptography | no | Backup is plaintext; DATA-05 (encrypted backup) is deferred in REQUIREMENTS.md |
| V12 Files and Resources | yes | MIME and magic-byte check; source and decoded size caps; canvas and object-URL release |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Crafted backup with oversize base64 | Denial of service | Size check before decode; per-photo cap; whole-file cap |
| Non-JPEG payload labelled as a photo | Tampering | `mime` must be `image/jpeg`; first three decoded bytes `FF D8 FF` |
| Dangling expense or photo references | Tampering | Reference checks before any write (all-or-nothing) |
| Prototype-pollution keys in rows | Tampering | Whitelisted row parsers, as `parseFamily` does |
| Receipts leaving the phone in a plaintext backup | Information disclosure | Accepted for v1 scope; Settings copy already says the backup is one file |

## Test Approach (inputs for the planner)

`.planning/config.json` sets `"nyquist_validation": false`, so the Validation Architecture template is omitted. The user asked for testing guidance, given here.

- **Pure domain tests** (`tests/*.test.ts`, node environment): money, splits, `fitLongEdge`, base64 validation, expense validation, reconcile. Every example above was executed, so it can serve as expected values.
- **Data tests** (`import 'fake-indexeddb/auto'`, like `tests/backup.test.ts`): Blob round trip, cascade on delete and update, transaction scope, restore atomicity. Inject a duplicate attachment id and assert expenses, attachments and `lastBackupAt` are unchanged, as at `tests/backup.test.ts:260-270`.
- **Existing tests Phase 3 must change** (they assert Phase 2 guards):
  - `tests/backup.test.ts:110-115`: `it.each(['expenses', 'attachments'] as const)('rejects with unsupported-data when %s holds a row', ...)` is replaced by a v2 export test.
  - `tests/backup.test.ts:172-173`: `['non-empty expenses', (d) => (d.expenses = [{ id: 'x' }])],` and the attachments line apply to v1 only.
  - `tests/backup.test.ts:60`: `schemaVersion: 1` becomes `2`.
- **Canvas pipeline:** not testable in the node environment (`vite.config.ts`: `environment: 'node'`; no canvas, `createImageBitmap` or `Image`). Follow the injected-environment pattern in `src/pwa/share.ts` (`export interface ShareEnv {`) with fake decode and encode; test sequencing, error mapping, and release and revoke. The pixel path is checked only on device. No jsdom: it would be a new dependency.
- **CI** runs `npm test`, `npm run build`, `node scripts/check-dist.mjs` (`.github/workflows/deploy.yml:23-25`). No device-check harness may ship: check C14 fails on leftover harness strings.

## Project Constraints (from CLAUDE.md)

- Static hosting, no backend, data on the phone, offline after first load (the photo pipeline makes no network calls). Photos are Blobs in IndexedDB, never localStorage or Cache Storage.
- `src/domain/` stays pure; `src/data/` is the only Dexie importer. UUIDs, integer units, one read-write transaction per save, validation before any write, all-or-nothing restore.
- Repo edits go through a GSD workflow (`/gsd-execute-phase`).

## Sources

**Repo files read this session:** `src/data/db.ts`, `src/data/sessions.ts`, `src/data/backup.ts`, `src/data/families.ts`, `src/domain/backup.ts`, `src/domain/session.ts`, `src/domain/sessionForm.ts`, `src/domain/types.ts`, `src/domain/validate.ts`, `src/ui/SessionFields.tsx`, `src/ui/Log.tsx`, `src/ui/SessionSheet.tsx`, `src/ui/BackupGroup.tsx`, `src/ui/useBackup.ts`, `src/pwa/share.ts`, `src/data/live.ts`, `tests/backup.test.ts`, `package.json`, `vite.config.ts`, `.planning/config.json`, `.planning/phases/03-expenses-receipts/03-CONTEXT.md`, `03-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/02-session-logging-backup/02-REVIEW.md`, `02-REVIEW-FIX.md`, `.planning/phases/01-installable-app-roster/01-SPIKE-RESULTS.md`, `.github/workflows/deploy.yml`.

**Fetched (HIGH):** `https://dexie.org/docs/Version/Version.stores()`; `https://dexie.org/docs/Dexie/Dexie.transaction()`; `https://bugs.webkit.org/show_bug.cgi?id=268037`; `https://bugs.webkit.org/show_bug.cgi?id=303803`.

**Search snippets only (LOW, not fetched):** `https://developer.apple.com/forums/thread/112218`; `https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/`; `https://bugs.webkit.org/show_bug.cgi?id=231063`; `https://caniuse.com/createimagebitmap`.

**Prior project research:** `.planning/research/PITFALLS.md:264` (downscale range).

**Sandbox executions (Node v24.22.0, Dexie 4.4.6, fake-indexeddb 6.2.6):** money, split, base64, downscale, Blob round trip, cascade. Scratch files kept outside the repo.

## Metadata

**Confidence:** HIGH for stack, data model, transactions, money, split, base64, backup invariants (read or executed). MEDIUM to LOW for the iOS pipeline (device only; `[ASSUMED]`). Size thresholds MEDIUM (A8, Open Question 1).
**Research date:** 2026-10-19. **Valid until:** 2026-11-18 for repo and Dexie facts; re-check iOS behavior after the device spike.
