# Lumen Garden: three polish and robustness passes

Pre-publication validation recorded 2026-11-08. These checks cover the source snapshot; deployment status is tracked separately. No real browser notebook, TravOS files, repository visibility, or remote branch was changed.

## Pass 1: usability and accessibility

- Fixed the selected plant resetting when returning from idea details or another view. Capturing or opening an idea also selects its plant.
- Keyboard-only inspect, open, return, and capture passed in Chromium. The page heading receives return focus, then Tab reaches capture.
- Mobile plant selection reveals and focuses its inspector. Capture drafts survive navigation. Existing functional regression tests remain intact.

## Pass 2: visual and responsive polish

- Mobile capture text is now 16px rather than 14px, avoiding the usual small-input focus zoom trigger on iOS. Actual Safari behavior was not tested.
- Navigation and garden controls now meet the chosen 44px minimum target height.
- Darkened low-contrast growth labels, next-step labels, evidence helper text, footer, and empty-inspector guidance. Checked solid-background text meets 4.5:1 or better. This was a targeted check, not a full accessibility certification.
- Browser checks cover 320, 360, 760, 768, 820, 1024, and 1440px widths. Long unbroken titles, context, next steps, and evidence remain readable without horizontal page overflow. Garden, Notebook, Search, Settings, and idea details were exercised.
- Reduced-motion hover behavior passed. Desktop and mobile screenshots were visually inspected; they remain local QA artifacts.

## Pass 3: robustness and persistence

- Accessing localStorage can throw before an app starts. Storage access is now deferred into the repository recovery path, so a blocked getter or failed read opens a useful recovery warning instead of a blank screen.
- If the notebook cannot be read, writes are refused until storage is enabled and the page reloaded. This protects unread existing data even if writes would otherwise succeed.
- Quota failures leave accepted bytes unchanged and capture drafts visible. Retrying after storage recovers saves exactly one idea.
- Invalid imported dates outside JavaScript's supported range are rejected before replacement. Legacy date normalization also avoids unrenderable timestamps.
- Fixed a review-discovered integrity bug: personal ideas assigned to an example project are detached safely when examples are cleared. Personal content, paused focus, and Undo survive; subsequent reloads remain valid.
- Verified paused-session notes and completed evidence across reload, clear-example cancellation/Undo, archive/search/restore, invalid import, replacement confirmation/cancellation/Undo, corrupt-byte recovery export, blank capture, literal HTML text, full backup export, and Advanced workspace access.

## Results

- PASS: 73 tests across 8 files, including new regressions that failed before their fixes.
- PASS: TypeScript project build (`node node_modules/typescript/bin/tsc -b --force`).
- PASS: Vite production build (`node node_modules/vite/bin/vite.js build`).
- PASS: 17 Playwright Chromium scenarios in `scripts/check-polish.cjs`, zero page errors. Machine-readable latest results: `docs/evidence/polish/checks.json`.
- PASS: Existing `scripts/check-garden.cjs` smoke flow, including capture, next-step editing, focus, completed outcome reload, and five mobile-view width checks.
- Independent read-only review found the example-project reference bug and empty-state contrast issue; both have regression coverage and were fixed.

## Limits

The installed local toolchain was reused without downloads: React/ReactDOM 19.2.4, Vitest 4.1.4, Vite 5.4.21, TypeScript 5.9.3, jsdom 24.1.3. These differ from the unchanged lockfile. Plugin/Vite deprecation warnings remain. An exact lockfile install and required oxlint were not available under the existing registry restriction; no network or security workaround was attempted. Run the normal clean-install gates before merging or releasing.

Playwright ran the real production app in fresh isolated Chromium contexts, fulfilling built files locally through request interception. This verifies rendered behavior and browser storage, not an HTTP server, public deployment, real Safari/Firefox, physical touch hardware, or screen-reader behavior. Screenshots were not uploaded. No persistent preview server is claimed.

## Run from the project directory

PowerShell:

```powershell
# From the Lumen Garden project directory
node node_modules/vite/bin/vite.js --host 127.0.0.1
```

Open the URL printed by Vite. Keep the terminal running while using it. Storage belongs to that browser and exact origin; the local preview does not automatically contain a notebook saved on another website or port. Export a backup before deliberately transferring data through preview/confirmed import.

To repeat the locally available checks:

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b --force
node node_modules/vite/bin/vite.js build
$env:PLAYWRIGHT_MODULE='<path-to-installed-@playwright/test>'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='<path-to-installed-Chromium-executable>'
node scripts/check-polish.cjs
node scripts/check-garden.cjs
```

On a normal development machine with registry access, use `npm ci`, `npm run lint`, `npm test -- --run`, and `npm run build`. The browser scripts require an already installed `@playwright/test` and Chromium; supply the two environment variables if installed outside this project. No browser testing dependency was added to the application lockfile.

The source ZIP and sibling patch include all interface work relative to public baseline `be60ae908173e2b93fda9cf2abd562c166e0805c`. No commit, push, publication, or deployment was performed during this validation phase.
