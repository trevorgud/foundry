import {
  BOARD_SIZE,
  GRID_SIZE,
  SYSTEM_ID,
  legalPawnMoves,
  pixelToSquare,
  squareKey,
  squareToPixel,
  startingRank
} from "./rules.js";

const BOARD_SCENE_NAME = "Pawn16 Board";
const BOARD_ASSET = "systems/pawn16/assets/board-16x16.svg";
const WHITE_PAWN_ASSET = "systems/pawn16/assets/white-pawn.svg";
const BLACK_PAWN_ASSET = "systems/pawn16/assets/black-pawn.svg";

export async function seedPawn16World() {
  if (game.system.id !== SYSTEM_ID || !game.user.isGM) return;
  if (!game.settings.get(SYSTEM_ID, "autoSeed")) return;

  const scene = await ensureBoardScene();
  const actors = await ensurePawnActors();
  await ensureBoardTile(scene);
  await ensurePawnTokens(scene, actors);
  await ensureMacros();

  if (!scene.active) await scene.activate();
  console.info("Pawn16 | Demo board is ready.");
}

export async function resetPawn16Board() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only a GM can reset the Pawn16 board.");
    return;
  }

  const scene = findBoardScene();
  if (!scene) {
    await seedPawn16World();
    return;
  }

  const seededTokens = scene.tokens.filter(token => token.getFlag(SYSTEM_ID, "seedId"));
  if (seededTokens.length) {
    await scene.deleteEmbeddedDocuments("Token", seededTokens.map(token => token.id));
  }

  const actors = await ensurePawnActors({ reset: true });
  await ensurePawnTokens(scene, actors);
  if (!scene.active) await scene.activate();
  ui.notifications.info("Pawn16 board reset.");
}

export async function moveSelectedPawnForward() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    ui.notifications.warn("Select exactly one Pawn16 pawn.");
    return;
  }

  const token = controlled[0];
  const actor = token.actor;
  if (actor?.type !== "pawn") {
    ui.notifications.warn("The selected token is not a Pawn16 pawn.");
    return;
  }

  const from = pixelToSquare(token.document.x, token.document.y);
  const occupied = getOccupiedSquares(canvas.scene, token.document.id);
  const moves = legalPawnMoves({
    side: actor.system.side,
    file: from.file,
    rank: from.rank,
    hasMoved: actor.system.hasMoved
  }, occupied);

  const move = moves.find(candidate => candidate.kind === "move" && Math.abs(candidate.rank - from.rank) === 1)
    ?? moves.find(candidate => candidate.kind === "move");

  if (!move) {
    ui.notifications.warn("That pawn has no open forward move.");
    return;
  }

  const position = squareToPixel(move.file, move.rank);
  await token.document.update(position);
  await actor.update({
    "system.file": move.file,
    "system.rank": move.rank,
    "system.hasMoved": true
  });
}

function findBoardScene() {
  return game.scenes.find(scene => scene.getFlag(SYSTEM_ID, "kind") === "board")
    ?? game.scenes.getName(BOARD_SCENE_NAME);
}

async function ensureBoardScene() {
  const existing = findBoardScene();
  if (existing) return existing;

  const size = BOARD_SIZE * GRID_SIZE;
  const gridType = CONST.GRID_TYPES?.SQUARE ?? 1;

  return Scene.create({
    name: BOARD_SCENE_NAME,
    active: true,
    navigation: true,
    width: size,
    height: size,
    padding: 0,
    backgroundColor: "#1d2733",
    tokenVision: false,
    grid: {
      type: gridType,
      size: GRID_SIZE,
      distance: 1,
      units: "sq",
      color: "#111111",
      alpha: 0.28
    },
    initial: {
      x: size / 2,
      y: size / 2,
      scale: 0.72
    },
    flags: {
      [SYSTEM_ID]: {
        kind: "board"
      }
    }
  });
}

async function ensureBoardTile(scene) {
  const existing = scene.tiles.find(tile => tile.getFlag(SYSTEM_ID, "kind") === "board-image");
  if (existing) return existing;

  const size = BOARD_SIZE * GRID_SIZE;
  const [tile] = await scene.createEmbeddedDocuments("Tile", [{
    name: "Pawn16 Board Image",
    x: 0,
    y: 0,
    width: size,
    height: size,
    locked: true,
    sort: 0,
    texture: {
      src: BOARD_ASSET
    },
    flags: {
      [SYSTEM_ID]: {
        kind: "board-image"
      }
    }
  }]);

  return tile;
}

async function ensurePawnActors({ reset = false } = {}) {
  const actors = [];

  for (const side of ["white", "black"]) {
    for (let file = 0; file < BOARD_SIZE; file += 1) {
      const seedId = pawnSeedId(side, file);
      const rank = startingRank(side);
      const name = `${capitalize(side)} Pawn ${file + 1}`;
      const img = side === "white" ? WHITE_PAWN_ASSET : BLACK_PAWN_ASSET;
      const disposition = side === "white"
        ? CONST.TOKEN_DISPOSITIONS.FRIENDLY
        : CONST.TOKEN_DISPOSITIONS.HOSTILE;
      const data = {
        name,
        type: "pawn",
        img,
        system: {
          side,
          file,
          rank,
          hasMoved: false
        },
        prototypeToken: {
          name,
          actorLink: true,
          width: 1,
          height: 1,
          texture: { src: img },
          disposition
        },
        flags: {
          [SYSTEM_ID]: {
            seedId,
            side,
            file
          }
        }
      };

      let actor = game.actors.find(candidate => candidate.getFlag(SYSTEM_ID, "seedId") === seedId);
      if (!actor) actor = await Actor.create(data);
      else if (reset) await actor.update(data);
      actors.push(actor);
    }
  }

  return actors;
}

async function ensurePawnTokens(scene, actors) {
  const tokenData = [];

  for (const actor of actors) {
    const seedId = actor.getFlag(SYSTEM_ID, "seedId");
    const existing = scene.tokens.find(token => token.getFlag(SYSTEM_ID, "seedId") === seedId);
    if (existing) continue;

    const position = squareToPixel(actor.system.file, actor.system.rank);
    const document = await actor.getTokenDocument({
      ...position,
      width: 1,
      height: 1,
      actorLink: true,
      texture: { src: actor.img },
      flags: {
        [SYSTEM_ID]: {
          seedId
        }
      }
    });
    tokenData.push(document.toObject());
  }

  if (tokenData.length) await scene.createEmbeddedDocuments("Token", tokenData);
}

async function ensureMacros() {
  await ensureMacro(
    "Pawn16: Move Selected Pawn Forward",
    "game.pawn16.moveSelectedPawnForward();",
    "icons/svg/upgrade.svg"
  );
  await ensureMacro(
    "Pawn16: Reset Board",
    "game.pawn16.resetBoard();",
    "icons/svg/refresh.svg"
  );
}

async function ensureMacro(name, command, img) {
  const existing = game.macros.getName(name);
  if (existing) return existing;

  return Macro.create({
    name,
    type: "script",
    img,
    command,
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    },
    flags: {
      [SYSTEM_ID]: {
        seeded: true
      }
    }
  });
}

function getOccupiedSquares(scene, excludeTokenId = null) {
  const occupied = new Map();

  for (const token of scene.tokens) {
    if (token.id === excludeTokenId) continue;
    if (token.actor?.type !== "pawn") continue;

    const { file, rank } = pixelToSquare(token.x, token.y);
    occupied.set(squareKey(file, rank), {
      side: token.actor.system.side,
      tokenId: token.id
    });
  }

  return occupied;
}

function pawnSeedId(side, file) {
  return `${side}-${file}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
