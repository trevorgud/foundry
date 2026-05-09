# Foundry VTT Docker Server

Minimal Docker Compose setup for running Foundry Virtual Tabletop with a manually supplied Node.js distribution zip.

## Prerequisites

- Docker with Docker Compose support
- A Foundry VTT license
- Access to your Foundry account downloads

## Repository Layout

```text
.
├── compose.yml
├── foundry-data/       # local Foundry user data, ignored by Git
├── foundry-install/    # local Foundry zip cache, ignored by Git
└── systems/
    └── pawn16/         # committed test system source
```

The directories are committed with README files, but their private/runtime contents are ignored.

## Setup From Scratch

1. Download the Foundry **Node.js** distribution zip from your Foundry account.

2. Place it in `foundry-install/` using the cache filename expected by the pinned Docker image:

   ```text
   foundry-install/foundryvtt-14.360.zip
   ```

3. Optionally set a custom admin key:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`.

4. Start Foundry:

   ```bash
   docker compose up -d
   docker compose logs -f
   ```

5. Open Foundry:

   ```text
   http://localhost:30000
   ```

On first launch, Foundry may ask you to enter or sign your license in the browser.

## Stop

```bash
docker compose down
```

## Pawn16 Test System

This repo includes a tiny custom Foundry system at `systems/pawn16`.

To try it:

1. Restart the container after cloning or changing system files:

   ```bash
   docker compose up -d --force-recreate
   ```

2. Open Foundry setup:

   ```text
   http://localhost:30000
   ```

3. Launch the local `Pawn16 Test` world, or create a new world using the `Pawn16` game system.

4. Launch the world as GM.

When the world opens, the system seeds a native 16x16 Foundry grid scene named `Pawn16 Board`, 16 white pawns, 16 black pawns, 16 white knights, 16 black knights, and two helper macros. Select one piece and use the `Pawn16: Move Selected Piece` token control or macro to make a legal move for that piece type.

The generated world data remains local under `foundry-data/` and is ignored by Git.

## Automated Checks

The repo includes a dev/test overlay at `compose.dev.yml`. The base `compose.yml` remains the simple game-server runtime; the dev overlay adds Dockerized Playwright and forces the local `pawn16-test` world for automation.

```bash
make dev-restart
make test-all            # full explicit test pass
# or choose a targeted subset:
make test-engine
make test-foundry-health
make test-foundry-rules
make test-foundry
```

Useful targets:

```bash
make up          # server-only Foundry runtime
make restart     # server-only recreate
make dev-up      # Foundry with dev/test overlay
make dev-restart # recreate Foundry with pawn16-test auto-launched
make test-all    # engine + full Foundry suite
make test-engine # pure movement engine unit tests
make test-foundry-health # health-only Foundry smoke subset
make test-foundry-rules  # rules-only Foundry smoke subset
make test-foundry # full Foundry Playwright suite
make state       # writes and prints test-results/pawn16-state.json
make state-debug # extended JSON state with optional filters/text/UI verify
make screenshot  # writes test-results/pawn16-board.png
make logs        # follows Foundry logs
```

The Playwright commands run inside Docker, so the host does not need Node, npm, Playwright, Chromium, or browser shared libraries for the default dev/test path.
If `node_modules/` is missing, the test container installs dependencies from `package-lock.json` before running the command.

The smoke test launches the `pawn16-test` world, logs in as `Gamemaster`, resets the board, and validates structured Foundry state:

- world/system loaded correctly
- game is unpaused
- active board scene is `1280x1280`
- native grid size is `80`
- no seeded board image tiles exist
- 64 seeded piece tokens exist
- piece rotations are locked at `0`
- white and black pawns are on their starting ranks
- white and black knights are on their starting ranks

The main feedback artifact is JSON at `test-results/pawn16-state.json`. Screenshots are saved locally for debugging and are ignored by Git.

For targeted debugging, `state-debug` supports environment filters:

```bash
STATE_SEEDED_ONLY=1 make state-debug
STATE_PIECE_TYPE=knight STATE_SIDE=black make state-debug
STATE_TEXT=1 STATE_FILE_MIN=0 STATE_FILE_MAX=7 make state-debug
STATE_VERIFY_UI=1 make state-debug
```

More implementation notes for Foundry v14 and Playwright are in `docs/foundry-v14-playwright-notes.md`.

## Notes

- The compose file pins `ghcr.io/felddy/foundryvtt:14.360.0`, so the zip should be named `foundryvtt-14.360.zip`.
- Do not commit the Foundry zip, license data, worlds, installed packages under `foundry-data/Data/`, or logs.
- Persistent Foundry data lives in `foundry-data/`.
