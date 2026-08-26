# Lumen Garden

> An offline-first idea greenhouse for turning fragments into connected projects and deliberate next actions.

Lumen Garden is a local-only React workspace for capturing small ideas, tending them into project beds, connecting related work, and choosing one focused action at a time. It has no accounts, server, telemetry, analytics, or external data services.

## Why it exists

Most idea tools optimize for collecting more. Lumen Garden optimizes for **returning to the useful fragment**: capture it quickly, give it context, connect it to adjacent work, and decide what to do next.

## Product surface

- **Inbox** — capture a seed in seconds, then triage it into a bed, archive it, or start focus.
- **Constellation** — inspect seeds and their explicit relationships without losing context.
- **Focus** — work one calm, interruption-safe block with an outcome, timer, pause/resume, and completion history.
- **Review** — filter the garden by status, bed, tag, and recency.
- **Local data controls** — preview imports before replacement, export JSON, remove demo data, and undo destructive actions.

## Quick start

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

### Quality checks

```bash
npm run lint
npm test -- --run
npm run build
```

The GitHub Actions workflow runs the same checks on every push and pull request to `main`.

## Keyboard map

| Key | Action |
| --- | --- |
| `C` | Move focus to the global capture field |
| `1` | Inbox |
| `2` | Constellation |
| `3` | Focus |
| `4` | Review |
| `?` | Open the command menu |

Keyboard shortcuts stay out of text fields and standard modified shortcuts remain untouched.

## Architecture

```text
src/
  domain/
    model.ts          Core types, normalization, seeded demo data
    repository.ts     Versioned local repository, import/export, undo
    *.test.ts         Persistence and repository behavior tests
  App.tsx             Operate/Explore product surface
  App.css             Responsive visual system and accessibility states
```

The domain repository is intentionally separated from React presentation. It owns persistence, schema validation, migrations, referential integrity, and reversible destructive actions. React subscribes through a stable external-store snapshot so the interface is responsive without leaking mutable state into view logic.

## Data and privacy

- Your garden is stored in browser local storage on the current device.
- Export creates a portable JSON representation of the current garden.
- Import is parsed, schema-validated, previewed, and confirmed before it can replace current data. Unsupported future schema versions, missing collections, duplicate IDs, and dangling references are rejected.
- Removing demo data, archiving, and relationship deletion are deliberate and reversible where supported.
- Clearing browser storage removes the local garden. Export before clearing storage if you need a backup.

## Current limitations

- Data does not sync between browsers or devices by design.
- The constellation currently emphasizes explicit connections and inspection rather than a freeform canvas.
- PWA installation and service-worker offline caching are planned refinements.

## Contributing

Use small, cohesive conventional commits. Keep domain behavior test-covered, preserve keyboard access and reduced-motion support, and run lint, tests, and the production build before pushing.

## License

No license has been selected yet. All rights reserved until one is added.
