# Phase 4: Family Summaries & Overview - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-family summaries for a period (SUM-01..08):
- a Turkish plain-text message the user can edit, save and copy;
- a Turkish PDF with a session table, expenses, totals and receipt photos, shared through the iOS share sheet with a download fallback;
- pre-send warnings;
- Mark as Sent, with a "changed since sent" flag.

The instructor's own totals per week and month, by student, family and subject (VIEW-01..02).

Not in this phase: CSV export (VIEW-03), a frozen snapshot of what was sent (SUM-09), and translating the app's own screens.

</domain>

<decisions>
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` §Phase 4: goal, 5 success criteria, device spike (share PDF to Messages and Mail, 30+ receipts, jsPDF memory, pdf-lib swap)
- `.planning/REQUIREMENTS.md`: SUM-01..08, VIEW-01..02 (VIEW-03 and SUM-09 deferred)
- `.planning/PROJECT.md`: hours-only rule, credit rules, Key Decisions
- `./.claude/CLAUDE.md`: stack (jsPDF 4.2.1 recommended, pdf-lib fallback, Web Share API, pitfalls on PDF memory)
- `.planning/phases/02-session-logging-backup/02-CONTEXT.md`: weeks Mon–Sun, the shared hours formatter, credit rules
- `.planning/phases/03-expenses-receipts/03-CONTEXT.md`: D-02 cents, split shares stored explicitly, D-06/D-08 backup v2 contract and 150 MB cap
- `.planning/phases/03-expenses-receipts/03-SECURITY.md`: accepted plaintext-backup risk

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/hours.ts` `formatHours`/`formatMinutes`: the shared formatter, which gains the Turkish variant (D-02).
- `src/domain/session.ts` `creditedMinutes`; `src/domain/dates.ts`: week and month period math (Mon–Sun) from the Sessions tab.
- `src/domain/money.ts` (cents formatting) and `src/domain/expense.ts`: each family's stored shares.
- `src/data/expenses.ts` `getAttachmentBlob`, `loadExpenseDrafts`: receipt Blobs for the PDF.
- `src/pwa/share.ts`: Web Share adapter with download fallback, already used for backup files.
- `src/ui/Sessions.tsx`: Week/Month toggle and ‹ › period navigation, which the summary and personal totals reuse.
- `src/domain/types.ts` `Family.period`: each family's weekly or monthly setting (SUM-01 default).

### Established Patterns
- `src/domain/` is pure and `src/data/` is the only Dexie importer. Use integer minutes and cents, and display rounding only.
- Validate before writing. Backup has a schemaVersion, and old versions must keep restoring.
- No network code. New packages require the package-legitimacy gate (jsPDF is pre-approved by CLAUDE.md).

### Integration Points
- New Dexie tables or meta for sent records, saved messages and the instructor name probably need a Dexie schema version bump, which is new in this phase.
- The backup export, parse and restore paths (`src/domain/backup.ts`, `src/data/backup.ts`) move to v3.
- The tab bar in `src/ui/App.tsx` gets a Summaries tab.

</code_context>

<specifics>
## Specific Ideas
- "Pzt 13 Eki · Yüzme · ders 0,75 saat (0:45), aktivite 0,25 saat (0:15)"
- "Masraflar $18.75 (fişler PDF'te)"
- Subjects in Turkish: Yüzme (swim) and Matematik (math).

</specifics>

<deferred>
## Deferred Ideas
- Translating the app's own screens into Turkish (its own phase if wanted).
- VIEW-03 CSV export; SUM-09 frozen snapshot of what was sent (v2 requirements).

</deferred>
