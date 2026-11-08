# Lumen Garden — Agent Guide

## Mission
Build an offline-first idea greenhouse where fragments become connected projects and concrete next actions. This is a real local product, not a marketing demo.

## Engineering rules
- React + TypeScript + Vite.
- No backend, accounts, analytics, telemetry, or external data services.
- Persist user data locally with a versioned repository layer.
- Tests precede behavior changes where practical; never delete a meaningful test to make a build pass.
- Run `npm run lint`, `npm test -- --run`, and `npm run build` before each completion.
- Keep domain logic outside presentation components.
- Maintain keyboard accessibility, visible focus, semantic controls, and reduced-motion support.
- Avoid large dependency trees; explain each new runtime dependency in README.
- Commit coherent milestones with conventional commit messages.

## Product invariants
- A user can capture an idea in under five seconds.
- Reloading never loses accepted data.
- Import is validated and cannot silently replace current data.
- All destructive actions are reversible or explicitly confirmed.
- Empty states teach an action rather than decorate the screen.
- Demo data is clearly demo data and removable.

## Visual direction
Primary surface: a playful Garden of selectable idea plants with quick capture and a selected-idea panel. Use warm cream, natural greens, botanical illustrations and readable type. Derive all statuses and evidence from notebook records; examples must remain labeled, and recorded outcomes must never imply independent verification or unattended execution. Keep the minimal Notebook view, Search, Settings, and original Operate/Explore tools under Settings -> Advanced workspace. Preserve keyboard access, mobile layout, and all existing local-data protections.
