import { PawnDataModel } from "./data-models.js";
import { SYSTEM_ID, legalPawnMoves } from "./rules.js";
import { moveSelectedPawnForward, resetPawn16Board, seedPawn16World, syncPawnStateFromToken } from "./seed.js";
import { assertHealthy, clearSquare, legalMovesForPawn, legalMovesForPiece, setPawnPosition, setPiecePosition, testState, unpause } from "./test-api.js";

Hooks.once("init", () => {
  console.info("Pawn16 | Initializing");

  CONFIG.Actor.dataModels ??= {};
  CONFIG.Actor.dataModels.pawn = PawnDataModel;
  CONFIG.Actor.dataModels.knight = PawnDataModel;

  game.settings.register(SYSTEM_ID, "autoSeed", {
    name: "PAWN16.Settings.AutoSeed.Name",
    hint: "PAWN16.Settings.AutoSeed.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  game.pawn16 = {
    assertHealthy,
    moveSelectedPawnForward,
    resetBoard: resetPawn16Board,
    seedWorld: seedPawn16World,
    legalMovesForPawn,
    legalMovesForPiece,
    setPawnPosition,
    setPiecePosition,
    clearSquare,
    testState,
    unpause,
    rules: {
      legalPawnMoves
    }
  };

  await seedPawn16World();
});

Hooks.on("getSceneControlButtons", controls => {
  if (game.system.id !== SYSTEM_ID) return;

  const tokenControls = controls.tokens;
  if (!tokenControls?.tools) return;

  const order = Object.keys(tokenControls.tools).length;
  tokenControls.tools.pawn16MoveForward = {
    name: "pawn16MoveForward",
    title: "PAWN16.Controls.MoveForward",
    icon: "fa-solid fa-chess-pawn",
    order,
    button: true,
    onChange: () => moveSelectedPawnForward()
  };

  tokenControls.tools.pawn16Reset = {
    name: "pawn16Reset",
    title: "PAWN16.Controls.Reset",
    icon: "fa-solid fa-rotate-left",
    order: order + 1,
    button: true,
    visible: game.user.isGM,
    onChange: () => resetPawn16Board()
  };
});

Hooks.on("preUpdateToken", (_tokenDocument, changed) => {
  if (game.system.id !== SYSTEM_ID) return;

  if ("rotation" in changed && changed.rotation !== 0) changed.rotation = 0;
  if ("lockRotation" in changed && changed.lockRotation !== true) changed.lockRotation = true;

  if ("x" in changed || "y" in changed) {
    changed.rotation = 0;
    changed.lockRotation = true;
  }
});

Hooks.on("updateToken", (tokenDocument, changed) => {
  if (game.system.id !== SYSTEM_ID) return;
  syncPawnStateFromToken(tokenDocument, changed);
});
