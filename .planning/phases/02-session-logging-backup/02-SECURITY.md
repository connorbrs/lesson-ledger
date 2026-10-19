---
phase: "02"
slug: "session-logging-backup"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User input → IndexedDB | Session form writes (dates, minutes, attendees, credit) | Personal lesson data (on device) |
| Device → backup file (share sheet / Files / download) | Full JSON export leaves the app | Roster, notes, sessions (user-accepted) |
| Backup file → restore | Untrusted file parsed and validated before replace | Any file the user picks |
| npm registry → build | No new packages in Phase 2 | Supply chain |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | createSession / updateSession | medium | mitigate | Validation in domain; active student + active family (CR-03); tests | closed |
| T-02-02 | Tampering | Log double tap | medium | mitigate | Busy ref + disabled button | closed |
| T-02-03 | Tampering | Date / week bucketing | medium | mitigate | Local YYYY-MM-DD, no toISOString; date resolved at save (CR-01) | closed |
| T-02-04 | Repudiation | Credit and hour math | medium | mitigate | Exact half storage; one shared formatter; tests | closed |
| T-02-05 | Information disclosure | Travel minutes | low | mitigate | Travel only in SessionFields | closed |
| T-02-06 | Tampering | Stored text rendering | medium | mitigate | No HTML sinks; validators | closed |
| T-02-07 | Tampering | Accidental session delete | medium | mitigate | Confirm alert, Cancel first/focused | closed |
| T-02-08 | Tampering | Edit/delete race, double submit | medium | mitigate | rw transaction, get before put; busy refs | closed |
| T-02-09 | Tampering | Edit rewrites billing history | low | mitigate | Retained attendees keep family snapshot | closed |
| T-02-10 | Tampering | Restore file content | high | mitigate | Whitelisted rebuild via validators, referential integrity, __proto__ tests | closed |
| T-02-11 | Tampering | Non-atomic restore | high | mitigate | Full parse first, confirm, single rw transaction, rollback test | closed |
| T-02-12 | Denial of service | Oversized / wrong file | medium | mitigate | Size check before read; rejection table tests | closed |
| T-02-13 | Information disclosure | Backup file leaves the phone | medium | accept | User accepted; no network code; encrypted backup is v2 (DATA-05) | closed (accepted) |
| T-02-14 | Tampering | Silent loss of receipt photos | medium | mitigate | Export fails closed if expenses/attachments rows exist | closed |
| T-02-15 | Tampering | Accidental restore overwrite | medium | mitigate | Pick only parses; confirm with date and counts; Cancel first | closed |
| T-02-16 | Tampering | Restored text rendered unsafely | medium | mitigate | Validators on restore; no HTML sinks | closed |
| T-02-SC | Tampering | Package installs | high | mitigate | No new packages (dexie, preact only) | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-13 | Unencrypted backup JSON may leave the phone via the share sheet (Files / iCloud Drive / Mail); user accepted at project start and in Phase 2 context; encryption deferred to v2 | User | 2026-10-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 17 | 17 | 0 | gsd-security-auditor (Haiku, ASVS 1, block_on high) |

Notes: WR-02 (restore clears expenses/attachments) must be fixed before Phase 3 writes receipts; TZ test runs are manual (not wired into npm test).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19
