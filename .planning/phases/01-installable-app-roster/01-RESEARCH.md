# Phase 1: Installable App & Roster - Research

**Researched:** 2026-10-18
**Domain:** Greenfield offline-first PWA: Vite 8 + Preact 11 + TypeScript + Dexie 4 + vite-plugin-pwa 2, deployed to GitHub Pages at `/lesson-ledger/`
**Confidence:** MEDIUM. Package versions and PWA/Dexie API shapes are HIGH (registry and docs). iOS runtime behavior (persistence, separate storage from Safari, icon, update in standalone) is unverified until the device spike.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The app is named **Lesson Ledger** (home-screen label, manifest `name`/`short_name`, page title, all UI copy, later summaries/PDFs). Replace every "Lesson Log" in user-facing copy, including `01-UI-SPEC.md` strings (e.g. "Lesson Log couldn't open its storage…", update/Safari banners). Planning docs may keep the old name in history.
- **D-02:** Icon motif: a stylised **clock or ledger book** (time logging), drawn in the teal accent (#00707A) with white, iOS-style rounded square. Claude designs the actual artwork (SVG source → 180×180 apple-touch-icon + manifest sizes).
- **D-03:** URL matches the name: `https://<github-user>.github.io/lesson-ledger/`. Vite `base`, manifest `start_url`/`scope` and service-worker scope = `/lesson-ledger/`. — **Reversibility:** one-way — changing the origin/path after real data exists starts the home-screen app with empty storage (data is per-origin); a backup/restore would be needed to move.
- **D-04:** IndexedDB name uses the new name, e.g. `lesson-ledger-v1` (unique per research pitfall 2: all GitHub Pages project sites share one origin).
- **D-05:** Family = one free-text **name** (exactly what appears on summaries, e.g. "Smith family" or "Anna (Mia's mom)") + reporting period (weekly Mon–Sun / monthly). No separate parent-name field, no phone.
- **D-06:** Student = name + family + **default subject**: Swim, Math, or Both. Phase 2's Log screen uses it to pre-pick the subject (Both → falls back to last-used). Add a Swim/Math/Both segmented control to the Student sheet (extends the UI-SPEC Student sheet; follow its segmented-control spec). — **Reversibility:** costly — field is part of Dexie schema v1 and Phase 2 quick-entry logic.
- **D-07:** Students have an optional **private notes** field (multi-line, free text, e.g. "afraid of deep end"). Never shown on summaries/PDFs. Families have no notes field.
- **D-08:** Starting roster is small (under 10 families). Entry is **one by one** in the app (Add Family → Add Student) as specified in the UI-SPEC. No bulk import, no "save & add another".
- **D-09:** User's iPhone model/iOS version is unknown. Target the **current iOS (assume iOS 18+)**; the Phase 1 device spike records the actual iOS version and `persisted()`/`estimate()` results. UI degrades to "Not supported"/"Unavailable" per UI-SPEC rather than breaking.

### Claude's Discretion
- Icon artwork details within D-02.
- Hosting setup steps (GitHub account/repo creation and Pages deploy are the user's to perform; GitHub CLI `gh` is not installed on this Mac — plan a manual or GitHub Actions deploy with clear user steps).
- Exact notes-field layout in the Student sheet (follow UI-SPEC grouped-row style; multi-line, 17px to avoid iOS zoom).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APP-01 | Add to home screen; opens full screen with own icon | apple-touch-icon 180 PNG + `apple-mobile-web-app-capable` + manifest `display: standalone` (Code Examples 2, 3) |
| APP-02 | Works offline after first load | vite-plugin-pwa precache of build output (Code Example 1); device spike |
| APP-03 | Never expires; no Apple developer account | Static GitHub Pages hosting, no signing (Deploy workflow) |
| APP-04 | Safari-tab warning | `isStandalone()` (Code Example 4) |
| APP-05 | Update prompt, one-tap apply | `registerType: 'prompt'` + `useRegisterSW` from `virtual:pwa-register/preact` (Code Example 1, 5) |
| FAM-01 | Create/edit/archive family | `families` table, `archivedAt`, repo functions (Dexie schema) |
| FAM-02 | Weekly (Mon–Sun) or monthly period | `period` field; copy in UI-SPEC lines 260–263 |
| FAM-03 | Student belongs to one family | `students.familyId`; required on save |
| FAM-04 | Archive keeps history; hard delete only with no history | `hasFamilyHistory` / `studentHasHistory` guards (Architecture Pattern 3) |
| DATA-01 | Request persistent storage on launch; show status and usage in Settings | `ensurePersistence()`, `estimate()` (Code Example 4) |
</phase_requirements>

## Summary

Phase 1 is greenfield. Build a static Vite app with a precached service worker, a manifest, iOS head tags, a Dexie v1 schema that already defines every table (`families`, `students`, `sessions`, `expenses`, `attachments`, `meta`), and two screens (People, Settings) plus sheets. Deploy with a GitHub Actions workflow. The phone is the only copy of the data, so the schema and the DB name are one-way decisions and are fixed in this phase.

The stack from `.planning/research/SUMMARY.md` holds. Versions were re-checked against the npm registry on 2026-10-18 and are pinned below. Five of the ten Phase 1 packages come back `SUS` (reason: `too-new`) from the legitimacy gate. They stay in the plan with a human-verify checkpoint before install.

The CONTEXT decisions change two items from the earlier research: the base path and DB name are `/lesson-ledger/` and `lesson-ledger-v1` (not `lesson-log`). The icon glyph conflicts with the UI spec (see Open Questions).

**Primary recommendation:** Install the exact pins, write `db.ts` with the ARCHITECTURE schema, wrap `virtual:pwa-register/preact` in one hook, run `ensurePersistence()` on mount, deploy `dist/` via the Actions workflow below, then run the device spike before feature work.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Offline app shell (precache) | Browser / service worker | Static host (build output) | Must run with zero network after first load |
| Install metadata (manifest, apple-touch-icon, meta tags) | Static HTML / manifest | — | iOS reads these at Add to Home Screen time |
| Update prompt | Browser (SW lifecycle) | UI | `useRegisterSW` drives the banner state |
| Families/students CRUD, archive | Browser data layer (Dexie) | UI | IndexedDB is the only store |
| Delete guard (has history) | Data layer | Domain | Needs `sessions` table; Phase 2 changes its data, not its API |
| Persistent storage + usage | Browser APIs | Settings UI | `navigator.storage` |
| Build and deploy | CI (GitHub Actions) | Static host | Produces `dist/`; Pages serves it |

## Standard Stack

### Core (pinned)

| Package | Version | Purpose | Provenance |
|---------|---------|---------|------------|
| vite | 8.3.4 | Dev server and static build | [CITED: npm registry, observed 2026-10-18] **WARNING: flagged SUS (too-new). Verify before installing.** |
| preact | 11.0.1 | UI | [CITED: npm registry, observed 2026-10-18] **WARNING: flagged SUS (too-new). Verify before installing.** |
| @preact/preset-vite | 2.10.6 | Preact JSX/prefresh for Vite | [VERIFIED: npm registry] peer `vite: 2.x … 8.x` (present constraint) |
| typescript | 7.0.2 | Types | [VERIFIED: npm registry]. Fallback `6.x` if `tsc` or the editor chain fails in Wave 0 |
| dexie | 4.4.6 | IndexedDB wrapper, `liveQuery` | [VERIFIED: npm registry] |
| vite-plugin-pwa | 2.0.0 | Service worker, manifest, precache | [CITED: npm registry] **WARNING: flagged SUS (too-new). Verify before installing.** Peers: `vite ^3…^8`, `workbox-build ^7.4.1`, `workbox-window ^7.4.1` |
| workbox-build | 7.4.1 | Required peer of vite-plugin-pwa | [VERIFIED: npm registry] |
| workbox-window | 7.4.1 | Required by `virtual:pwa-register` | [VERIFIED: npm registry] (docs: "add `workbox-window` as a `dev` dependency") |

### Dev and test

| Package | Version | Purpose | Provenance |
|---------|---------|---------|------------|
| vitest | 5.0.5 | Unit tests for domain and data | [CITED: npm registry] **WARNING: flagged SUS (too-new).** Peer `vite ^6.4 || ^7 || ^8`; engines `node ^22.12.0 || ^24.0.0 || >=26.0.0` |
| fake-indexeddb | 6.2.6 | IndexedDB in Node tests | [CITED: github.com/dumbmatter/fakeIndexedDB README] **WARNING: flagged SUS (too-new).** Import `fake-indexeddb/auto` |

### Install (exact pins; run in the project root after creating `package.json`)

```bash
npm install --save-exact preact@11.0.1 dexie@4.4.6
npm install --save-exact --save-dev vite@8.3.4 @preact/preset-vite@2.10.6 typescript@7.0.2 vite-plugin-pwa@2.0.0 workbox-build@7.4.1 workbox-window@7.4.1 vitest@5.0.5 fake-indexeddb@6.2.6
```

Scaffold by hand rather than `npm create vite`, so every pin is explicit. Commit `package-lock.json` and use `npm ci` in CI.

**Checkpoint before install:** the five SUS packages (vite, preact, vite-plugin-pwa, vitest, fake-indexeddb) need a `checkpoint:human-verify` task. Their only flag is `too-new`. Their signals are strong: weekly downloads 118.8M (vite), 23.1M (preact), 3.4M (vite-plugin-pwa), 76.6M (vitest), 4.7M (fake-indexeddb). Each repo URL matches its upstream org. No install scripts.

**Node:** the build machine runs Node v24.22.0 (verified this session), which satisfies Vite 8 (`^20.19 || >=22.12`, per project STACK research) and Vitest 5. CI uses `node-version: 24`.

## Package Legitimacy Audit

| Package | Registry | Age (published) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----------------|--------------|-------------|---------|-------------|
| vite | npm | 10 days (2026-10-08) | 118.8M | github.com/vitejs/vite | SUS (too-new) | Flagged, checkpoint:human-verify |
| preact | npm | 10 days (2026-10-08) | 23.1M | github.com/preactjs/preact | SUS (too-new) | Flagged, checkpoint:human-verify |
| @preact/preset-vite | npm | ~3 months (2026-07-18) | 453K | github.com/preactjs/preset-vite | OK | Approved |
| typescript | npm | ~3 months (2026-07-08) | 184.0M | github.com/microsoft/TypeScript | OK | Approved |
| dexie | npm | ~1 month (2026-09-10) | 1.58M | github.com/dexie/Dexie.js | OK | Approved |
| vite-plugin-pwa | npm | 15 days (2026-10-03) | 3.4M | github.com/vite-pwa/vite-plugin-pwa | SUS (too-new) | Flagged, checkpoint:human-verify |
| workbox-window | npm | ~5 months (2026-05-04) | 5.9M | github.com/googlechrome/workbox | OK | Approved |
| workbox-build | npm | ~5 months (2026-05-04) | 5.8M | github.com/googlechrome/workbox | OK | Approved |
| vitest | npm | 3 days (2026-10-15) | 76.6M | github.com/vitest-dev/vitest | SUS (too-new) | Flagged, checkpoint:human-verify |
| fake-indexeddb | npm | 2 days (2026-10-16) | 4.7M | github.com/dumbmatter/fakeIndexedDB | SUS (too-new) | Flagged, checkpoint:human-verify |

**Packages removed due to SLOP verdict:** none.
**Packages flagged SUS:** vite, preact, vite-plugin-pwa, vitest, fake-indexeddb. The planner inserts `checkpoint:human-verify` before each install. No `postinstall` scripts were reported for any package. Step 3 (`npm view <pkg> scripts.postinstall`) was covered by the seam output (`postinstall: null` for all ten).

## Architecture Patterns

### System flow

```
Safari (first visit) ──Add to Home Screen──► home-screen app (standalone)
      │                                            │
      │ shows Safari-tab banner                    │ index.html (meta tags, apple-touch-icon)
      ▼                                            ▼
   (warning only)                       SW precache (offline shell)
                                                   │
                                                   ▼
                              Preact UI: Tab bar (People · Settings)
                              │                          │
                              ▼                          ▼
                    Sheets / Archived          Settings: ensurePersistence(), estimate()
                              │
                              ▼
            data/ repos (Dexie, only Dexie importer) ──► IndexedDB "lesson-ledger-v1"
                              │
                              ▼
                   liveQuery → useLive hook → screens re-render
```

### Recommended project structure

```
src/
├── domain/        # pure: types, validateFamily/validateStudent, periods (no DOM, no Dexie)
├── data/          # db.ts (Dexie v1), families.ts, students.ts, guards.ts, live.ts (only Dexie importer)
├── pwa/           # useAppUpdate.ts (useRegisterSW), storage.ts, standalone.ts
├── ui/            # App.tsx, tabs, People.tsx, Settings.tsx, Archived.tsx, sheets, components
└── main.tsx
public/
├── apple-touch-icon.png   # 180×180, opaque, no transparency
└── icons/icon-512.png     # manifest 512×512
tests/
└── setup.ts               # import 'fake-indexeddb/auto'
```

### Pattern 1: Pure domain core, Dexie only in `data/`

**What:** Validation (`trim`, 1–60 chars, enum checks), `hasHistory` rules and period names live in `domain/` with no imports from Dexie or the DOM. Repos in `data/` are the only code that touches tables.
**When to use:** Always. Makes the FAM-01..04 rules testable in Node without a browser.
**Trade-off:** One extra file per concern. Acceptable at this size.

### Pattern 2: Schema v1 defines every table now

Quoted from the architecture research (`.planning/research/ARCHITECTURE.md` lines 67–74, verified this session):

```ts
db.version(1).stores({
  families:    'id, name',           // Family
  students:    'id, familyId',       // Student
  sessions:    'id, date, subject',  // Session; attendees and familyCredit embedded
  expenses:    'id, sessionId',      // Expense; allocations embedded
  attachments: 'id, expenseId',      // Receipt; Blob stored in the row
  meta:        'key'                 // schemaVersion, lastBackupAt, prefs
});
```

Phase 1 keeps this string. Add these rules:
- Index only fields you query by. Do not index `archivedAt` or `defaultSubject`. IndexedDB valid key types are string, date, float, binary, and array (MDN, verified this session). Booleans and `null` are not valid keys, so `archivedAt` must be filtered in memory. The roster holds under 10 families, so this is cheap.
- Phase 2 can add a `multiEntry` index for embedded attendees in `version(2)` with no v1 change. Never edit a shipped version.
- The `sessions` table stays empty in Phase 1. The `studentHasHistory` guard still scans it, so Phase 2 does not change the guard.

### Pattern 3: Delete guards implemented now

- `hasFamilyHistory(id)`: true if any student (active or archived) has `familyId === id`. Implement with `db.students.where('familyId').equals(id).count() > 0`. Delete is blocked, not cascaded.
- `studentHasHistory(id)`: true if any session has that student as an attendee. Implement as a filter scan over `db.sessions`. It returns false in Phase 1 because the table is empty.
- Both run inside the delete transaction (`rw` on the tables involved) so the check and the delete are atomic.

### Pattern 4: Preact bridge for `liveQuery`

Dexie 4 exports `liveQuery` (verified). Preact has no official Dexie hook, so write one small hook (see Code Examples 6). Always unsubscribe on unmount.

### Anti-Patterns to Avoid

- **Editing `version(1)` after the first real save.** The phone holds the only copy. Add `version(2)` instead.
- **Using `new Date('YYYY-MM-DD')` or `toISOString().slice(0,10)`** for any date. Phase 1 stores `createdAt`/`updatedAt` as epoch ms and displays with `Intl`. Dates in later phases use local `YYYY-MM-DD`.
- **Hard-coding `/lesson-log/`** anywhere. The project `.claude/CLAUDE.md` and `.planning/research/*` still say `lesson-log`. They are superseded by D-03 and D-04.
- **Putting any roster data, names, or notes in the repo** (seed files, fixtures). The Pages site is public, and the phone is the only data store.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker and precache list | Hand-written `sw.js` | vite-plugin-pwa (Workbox) | Precache manifest must match hashed build output |
| Update-available state | Custom `registration.waiting` polling | `useRegisterSW` from `virtual:pwa-register/preact` | Returns `needRefresh` and `updateServiceWorker` |
| Manifest and icon wiring | Hand-written manifest with guessed paths | vite-plugin-pwa `manifest` option | Injects the right link tags and base-prefixed URLs |
| Reactive UI over IndexedDB | Polling or manual refresh | Dexie `liveQuery` + small hook | Re-emits on every committed write |
| IDs | Auto-increment or `uuid` package | `crypto.randomUUID()` | Built in; secure context (HTTPS on Pages) |
| Plural labels ("1 student") | String branches | `Intl.PluralRules` | Locale-correct, already in UI-SPEC |
| Storage size text ("1.2 MB") | Manual math | `Intl.NumberFormat` with unit `megabyte` | Matches UI-SPEC copy |
| Sheets, segmented control, tab bar | Component library | Hand-written CSS with tokens | User chose no library (UI-SPEC); keep bundle small |

**Key insight:** Phase 1's risk is iOS and data-loss behavior, not code complexity. Use the plugins for service-worker and manifest, and spend effort on the device checks.

## Common Pitfalls

### Pitfall 1: Base path mismatch breaks offline boot on Pages
**What goes wrong:** Assets 404 at `/lesson-ledger/` or the SW registers at the wrong scope; the app is blank offline.
**Why:** `base` in Vite, manifest `start_url`/`scope`, and the SW scope must match. The vite-plugin-pwa docs fetched this session do not state whether `scope`/`start_url` default from Vite `base`, so set them explicitly.
**How to avoid:** Set `base: '/lesson-ledger/'`, `start_url` and `scope` to `'/lesson-ledger/'`, and grep the build output (see Validation).
**Warning signs:** `dist/index.html` asset URLs without `/lesson-ledger/`; DevTools shows 404s for `/assets/*`.

### Pitfall 2: Home-screen icon is wrong or has black corners
**What goes wrong:** Add to Home Screen shows a page screenshot or a black-cornered square.
**Why:** iOS uses `<link rel="apple-touch-icon">` (the page's touch icon), not the manifest icons. Transparent pixels render black. iOS applies its own corner mask. [CITED: Apple archive doc for the touch-icon link; transparency and manifest-icon behavior are ASSUMED, see Assumptions A4]
**How to avoid:** Keep `public/apple-touch-icon.png` at 180×180, opaque, full-bleed (no baked-in rounded corners). Test on the device.
**Warning signs:** Icon has a grey or black border on the home screen.

### Pitfall 3: `viewport-fit=cover` missing
**What goes wrong:** `env(safe-area-inset-*)` is 0; the nav bar sits under the notch.
**How to avoid:** Include `viewport-fit=cover` in the viewport meta (UI-SPEC line 155). Verify in standalone portrait at 375 and 430 widths.

### Pitfall 4: Silent update staleness in standalone
**What goes wrong:** The home-screen app keeps an old build, or the banner never appears.
**Why:** Standalone apps do not navigate, so the SW update check rarely runs. Waiting SW activates only after `updateServiceWorker(true)`.
**How to avoid:** `registerType: 'prompt'` (the default per the vite-plugin-pwa prompt guide [CITED]). Optionally call `registration.update()` on `visibilitychange` (Assumption A16). Run the marker-build test from the ROADMAP device spike.

### Pitfall 5: Safari tab and home-screen app share the origin
**What goes wrong:** The Safari warning copy says the data is separate, but it is not.
**Why:** Both share one origin. WebKit says a Home Screen web app "has the same origin quota and overall quota as when it is opened in a browser app" [CITED: webkit.org/blog/14403]. That is a quota statement, not a data-separation statement. Data separation is UI-SPEC assumption 7 and is unverified.
**How to avoid:** The device spike must confirm: add a family in Safari, check the home-screen app, and record the result before shipping the Safari banner copy.

### Pitfall 6: Font under 16px causes iOS zoom
**How to avoid:** Inputs and the notes textarea at 17px (UI-SPEC line 80; CONTEXT Claude's Discretion).

### Pitfall 7: Index on a boolean or null
**What goes wrong:** `where('archivedAt').equals(null)` returns nothing; roster shows archived rows or none.
**How to avoid:** Filter `archivedAt === null` in memory after a plain `toArray()` on the (small) table.

### Pitfall 8: `crypto.randomUUID` is secure-context only
**What goes wrong:** Throws on plain-HTTP hosts (e.g. a LAN IP dev server).
**How to avoid:** Dev on `localhost` (secure) or the Pages HTTPS URL. [CITED: MDN, "available only in secure contexts (HTTPS)"]

### Pitfall 9: liveQuery leak
**What goes wrong:** Multiple subscriptions accumulate as tabs mount and unmount.
**How to avoid:** Return `subscription.unsubscribe()` from the `useEffect` cleanup (Code Example 6).

### Pitfall 10: Name rules applied in the UI only
**How to avoid:** Validate in `domain/` (trim, non-empty, 60 chars) and call it from the repo write function, so tests cover it. The UI shows the copy from UI-SPEC lines 264–265.

## Code Examples

Provenance is per block. Values quoted from in-repo planning files were read this session. Code identifiers are proposed names: [ASSUMED] until they exist in code.

### 1. `vite.config.ts` (base, PWA, tests)

```ts
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/lesson-ledger/',                       // D-03, CONTEXT.md line 19
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',                    // prompt-for-update guide: default behavior
      injectRegister: null,                      // ASSUMED: app registers via virtual module (A1)
      includeAssets: ['apple-touch-icon.png'],   // ASSUMED option name (A13)
      manifest: {
        name: 'Lesson Ledger',                   // D-01, CONTEXT.md line 17
        short_name: 'Lesson Ledger',
        start_url: '/lesson-ledger/',            // D-03
        scope: '/lesson-ledger/',                // D-03
        display: 'standalone',                   // UI-SPEC line 161
        orientation: 'portrait',                 // UI-SPEC line 161
        background_color: '#F2F2F7',             // UI-SPEC line 161
        theme_color: '#F2F2F7',                  // UI-SPEC line 161
        icons: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }], // ASSUMED path resolution (A2)
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'], // ASSUMED: plugin default omits png/svg (A13)
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

`base`, `start_url`, `scope`, `name`, and `short_name` values are verified against the cited lines. `display`, `orientation`, and the two colors match UI-SPEC line 161 verbatim.

### 2. `index.html` head

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Lesson Ledger">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F2F7">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

Viewport, status-bar, and theme-color lines are verbatim from UI-SPEC lines 155–157 and 159–160 [VERIFIED: 01-UI-SPEC.md:155-160]. The title value changes from "Lesson Log" (UI-SPEC line 158) to "Lesson Ledger" per D-01 [VERIFIED: CONTEXT.md:17]. The `apple-mobile-web-app-*` meta names and `apple-touch-icon` link are from the Apple archive doc [CITED: developer.apple.com archive, ConfiguringWebApplications]. The `default` status-bar value is ASSUMED valid (A8). Whether Vite rewrites `/apple-touch-icon.png` to `/lesson-ledger/apple-touch-icon.png` is ASSUMED (A3). Check it in `dist/index.html`.

### 3. Standalone detection

```ts
// src/pwa/standalone.ts
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}
```

`navigator.standalone` is the read-only Boolean property [CITED: Apple archive doc, "Standalone detection"]. `display-mode` is standard (A19).

### 4. Persistent storage and usage

```ts
// src/pwa/storage.ts
export type PersistStatus = 'granted' | 'not-granted' | 'not-supported';

export async function ensurePersistence(): Promise<PersistStatus> {
  const s = navigator.storage;
  if (!s?.persist || !s?.persisted) return 'not-supported';   // UI-SPEC "Not supported"
  try {
    await s.persist();                                         // request; Safari decides by heuristics
    return (await s.persisted()) ? 'granted' : 'not-granted';
  } catch {
    return 'not-granted';
  }
}

export async function readUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e?.usage != null && e.quota != null ? { usage: e.usage, quota: e.quota } : null;
  } catch {
    return null;                                               // UI-SPEC "Unavailable"
  }
}
```

`persist()` resolves to `true` if granted and `false` otherwise, and the browser may or may not honor the request [CITED: MDN StorageManager.persist]. WebKit "currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App" and Safari 17.0 "no longer prompts users" [CITED: webkit.org/blog/14403]. `persisted()` existence is ASSUMED (A18). The 2-second "Checking…" timeout is a UI concern (UI-SPEC line 276).

### 5. Update prompt (Preact)

```ts
// src/pwa/useAppUpdate.ts
import { useRegisterSW } from 'virtual:pwa-register/preact';

export function useAppUpdate() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  return {
    needRefresh,
    notNow: () => setNeedRefresh(false),          // hides until next launch (UI-SPEC line 198)
    apply: () => updateServiceWorker(true),       // reloads; banner copy says save first
  };
}
```

`useRegisterSW` returns `needRefresh: [boolean, setter]`, `offlineReady: [boolean, setter]`, and `updateServiceWorker: (reloadPage?) => Promise<void>` [CITED: vite-pwa-org.netlify.app/frameworks/preact]. Add the plugin's TypeScript declaration for `virtual:pwa-register/preact` in `src/vite-env.d.ts` (the exact reference path is ASSUMED, A1).

### 6. `liveQuery` bridge

```ts
// src/data/live.ts
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

export function useLive<T>(query: () => T | Promise<T>, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: setValue,
      error: (e) => console.error(e),              // UI: switch to the Records error screen
    });
    return () => sub.unsubscribe();
  }, []);
  return value;
}
```

`import { liveQuery } from 'dexie'`, `subscribe({ next, error })`, and `subscription.unsubscribe()` are verbatim from dexie.org [CITED: dexie.org/docs/liveQuery()]. The hook wrapper is ASSUMED pattern. It has `[]` deps, so the query must be stable or passed through a ref. The planner should resolve this in the task.

### 7. Dexie database

```ts
// src/data/db.ts
import Dexie, { type EntityTable } from 'dexie';          // EntityTable: ASSUMED type name (A9)

export interface Family {
  id: string; name: string; period: 'weekly' | 'monthly';
  archivedAt: number | null; createdAt: number; updatedAt: number;
}
export interface Student {
  id: string; familyId: string; name: string;
  defaultSubject: 'swim' | 'math' | 'both';     // D-06
  notes: string;                                 // D-07, never shown on summaries
  archivedAt: number | null; createdAt: number; updatedAt: number;
}

export const db = new Dexie('lesson-ledger-v1') as Dexie & {   // D-04, CONTEXT.md line 20
  families: EntityTable<Family, 'id'>;
  students: EntityTable<Student, 'id'>;
  sessions: EntityTable<unknown, 'id'>;          // typed in Phase 2
  expenses: EntityTable<unknown, 'id'>;          // typed in Phase 3
  attachments: EntityTable<unknown, 'id'>;       // typed in Phase 3
  meta: EntityTable<{ key: string; value: unknown }, 'key'>;
};

db.version(1).stores({
  families: 'id, name',
  students: 'id, familyId',
  sessions: 'id, date, subject',
  expenses: 'id, sessionId',
  attachments: 'id, expenseId',
  meta: 'key',
});
```

The DB name is verbatim from CONTEXT.md line 20 (`lesson-ledger-v1`). The schema string is the ARCHITECTURE block (see Pattern 2). The `Family`/`Student` field names, enum values, and `period` values are proposed identifiers. The UI copy for them is verbatim: "Weekly" and "Monthly" (UI-SPEC line 293), and Swim, Math, and Both (CONTEXT D-06). Rename `families.name` index only if measured: keep it.

Write `{ key: 'schemaVersion', value: 1 }` into `meta` on first open. The backup format (Phase 2) reads it.

### 8. Test setup

```ts
// tests/setup.ts
import 'fake-indexeddb/auto';
```

The README gives this exact import [CITED: github.com/dumbmatter/fakeIndexedDB]. Vitest config is in Code Example 1.

### 9. GitHub Pages deploy (Actions, no `gh` CLI)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4                 # ASSUMED version (A15)
      - uses: actions/setup-node@v4               # ASSUMED version (A15)
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3    # README-verified [CITED: github.com/actions/upload-pages-artifact]
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages                          # [CITED: github.com/actions/deploy-pages]
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4             # [CITED: github.com/actions/deploy-pages, latest major v4]
```

The permissions block (`pages: write`, `id-token: write`) is verbatim from the deploy-pages README [CITED]. Using `upload-pages-artifact@v3` is the README's version. Check the Marketplace for a newer major at install time.

**User steps (cannot be automated here):** create a public repo named `lesson-ledger` under the user's GitHub account; push this project; in Settings → Pages, set Source = "GitHub Actions"; wait for the first deploy; open `https://<github-user>.github.io/lesson-ledger/` in Safari.

## Persistent Storage and iOS Behavior (device spike inputs)

| Question | Status | Source / Action |
|----------|--------|-----------------|
| Does `persist()` return true for a Home Screen app? | Likely (heuristic) | [CITED: webkit.org/blog/14403]. Record the result on device |
| Does Safari prompt the user for persistence? | No (Safari 17.0+) | [CITED: webkit.org/blog/14403]. Record the result on device |
| Are Safari tab and Home Screen data separate? | Unverified | UI-SPEC assumption 7. Device spike |
| Is there a 7-day eviction for Home Screen apps? | Unverified; WebKit blog silent | Device spike over several days; record `estimate()` |
| Does a 2 MB JPEG Blob round-trip through Dexie on iOS? | Unverified | Device spike (WebKit Bug 268037 resolved in 17.x per SUMMARY) |
| Update prompt in standalone | Unverified | Marker deploy; check banner, "Update App", and that the new build loads |

Spike plan (ROADMAP Phase 1): install from the live URL; airplane mode, force-quit, relaunch; read `persisted()` and `estimate()` on several days; write and read back a ~2 MB Blob; deploy a marker build and confirm the banner. Use a temporary `?spike` route that is removed before the phase closes. Record iOS version (D-09) with the results.

## Validation Architecture

> Included per the orchestrator request. Note: `.planning/config.json` sets `workflow.nyquist_validation: false`. Drop this section if that setting holds.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 + fake-indexeddb 6.2.6 |
| Config file | `vite.config.ts` (`test` block); Wave 0 creates `tests/setup.ts` |
| Quick run | `npx vitest run <file>` |
| Full suite | `npm test && npm run build` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|--------------|
| FAM-01 | Family create/edit persists; archive hides from active list, keeps record | unit (fake-idb) | `npx vitest run tests/families.test.ts` | ❌ Wave 0 |
| FAM-02 | Period accepts only `weekly`/`monthly` | unit | `npx vitest run tests/families.test.ts` | ❌ Wave 0 |
| FAM-03 | Student requires `familyId`; archive keeps record | unit | `npx vitest run tests/students.test.ts` | ❌ Wave 0 |
| FAM-04 | Delete blocked when family has any student (active or archived); student with session blocked | unit | `npx vitest run tests/guards.test.ts` | ❌ Wave 0 |
| FAM-01/03 | Name trimmed, non-empty, ≤60 chars; notes saved and not in summary model | unit | `npx vitest run tests/validation.test.ts` | ❌ Wave 0 |
| DATA-01 | `ensurePersistence()` maps granted / not-granted / not-supported; `readUsage()` null on reject | unit (stubbed `navigator.storage`) | `npx vitest run tests/storage.test.ts` | ❌ Wave 0 |
| APP-04 | `isStandalone()` true for `display-mode` or `navigator.standalone` | unit (stubbed `matchMedia`) | `npx vitest run tests/standalone.test.ts` | ❌ Wave 0 |
| APP-02 (build) | Precache lists `index.html` and icons; base prefix present | build check | `npm run build && grep -l "/lesson-ledger/" dist/index.html dist/manifest.webmanifest && grep -c "index.html" dist/sw.js` | ✅ after build |
| APP-01, APP-02 (device), APP-05, DATA-01 (device) | Install, airplane-mode relaunch, update banner, persist/estimate, Blob round trip | manual-only (iPhone) | Device checklist in spike plan | — |
| APP-03 | No backend; no third-party requests | manual | Confirm in Safari Web Inspector Network tab on device | — |

### Sampling Rate

- **Per task commit:** `npx vitest run <changed test file>`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npm test && npm run build` green, plus device checklist (APP-01, APP-02, APP-04, APP-05, DATA-01 device rows) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/setup.ts`: `import 'fake-indexeddb/auto';`
- [ ] Test files listed above (families, students, guards, validation, storage, standalone)
- [ ] `vite.config.ts` `test` block (Code Example 1)
- [ ] `package.json` scripts: `"dev": "vite"`, `"build": "tsc -b && vite build"`, `"test": "vitest run"`, `"preview": "vite preview"`
- [ ] Framework install: see Install commands

## Security Domain

> `security_enforcement` is enabled (absent = enabled). Single-user local app, so most ASVS categories do not apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | No accounts (PROJECT.md: no login) |
| V3 Session Management | no | No server sessions |
| V4 Access Control | no | Single local user; data never leaves the device |
| V5 Input Validation | yes | `domain/` validators: trim, non-empty, ≤60 chars for names; enums for `period` and `defaultSubject` on write |
| V6 Cryptography | no (Phase 1) | IDs only (`crypto.randomUUID`). No encryption at rest; DATA-05 (encrypted backup) is v2 |
| V8 Data Protection | yes | Children's names and private notes sit unencrypted in IndexedDB on one device. Accepted per project constraints; document it |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via family/student names or notes | Tampering | Preact escapes text by default. Never use `dangerouslySetInnerHTML` or `innerHTML` |
| Malicious or hijacked npm package | Tampering | Exact pins, committed lockfile, `npm ci`, human-verify on the five SUS packages |
| Personal data committed to the public repo | Information disclosure | No seed or fixture data with real names or notes; site serves only the shell |
| Third-party script or tracker | Information disclosure | No third-party requests (APP-03 check). GitHub Pages cannot set CSP headers; a `<meta http-equiv="Content-Security-Policy">` is optional (A20) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `injectRegister: null` plus app-side `virtual:pwa-register/preact` (no double registration); TypeScript reference path for the virtual module | Code Examples 1, 5 | Double SW registration or missing types; caught by `npm run build` and dist check |
| A2 | Manifest icon `src` (`icons/icon-512.png`) is resolved and base-prefixed by the plugin | Code Example 1 | Broken manifest icons; check `dist/manifest.webmanifest` |
| A3 | Vite rewrites `/apple-touch-icon.png` in `index.html` to include `/lesson-ledger/` | Code Example 2 | Home-screen icon 404; check `dist/index.html` |
| A4 | iOS ignores manifest icons for Add to Home Screen; transparent pixels render black | Pitfall 2 | Wrong or black icon; device check |
| A5 | Safari tab and Home Screen app keep separate IndexedDB data | Pitfall 5, UI-SPEC assumption 7 | Safari-tab warning copy is wrong; device spike |
| A6 | `persist()` returns true for Home Screen apps | Persistent storage table | Storage status shows "Not granted" most of the time; device spike |
| A7 | No 7-day eviction for Home Screen apps | Persistent storage table | Data loss; backup in Phase 2 covers it; device spike over days |
| A8 | `apple-mobile-web-app-status-bar-style` value `default` is valid | Code Example 2 | Status bar style falls back to default; low |
| A9 | Dexie exports `EntityTable` type and `version().stores()` API | Code Example 7 | `tsc` error; fix at Wave 0 |
| A10 | New students default to `defaultSubject: 'both'` (D-06 is silent on default) | Data model | Phase 2 pre-pick differs; confirm with user (Open Questions) |
| A11 | Notes field has no character cap (D-07 is silent) | Data model | Very long notes; low risk |
| A12 | Three-option segmented control (Swim/Math/Both) keeps UI-SPEC 32px height, 8px radius, 600 selected weight | UI-SPEC line 225 conflict | Visual mismatch; confirm (Open Questions) |
| A13 | vite-plugin-pwa default `globPatterns` omits png/svg; `includeAssets` option name | Code Example 1 | Icons missing from precache; offline icon fails; check `dist/sw.js` |
| A14 | `defineConfig` from `vitest/config` with `test` block in `vite.config.ts` | Code Example 1 | Config type error; fix at Wave 0 |
| A15 | `actions/checkout@v4` and `actions/setup-node@v4` are current majors | Deploy workflow | Minor; Actions warns on deprecated versions |
| A16 | Calling `registration.update()` on `visibilitychange` improves update freshness in standalone | Pitfall 4 | Stale build until next launch; device marker test |
| A17 | TypeScript 7.0.2 works with `@preact/preset-vite`, Vitest, and the editor | Standard Stack | Build failure; pin `typescript@6.x` (fallback per SUMMARY.md) |
| A18 | `navigator.storage.persisted()` exists alongside `persist()` and `estimate()` | Code Example 4 | `ensurePersistence()` returns "not-supported"; device spike |
| A19 | `matchMedia('(display-mode: standalone)')` is the standard query | Code Example 3 | Standalone detection falls back to `navigator.standalone`; low |
| A20 | A `<meta>` CSP is optional on GitHub Pages | Security Domain | None; optional hardening |

**If this table is non-empty:** A1–A3, A5–A7, A12, A16 need confirmation at Wave 0 (build output) or on device. A10–A12 need user confirmation (Open Questions).

## Open Questions (RESOLVED)

> Resolved by the orchestrator 2026-10-18: clock/ledger icon (D-02), 3-segment Swim/Math/Both (D-06), default subject Both and uncapped notes, Lesson Ledger rename (D-01), no VALIDATION.md (nyquist off). Items 4 and 7 are edit lists / user steps, carried into the plans.

1. **Icon glyph conflict (user decision needed).**
   - What we know: UI-SPEC line 162 says "one centered white two-line wave glyph". D-02 (CONTEXT line 18) says "a stylised **clock or ledger book**" in teal with white, "iOS-style rounded square".
   - What's unclear: Which motif to draw.
   - Recommendation: Follow D-02, because CONTEXT records the later user decision for the motif. Update UI-SPEC line 162 to match. Keep the iOS constraint from UI-SPEC: full-bleed, opaque, 180×180 apple-touch-icon, 512×512 manifest icon. iOS applies the rounded mask, so do not bake corners in.

2. **Segmented control has 2 segments in UI-SPEC, but D-06 needs 3 (Swim, Math, Both).**
   - Recommendation: Use three segments with the same 32px height, 8px radius, and 600 selected weight (A12). Confirm with the user.

3. **New student default subject and notes cap** (A10, A11).
   - Recommendation: default `both` (matches "falls back to last-used" in Phase 2); no notes cap. Confirm.

4. **"Lesson Log" copy to rename (D-01).** Planner must rename these UI-SPEC lines: 158 (`apple-mobile-web-app-title`), 161 (manifest name), 248 (records error), 277 (persistent storage footer), 284 (update banner body), 288 (Safari banner body). Not a question, but a required edit list.

5. **Validation section vs config.** `.planning/config.json` has `nyquist_validation: false`, but the orchestrator asked for this section. It is included. Drop it if the config is authoritative.

6. **Stale planning docs.** `.planning/research/STACK.md`, `SUMMARY.md`, and project `.claude/CLAUDE.md` still use `/lesson-log/` and `lesson-log-v1`. Superseded by D-03 and D-04. Planner ignores them for paths and DB name.

7. **User-only steps.** Create the `lesson-ledger` repo, push, and enable Pages with the GitHub Actions source. `gh` is absent (verified), so these are manual.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build, tests | ✓ | v24.22.0 | — (≥22.12 required) |
| npm | Install | ✓ | 11.19.1 | — |
| git | Commit, Actions push | ✓ | 2.50.1 (repo has 1 commit) | — |
| gh CLI | Repo and Pages setup | ✗ | — | Manual GitHub web UI (user step) |
| iPhone (iOS 18+) | Device spike, all iOS rows | Not in this environment | — | Planner must schedule device checkpoints |
| GitHub account + Pages | Hosting | User to create | — | — (blocking for live URL; not for local build) |

**Missing dependencies with no fallback:** iPhone device checks. Plans must include them as explicit checkpoints. Build and unit tests run without a device.
**Missing dependencies with fallback:** `gh` (use web UI).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for pins and peers (registry); MEDIUM for SUS packages (flagged, checkpoint)
- Architecture: HIGH for Dexie and liveQuery API; MEDIUM for plugin option names (A1, A2, A13)
- iOS behavior: LOW until the device spike (A4–A7, A12)
- Pitfalls: MEDIUM (device-specific ones are unverified)

**Sources verified this session:**
- npm registry: `npm view` for all ten packages; peer and engine fields for vite-plugin-pwa, @preact/preset-vite, vitest; `scripts.postinstall` covered by the legitimacy seam
- `gsd-tools query package-legitimacy check` (ecosystem npm), output used in the audit table
- Project files read this session: `01-CONTEXT.md` (lines 16–37), `01-UI-SPEC.md` (full read), `REQUIREMENTS.md`, `STATE.md`, `research/SUMMARY.md`, `ROADMAP.md` (Phase 1, lines 22–36), `research/ARCHITECTURE.md` (lines 66–75), `.claude/CLAUDE.md`, `config.json`

**Research date:** 2026-10-18
**Valid until:** 2026-11-17 for versions (30 days); iOS behavior until the device spike

## Sources

### Primary (HIGH)
- npm registry, observed 2026-10-18: `npm view` for vite, preact, @preact/preset-vite, typescript, dexie, vite-plugin-pwa, workbox-window, workbox-build, vitest, fake-indexeddb
- https://vite-pwa-org.netlify.app/frameworks/preact: `virtual:pwa-register/preact`, `useRegisterSW` signature
- https://vite-pwa-org.netlify.app/guide/prompt-for-update.html: `registerType` default behavior
- https://dexie.org/docs/liveQuery(): `liveQuery` import, `subscribe({next, error})`, `unsubscribe()`
- https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID: secure-context requirement
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist: return value semantics
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_terminology: valid key types
- https://github.com/dumbmatter/fakeIndexedDB: `fake-indexeddb/auto` import
- https://github.com/actions/deploy-pages: `@v4`, permissions, `github-pages` environment
- https://github.com/actions/upload-pages-artifact: `@v3`, path input

### Secondary (MEDIUM)
- https://webkit.org/blog/14403/updates-to-storage-policy/: persist heuristics, Safari 17.0 no prompt, shared origin quota
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html: meta tag names, touch icon link, `navigator.standalone` (archive dated 2016; icon sizes not current)

### Project-internal (not re-verified this session)
- `.planning/research/SUMMARY.md` and `.planning/research/ARCHITECTURE.md`: stack and pattern decisions (ARCHITECTURE schema re-read this session, lines 66–75)

### Tertiary (LOW)
- iOS behaviors listed in Persistent Storage table: unverified until device spike

---
*Phase: 01-installable-app-roster*
*Research complete: 2026-10-18*
