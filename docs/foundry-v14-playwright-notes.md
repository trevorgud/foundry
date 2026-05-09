# Foundry V14 Playwright Notes

These notes capture the practical details needed to automate this repo's Foundry VTT v14.360 Docker server with Playwright.

## Server Startup

The Docker image is `ghcr.io/felddy/foundryvtt:14.360.0`.

Important environment variables:

```yaml
FOUNDRY_ADMIN_KEY=${FOUNDRY_ADMIN_KEY:-change-this-admin-password}
FOUNDRY_WORLD=${FOUNDRY_WORLD:-}
CONTAINER_CACHE=/data/container_cache
```

The base `compose.yml` intentionally does not force a world. This keeps `docker compose up -d` as a simple server-only runtime.

`compose.dev.yml` sets:

```yaml
FOUNDRY_WORLD=pawn16-test
```

That setting is important for automation. The container regenerates Foundry's `Config/options.json` from environment variables on startup, so patching `options.json` alone is not reliable for Docker restarts.

When `FOUNDRY_WORLD` is set by the dev overlay, Foundry launches the world during server startup and browser clients land on `/join`, not `/setup`.

## Useful URLs

```text
http://localhost:30000/setup  # setup screen when no world is active
http://localhost:30000/join   # world join page when a world is active
http://localhost:30000/game   # in-world game client after login
```

The root URL redirects based on server state.

## Join Page Shape

For the `pawn16-test` world, the v14 join page has this useful structure:

```html
<select name="userid">
  <option value=""></option>
  <option value="...">Gamemaster</option>
</select>

<input type="password" name="password">

<button type="submit" name="join" class="bright">
  <label>Join Game Session</label>
</button>
```

The Playwright login helper should wait for `/join` or `/game` before deciding what to do. A helper that checks for selectors immediately after `page.goto()` can race before the join page has finished rendering.

Working pattern:

```js
await page.goto(process.env.FOUNDRY_URL ?? "http://localhost:30000", { waitUntil: "domcontentloaded" });
await page.waitForURL(/\/(?:join|game)/, { timeout: 30000 });

if (!page.url().includes("/game")) {
  await page.locator("select[name='userid']").waitFor({ timeout: 30000 });
  await page.locator("select[name='userid']").selectOption({ label: "Gamemaster" });
  await page.locator("input[type='password'], input[name='password']").first().fill("");

  await Promise.all([
    page.waitForURL(/\/game/, { timeout: 30000 }),
    page.getByRole("button", { name: /join game session/i }).click()
  ]);
}
```

For a default new world, the Gamemaster user may have no password. In that case, leave the password input blank.

## Waiting For Foundry

After `/game` loads, wait for Foundry's browser globals instead of relying on network idle or page load.

```js
await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 45000 });
await page.waitForFunction(() => globalThis.game?.pawn16?.assertHealthy, null, { timeout: 45000 });
```

For canvas-specific checks or screenshots:

```js
await page.waitForFunction(() => globalThis.canvas?.ready === true, null, { timeout: 45000 });
```

Foundry loads a lot of canvas and websocket state after the browser page itself exists, so DOM readiness is not enough.

## In-Browser API Usage

Playwright can call Foundry client APIs with `page.evaluate()`.

```js
const result = await page.evaluate(async () => {
  await game.pawn16.resetBoard();
  await new Promise(resolve => setTimeout(resolve, 250));
  return game.pawn16.assertHealthy();
});
```

For this repo, the stable test surface is our own `game.pawn16` helper API:

```js
game.pawn16.resetBoard()
game.pawn16.seedWorld()
game.pawn16.testState()
game.pawn16.assertHealthy()
game.pawn16.unpause()
game.pawn16.moveSelectedPawnForward()
```

Prefer reading this structured API instead of scraping UI text or inspecting screenshots.

## Foundry State Assertions

The smoke test currently validates:

```js
game.system.id === "pawn16"
game.world.id === "pawn16-test"
game.user.isGM === true
game.ready === true
game.paused === false
```

Scene checks:

```js
scene.name === "Pawn16 Board"
scene.width === 1280
scene.height === 1280
scene.grid.size === 80
scene.grid.distance === 1
scene.tiles.size === 0
scene.tokens.size === 32
```

Pawn checks:

```js
white pawn count === 16
black pawn count === 16
white rank === 14
black rank === 1
token.rotation === 0
token.lockRotation === true
token.actorLink === true
```

These checks caught the issues we were trying to avoid: paused game state, leftover board-image tiles, wrong token counts, misplaced pawns, and token rotation drift.

## Screenshots

Screenshots are debug artifacts, not the primary test signal.

Current artifact:

```text
test-results/pawn16-board.png
```

Use screenshots when state assertions pass but the visual presentation still looks wrong. Otherwise prefer `test-results/pawn16-state.json`.

## Playwright Runtime

The host machine may not have browser dependencies such as `libnspr4.so`. Running Playwright directly with `npm test` can fail in that case.

The Makefile runs Playwright through `compose.dev.yml` inside Microsoft's Docker image:

```yaml
test:
  image: mcr.microsoft.com/playwright:v1.59.1-noble
  environment:
    - FOUNDRY_URL=http://foundry:30000
```

Use:

```bash
make dev-restart
make test-foundry
make test-foundry-health
make test-foundry-rules
make state
make screenshot
```

The test container reaches Foundry over Docker DNS at `http://foundry:30000`, not host `localhost`.
If `node_modules/` is missing, the Makefile installs dependencies inside the Playwright container with `npm ci`; no host Node/npm installation is required for the default Make targets.

There is also a local fallback:

```bash
make test-foundry-local
```

That requires local Playwright browser dependencies to be installed.

## Known Startup Quirk

During `docker compose up -d --force-recreate`, Foundry can briefly log:

```text
Foundry VTT cannot start in this directory which is already locked by another process.
```

The container usually backs off and recovers on its own. The reliable signal is:

```bash
docker compose ps
```

Wait until the service is healthy before running browser tests.

## Official Docs Used

- Foundry system development: https://foundryvtt.com/article/system-development/
- Foundry data models: https://foundryvtt.com/article/system-data-models/
- Foundry game worlds: https://foundryvtt.com/article/game-worlds/
- Foundry configuration: https://foundryvtt.com/article/configuration/
- Foundry v14 Game API: https://foundryvtt.com/api/classes/foundry.Game.html
- Foundry v14 Scene data: https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.SceneData.html
- Foundry v14 Token data: https://foundryvtt.com/api/v14/interfaces/foundry.documents.types.TokenData.html
- Playwright screenshots: https://playwright.dev/docs/screenshots
