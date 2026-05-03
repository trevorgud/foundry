import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const baseURL = process.env.FOUNDRY_URL ?? "http://localhost:30000";
const output = process.env.FOUNDRY_SCREENSHOT_OUTPUT ?? "test-results/pawn16-board.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });
  await page.waitForFunction(() => globalThis.canvas?.ready === true, null, { timeout: 45000 });
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({ path: output, fullPage: false });
  console.log(`Saved screenshot: ${output}`);
} finally {
  await browser.close();
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
