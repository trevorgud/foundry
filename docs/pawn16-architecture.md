# Pawn16 Architecture

Pawn16 is a tiny Foundry VTT v14 system used to prove a reproducible Docker/dev workflow.

## Design Intent

The system creates a playable hello-world board without committing generated Foundry world data.

The repo commits:

- the Foundry system source under `systems/pawn16/`
- Docker/Make/test harness files
- docs

The repo ignores:

- Foundry license/config/runtime data
- generated world databases
- downloaded Foundry archives
- test artifacts

## System Entry Point

`systems/pawn16/system.json` loads:

```text
systems/pawn16/scripts/pawn16.js
```

`pawn16.js` registers:

- the shared piece actor data model
- world setting `pawn16.autoSeed`
- `game.pawn16` helper API
- token controls for move/reset
- token hooks to keep seeded piece tokens rotation-locked

## Data Model

`systems/pawn16/scripts/data-models.js` defines `PawnDataModel`.

Each seeded piece actor stores:

```js
system.side       // "white" or "black"
system.file       // 0-15
system.rank       // 0-15
system.hasMoved   // boolean
```

## Rules

`systems/pawn16/scripts/rules.js` contains board constants and coordinate helpers:

```js
BOARD_SIZE = 16
GRID_SIZE = 80
startingRank(side)
squareToPixel(file, rank)
pixelToSquare(x, y)
legalPawnMoves(pawn, occupied)
```

Pawn movement resolution now flows through:

- `systems/pawn16/scripts/movement-engine.js` (pure move engine)
- `systems/pawn16/scripts/movement-adapters.js` (Foundry-to-engine adapters)

The engine evaluates declarative capability patterns (directions, distances, occupancy targets, and path rules) and returns normalized move objects. The current pawn behavior is defined as a profile in the engine and then adapted back to legacy move shape where needed.

Current piece profiles:

- `pawn`: exactly one square forward/backward/left/right onto empty squares
- `knight` (custom Pawn16 type): one or two squares forward/backward/left/right onto empty squares, with path blocking on two-square moves

The current interaction moves a selected piece according to its profile. There is not yet a full turn system or player-side enforcement.

## Seeding

`systems/pawn16/scripts/seed.js` is the main Foundry integration layer.

On GM `ready`, if `pawn16.autoSeed` is enabled, it:

- ensures the `Pawn16 Board` scene exists
- ensures the scene is `1280x1280`
- uses Foundry's native square grid at `80px`
- removes stale seeded board-image tiles
- ensures 16 white and 16 black pawn actors
- ensures 16 white and 16 black knight actors
- ensures linked seeded piece tokens
- creates helper macros
- unpauses the game

The seeder is intended to be idempotent. It should create or reconcile missing/stale pieces instead of requiring committed world database files.

## Board Rendering

The board uses Foundry's native scene grid only.

There is intentionally no board background image or board tile. Earlier SVG board tiles created a second coordinate system and caused confusing visual mismatch, so native grid is now the preferred baseline.

## Test API

`systems/pawn16/scripts/test-api.js` exposes structured validation through `game.pawn16`:

```js
game.pawn16.testState()
game.pawn16.assertHealthy()
game.pawn16.resetBoard()
game.pawn16.seedWorld()
game.pawn16.unpause()
game.pawn16.moveSelectedPawnForward()
```

Playwright tests should prefer this API over scraping the UI or interpreting full screenshots.

## Automation

`tests/foundry-smoke.spec.js` logs in as `Gamemaster`, calls `game.pawn16.resetBoard()`, and asserts `game.pawn16.assertHealthy()`.

The expected healthy state includes:

- system `pawn16`
- world `pawn16-test`
- unpaused game
- active `Pawn16 Board`
- scene size `1280x1280`
- grid size `80`
- zero board-image tiles
- 64 seeded piece tokens
- white pawns on rank 14
- black pawns on rank 1
- white knights on rank 15
- black knights on rank 0
- no rotated or rotation-unlocked seeded piece tokens

Foundry/Playwright details are in `docs/foundry-v14-playwright-notes.md`.

## Current Limitations

- No turn manager.
- No player assignment for white vs black.
- No rule enforcement for arbitrary drag movement beyond rotation and state sync.
- No capture UI.
- No win/draw detection.
- No ownership automation for regular players.

For two-player play, a GM currently needs to manage users and permissions manually.
