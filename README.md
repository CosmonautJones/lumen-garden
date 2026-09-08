# Lumen Garden

A private notebook that turns an idea into one next action, then keeps a record of what you did.

**[Open Lumen Garden](https://cosmonautjones.github.io/lumen-garden/)** · No account · Data stays in your browser

Use it when you have thoughts scattered across notes and chats, but cannot tell what to do next. It is useful for preparing an interview, planning a small project, developing a piece of writing, or collecting research you intend to act on.

## Try a complete workflow in two minutes

1. **Capture:** type “Prepare for a software engineering interview” and press Capture.
2. **Clarify:** choose **Edit idea**, add context, and set **Next action** to “Practice one story about a difficult production bug.” Save.
3. **Organize (optional):** create a project in **Projects (beds)**, then assign the idea to it. Find organized ideas in **Review**; search by title, notes, next action or tag.
4. **Work yourself:** choose **Focus now**, spend a short block on the visible next action, record what changed in **Outcome text**, then Complete. **Recent outcomes** keeps the result.
5. **Or work with an assistant:** choose **AI handoff**, read the preview, and copy it into your preferred assistant. Review its response; record the useful result in your notes or a focus outcome.
6. **Close the loop:** update the next action or Archive from Review when the idea is finished. Restore or Undo if you change your mind.

Completing a focus block records progress; it does not declare the whole idea done. The app does not send a prompt or run an agent for you.

## The garden names, translated

| In the app | Plain meaning |
|---|---|
| Seed / idea | A thought with notes and an optional concrete next action |
| Bed / project | A group of ideas with a shared goal |
| Constellation | An optional map of connections between ideas |
| Focus | A timed block with a recorded outcome |
| Review | Search and revisit ideas, including archived work |
| Energy | Your own 1–5 rating, used by the simple next-idea suggestion |

The first visit contains a clearly labeled example garden. **Clear demo data** removes only the examples after confirmation. You can capture your own idea immediately.

## Working with a bot or AI assistant

**Copy handoff** creates a plain-text request with a JSON snapshot. **Download JSON handoff** creates a machine-readable `lumen-handoff.v1` file.

A handoff includes the selected idea, its next action, its project name/goal and recorded completed outcomes. Connected idea titles are **off by default** and appear only if explicitly selected. It never includes the whole notebook by default. Inspect the preview before sharing it.

This is a read-only handoff, not an API, a task runner, a garden backup, or a format for importing agent changes. The receiving assistant gets no permission to execute commands or alter files from this snapshot. Responses are reviewed and recorded manually. Do not put private context in an assistant prompt unless you intend to share it with that provider.

```json
{
  "schema": "lumen-handoff.v1",
  "idea": {
    "id": "seed-example",
    "title": "Prepare for an interview",
    "context": "Focus on production troubleshooting",
    "nextAction": "Practice one story aloud",
    "status": "inbox",
    "updatedAt": 1788825600000
  },
  "project": null,
  "outcomes": [],
  "connections": []
}
```

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
    constellation.ts  Stable, bounded placement for the visual Explore map
    repository.ts     Versioned local repository, edits, import/export, undo
    handoff.ts        Read-only, selected-idea assistant handoffs
    *.test.ts         Persistence, handoff and repository behavior tests
  components/
    IdeaActions.tsx   Inline editing and handoff preview
  App.tsx             Operate/Explore product surface
  App.css             Responsive visual system and accessibility states
```

The domain repository is intentionally separated from React presentation. It owns persistence, schema validation, migrations, referential integrity, and reversible destructive actions. React subscribes through a stable external-store snapshot so the interface is responsive without leaking mutable state into view logic.

Review keeps prioritization inspectable: active seeds come before inbox seeds; within either state, higher-energy work comes first, then the seed that has waited the longest. The recommendation is a shortcut into a focus block, not a hidden scheduler.

## Data and privacy

- Your garden is stored in browser local storage on the current device. There is no server copy.
- Garden schema v2 adds a next action to ideas. Existing v1 gardens migrate automatically on load; legacy v0 imports remain supported. Older app versions cannot read v2 exports: keep an export before changing versions.
- Editing a title, note or next action is atomic and undoable. A failed storage write keeps the accepted data unchanged and leaves the draft visible.
- Export creates a portable JSON representation of the current garden.
- Local writes are atomic: if browser storage is full or unavailable, the accepted garden and its undo checkpoint remain unchanged and the interface keeps the failed capture visible.
- If saved data is malformed, Lumen Garden does not overwrite it blindly. The original bytes are retained as a recovery copy that can be exported before a new garden is saved.
- Import is parsed, schema-validated, previewed, and confirmed before it can replace current data. Editing the JSON withdraws its preview, and unsupported future schema versions, missing collections, duplicate IDs, invalid values, and dangling or duplicate thread references are rejected.
- Removing demo data, archiving, and relationship deletion are deliberate and reversible where supported.
- Clearing browser storage removes the local garden. Export before clearing storage if you need a backup.

## Current limitations

- Data does not sync between browsers or devices by design. Multiple simultaneous tabs are not a collaboration system; use one editing tab.
- AI handoffs are manual exports. There is no background bot access or automatic import of AI responses.
- The constellation currently emphasizes explicit connections and inspection rather than a freeform canvas.
- PWA installation and service-worker offline caching are planned refinements.

## Contributing

Use small, cohesive conventional commits. Keep domain behavior test-covered, preserve keyboard access and reduced-motion support, and run lint, tests, and the production build before pushing.

## License

MIT. See [LICENSE](LICENSE).
