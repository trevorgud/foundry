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
      await game.pawn16.clearSquare(7, 14);
      await game.pawn16.clearSquare(7, 13);
      await game.pawn16.clearSquare(7, 12);
      await game.pawn16.clearSquare(7, 1);
      await game.pawn16.clearSquare(7, 2);
      await game.pawn16.clearSquare(6, 0);
      await game.pawn16.clearSquare(5, 0);
      await game.pawn16.clearSquare(8, 0);
      await game.pawn16.clearSquare(9, 0);
    });

    const moves = await legalMovesForPiece(page, "knight", "black", 7);
    expect(hasMove(moves, { file: 7, rank: 1, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 7, rank: 2, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 6, rank: 0, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 5, rank: 0, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 8, rank: 0, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 9, rank: 0, kind: "move" })).toBe(true);
  });

  test("knight two-square path is blocked by intervening piece", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.clearSquare(7, 2);
    });

    const moves = await legalMovesForPiece(page, "knight", "black", 7);
    expect(hasMove(moves, { file: 7, rank: 1, kind: "move" })).toBe(false);
    expect(hasMove(moves, { file: 7, rank: 2, kind: "move" })).toBe(false);
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

  await page.locator("select[name='userid']").waitFor({ timeout: 30000 });
  const joinButton = page.getByRole("button", { name: /join game session/i });
  await page.locator("select[name='userid']").selectOption({ label: "Gamemaster" });
  await page.locator("input[type='password'], input[name='password']").first().fill("");
  await Promise.all([
    page.waitForURL(/\/game/, { timeout: 30000 }),
    joinButton.click()
  ]);
}
