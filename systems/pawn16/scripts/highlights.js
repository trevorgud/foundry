import { SYSTEM_ID, GRID_SIZE, squareToPixel } from "./rules.js";
import { executeAttack, executeMove, legalActionsForToken } from "./action-execution.js";
import { getTurnState } from "./seed.js";

const HIGHLIGHT_LAYER_NAME = "pawn16Highlights";
const COLOR_MOVE = 0x44bb44;
const COLOR_ATTACK = 0xdd3333;
const MOVE_ALPHA = 0.35;
const ATTACK_ALPHA = 0.4;
const RING_WIDTH = 4;

let highlightContainer = null;

export function initHighlights() {
  Hooks.on("controlToken", onControlToken);
  Hooks.on("canvasReady", clearHighlights);
  Hooks.on("updateActor", onActorUpdated);
}

function onControlToken(token, controlled) {
  if (!controlled) {
    clearHighlights();
    return;
  }
  renderHighlightsForToken(token);
}

function onActorUpdated() {
  const controlled = canvas.tokens?.controlled ?? [];
  if (controlled.length !== 1) return;
  renderHighlightsForToken(controlled[0]);
}

export function renderHighlightsForToken(token) {
  clearHighlights();
  if (!token?.document?.getFlag(SYSTEM_ID, "seedId")) return;

  const turnState = getTurnState();
  if (turnState.gameOver) return;

  const side = token.actor?.system?.side;
  if (!side) return;

  const moves = legalActionsForToken(token.document, "move");
  const attacks = legalActionsForToken(token.document, "attack");

  if (!moves.length && !attacks.length) return;

  const container = getOrCreateContainer();

  for (const action of moves) {
    drawMoveHighlight(container, action.to.file, action.to.rank);
  }

  for (const action of attacks) {
    drawAttackHighlight(container, action.to.file, action.to.rank);
  }
}

export function clearHighlights() {
  if (!highlightContainer) return;
  highlightContainer.removeChildren().forEach(child => child.destroy());
}

function getOrCreateContainer() {
  if (!highlightContainer) {
    highlightContainer = new PIXI.Container();
    highlightContainer.name = HIGHLIGHT_LAYER_NAME;
    highlightContainer.eventMode = "none";
    canvas.tokens.addChildAt(highlightContainer, 0);
  }
  return highlightContainer;
}

function drawMoveHighlight(container, file, rank) {
  const { x, y } = squareToPixel(file, rank);
  const gfx = new PIXI.Graphics();
  gfx.beginFill(COLOR_MOVE, MOVE_ALPHA);
  gfx.drawRect(x + 2, y + 2, GRID_SIZE - 4, GRID_SIZE - 4);
  gfx.endFill();
  gfx.file = file;
  gfx.rank = rank;
  gfx.highlightType = "move";
  gfx.eventMode = "static";
  gfx.cursor = "pointer";
  gfx.on("pointerdown", event => onHighlightClicked(event, file, rank, "move"));
  container.addChild(gfx);
  return gfx;
}

function drawAttackHighlight(container, file, rank) {
  const { x, y } = squareToPixel(file, rank);
  const gfx = new PIXI.Graphics();
  gfx.lineStyle(RING_WIDTH, COLOR_ATTACK, ATTACK_ALPHA);
  gfx.drawRect(x + RING_WIDTH, y + RING_WIDTH, GRID_SIZE - RING_WIDTH * 2, GRID_SIZE - RING_WIDTH * 2);
  gfx.file = file;
  gfx.rank = rank;
  gfx.highlightType = "attack";
  gfx.eventMode = "static";
  gfx.cursor = "pointer";
  gfx.on("pointerdown", event => onHighlightClicked(event, file, rank, "attack"));
  container.addChild(gfx);
  return gfx;
}

async function onHighlightClicked(event, file, rank, actionType) {
  event.stopPropagation();
  const token = canvas.tokens?.controlled?.[0];
  if (!token?.document?.getFlag(SYSTEM_ID, "seedId")) return;

  try {
    if (actionType === "move") {
      await executeMove(canvas.scene, token.document, file, rank, { pawn16Driven: true });
    } else {
      await executeAttack(canvas.scene, token.document, file, rank, { pawn16Driven: true });
    }
  } catch (error) {
    ui.notifications.warn(error.message);
  }
}
