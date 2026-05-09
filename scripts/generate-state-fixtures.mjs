import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const fixtureDir = path.resolve("tests/fixtures/state");
await fs.mkdir(fixtureDir, { recursive: true });

const cases = [
  {
    name: "default",
    env: {}
  },
  {
    name: "filtered-knight-black",
    env: {
      STATE_SEEDED_ONLY: "1",
      STATE_PIECE_TYPE: "knight",
      STATE_SIDE: "black"
    }
  },
  {
    name: "text-knight-black",
    env: {
      STATE_SEEDED_ONLY: "1",
      STATE_PIECE_TYPE: "knight",
      STATE_SIDE: "black",
      STATE_TEXT: "1"
    }
  },
  {
    name: "verify-ui-knight",
    env: {
      STATE_SEEDED_ONLY: "1",
      STATE_PIECE_TYPE: "knight",
      STATE_VERIFY_UI: "1"
    }
  }
];

for (const item of cases) {
  const outputPath = path.join(fixtureDir, `${item.name}.json`);
  await runStateCaptureWithRetry(outputPath, item.env);
  console.log(`Wrote fixture ${outputPath}`);
}

async function runStateCaptureWithRetry(outputPath, envOverrides) {
  const attempts = 5;
  for (let index = 1; index <= attempts; index += 1) {
    try {
      await runStateCapture(outputPath, envOverrides);
      return;
    } catch (error) {
      if (index === attempts) throw error;
      console.warn(`State capture attempt ${index} failed. Retrying in 3s...`);
      await sleep(3000);
    }
  }
}

async function runStateCapture(outputPath, envOverrides) {
  const env = {
    ...process.env,
    FOUNDRY_STATE_OUTPUT: outputPath,
    STATE_STRICT: "1",
    ...envOverrides
  };

  await new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/foundry-state.mjs"], {
      stdio: "inherit",
      env
    });

    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`State capture failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
