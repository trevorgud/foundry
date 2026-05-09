import {
  BOARD_SIZE,
  BACK_RANK_LAYOUT,
  GRID_SIZE,
  SYSTEM_ID,
  pixelToSquare,
  squareToPixel,
  startingRank
} from "./rules.js";
import {
  assertCanUseAction,
  clearActionLog,
  endTurn as endBoardTurn,
  ensureTurnState,
  executeAttack,
  executeMove,
  getActionLog,
  getTurnState as getBoardTurnState,
  legalActionsForToken
} from "./action-execution.js";
import { assertUserCanActForSide, buildPlayerOwnership } from "./sides.js";
import { GAME_STATE_ACTOR_NAME, GAME_STATE_KIND, findGameStateActor } from "./game-state.js";

const BOARD_SCENE_NAME = "Pawn16 Board";
const WHITE_PAWN_ASSET = "systems/pawn16/assets/white-pawn.svg";
const BLACK_PAWN_ASSET = "systems/pawn16/assets/black-pawn.svg";
const WHITE_KNIGHT_ASSET = "systems/pawn16/assets/white-knight.svg";
const BLACK_KNIGHT_ASSET = "systems/pawn16/assets/black-knight.svg";
const WHITE_BISHOP_ASSET = "systems/pawn16/assets/white-bishop.svg";
const BLACK_BISHOP_ASSET = "systems/pawn16/assets/black-bishop.svg";
const WHITE_KING_ASSET = "systems/pawn16/assets/white-king.svg";
const BLACK_KING_ASSET = "systems/pawn16/assets/black-king.svg";

let seedPromise = null;

export async function seedPawn16World() {
  if (game.system.id !== SYSTEM_ID || !game.user.isGM) return;
  if (!game.settings.get(SYSTEM_ID, "autoSeed")) return;

  if (seedPromise) return seedPromise;
  seedPromise = seedPawn16WorldUnlocked().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

async function seedPawn16WorldUnlocked() {
  const scene = await ensureBoardScene();
  await ensurePlayerUsers();
  await ensureGameStateActor();
  const actors = await ensurePieceActors();
  await removeBoardTiles(scene);
  await ensurePieceTokens(scene, actors);
  await ensureTurnState(scene);
  await ensureMacros();
  unpauseGame();

  if (!scene.active) await scene.activate();
  console.info("Pawn16 | Demo board is ready.");
}

export async function resetPawn16Board() {
  if (seedPromise) await seedPromise;

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

  await ensurePlayerUsers();
  await ensureGameStateActor();
  const actors = await ensurePieceActors({ reset: true });
  await removeBoardTiles(scene);
  await ensurePieceTokens(scene, actors);
  await ensureTurnState(scene, { reset: true });
  await clearActionLog(scene);
  unpauseGame();
  if (!scene.active) await scene.activate();
  ui.notifications.info("Pawn16 board reset.");
}

export async function moveSelectedPawnForward() {
  return moveSelectedPiece();
}

export async function moveSelectedPiece() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    ui.notifications.warn("Select exactly one Pawn16 piece.");
    return;
  }

  const token = controlled[0];
  const actor = token.actor;
  if (!token.document.getFlag(SYSTEM_ID, "seedId")) {
    ui.notifications.warn("The selected token is not a Pawn16 piece.");
    return;
  }

  const turnState = getTurnState();
  if (!canUseAction(actor.system.side, "move", turnState)) return;

  const moves = legalActionsForToken(token.document, "move");
  const move = choosePreferredAction(moves, actor.system.side);

  if (!move) {
    ui.notifications.warn("That piece has no legal move.");
    return;
  }

  return executeMove(canvas.scene, token.document, move.to.file, move.to.rank);
}

export async function attackSelectedPiece() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1) {
    ui.notifications.warn("Select exactly one Pawn16 piece.");
    return;
  }

  const token = controlled[0];
  const actor = token.actor;
  if (!token.document.getFlag(SYSTEM_ID, "seedId")) {
    ui.notifications.warn("The selected token is not a Pawn16 piece.");
    return;
  }

  const turnState = getTurnState();
  if (!canUseAction(actor.system.side, "attack", turnState)) return;

  const attacks = legalActionsForToken(token.document, "attack");
  const attack = choosePreferredAction(attacks, actor.system.side);
  if (!attack) {
    ui.notifications.warn("That piece has no legal attack.");
    return;
  }

  return executeAttack(canvas.scene, token.document, attack.to.file, attack.to.rank);
}

export async function movePiece(type, side, file, targetFile, targetRank) {
  if (!game.user.isGM) throw new Error("Only a GM can move Pawn16 pieces.");
  const scene = findBoardScene();
  const token = findPieceToken(scene, type, side, file);
  if (!token) throw new Error(`Piece ${type}-${side}-${file} was not found on the board.`);
  return executeMove(scene, token, targetFile, targetRank);
}

export async function attackPiece(type, side, file, targetFile, targetRank) {
  if (!game.user.isGM) throw new Error("Only a GM can attack with Pawn16 pieces.");
  const scene = findBoardScene();
  const token = findPieceToken(scene, type, side, file);
  if (!token) throw new Error(`Piece ${type}-${side}-${file} was not found on the board.`);
  return executeAttack(scene, token, targetFile, targetRank);
}

export function getTurnState(scene = findBoardScene()) {
  return getBoardTurnState(scene);
}

export async function endTurn() {
  const { currentSide } = getTurnState();
  assertUserCanActForSide(currentSide);
  return endBoardTurn(findBoardScene());
}

export function actionLog(scene = findBoardScene()) {
  return getActionLog(scene);
}

export async function clearBoardActionLog() {
  await clearActionLog();
  return getActionLog();
}

export async function syncPawnStateFromToken(tokenDocument, changed = {}) {
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

async function ensureGameStateActor() {
  const ownership = buildPlayerOwnership();
  const existing = findGameStateActor();
  if (existing) {
    if (!sameOwnership(existing.ownership, ownership)) {
      await existing.update({ ownership });
    }
    return existing;
  }

  return Actor.create({
    name: GAME_STATE_ACTOR_NAME,
    type: "pawn",
    img: "icons/svg/clockwork.svg",
    ownership,
    flags: {
      [SYSTEM_ID]: {
        kind: GAME_STATE_KIND
      }
    }
  });
}

async function ensurePlayerUsers() {
  const configs = [
    { settingKey: "whitePlayerId", name: "WhitePlayer" },
    { settingKey: "blackPlayerId", name: "BlackPlayer" }
  ];

  for (const { settingKey, name } of configs) {
    const currentId = game.settings.get(SYSTEM_ID, settingKey);
    if (currentId && game.users.get(currentId)) continue;

    let user = game.users.find(u => u.name === name);
    if (!user) {
      user = await User.create({ name, role: CONST.USER_ROLES.PLAYER, password: "" });
    }
    if (user && user.id !== currentId) {
      await game.settings.set(SYSTEM_ID, settingKey, user.id);
    }
  }
}

function sameOwnership(current = {}, desired = {}) {
  const currentKeys = Object.keys(current).sort();
  const desiredKeys = Object.keys(desired).sort();
  if (currentKeys.length !== desiredKeys.length) return false;
  for (const key of desiredKeys) {
    if (current[key] !== desired[key]) return false;
  }
  return true;
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
      for (const slot of config.slotsForSide(side)) {
        const seedId = pieceSeedId(slot.type, side, slot.file);
        const name = `${capitalize(side)} ${capitalize(slot.type)} ${slot.file + 1}`;
        const img = assetForPiece(slot.type, side);
        const disposition = side === "white"
          ? CONST.TOKEN_DISPOSITIONS.FRIENDLY
          : CONST.TOKEN_DISPOSITIONS.HOSTILE;
        const ownership = buildPlayerOwnership();
        const data = {
          name,
          type: slot.type,
          img,
          ownership,
          system: {
            side,
            file: slot.file,
            rank: slot.rank,
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
              file: slot.file,
              pieceType: slot.type
            }
          }
        };

        let actor = game.actors.find(candidate => candidate.getFlag(SYSTEM_ID, "seedId") === seedId);
        if (!actor) actor = await Actor.create(data);
        if (!actor) continue;
        else if (reset) await actor.update(data);
        else await actor.update({
          img,
          ownership,
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
    const existingTokens = scene.tokens.filter(token => token.getFlag(SYSTEM_ID, "seedId") === seedId);
    const existing = existingTokens[0] ?? null;
    if (existingTokens.length > 1) {
      await scene.deleteEmbeddedDocuments("Token", existingTokens.slice(1).map(token => token.id));
    }
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
    "game.pawn16.moveSelectedPiece();",
    "icons/svg/upgrade.svg"
  );
  await ensureMacro(
    "Pawn16: Attack Selected Piece",
    "game.pawn16.attackSelectedPiece();",
    "icons/svg/sword.svg"
  );
  await ensureMacro(
    "Pawn16: End Turn",
    "game.pawn16.endTurn();",
    "icons/svg/clockwork.svg"
  );
  await ensureMacro(
    "Pawn16: Reset Board",
    "game.pawn16.resetBoard();",
    "icons/svg/refresh.svg"
  );
}

async function ensureMacro(name, command, img) {
  const desiredOwnership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
  const existing = game.macros.getName(name);
  if (existing) {
    const updates = {};
    if (existing.command !== command) updates.command = command;
    if (existing.img !== img) updates.img = img;
    if ((existing.ownership?.default ?? -1) !== desiredOwnership.default) updates.ownership = desiredOwnership;
    return Object.keys(updates).length ? existing.update(updates) : existing;
  }

  return Macro.create({
    name,
    type: "script",
    img,
    command,
    ownership: desiredOwnership,
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

function findPieceToken(scene, type, side, file) {
  const seedId = pieceSeedId(type, side, file);
  return scene?.tokens.find(token => token.getFlag(SYSTEM_ID, "seedId") === seedId) ?? null;
}

function pieceSeedConfigs() {
  return [
    {
      slotsForSide: side => {
        const rank = startingRank(side);
        return Array.from({ length: BOARD_SIZE }, (_value, file) => ({ type: "pawn", file, rank }));
      }
    },
    {
      slotsForSide: side => {
        const rank = side === "white" ? BOARD_SIZE - 1 : 0;
        return BACK_RANK_LAYOUT.map((type, file) => ({ type, file, rank }));
      }
    }
  ];
}

function assetForPiece(type, side) {
  const assets = {
    pawn: {
      white: WHITE_PAWN_ASSET,
      black: BLACK_PAWN_ASSET
    },
    knight: {
      white: WHITE_KNIGHT_ASSET,
      black: BLACK_KNIGHT_ASSET
    },
    bishop: {
      white: WHITE_BISHOP_ASSET,
      black: BLACK_BISHOP_ASSET
    },
    king: {
      white: WHITE_KING_ASSET,
      black: BLACK_KING_ASSET
    }
  };
  return assets[type]?.[side] ?? WHITE_PAWN_ASSET;
}

function canUseAction(side, actionType, state, { notify = true } = {}) {
  try {
    assertCanUseAction(side, actionType, state);
    return true;
  } catch (error) {
    if (notify) ui.notifications.warn(error.message);
    return false;
  }
}

function choosePreferredAction(actions, side) {
  if (!actions.length) return null;

  const ordered = [...actions].sort((a, b) => {
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
