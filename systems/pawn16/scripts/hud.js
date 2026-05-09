import { SYSTEM_ID } from "./rules.js";
import { getTurnState } from "./seed.js";
import { findGameStateActor } from "./game-state.js";
import { getUserSide } from "./sides.js";

const HUD_ID = "pawn16-hud";
let _lastCurrentSide = null;

export function initHUD() {
  Hooks.on("canvasReady", renderHUD);
  Hooks.on("updateActor", onActorUpdated);
}

function onActorUpdated(actor) {
  if (actor.getFlag(SYSTEM_ID, "kind") !== "game-state") return;
  const state = getTurnState();
  if (state.currentSide !== _lastCurrentSide) {
    _lastCurrentSide = state.currentSide;
    renderHUD();
    notifyIfYourTurn(state);
  } else {
    renderHUD();
  }
}

function notifyIfYourTurn(state) {
  if (state.gameOver) return;
  const mySide = getUserSide(game.user?.id);
  if (mySide && mySide === state.currentSide) {
    ui.notifications.info(`Your turn — ${capitalize(mySide)} to move.`);
  }
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
  const mySide = getUserSide(game.user?.id);

  if (state.gameOver) {
    const winner = capitalize(state.gameOver.winner);
    const isMyWin = mySide === state.gameOver.winner;
    return `<div class="pawn16-hud-inner pawn16-gameover">
      <span class="pawn16-hud-label">Game over</span>
      <span class="pawn16-hud-winner">${winner} wins${isMyWin ? " ★" : ""}</span>
      <span class="pawn16-hud-turn">Turn ${state.gameOver.turn}</span>
      ${mySide ? `<span class="pawn16-hud-identity">You: ${capitalize(mySide)}</span>` : ""}
    </div>`;
  }

  const isMyTurn = mySide && mySide === state.currentSide;
  const turnClass = isMyTurn ? "pawn16-my-turn" : "";
  const side = capitalize(state.currentSide);
  const sideClass = state.currentSide === "white" ? "pawn16-side-white" : "pawn16-side-black";
  const moveIcon = state.movementUsed ? "&#10003;" : "&mdash;";
  const attackIcon = state.attackUsed ? "&#10003;" : "&mdash;";

  return `<div class="pawn16-hud-inner ${turnClass}">
    <span class="pawn16-hud-label">Turn ${state.turnNumber}</span>
    <span class="pawn16-hud-side ${sideClass}">${side} to move${isMyTurn ? " ◄" : ""}</span>
    <span class="pawn16-hud-actions">Move ${moveIcon} &nbsp; Attack ${attackIcon}</span>
    ${mySide ? `<span class="pawn16-hud-identity">You: ${capitalize(mySide)}</span>` : ""}
  </div>`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
