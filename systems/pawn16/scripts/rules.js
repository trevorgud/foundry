export const SYSTEM_ID = "pawn16";
export const BOARD_SIZE = 16;
export const GRID_SIZE = 80;

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
  const direction = pawn.side === "white" ? -1 : 1;
  const moves = [];
  const oneRank = pawn.rank + direction;

  if (isOnBoard(pawn.file, oneRank) && !occupied.has(squareKey(pawn.file, oneRank))) {
    moves.push({ file: pawn.file, rank: oneRank, kind: "move" });

    const twoRank = pawn.rank + (direction * 2);
    if (!pawn.hasMoved && isOnBoard(pawn.file, twoRank) && !occupied.has(squareKey(pawn.file, twoRank))) {
      moves.push({ file: pawn.file, rank: twoRank, kind: "move" });
    }
  }

  for (const file of [pawn.file - 1, pawn.file + 1]) {
    if (!isOnBoard(file, oneRank)) continue;

    const occupant = occupied.get(squareKey(file, oneRank));
    if (occupant && occupant.side !== pawn.side) {
      moves.push({ file, rank: oneRank, kind: "capture", tokenId: occupant.tokenId });
    }
  }

  return moves;
}
