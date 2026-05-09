import { SYSTEM_ID, squareToPixel } from "./rules.js";
import { positionFromScene, pieceFromToken } from "./movement-adapters.js";
import { generateLegalAttacks, generateLegalMoves, getMovementProfile } from "./movement-engine.js";
import { getStateFlag, setStateFlag } from "./game-state.js";

const TURN_STATE_FLAG = "turnState";
const ACTION_LOG_FLAG = "actionLog";
const MAX_ACTION_LOG_ENTRIES = 50;

export function initialTurnState() {
  return {
    currentSide: "white",
    turnNumber: 1,
    movementUsed: false,
    attackUsed: false
  };
}

export function getTurnState(_scene) {
  return getStateFlag(TURN_STATE_FLAG, initialTurnState());
}

export async function ensureTurnState(_scene, { reset = false } = {}) {
  if (reset || !getStateFlag(TURN_STATE_FLAG)) {
    await setStateFlag(TURN_STATE_FLAG, initialTurnState());
  }
}

export async function endTurn(_scene) {
  const state = getTurnState();
  const nextSide = state.currentSide === "white" ? "black" : "white";
  const nextTurn = state.currentSide === "black" ? state.turnNumber + 1 : state.turnNumber;
  const nextState = {
    currentSide: nextSide,
    turnNumber: nextTurn,
    movementUsed: false,
    attackUsed: false
  };
  await setStateFlag(TURN_STATE_FLAG, nextState);
  return nextState;
}

export function getActionLog(_scene) {
  return getStateFlag(ACTION_LOG_FLAG, []);
}

export async function clearActionLog(_scene) {
  await setStateFlag(ACTION_LOG_FLAG, []);
}

export function legalActionsForToken(tokenDocument, actionType) {
  const scene = tokenDocument.parent ?? canvas.scene;
  const from = {
    file: tokenDocument.actor.system.file,
    rank: tokenDocument.actor.system.rank
  };
  const position = positionFromScene(scene);
  position.occupancy.delete(`${from.file},${from.rank}`);
  const piece = pieceFromToken(tokenDocument);
  const profile = getMovementProfile(piece.type);
  return actionType === "attack"
    ? generateLegalAttacks(position, piece, profile)
    : generateLegalMoves(position, piece, profile);
}

export async function executeMove(scene, tokenDocument, targetFile, targetRank) {
  const turnState = getTurnState();
  assertCanUseAction(tokenDocument.actor.system.side, "move", turnState);

  const action = legalActionsForToken(tokenDocument, "move")
    .find(candidate => candidate.to.file === targetFile && candidate.to.rank === targetRank);
  if (!action) throw new Error(`Illegal move for ${tokenDocument.getFlag(SYSTEM_ID, "seedId")} to ${targetFile},${targetRank}.`);

  const effects = moveEffects(tokenDocument, action);
  await applyEffects(scene, effects);
  const nextTurnState = await markActionUsed("move");
  const result = createActionResult({
    action,
    actionType: "move",
    actorToken: tokenDocument,
    targetToken: null,
    effects,
    turnBefore: turnState,
    turnAfter: nextTurnState
  });
  await appendActionLog(result);
  return result;
}

export async function executeAttack(scene, tokenDocument, targetFile, targetRank) {
  const turnState = getTurnState();
  assertCanUseAction(tokenDocument.actor.system.side, "attack", turnState);

  const action = legalActionsForToken(tokenDocument, "attack")
    .find(candidate => candidate.to.file === targetFile && candidate.to.rank === targetRank);
  if (!action) throw new Error(`Illegal attack for ${tokenDocument.getFlag(SYSTEM_ID, "seedId")} at ${targetFile},${targetRank}.`);

  const targetToken = scene.tokens.get(action.capture?.tokenId);
  if (!targetToken) throw new Error("Attack has no target token.");

  const effects = attackEffects(action);
  await applyEffects(scene, effects);
  const nextTurnState = await markActionUsed("attack");
  const result = createActionResult({
    action,
    actionType: "attack",
    actorToken: tokenDocument,
    targetToken,
    effects,
    turnBefore: turnState,
    turnAfter: nextTurnState
  });
  await appendActionLog(result);
  return result;
}

export function assertCanUseAction(side, actionType, state) {
  if (state.currentSide !== side) throw new Error(`It is ${state.currentSide}'s turn.`);
  if (actionType === "move" && state.movementUsed) throw new Error(`${capitalize(side)} has already used movement this turn.`);
  if (actionType === "attack" && state.attackUsed) throw new Error(`${capitalize(side)} has already used an attack this turn.`);
}

function moveEffects(tokenDocument, action) {
  const pixel = squareToPixel(action.to.file, action.to.rank);
  return [
    {
      type: "move-token",
      tokenId: tokenDocument.id,
      actorId: tokenDocument.actor.id,
      from: action.from,
      to: action.to,
      pixel
    },
    {
      type: "update-actor-position",
      actorId: tokenDocument.actor.id,
      to: action.to,
      hasMoved: true
    }
  ];
}

function attackEffects(action) {
  return [
    {
      type: "capture-token",
      tokenId: action.capture.tokenId,
      pieceId: action.capture.pieceId,
      at: action.to
    }
  ];
}

async function applyEffects(scene, effects) {
  for (const effect of effects) {
    if (effect.type === "move-token") {
      const token = scene.tokens.get(effect.tokenId);
      if (!token) throw new Error(`Token ${effect.tokenId} was not found for move effect.`);
      await token.update({
        ...effect.pixel,
        rotation: 0,
        lockRotation: true
      }, { pawn16Driven: true });
    } else if (effect.type === "update-actor-position") {
      const actor = game.actors.get(effect.actorId);
      if (!actor) throw new Error(`Actor ${effect.actorId} was not found for position effect.`);
      await actor.update({
        "system.file": effect.to.file,
        "system.rank": effect.to.rank,
        "system.hasMoved": effect.hasMoved
      });
    } else if (effect.type === "capture-token") {
      await scene.deleteEmbeddedDocuments("Token", [effect.tokenId]);
    }
  }
}

async function markActionUsed(actionType) {
  const state = getTurnState();
  const nextState = {
    ...state,
    movementUsed: state.movementUsed || actionType === "move",
    attackUsed: state.attackUsed || actionType === "attack"
  };
  await setStateFlag(TURN_STATE_FLAG, nextState);
  return nextState;
}

function createActionResult({ action, actionType, actorToken, targetToken, effects, turnBefore, turnAfter }) {
  return {
    id: actionResultId(),
    ok: true,
    createdAt: new Date().toISOString(),
    actionType,
    patternId: action.patternId,
    actor: pieceSnapshot(actorToken),
    target: targetToken ? pieceSnapshot(targetToken) : null,
    from: action.from,
    to: action.to,
    effects,
    turn: {
      before: turnBefore,
      after: turnAfter,
      consumed: actionType
    }
  };
}

function pieceSnapshot(tokenDocument) {
  return {
    seedId: tokenDocument.getFlag(SYSTEM_ID, "seedId") ?? null,
    tokenId: tokenDocument.id,
    actorId: tokenDocument.actor?.id ?? null,
    pieceType: tokenDocument.getFlag(SYSTEM_ID, "pieceType") ?? tokenDocument.actor?.type ?? null,
    side: tokenDocument.actor?.system?.side ?? null,
    file: tokenDocument.actor?.system?.file ?? null,
    rank: tokenDocument.actor?.system?.rank ?? null
  };
}

async function appendActionLog(result) {
  const nextLog = [...getActionLog(), result].slice(-MAX_ACTION_LOG_ENTRIES);
  await setStateFlag(ACTION_LOG_FLAG, nextLog);
}

function actionResultId() {
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
