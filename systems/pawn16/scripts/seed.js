import {
  BOARD_SIZE,
  GRID_SIZE,
  SYSTEM_ID,
  pixelToSquare,
  squareToPixel,
  startingRank
} from "./rules.js";
import { positionFromScene, pieceFromToken } from "./movement-adapters.js";
import { generateLegalMoves, getMovementProfile } from "./movement-engine.js";

const BOARD_SCENE_NAME = "Pawn16 Board";
const WHITE_PAWN_ASSET = "systems/pawn16/assets/white-pawn.svg";
const BLACK_PAWN_ASSET = "systems/pawn16/assets/black-pawn.svg";
const WHITE_KNIGHT_ASSET = "systems/pawn16/assets/white-pawn.svg";
const BLACK_KNIGHT_ASSET = "systems/pawn16/assets/black-pawn.svg";

export async function seedPawn16World() {
  if (game.system.id !== SYSTEM_ID || !game.user.isGM) return;
  if (!game.settings.get(SYSTEM_ID, "autoSeed")) return;

  const scene = await ensureBoardScene();
  const actors = await ensurePieceActors();
  await removeBoardTiles(scene);
  await ensurePieceTokens(scene, actors);
  await ensureMacros();
  unpauseGame();

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

  const actors = await ensurePieceActors({ reset: true });
  await removeBoardTiles(scene);
  await ensurePieceTokens(scene, actors);
  unpauseGame();
  if (!scene.active) await scene.activate();
  ui.notifications.info("Pawn16 board reset.");
}

export async function moveSelectedPawnForward() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    ui.notifications.warn("Select exactly one Pawn16 piece.");
    return;
  }

  const token = controlled[0];
  const actor = token.actor;
  if (actor?.type !== "pawn") {
    ui.notifications.warn("The selected token is not a Pawn16 piece.");
    return;
  }

  const from = {
    file: actor.system.file,
    rank: actor.system.rank
  };
  const position = positionFromScene(canvas.scene);
  position.occupancy.delete(`${from.file},${from.rank}`);
  const piece = pieceFromToken(token.document);
  const profile = getMovementProfile(piece.type);
  const moves = generateLegalMoves(position, piece, profile);
  const move = choosePreferredMove(moves, actor.system.side);

  if (!move) {
    ui.notifications.warn("That piece has no legal move.");
    return;
  }

  const pixel = squareToPixel(move.to.file, move.to.rank);
  await token.document.update({
    ...pixel,
    rotation: 0,
    lockRotation: true
  });
  await actor.update({
    "system.file": move.to.file,
    "system.rank": move.to.rank,
    "system.hasMoved": true
  });
}

export async function syncPawnStateFromToken(tokenDocument, changed = {}) {
  if (!game.user.isGM) return;
  if (tokenDocument.actor?.type !== "pawn") return;
  if (!tokenDocument.getFlag(SYSTEM_ID, "seedId")) return;
  if (!("x" in changed || "y" in changed || "rotation" in changed || "lockRotation" in changed)) return;

  const { file, rank } = pixelToSquare(tokenDocument.x, tokenDocument.y);
  const updates = {};

  if (tokenDocument.actor.system.file !== file) updates["system.file"] = file;
  if (tokenDocument.actor.system.rank !== rank) updates["system.rank"] = rank;

  if (Object.keys(updates).length) {
    await tokenDocument.actor.update(updates);
  }
}

function findBoardScene() {
  return game.scenes.find(scene => scene.getFlag(SYSTEM_ID, "kind") === "board")
    ?? game.scenes.getName(BOARD_SCENE_NAME);
}

async function ensureBoardScene() {
  const existing = findBoardScene();
  const size = BOARD_SIZE * GRID_SIZE;
  const gridType = CONST.GRID_TYPES?.SQUARE ?? 1;
  const sceneUpdates = {
    width: size,
    height: size,
    padding: 0,
    backgroundColor: "#9b9b9b",
    tokenVision: false,
    "grid.type": gridType,
    "grid.size": GRID_SIZE,
    "grid.distance": 1,
    "grid.units": "sq",
    "grid.color": "#333333",
    "grid.alpha": 0.45
  };

  if (existing) {
    const updates = {};
    for (const [path, value] of Object.entries(sceneUpdates)) {
      if (foundry.utils.getProperty(existing, path) !== value) updates[path] = value;
    }
    if (Object.keys(updates).length) await existing.update(updates);
    return existing;
  }

  return Scene.create({
    name: BOARD_SCENE_NAME,
    active: true,
    navigation: true,
    width: sceneUpdates.width,
    height: sceneUpdates.height,
    padding: sceneUpdates.padding,
    backgroundColor: sceneUpdates.backgroundColor,
    tokenVision: sceneUpdates.tokenVision,
    grid: {
      type: sceneUpdates["grid.type"],
      size: sceneUpdates["grid.size"],
      distance: sceneUpdates["grid.distance"],
      units: sceneUpdates["grid.units"],
      color: sceneUpdates["grid.color"],
      alpha: sceneUpdates["grid.alpha"]
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

async function removeBoardTiles(scene) {
  const boardTiles = scene.tiles.filter(tile => tile.getFlag(SYSTEM_ID, "kind") === "board-image");
  if (boardTiles.length) {
    await scene.deleteEmbeddedDocuments("Tile", boardTiles.map(tile => tile.id));
  }
}

async function ensurePieceActors({ reset = false } = {}) {
  const actors = [];

  for (const config of pieceSeedConfigs()) {
    for (const side of ["white", "black"]) {
      for (let file = 0; file < BOARD_SIZE; file += 1) {
        const seedId = pieceSeedId(config.type, side, file);
        const rank = config.rankForSide(side);
        const name = `${capitalize(side)} ${capitalize(config.type)} ${file + 1}`;
        const img = config.assetForSide(side);
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
            rotation: 0,
            lockRotation: true,
            disposition
          },
          flags: {
            [SYSTEM_ID]: {
              seedId,
              side,
              file,
              pieceType: config.type
            }
          }
        };

        let actor = game.actors.find(candidate => candidate.getFlag(SYSTEM_ID, "seedId") === seedId);
        if (!actor) actor = await Actor.create(data);
        if (!actor) continue;
        else if (reset) await actor.update(data);
        else await actor.update({
          img,
          "prototypeToken.texture.src": img,
          "prototypeToken.rotation": 0,
          "prototypeToken.lockRotation": true,
          "prototypeToken.width": 1,
          "prototypeToken.height": 1,
          "prototypeToken.actorLink": true,
          "prototypeToken.disposition": disposition
        });
        actors.push(actor);
      }
    }
  }

  return actors;
}

async function ensurePieceTokens(scene, actors) {
  const tokenData = [];

  for (const actor of actors) {
    const seedId = actor.getFlag(SYSTEM_ID, "seedId");
    const pieceType = actor.getFlag(SYSTEM_ID, "pieceType") ?? "pawn";
    const existing = scene.tokens.find(token => token.getFlag(SYSTEM_ID, "seedId") === seedId);
    if (existing) {
      const updates = {};
      if (existing.rotation !== 0) updates.rotation = 0;
      if (existing.lockRotation !== true) updates.lockRotation = true;
      if (existing.width !== 1) updates.width = 1;
      if (existing.height !== 1) updates.height = 1;
      if (existing.actorLink !== true) updates.actorLink = true;
      if (existing.texture?.src !== actor.img) updates["texture.src"] = actor.img;
      if (existing.getFlag(SYSTEM_ID, "pieceType") !== pieceType) updates[`flags.${SYSTEM_ID}.pieceType`] = pieceType;
      if (Object.keys(updates).length) await existing.update(updates);
      continue;
    }

    const position = squareToPixel(actor.system.file, actor.system.rank);
    const document = await actor.getTokenDocument({
      ...position,
      width: 1,
      height: 1,
      actorLink: true,
      texture: { src: actor.img },
      rotation: 0,
      lockRotation: true,
      flags: {
        [SYSTEM_ID]: {
          seedId,
          pieceType
        }
      }
    });
    tokenData.push(document.toObject());
  }

  if (tokenData.length) await scene.createEmbeddedDocuments("Token", tokenData);
}

async function ensureMacros() {
  await ensureMacro(
    "Pawn16: Move Selected Piece",
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

function pieceSeedId(type, side, file) {
  return `${type}-${side}-${file}`;
}

function pieceSeedConfigs() {
  return [
    {
      type: "pawn",
      rankForSide: side => startingRank(side),
      assetForSide: side => (side === "white" ? WHITE_PAWN_ASSET : BLACK_PAWN_ASSET)
    },
    {
      type: "knight",
      rankForSide: side => (side === "white" ? BOARD_SIZE - 1 : 0),
      assetForSide: side => (side === "white" ? WHITE_KNIGHT_ASSET : BLACK_KNIGHT_ASSET)
    }
  ];
}

function choosePreferredMove(moves, side) {
  const legalMoves = moves.filter(candidate => candidate.kind === "move");
  if (!legalMoves.length) return null;

  const ordered = [...legalMoves].sort((a, b) => {
    const directionScore = directionPriority(a.direction, side) - directionPriority(b.direction, side);
    if (directionScore !== 0) return directionScore;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.to.rank !== b.to.rank) return a.to.rank - b.to.rank;
    return a.to.file - b.to.file;
  });

  return ordered[0] ?? null;
}

function directionPriority(direction, side) {
  const preferred = side === "white"
    ? ["forward", "left", "right", "backward"]
    : ["forward", "right", "left", "backward"];
  const index = preferred.indexOf(direction);
  return index === -1 ? preferred.length : index;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function unpauseGame() {
  if (game.user.isGM && game.paused) {
    game.togglePause(false, { broadcast: true, userId: game.user.id });
  }
}
