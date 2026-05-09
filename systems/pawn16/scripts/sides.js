import { SYSTEM_ID } from "./rules.js";

export const SIDES = ["white", "black"];

export function getSidePlayerId(side) {
  if (!SIDES.includes(side)) return null;
  const settingKey = side === "white" ? "whitePlayerId" : "blackPlayerId";
  const value = game.settings.get(SYSTEM_ID, settingKey);
  return value || null;
}

export function getSidePlayer(side) {
  const id = getSidePlayerId(side);
  return id ? game.users.get(id) ?? null : null;
}

export function getUserSide(userId) {
  if (!userId) return null;
  for (const side of SIDES) {
    if (getSidePlayerId(side) === userId) return side;
  }
  return null;
}

export function assertUserCanActForSide(side, { user = game.user } = {}) {
  if (user?.isGM) return;
  const userSide = getUserSide(user?.id);
  if (userSide !== side) {
    throw new Error(`Only the ${side} player can act for ${side}.`);
  }
}

export function buildPlayerOwnership() {
  const ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
  };
  for (const side of SIDES) {
    const id = getSidePlayerId(side);
    if (id) ownership[id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  }
  return ownership;
}
