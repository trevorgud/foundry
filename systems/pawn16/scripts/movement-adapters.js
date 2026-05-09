import { BOARD_SIZE, SYSTEM_ID } from "./rules.js";
import { squareKey } from "./movement-engine.js";

export function positionFromScene(scene, { boardSize = BOARD_SIZE } = {}) {
  const occupancy = new Map();
  const pieces = [];

  for (const token of scene?.tokens ?? []) {
    if (!isPawn16PieceToken(token)) continue;
    const piece = pieceFromToken(token);
    pieces.push(piece);
    occupancy.set(squareKey(piece.file, piece.rank), piece);
  }

  return { boardSize, pieces, occupancy };
}

export function pieceFromToken(token) {
  const seedId = token.getFlag(SYSTEM_ID, "seedId");
  const pieceType = token.getFlag(SYSTEM_ID, "pieceType") ?? token.actor.type ?? "pawn";
  const actor = token.actor;

  return {
    id: seedId ?? token.id,
    tokenId: token.id,
    type: pieceType,
    side: actor.system.side,
    file: actor.system.file,
    rank: actor.system.rank,
    hasMoved: actor.system.hasMoved === true
  };
}

function isPawn16PieceToken(token) {
  if (!token?.actor) return false;
  if (token.getFlag(SYSTEM_ID, "seedId")) return true;
  return token.actor.type === "pawn";
}

export function positionFromOccupiedMap(occupied, { boardSize = BOARD_SIZE } = {}) {
  const occupancy = new Map();
  const pieces = [];

  for (const [key, occupant] of occupied.entries()) {
    const [fileValue, rankValue] = key.split(",");
    const piece = {
      id: occupant.tokenId ?? key,
      tokenId: occupant.tokenId ?? null,
      type: "pawn",
      side: occupant.side,
      file: Number(fileValue),
      rank: Number(rankValue),
      hasMoved: true
    };
    pieces.push(piece);
    occupancy.set(squareKey(piece.file, piece.rank), piece);
  }

  return { boardSize, pieces, occupancy };
}
