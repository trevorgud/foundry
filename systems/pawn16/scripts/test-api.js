import {
  BOARD_SIZE,
  BACK_RANK_LAYOUT,
  GRID_SIZE,
  PIECE_TYPES,
  SYSTEM_ID,
  isOnBoard,
  pixelToSquare,
  squareToPixel,
  startingRank
} from "./rules.js";
import { positionFromScene, pieceFromToken } from "./movement-adapters.js";
import { generateLegalAttacks, generateLegalMoves, getMovementProfile, toLegacyMove } from "./movement-engine.js";

const BOARD_SCENE_NAME = "Pawn16 Board";
const BACK_RANK_COUNTS = BACK_RANK_LAYOUT.reduce((counts, type) => {
  counts[type] = (counts[type] ?? 0) + 1;
  return counts;
}, {});

export function testState() {
  const scene = game.scenes.getName(BOARD_SCENE_NAME) ?? canvas.scene ?? null;
  const tokens = scene ? Array.from(scene.tokens) : [];
  const pieceTokens = tokens.filter(isPawn16PieceToken);
  const tokensByType = {};
  for (const type of PIECE_TYPES) {
    tokensByType[type] = pieceTokens.filter(token => token.getFlag(SYSTEM_ID, "pieceType") === type);
  }
  const boardTiles = scene
    ? scene.tiles.filter(tile => tile.getFlag(SYSTEM_ID, "kind") === "board-image")
    : [];

  const pieces = {
    pawns: summarizePieceType(tokensByType.pawn, "pawn"),
    knights: summarizePieceType(tokensByType.knight, "knight"),
    bishops: summarizePieceType(tokensByType.bishop, "bishop"),
    kings: summarizePieceType(tokensByType.king, "king"),
    rotated: pieceTokens.filter(token => token.rotation !== 0).length,
    unlockedRotation: pieceTokens.filter(token => token.lockRotation !== true).length,
    unlinked: pieceTokens.filter(token => token.actorLink !== true).length
  };

  return {
    system: game.system.id,
    world: game.world?.id ?? null,
    user: {
      name: game.user?.name ?? null,
      isGM: game.user?.isGM ?? false
    },
    ready: game.ready,
    paused: game.paused,
    activeScene: canvas.scene?.name ?? null,
    scene: scene ? {
      name: scene.name,
      active: scene.active,
      width: scene.width,
      height: scene.height,
      backgroundColor: scene.backgroundColor,
      gridType: scene.grid.type,
      gridSize: scene.grid.size,
      gridDistance: scene.grid.distance,
      gridUnits: scene.grid.units,
      tiles: scene.tiles.size,
      boardImageTiles: boardTiles.length,
      tokens: scene.tokens.size,
      pieceTokens: pieceTokens.length,
      pawnTokens: tokensByType.pawn.length,
      knightTokens: tokensByType.knight.length,
      bishopTokens: tokensByType.bishop.length,
      kingTokens: tokensByType.king.length
    } : null,
    pieces
  };
}

export function assertHealthy() {
  const state = testState();
  const issues = [];
  const expectedSize = BOARD_SIZE * GRID_SIZE;

  if (state.system !== SYSTEM_ID) issues.push(`Expected system '${SYSTEM_ID}', got '${state.system}'.`);
  if (state.world !== "pawn16-test") issues.push(`Expected world 'pawn16-test', got '${state.world}'.`);
  if (!state.user.isGM) issues.push("Expected logged-in user to be a GM.");
  if (!state.ready) issues.push("Foundry game is not ready.");
  if (state.paused) issues.push("Game is paused.");
  if (!state.scene) issues.push("Pawn16 board scene was not found.");

  if (state.scene) {
    if (state.scene.name !== BOARD_SCENE_NAME) issues.push(`Expected scene '${BOARD_SCENE_NAME}', got '${state.scene.name}'.`);
    if (state.scene.width !== expectedSize) issues.push(`Expected scene width ${expectedSize}, got ${state.scene.width}.`);
    if (state.scene.height !== expectedSize) issues.push(`Expected scene height ${expectedSize}, got ${state.scene.height}.`);
    if (state.scene.gridSize !== GRID_SIZE) issues.push(`Expected grid size ${GRID_SIZE}, got ${state.scene.gridSize}.`);
    if (state.scene.gridDistance !== 1) issues.push(`Expected grid distance 1, got ${state.scene.gridDistance}.`);
    if (state.scene.boardImageTiles !== 0) issues.push(`Expected no seeded board image tiles, got ${state.scene.boardImageTiles}.`);
    if (state.scene.pieceTokens !== 64) issues.push(`Expected 64 seeded piece tokens, got ${state.scene.pieceTokens}.`);
    if (state.scene.pawnTokens !== 32) issues.push(`Expected 32 pawn tokens, got ${state.scene.pawnTokens}.`);
    if (state.scene.knightTokens !== 16) issues.push(`Expected 16 knight tokens, got ${state.scene.knightTokens}.`);
    if (state.scene.bishopTokens !== 14) issues.push(`Expected 14 bishop tokens, got ${state.scene.bishopTokens}.`);
    if (state.scene.kingTokens !== 2) issues.push(`Expected 2 king tokens, got ${state.scene.kingTokens}.`);
  }

  for (const type of PIECE_TYPES) {
    const summary = pieceSummaryForState(state, type);
    const expectedPerSide = expectedPieceCountPerSide(type);
    if (summary.white.count !== expectedPerSide) issues.push(`Expected ${expectedPerSide} white ${type} pieces, got ${summary.white.count}.`);
    if (summary.black.count !== expectedPerSide) issues.push(`Expected ${expectedPerSide} black ${type} pieces, got ${summary.black.count}.`);
    if (summary.white.unexpectedRanks.length) issues.push(`White ${type} pieces on unexpected ranks: ${summary.white.unexpectedRanks.join(", ")}.`);
    if (summary.black.unexpectedRanks.length) issues.push(`Black ${type} pieces on unexpected ranks: ${summary.black.unexpectedRanks.join(", ")}.`);
  }
  if (state.pieces.rotated !== 0) issues.push(`Expected no rotated pieces, got ${state.pieces.rotated}.`);
  if (state.pieces.unlockedRotation !== 0) issues.push(`Expected no pieces with unlocked rotation, got ${state.pieces.unlockedRotation}.`);
  if (state.pieces.unlinked !== 0) issues.push(`Expected no unlinked piece tokens, got ${state.pieces.unlinked}.`);

  return {
    ok: issues.length === 0,
    issues,
    state
  };
}

export function unpause() {
  if (game.user.isGM && game.paused) {
    game.togglePause(false, { broadcast: true, userId: game.user.id });
  }
}

export function setAutoEndTurn(enabled) {
  return game.settings.set(SYSTEM_ID, "autoEndTurn", enabled);
}

export function legalMovesForPawn(side, file) {
  return legalMovesForPiece("pawn", side, file);
}

export function legalMovesForPiece(type, side, file) {
  return legalActionsForPiece(type, side, file, "move");
}

export function legalAttacksForPiece(type, side, file) {
  return legalActionsForPiece(type, side, file, "attack");
}

function legalActionsForPiece(type, side, file, actionType) {
  const scene = getBoardScene();
  const token = findPieceToken(scene, type, side, file);
  if (!token) return [];

  const position = positionFromScene(scene);
  position.occupancy.delete(`${token.actor.system.file},${token.actor.system.rank}`);
  const profile = getMovementProfile(type);
  const piece = pieceFromToken(token);
  const actions = actionType === "attack"
    ? generateLegalAttacks(position, piece, profile)
    : generateLegalMoves(position, piece, profile);
  return actions.map(toLegacyMove);
}

export async function setPawnPosition(side, file, targetFile, targetRank, { hasMoved } = {}) {
  return setPiecePosition("pawn", side, file, targetFile, targetRank, { hasMoved });
}

export async function setPiecePosition(type, side, file, targetFile, targetRank, { hasMoved } = {}) {
  if (!game.user.isGM) throw new Error("Only a GM can set Pawn16 positions.");
  if (!isOnBoard(targetFile, targetRank)) throw new Error(`Target square ${targetFile},${targetRank} is off-board.`);

  const scene = getBoardScene();
  const token = findPieceToken(scene, type, side, file);
  if (!token) throw new Error(`Piece ${type}-${side}-${file} was not found on the board.`);

  const position = squareToPixel(targetFile, targetRank);
  await token.update({
    ...position,
    rotation: 0,
    lockRotation: true
  }, { animate: false });

  const updates = {
    "system.file": targetFile,
    "system.rank": targetRank
  };
  if (typeof hasMoved === "boolean") updates["system.hasMoved"] = hasMoved;
  await token.actor.update(updates);

  return {
    type,
    side,
    file,
    targetFile,
    targetRank
  };
}

export async function clearSquare(file, rank) {
  if (!game.user.isGM) throw new Error("Only a GM can clear Pawn16 squares.");
  if (!isOnBoard(file, rank)) throw new Error(`Square ${file},${rank} is off-board.`);

  const scene = getBoardScene();
  if (!scene) return 0;

  const tokens = scene.tokens.filter(token => {
    if (!isPawn16PieceToken(token)) return false;
    return token.actor.system.file === file && token.actor.system.rank === rank;
  });

  if (!tokens.length) return 0;
  await scene.deleteEmbeddedDocuments("Token", tokens.map(token => token.id));
  return tokens.length;
}

function summarizePieceType(tokens, type) {
  return {
    white: summarizePieceSide(tokens, "white", expectedRank(type, "white")),
    black: summarizePieceSide(tokens, "black", expectedRank(type, "black")),
    count: tokens.length
  };
}

function summarizePieceSide(tokens, side, expectedRankValue) {
  const sideTokens = tokens.filter(token => token.actor?.system?.side === side);
  const ranks = {};
  const unexpectedRanks = new Set();

  for (const token of sideTokens) {
    const { rank } = pixelToSquare(token.x, token.y);
    ranks[rank] = (ranks[rank] ?? 0) + 1;
    if (rank !== expectedRankValue) unexpectedRanks.add(rank);
  }

  return {
    count: sideTokens.length,
    expectedRank: expectedRankValue,
    ranks,
    unexpectedRanks: Array.from(unexpectedRanks).sort((a, b) => a - b)
  };
}

function expectedRank(type, side) {
  return type === "pawn"
    ? startingRank(side)
    : (side === "white" ? BOARD_SIZE - 1 : 0);
}

function expectedPieceCountPerSide(type) {
  return type === "pawn" ? BOARD_SIZE : (BACK_RANK_COUNTS[type] ?? 0);
}

function pieceSummaryForState(state, type) {
  const plural = type === "bishop" ? "bishops" : `${type}s`;
  return state.pieces[plural];
}

function getBoardScene() {
  return game.scenes.getName(BOARD_SCENE_NAME) ?? canvas.scene ?? null;
}

function findPieceToken(scene, type, side, file) {
  if (!scene) return null;
  const seedId = `${type}-${side}-${file}`;
  return scene.tokens.find(token => token.getFlag(SYSTEM_ID, "seedId") === seedId) ?? null;
}

function isPawn16PieceToken(token) {
  return Boolean(token?.getFlag(SYSTEM_ID, "seedId"));
}
