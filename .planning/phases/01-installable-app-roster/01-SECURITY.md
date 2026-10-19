---
phase: "01"
slug: "installable-app-roster"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-19"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → build | Pinned packages installed via lockfile (`npm ci`) | Third-party code (supply chain) |
| GitHub Actions → GitHub Pages | CI builds and publishes `dist/` | Public static assets only |
| Browser origin (connorbrs.github.io/lesson-ledger) → device | Static app served to the phone | App code; no user data |
| User input → IndexedDB (`lesson-ledger-v1`) | Names, periods, subjects, private notes stored on device | Personal roster data (stays on the phone) |
| Safari tab ↔ home-screen app | Separate storage per container (device-verified) | None (risk of user confusion only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | package.json / lockfile | high | mitigate | Exact pins, integrity-checked lockfile, `npm ci` in CI | closed |
| T-01-02 | Tampering | Family-name rendering (stored XSS) | medium | mitigate | Text nodes only; no HTML sinks anywhere in src | closed |
| T-01-03 | Information disclosure | Real roster data in repo/tests/bundle | medium | mitigate | Synthetic fixtures only; no seed data tracked | closed |
| T-01-04 | Information disclosure | Third-party requests | medium | mitigate | check-dist C5 blocks external URLs; no network calls in src | closed |
| T-01-05 | Denial of service | Wrong base path breaks offline | low | mitigate | base/start_url/scope `/lesson-ledger/`; check-dist C1–C3 | closed |
| T-01-06 | Information disclosure | Public repo exposes code + .planning | medium | accept | User informed; no user data ever committed | closed (accepted) |
| T-01-07 | Elevation of privilege | GitHub Actions workflow | medium | mitigate | Minimal permissions, no secrets, actions/* only | closed |
| T-01-08 | Information disclosure | Temporary device-check page | low | mitigate | Removed; check-dist C14 | closed |
| T-01-09 | Spoofing | Look-alike GitHub address | low | mitigate | Origin confirmed by user and verified live | closed |
| T-01-10 | Tampering | Family/student/notes rendering (stored XSS) | medium | mitigate | JSX text nodes; no user data in href/src | closed |
| T-01-11 | Tampering | Input validation at write path | medium | mitigate | validate.ts (trim, NFC, 60-char cap, enums) on every create/update | closed |
| T-01-12 | Information disclosure | Private notes leaking to other screens | medium | mitigate | `.notes` read only in StudentSheet.tsx | closed |
| T-01-13 | Tampering | Data loss via cascade/races/double submit | medium | mitigate | No cascade; guards inside transactions; busy guards; race test | closed |
| T-01-14 | Denial of service | Very large notes (no cap, D-07) | low | accept | User decision D-07; local quota applies | closed (accepted) |
| T-01-15 | Tampering | Stale/wrong service-worker build | low | mitigate | registerType prompt; foreground update check; Build row | closed |
| T-01-16 | Information disclosure | False storage-protection claim | medium | mitigate | 'granted' only when persisted() is true; honest footer | closed |
| T-01-17 | Denial of service | Update reload losing unsaved input | low | mitigate | Update only via Update App tap; save-first copy | closed |
| T-01-18 | Repudiation | Data entered in Safari tab believed saved | medium | mitigate | Safari-tab banner (device-verified separate storage) | closed |
| T-01-19 | Tampering | Accidental hard delete on Archived screen | medium | mitigate | Confirm alert, Cancel first/focused, transactional guards | closed |
| T-01-20 | Tampering | Double tap / concurrent delete | low | mitigate | Busy ref + disabled button; not-found → failure copy | closed |
| T-01-21 | Tampering | Stored XSS in new rows / alert title | medium | mitigate | Escaped text and aria-label; no notes on Archived | closed |
| T-01-22 | Denial of service | Waiting update activating on cold launch | low | accept | User decision 2026-10-19 (UAT P-d) | closed (accepted) |
| T-01-SC | Tampering | npm package installs (supply chain) | high | mitigate | User-approved legitimacy gate; single install commit; npm ci | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-06 | Free GitHub Pages needs a public repo; code and planning notes are readable, but no roster, notes or receipt data is ever committed | User (Plan 02 Task 2) | 2026-10-18 |
| AR-02 | T-01-14 | Private notes have no length cap (D-07); single user, local IndexedDB quota applies | User (CONTEXT D-07) | 2026-10-18 |
| AR-03 | T-01-22 | After a full force-quit, iOS activates a waiting update on the next cold launch without a tap; nothing is open so no input is lost, and update code touches no data | User (UAT P-d) | 2026-10-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-19 | 23 | 23 | 0 | gsd-security-auditor (ASVS 1, block_on high) |

Non-blocking observations: on-device behaviour of WR-03/WR-05/WR-06 confirmed by the user in UAT (tests 5, 6, 11); IN-03 (`cancel-in-progress: true` in deploy.yml) left as info; workflow-level permissions could optionally move to the deploy job.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-19
