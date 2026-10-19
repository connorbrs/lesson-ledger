---
phase: 02-session-logging-backup
reviewed: 2026-10-19
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/data/backup.ts
  - src/data/db.ts
  - src/data/families.ts
  - src/data/live.ts
  - src/data/sessions.ts
  - src/data/students.ts
  - src/domain/backup.ts
  - src/domain/dates.ts
  - src/domain/hours.ts
  - src/domain/roster.ts
  - src/domain/session.ts
  - src/domain/sessionForm.ts
  - src/domain/types.ts
  - src/domain/validate.ts
  - src/pwa/share.ts
  - src/pwa/storage.ts
  - src/ui/App.tsx
  - src/ui/Archived.tsx
  - src/ui/BackupGroup.tsx
  - src/ui/BackupReminder.tsx
  - src/ui/Log.tsx
  - src/ui/SessionFields.tsx
  - src/ui/SessionSheet.tsx
  - src/ui/Sessions.tsx
  - src/ui/Settings.tsx
  - src/ui/StudentPicker.tsx
  - src/ui/useBackup.ts
findings:
  critical: 3
  warning: 3
  info: 3
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 2 (session logging, Sessions period view, edit/delete, JSON backup and restore) is well structured. Credit math is integer-safe, the half-minute rounding is exact, Mon–Sun week math is correct, and restore validates the whole file before a single read-write transaction. Week boundaries were spot-checked by running the domain code (2026-10-19 is a Monday; the week and half-minute formatting outputs are correct).

The problems are at the edges of that design:

1. A saved session can carry a date that is one day stale (CR-01).
2. Deleting a family ignores session history, which leaves a backup that the app's own restore rejects as damaged (CR-02, confirmed by running `parseBackup` on such a file).
3. Students of an archived family can be silently logged and cannot be removed in the Log flow (CR-03).

Fix the three critical items before relying on the summaries for billing.

## Critical Issues

### CR-01: Session saved with a stale date after midnight

**File:** `src/ui/Log.tsx:52,59,87` and `src/ui/SessionSheet.tsx:26,35`
**Issue:** `check = formToInput(draft, todayLocal())` is computed during render. `save()` then writes `check.value`, and the button's `onClick` is the handler from the last render. Nothing re-renders on the clock (`useLive` only re-renders on DB emissions, and `useAppUpdate`'s visibility listener only calls `registration.update()`). A Log form left open past local midnight, with the date untouched (`date: null`), therefore saves the previous calendar day. The "Today" label shown on the form is equally stale, so the user is not warned. The comment at `src/domain/sessionForm.ts:10` says this case is handled; it is not. A wrong date changes the week and month totals that go to parents.
**Fix:** Resolve the date at save time, not at render time:
```ts
async function save() {
  if (busy.current) return;
  const r = formToInput(draft, todayLocal()); // evaluated now
  if (!r.ok) return;
  busy.current = true;
  // ...
  const saved = await createSession(r.value);
```
Apply the same change in `SessionSheet.save()`. The render-time `check` may still gate the button, but the value written must come from a fresh call.

### CR-02: Deleting a family with session history creates an unrestorable backup

**File:** `src/data/families.ts:51-58` (delete guard counts only students), `src/ui/Archived.tsx:97` (offers "Delete Family" when `!hasStudents`), `src/domain/backup.ts:142` (restore rejects the orphan)
**Issue:** Sessions snapshot `familyId` on every attendee and credit, and a student can be moved to another family after a session is logged. Once a family has no students it is deletable, even though its sessions still reference it. The next backup then contains sessions pointing at a family that is not in `families`. `parseBackup` requires every attendee's `familyId` to exist (`domain/backup.ts:142`), so the file is rejected as "damaged". The user's only recovery path fails, and the app reported the backup as successful.
Reproduction (verified by parsing such a document with the domain code): family X has student S; log a session with S; move S to family Y; archive X; delete X. `parseBackup` returns `{ ok: false, code: 'damaged' }` for the resulting backup. The backlog item 999.1 intent ("lesson history wins") is not enforced in the data layer, and no test covers `deleteFamily` with sessions present.
**Fix:** Include `sessions` in the delete guard and in the history check:
```ts
export async function deleteFamily(id: string): Promise<DeleteResult> {
  return db.transaction('rw', db.families, db.students, db.sessions, async () => {
    if (!(await db.families.get(id))) return { ok: false, reason: 'not-found' } as const;
    if ((await db.students.where('familyId').equals(id).count()) > 0) return { ok: false, reason: 'has-students' } as const;
    const referenced = await db.sessions.filter((s) => s.attendees.some((a) => a.familyId === id) || s.credits.some((c) => c.familyId === id)).count();
    if (referenced > 0) return { ok: false, reason: 'has-history' } as const;
    await db.families.delete(id);
    return { ok: true } as const;
  });
}
```
Make `hasFamilyHistory` (used by `Archived.tsx` and `FamilySheet.tsx`) include the same session check so the Delete button and the note agree. Add a test: move the only student out of a family that has a session, then assert `deleteFamily` returns `has-history`.

### CR-03: Students of an archived family are logged and cannot be deselected

**File:** `src/domain/sessionForm.ts:103-108` (prefill checks student status only), `src/ui/Log.tsx:33-39` (draft sync checks student status only), `src/ui/StudentPicker.tsx:19,47-50` (lists students only under active families), `src/data/sessions.ts:11-17` and `:43` (create and update check the student, not the family)
**Issue:** Archiving a family leaves its students active (by design). The Log prefill and draft sync keep those students, and `createSession` accepts them because only `student.archivedAt` and `familyId` are checked. The picker lists students only under `listActiveFamilies()`, so these attendees have no row there and cannot be deselected from the Log flow. The Students row still shows their names, and Save succeeds. In practice: archive a family, then the next prefilled session bills that family's student with no way to remove them except Edit Session.
**Fix:** Treat an archived family as inactive for new attendees, consistently:
```ts
// sessionForm.ts prefillFromSession: take only students whose family is active
// (pass activeFamilyIds alongside activeStudents from the Log liveQuery).
// Log.tsx draft sync: drop attendees whose family is not in the active set.
// data/sessions.ts createSession and updateSession (new attendees only):
const family = await db.families.get(a.familyId);
if (!student || student.archivedAt !== null || student.familyId !== a.familyId || !family || family.archivedAt !== null)
  throw new SessionError('student-missing');
```
Retained attendees in `updateSession` may keep their history as-is; only new attendees need the family check.

## Warnings

### WR-01: Backup recorded as done after an unverified download fallback

**File:** `src/ui/useBackup.ts:18-23`, `src/pwa/share.ts:34-51`
**Issue:** `buildBackup` is awaited before `shareFile` runs, so `navigator.share` may be called after the user-activation window that iOS requires. `shareFile` treats any non-abort rejection as a reason to call `download`, and returns `'downloaded'`. `useBackup` then calls `markBackedUp` unconditionally. On a home-screen web app the download path is not verified (the project's own notes call for on-device checks). The result can be a stamped "Last backup today" with no file saved, which silences the reminder for seven days. This could not be confirmed without a device, so treat it as a risk to verify on the iPhone.
**Fix:** Mark the backup done only when the file was actually handed to the share sheet (`'shared'`). For `'downloaded'`, do not stamp; show a note asking the user to confirm the file was saved. Also consider calling `navigator.share` before any `await` in the tap handler (prebuild the file on mount or on tap-down) to keep the gesture valid.

### WR-02: Restore wipes receipt tables that the backup refuses to capture

**File:** `src/data/backup.ts:8` and `:43-46` (restore clears every non-meta table, including `expenses` and `attachments`), `:22` (backup throws when those tables have rows)
**Issue:** The two directions disagree. A backup fails closed when receipts exist, but restore silently clears `expenses` and `attachments` as part of "replace everything". Today nothing writes those tables, so this is latent. When Phase 3 adds receipts, a user can restore an old backup and lose every receipt on the phone with no receipt-specific warning, and the confirmation text does not mention them.
**Fix:** Keep the invariant symmetric. Either exclude `expenses`/`attachments` from the replace set and say so, or make `restoreBackup` refuse while local `expenses`/`attachments` have rows, mirroring `buildBackup`. Add the check now so Phase 3 cannot inherit the gap.

### WR-03: A future-dated backup silences the reminder

**File:** `src/domain/backup.ts:53` (`isTime` accepts any non-negative number), `src/data/backup.ts:48` (restore stores `file.createdAt` as the last backup time), `src/domain/backup.ts:152` (`daysSince` clamps negatives to 0)
**Issue:** A backup whose `createdAt` is later than now (wrong clock on the phone that made it, or a hand-edited file) is accepted. The stored last-backup time is then in the future, the clamp reports "Today", and the reminder never becomes due until that date passes.
**Fix:** Reject `createdAt` more than a day ahead of `Date.now()` in `parseBackup` (report `damaged`), or store `Math.min(file.createdAt, Date.now())` as `lastBackupAt` during restore.

## Info

### IN-01: Production session helpers used only by tests

**File:** `src/data/sessions.ts:64-71` (`getSession`, `listSessions`)
**Issue:** Neither function is called from `src/`; both exist only for `tests/sessions.test.ts`. Dead production code.
**Fix:** Move them into the test helpers, or delete them and assert through `listSessionsInRange`.

### IN-02: Month navigation drifts the anchor day

**File:** `src/domain/dates.ts:81-88`
**Issue:** `shiftPeriod` clamps the day, and the clamped value becomes the next anchor. Mar 31 back one month gives Feb 28, and forward again gives Mar 28. The month label is unaffected today, but the anchor drift is wrong if a day is ever shown.
**Fix:** Keep the original anchor day in state, or clamp only when rendering the target month.

### IN-03: Oversize file reported as "not a backup"

**File:** `src/ui/BackupGroup.tsx:56`
**Issue:** A file larger than `MAX_BACKUP_BYTES` returns `code: 'not-backup'`, so a real but oversized backup is told "This file isn't a Lesson Ledger backup". The message is misleading.
**Fix:** Add a `too-large` failure code with its own message.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
