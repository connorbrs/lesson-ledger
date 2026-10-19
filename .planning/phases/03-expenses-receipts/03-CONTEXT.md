# Phase 3: Expenses & Receipts - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Expenses (amount + description) with zero or more receipt photos, attached to a swim or math session. Two-family sessions split each expense between the families (equal by default, overridable, always summing exactly to the total). Expenses and photos can be edited and deleted with no orphans. Receipt photos travel inside the backup and survive a restore. Requirements: EXP-01..EXP-05, plus the receipt half of DATA-02/DATA-03.

Not in this phase: summaries, PDFs and totals per family (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Adding an expense
- **D-01:** An "Expenses" section lives in the shared session form (`SessionFields`), so it appears both on the Log tab (before Save) and in the Edit Session sheet. A session and its expenses and photos save together in one transaction. Leaving the form with unsaved expenses uses the existing unsaved-changes handling.
- **D-02:** Currency is US dollars. Amounts are shown as `$12.50`. Store money as integer cents and never as floats, the same way minutes are integers. One fixed symbol, no currency setting. — **Reversibility:** costly — the cents field shape is in the `expenses` rows and the backup format.
- **D-03:** One expense = amount (required, > $0) + description (required, short text). Its date is the session's date; there is no separate expense date.
- **D-04:** Session rows in the Sessions list gain a small extra line, "Expenses $12.50" (the session's total), shown only when the session has expenses.

### Deleting
- **D-05:** Deleting a session that has expenses deletes everything in one transaction. The confirm alert names what goes, e.g. "This also deletes 2 expenses and 3 receipt photos." Deleting a single expense, or a single photo, also leaves no orphan `attachments` rows.

### Backup with photos
- **D-06:** Keep the single JSON backup file (D-12 from Phase 2). Receipt photos are embedded as base64 in the `attachments` slot under a NEW `schemaVersion` (2). Restore must still accept v1 files. Remove the "fails closed if expenses or attachments exist" export guard and replace it with real export. No zip and no new package. — **Reversibility:** one-way — v2 is a published backup contract that every future restore must keep reading.
- **D-07:** Carried-forward prerequisite (Phase 2 review WR-02). Restore must clear and replace `expenses` and `attachments` in the same transaction as the other tables, and it validates every photo entry (type, size, base64, references) before touching anything.

- **D-08 (2026-10-19, after research):** Raise the backup cap from 50 MB to 150 MB (`MAX_BACKUP_BYTES`). Back Up Now checks the size before sharing and refuses above the cap with clear copy ("This backup is too large to save (over 150 MB)."). Restore memory at that size is a device-spike check. — **Reversibility:** reversible — a constant plus one caption.
- **Research open items, resolved by orchestrator (Claude's discretion):** (OQ2) add a pixel-count guard (for example, over 50 MP) that reuses the "too large" caption; (OQ3) store a small thumbnail Blob (about 240 px) beside each full photo only if the device spike shows grid memory trouble, so the default is the full JPEG through an object URL; (OQ5) a HEIC that cannot be decoded shows the existing "can't read" caption, with no new decoder package; amount cap = Number.isSafeInteger cents (UI "no cap").

### Claude's Discretion
The user did not select these, so they follow the roadmap and requirements:
- **Receipt photos:** one `<input type="file" accept="image/*">` (iOS offers both Camera and Photo Library). Allow multi-select from the library. Downscale and re-encode to JPEG with Canvas (long edge about 1600 px, quality about 0.8; the researcher confirms values). Respect EXIF orientation and handle HEIC from the library. Show thumbnails in a row on the expense; tap opens the full photo; each photo can be removed. Photos are stored as Blobs in `attachments` (indexed by `expenseId`).
- **Shared split UI:** shown only for two-family swim sessions, the same rule as credit (`needsCreditGroups`). The default is equal. The override is typing one family's share, and the other family's share fills in as total − share. With an equal split of an odd number of cents, the extra cent goes to the first family in pick order. Store each family's cents explicitly so the summaries never recompute the split. The shares must sum exactly to the amount.
- Expense entry layout, empty states and copy go to the UI-SPEC (`/gsd-ui-phase 3`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` §Phase 3: the goal, the 5 success criteria and the device spike (camera and library, HEIC, orientation, about 20 receipts' memory)
- `.planning/REQUIREMENTS.md`: EXP-01..05, DATA-02/03
- `.planning/PROJECT.md`: hours-only rule (expenses are the one money field), Key Decisions on the split and on 0..n receipts
- `.planning/phases/02-session-logging-backup/02-CONTEXT.md`: D-09..D-12 (backup contract, validate-then-replace restore)
- `.planning/phases/02-session-logging-backup/02-REVIEW.md`: WR-02 (restore must clear expenses and attachments)
- `.planning/phases/02-session-logging-backup/02-UAT.md`: accepted decisions W1, W-A, W-C
- `.planning/research/` (stack pitfalls: Blob storage in Safari IndexedDB, canvas memory)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/db.ts`: the `expenses` (`id, sessionId`) and `attachments` (`id, expenseId`) tables already exist, typed as `IdRow` placeholders. Adding typed rows may need a Dexie version bump only if the indexes change.
- `src/domain/sessionForm.ts`: `FormState` and `creditFamilies` / `needsCreditGroups` drive which families appear and when the split shows.
- `src/ui/SessionFields.tsx`, `SessionSheet.tsx`, `Log.tsx`: the form shared by Log and Edit, which the Expenses section joins.
- `src/domain/backup.ts` and `src/data/backup.ts`: the v1 validator and export/restore; v2 extends them.
- `src/ui/components.tsx`: Group, Row, SegmentedControl.

### Established Patterns
- `src/domain/` stays pure (no Dexie, no DOM). `src/data/` is the only Dexie importer.
- Use UUIDs, integer units, a single read-write transaction per save, and busy-ref double-tap guards.
- Validation runs fully before any write; restore is all-or-nothing.

### Integration Points
- Session save and delete in `src/data/sessions.ts` gain the expense and attachment writes and the cascade.
- `src/domain/session.ts` `sessionRowText` gains the expenses line (D-04).
- `scripts/check-dist.mjs` stays green.

</code_context>

<specifics>
## Specific Ideas
- The confirm copy on session delete names counts: "This also deletes 2 expenses and 3 receipt photos."
- The row line reads "Expenses $12.50".

</specifics>

<deferred>
## Deferred Ideas
- Zip backup format: possible later under a new schemaVersion if backups grow too large.

</deferred>
