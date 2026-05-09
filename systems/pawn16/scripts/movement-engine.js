export const MOVE_TARGET = {
  EMPTY: "empty",
  ENEMY: "enemy",
  ALLY: "ally",
  ANY: "any"
};

export const PATH_RULE = {
  CLEAR: "clear",
  IGNORE: "ignore"
};

export function getMovementProfile(pieceType) {
  if (pieceType === "knight") return knightMovementProfile();
  return pawnMovementProfile();
}

export function pawnMovementProfile() {
  return {
    pieceType: "pawn",
    patterns: [
      {
        id: "pawn-step",
        actionType: "move",
        kind: "move",
        directions: ["forward", "backward", "left", "right"],
        exactDistances: [1],
        target: MOVE_TARGET.EMPTY,
        path: PATH_RULE.IGNORE
      }
    ]
  };
}

export function knightMovementProfile() {
  return {
    pieceType: "knight",
    patterns: [
      {
        id: "knight-orthogonal-step",
        actionType: "move",
        kind: "move",
        directions: ["forward", "backward", "left", "right"],
        distance: { min: 1, max: 2 },
        target: MOVE_TARGET.EMPTY,
        path: PATH_RULE.CLEAR
      }
    ]
  };
}

export function generateLegalMoves(position, piece, profile) {
  if (!position || !piece || !profile?.patterns?.length) return [];
  if (typeof piece.file !== "number" || typeof piece.rank !== "number") return [];

  const moves = [];
  for (const pattern of profile.patterns) {
    const distances = expandDistances(pattern);
    for (const direction of pattern.directions ?? []) {
      const delta = resolveDirectionDelta(piece.side, direction);
      if (!delta) continue;

      for (const distance of distances) {
        if (pattern.allowDistance && !pattern.allowDistance({ piece, distance, position })) continue;

        const to = {
          file: piece.file + (delta.file * distance),
          rank: piece.rank + (delta.rank * distance)
        };
        if (!isOnBoard(position, to.file, to.rank)) continue;
        if (pattern.path !== PATH_RULE.IGNORE && !isPathClear(position, piece, delta, distance)) continue;

        const occupant = pieceAt(position, to.file, to.rank);
        if (!targetAllowed(pattern.target, piece, occupant)) continue;

        moves.push({
          actionType: pattern.actionType ?? "move",
          kind: pattern.kind ?? "move",
          patternId: pattern.id,
          direction,
          distance,
          from: { file: piece.file, rank: piece.rank },
          to,
          capture: occupant ? {
            pieceId: occupant.id,
            tokenId: occupant.tokenId ?? null
          } : null
        });
      }
    }
  }

  return moves;
}

export function toLegacyMove(move) {
  return {
    file: move.to.file,
    rank: move.to.rank,
    kind: move.kind,
    tokenId: move.capture?.tokenId ?? null
  };
}

export function squareKey(file, rank) {
  return `${file},${rank}`;
}

function expandDistances(pattern) {
  if (Array.isArray(pattern.exactDistances) && pattern.exactDistances.length) {
    return pattern.exactDistances;
  }

  const min = pattern.distance?.min ?? 1;
  const max = pattern.distance?.max ?? min;
  const distances = [];
  for (let value = min; value <= max; value += 1) distances.push(value);
  return distances;
}

function resolveDirectionDelta(side, direction) {
  const forward = side === "white" ? -1 : 1;
  const lateral = side === "white" ? -1 : 1;

  switch (direction) {
    case "forward":
      return { file: 0, rank: forward };
    case "backward":
      return { file: 0, rank: -forward };
    case "left":
      return { file: lateral, rank: 0 };
    case "right":
      return { file: -lateral, rank: 0 };
    case "forwardLeft":
      return { file: lateral, rank: forward };
    case "forwardRight":
      return { file: -lateral, rank: forward };
    case "backwardLeft":
      return { file: lateral, rank: -forward };
    case "backwardRight":
      return { file: -lateral, rank: -forward };
    default:
      return null;
  }
}

function isOnBoard(position, file, rank) {
  return file >= 0
    && rank >= 0
    && file < position.boardSize
    && rank < position.boardSize;
}

function isPathClear(position, piece, delta, distance) {
  if (distance <= 1) return true;

  for (let step = 1; step < distance; step += 1) {
    const file = piece.file + (delta.file * step);
    const rank = piece.rank + (delta.rank * step);
    if (pieceAt(position, file, rank)) return false;
  }

  return true;
}

function pieceAt(position, file, rank) {
  return position.occupancy.get(squareKey(file, rank)) ?? null;
}

function targetAllowed(target, piece, occupant) {
  switch (target) {
    case MOVE_TARGET.EMPTY:
      return !occupant;
    case MOVE_TARGET.ENEMY:
      return Boolean(occupant && occupant.side !== piece.side);
    case MOVE_TARGET.ALLY:
      return Boolean(occupant && occupant.side === piece.side);
    case MOVE_TARGET.ANY:
      return true;
    default:
      return !occupant;
  }
}
