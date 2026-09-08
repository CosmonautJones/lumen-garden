# Simplified workspace delivery

Baseline: `0cd34556f372b21261c85bf1e0c4300fe57ffef8`.

## Approved direction
One capture field, a short Continue working list, and one idea detail with context, next action, focus and progress. Search and Settings remain secondary. Soft white/graphite with restrained blue, system typography and generous space. No new backend or automated agent execution.

## Implementation
- Default home limits the list to five recent available ideas, keeping active focus first; View all reveals the rest.
- Capture opens the idea directly. Context expands only on request.
- Detail groups edit/handoff, next action, pausable focus, outcome entry and history. A competing focus session disables starting a new one to prevent implicit abandonment.
- Search includes archived work and searches title, context, next action and tags.
- Settings preserves export, validated import preview, replacement confirmation, stale-preview invalidation and original-byte recovery.
- Original App moved to a lazily loaded AdvancedWorkspace with scoped CSS. Projects and relationships remain available, and the original interaction suite still covers them. Only one main landmark is rendered.
- No domain schema changes. Existing v2 data and migration logic are untouched.
- Primary layout includes responsive rules, semantic controls, explicit labels, visible focus, skip link and reduced-motion support. Hosted desktop/mobile visual inspection is a separate deployment check.

## Verification
- Five new interaction tests first failed on missing simple-workspace controls, then passed after implementation.
- Additional reload/resume integration verifies persisted next action, paused focus and outcome restoration.
- Root independently reviewed new surface and requested copy/landmark fixes; applied.
- `npm run lint`: passed without source warnings.
- `npm test -- --run`: 55 tests across six files passed, including all 49 original tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- Browser-local preview was previously blocked by the cloud browser in this workspace; hosted visual/smoke verification remains with publisher after deployment.

## Boundaries
This remains a local idea-to-action workspace. AI handoff is manual and scoped to the selected idea. No sync, autonomous agents or automatic response ingestion is claimed. Legacy technical naming remains in backup data and optional advanced tools for compatibility.
