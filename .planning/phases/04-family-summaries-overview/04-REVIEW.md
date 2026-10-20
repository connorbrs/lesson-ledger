---
phase: 04-family-summaries-overview
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - scripts/check-dist.mjs
  - scripts/make-font-module.mjs
  - vite.config.ts
  - src/data/backup.ts
  - src/data/db.ts
  - src/data/families.ts
  - src/data/instructor.ts
  - src/data/periodRecords.ts
  - src/data/receipts.ts
  - src/data/summary.ts
  - src/data/viewTotals.ts
  - src/domain/backup.ts
  - src/domain/hours.ts
  - src/domain/pdfContent.ts
  - src/domain/periodRecord.ts
  - src/domain/session.ts
  - src/domain/summary.ts
  - src/domain/summaryState.ts
  - src/domain/turkish.ts
  - src/domain/types.ts
  - src/domain/validate.ts
  - src/domain/viewTotals.ts
  - src/pdf/summaryPdf.ts
  - src/pwa/clipboard.ts
  - src/ui/App.tsx
  - src/ui/BackupGroup.tsx
  - src/ui/FamilySummary.tsx
  - src/ui/InstructorSheet.tsx
  - src/ui/MessageGroup.tsx
  - src/ui/PersonalTotals.tsx
  - src/ui/SentGroup.tsx
  - src/ui/Sessions.tsx
  - src/ui/Settings.tsx
  - src/ui/ShareFooter.tsx
  - src/ui/Summaries.tsx
  - src/ui/components.tsx
  - src/ui/useSummaryPdf.ts
findings:
  critical: 1
  warning: 3
  info: 6
  total: 10
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard (fonts under src/pdf/fonts skipped as instructed)
**Files Reviewed:** 37
**Status:** issues_found

## Summary

The billing core holds up. Credited minutes use `ceil(m/2)` (D-17). Period membership is pure `YYYY-MM-DD` string comparison with UTC used only as a calendar, so no time zone can move a day. The message and the PDF both read the one `FamilySummary`, so their totals are identical. Travel never reaches `summary.ts`, `pdfContent.ts` or the message. Backup v3 parsing is strict and whitelisting: ids are charset-checked, `__proto__` is rejected, v1/v2 files must carry neither new field, and the record id is checked to equal `recordId(familyId, periodKey)`. The Dexie v2 upgrade only adds a table, so existing data is untouched. The 761 existing tests pass.

The main defect is in the saved-message and draft flow: it can mark outdated hours as current and silence the "Hours changed" banner (CR-01). The changed-since-sent fingerprint also misses a parent-visible field (WR-01).

## Critical Issues

### CR-01: Message drafts carry no fingerprint, so stale hours can be saved as current and the D-09 banner is lost

**File:** `src/domain/summaryState.ts:89-101`, `src/ui/MessageGroup.tsx:55-68`, `src/ui/App.tsx:60-68`
**Issue:** `messageView` hides the stale banner whenever `draft !== null`. `saveMessage` always stamps the text with the current `summary.fingerprint`. A draft is just `{text, rebuilt}` and survives data edits, because App-level drafts persist across tab switches and period navigation. Two flows silently produce a message with wrong hours that is recorded as up to date:
1. The user edits the generated message (a draft with the old hours exists), goes to Sessions and corrects a duration, then returns. The textarea still shows the old hours and no banner appears. Save Message or Copy then uses the old hours, and the saved record gets the new fingerprint, so the banner can never appear for that text.
2. A saved message is stale and the banner shows. The user changes one character. The banner disappears because `draft !== null`. Save then re-stamps the old-hours text with the current fingerprint, and the staleness warning is gone permanently.

The result is wrong hours in a parent-facing billing message, with the safety net D-09 exists to provide switched off.
**Fix:** Record the fingerprint a draft was written against and compare it to the current one.
```ts
export interface MessageDraft { text: string; rebuilt: boolean; basedOn: string } // fingerprint at edit time
// messageView:
const stale = draft !== null ? draft.basedOn !== fingerprint
  : saved !== null && record!.messageFingerprint !== fingerprint;
```
In `MessageGroup.onInput`, set `basedOn` to the fingerprint of the text being edited: the saved message's `messageFingerprint` if one exists, otherwise `summary.fingerprint`. In `save`, store that same fingerprint unless the draft was rebuilt. Show the banner and Rebuild Message whenever `stale`, regardless of the draft.

## Warnings

### WR-01: Fingerprint omits student names that the PDF prints, so there is no "changed since sent" flag and a stale PDF stays "ready"

**File:** `src/domain/summary.ts:235-255`, `src/ui/useSummaryPdf.ts:18-21`
**Issue:** `fingerprintOf` hashes the family name, sessions (attendee ids only) and expenses. It excludes the student names, yet `sessionRowCells` prints `line.studentNames` in the PDF's Öğrenci column. This has two effects:
- Renaming a student in a sent period does not flag "Changed since sent", although the PDF the parents received now differs.
- `useSummaryPdf` keys its pre-built PDF on `fingerprint`. After a student rename the key is unchanged, so the cached PDF with the old name remains `ready` and Share PDF sends it.

D-18 defines the fingerprint as a content fingerprint of the computed summary.
**Fix:** Add the per-line student names to the canonical array, for example `mine.map(s => attendees of this family -> input.studentNames[a.studentId])`. This needs a `studentNames` parameter on `fingerprintOf`. Alternatively, hash the computed `FamilySummary` lines (`sessions[].studentNames`, descriptions, shares) instead of the raw rows.

### WR-02: Superseded PDF builds are never aborted, so rapid period navigation runs overlapping builds that each load all receipt photos

**File:** `src/ui/useSummaryPdf.ts:23-42`, `src/pdf/summaryPdf.ts:164-194`, `src/domain/pdfContent.ts:33`
**Issue:** The `cancelled` flag only discards the result. `buildSummaryPdf` keeps running and holding memory. Every ‹ › tap or fingerprint change starts a new build immediately, because the PDF is pre-built whenever the summary opens or changes. Several builds can overlap, each reading receipt bytes and having jsPDF hold them (jsPDF converts to binary strings, then to an output Blob). `MAX_PDF_PHOTO_BYTES` is 60 MB per build, so several overlapping builds are a plausible way to get Safari to kill the tab on an older iPhone. This is the memory and object-lifetime risk CLAUDE.md warns about.
**Fix:** Pass an `isCancelled: () => boolean` into `buildSummaryPdf` and check it before each `loadPhoto`, throwing a silent cancellation error. Also chain builds so only one runs at a time, or debounce the effect (about 300 ms). Consider lowering the 60 MB cap until it has been measured on a device.

### WR-03: Every period step unmounts the whole Family Summary screen, replaying the push animation and discarding screen state

**File:** `src/ui/FamilySummary.tsx:30-39`, `src/data/live.ts:13-15`, `src/ui/styles.css:723`
**Issue:** When `anchor` changes, `useLive`'s deps change and it immediately resets `value` to `undefined`. The screen then hits `if (!view) return null`, unmounting `PushLayer`, `ShareFooter` and `MessageGroup`. When data arrives everything remounts: `.push-layer` replays its 300 ms `push-in` slide animation on every ‹ › tap, the nav bar disappears briefly, and local state is lost. That state includes the "Copied"/"Saved" flashes, share outcome captions, and the PDF status, which resets to `preparing`. An open Rebuild or Discard alert can also be dropped.
**Fix:** Keep the previous `view` while the next one loads. Either hold the last non-null view in a ref, or render the shell (`PushLayer`, `NavBar`, period controls) unconditionally and show the body only when `view` is defined.

## Info

### IN-01: A sent mark on a period that later has no sessions is stuck and cannot be cleared

**File:** `src/domain/summary.ts:273-276`, `src/ui/Summaries.tsx:25`
**Issue:** `screenParts` sets `showSent: !empty`. If every session in a sent period is deleted or moved, the Summaries row still shows "Changed since sent" (it uses `sentStatus` on the empty fingerprint). The summary screen hides `SentGroup`, so Mark as Not Sent is unreachable. The orphan record also stays in future backups.
**Fix:** Show `SentGroup` when `record?.sentAt != null` even if the period is empty.

### IN-02: A share outcome caption survives a rebuilt PDF for changed data

**File:** `src/ui/ShareFooter.tsx:28-30`
**Issue:** The comment says a rebuilt PDF for other data starts clean, but the outcome is matched by file name. `pdfFileName` depends only on family and period, so "Downloaded x.pdf" (or a failure caption) persists across a rebuild.
**Fix:** Store the PDF build key or the `File` object in `shared`, and compare that instead of the name.

### IN-03: Characters missing from the Noto subset are likely dropped silently in the PDF

**File:** `src/pdf/summaryPdf.ts:68-72`, `src/domain/validate.ts:21-28`
**Issue:** Family names, student names, expense descriptions and the instructor name accept any Unicode, including emoji, which `codePointLength` explicitly anticipates. The embedded font is a Latin subset. I probed a build with emoji, Cyrillic and CJK text: it does not throw. I did not inspect the rendered glyphs. Text outside the subset will probably vanish or render as empty boxes in the PDF, while the Turkish message keeps it, so the two outputs disagree.
**Fix:** Warn on pre-send (D-16 style) when a name or description has characters outside the font's cmap, or strip or replace them in the PDF.

### IN-04: Three-line receipt captions can touch the next slot's photo

**File:** `src/pdf/summaryPdf.ts:56-58,187-192`
**Issue:** The caption block is `IMAGE_HEIGHT + 4 + 3*13 = 323` pt tall inside a 320 pt slot. A three-line caption on the first photo of a page, paired with a tall portrait photo in the second slot, leaves about 3 pt of overlap or touching.
**Fix:** Make `SLOT_HEIGHT` at least 330. Two slots plus heading still fit above `BOTTOM`.

### IN-05: A $0.00 family share still prints an expenses line

**File:** `src/domain/summary.ts:306-308`, `src/domain/pdfContent.ts:87`
**Issue:** The message and PDF totals add "Masraflar $0.00" whenever `expenses.length > 0`. A tiny split can leave a family with a 0-cent share, since the backup parser allows `cents >= 0`. That produces a line that looks odd to parents, and a "no receipt" warning for an expense the family does not pay for.
**Fix:** Count only expenses with `shareCents > 0` for display and for the no-receipt warning, or document that this is intended.

### IN-06: `check-dist` C15 hard-codes exactly one extra JS chunk

**File:** `scripts/check-dist.mjs:153-154`
**Issue:** Any future lazy chunk (or a Rolldown split of the jsPDF chunk) fails the check with a misleading message. The check is also the only guard that the font and engine chunk stays precached and under 2 MiB.
**Fix:** Identify the PDF chunk by content (`addFileToVFS`) and apply the precache and size checks to it, rather than requiring a chunk count of 1.

---

_Reviewed: 2026-10-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
