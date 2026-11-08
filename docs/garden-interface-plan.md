# Garden interface implementation plan

Goal: Make the approved playful garden the main Lumen Garden experience while preserving the existing local notebook.
Architecture: Add a presentational garden view over the existing repository and schema. Keep notebook, search, recovery, import/export, AI handoffs, focus sessions and advanced workspace intact.
Source: CosmonautJones/lumen-garden at be60ae908173e2b93fda9cf2abd562c166e0805c, materialized through the connected GitHub reader; 43 original files verified by Git blob hash. Isolated source snapshot, not a Git clone.

Owned files: src/GardenWorkspace.tsx, src/GardenWorkspace.css, src/GardenWorkspace.test.tsx, src/domain/growth.ts, src/domain/growth.test.ts, and narrow App.tsx / SimpleWorkspace.test.tsx integration plus README documentation.
Implementation boundaries: No TravOS changes or deployment during the implementation phase; no external services, new dependencies, data-schema changes, or automatic work. The current user-approved botanical design supersedes the old notebook-only visual direction, but the notebook remains available.

- [x] Write failing integration tests for garden selection, real recorded outcomes, explicit examples, capture failures, archives and paused sessions.
- [x] Add tested growth derivation from notebook records: Seed, Growing, In focus, Paused, Progress recorded. Completed work is never labeled verified.
- [x] Add accessible plant buttons, responsive illustrated garden, selected-idea evidence panel, local capture and Notebook navigation.
- [x] Verify all existing notebook and advanced flows with tests, type-check and production build.
- [x] Inspect desktop and narrow mobile renderings and keyboard interaction; obtain independent read-only review.
- [x] Document actual dependency versions and any blocked verification. Provide local runnable instructions. Publication is a separate, explicitly authorized step.

Review focus: long titles and many ideas; empty/archived-only gardens; interrupted focus; failed storage writes; demo data never mistaken for actual accomplishment. Tests cover each or visual QA records the remaining limit.
