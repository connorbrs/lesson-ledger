---
phase: 03-expenses-receipts
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - scripts/make-large-backup.mjs
  - src/data/backup.ts
  - src/data/db.ts
  - src/data/expenses.ts
  - src/data/sessions.ts
  - src/domain/backup.ts
  - src/domain/base64.ts
  - src/domain/expense.ts
  - src/domain/money.ts
  - src/domain/photos.ts
  - src/domain/session.ts
  - src/domain/sessionForm.ts
  - src/domain/split.ts
  - src/domain/types.ts
  - src/pwa/photos.ts
  - src/ui/App.tsx
  - src/ui/BackupGroup.tsx
  - src/ui/BackupReminder.tsx
  - src/ui/BackupTooLargeAlert.tsx
  - src/ui/ExpenseEditor.tsx
  - src/ui/ExpensesGroup.tsx
  - src/ui/Log.tsx
  - src/ui/ReceiptViewer.tsx
  - src/ui/ReceiptsGroup.tsx
  - src/ui/SessionFields.tsx
  - src/ui/SessionSheet.tsx
  - src/ui/Sessions.tsx
  - src/ui/SplitGroup.tsx
  - src/ui/components.tsx
  - src/ui/receiptPhotos.ts
  - src/ui/useBackup.ts
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

The core data-integrity design holds up. Session save, expense and photo reconcile, and session delete each run in one rw transaction with only Dexie calls inside it. No image decoding or Blob reading happens in a transaction. Orphan attachments are cleaned in all three paths: expense removed, photo removed, session deleted. Split shares are always re-derived through `resolveSplits`, so they sum exactly to the amount. Cents parsing is BigInt-exact and never rounds. Backup v2 validation is thorough:

- Rows are rebuilt from whitelisted fields.
- Ids must be unique, and references must resolve.
- Shares must equal the session's attendee families and sum to the amount.
- Photos pass base64, size and JPEG-magic checks before any write.
- Restore clears and replaces every table in one transaction, which closes the Phase 2 WR-02.
- v1 files still restore: the Phase 2 exporter always wrote `expenses: []` and `attachments: []`, which I checked against `git show 903f6a8`.

I found no blockers. The warnings are one input-hardening gap in restore, one silent one-cent money shift on edit, one latent integrity hazard, and two memory issues.

## Warnings

### WR-01: A restored backup can use `__proto__` as a row id and crash the Sessions tab

**File:** `src/data/expenses.ts:103-106` (also `src/domain/backup.ts:75`)
**Issue:** `isId` accepts any non-empty string, with no length or charset limit. A crafted backup (the task calls restore input untrusted) can carry a session with `id: "__proto__"` plus one expense for it. It passes `parseBackup` and restores. `expenseTotalsBySession` then runs `(bySession[r.sessionId] ??= []).push(...)` on a plain `{}`. `bySession["__proto__"]` is `Object.prototype`, which is not nullish, so no array is created, and `.push` throws `TypeError: ... is not a function`. I reproduced this in Node. `useLive` rethrows liveQuery errors to the error boundary, so the Sessions tab shows RecordsError, and the user cannot reach that session to delete it. The same plain-object pattern in `loadNameMaps` silently drops names for such ids.
**Fix:** Reject suspicious ids in the validator, and harden the accumulator.
```ts
// domain/backup.ts
const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) && v !== '__proto__';
// data/expenses.ts
const bySession = new Map<string, number[]>();
for (const r of rows) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r.amountCents]);
```
UUIDs match the charset above. Keep the allowed charset wide enough for any ids earlier phases generated.

### WR-02: Re-picking students in Edit Session silently moves an odd cent between families

**File:** `src/domain/expense.ts:110-124` (`draftFromExpense`), used from `src/data/expenses.ts:113-128` and `src/ui/SessionSheet.tsx:32,57`
**Issue:** The draft collapses stored shares to `splits: null` ("equal default") whenever they equal the equal split in the stored family order. On save, `resolveSplits` recomputes the equal split in the current pick order. The CONTEXT says each family's cents are stored explicitly "so the summaries never recompute the split".
- Take an odd-cent expense, for example $12.51, stored as A 6.26 / B 6.25.
- In the Edit Session sheet, the user removes student A and re-adds them. `creditFamilies(form.attendees)` becomes [B, A].
- The unchanged expense is rewritten as B 6.26 / A 6.25.
- Family A's billed amount drops by one cent. The user never touched the expense, and the sheet raises no warning.

A pick-order swap is enough to trigger this.
**Fix:** In `draftFromExpense`, return the stored shares as an explicit override when they differ from the equal split in the current order. Alternatively, keep a draft flag such as `amountEdited` and recompute only when the amount changed. Add a test that covers reordering.

### WR-03: `updateSession` makes the expense payload optional, so family changes can leave invalid split rows

**File:** `src/data/sessions.ts:37,61-64`
**Issue:** When `payload` is omitted, the session's attendees, families and credits can change while stored expense `splits` and attachments stay untouched. Every current caller passes a payload, so this is latent. `parseExpense` requires the share families to equal the session's attendee families. A later caller that edits a session without a payload would produce data that the app's own backup then rejects as "damaged" on restore, meaning a backup the user can never restore.
**Fix:** Make the parameter required and make the intent explicit.
```ts
export async function updateSession(id: string, input: SessionFields, payload: ExpensePayload): Promise<Session>
```
Or, when `payload` is absent, load the drafts inside the transaction and run `writeSessionExpenses` with them.

### WR-04: The 50 MP pixel guard runs only after the full bitmap is decoded

**File:** `src/pwa/photos.ts:87-92`
**Issue:** `prepareReceipt` rejects a source over 50 MP only after `env.decode` (`img.decode()`) has produced the full-size bitmap. The decode is where an iOS Safari tab can run out of memory, since 50 MP is about 200 MB of RGBA. So the guard does not protect memory. Only the 25 MB file-size gate protects it, and a highly compressed panorama can pass that gate while decoding to hundreds of megabytes. OQ2 in CONTEXT intended the guard to bound exactly this risk.
**Fix:** Bound the decode itself. Use `createImageBitmap(file, { resizeWidth, resizeHeight, resizeQuality })` where the target is derived from dimensions read from the JPEG/HEIC header. Alternatively, accept that the guard is advisory and document it. Confirm the real ceiling in the device spike.

### WR-05: Photos staged for a deleted Log-tab expense stay in memory until the next successful save

**File:** `src/ui/ExpenseEditor.tsx:146-152` (`confirmDelete`); stage owned at `src/ui/App.tsx:~78`, cleared only at `src/ui/Log.tsx:64`
**Issue:** `confirmDelete` calls `props.onDelete(initial.id)` and never removes `initial.photoIds` from `props.stage`. The Log tab's stage lives for the whole app session, because the draft persists across tab switches. Each add, delete cycle leaves up to roughly 200-600 KB per photo (a re-encoded 1600 px JPEG) in the Map, unreachable by any draft, until a session is logged. The Edit Session sheet owns its stage, so it frees on close. This is a memory leak on exactly the path the phase flags (about 20 receipts on a phone).
**Fix:** In `confirmDelete`, drop the photos the expense still holds.
```ts
for (const id of photoIds) props.stage.delete(id); // current ids (initial + added), not just initial
```
Only do this for ids that are staged, not stored. Deleting a missing key from the Map is harmless.

## Info

### IN-01: `expenses-invalid` and `photo-missing` fall through to the "low on storage" message

**File:** `src/ui/components.tsx:16-22`
**Issue:** `sessionSaveErrorMessage` maps only `student-missing` and `not-found`. The two new `SessionError` codes get the "Your phone may be low on storage" copy, which would send the user down the wrong path.
**Fix:** Add a case for `expenses-invalid`/`photo-missing`, for example "Couldn't save. An expense or receipt photo is no longer valid. Open the expense and check it. Nothing was changed."

### IN-02: Back during photo processing closes with no prompt and drops the picked photos

**File:** `src/ui/ExpenseEditor.tsx:129-136`; `src/domain/expense.ts:187`
**Issue:** `expenseEditorDirty` ignores `processing`. On a new expense with nothing else typed, picking photos and tapping Back closes the editor without confirmation, and the in-flight photos are discarded.
**Fix:** Treat `processing > 0` as dirty.

### IN-03: An oversize restore file is reported as "isn't a Lesson Ledger backup"

**File:** `src/ui/BackupGroup.tsx:70`; `src/domain/backup.ts:193`
**Issue:** A real backup over 150 MB gets the `not-backup` copy, which blames the file type. This can happen when a backup comes from a build with a larger cap or has been appended to.
**Fix:** Add a distinct `too-large` failure with its own copy, or reuse `BACKUP_TOO_LARGE_MESSAGE` wording.

### IN-04: Peak memory for export and restore is roughly three times the cap (device-spike item)

**File:** `src/data/backup.ts:36-40,60-66`; `src/ui/useBackup.ts:22`
**Issue:** These are the peaks as I read them from the code:
- Export holds the base64 strings, then the `JSON.stringify` copy, then the `File`.
- Restore holds the parsed base64 `file`, the decoded byte arrays, and then the Blobs. Restore also keeps `alert.file` (all the base64) in component state while the confirm alert is up.

At 150 MB this plausibly exceeds iOS Safari's tab budget. D-08 already makes this a device-spike check, so I did not rate it higher. If the spike fails, the cheapest wins are to drop the `text` reference before confirming, and to decode and add photos in chunks outside the clear transaction.

### IN-05: `make-large-backup.mjs` throws for very small sizes

**File:** `scripts/make-large-backup.mjs:60-64`
**Issue:** If the target is less than the JSON overhead (about 1 KB), `photoBytes` clamps to 3 and `bytes.set([0xff,0xd8,0xff,0xe0])` throws `RangeError`. This only affects a dev script.
**Fix:** Clamp the minimum to 4.

### IN-06: There is no upper bound on amounts, so totals can lose precision

**File:** `src/domain/money.ts:34-38`; `src/domain/expense.ts:29`
**Issue:** The `Number.isSafeInteger` cap per expense is intentional, per the CONTEXT decision. `sumCents` is a plain float add, though. A few absurd amounts (about $9e13) sum past 2^53 and silently round in row totals and the footer. The risk is theoretical, but the money math has no guard at all.
**Fix:** Cap the amount at something sane (for example $1,000,000.00), or have `sumCents` throw when a sum is not a safe integer.

### IN-07: Small duplication and a unit mismatch

**File:** `src/domain/expense.ts:158` vs `src/domain/backup.ts:264`; `src/ui/components.tsx` (`InputRow` `maxLength`)
**Issue:**
- The `plural(n, one, many)` helper in `expense.ts` duplicates `noun` in `backup.ts`.
- The Description input's `maxLength={80}` counts UTF-16 units, while validation counts code points. Emoji-heavy text hits the input limit at 40, which is stricter than validation and harmless.

**Fix:** Share one pluralizer, and note that the unit mismatch is intentional.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
