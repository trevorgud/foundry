import { SYSTEM_ID } from "./rules.js";
import { getTurnState } from "./seed.js";
import { findGameStateActor } from "./game-state.js";

const HUD_ID = "pawn16-hud";

export function initHUD() {
  Hooks.on("canvasReady", renderHUD);
  Hooks.on("updateActor", onActorUpdated);
}

function onActorUpdated(actor) {
  if (actor.getFlag(SYSTEM_ID, "kind") === "game-state") renderHUD();
}

function renderHUD() {
  if (!findGameStateActor()) return;
  const el = getOrCreateElement();
  const state = getTurnState();
  el.innerHTML = buildHTML(state);
}

function getOrCreateElement() {
  let el = document.getElementById(HUD_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = HUD_ID;
    document.body.appendChild(el);
  }
  return el;
}

function buildHTML(state) {
  if (state.gameOver) {
    const winner = capitalize(state.gameOver.winner);
    return `<div class="pawn16-hud-inner pawn16-gameover">
      <span class="pawn16-hud-label">Game over</span>
      <span class="pawn16-hud-winner">${winner} wins</span>
      <span class="pawn16-hud-turn">Turn ${state.gameOver.turn}</span>
    </div>`;
  }

  const side = capitalize(state.currentSide);
  const sideClass = state.currentSide === "white" ? "pawn16-side-white" : "pawn16-side-black";
  const moveIcon = state.movementUsed ? "&#10003;" : "&mdash;";
  const attackIcon = state.attackUsed ? "&#10003;" : "&mdash;";

  return `<div class="pawn16-hud-inner">
    <span class="pawn16-hud-label">Turn ${state.turnNumber}</span>
    <span class="pawn16-hud-side ${sideClass}">${side} to move</span>
    <span class="pawn16-hud-actions">Move ${moveIcon} &nbsp; Attack ${attackIcon}</span>
  </div>`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
