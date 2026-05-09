import test from "node:test";
import assert from "node:assert/strict";
import {
  generateLegalActions,
  generateLegalAttacks,
  generateLegalMoves,
  getPieceProfile,
  squareKey,
  toLegacyMove
} from "../systems/pawn16/scripts/movement-engine.js";

const pawnProfile = getPieceProfile("pawn");
const knightProfile = getPieceProfile("knight");
const bishopProfile = getPieceProfile("bishop");
const kingProfile = getPieceProfile("king");

test("pawn can move exactly one square in each orthogonal direction when clear", () => {
  const piece = makePiece({ side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition();
  const moves = generateLegalMoves(position, piece, pawnProfile);

  assert.equal(moves.length, 4);
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 13 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 15 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 6, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 8, rank: 14 } }));
});

test("pawn orthogonal moves are blocked only on occupied target squares", () => {
  const piece = makePiece({ side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition([
    makePiece({ id: "blocker", side: "black", file: 7, rank: 13, hasMoved: true }),
    makePiece({ id: "ally", side: "white", file: 8, rank: 14, hasMoved: true })
  ]);
  const moves = generateLegalMoves(position, piece, pawnProfile);

  assert.ok(!hasMove(moves, { kind: "move", to: { file: 7, rank: 13 } }));
  assert.ok(!hasMove(moves, { kind: "move", to: { file: 8, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 6, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 15 } }));
});

test("pawn movement is unchanged by hasMoved state", () => {
  const piece = makePiece({ side: "white", file: 7, rank: 13, hasMoved: true });
  const position = makePosition();
  const moves = generateLegalMoves(position, piece, pawnProfile);

  assert.equal(moves.length, 4);
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 12 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 6, rank: 13 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 8, rank: 13 } }));
});

test("pawn attacks one adjacent orthogonal or diagonal enemy", () => {
  const piece = makePiece({ side: "white", file: 7, rank: 7 });
  const position = makePosition([
    makePiece({ id: "north", tokenId: "north-token", side: "black", file: 7, rank: 6 }),
    makePiece({ id: "northwest", side: "black", file: 6, rank: 6 }),
    makePiece({ id: "northeast", side: "black", file: 8, rank: 6 }),
    makePiece({ id: "south", side: "black", file: 7, rank: 8 }),
    makePiece({ id: "west", side: "black", file: 6, rank: 7 }),
    makePiece({ id: "east", side: "white", file: 8, rank: 7 })
  ]);
  const attacks = generateLegalAttacks(position, piece, pawnProfile);

  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 7, rank: 6 }, tokenId: "north-token" }));
  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 6, rank: 6 } }));
  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 8, rank: 6 } }));
  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 7, rank: 8 } }));
  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 6, rank: 7 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 8, rank: 7 } }));
});

test("knight can move one or two orthogonal squares when path is clear", () => {
  const piece = makePiece({ type: "knight", side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition();
  const moves = generateLegalMoves(position, piece, knightProfile);

  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 13 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 12 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 15 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 6, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 5, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 8, rank: 14 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 9, rank: 14 } }));
});

test("knight two-square move is blocked by an occupied intermediate square", () => {
  const piece = makePiece({ type: "knight", side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition([
    makePiece({ id: "blocker", side: "black", file: 7, rank: 13, hasMoved: true })
  ]);
  const moves = generateLegalMoves(position, piece, knightProfile);

  assert.ok(!hasMove(moves, { kind: "move", to: { file: 7, rank: 12 } }));
  assert.ok(!hasMove(moves, { kind: "move", to: { file: 7, rank: 13 } }));
});

test("knight cannot land on occupied square", () => {
  const piece = makePiece({ type: "knight", side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition([
    makePiece({ id: "enemy", side: "black", file: 8, rank: 14, hasMoved: true }),
    makePiece({ id: "ally", side: "white", file: 6, rank: 14, hasMoved: true })
  ]);
  const moves = generateLegalMoves(position, piece, knightProfile);

  assert.ok(!hasMove(moves, { kind: "move", to: { file: 8, rank: 14 } }));
  assert.ok(!hasMove(moves, { kind: "move", to: { file: 6, rank: 14 } }));
});

test("knight attacks only one orthogonal enemy", () => {
  const piece = makePiece({ type: "knight", side: "white", file: 7, rank: 7 });
  const position = makePosition([
    makePiece({ id: "adjacent", side: "black", file: 7, rank: 6 }),
    makePiece({ id: "two-away", side: "black", file: 7, rank: 5 }),
    makePiece({ id: "diagonal", side: "black", file: 6, rank: 6 })
  ]);
  const attacks = generateLegalAttacks(position, piece, knightProfile);

  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 7, rank: 6 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 7, rank: 5 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 6, rank: 6 } }));
});

test("bishop moves one orthogonal square and attacks exactly two or three orthogonal squares", () => {
  const piece = makePiece({ type: "bishop", side: "white", file: 7, rank: 7 });
  const position = makePosition([
    makePiece({ id: "adjacent-enemy", side: "black", file: 7, rank: 6 }),
    makePiece({ id: "two-away", side: "black", file: 7, rank: 5 }),
    makePiece({ id: "three-away", side: "black", file: 4, rank: 7 }),
    makePiece({ id: "four-away", side: "black", file: 7, rank: 3 }),
    makePiece({ id: "diagonal", side: "black", file: 8, rank: 8 })
  ]);
  const moves = generateLegalMoves(position, piece, bishopProfile);
  const attacks = generateLegalAttacks(position, piece, bishopProfile);

  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 8 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 6, rank: 7 } }));
  assert.ok(!hasMove(moves, { kind: "move", to: { file: 7, rank: 6 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 7, rank: 6 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 7, rank: 5 } }));
  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 4, rank: 7 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 7, rank: 3 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 8, rank: 8 } }));
});

test("bishop long attack requires clear path", () => {
  const piece = makePiece({ type: "bishop", side: "white", file: 7, rank: 7 });
  const position = makePosition([
    makePiece({ id: "blocker", side: "white", file: 7, rank: 6 }),
    makePiece({ id: "target", side: "black", file: 7, rank: 5 })
  ]);
  const attacks = generateLegalAttacks(position, piece, bishopProfile);

  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 7, rank: 5 } }));
});

test("king moves and attacks one orthogonal square only", () => {
  const piece = makePiece({ type: "king", side: "white", file: 7, rank: 7 });
  const position = makePosition([
    makePiece({ id: "enemy", side: "black", file: 7, rank: 6 }),
    makePiece({ id: "two-away", side: "black", file: 7, rank: 5 }),
    makePiece({ id: "diagonal", side: "black", file: 8, rank: 8 })
  ]);
  const moves = generateLegalMoves(position, piece, kingProfile);
  const attacks = generateLegalAttacks(position, piece, kingProfile);

  assert.ok(hasMove(moves, { kind: "move", to: { file: 7, rank: 8 } }));
  assert.ok(hasMove(moves, { kind: "move", to: { file: 6, rank: 7 } }));
  assert.ok(!hasMove(moves, { kind: "move", to: { file: 7, rank: 6 } }));
  assert.ok(hasMove(attacks, { kind: "attack", to: { file: 7, rank: 6 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 7, rank: 5 } }));
  assert.ok(!hasMove(attacks, { kind: "attack", to: { file: 8, rank: 8 } }));
});

test("off-board targets are excluded at board edges", () => {
  const piece = makePiece({ side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition();
  const cornerPawn = generateLegalMoves(position, makePiece({ side: "white", file: 0, rank: 0, hasMoved: true }), pawnProfile);
  const cornerKnight = generateLegalMoves(position, makePiece({ type: "knight", side: "white", file: 0, rank: 0 }), knightProfile);
  const cornerKingAttacks = generateLegalActions(
    makePosition([makePiece({ id: "enemy", side: "black", file: 0, rank: 1 })]),
    makePiece({ type: "king", side: "white", file: 0, rank: 0 }),
    kingProfile,
    { actionType: "attack" }
  );
  assert.equal(cornerPawn.length, 2);
  assert.equal(cornerKnight.length, 4);
  assert.equal(cornerKingAttacks.length, 1);
});

test("generated moves have normalized shape and legacy mapping remains compatible", () => {
  const piece = makePiece({ side: "white", file: 7, rank: 14, hasMoved: false });
  const position = makePosition();
  const moves = generateLegalMoves(position, piece, pawnProfile);
  const move = moves.find(candidate => candidate.kind === "move" && candidate.to.file === 7 && candidate.to.rank === 13);
  assert.ok(move);
  assert.equal(move.actionType, "move");
  assert.equal(move.patternId, "pawn-step");
  assert.deepEqual(move.from, { file: 7, rank: 14 });
  assert.deepEqual(move.to, { file: 7, rank: 13 });
  assert.equal(move.capture, null);

  const legacy = toLegacyMove(move);
  assert.deepEqual(legacy, {
    file: 7,
    rank: 13,
    kind: "move",
    tokenId: null
  });
});

function makePosition(occupants = [], boardSize = 16) {
  const occupancy = new Map();
  const pieces = [];

  for (const occupant of occupants) {
    pieces.push(occupant);
    occupancy.set(squareKey(occupant.file, occupant.rank), occupant);
  }

  return { boardSize, pieces, occupancy };
}

function makePiece({
  id = "piece",
  tokenId = null,
  type = "pawn",
  side = "white",
  file = 0,
  rank = 0,
  hasMoved = false
} = {}) {
  return { id, tokenId, type, side, file, rank, hasMoved };
}

function hasMove(moves, expected) {
  return moves.some(move => {
    return move.kind === expected.kind
      && move.to.file === expected.to.file
      && move.to.rank === expected.to.rank
      && (expected.tokenId === undefined || move.capture?.tokenId === expected.tokenId);
  });
}
