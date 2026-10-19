# Walking Skeleton — Lesson Ledger

**Phase:** 1
**Generated:** 2026-10-18

## Capability Proven End-to-End

A built, service-worker-precached static app served from the `/lesson-ledger/` base path lets the instructor add a family, see it listed, close and reopen the database (a reload), and still see it — with the same build installable on the iPhone home screen and reachable at a GitHub Pages URL.

Local full-stack run command (no hosting needed): `npm ci && npm run build && npm run preview`, then open `http://localhost:4173/lesson-ledger/`. Automated proof: `npm test && npm run build && node scripts/check-dist.mjs`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Preact 11 + TypeScript, built with Vite 8 (`@preact/preset-vite`), no component library, hand-written CSS with design tokens | About 3 KB runtime, React-compatible hooks, enough for a few screens; UI-SPEC locks hand-written CSS (no library) |
| Data layer | Dexie 4 over IndexedDB, database `lesson-ledger-v1` (D-04), schema version 1 declares all six tables up front: `families`, `students`, `sessions`, `expenses`, `attachments`, `meta` | The phone holds the only copy of the data; defining every table now avoids risky early migrations. Name is unique because all GitHub Pages project sites share one origin |
| Auth | None. Single user, one phone, no accounts, no backend | PROJECT.md constraint: $0, all data stays on the device |
| Offline / PWA | `vite-plugin-pwa` 2 (Workbox precache), `registerType: 'prompt'`, manifest `display: standalone`, iOS `apple-touch-icon` 180x180 | Offline after first load is a hard requirement; prompt-style update so a reload never eats unsaved input |
| Deployment target | GitHub Pages via a GitHub Actions workflow, base path `/lesson-ledger/` (D-03, one-way: the origin is where iOS keeps all data) | Static hosting only, free, no Apple developer account, no 7-day expiry |
| Directory layout | `src/domain` (pure: types, validation, labels, no DOM/Dexie), `src/data` (only Dexie importer: db, repos, live hook), `src/pwa` (standalone, storage, update), `src/ui` (Preact screens), `tests/` (Vitest + fake-indexeddb), `scripts/` (check-dist, icon generation) | Pure core is testable in Node without a browser; one place talks to IndexedDB |

## Stack Touched in Phase 1

- [x] Project scaffold (Vite, TypeScript, Vitest, build script, `.gitignore`) — Plan 01
- [x] Routing — one real screen (People) with a tab shell; no router library, state-driven — Plans 01 and 03
- [x] Database — at least one real read AND one real write (`createFamily` / `listActiveFamilies` against `lesson-ledger-v1`) — Plan 01
- [x] UI — an interactive element wired to the data layer (Add Family form, live list) — Plan 01
- [x] Deployment — local full-stack run command above, plus GitHub Pages workflow and a live URL — Plans 01 and 02

## Out of Scope (Deferred to Later Slices)

- Session logging, lesson/activity/travel minutes, shared-swim credit rules (Phase 2)
- Backup and restore, "last backup N days ago" (Phase 2)
- Expenses, receipt photos, attachment storage use (Phase 3; the `attachments` table exists but stays unused)
- Family summaries (text and PDF), personal overview totals (Phase 4)
- Bulk roster import and "save and add another" (not planned; D-08 says one by one)
- Custom domain, accounts, cloud sync, native iOS app (out of scope for the whole project)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: log a session in seconds (date, subject, students, minutes, shared-swim credit) and export/restore a full backup file
- Phase 3: attach expenses and receipt photos to sessions, split shared expenses between families
- Phase 4: per-family weekly/monthly summaries as pasteable text and PDF with receipts, plus the instructor's own totals
