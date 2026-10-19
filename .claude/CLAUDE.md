<!-- GSD:project-start source:PROJECT.md -->

## Project

**Lesson Log**

A personal iPhone app (installed as a home-screen web app) for a private swim and math instructor to log time spent with students right after each session. It splits each session into lesson time, activity time, and travel time, records activity expenses with receipt photos, and produces per-family hour summaries (a ready-to-paste text plus a PDF with receipts) that the instructor sends to parents, who pay accordingly.

**Core Value:** Logging a session right after it ends takes seconds, and the per-family weekly/monthly summary is correct and ready to send — lesson hours and activity hours separated, expenses and receipts included.

### Constraints

- **Platform**: Progressive Web App added to the iPhone home screen via Safari — free, no 7-day expiry, no Apple developer account
- **Hosting**: Static hosting only (e.g. GitHub Pages) — no backend; all data stays on the phone
- **Storage**: On-device browser storage (IndexedDB) incl. receipt photos — must offer manual backup/export since browser storage is not a guaranteed backup
- **Offline**: Must fully work without network after first load
- **Budget**: $0 ongoing cost

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| TypeScript | 7.0.2 | Type checking and compile-time safety for the data model and PDF code | Latest `typescript` on npm (registry fetch 2026-10-18). TS 7.0 is the native (Go) compiler, released 2026-07-08. Fallback: pin `typescript@^6` (last JS-based release) if an editor plugin or lint tool in your chain has not caught up. | MEDIUM |
| Vite | 8.3.4 | Dev server and production build to a static `dist/` for GitHub Pages | Current major, Rolldown-based (announced 2026-03). Zero-config static output. Needs Node ^20.19.0 or >=22.12.0 on the build machine only; the iPhone never runs it. | MEDIUM |
| Preact | 11.0.1 | UI rendering (JSX, components, hooks) | About 3 KB, React-compatible API, no compile-only magic. Enough for a few screens (students, sessions, summaries). Use with `@preact/preset-vite`. | MEDIUM |
| Dexie | 4.4.6 | IndexedDB wrapper: schema versions, indexed queries (by family, date range), `liveQuery` for reactive UI, native Blob storage | Raw IndexedDB is verbose and callback/event-based. Dexie gives you `where().between()` for period summaries and `liveQuery` to keep the UI in sync without a state library. | MEDIUM |
| jsPDF | 4.2.1 | Generate the per-family summary PDF with pages, text, and JPEG receipt images | Actively maintained (latest publish 2026-03-17). `addImage` accepts JPEG/PNG, `addPage()` handles pagination, and `doc.output('blob')` gives a Blob for `navigator.share`. Keeps the dependency count minimal. | MEDIUM |
| Web Share API (platform) | n/a | Share the PDF (and optionally a backup zip) to Messages / Files | Built into iOS Safari. `navigator.share({ files })` is supported since Safari 15 (Apple release notes: Web Share Level 2 file sharing). Check `navigator.canShare({ files })` first. | MEDIUM (LOW on file-type behavior; see Pitfalls) |
| vite-plugin-pwa | 2.0.0 | Generates the service worker and manifest; precaches the app shell for offline use | Wraps Workbox so you do not hand-write a service worker. Peer range covers Vite ^3 through ^8. Latest is a major release (2.0.0), so skim its changelog before setup. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| fflate | 0.8.3 | Zip creation and extraction for full backup (`data.json` + `receipts/*.jpg`) | Use for backup/restore. Zero dependencies, small, avoids the ~33% size bloat and memory spike of base64-in-JSON on iPhone. | MEDIUM |
| workbox-build | ^7.4.1 | Required peer of vite-plugin-pwa | Install it as a devDependency; the plugin declares it as a peer. | MEDIUM |
| workbox-window | ^7.4.1 | Required peer of vite-plugin-pwa | Install it alongside workbox-build. | MEDIUM |
| @preact/preset-vite | latest at install (not verified) | Vite plugin for Preact JSX and refresh | Required for Preact + Vite. Check its peer range against vite 8 at install time. | LOW (version not verified) |
| jspdf-autotable | 5.0.9 | Table layout plugin for jsPDF | Optional. Add only if the itemized expense table with wrapping/pagination becomes painful to draw by hand. Otherwise skip it. | MEDIUM |
| Browser built-ins (no package) | n/a | `navigator.storage.persist()` / `estimate()`, `navigator.clipboard.writeText()` for the copy-paste summary, `<input type="file" accept="image/*">` for receipts, Canvas for downscaling, `Intl.DateTimeFormat` for dates | Use these instead of adding libraries. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest (version not verified) | Unit tests for period math, split logic (full/half credit, shared expenses), zip round-trip | Optional. Worth it for the money-adjacent math (hour splits, expense splits) even in a small app. |
| GitHub Pages (via Actions or `gh-pages` branch) | Static hosting | Set Vite `base` to the repo path (e.g. `/lesson-log/`). The manifest `start_url`, `scope`, and service worker scope must all match that base. Mismatch is the most common Pages-PWA bug. |
| Safari Web Inspector (Mac) | Debug the installed home-screen app on the phone | Connect the iPhone via USB; inspect IndexedDB, storage estimate, and console. Required for the on-device checks listed below. |

## Installation

# Runtime

# Build and tooling

# Optional

## Architecture-Relevant Decisions

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Preact 11 | Vanilla TypeScript (no framework) | If you want literally zero UI dependencies and the screens stay very simple. Costs more hand-written DOM code. Fine choice; Preact is recommended for the form-heavy screens. |
| Preact 11 | React 19 | If you already know React deeply and want its ecosystem. Heavier (roughly an order of magnitude more runtime code) for no benefit at this scale. |
| Preact 11 | Svelte 5 | If you like its compile-to-vanilla model and are comfortable with a less common stack. Adds a different toolchain surface; no real win for this app. |
| Dexie 4 | idb (~1 KB wrapper) | If you want the thinnest possible promise wrapper and will write your own query helpers. More code for period-summary queries. |
| Dexie 4 | Raw IndexedDB | Only for learning. Verbose, error-prone around versioned upgrades. |
| Dexie 4 | localForage | Key-value only; not a fit for querying sessions by family and date. |
| jsPDF 4.2.1 | pdf-lib 1.17.1 | If jsPDF's layout API fights you or you want lower-level control. Caveat: pdf-lib's last npm publish was 2021-11-06, so it is feature-complete but unmaintained. Use it as the fallback, not the default. |
| jsPDF 4.2.1 | pdfmake | If you want declarative document definitions with tables out of the box. Heavier bundle; more concepts to learn. Reasonable if tables dominate. |
| jsPDF 4.2.1 | react-pdf / @react-pdf/renderer | Only if you already use React. Adds a rendering pipeline you do not need. |
| fflate (zip) | JSZip | If you need broader zip features (encryption, streaming). JSZip is larger and older in API style. |
| fflate (zip) | JSON with base64 images | Acceptable if receipt volume is tiny (a few MB). Zero deps, but base64 inflates size and spikes memory on iOS. Fine as an interim step. |
| vite-plugin-pwa | Hand-written service worker | Only if you need a non-standard caching strategy. Otherwise it is more code to maintain. |
| Vite 8 | esbuild only / no bundler | If you want no build step at all. Loses the simple precache manifest generation that vite-plugin-pwa relies on. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| localStorage / sessionStorage for records or images | Small quota, synchronous API that blocks the UI, string-only (images must be base64). | Dexie (IndexedDB) |
| html2canvas / html2pdf.js (render HTML to PDF) | Rasterizes text into images: blurry, large files, and high canvas memory use that can crash Safari on a phone with many receipts. | jsPDF with real text and JPEG images |
| Capacitor / Cordova / native wrappers | Requires Xcode and an Apple developer account, or weekly re-signing. Explicitly out of scope (PROJECT.md). | Stay PWA |
| Firebase, Supabase, or any cloud backend | Out of scope (single user, no server, $0 budget). | Local IndexedDB plus file export |
| Create React App | Deprecated and unmaintained. | Vite + Preact |
| moment.js | In maintenance mode. Not needed; native `Date` and `Intl` cover this. | Plain `YYYY-MM-DD` strings and small helper functions |
| Cache Storage (Cache API) for user photos | Designed for HTTP responses, not user data. Not queryable and not tied to records. | Store photos as Blobs on the expense record in Dexie |
| `beforeinstallprompt` install flow | Not supported on iOS Safari. (MEDIUM confidence; from platform knowledge.) | A short in-app instruction: Share, then Add to Home Screen |
| Treating Safari storage as permanent without backup | WebKit guidance says home-screen apps have their own usage counter, but user reports of data loss after about 7 days of disuse exist and Apple has not clearly stated the rule. | Mandatory backup/export plus `storage.persist()` |
| Sending summary via automated Messages | Out of scope; the iOS share sheet is the boundary. | Web Share (PDF) and clipboard (text) |

## Stack Patterns by Variant

- Keep one `doc.addImage` per receipt, and downscale receipts before storage (see decision 1).
- Because jsPDF holds the whole document in memory until `output()`, a 30+ page PDF can strain an older iPhone. Generate per family, on demand, not all families at once.
- Add `jspdf-autotable`.
- Because it handles column widths, row wrapping, and page breaks, which are fiddly to draw by hand.
- Swap to pdf-lib 1.17.1 and use `embedJpg` on the same Blobs.
- Because it is the same output and the same storage, so the swap is contained in the PDF module.
- Pin `typescript@^6`.
- Because TS 6.0 is the last JS-based release and behaves the same for this app.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| vite@8.3.4 | vite-plugin-pwa@2.0.0 | Peer range includes ^8.0.0 (verified in npm registry JSON). |
| vite-plugin-pwa@2.0.0 | workbox-build, workbox-window ^7.4.1 | Both are peers and must be installed explicitly (verified). |
| vite@8 | Node ^20.19.0 or >=22.12.0 | Build machine requirement only (verified). |
| @preact/preset-vite (unpinned) | vite@8 | Peer range not verified. Check at install. |
| typescript@7.0.2 | Editor and lint plugins | Native compiler; some plugins using the JS API may lag. Verify or pin to ^6. |
| dexie@4.4.6 | Safari IndexedDB | Blob round-trip on iOS not verified; test on device in phase 1. |
| jspdf@4.2.1 | Older jsPDF examples | Major-version API drift is likely. Do not copy 2.x/3.x snippets without checking. |

## Verify on the iPhone Before Committing to the Design

## Sources

- npm registry JSON, fetched 2026-10-18: `https://registry.npmjs.org/vite/latest`, `.../vite-plugin-pwa/latest`, `.../dexie/latest`, `.../pdf-lib/latest` (publish date from `registry.npmjs.org/-/v1/search?text=pdf-lib`), `.../jspdf/latest` (date via search endpoint), `.../typescript/latest`, `.../preact/latest`, `.../fflate/latest` (versions, peer deps, engines; primary source for all version numbers above)
- Vite 8 announcement, March 2026: `https://vite.dev/blog/announcing-vite8.html` (Rolldown-based, Node requirements via secondary coverage)
- TypeScript 7.0 release coverage, July 2026: `https://devblogs.microsoft.com/typescript/author/bowdenk7` and `https://linuxiac.com/typescript-7-0-rewrites-the-compiler-in-go-for-up-to-12x-faster-builds/` (LOW: secondary reporting)
- Apple, Safari 15 release notes (Web Share Level 2 file sharing): `https://developer.apple.com/documentation/safari-release-notes/safari-15-release-notes.md`
- web.dev, Web Share API (canShare Safari 14, share Safari 12.1): `https://web.dev/articles/web-share`
- MDN, `Navigator.canShare()` (feature limited availability; permission and file-support notes): `https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare`
- WebKit, "Updates to Storage Policy" (origin quotas, Home Screen apps share Safari quotas): `https://webkit.org/?p=14403`
- Apple Developer Forums, "Safari iOS PWA Data Persistence Beyond 7 Days": `https://developer.apple.com/forums/thread/710157` (LOW: community discussion, no official statement)
- Raymond Camden, "Working with the Storage API": `https://raymondcamden.com/2023/08/25/working-with-the-storage-api` (persist() usage)
- WebKit Bugzilla 268037 (Blob storage in IndexedDB regression, Safari 17.x, resolved): `https://bugs.webkit.org/show_bug.cgi?id=268037`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
