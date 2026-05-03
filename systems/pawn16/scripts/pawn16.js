import { PawnDataModel } from "./data-models.js";
import { SYSTEM_ID, legalPawnMoves } from "./rules.js";
import { moveSelectedPawnForward, resetPawn16Board, seedPawn16World } from "./seed.js";

Hooks.once("init", () => {
  console.info("Pawn16 | Initializing");

  CONFIG.Actor.dataModels ??= {};
  CONFIG.Actor.dataModels.pawn = PawnDataModel;

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
    moveSelectedPawnForward,
    resetBoard: resetPawn16Board,
    seedWorld: seedPawn16World,
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
