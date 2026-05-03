# Pawn16

Pawn16 is a deliberately tiny Foundry VTT system for testing reproducible game setup.

When a GM opens a world using this system, it seeds:

- A 16x16 scene named `Pawn16 Board`
- 16 white pawns
- 16 black pawns
- Helper macros for moving a selected pawn forward and resetting the board

The seed script is idempotent: it creates missing pieces without committing generated world data.
