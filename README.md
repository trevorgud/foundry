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

When the world opens, the system seeds a native 16x16 Foundry grid scene named `Pawn16 Board`, 16 white pawns, 16 black pawns, and two helper macros. Select one pawn and use the `Pawn16: Move Selected Pawn Forward` token control or macro to make a legal forward pawn move.

The generated world data remains local under `foundry-data/` and is ignored by Git.

## Notes

- The compose file pins `ghcr.io/felddy/foundryvtt:14.360.0`, so the zip should be named `foundryvtt-14.360.zip`.
- Do not commit the Foundry zip, license data, worlds, installed packages under `foundry-data/Data/`, or logs.
- Persistent Foundry data lives in `foundry-data/`.
