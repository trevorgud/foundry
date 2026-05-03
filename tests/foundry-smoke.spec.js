import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const baseURL = process.env.FOUNDRY_URL ?? "http://localhost:30000";

test("Pawn16 world is healthy", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);

  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });
  await page.waitForFunction(() => globalThis.game?.pawn16?.assertHealthy, null, { timeout: 45000 });

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
