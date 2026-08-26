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
Primary surface: **Operate**, secondary: **Explore**. Dense, calm, tactile, keyboard-friendly. Botanical without green-gradient clichés. Use warm paper-black neutrals, mineral teal, pollen gold, and restrained coral. Typography and spacing create hierarchy before boxes. No hero, feature grid, glassmorphism, fake metrics, or icon confetti.
