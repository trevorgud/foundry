import { SYSTEM_ID } from "./rules.js";

export const GAME_STATE_ACTOR_NAME = "Pawn16 Game State";
export const GAME_STATE_KIND = "game-state";

export function findGameStateActor() {
  return game.actors.find(actor => actor.getFlag(SYSTEM_ID, "kind") === GAME_STATE_KIND)
    ?? game.actors.getName(GAME_STATE_ACTOR_NAME)
    ?? null;
}

export function getStateFlag(key, fallback = null) {
  const actor = findGameStateActor();
  if (!actor) return fallback;
  return actor.getFlag(SYSTEM_ID, key) ?? fallback;
}

export async function setStateFlag(key, value) {
  const actor = findGameStateActor();
  if (!actor) throw new Error("Pawn16 Game State actor not found.");
  await actor.setFlag(SYSTEM_ID, key, value);
}
