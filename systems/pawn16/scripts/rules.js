import { positionFromOccupiedMap } from "./movement-adapters.js";
import { generateLegalMoves, getMovementProfile, toLegacyMove } from "./movement-engine.js";

export const SYSTEM_ID = "pawn16";
export const BOARD_SIZE = 16;
export const GRID_SIZE = 80;
export const PIECE_TYPES = ["pawn", "knight", "bishop", "king"];
export const BACK_RANK_LAYOUT = [
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "king",
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "bishop"
];

export function squareKey(file, rank) {
  return `${file},${rank}`;
}

export function isOnBoard(file, rank) {
  return file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
}

export function startingRank(side) {
  return side === "white" ? BOARD_SIZE - 2 : 1;
}

export function squareToPixel(file, rank) {
  return {
    x: file * GRID_SIZE,
    y: rank * GRID_SIZE
  };
}

export function pixelToSquare(x, y) {
  return {
    file: Math.round(x / GRID_SIZE),
    rank: Math.round(y / GRID_SIZE)
  };
}

export function legalPawnMoves(pawn, occupied) {
  const profile = getMovementProfile("pawn");
  const position = positionFromOccupiedMap(occupied, { boardSize: BOARD_SIZE });
  const piece = {
    id: "selected-pawn",
    type: "pawn",
    side: pawn.side,
    file: pawn.file,
    rank: pawn.rank,
    hasMoved: pawn.hasMoved === true
  };

  return generateLegalMoves(position, piece, profile).map(toLegacyMove);
}
