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

test.describe("Pawn16 pawn rules", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await loadFoundry(page);
    await page.evaluate(async () => {
      await game.pawn16.resetBoard();
      await new Promise(resolve => setTimeout(resolve, 250));
    });
  });

  test("allows one-step and two-step opening moves", async ({ page }) => {
    const moves = await legalMovesForPawn(page, "white", 7);
    expect(hasMove(moves, { file: 7, rank: 13, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 7, rank: 12, kind: "move" })).toBe(true);
  });

  test("disallows two-step after pawn has moved", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.setPawnPosition("white", 7, 7, 13, { hasMoved: true });
    });

    const moves = await legalMovesForPawn(page, "white", 7);
    expect(hasMove(moves, { file: 7, rank: 12, kind: "move" })).toBe(true);
    expect(hasMove(moves, { file: 7, rank: 11, kind: "move" })).toBe(false);
  });

  test("disallows forward movement when blocked", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.setPawnPosition("white", 6, 7, 13, { hasMoved: true });
    });

    const moves = await legalMovesForPawn(page, "white", 7);
    const forwardMoves = moves.filter(move => move.kind === "move");
    expect(forwardMoves).toEqual([]);
  });

  test("allows diagonal capture only against opposing pawns", async ({ page }) => {
    await page.evaluate(async () => {
      await game.pawn16.setPawnPosition("black", 8, 8, 13, { hasMoved: true });
    });

    const enemyMoves = await legalMovesForPawn(page, "white", 7);
    expect(hasMove(enemyMoves, { file: 8, rank: 13, kind: "capture" })).toBe(true);

    await page.evaluate(async () => {
      await game.pawn16.resetBoard();
      await new Promise(resolve => setTimeout(resolve, 250));
      await game.pawn16.setPawnPosition("white", 8, 8, 13, { hasMoved: true });
    });

    const friendlyMoves = await legalMovesForPawn(page, "white", 7);
    expect(hasMove(friendlyMoves, { file: 8, rank: 13, kind: "capture" })).toBe(false);
  });
});

async function legalMovesForPawn(page, side, file) {
  return page.evaluate(({ sideValue, fileValue }) => {
    return game.pawn16.legalMovesForPawn(sideValue, fileValue);
  }, { sideValue: side, fileValue: file });
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
