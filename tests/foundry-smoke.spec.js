import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const baseURL = process.env.FOUNDRY_URL ?? "http://localhost:30000";

test("Pawn16 world is healthy", async ({ page }) => {
  test.setTimeout(60000);
  await loadFoundry(page);

  const result = await page.evaluate(async () => {
    await game.pawn16.resetBoard();
    await new Promise(resolve => setTimeout(resolve, 250));
    return game.pawn16.assertHealthy();
  });

  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile("test-results/pawn16-state.json", `${JSON.stringify(result, null, 2)}\n`);
  await page.screenshot({ path: "test-results/pawn16-board.png", fullPage: false });

  expect(result.issues).toEqual([]);
  expect(result.ok).toBe(true);
});

test.describe("Pawn16 piece rules", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await loadFoundry(page);
    await page.evaluate(async () => {
      await game.pawn16.resetBoard();
      await new Promise(resolve => setTimeout(resolve, 250));
    });
  });

  test("pawn moves exactly one square orthogonally when destinations are open", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.clearSquare(6, 14);
      await game.pawn16.clearSquare(8, 14);
      await game.pawn16.clearSquare(7, 15);
    });

    const moves = await legalMovesForPawn(page, "white", 7);
    expect(hasMove(moves, { file: 7, rank: 13, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 7, rank: 15, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 6, rank: 14, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 8, rank: 14, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 7, rank: 12, kind: "move" })).toBe(false);
    expect(moves.filter(move => move.kind === "move")).toHaveLength(4);
  });

  test("pawn cannot move into occupied orthogonal squares", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.setPawnPosition("white", 6, 7, 13, { hasMoved: true });
      await game.pawn16.setPawnPosition("black", 8, 6, 14, { hasMoved: true });
    });

    const moves = await legalMovesForPawn(page, "white", 7);
    expect(hasMove(moves, { file: 7, rank: 13, kind: "move" })).toBe(false);
    expect(hasMove(moves, { file: 6, rank: 14, kind: "move" })).toBe(false);
  });

  test("knight can move one or two orthogonal squares when path is clear", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.clearSquare(8, 14);
      await game.pawn16.clearSquare(8, 13);
      await game.pawn16.clearSquare(8, 12);
      await game.pawn16.clearSquare(8, 1);
      await game.pawn16.clearSquare(8, 2);
      await game.pawn16.clearSquare(6, 0);
      await game.pawn16.clearSquare(7, 0);
      await game.pawn16.clearSquare(9, 0);
      await game.pawn16.clearSquare(10, 0);
    });

    const moves = await legalMovesForPiece(page, "knight", "black", 8);
    expect(hasMove(moves, { file: 8, rank: 1, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 8, rank: 2, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 7, rank: 0, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 6, rank: 0, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 9, rank: 0, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 10, rank: 0, kind: "move" })).toBe(true);
  });

  test("knight two-square path is blocked by intervening piece", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.clearSquare(8, 2);
    });

    const moves = await legalMovesForPiece(page, "knight", "black", 8);
    expect(hasMove(moves, { file: 8, rank: 1, kind: "move" })).toBe(false);
    expect(hasMove(moves, { file: 8, rank: 2, kind: "move" })).toBe(false);
  });

  test("pawn can attack one adjacent or diagonal enemy", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.clearSquare(8, 14);
      await game.pawn16.setPiecePosition("pawn", "black", 6, 6, 13, { hasMoved: true });
      await game.pawn16.setPiecePosition("pawn", "black", 8, 8, 14, { hasMoved: true });
    });

    const attacks = await legalAttacksForPiece(page, "pawn", "white", 7);
    expect(hasMove(attacks, { file: 6, rank: 13, kind: "attack" })).toBe(true);
    expect(hasMove(attacks, { file: 8, rank: 14, kind: "attack" })).toBe(true);
    expect(hasMove(attacks, { file: 7, rank: 12, kind: "attack" })).toBe(false);
  });

  test("bishop attacks two or three orthogonal squares but not one", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.setPiecePosition("bishop", "white", 1, 7, 7, { hasMoved: true });
      await game.pawn16.clearSquare(7, 6);
      await game.pawn16.clearSquare(7, 5);
      await game.pawn16.clearSquare(4, 7);
      await game.pawn16.setPiecePosition("pawn", "black", 5, 7, 5, { hasMoved: true });
      await game.pawn16.setPiecePosition("pawn", "black", 6, 4, 7, { hasMoved: true });
      await game.pawn16.setPiecePosition("pawn", "black", 7, 7, 6, { hasMoved: true });
    });

    const attacks = await legalAttacksForPiece(page, "bishop", "white", 1);
    expect(hasMove(attacks, { file: 7, rank: 6, kind: "attack" })).toBe(false);
    expect(hasMove(attacks, { file: 7, rank: 5, kind: "attack" })).toBe(false);
    expect(hasMove(attacks, { file: 4, rank: 7, kind: "attack" })).toBe(true);

    await page.evaluate(async () => {
      await game.pawn16.clearSquare(7, 6);
    });

    const unblockedAttacks = await legalAttacksForPiece(page, "bishop", "white", 1);
    expect(hasMove(unblockedAttacks, { file: 7, rank: 5, kind: "attack" })).toBe(true);
    expect(hasMove(unblockedAttacks, { file: 4, rank: 7, kind: "attack" })).toBe(true);
  });

  test("turn allows one movement and one attack before ending", async ({ page }) => {
    const result = await page.evaluate(async () => {
      await game.pawn16.setAutoEndTurn(false);
      await game.pawn16.clearSquare(7, 13);
      await game.pawn16.clearSquare(6, 13);
      const moveResult = await game.pawn16.movePiece("pawn", "white", 7, 7, 13);

      let secondMoveError = null;
      try {
        await game.pawn16.movePiece("pawn", "white", 6, 6, 13);
      } catch (error) {
        secondMoveError = error.message;
      }

      await game.pawn16.setPiecePosition("pawn", "black", 6, 6, 12, { hasMoved: true });
      const attackResult = await game.pawn16.attackPiece("pawn", "white", 7, 6, 12);

      let secondAttackError = null;
      try {
        await game.pawn16.attackPiece("pawn", "white", 7, 7, 12);
      } catch (error) {
        secondAttackError = error.message;
      }

      const beforeEnd = game.pawn16.turnState();
      const actionLog = game.pawn16.actionLog();
      const afterEnd = await game.pawn16.endTurn();
      return { moveResult, attackResult, secondMoveError, secondAttackError, beforeEnd, afterEnd, actionLog };
    });

    expect(result.moveResult).toMatchObject({
      ok: true,
      actionType: "move",
      actor: { seedId: "pawn-white-7", pieceType: "pawn", side: "white" },
      from: { file: 7, rank: 14 },
      to: { file: 7, rank: 13 },
      effects: [
        { type: "move-token" },
        { type: "update-actor-position" }
      ],
      turn: {
        consumed: "move",
        before: { movementUsed: false, attackUsed: false },
        after: { movementUsed: true, attackUsed: false }
      }
    });
    expect(result.attackResult).toMatchObject({
      ok: true,
      actionType: "attack",
      actor: { seedId: "pawn-white-7", pieceType: "pawn", side: "white" },
      target: { seedId: "pawn-black-6", pieceType: "pawn", side: "black" },
      to: { file: 6, rank: 12 },
      effects: [
        { type: "capture-token", pieceId: "pawn-black-6" }
      ],
      turn: {
        consumed: "attack",
        before: { movementUsed: true, attackUsed: false },
        after: { movementUsed: true, attackUsed: true }
      }
    });
    expect(result.secondMoveError).toContain("already used movement");
    expect(result.secondAttackError).toContain("already used an attack");
    expect(result.actionLog).toHaveLength(2);
    expect(result.actionLog.map(entry => entry.actionType)).toEqual(["move", "attack"]);
    expect(result.beforeEnd).toMatchObject({
      currentSide: "white",
      turnNumber: 1,
      movementUsed: true,
      attackUsed: true
    });
    expect(result.afterEnd).toMatchObject({
      currentSide: "black",
      turnNumber: 1,
      movementUsed: false,
      attackUsed: false
    });
  });

  test("king moves and attacks one orthogonal square only", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.setPiecePosition("king", "white", 7, 7, 7, { hasMoved: true });
      await game.pawn16.clearSquare(7, 6);
      await game.pawn16.clearSquare(7, 5);
      await game.pawn16.clearSquare(6, 0);
      await game.pawn16.setPiecePosition("pawn", "black", 6, 7, 6, { hasMoved: true });
      await game.pawn16.setPiecePosition("pawn", "black", 5, 7, 5, { hasMoved: true });
    });

    const moves = await legalMovesForPiece(page, "king", "white", 7);
    const attacks = await legalAttacksForPiece(page, "king", "white", 7);
    expect(hasMove(moves, { file: 7, rank: 6, kind: "move" })).toBe(false);
    expect(hasMove(moves, { file: 6, rank: 7, kind: "move" })).toBe(true);
    expect(hasMove(attacks, { file: 7, rank: 6, kind: "attack" })).toBe(true);
    expect(hasMove(attacks, { file: 7, rank: 5, kind: "attack" })).toBe(false);
  });
});

async function legalMovesForPawn(page, side, file) {
  return legalMovesForPiece(page, "pawn", side, file);
}

async function legalMovesForPiece(page, type, side, file) {
  return page.evaluate(({ typeValue, sideValue, fileValue }) => {
    return game.pawn16.legalMovesForPiece(typeValue, sideValue, fileValue);
  }, { typeValue: type, sideValue: side, fileValue: file });
}

async function legalAttacksForPiece(page, type, side, file) {
  return page.evaluate(({ typeValue, sideValue, fileValue }) => {
    return game.pawn16.legalAttacksForPiece(typeValue, sideValue, fileValue);
  }, { typeValue: type, sideValue: side, fileValue: file });
}

function hasMove(moves, expected) {
  return moves.some(move => {
    return move.file === expected.file
      && move.rank === expected.rank
      && move.kind === expected.kind;
  });
}

async function loadFoundry(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });
  await page.waitForFunction(() => globalThis.game?.pawn16?.assertHealthy, null, { timeout: 45000 });
}

async function loginIfNeeded(page) {
  await page.waitForURL(/\/(?:join|game)/, { timeout: 30000 });
  if (page.url().includes("/game")) return;

  const userSelect = page.locator("select[name='userid']");
  await userSelect.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const select = document.querySelector("select[name='userid']");
    if (!(select instanceof HTMLSelectElement)) return false;
    return Array.from(select.options).some(option => {
      return option.label === "Gamemaster" && !option.disabled;
    });
  }, null, { timeout: 90000 });
  const joinButton = page.getByRole("button", { name: /join game session/i });
  await userSelect.selectOption({ label: "Gamemaster" });
  await page.locator("input[type='password'], input[name='password']").first().fill("");
  await Promise.all([
    page.waitForURL(/\/game/, { timeout: 30000 }),
    joinButton.click()
  ]);
}
