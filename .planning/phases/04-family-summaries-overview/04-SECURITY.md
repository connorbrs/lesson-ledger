---
phase: "04"
slug: "family-summaries-overview"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| IndexedDB → parent-facing text and PDF | Summary built from stored sessions and expenses, sent to parents | Hours, family and student names, expense shares |
| User input → periodRecords and meta | Saved message text, sent marks, instructor name | Free text (on device) |
| Backup file → restore | Untrusted v1, v2 or v3 file parsed and validated before replace | Any file the user picks |
| Device → share sheet | PDF and message leave the app under the user's control | Children's names, receipts |
| npm and PyPI → build | jspdf 4.2.1 installed; fonttools used once outside the repo | Supply chain |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | Credit and total arithmetic | high | mitigate | One `buildFamilySummary` model feeds the message and the PDF. `creditedMinutes` uses `Math.ceil` (D-17). | closed |
| T-04-02 | Information disclosure | Other family's data in a shared-swim summary | high | mitigate | The summary keeps only this family's attendees and its own split share | closed |
| T-04-03 | Tampering | Time-zone period boundaries | medium | mitigate | Date math uses UTC as a calendar and `Intl` with `timeZone: 'UTC'`. Tests run under several time zones. | closed |
| T-04-04 | Tampering | Crafted period records or instructor name in a backup | high | mitigate | `parseBackup` validates each record and checks its id against `recordId` before any write | closed |
| T-04-05 | Tampering | Non-atomic restore or a table dropped from the backup | high | mitigate | One rw transaction in `src/data/backup.ts` includes `periodRecords` | closed |
| T-04-06 | Denial of service | Oversize saved message | medium | mitigate | 10,000-code-point cap enforced on save and on restore | closed |
| T-04-07 | Tampering | Stale or orphan records | medium | mitigate | A v1 or v2 restore clears the records. `deleteFamily` cascades to `periodRecords`. | closed |
| T-04-08 | Information disclosure | Messages, sent marks and name in the plaintext backup | low | accept | AR-04-01 | closed |
| T-04-09 | Tampering | Dexie v2 upgrade on an installed phone | high | mitigate | Additive only: version 1 is unchanged and one table is added; covered by a test | closed |
| T-04-10 | Tampering | Changed-since-sent false negative | high | mitigate | `fingerprintOf` covers every parent-visible field, now including student names (review WR-01) | closed |
| T-04-11 | Tampering | User text overwritten without consent (D-09) | high | mitigate | Drafts carry `basedOn` (review CR-01). Rebuild asks for confirmation, and Save never re-stamps stale text. | closed |
| T-04-12 | Tampering | Message text as markup | low | mitigate | Text appears only as a textarea value and plain clipboard text; there is no innerHTML in `src` | closed |
| T-04-13 | Repudiation | Accidental Mark as Sent | low | accept | AR-04-02 | closed |
| T-04-14 | Tampering | PDF text from user strings | low | mitigate | Text is drawn with `doc.text` only; no html, svg or addHTML path | closed |
| T-04-15 | Denial of service | PDF out of memory with many receipts | high | mitigate | Photos are read one at a time under a `MAX_PDF_PHOTO_BYTES` cap, and builds run one at a time via `createSerialRunner` (review WR-02). Device measurement is pending (04-UAT test 9). | closed |
| T-04-16 | Tampering | PDF silently omits a receipt | high | mitigate | Any failed or non-JPEG photo rejects the whole build with `photo-unreadable` | closed |
| T-04-17 | Tampering | Supply chain (jspdf, font, fonttools) | high | mitigate | The user approved the gate results in chat on 2026-10-19. jspdf is pinned exactly at 4.2.1; runtime dependencies are dexie, jspdf and preact; fonttools ran in a throwaway venv that was then deleted. | closed |
| T-04-18 | Denial of service | PDF unusable offline | medium | mitigate | The font lives in a TS module inside the precached lazy chunk; dist check C15 enforces this | closed |
| T-04-19 | Information disclosure | PDF shared outside the app | low | accept | AR-04-03 | closed |
| T-04-20 | Tampering | Stale pre-built PDF shared | high | mitigate | `pdfBuildKey` includes the fingerprint, so a newer build cancels an older one | closed |
| T-04-21 | Tampering | Odd or overlong instructor name | low | mitigate | `validateInstructorName` caps it at 60 code points after NFC normalization | closed |
| T-04-22 | Tampering | jsPDF optional libraries shipped | medium | mitigate | `vite.config.ts` marks canvg, dompurify and html2canvas as external; check-dist C15 enforces this | closed |
| T-04-23 | Tampering | Personal totals mixing credited and actual time | medium | mitigate | One pure `computeViewTotals`, covered by tests | closed |
| T-04-24 | Information disclosure | Travel in parent output | high | mitigate | Only the personal totals read travel; regression tests assert it is absent from the message and the PDF | closed |
| T-04-25 | Denial of service | PDF memory on older phones | medium | mitigate | Same controls as T-04-15. Device measurement is pending (04-UAT test 9). | closed |
| T-04-SC | Tampering | Package installs | high | mitigate | See T-04-17. `jspdf-autotable` is not installed. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-08 | Plaintext backup, as accepted since Phase 2 (T-03-15). There is no network code. | User | 2026-10-19 |
| AR-04-02 | T-04-13 | Mark as Not Sent undoes a mark without a confirm, Copy and Share never mark, and the timestamp is shown | User (D-14) | 2026-10-19 |
| AR-04-03 | T-04-19 | The user starts every share and chooses the recipient in the iOS share sheet | User | 2026-10-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 26 | 26 | 0 | Orchestrator: L1 grep verification. The register was written at plan time at ASVS 1, so the auditor was skipped. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19 (device measurements for T-04-15/25 pending in 04-UAT.md)
