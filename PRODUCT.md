# Product Brief: Lumen Garden

Lumen Garden is a private, offline-first workspace for turning scattered thoughts into living projects.

## Core objects
- **Seed**: a captured fragment with text, optional note, energy, tags, and status.
- **Bed**: a project/theme that groups seeds and has an intent, color, and health.
- **Thread**: an explicit relationship between two seeds.
- **Focus session**: a short commitment to advance one seed.

## Core flows
1. Capture a seed instantly from any screen (`C` or global capture control).
2. Triage inbox seeds into a bed, archive them, or promote one to focus.
3. Explore a constellation of seeds and their threads; select without losing spatial context.
4. Enter Focus mode, choose a duration, write a concrete outcome, and complete or pause.
5. Review the garden by bed, status, tag, and recency.
6. Export all data as JSON and import only after schema validation and a preview.

## Required product qualities
- Offline and local-only.
- Installable PWA if practical.
- Responsive from 360px to large desktop.
- Full keyboard path for primary workflows.
- Accessible labels, focus order, contrast, and reduced motion.
- Versioned persistence with safe migration.
- Undo for archive/delete-like actions.
- Useful seeded demo on first launch, removable in one action.
- No fabricated productivity scoring. Any summaries must derive visibly from stored objects.

## Acceptance checks
- Build and lint pass.
- Domain and persistence tests cover edge cases.
- Primary flows work in a real browser.
- No console errors on initial load and major interactions.
- README contains setup, architecture, keyboard map, data/privacy statement, and limitations.
