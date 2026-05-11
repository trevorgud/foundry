# Pawn16 Roadmap

Tracks planned work and priorities. Status values: **TBD** (not approved), **Planned** (approved, not started), **In progress**, **Done**.

## High priority

| Item | Status | Notes |
|---|---|---|
| [Test tooling: tier 1 + tier 2](./test-tooling-plan.md) | **TBD** — awaiting confirmation on key decisions | Page-error capture, settings sanity, full-game simulation, multi-context player tests, HUD DOM checks. ~1.5 days. Justification: every gameplay bug shipped this session (ChatMessage schema, autoEndTurn left false, HUD positioning, pause behavior) would have been caught by these. |

## Medium priority

| Item | Status | Notes |
|---|---|---|
| Visual regression for HUD/board/highlights | TBD | Tier 3 from test tooling plan. Adds maintenance overhead; revisit if CSS regressions happen frequently. |
| Player-side action log UI | TBD | Players currently can't see opponent's last move except via chat. Worth surfacing in the HUD or a sidebar panel. |
| Move-to-start "soft reset" macro for players | TBD | Player reset currently only clears game state; piece positions still need GM. A workaround macro could call `setPiecePosition` for each piece (works since players own all pieces). |

## Low / future

| Item | Status | Notes |
|---|---|---|
| Cross-Foundry-version compatibility tests | TBD | Currently pinned to v14.360. |
| Performance benchmarks for large action logs | TBD | Action log capped at 50 entries; not a real concern yet. |
| Cloud/headless game simulation CLI | TBD | A `make play` target that runs a full game without a browser, for CI-like runs. |
