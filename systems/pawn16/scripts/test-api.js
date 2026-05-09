import {
  BOARD_SIZE,
  GRID_SIZE,
  SYSTEM_ID,
  isOnBoard,
  pixelToSquare,
  squareToPixel,
  startingRank
} from "./rules.js";
import { positionFromScene, pieceFromToken } from "./movement-adapters.js";
import { generateLegalMoves, getMovementProfile, toLegacyMove } from "./movement-engine.js";

const BOARD_SCENE_NAME = "Pawn16 Board";

export function testState() {
  const scene = game.scenes.getName(BOARD_SCENE_NAME) ?? canvas.scene ?? null;
  const tokens = scene ? Array.from(scene.tokens) : [];
  const pieceTokens = tokens.filter(isPawn16PieceToken);
  const pawnTokens = pieceTokens.filter(token => token.getFlag(SYSTEM_ID, "pieceType") === "pawn");
  const knightTokens = pieceTokens.filter(token => token.getFlag(SYSTEM_ID, "pieceType") === "knight");
  const boardTiles = scene
    ? scene.tiles.filter(tile => tile.getFlag(SYSTEM_ID, "kind") === "board-image")
    : [];

  const pieces = {
    pawns: {
      white: summarizePieceSide(pawnTokens, "white", startingRank("white")),
      black: summarizePieceSide(pawnTokens, "black", startingRank("black")),
      count: pawnTokens.length
    },
    knights: {
      white: summarizePieceSide(knightTokens, "white", BOARD_SIZE - 1),
      black: summarizePieceSide(knightTokens, "black", 0),
      count: knightTokens.length
    },
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
      pawnTokens: pawnTokens.length,
      knightTokens: knightTokens.length
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
    if (state.scene.knightTokens !== 32) issues.push(`Expected 32 knight tokens, got ${state.scene.knightTokens}.`);
  }

  if (state.pieces.pawns.white.count !== BOARD_SIZE) issues.push(`Expected ${BOARD_SIZE} white pawns, got ${state.pieces.pawns.white.count}.`);
  if (state.pieces.pawns.black.count !== BOARD_SIZE) issues.push(`Expected ${BOARD_SIZE} black pawns, got ${state.pieces.pawns.black.count}.`);
  if (state.pieces.knights.white.count !== BOARD_SIZE) issues.push(`Expected ${BOARD_SIZE} white knights, got ${state.pieces.knights.white.count}.`);
  if (state.pieces.knights.black.count !== BOARD_SIZE) issues.push(`Expected ${BOARD_SIZE} black knights, got ${state.pieces.knights.black.count}.`);
  if (state.pieces.pawns.white.unexpectedRanks.length) issues.push(`White pawns on unexpected ranks: ${state.pieces.pawns.white.unexpectedRanks.join(", ")}.`);
  if (state.pieces.pawns.black.unexpectedRanks.length) issues.push(`Black pawns on unexpected ranks: ${state.pieces.pawns.black.unexpectedRanks.join(", ")}.`);
  if (state.pieces.knights.white.unexpectedRanks.length) issues.push(`White knights on unexpected ranks: ${state.pieces.knights.white.unexpectedRanks.join(", ")}.`);
  if (state.pieces.knights.black.unexpectedRanks.length) issues.push(`Black knights on unexpected ranks: ${state.pieces.knights.black.unexpectedRanks.join(", ")}.`);
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

export function legalMovesForPawn(side, file) {
  return legalMovesForPiece("pawn", side, file);
}

export function legalMovesForPiece(type, side, file) {
  const scene = getBoardScene();
  const token = findPieceToken(scene, type, side, file);
  if (!token) return [];

  const position = positionFromScene(scene);
  position.occupancy.delete(`${token.actor.system.file},${token.actor.system.rank}`);
  const profile = getMovementProfile(type);
  const piece = pieceFromToken(token);
  return generateLegalMoves(position, piece, profile).map(toLegacyMove);
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

function summarizePieceSide(tokens, side, expectedRank) {
  const sideTokens = tokens.filter(token => token.actor?.system?.side === side);
  const ranks = {};
  const unexpectedRanks = new Set();

  for (const token of sideTokens) {
    const { rank } = pixelToSquare(token.x, token.y);
    ranks[rank] = (ranks[rank] ?? 0) + 1;
    if (rank !== expectedRank) unexpectedRanks.add(rank);
  }

  return {
    count: sideTokens.length,
    expectedRank,
    ranks,
    unexpectedRanks: Array.from(unexpectedRanks).sort((a, b) => a - b)
  };
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
