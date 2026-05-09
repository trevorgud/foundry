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
- token controls for move, attack, end turn, and reset
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

Piece action resolution now flows through:

- `systems/pawn16/scripts/movement-engine.js` (pure action engine; still named for compatibility)
- `systems/pawn16/scripts/movement-adapters.js` (Foundry-to-engine adapters)
- `systems/pawn16/scripts/action-execution.js` (turn checks, structured action results, effect application, and action log)

The engine evaluates declarative capability patterns (action type, directions, distances, occupancy targets, and path rules) and returns normalized action objects. Movement helpers still adapt actions back to the legacy move shape where needed.

Execution is intentionally separate from legality. `movePiece()` and `attackPiece()` validate the selected action, build a structured result, apply explicit effects such as `move-token`, `update-actor-position`, or `capture-token`, consume the matching turn action, and append the result to a capped scene-flag action log.

Current piece profiles:

- `pawn`: moves one orthogonal square; attacks one adjacent orthogonal or diagonal enemy
- `knight` (custom Pawn16 type): moves one or two orthogonal squares with clear path; attacks one orthogonal enemy
- `bishop`: moves one orthogonal square; attacks exactly two or three orthogonal squares with clear path
- `king`: moves one orthogonal square; attacks one orthogonal enemy

The current interaction allows the active side to spend one movement and one attack per turn. This is a lightweight scene-flag turn model, not yet a full multiplayer ownership system.

## Seeding

`systems/pawn16/scripts/seed.js` is the main Foundry integration layer.

On GM `ready`, if `pawn16.autoSeed` is enabled, it:

- ensures the `Pawn16 Board` scene exists
- ensures the scene is `1280x1280`
- uses Foundry's native square grid at `80px`
- removes stale seeded board-image tiles
- ensures 16 white and 16 black pawn actors on the front ranks
- ensures one king, eight knights, and seven bishops per side on the back ranks
- ensures linked seeded piece tokens
- creates move, attack, end-turn, and reset helper macros
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
game.pawn16.legalMovesForPiece()
game.pawn16.legalAttacksForPiece()
game.pawn16.movePiece()
game.pawn16.attackPiece()
game.pawn16.endTurn()
game.pawn16.turnState()
game.pawn16.actionLog()
game.pawn16.clearActionLog()
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
- white back-rank pieces on rank 15
- black back-rank pieces on rank 0
- 16 knights, 14 bishops, and 2 kings
- no rotated or rotation-unlocked seeded piece tokens

Foundry/Playwright details are in `docs/foundry-v14-playwright-notes.md`.

## Current Limitations

- Turn state is intentionally minimal: one move and one attack per side turn.
- No player assignment for white vs black.
- No rule enforcement for arbitrary drag movement beyond rotation and state sync.
- Attack execution currently uses a `capture-token` effect that removes the target token; there is no damage model or captured-piece tray yet.
- No win/draw detection.
- No ownership automation for regular players.

For two-player play, a GM currently needs to manage users and permissions manually.
