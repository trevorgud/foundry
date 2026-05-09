# Pawn16

Pawn16 is a deliberately tiny Foundry VTT system for testing reproducible game setup.

When a GM opens a world using this system, it seeds:

- A 16x16 scene named `Pawn16 Board`
- 16 white pawns and 16 black pawns on each front row
- A white and black back row with one king, eight knights, and seven bishops
- Helper macros for moving, attacking, ending the turn, and resetting the board
- An unpaused game state so players can move tokens immediately
- No board image tile; the board uses Foundry's native square grid

The seed script is idempotent: it creates missing pieces without committing generated world data.
