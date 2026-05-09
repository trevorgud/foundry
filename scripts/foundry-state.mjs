import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const SCHEMA_VERSION = "1.0.0";
const PIECE_TYPES = ["pawn", "knight", "bishop", "king"];
const BACK_RANK_LAYOUT = [
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "king",
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "bishop",
  "knight",
  "bishop"
];
const baseURL = process.env.FOUNDRY_URL ?? "http://localhost:30000";
const output = process.env.FOUNDRY_STATE_OUTPUT ?? "test-results/pawn16-state.json";
const options = {
  reset: toBool(process.env.STATE_RESET, true),
  seededOnly: toBool(process.env.STATE_SEEDED_ONLY, false),
  side: normalizeNullable(process.env.STATE_SIDE),
  pieceType: normalizeNullable(process.env.STATE_PIECE_TYPE),
  movedOnly: toBool(process.env.STATE_MOVED_ONLY, false),
  fileMin: toNumber(process.env.STATE_FILE_MIN),
  fileMax: toNumber(process.env.STATE_FILE_MAX),
  rankMin: toNumber(process.env.STATE_RANK_MIN),
  rankMax: toNumber(process.env.STATE_RANK_MAX),
  text: toBool(process.env.STATE_TEXT, false),
  verifyUi: toBool(process.env.STATE_VERIFY_UI, false),
  strict: toBool(process.env.STATE_STRICT, true)
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await waitForPawn16(page);

  const snapshot = await page.evaluate(async evalOptions => {
    if (evalOptions.reset) {
      await game.pawn16.resetBoard();
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (evalOptions.verifyUi) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!canvas.ready) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    const healthy = game.pawn16.assertHealthy();
    const scene = canvas.scene ?? game.scenes.getName("Pawn16 Board");
    const gridSize = scene?.grid?.size ?? 80;
    const boardSize = Number.isFinite(scene?.width) && Number.isFinite(gridSize) && gridSize > 0
      ? Math.round(scene.width / gridSize)
      : 16;
    const rawTokens = scene
      ? Array.from(scene.tokens).map(token => {
        const pieceType = token.getFlag("pawn16", "pieceType") ?? token.actor?.type ?? null;
        return {
          id: token.id,
          name: token.name,
          seedId: token.getFlag("pawn16", "seedId") ?? null,
          pieceType,
          side: token.actor?.system?.side ?? null,
          file: token.actor?.system?.file ?? null,
          rank: token.actor?.system?.rank ?? null,
          hasMoved: token.actor?.system?.hasMoved === true,
          x: token.x,
          y: token.y,
          textureSrc: token.texture?.src ?? token.actor?.img ?? null,
          actorLink: token.actorLink === true,
          lockRotation: token.lockRotation === true,
          rotation: token.rotation
        };
      })
      : [];

    const uiVerify = evalOptions.verifyUi
      ? (() => {
        const issues = [];
        if (!scene || !canvas.tokens) {
          return { enabled: true, ok: false, issues: ["Scene or canvas tokens are unavailable for UI verification."] };
        }

        const placeableMap = new Map(canvas.tokens.placeables.map(placeable => [placeable.document.id, placeable]));
        for (const token of rawTokens) {
          const placeable = placeableMap.get(token.id);
          if (!placeable) {
            issues.push(`Missing placeable for token ${token.id} (${token.seedId ?? token.name}).`);
            continue;
          }
          if (Math.abs(placeable.x - token.x) > 0.5 || Math.abs(placeable.y - token.y) > 0.5) {
            issues.push(`Placeable position mismatch for ${token.id}: placeable (${placeable.x},${placeable.y}) vs document (${token.x},${token.y}).`);
          }
          const textureSrc = placeable.document.texture?.src ?? null;
          if (textureSrc !== token.textureSrc) {
            issues.push(`Texture mismatch for ${token.id}: placeable '${textureSrc}' vs document '${token.textureSrc}'.`);
          }
        }

        return { enabled: true, ok: issues.length === 0, issues };
      })()
      : { enabled: false, ok: true, issues: [] };

    return {
      health: healthy,
      turnState: game.pawn16.turnState?.() ?? null,
      scene: scene ? {
        name: scene.name,
        width: scene.width,
        height: scene.height,
        gridSize,
        boardSize,
        tokenCount: scene.tokens.size
      } : null,
      rawTokens,
      uiVerify
    };
  }, options);

  const filteredTokens = applyFilters(snapshot.rawTokens, options);
  const diagnostics = seededDiagnostics(snapshot.rawTokens, snapshot.scene?.boardSize ?? 16);
  const result = {
    schemaVersion: SCHEMA_VERSION,
    ok: snapshot.health.ok && snapshot.uiVerify.ok,
    generatedAt: new Date().toISOString(),
    options,
    health: snapshot.health,
    turnState: snapshot.turnState,
    scene: snapshot.scene,
    diagnostics: {
      seed: diagnostics,
      filteredCount: filteredTokens.length
    },
    tokens: filteredTokens,
    boardText: options.text ? renderBoardText(filteredTokens, snapshot.scene?.boardSize ?? 16) : null,
    uiVerify: snapshot.uiVerify
  };

  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (result.boardText) {
    console.log("");
    console.log(result.boardText);
  }
  process.exitCode = !options.strict || result.ok ? 0 : 1;
} finally {
  await browser.close();
}

async function waitForPawn16(page) {
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

function toBool(value, fallback) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNullable(value) {
  if (!value) return null;
  return value.toLowerCase();
}

function applyFilters(tokens, evalOptions) {
  return tokens.filter(token => {
    if (evalOptions.seededOnly && !token.seedId) return false;
    if (evalOptions.side && token.side !== evalOptions.side) return false;
    if (evalOptions.pieceType && token.pieceType !== evalOptions.pieceType) return false;
    if (evalOptions.movedOnly && token.hasMoved !== true) return false;
    if (evalOptions.fileMin != null && (token.file == null || token.file < evalOptions.fileMin)) return false;
    if (evalOptions.fileMax != null && (token.file == null || token.file > evalOptions.fileMax)) return false;
    if (evalOptions.rankMin != null && (token.rank == null || token.rank < evalOptions.rankMin)) return false;
    if (evalOptions.rankMax != null && (token.rank == null || token.rank > evalOptions.rankMax)) return false;
    return true;
  });
}

function seededDiagnostics(tokens, boardSize) {
  const seededTokens = tokens.filter(token => token.seedId);
  const seededByType = {};
  const seededBySide = {};
  const duplicates = {};
  const seen = new Set();

  for (const token of seededTokens) {
    const typeKey = token.pieceType ?? "unknown";
    const sideKey = token.side ?? "unknown";
    seededByType[typeKey] = (seededByType[typeKey] ?? 0) + 1;
    seededBySide[sideKey] = (seededBySide[sideKey] ?? 0) + 1;
    if (seen.has(token.seedId)) duplicates[token.seedId] = (duplicates[token.seedId] ?? 1) + 1;
    else seen.add(token.seedId);
  }

  const expected = expectedSeedIds(boardSize);
  const existing = new Set(seededTokens.map(token => token.seedId));
  const missingSeedIds = expected.filter(seedId => !existing.has(seedId));
  const duplicateSeedIds = Object.entries(duplicates).map(([seedId, extraCount]) => ({
    seedId,
    count: extraCount + 1
  }));
  const unseededPieceTokens = tokens
    .filter(token => PIECE_TYPES.includes(token.pieceType) && !token.seedId)
    .map(token => ({
      id: token.id,
      name: token.name,
      pieceType: token.pieceType,
      side: token.side,
      file: token.file,
      rank: token.rank
    }));

  return {
    expectedSeedCount: expected.length,
    seededTokenCount: seededTokens.length,
    seededCounts: {
      byPieceType: seededByType,
      bySide: seededBySide
    },
    duplicateSeedIds,
    missingSeedIds,
    unseededPieceTokens
  };
}

function expectedSeedIds(boardSize) {
  const size = Number.isFinite(boardSize) && boardSize > 0 ? boardSize : 16;
  const expected = [];
  for (const side of ["white", "black"]) {
    for (let file = 0; file < size; file += 1) {
      expected.push(`pawn-${side}-${file}`);
    }
    for (let file = 0; file < Math.min(size, BACK_RANK_LAYOUT.length); file += 1) {
      expected.push(`${BACK_RANK_LAYOUT[file]}-${side}-${file}`);
    }
  }
  return expected;
}

function renderBoardText(tokens, boardSize) {
  const size = Number.isFinite(boardSize) && boardSize > 0 ? boardSize : 16;
  const cells = new Map();
  for (const token of tokens) {
    if (!Number.isInteger(token.file) || !Number.isInteger(token.rank)) continue;
    const key = `${token.file},${token.rank}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(token);
  }

  const lines = [];
  lines.push("Board (top = highest rank)");
  lines.push("Legend: WP/BP=pawn, WN/BN=knight, WB/BB=bishop, WK/BK=king, ..=empty, *N=stacked");
  lines.push("");

  for (let rank = size - 1; rank >= 0; rank -= 1) {
    const row = [];
    for (let file = 0; file < size; file += 1) {
      const stack = cells.get(`${file},${rank}`) ?? [];
      row.push(cellToken(stack));
    }
    lines.push(`${String(rank).padStart(2, "0")} | ${row.join(" ")}`);
  }

  const fileLabels = [];
  for (let file = 0; file < size; file += 1) fileLabels.push(String(file).padStart(2, "0"));
  lines.push(`    ${fileLabels.join(" ")}`);
  return lines.join("\n");
}

function cellToken(stack) {
  if (!stack.length) return "..";
  if (stack.length > 1) return `*${stack.length}`;
  const token = stack[0];
  const side = token.side === "white" ? "W" : "B";
  const type = {
    pawn: "P",
    knight: "N",
    bishop: "B",
    king: "K"
  }[token.pieceType] ?? "?";
  return `${side}${type}`;
}
