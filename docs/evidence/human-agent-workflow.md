# Human and assistant workflow delivery

Baseline: 03b148bca54ebbba09e9cf60e46dc3e92eabfe75.

## Scope

- Durable, undoable idea editing with a concrete next action; schema v2 preserves v1/v0 input paths.
- Read-only selected-idea handoff, text preview/copy and JSON download; connected titles opt-in.
- Search across titles, notes, next actions and tags.
- Next action visible in Focus; completed outcome history; archive/restore in Review.
- Compact help, plain-language purpose and a two-minute README walkthrough.
- No new runtime dependencies, server, credentials, telemetry or agent execution.

## Verification before commit

- Baseline: 41 tests passed.
- New behavior tests first failed for missing editing, v2 migration, handoff module, UI actions and history.
- Final: `npm run lint`, `npm test -- --run` (49 tests), `npm run build`, and `git diff --check` passed.
- Independent review found two UX gaps: Focus hid the next action and archive guidance pointed to Inbox after completion. Both were corrected and covered by a failing-then-passing interaction test.
- The browser could not reach local preview addresses in this execution environment. Hosted browser verification follows deployment; no mobile screenshot or performance certification is claimed here.

## Data contract

Garden schema v2 adds optional `nextAction`. v1 data is validated then normalized to v2. Edits use the existing persist-before-publish transaction and undo checkpoint. Failed writes preserve accepted data and the visible edit draft. Keep an export before reverting to an older app that cannot read schema v2.

`lumen-handoff.v1` is a read-only snapshot, not an import format. It excludes unrelated ideas; connected titles require explicit opt-in. The user reviews and intentionally transfers it to an assistant. AI responses are recorded manually.

## Remaining boundaries

Browser-local storage is not cross-device sync or a collaboration service. Use one editing tab. PWA service-worker caching and direct agent integrations remain outside this bounded release.
