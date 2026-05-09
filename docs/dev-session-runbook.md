# Dev Session Runbook

Use this when starting a new development or AI-assisted session.

## First Checks

From the repo root:

```bash
docker compose version
test -f foundry-install/foundryvtt-14.360.zip
test -f .env
```

The zip and `.env` are local-only and ignored by Git. If either is missing, follow the setup instructions in `README.md`.

## Choose A Track

Server-only runtime:

```bash
docker compose up -d
docker compose logs -f foundry
```

Dev/test runtime:

```bash
make dev-restart
# choose explicit test scope:
make test-all
# or a focused subset:
make test-engine
make test-foundry-health
make test-foundry-rules
make test-foundry
```

The dev/test path uses `compose.dev.yml`, auto-launches `pawn16-test`, and runs Playwright inside Docker. It should not require host Node, npm, Chromium, or browser shared libraries.

## Fast Validation Loop

After code changes:

```bash
# choose one explicit target:
make test-foundry-health
# or broader:
make test-all
```

For structured state:

```bash
make state
sed -n '1,220p' test-results/pawn16-state.json
```

For a visual artifact:

```bash
make screenshot
```

Artifacts under `test-results/` are ignored by Git. Prefer the JSON state artifact before inspecting screenshots.

## Source Of Truth

Committed source:

- `compose.yml`
- `compose.dev.yml`
- `Makefile`
- `package.json`
- `package-lock.json`
- `scripts/`
- `tests/`
- `systems/pawn16/`
- `docs/`

Local runtime/generated data:

- `.env`
- `foundry-data/Config/`
- `foundry-data/Data/`
- `foundry-data/Logs/`
- `foundry-install/foundryvtt-14.360.zip`
- `node_modules/`
- `test-results/`

Do not treat Foundry world database files under `foundry-data/Data/worlds/` as source. The source of truth is the committed system code plus idempotent seeding.

## Common Failures

If Foundry logs:

```text
Foundry VTT cannot start in this directory which is already locked by another process.
```

wait a few seconds and check:

```bash
docker compose -f compose.yml -f compose.dev.yml ps
```

The container usually backs off and recovers.

If Playwright cannot find `game.ready`, check whether the browser is stuck on `/join`. Details and selectors are documented in `docs/foundry-v14-playwright-notes.md`.

If tests report a stale board image tile, the seeder should delete any tile flagged `pawn16.kind = board-image` on world load/reset. Run:

```bash
make dev-restart
make test-foundry
```

If pawn state looks wrong, run:

```bash
make state
```

and inspect the `issues` array before looking at screenshots.

## Useful Commands

```bash
make up             # server-only Foundry runtime
make restart        # server-only recreate
make logs           # server-only logs
make dev-up         # dev overlay Foundry runtime
make dev-restart    # dev overlay recreate
make dev-logs       # dev overlay logs
make test-all       # engine + full Foundry suite
make test-engine    # pure movement engine unit tests
make test-foundry-health # health-only Foundry smoke subset
make test-foundry-rules  # rules-only Foundry smoke subset
make test-foundry   # full Foundry Playwright suite
make state          # structured state artifact
make screenshot     # browser screenshot artifact
make dev-shell      # shell inside the Playwright test container
```

## Before Handing Back

Run at least:

```bash
docker compose config --quiet
docker compose -f compose.yml -f compose.dev.yml config --quiet
make test-all
```

Mention if any check could not be run.
