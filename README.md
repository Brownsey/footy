# World Cup 2026 Predictor

A polished, client-side single-page app for predicting the entire **2026 FIFA
World Cup** — the new 48-team, 12-group format. Predict every group match, watch
the knockout bracket populate from your results, pick your champion, and
save/resume your bracket as a file.

> Status: **in active development.** See [task.md](task.md) for the full build
> brief and [`#roadmap`](#roadmap) for what is built so far.

## Why this is not a 32-team bracket

The 2026 tournament changed format: **48 teams in 12 groups of four**. The top
two of each group **plus the eight best third-placed teams** reach a new **Round
of 32**. Which third-placed team lands in which R32 slot follows a fixed FIFA
allocation table — it cannot be improvised. The data model is built around this
reality from the start (see [`src/data/tournament.json`](src/data/tournament.json)).

## Tech stack

- **React 18 + Vite + TypeScript**, client-side only (no backend).
- **Zustand** for a single typed store with derived selectors.
- **Vitest** + Testing Library for unit and component tests.
- **ESLint (flat config, type-checked)** + **Prettier** for quality gates.
- Static seed data (`tournament.json`, `teams.json`) shipped as assets; the
  file round-trip (JSON export/import) is the persistence layer.

## Architecture

Pure logic is isolated from the UI so it can be tested without a browser:

```
src/
  domain/      pure engine — types, group tables, third-place ranking,
               bracket wiring, probability model (no React, no I/O)
  data/        static seed data + typed accessors
  store/       Zustand store + selectors
  components/  presentational + container React components
  test/        test setup
```

The `domain/` layer never imports React or touches the DOM, mirroring the
ports-and-adapters principle from the brief.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run test       # watch-mode unit tests
npm run test:run   # single test run
npm run lint       # eslint
npm run typecheck  # tsc, no emit
npm run build      # type-check + production build
```

Requires Node ≥ 20.

## Roadmap

- [x] Project scaffold, tooling, CI-ready scripts
- [x] Locked tournament draw data (12 groups, playoff slots resolved)
- [x] Group-stage model: fixtures, table computation, ranking
- [ ] Best-third ranking + official R32 allocation table
- [ ] Knockout bracket engine + cascade/invalidation
- [ ] JSON/CSV export + JSON import (schema-versioned)
- [ ] Elo / ranking-delta probability engine + team profiles
- [ ] Match insight UI
- [ ] "Claude Predicts" — 10 prediction sets
- [ ] Guardrails + Easter eggs
- [ ] Visual/UX polish pass

## Data provenance

Tournament facts reflect the Final Draw of 5 December 2025 and the playoff
results of 31 March 2026. Each data file carries a `lastVerified` date; squad
data should be re-verified nearer 2 June 2026.
