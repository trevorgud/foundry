# AGENTS

Guidance for AI agents working in this repo.

## Start Here

Read these first:

- `README.md` for setup and user-facing commands
- `docs/dev-session-runbook.md` for the session checklist
- `docs/pawn16-architecture.md` for system architecture
- `docs/foundry-v14-playwright-notes.md` for Foundry v14 and Playwright details

## Repo Purpose

This repo runs Foundry VTT in Docker and contains a tiny custom Foundry system named Pawn16.

There are two tracks:

- Server-only runtime: `docker compose up -d`
- Dev/test runtime: `make dev-restart` plus an explicit test target such as `make test-all` or `make test-foundry-health`

Keep those tracks separate. Do not add test-only services or browser tooling to the base `compose.yml`; use `compose.dev.yml`.

## Source Boundaries

Source files you may normally edit:

- `compose.yml`
- `compose.dev.yml`
- `Makefile`
- `.env.example`
- `README.md`
- `docs/`
- `scripts/`
- `tests/`
- `systems/pawn16/`
- `package.json`
- `package-lock.json`

Local/generated files to avoid editing as source:

- `.env`
- `foundry-data/Config/`
- `foundry-data/Data/`
- `foundry-data/Logs/`
- `foundry-install/`
- `node_modules/`
- `test-results/`

Do not commit or rely on Foundry LevelDB world data as source of truth. Use committed system code and idempotent seeding.

## Development Loop

After changing system, test, or compose code:

```bash
docker compose config --quiet
docker compose -f compose.yml -f compose.dev.yml config --quiet
make test-all
```

For state details:

```bash
make state
```

For a visual artifact:

```bash
make screenshot
```

Prefer structured JSON from `test-results/pawn16-state.json` before inspecting screenshots.

## Foundry Control

The dev overlay sets:

```text
FOUNDRY_WORLD=pawn16-test
FOUNDRY_URL=http://foundry:30000
```

Playwright logs in through `/join` as `Gamemaster` with a blank world-user password, then calls in-browser helpers through `page.evaluate()`.

Use the `game.pawn16` API for automation:

```js
game.pawn16.resetBoard()
game.pawn16.testState()
game.pawn16.assertHealthy()
game.pawn16.unpause()
```

Do not scrape canvas pixels or screenshots unless the structured state is insufficient.

## Implementation Notes

- Pawn16 uses Foundry's native grid, not a board image.
- The board scene is `16 * 80 = 1280px` square.
- White pawns start on rank 14.
- Black pawns start on rank 1.
- Tokens are linked to actors and rotation-locked.
- Only GMs seed/reset the board.

## Safety

- Never print `.env`, license data, or Foundry admin key values.
- Do not delete runtime data unless explicitly asked.
- Do not run destructive Git commands.
- If a test requires a browser, use the Dockerized Make targets rather than local Playwright by default.

## Handoff Expectations

Before finalizing work, report:

- files changed
- validation commands run
- whether the chosen explicit test target(s) passed
- any remaining limitation or manual step
