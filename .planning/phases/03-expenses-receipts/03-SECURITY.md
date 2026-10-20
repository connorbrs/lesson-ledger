---
phase: "03"
slug: "expenses-receipts"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User input → IndexedDB | Expense amounts, descriptions and split shares written with the session | Money amounts, free text (on device) |
| Picked image file → photo pipeline | Camera or library files are decoded and re-encoded on a canvas | Untrusted image bytes, EXIF metadata |
| Device → backup file | Backup v2 export embeds receipt photos as base64 | Roster, sessions, expenses, receipt photos (user-accepted) |
| Backup file → restore | Untrusted v1 or v2 file parsed and validated before replace | Any file the user picks |
| npm registry → build | No new packages in Phase 3 | Supply chain |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | Money parsing | medium | mitigate | `src/domain/money.ts` parses to integer cents with BigInt, with no parseFloat or toFixed; tests in `tests/money.test.ts` | closed |
| T-03-02 | Tampering | Session and expense write and delete | high | mitigate | One `transaction('rw', …)` over all tables in `src/data/sessions.ts`, and validation runs before any write | closed |
| T-03-03 | Tampering | Per-family shares | medium | mitigate | `resolveSplits` in `src/domain/expense.ts` requires exact sums. The WR-02 fix keeps stored odd-cent splits explicit. | closed |
| T-03-04 | Tampering | Description rendering | low | mitigate | Descriptions render as JSX text only, with no innerHTML or dangerouslySetInnerHTML anywhere in `src` | closed |
| T-03-05 | Tampering | Split share inputs | medium | mitigate | `src/domain/split.ts` parses through `parseAmountToCents` and derives the other share as total minus share | closed |
| T-03-06 | Tampering | Delete confirms | medium | mitigate | `sessionDeleteMessage` and `deleteExpenseMessage` alerts, ref-guarded confirms, and nothing written until the session saves | closed |
| T-03-07 | Denial of service | Photo pipeline memory | medium | mitigate | A 25 MB `MAX_SOURCE_BYTES` cap is checked before decode, and photos are processed one at a time with release in a finally block. The 50 MP guard runs only after decode and is advisory (review WR-04). | closed |
| T-03-08 | Information disclosure | EXIF and GPS in stored receipts | medium | mitigate | Only the canvas re-encode (`toBlob`) is stored and the original file is never stored. EXIF removal was confirmed in the device check. | closed |
| T-03-09 | Denial of service | Object URL leaks | low | mitigate | `src/ui/receiptPhotos.ts` is the only creator of object URLs in the UI, and it calls `revokeObjectURL` on cleanup | closed |
| T-03-10 | Tampering | Non-image file stored as a receipt | high | mitigate | Stored bytes come from the canvas encoder only, and `hasJpegMagic` (FF D8 FF) is checked in `src/domain/photos.ts` | closed |
| T-03-11 | Tampering | Crafted backup entries | high | mitigate | `parseAttachment` checks the mime type, base64 length, character set, JPEG magic bytes, decoded cap and references. The WR-01 fix makes `isId` reject `__proto__` and similar keys. | closed |
| T-03-12 | Denial of service | Oversized backup or photo entry | high | mitigate | A 150,000,000-byte cap is checked before reading the file, and each photo's base64 length is capped before scanning | closed |
| T-03-13 | Tampering | Non-atomic restore (WR-02, Phase 2) | high | mitigate | Photos are decoded before the transaction, and one rw transaction clears and adds every table including expenses and attachments (`src/data/backup.ts`) | closed |
| T-03-14 | Tampering | Export that restore would refuse | high | mitigate | A size pre-check and the too-large alert (`useBackup.ts`, `BackupTooLargeAlert.tsx`), plus a round-trip test | closed |
| T-03-15 | Information disclosure | Plaintext backup leaves the phone | medium | accept | See the Accepted Risks Log. The app has no network code. | closed |
| T-03-16 | Tampering | Silent loss of receipts in a backup | medium | mitigate | Export is real (the fail-closed guard was removed). The byte-level round-trip test is in `tests/backup.test.ts`. | closed |
| T-03-SC | Tampering | Package installs | high | mitigate | `package.json` runtime dependencies are exactly dexie and preact, with no HEIC, image or zip library | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low. Only open threats at or above workflow.security_block_on count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-15 | The backup (now including receipt photos) is a plaintext file the user saves to Files or iCloud. This was accepted in Phase 2 and continued here. Encrypted backup is DATA-05 (v2). | User (discuss-phase 2 and 3) | 2026-10-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 17 | 17 | 0 | Orchestrator: L1 grep verification. The register was written at plan time at ASVS 1, so the auditor was skipped. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19
