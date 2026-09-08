# Product Brief: Lumen Garden

Lumen Garden is a private, offline-first workspace for turning scattered thoughts into concrete next actions and recorded outcomes. People may work themselves or intentionally export selected context to an assistant.

## Core objects
- **Seed**: a captured fragment with text, optional note, next action, energy, tags, and status.
- **Bed**: a project/theme that groups seeds and has an intent, color, and health.
- **Thread**: an explicit relationship between two seeds.
- **Focus session**: a short commitment to advance one seed.

## Primary experience
The default interface is a calm, minimal home screen: “What do you want to move forward?” One capture field opens a focused idea detail. Optional context, editing and assistant handoff use progressive disclosure.

## Core flows
1. Capture from the home field; optional context expands on request.
2. Open one idea with its context, next action, focus controls and progress together.
3. Work for a short block, pause/resume as needed, then save what changed.
4. Use Search to retrieve all ideas, including archived work, by title, context, next action or tags.
5. Archive completed work, restore from Search, or Undo accepted reversible changes.
6. Export and restore through Settings; validate and preview before confirmed replacement.
7. Access the original projects, connections and filters in Settings → Advanced workspace. These are optional, not prerequisites for capture or focus.

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

## Human and assistant workflow

Capture → edit a next action → organize (optional) → focus or preview an AI handoff → record an outcome → revisit or archive. The constellation is optional. Handoffs are read-only snapshots of one idea; connected titles require explicit opt-in. No automatic agent access, server or provider credential is introduced.
