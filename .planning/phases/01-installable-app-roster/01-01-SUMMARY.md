---
phase: 01-installable-app-roster
plan: 01
subsystem: infra
tags: [vite, preact, dexie, indexeddb, pwa, vite-plugin-pwa, vitest, typescript]

requires: []
provides:
  - Exact-pinned Vite 8 + Preact 11 + Dexie 4 + vite-plugin-pwa toolchain with committed lockfile
  - Dexie database lesson-ledger-v1, schema version 1 with six tables and meta schemaVersion=1
  - Family repo (createFamily, listActiveFamilies) and useLive liveQuery hook
  - Base-path-correct (/lesson-ledger/) precached PWA build with Lesson Ledger manifest
  - Opaque 180px and 512px clock-on-teal icons and iOS head tags
  - scripts/check-dist.mjs build-output checks C1 to C11
affects: [01-02, 01-03, 01-04, phase-2, phase-3, phase-4]

plan_head_before: 3300b07cf2b919e49b4bad937db66b76096c1ce9
plan_head_after: 2ca09ff3973023190dc825c5b123b9c902c6f3f2

actuals:
  tokens: 4811
  tasks: 3
  commits: 2

tech-stack:
  added: [preact@11.0.1, dexie@4.4.6, vite@8.3.4, "@preact/preset-vite@2.10.6", typescript@7.0.2, vite-plugin-pwa@2.0.0, workbox-build@7.4.1, workbox-window@7.4.1, vitest@5.0.5, fake-indexeddb@6.2.6]
  patterns:
    - "src/data/db.ts is the only Dexie importer; repos in src/data, pure types in src/domain"
    - "Schema version 1 is frozen after the first real save; changes go in version(2)"
    - "check-dist.mjs is an append-only list of [id, description, fn] checks"

key-files:
  created:
    - package.json
    - package-lock.json
    - .gitignore
    - tsconfig.json
    - vite.config.ts
    - index.html
    - src/main.tsx
    - src/domain/types.ts
    - src/data/db.ts
    - src/data/families.ts
    - src/data/live.ts
    - src/ui/App.tsx
    - tests/tracer.test.ts
    - scripts/check-dist.mjs
    - scripts/generate-icons.mjs
    - assets/icon.svg
    - public/apple-touch-icon.png
    - public/icons/icon-512.png
  modified: []

key-decisions:
  - "typescript 7.0.2 works with tsc --noEmit on this project; no fallback to 6.x was needed"
  - "apple-touch-icon href written in root form; Vite rewrites it to /lesson-ledger/apple-touch-icon.png (RESEARCH A3 confirmed), so no %BASE_URL% form needed"
  - "injectRegister left at its default (auto); the build emits dist/registerSW.js and the plan's C4 check accepts it"

requirements-completed: [APP-01, APP-02, APP-03, FAM-01]

coverage:
  - id: D1
    description: "A family added through data layer is stored in lesson-ledger-v1, listed, and still listed after close and reopen"
    requirement: FAM-01
    verification:
      - kind: unit
        ref: "tests/tracer.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production build is base-path-correct, precached, static-only, with Lesson Ledger name and iOS head tags"
    requirement: APP-02
    verification:
      - kind: other
        ref: "npm run build && node scripts/check-dist.mjs (C1 to C11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clock-on-teal icon looks right on the iPhone home screen and the app launches full-screen and works in airplane mode"
    requirement: APP-01
    verification: []
    human_judgment: true
    rationale: "iOS home-screen icon rendering and offline relaunch can only be confirmed on a real iPhone (Plan 02 Task 4)"

duration: 14min
completed: 2026-10-18
status: complete
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Vite 8 + Preact 11 + Dexie 4 PWA served from /lesson-ledger/, with one real add-family path persisted in IndexedDB `lesson-ledger-v1`, a precached Lesson Ledger build, opaque clock icons, iOS head tags, and an 11-check build verifier.**

## Accomplishments

- Task 1 (package-legitimacy gate) was approved by the user for all ten packages exactly as pinned; both installs ran only after that approval, with `--save-exact` and a committed `package-lock.json`.
- Tracer path through every layer: `App.tsx` Add Family button, `createFamily` (trim, reject blank with `name-empty`, `crypto.randomUUID`), Dexie `db.families`, `listActiveFamilies` (archivedAt filtered in memory), `useLive` (liveQuery, unsubscribe on cleanup, error rethrown at render).
- Dexie schema v1 declares families, students, sessions, expenses, attachments, meta; `populate` writes `meta.schemaVersion = 1`. `Student` carries `defaultSubject` and `notes`.
- Vitest tracer test with fake-indexeddb, synthetic names only: 4 tests (schema and meta, create and list, blank rejected, survives close and reopen) all pass.
- Build: manifest name and short_name Lesson Ledger, start_url and scope `/lesson-ledger/`, `sw.js` precaches index.html and both icons (9 entries).
- Icons rasterized by a dependency-free Node script (zlib plus manual CRC32, 4x4 supersampling) to opaque 8-bit RGB PNGs; visually checked the 512px output.
- `check-dist.mjs` covers C1 to C11 (base path, manifest, service worker, registration, no external URLs, old-name absence, DB name in bundle, icon PNG headers, precached icons, iOS meta tags). A mutated dist confirmed C11 fails when it should.

## Task Commits

1. Task 1: package-legitimacy checkpoint - approved by user, no commit
2. Task 2 (tracer): `169628b` feat(01-01): walking skeleton tracer
3. Task 3: `2ca09ff` feat(01-01): install identity (icons, head tags, C8-C11)

Tracer feedback gate: no blocking-human gate and auto mode off; `<verify>` was automated-only, so it was re-run end to end (test, build, check-dist) and passed before Task 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Protected-branch commit guard on `main`**
- **Found during:** Task 2 commit preparation
- **Issue:** The pre-commit HEAD assertion (#2924, #3819) classifies `main` as protected (`git.base-branch --is-protected main` returned true; `git.allow_default_branch_commits` is not set). The dispatch said branching_strategy none and the tree was on `main`.
- **Fix:** Did not override the guard or edit config. Re-homed with `git checkout -b gsd/phase-1-installable-app-roster` (the phase_branch_template from config) from the same HEAD and committed there. `main` is untouched at `3300b07` plus the uncommitted planning edits that were already in the working tree. The orchestrator or user can merge the branch into `main` or set `git.allow_default_branch_commits: true` for later plans.
- **Files modified:** none
- **Commit:** n/a

No other deviations: the plugin option names (`registerType`, `injectRegister`, `includeAssets`, `workbox.globPatterns`) in vite-plugin-pwa 2.0.0 matched the plan, and `EntityTable` exists in dexie 4.4.6.

## Issues Encountered

- `npm install` printed a deprecation warning for the transitive `glob@11.1.0` (pulled in via the workbox toolchain). It is not one of the ten approved packages and `npm audit` reports 0 vulnerabilities. Left as is; noted for later.

## Authentication Gates

None. Task 1 was a human-verify package-legitimacy gate that the user approved.

## Known Stubs

None. `sessions`, `expenses` and `attachments` tables are intentionally empty until Phases 2 and 3 (documented in SKELETON.md). `App.tsx` is an intentional tracer surface that Plan 03 replaces.

## Threat Flags

None. No new network endpoints, auth paths or trust-boundary file access beyond the plan's threat model; no external URLs in index.html or the manifest (C5), and no raw-HTML props in App.tsx.

## Verification

- `npm test` : 4/4 pass
- `npm run build` : tsc clean (TypeScript 7.0.2), Vite build OK, PWA 9 precache entries
- `node scripts/check-dist.mjs` : `check-dist: OK (11 checks)`
- Ten packages, no `^` or `~` ranges; `package-lock.json` tracked
- `grep dangerouslySetInnerHTML src/ui/App.tsx`: no match

Not verified here (needs the iPhone, Plan 02 Task 4): home-screen icon appearance, full-screen launch, airplane-mode relaunch.

## Self-Check: PASSED

- All 18 listed files exist; commits `169628b` and `2ca09ff` are ancestors of HEAD.
