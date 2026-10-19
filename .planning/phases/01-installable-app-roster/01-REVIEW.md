---
phase: 01-installable-app-roster
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - .github/workflows/deploy.yml
  - .gitignore
  - index.html
  - package.json
  - vite.config.ts
  - tsconfig.json
  - assets/icon.svg
  - scripts/build-id.mjs
  - scripts/build-id.d.mts
  - scripts/check-dist.mjs
  - scripts/generate-icons.mjs
  - src/vite-env.d.ts
  - src/main.tsx
  - src/data/db.ts
  - src/data/families.ts
  - src/data/live.ts
  - src/data/students.ts
  - src/domain/roster.ts
  - src/domain/types.ts
  - src/domain/validate.ts
  - src/pwa/singleFlight.ts
  - src/pwa/standalone.ts
  - src/pwa/storage.ts
  - src/pwa/useAppUpdate.ts
  - src/ui/App.tsx
  - src/ui/Archived.tsx
  - src/ui/FamilySheet.tsx
  - src/ui/People.tsx
  - src/ui/Settings.tsx
  - src/ui/Status.tsx
  - src/ui/StudentSheet.tsx
  - src/ui/components.tsx
  - src/ui/styles.css
  - tests/pwa.test.ts
  - tests/roster.test.ts
  - tests/tracer.test.ts
  - tests/validation.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard
**Files Reviewed:** 37 (all listed source, config, script and test files; `scripts/generate-icons.mjs` and `tests/validation.test.ts` produced no findings)
**Status:** issues_found

## Summary

The Dexie write layer is sound. Every write is a single transaction, family/student existence checks share the write's transaction, and the create/delete race is covered by a test. Validation runs before any write. There is no XSS surface: all user text is rendered as Preact text nodes and nothing uses `dangerouslySetInnerHTML`. `useLive` is a correct `liveQuery` subscription, with one stale-value caveat (WR-05).

The problems are at the seams between modules and between phases:

- The archive model lets a record become invisible everywhere (CR-01).
- Two delete/update contracts fail in the dangerous direction once later phases land (WR-01, WR-02).
- The update flow can hang permanently (WR-03).
- Several error paths swallow failures silently (WR-04).

No structural findings (fallow) were supplied. No external reviewer evidence was supplied.

## Critical Issues

### CR-01: Restoring a student whose family is archived makes the student disappear from every screen

**File:** `src/data/students.ts:51-64`, `src/ui/Archived.tsx:32-43`, `src/ui/People.tsx:15-19,34-37`
**Issue:** `restoreStudent` only clears `archivedAt` on the student and never checks the parent family. People renders only students nested under *active* families. Archived renders only records with `archivedAt !== null`. A student that is active but belongs to an archived family therefore appears nowhere.

Reproduction:
1. Archive a student.
2. Archive that student's family.
3. Open Archived and tap "Restore Student". The row vanishes, the student is "active", and no screen shows it.

The Archived list also shows the student with no family name, so it gives no hint that the family must be restored first.

This is user-visible apparent data loss in Phase 1. It also violates the invariant that Phase 2 quick-entry will presumably rely on (an active student has an active family). `createStudent` and `updateStudent` already enforce that invariant for new family links, so `restoreStudent` is the one path that breaks it.

**Fix:** Enforce the invariant in the data layer and surface it in the UI. Either option below works.

```ts
// students.ts, inside setArchived's transaction (add db.families to the tx scope)
if (!archived) {
  const family = await db.families.get(current.familyId);
  if (!family || family.archivedAt !== null) throw new RosterError('family-missing');
}
```

In `Archived.tsx`, show the family name under each archived student and disable "Restore Student" (with a caption such as "Restore the family first") while the parent family is archived. Alternatively, have restoring a student also restore its family inside the same transaction. Add a test: archive student, archive family, expect restore to be rejected.

## Warnings

### WR-01: `updateStudent` silently resets `defaultSubject` and wipes `notes` when those fields are omitted

**File:** `src/data/students.ts:6-22,37-49`
**Issue:** `StudentInput` makes `defaultSubject` and `notes` optional, and `validated()` substitutes `'both'` and `''` when they are `undefined`. That is correct for `createStudent`. `updateStudent` reuses the same `validated()`, so any caller that updates only `name` or `familyId` (for example a future "move student" action) overwrites the stored subject and erases the private notes. This is silent data loss.

Every current UI call and every test passes all four fields, so nothing catches it today.

**Fix:** Make the update input a full object, or merge before validating.

```ts
export async function updateStudent(id: string, input: Partial<StudentInput>) {
  return db.transaction('rw', db.students, db.families, async () => {
    const current = await db.students.get(id);
    if (!current) throw new RosterError('not-found');
    const r = validateStudentInput({ ...current, ...input }); // omitted fields keep stored values
    if (!r.ok) throw new RosterError(r.code);
    const v = r.value;
    // ...
```

Add a test for "update with only name keeps notes and subject".

### WR-02: `deleteStudent` history guard fails open on a shape contract that nothing enforces

**File:** `src/data/students.ts:66-88`
**Issue:** The "has history" check passes whenever no `sessions` row has `attendees: [{ studentId }]`. The `sessions` table is currently untyped (`IdRow`). If Phase 2 stores attendance in any other shape (`studentIds`, a separate `attendance` table, a different property name), `hasAttendee` returns false and the guard allows a hard delete of a student who has sessions. That orphans session rows and corrupts every future per-family summary. The only protection is a doc comment and a test that writes the assumed shape itself.

Sessions are also found by a full-table `filter` scan with no index, so nothing forces Phase 2's schema work to touch this function.

**Fix:** Make the guard fail closed and tie it to the schema.
- When Phase 2 types `sessions`, add a `*attendees.studentId` multiEntry index in `db.version(2)`, and replace `hasAttendee` with an indexed query.
- Add a TypeScript type for `Session` that `hasAttendee` is checked against, so a rename breaks the build.
- Until then, treat any `sessions` row with an unrecognised shape as history:
  ```ts
  const attendees = (row as {attendees?: unknown}).attendees;
  if (!Array.isArray(attendees)) return true; // unknown shape: assume it may reference the student
  ```

### WR-03: Update flow can hang forever in "Updating App…" with no way out

**File:** `src/pwa/useAppUpdate.ts:30-43`, `src/ui/Status.tsx:27-48`
**Issue:** `apply()` sets `applying=true` and awaits `updateServiceWorker(true)`. In the installed `vite-plugin-pwa` 2.0.0 (`dist/client/build/register.js`), `updateServiceWorker` only awaits `registerPromise` and then calls `sendSkipWaitingMessage?.()`. That call is fire-and-forget (`wb?.messageSkipWaiting()` is not awaited or returned), the `_reloadPage` argument is ignored, and the page reload happens only if a `controlling` event with `isUpdate` fires later.

So the `catch` that sets `failed` is effectively unreachable. If the waiting worker is gone, was already activated, or the message is dropped, no reload happens and nothing rejects. The banner then stays on "Updating App…" with the primary button disabled and "Not Now" hidden (`!props.applying`). The only recovery is force-quitting the app, and the "Couldn't update" message never appears.

**Fix:** Add a watchdog and let the user dismiss.
```ts
setApplying(true);
const t = setTimeout(() => { setFailed(true); setApplying(false); }, 8000);
try { await latest.current(true); } catch { setFailed(true); setApplying(false); clearTimeout(t); }
// the page reloads on success, so no clearTimeout is needed on that path
```
Also keep "Not Now" visible when `failed`.

### WR-04: Failures are swallowed or mislabelled in several UI paths

**File:** `src/ui/Archived.tsx:25,37`, `src/ui/FamilySheet.tsx:38-42,49-55`, `src/ui/StudentSheet.tsx:155-159`, `src/ui/App.tsx:36-37,58-59`
**Issue:**
- Restore Family / Restore Student use `.catch(() => undefined)`. A failed restore (quota, db closed, `not-found`) gives the user no feedback. The row just stays, and the user may tap repeatedly.
- Every save or archive failure in both sheets shows "Your phone may be low on storage". That is wrong for `RosterError` codes such as `family-missing` (family archived or deleted while the sheet was open) and `not-found`, which are not storage problems.
- The app-level error boundary shows "Can't open your records. Nothing has been changed." for any render exception, including ordinary bugs unrelated to storage.

**Fix:**
- In `Archived`, keep a small `failedId` state and render a row-level error, or at least a shared alert.
- In the sheets, branch on `e instanceof RosterError` to show a specific message ("This family was archived. Pick another.") and use the storage message only for other errors.
- Narrow the boundary message, or log the caught `error` so non-database bugs are diagnosable.

### WR-05: `useLive` keeps showing the previous query result after `deps` change

**File:** `src/data/live.ts:8-21`, `src/ui/StudentSheet.tsx:123-135`
**Issue:** When `deps` change, the effect re-subscribes but `value` still holds the previous emission until the new query resolves. In `StudentSheet`, `familyId` changes on picker selection, so for a few milliseconds `data.chosen` is the old family while `familyId` is the new one. `chosen` and `check` are derived from the stale `data`, so the form briefly shows (and validates against) the old family. Save is covered by the picker overlay for about 300 ms, so this is hard to hit today.

The pattern is a trap for any future caller that uses `useLive` with changing deps. A thrown `error` is also sticky across dep changes, with no reset.

**Fix:** In the effect, call `setValue(undefined)` and `setError(null)` before subscribing when deps change. Alternatively, have the query return `{ forId: familyId, ... }` and ignore results whose `forId !== familyId`.

### WR-06: Underlying content is not hidden from assistive tech behind sheets, pushed screens and alerts

**File:** `src/ui/components.tsx:259-265,267-304,314-336`, `src/ui/App.tsx:51-83`
**Issue:** Sheets declare `aria-modal="true"`, but `PushLayer` (Archived and family picker) has no dialog semantics and nothing marks the covered content `inert` or `aria-hidden`. With VoiceOver, the People list, tab bar and form fields behind a pushed screen, sheet or alert remain reachable by swipe navigation. Focus is also not moved into an opened Alert (focus stays on the row that opened it, which sits underneath). A VoiceOver user can interact with the destructive "Delete Family" row behind the confirm alert, or lose their place.

**Fix:** Set `inert` (or `aria-hidden="true"`) on the `.app` content siblings while an overlay is open. Focus the first button, or the least-destructive "Cancel", when an `Alert` mounts, and restore focus to the opener on close.

## Info

### IN-01: `crypto.randomUUID()` requires a secure context

**File:** `src/data/families.ts:18`, `src/data/students.ts:27`
**Issue:** On GitHub Pages (https) this is fine. When the dev server is opened from the iPhone over `http://<lan-ip>:5173`, `crypto.randomUUID` is undefined and every create fails with "Your phone may be low on storage" (see WR-04).
**Fix:** Document "use https or `localhost` for on-device dev", or add a small fallback id generator.

### IN-02: Archived screen lacks context for same-named records

**File:** `src/ui/Archived.tsx:32-43`
**Issue:** Archived students are listed by name only, with no family. Two archived students with the same first name (siblings or classmates in different families) are indistinguishable, and so are two same-named archived families. This compounds CR-01.
**Fix:** Show the family name as secondary text on each student row.

### IN-03: Deploy workflow cancels in-flight Pages deployments

**File:** `.github/workflows/deploy.yml:9-11`
**Issue:** `concurrency: { group: pages, cancel-in-progress: true }` can cancel a running deploy when two pushes land close together. GitHub's Pages guidance uses `cancel-in-progress: false` so the latest queued run still completes. The window is small, but a cancelled `deploy` job after a successful `build` can leave the site on the previous build.
**Fix:** Set `cancel-in-progress: false`.

### IN-04: Minor robustness nits

**File:** `src/pwa/storage.ts:47-49`, `src/pwa/useAppUpdate.ts:18-20`, `src/ui/StudentSheet.tsx:132-133`
**Issue:**
- `formatBytes(999_999)` renders "1,000 kB" because the unit threshold is checked before rounding.
- The `visibilitychange` listener added in `onRegisteredSW` is never removed, so it duplicates on dev HMR.
- `FamilyPicker` can be opened before the live query has loaded (`active` is `[]` while `data` is undefined), so it opens and immediately closes itself via the empty-list effect, which flashes.
**Fix:** Pick the unit from the rounded value. Store and remove the listener, or guard with a module flag. Disable the Family row until `data !== undefined`.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
